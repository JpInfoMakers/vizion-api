import { Injectable, Logger, HttpException, ServiceUnavailableException, InternalServerErrorException } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { format } from 'date-fns';

export type ResponseData = {
  recomendacao: 'compra' | 'venda';
  probabilidade: number;
  explicacao: string;
  entrada: string;
};

@Injectable()
export class OpenIAService {
  private readonly logger = new Logger(OpenIAService.name);
  private readonly apiKey = (process.env.OPENAI_TOKEN || '').trim();
  private readonly baseURL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  private readonly http: AxiosInstance;

  // ---------- Limitação de taxa (in-process) ----------
  private static readonly MAX_CONCURRENCY = 1;      // serializa chamadas
  private static readonly MIN_GAP_MS = 350;         // espaçamento mínimo entre chamadas
  private static running = 0;
  private static queue: Array<() => void> = [];
  private static lastCallTs = 0;

  private static acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.running < this.MAX_CONCURRENCY) {
        this.running++;
        resolve();
      } else {
        this.queue.push(() => {
          this.running++;
          resolve();
        });
      }
    });
  }
  private static release() {
    this.running = Math.max(0, this.running - 1);
    const next = this.queue.shift();
    if (next) next();
  }

  private static async pace() {
    const now = Date.now();
    const delta = now - this.lastCallTs;
    if (delta < this.MIN_GAP_MS) {
      await OpenIAService.sleep(this.MIN_GAP_MS - delta);
    }
    this.lastCallTs = Date.now();
  }

  private static sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  // ---------- Cache simples por imagem (TTL curto) ----------
  private static cache = new Map<string, { t: number; data: ResponseData }>();
  private static readonly CACHE_TTL_MS = 8_000; // 8s

  constructor() {
    this.logger.log('Inicializando OpenIAService...');

    if (!this.apiKey) {
      this.logger.error('OPENAI_TOKEN ausente no ambiente.');
      throw new InternalServerErrorException('OPENAI_TOKEN ausente no ambiente.');
    }

    this.logger.debug(`Usando baseURL da OpenAI: ${this.baseURL}`);

    this.http = axios.create({
      baseURL: this.baseURL,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    this.logger.log('OpenIAService inicializado com sucesso.');
  }

  async find(img: string): Promise<ResponseData> {
    const now = new Date();
    const entrada = format(new Date(now.getTime() + 90 * 1000), 'HH:mm:ss');

    this.logger.debug(`find() chamado. Imagem recebida: ${img}`);

    // cache por imagem
    const c = OpenIAService.cache.get(img);
    if (c && Date.now() - c.t < OpenIAService.CACHE_TTL_MS) {
      this.logger.debug(`Cache hit para ${img}`);
      return c.data;
    }

    const payload = {
      model: 'gpt-4o-mini',
      // Quando disponível, ajuda a reduzir tokens extras
      response_format: { type: 'json_object' as const },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
`Retorne APENAS JSON válido.
Analise a imagem (gráfico 5s) e responda:
{
  "recomendacao": "buy"|"sell",
  "probabilidade": 60-90,
  "explicacao": "PT-BR, máx 30 palavras",
  "entrada": "${entrada}"
}`,
            },
            { type: 'image_url', image_url: { url: img, detail: 'low' as const } },
          ],
        },
      ],
      temperature: 0.0,
      max_tokens: 160, // reduzido para aliviar TPM
    };

    this.logger.debug(`Payload enviado à OpenAI: ${JSON.stringify(payload, null, 2)}`);

    await OpenIAService.acquire();
    try {
      await OpenIAService.pace(); // respeita gap mínimo

      const { data } = await this.postWithRetries('/chat/completions', payload);

      const decoded: string = data?.choices?.[0]?.message?.content || '';
      if (!decoded) {
        throw new ServiceUnavailableException('Nenhuma resposta decodificada encontrada da IA.');
      }

      this.logger.debug(`Resposta IA (conteúdo): ${decoded}`);

      const parsed = OpenIAService.extractValidateAndNormalizeJson(decoded);

      this.logger.debug(`JSON final normalizado: ${JSON.stringify(parsed)}`);

      // guarda no cache
      OpenIAService.cache.set(img, { t: Date.now(), data: parsed });

      return parsed;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const e = err as AxiosError<any>;
        const status = e.response?.status ?? 502;
        const detail = e.response?.data?.error || e.response?.data || e.message || 'Erro ao chamar API de IA';
        this.logger.error(`Erro na solicitação à API de IA (${status}): ${JSON.stringify(detail)}`);
        throw new HttpException({ message: 'Erro ao consultar o provedor de IA', detail }, status);
      }
      this.logger.error(`Erro inesperado: ${String(err)}`);
      throw new ServiceUnavailableException('Falha inesperada ao consultar a IA.');
    } finally {
      OpenIAService.release();
    }
  }

  private async postWithRetries(path: string, body: any, maxRetries = 4) {
    let attempt = 0;
    let lastErr: any = null;

    while (attempt <= maxRetries) {
      try {
        return await this.http.post(path, body);
      } catch (err) {
        lastErr = err;
        if (!axios.isAxiosError(err)) throw err;

        const status = err.response?.status ?? 0;
        const msg = String(err.response?.data?.error || err.response?.data || err.message || '');

        // 429 / 5xx → backoff + retry
        if (status === 429 || (status >= 500 && status < 600)) {
          // tenta extrair "Please try again in 280ms"
          const m = msg.match(/try again in\s+(\d+)ms/i);
          const suggested = m ? Number(m[1]) : 0;

          // Ou usa Retry-After (segundos)
          const raHeader = err.response?.headers?.['retry-after'];
          const raMs = raHeader ? Number(raHeader) * 1000 : 0;

          const base = Math.max(suggested, raMs, 250);
          const jitter = Math.floor(Math.random() * 150);
          const backoff = base * Math.pow(2, attempt) + jitter;

          this.logger.warn(`Rate limit/5xx (status ${status}). Retry ${attempt + 1}/${maxRetries} em ${backoff}ms`);
          await OpenIAService.sleep(backoff);

          attempt++;
          continue;
        }

        // Demais erros: não adianta tentar de novo
        throw err;
      }
    }

    throw lastErr;
  }

  private static extractValidateAndNormalizeJson(text: string): ResponseData {
    let raw: any = null;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { raw = JSON.parse(jsonMatch[0]); } catch {}
    }
    if (!raw) raw = this.extractStructuredDataFromMarkdown(text);
    if (!raw) throw new Error('Não foi possível extrair dados estruturados');

    let recRaw = String(
      raw.recomendacao ||
      raw['recomendação'] ||
      raw.recommendation ||
      ''
    ).toLowerCase();

    if (recRaw === 'buy') recRaw = 'compra';
    else if (recRaw === 'sell') recRaw = 'venda';

    const prob = Number(raw.probabilidade ?? raw.probability ?? 0);
    const exp = String(raw.explicacao || raw['explicação'] || raw.explanation || '');
    const ent = String(raw.entrada || raw.entry || '');

    return {
      recomendacao: recRaw as 'compra' | 'venda',
      probabilidade: prob,
      explicacao: exp,
      entrada: ent,
    };
  }

  private static extractStructuredDataFromMarkdown(text: string): any {
    const result: Record<string, any> = {};
    const pairs = text.match(/\*\*([^*]+)\*\*:\s*([\s\S]*?)(?=\n\*\*|$)/g);
    if (!pairs) return null;
    for (const p of pairs) {
      const m = p.match(/\*\*([^*]+)\*\*:\s*([\s\S]*)/);
      if (!m) continue;
      const k = m[1].trim().toLowerCase();
      const v = m[2].trim();
      result[k] = k === 'probabilidade' ? Number((v.match(/(\d+(\.\d+)?)/)?.[1] ?? 0)) : v;
    }
    return result;
  }
}
