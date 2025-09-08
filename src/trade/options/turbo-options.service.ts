import { Injectable } from '@nestjs/common';
import { TradeService } from '../trade.service';
import { TurboOptionsDirection } from '@tradecodehub/client-sdk-js';

@Injectable()
export class TurboOptionsService {
  constructor(private readonly trade: TradeService) {}

  async buyFirstAvailable(amount: number, direction: 'call' | 'put', fromBalanceId?: number) {
    const sdk = this.trade.getSdk();
    const balances = await sdk.balances();
    const balance = fromBalanceId
      ? balances.getBalanceById(fromBalanceId)
      : balances.getBalances()[0];

    const turbo = await sdk.turboOptions();
    const active = turbo.getActives()[0];
    const instruments = await active.instruments();
    const avail = instruments.getAvailableForBuyAt(new Date());
    const first = avail[0];
    const dir = direction === 'call' ? TurboOptionsDirection.Call : TurboOptionsDirection.Put;
    return turbo.buy(first, dir, amount, balance);
  }
}
