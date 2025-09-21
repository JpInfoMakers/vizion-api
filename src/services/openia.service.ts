import { Injectable, Logger } from '@nestjs/common';
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

  constructor() {
    if (!this.apiKey) {
      throw new Error('OPENAI_TOKEN ausente no ambiente.');
    }
    this.http = axios.create({
      baseURL: this.baseURL,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });
  }

  async find(img: string): Promise<ResponseData> {
    const now = new Date();
    const entrada = format(new Date(now.getTime() + 90 * 1000), 'HH:mm:ss');

    this.logger.debug(`find() chamado. Imagem recebida: ${img}`);

    const payload = {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `
IMPORTANT: You are a professional trader tasked with analyzing chart images and providing structured recommendations.
IMPORTANT: You must ONLY return a valid JSON object with no additional text before or after it.

Analyze the chart image where candles last 5 seconds, evaluating support, resistance, and trend patterns.

Evaluate:
- Recent price movement patterns
- Support and resistance levels
- Volume trends
- Candle formations
- Momentum indicators

Return a JSON with:
- recomendacao: "buy" or "sell"
- probabilidade: 60-90
- explicacao: PT-BR, max 30 words
- entrada: "${entrada}"

IMPORTANT: entrada: "${entrada}", recomendacao: "buy"/"sell", probabilidade: 60-90 only.
`,
            },
            { type: 'image_url', image_url: { url: img } },
          ],
        },
      ],
      temperature: 0.0,
      max_tokens: 300,
    };

    this.logger.debug(`Payload enviado à OpenAI: ${JSON.stringify(payload, null, 2)}`);

    try {
      const { data } = await this.http.post('/chat/completions', payload);

      this.logger.debug(`Resposta bruta da OpenAI: ${JSON.stringify(data, null, 2)}`);

      const decoded: string = data?.choices?.[0]?.message?.content || '';
      if (!decoded) throw new Error('Nenhuma resposta decodificada encontrada.');

      this.logger.debug(`Resposta IA (conteúdo): ${decoded}`);

      const parsed = OpenIAService.extractValidateAndNormalizeJson(decoded);

      this.logger.debug(`JSON final normalizado: ${JSON.stringify(parsed)}`);

      return parsed;
    } catch (err) {
      const e = err as AxiosError<any>;
      const status = e.response?.status;
      const detail = e.response?.data?.error || e.response?.data || e.message;

      this.logger.error(`Erro na chamada OpenAI (${status}): ${JSON.stringify(detail)}`);
      throw err;
    }
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
