import { BadRequestException, Injectable } from '@nestjs/common';
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
    const sdk = await this.trade.getClientForUser(userId);
    const baseNow = await this.wsNow(sdk);
    const when = at ? new Date(at) : baseNow;
    if (Number.isNaN(when.getTime())) throw new BadRequestException('Parâmetro "at" inválido');

    switch (kind) {
      case 'blitz': {
        if (!sdk.blitzOptions) throw new BadRequestException('Blitz options não suportado pelo SDK');
        const x = await sdk.blitzOptions();
        return x.getActives().filter(a => a.canBeBoughtAt(when)).map(a => this.mapBlitz(a));
      }
      case 'turbo': {
        if (!sdk.turboOptions) throw new BadRequestException('Turbo options não suportado pelo SDK');
        const x = await sdk.turboOptions();
        return x.getActives().filter(a => !a.isSuspended).map(a => this.mapTurbo(a));
      }
      case 'binary': {
        if (!sdk.binaryOptions) throw new BadRequestException('Binary options não suportado pelo SDK');
        const x = await sdk.binaryOptions();
        return x.getActives().filter(a => !a.isSuspended).map(a => this.mapBinary(a));
      }
      case 'digital': {
        if (!sdk.digitalOptions) throw new BadRequestException('Digital options não suportado pelo SDK');
        const x = await sdk.digitalOptions();
        return x.getUnderlyingsAvailableForTradingAt(when).map(u => this.mapDigital(u));
      }
      case 'margin-forex': {
        if (!sdk.marginForex) throw new BadRequestException('Margin Forex não suportado pelo SDK');
        const x = await sdk.marginForex();
        return x.getUnderlyingsAvailableForTradingAt(when).map(u => this.mapMargin(u));
      }
      case 'margin-cfd': {
        if (!sdk.marginCfd) throw new BadRequestException('Margin CFD não suportado pelo SDK');
        const x = await sdk.marginCfd();
        return x.getUnderlyingsAvailableForTradingAt(when).map(u => this.mapMargin(u));
      }
      case 'margin-crypto': {
        if (!sdk.marginCrypto) throw new BadRequestException('Margin Crypto não suportado pelo SDK');
        const x = await sdk.marginCrypto();
        return x.getUnderlyingsAvailableForTradingAt(when).map(u => this.mapMargin(u));
      }
      default:
        throw new BadRequestException('kind inválido');
    }
  }

  async getCandles(userId: string, q: GetCandlesQuery) {
    const sdk = await this.trade.getClientForUser(userId);
    if (!sdk.candles) throw new BadRequestException('Candles API não suportada pelo SDK');

    const candles = await sdk.candles();
    const from = toMs(q.from as any);
    const to = toMs(q.to as any);
    const size = toNum((q as any).size) ?? (q as any).size; // se o SDK aceita string/enum, mantenha
    const count = toNum(q.count) ?? 200;
    const backoff = toNum((q as any).backoff) ?? 0;
    const onlyClosed = (q.onlyClosed ?? true) as boolean;
    const splitNormalization = (q.splitNormalization ?? false) as boolean;

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

    return candles.getCandles(q.activeId, size, opts);
  }
}
