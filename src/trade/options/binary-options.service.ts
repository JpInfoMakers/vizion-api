import { Injectable } from '@nestjs/common';
import { TradeService } from '../trade.service';
import { BinaryOptionsDirection } from '@tradecodehub/client-sdk-js';

@Injectable()
export class BinaryOptionsService {
  constructor(private readonly trade: TradeService) {}

  async buyFirstAvailable(amount: number, direction: 'call' | 'put', fromBalanceId?: number) {
    const sdk = this.trade.getSdk();
    const balances = await sdk.balances();
    const balance = fromBalanceId
      ? balances.getBalanceById(fromBalanceId)
      : balances.getBalances()[0];

    const binary = await sdk.binaryOptions();
    const active = binary.getActives()[0];
    const instruments = await active.instruments();
    const avail = instruments.getAvailableForBuyAt(new Date());
    const first = avail[0];
    const dir = direction === 'call' ? BinaryOptionsDirection.Call : BinaryOptionsDirection.Put;
    return binary.buy(first, dir, amount, balance);
  }
}
