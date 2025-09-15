import { Injectable, BadRequestException } from '@nestjs/common';
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

@Injectable()
export class MarketService {
  constructor(private readonly trade: TradeService) {}

  private wsNow(sdk: ClientSdk) { return sdk.currentTime(); }

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
    const now = at ? new Date(at) : this.wsNow(sdk);

    switch (kind) {
      case 'blitz': {
        const x = await sdk.blitzOptions();
        return x.getActives().filter(a => a.canBeBoughtAt(now)).map(a => this.mapBlitz(a));
      }
      case 'turbo': {
        const x = await sdk.turboOptions();
        return x.getActives().filter(a => !a.isSuspended).map(a => this.mapTurbo(a));
      }
      case 'binary': {
        const x = await sdk.binaryOptions();
        return x.getActives().filter(a => !a.isSuspended).map(a => this.mapBinary(a));
      }
      case 'digital': {
        const x = await sdk.digitalOptions();
        return x.getUnderlyingsAvailableForTradingAt(now).map(u => this.mapDigital(u));
      }
      case 'margin-forex': {
        const x = await sdk.marginForex();
        return x.getUnderlyingsAvailableForTradingAt(now).map(u => this.mapMargin(u));
      }
      case 'margin-cfd': {
        const x = await sdk.marginCfd();
        return x.getUnderlyingsAvailableForTradingAt(now).map(u => this.mapMargin(u));
      }
      case 'margin-crypto': {
        const x = await sdk.marginCrypto();
        return x.getUnderlyingsAvailableForTradingAt(now).map(u => this.mapMargin(u));
      }
      default:
        throw new BadRequestException('kind inválido');
    }
  }

  async getCandles(userId: string, q: GetCandlesQuery) {
    const sdk = await this.trade.getClientForUser(userId);
    const candles = await sdk.candles();
    const opts: any = {
      from: q.from,
      to: q.to,
      fromId: (q as any).fromId,
      toId: (q as any).toId,
      count: q.count ?? 200,
      backoff: (q as any).backoff ?? 0,
      onlyClosed: q.onlyClosed ?? true,
      kind: q.kind,
      splitNormalization: q.splitNormalization ?? false,
    };
    Object.keys(opts).forEach(k => opts[k] === undefined && delete opts[k]);
    return candles.getCandles(q.activeId, q.size, opts);
  }
}