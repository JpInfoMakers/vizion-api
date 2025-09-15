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
  return Number.isFinite(p) ? p : undefined;
}
function toNum(v: any) {
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? Number(n) : undefined;
}

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  constructor(private readonly trade: TradeService) { }

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

  private mapBlitz(a: BlitzOptionsActive): ActiveSummaryDto {
    return {
      id: a.id,
      ticker: a.ticker,
      isSuspended: a.isSuspended,
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
    const t0 = Date.now();
    this.logger.log(`[listActives] IN userId=${userId} kind=${kind} at=${at ?? '<now>'}`);

    const sdk = await this.trade.getClientForUser(userId);
    const baseNow = await this.wsNow(sdk);
    const when = at ? new Date(at) : baseNow;
    if (Number.isNaN(when.getTime())) {
      this.logger.warn(`[listActives] invalid "at" received: ${at}`);
      throw new BadRequestException('Parâmetro "at" inválido');
    }

    try {
      let out: ActiveSummaryDto[] = [];
      switch (kind) {
        case 'blitz': {
          if (!sdk.blitzOptions) throw new BadRequestException('Blitz options não suportado pelo SDK');
          const x = await sdk.blitzOptions();
          out = x.getActives().filter(a => a.canBeBoughtAt(when)).map(a => this.mapBlitz(a));
          break;
        }
        case 'turbo': {
          if (!sdk.turboOptions) throw new BadRequestException('Turbo options não suportado pelo SDK');
          const x = await sdk.turboOptions();
          out = x.getActives().filter(a => !a.isSuspended).map(a => this.mapTurbo(a));
          break;
        }
        case 'binary': {
          if (!sdk.binaryOptions) throw new BadRequestException('Binary options não suportado pelo SDK');
          const x = await sdk.binaryOptions();
          out = x.getActives().filter(a => !a.isSuspended).map(a => this.mapBinary(a));
          break;
        }
        case 'digital': {
          if (!sdk.digitalOptions) throw new BadRequestException('Digital options não suportado pelo SDK');
          const x = await sdk.digitalOptions();
          out = x.getUnderlyingsAvailableForTradingAt(when).map(u => this.mapDigital(u));
          break;
        }
        case 'margin-forex': {
          if (!sdk.marginForex) throw new BadRequestException('Margin Forex não suportado pelo SDK');
          const x = await sdk.marginForex();
          out = x.getUnderlyingsAvailableForTradingAt(when).map(u => this.mapMargin(u));
          break;
        }
        case 'margin-cfd': {
          if (!sdk.marginCfd) throw new BadRequestException('Margin CFD não suportado pelo SDK');
          const x = await sdk.marginCfd();
          out = x.getUnderlyingsAvailableForTradingAt(when).map(u => this.mapMargin(u));
          break;
        }
        case 'margin-crypto': {
          if (!sdk.marginCrypto) throw new BadRequestException('Margin Crypto não suportado pelo SDK');
          const x = await sdk.marginCrypto();
          out = x.getUnderlyingsAvailableForTradingAt(when).map(u => this.mapMargin(u));
          break;
        }
        default:
          throw new BadRequestException('kind inválido');
      }

      const dt = Date.now() - t0;
      this.logger.log(`[listActives] OK kind=${kind} count=${out.length} took=${dt}ms`);
      return out;
    } catch (err: any) {
      const dt = Date.now() - t0;
      this.logger.error(
        `[listActives] ERROR kind=${kind} took=${dt}ms -> ${err?.message}`,
        err?.stack,
      );
      throw err;
    }
  }

  async getCandles(userId: string, q: GetCandlesQuery) {
    const t0 = Date.now();
    this.logger.log(`[getCandles] IN userId=${userId} q=${JSON.stringify(q)}`);

    const sdk = await this.trade.getClientForUser(userId);
    if (!sdk.candles) {
      this.logger.warn('[getCandles] Candles API não suportada pelo SDK');
      throw new BadRequestException('Candles API não suportada pelo SDK');
    }

    try {
      const candles = await sdk.candles();

      const from = toMs(q.from as any);
      const to = toMs(q.to as any);
      const size = toNum((q as any).size) ?? (q as any).size; // mantém se SDK aceitar string/enum
      const count = toNum(q.count) ?? 200;
      const backoff = toNum((q as any).backoff) ?? 0;
      const onlyClosed = (q.onlyClosed ?? true) as boolean;
      const splitNormalization = (q.splitNormalization ?? false) as boolean;

      // log de parâmetros efetivos
      this.logger.log(
        `[getCandles] params activeId=${q.activeId} size=${size} from=${from ?? '-'} to=${to ?? '-'} ` +
        `count=${count} backoff=${backoff} onlyClosed=${onlyClosed} splitNorm=${splitNormalization}`
      );

      const opts: Record<string, any> = {
        from: from !== undefined ? from : undefined,
        to: to !== undefined ? to : undefined,
        fromId: (q as any).fromId ?? undefined,
        toId: (q as any).toId ?? undefined,
        count,
        backoff,
        onlyClosed,
        kind: (q as any).kind ?? undefined,
        splitNormalization,
      };

      const out: any = await candles.getCandles(q.activeId, size, opts);

      const dt = Date.now() - t0;
      const len = Array.isArray(out) ? out.length : (out && typeof out === 'object' && 'candles' in out && Array.isArray((out as any).candles))
        ? (out as any).candles.length
        : '??';
      this.logger.log(`[getCandles] OK activeId=${q.activeId} size=${size} count=${len} took=${dt}ms`);

      return out;
    } catch (err: any) {
      const dt = Date.now() - t0;
      this.logger.error(
        `[getCandles] ERROR userId=${userId} q=${JSON.stringify(q)} took=${dt}ms -> ${err?.message}`,
        err?.stack,
      );
      throw err;
    }
  }
}
