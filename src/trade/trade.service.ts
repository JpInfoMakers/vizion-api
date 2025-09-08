import { Inject, Injectable } from '@nestjs/common';
import { ClientSdk, BalanceType } from '@tradecodehub/client-sdk-js';
import { TRADE_SDK } from './trade.constants';

@Injectable()
export class TradeService {
  constructor(@Inject(TRADE_SDK) private readonly sdk: ClientSdk) {}

  getSdk(): ClientSdk {
    return this.sdk;
  }

  async getRealBalance() {
    const balances = await this.sdk.balances();
    return balances.getBalances().find((b) => b.type === BalanceType.Real);
  }

  async getDemoBalance() {
    const balances = await this.sdk.balances();
    return balances.getBalances().find((b) => b.type === BalanceType.Demo);
  }
}
