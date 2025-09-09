import { Injectable } from '@nestjs/common';
import { InstrumentType } from '@tradecodehub/client-sdk-js';
import { TradeService } from './trade.service';

@Injectable()
export class PositionsService {
  constructor(private readonly trade: TradeService) {}

  async getAll(userId: string) {
    const sdk = await this.trade.getClientForUser(userId);
    const positions = await sdk.positions();
    return positions.getAllPositions();
  }

  async getByInstrument(userId: string, type: InstrumentType) {
    const sdk = await this.trade.getClientForUser(userId);
    const positions = await sdk.positions();
    return positions.getAllPositions().filter((p) => p.instrumentType === type);
  }

  async subscribeAll(userId: string, cb?: (p: any) => void) {
    const sdk = await this.trade.getClientForUser(userId);
    const positions = await sdk.positions();
    positions.subscribeOnUpdatePosition((p: any) => {
      cb?.(p);
      if (!cb) console.log(p);
    });
  }

  async history(userId: string) {
    const sdk = await this.trade.getClientForUser(userId);
    const positions = await sdk.positions();
    const hist = await positions.getPositionsHistory();
    return hist.getPositions();
  }

  async sellByExternalId(userId: string, externalId: number) {
    const sdk = await this.trade.getClientForUser(userId);
    const positions = await sdk.positions();
    const pos = positions.getAllPositions().find((p) => p.externalId == externalId);
    if (!pos) return false;
    if (typeof pos.sell === 'function') {
      await pos.sell();
      return true;
    }
    return false;
  }

  async pnlInfo(userId: string, externalId: number) {
    const sdk = await this.trade.getClientForUser(userId);
    const positions = await sdk.positions();
    const pos = positions.getAllPositions().find((p) => p.externalId == externalId);
    if (!pos) return null;
    return { pnlNet: pos.pnlNet, sellProfit: pos.sellProfit };
  }
}
