import { Injectable } from '@nestjs/common';
import { TradeService } from '../trade.service';
import { InstrumentType } from '@tradecodehub/client-sdk-js';

@Injectable()
export class PositionsService {
  constructor(private readonly trade: TradeService) {}

  async getAll() {
    const positions = await this.trade.getSdk().positions();
    return positions.getAllPositions();
  }

  async getByInstrument(type: InstrumentType) {
    const positions = await this.trade.getSdk().positions();
    return positions.getAllPositions().filter((p) => p.instrumentType === type);
  }

  async subscribeAll(cb?: (p: any) => void) {
    const positions = await this.trade.getSdk().positions();
    positions.subscribeOnUpdatePosition((p: any) => {
      cb?.(p);
      if (!cb) console.log(p);
    });
  }

  async history() {
    const positions = await this.trade.getSdk().positions();
    const hist = await positions.getPositionsHistory();
    return hist.getPositions();
  }

  async sellByExternalId(externalId: number) {
    const positions = await this.trade.getSdk().positions();
    const pos = positions.getAllPositions().find((p) => p.externalId == externalId);
    if (!pos) return false;
    // Nota do SDK: não disponível para blitz options
    if (typeof pos.sell === 'function') {
      await pos.sell();
      return true;
    }
    return false;
  }

  async pnlInfo(externalId: number) {
    const positions = await this.trade.getSdk().positions();
    const pos = positions.getAllPositions().find((p) => p.externalId == externalId);
    if (!pos) return null;
    return { pnlNet: pos.pnlNet, sellProfit: pos.sellProfit };
  }
}
