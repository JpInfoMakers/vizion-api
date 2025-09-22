import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  ClientSdk,
  BlitzOptionsActive,
  TurboOptionsActive,
  BinaryOptionsActive,
  DigitalOptionsUnderlying,
  MarginUnderlying,
} from '@tradecodehub/client-sdk-js';
import { TradeService } from './trade.service';
import { ActiveKind, ActiveSummaryDto } from '../dtos/actives.dto';
import { GetCandlesQuery } from '../dtos/candles.dto';

function toIso(d: Date) { return d.toISOString(); }
function toMs(v?: string | number | null) {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  if (Number.isFinite(n)) return n;
  const p = Date.parse(String(v));
  return Number.isFinite(p) ? Math.floor(p) : undefined;
}
function toNum(v: any) {
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? Number(n) : undefined;
}
function isWs4000(e: any) {
  const msg = String(e?.message ?? e ?? '');
  return msg.includes('status 4000');
}

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  constructor(private readonly trade: TradeService) {}

  private async wsNow(sdk: ClientSdk) {
    const maybe = await sdk.currentTime();
    return maybe instanceof Date ? maybe : new Date(maybe);
  }

  private mapSchedule(
    ranges?: { from: Date; to: Date }[] | { open: Date; close: Date }[]
  ) {
    return ranges?.map((r: any) => {
      const start: Date = r.from ?? r.open;
      const end: Date = r.to ?? r.close;
      return { from: toIso(start), to: toIso(end) };
    });
  }

  // ---------- Mapeadores (status direto do SDK, sem formatação) ----------
  private mapBlitz(a: BlitzOptionsActive): ActiveSummaryDto {
    return {
      id: a.id,
      ticker: a.ticker,
      isSuspended: a.isSuspended, // <- sem transformação
      expirationTimes: a.expirationTimes,
      profitCommissionPercent: a.profitCommissionPercent,
      schedule: this.mapSchedule(a.schedule),
    };
  }
  private mapTurbo(a: TurboOptionsActive): ActiveSummaryDto {
    return {
      id: a.id,
      ticker: a.ticker,
      isSuspended: a.isSuspended,
      expirationTimes: a.expirationTimes,
      profitCommissionPercent: a.profitCommissionPercent,
      schedule: this.mapSchedule(a.schedule),
    };
  }
  private mapBinary(a: BinaryOptionsActive): ActiveSummaryDto {
    return {
      id: a.id,
      ticker: a.ticker,
      isSuspended: a.isSuspended,
      expirationTimes: a.expirationTimes,
      profitCommissionPercent: a.profitCommissionPercent,
      schedule: this.mapSchedule(a.schedule),
    };
  }
  private mapDigital(u: DigitalOptionsUnderlying): ActiveSummaryDto {
    return {
      id: u.activeId,
      ticker: u.name,
      isSuspended: u.isSuspended,
      schedule: this.mapSchedule(u.schedule),
    };
  }
  private mapMargin(u: MarginUnderlying): ActiveSummaryDto {
    return {
      id: u.activeId,
      ticker: u.name,
      isSuspended: u.isSuspended,
      schedule: this.mapSchedule(u.schedule),
    };
  }

  async listActives(userId: string, kind: ActiveKind, at?: string): Promise<ActiveSummaryDto[]> {
    const sdk = await this.trade.getClientForUser(userId);
    const baseNow = await this.wsNow(sdk);
    const when = at ? new Date(at) : baseNow;
    if (Number.isNaN(when.getTime())) throw new BadRequestException('Parâmetro "at" inválido');

    this.logger.log(`[listActives] IN kind=${kind} at=${when.toISOString()}`);

    switch (kind) {
      case 'blitz': {
        if (!sdk.blitzOptions) throw new BadRequestException('Blitz options não suportado pelo SDK');
        const x = await sdk.blitzOptions();
        const raw = x.getActives(); // sem filtro
        const all = raw.map(a => this.mapBlitz(a));
        const avail = all.filter(a => !a.isSuspended).length;
        this.logger.log(`[listActives] blitz -> total=${all.length} disponiveis=${avail} suspensos=${all.length - avail}`);
        return all;
      }
      case 'turbo': {
        if (!sdk.turboOptions) throw new BadRequestException('Turbo options não suportado pelo SDK');
        const x = await sdk.turboOptions();
        const raw = x.getActives(); // sem filtro
        const all = raw.map(a => this.mapTurbo(a));
        const avail = all.filter(a => !a.isSuspended).length;
        this.logger.log(`[listActives] turbo -> total=${all.length} disponiveis=${avail} suspensos=${all.length - avail}`);
        return all;
      }
      case 'binary': {
        if (!sdk.binaryOptions) throw new BadRequestException('Binary options não suportado pelo SDK');
        const x = await sdk.binaryOptions();
        const raw = x.getActives(); // sem filtro
        const all = raw.map(a => this.mapBinary(a));
        const avail = all.filter(a => !a.isSuspended).length;
        this.logger.log(`[listActives] binary -> total=${all.length} disponiveis=${avail} suspensos=${all.length - avail}`);
        return all;
      }
      case 'digital': {
        if (!sdk.digitalOptions) throw new BadRequestException('Digital options não suportado pelo SDK');
        const x = await sdk.digitalOptions();
        // O método already filtra "availableForTradingAt(when)"; ainda assim mantemos o status do SDK.
        const all = x.getUnderlyingsAvailableForTradingAt(when).map(u => this.mapDigital(u));
        const avail = all.filter(a => !a.isSuspended).length;
        this.logger.log(`[listActives] digital -> total=${all.length} disponiveis=${avail} suspensos=${all.length - avail}`);
        return all;
      }
      case 'margin-forex': {
        if (!sdk.marginForex) throw new BadRequestException('Margin Forex não suportado pelo SDK');
        const x = await sdk.marginForex();
        const all = x.getUnderlyingsAvailableForTradingAt(when).map(u => this.mapMargin(u));
        const avail = all.filter(a => !a.isSuspended).length;
        this.logger.log(`[listActives] margin-forex -> total=${all.length} disponiveis=${avail} suspensos=${all.length - avail}`);
        return all;
      }
      case 'margin-cfd': {
        if (!sdk.marginCfd) throw new BadRequestException('Margin CFD não suportado pelo SDK');
        const x = await sdk.marginCfd();
        const all = x.getUnderlyingsAvailableForTradingAt(when).map(u => this.mapMargin(u));
        const avail = all.filter(a => !a.isSuspended).length;
        this.logger.log(`[listActives] margin-cfd -> total=${all.length} disponiveis=${avail} suspensos=${all.length - avail}`);
        return all;
      }
      case 'margin-crypto': {
        if (!sdk.marginCrypto) throw new BadRequestException('Margin Crypto não suportado pelo SDK');
        const x = await sdk.marginCrypto();
        const all = x.getUnderlyingsAvailableForTradingAt(when).map(u => this.mapMargin(u));
        const avail = all.filter(a => !a.isSuspended).length;
        this.logger.log(`[listActives] margin-crypto -> total=${all.length} disponiveis=${avail} suspensos=${all.length - avail}`);
        return all;
      }
      default:
        throw new BadRequestException('kind inválido');
    }
  }

  async getCandles(userId: string, q: GetCandlesQuery) {
    const t0 = Date.now();
    this.logger.log(`[getCandles] IN userId=${userId} q=${JSON.stringify(q)}`);

    const activeId = toNum((q as any).activeId);
    const size = toNum((q as any).size);
    if (!Number.isFinite(activeId as number) || !Number.isFinite(size as number)) {
      throw new BadRequestException('Parâmetros "activeId" e "size" devem ser numéricos');
    }

    const from = toMs((q as any).from);
    const to = toMs((q as any).to);
    const count = toNum(q.count) ?? 200;
    const backoff = toNum((q as any).backoff) ?? 0;

    const onlyClosed = typeof q.onlyClosed === 'boolean' ? q.onlyClosed : undefined;
    const splitNormalization = typeof (q as any).splitNormalization === 'boolean' ? (q as any).splitNormalization : undefined;

    const fullOpts: Record<string, any> = {};
    if (from !== undefined) fullOpts.from = from;
    if (to !== undefined) fullOpts.to = to;
    if ((q as any).fromId !== undefined) fullOpts.fromId = (q as any).fromId;
    if ((q as any).toId !== undefined) fullOpts.toId = (q as any).toId;
    if (count !== undefined) fullOpts.count = count;
    if (backoff !== undefined) fullOpts.backoff = backoff;
    if (onlyClosed !== undefined) fullOpts.onlyClosed = onlyClosed;
    if ((q as any).kind !== undefined) fullOpts.kind = (q as any).kind;
    if (splitNormalization !== undefined) fullOpts.splitNormalization = splitNormalization;

    const minimalOpts: Record<string, any> = {};
    if (from !== undefined) minimalOpts.from = from;
    if (to !== undefined) minimalOpts.to = to;
    if (count !== undefined) minimalOpts.count = count;

    let attempt = 0;
    let lastErr: any = null;

    const plans = [
      { name: 'full', opts: fullOpts, refresh: false },
      { name: 'minimal', opts: minimalOpts, refresh: false },
      { name: 'invalidate+minimal', opts: minimalOpts, refresh: true },
    ];

    for (const plan of plans) {
      attempt++;
      try {
        if (plan.refresh) {
          this.logger.warn(`[getCandles] attempt#${attempt} -> invalidating session and recreating…`);
          await this.trade.invalidate(userId);
        }

        const sdk = await this.trade.getClientForUser(userId);
        if (!sdk.candles) throw new BadRequestException('Candles API não suportada pelo SDK');

        const candles = await sdk.candles();

        this.logger.log(
          `[getCandles] attempt#${attempt} plan=${plan.name} params activeId=${activeId} size=${size}` +
          ` from=${from ?? '-'} to=${to ?? '-'} count=${count ?? '-'}`
        );

        const out = await candles.getCandles(activeId as number, size as number, plan.opts);
        const len = Array.isArray(out) ? out.length : (out as any)?.candles?.length ?? '??';

        this.logger.log(
          `[getCandles] OK attempt#${attempt} plan=${plan.name} -> len=${len} took=${Date.now() - t0}ms`
        );
        return out;
      } catch (e: any) {
        lastErr = e;
        const took = Date.now() - t0;
        this.logger.error(
          `[getCandles] ERROR attempt#${attempt} plan=${plan.name} took=${took}ms -> ${e?.message || e}`
        );
        if (!isWs4000(e)) {
          break;
        }
      }
    }

    throw lastErr || new BadRequestException('Falha ao obter candles');
  }
}
