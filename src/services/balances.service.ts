import { Injectable } from '@nestjs/common';
import { BalanceType } from '@tradecodehub/client-sdk-js';
import { TradeService } from './trade.service';

@Injectable()
export class BalancesService {
  constructor(private readonly trade: TradeService) {}

  async listAll(userId: string) {
    const sdk = await this.trade.getClientForUser(userId);
    const balances = await sdk.balances();
    return balances.getBalances();
  }

  async findByType(userId: string, type: BalanceType) {
    const sdk = await this.trade.getClientForUser(userId);
    const balances = await sdk.balances();
    return balances.getBalances().find((b) => b.type === type);
  }

  async subscribeUpdatesForType(
    userId: string,
    type: BalanceType,
    cb?: (u: any) => void,
  ) {
    const found = await this.findByType(userId, type);
    if (!found) return;

    found.subscribeOnUpdate((updated: any) => {
      cb?.(updated);
      if (!cb) console.log(updated);
    });
  }

  async resetDemo(userId: string) {
    const sdk = await this.trade.getClientForUser(userId);
    const balances = await sdk.balances();
    const demo = balances.getBalances().find((b) => b.type === BalanceType.Demo);
    if (!demo) return false;
    await demo.resetDemoBalance?.();
    return true;
  }

  async getById(userId: string, id: number) {
    const sdk = await this.trade.getClientForUser(userId);
    const balances = await sdk.balances();
    return balances.getBalanceById(id);
  }
}
