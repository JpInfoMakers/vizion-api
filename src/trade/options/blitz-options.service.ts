import { Injectable } from '@nestjs/common';
import { TradeService } from '../trade.service';
import { BlitzOptionsDirection } from '@tradecodehub/client-sdk-js';

@Injectable()
export class BlitzOptionsService {
  constructor(private readonly trade: TradeService) {}

  async buyFirstAvailable(amount: number, direction: 'call' | 'put', fromBalanceId?: number) {
    const sdk = this.trade.getSdk();
    const balances = await sdk.balances();
    const balance = fromBalanceId
      ? balances.getBalanceById(fromBalanceId)
      : balances.getBalances()[0];

    const blitzOptions = await sdk.blitzOptions();
    const actives = blitzOptions.getActives();
    const active = actives.find(a => a.canBeBoughtAt(new Date()));
    if (!active) throw new Error('No active available to buy now');

    const exp = active.expirationTimes[0];
    const dir = direction === 'call' ? BlitzOptionsDirection.Call : BlitzOptionsDirection.Put;
    return blitzOptions.buy(active, dir, exp, amount, balance);
  }
}
