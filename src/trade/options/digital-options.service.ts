import { Injectable } from '@nestjs/common';
import { TradeService } from '../trade.service';
import { DigitalOptionsDirection } from '@tradecodehub/client-sdk-js';

@Injectable()
export class DigitalOptionsService {
  constructor(private readonly trade: TradeService) {}

  async buyFirstAvailable(amount: number, direction: 'call' | 'put', fromBalanceId?: number) {
    const sdk = this.trade.getSdk();
    const balances = await sdk.balances();
    const balance = fromBalanceId
      ? balances.getBalanceById(fromBalanceId)
      : balances.getBalances()[0];

    const digital = await sdk.digitalOptions();
    const underlyings = digital.getUnderlyingsAvailableForTradingAt(new Date());
    const firstUnderlying = underlyings[0];
    const instruments = await firstUnderlying.instruments();
    const avail = instruments.getAvailableForBuyAt(new Date());
    const first = avail[0];
    const dir = direction === 'call' ? DigitalOptionsDirection.Call : DigitalOptionsDirection.Put;
    return digital.buySpotStrike(first, dir, amount, balance);
  }
}
