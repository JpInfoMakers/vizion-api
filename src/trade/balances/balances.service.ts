import { Injectable } from '@nestjs/common';
import { BalanceType } from '@tradecodehub/client-sdk-js';
import { TradeService } from '../trade.service';

@Injectable()
export class BalancesService {
  constructor(private readonly trade: TradeService) {}

  async listAll() {
    const balances = await this.trade.getSdk().balances();
    return balances.getBalances();
  }

  async findByType(type: BalanceType) {
    const balances = await this.trade.getSdk().balances();
    return balances.getBalances().find((b) => b.type === type);
  }

  async subscribeUpdatesForType(type: BalanceType, cb?: (u: any) => void) {
    const balance = await this.findByType(type);
    if (!balance) return;
    balance.subscribeOnUpdate((updated: any) => {
      cb?.(updated);
      if (!cb) console.log(updated);
    });
  }

  async resetDemo() {
    const balances = await this.trade.getSdk().balances();
    const demo = balances.getBalances().find((b) => b.type === BalanceType.Demo);
    if (!demo) return false;
    await demo.resetDemoBalance?.();
    return true;
  }

  async getById(id: number) {
    const balances = await this.trade.getSdk().balances();
    return balances.getBalanceById(id);
  }
}
