import { Injectable, BadRequestException } from '@nestjs/common';
import { BlitzOptionsDirection } from '@tradecodehub/client-sdk-js';
import { TradeService } from './trade.service';

@Injectable()
export class BlitzOptionsService {
  constructor(private readonly trade: TradeService) {}

  async buyFirstAvailable(userId: string, amount: number, direction: 'call' | 'put', fromBalanceId?: number) {
    const sdk = await this.trade.getClientForUser(userId);
    const balances = await sdk.balances();
    const balance = fromBalanceId
      ? balances.getBalanceById(fromBalanceId)
      : balances.getBalances()[0];
    if (!balance) throw new BadRequestException('Nenhum balance disponível');

    const blitzOptions = await sdk.blitzOptions();
    const actives = blitzOptions.getActives();
    const active = actives.find(a => a.canBeBoughtAt(new Date()));
    if (!active) throw new BadRequestException('Nenhum ativo disponível para compra agora');

    const exp = active.expirationTimes[0];
    const dir = direction === 'call' ? BlitzOptionsDirection.Call : BlitzOptionsDirection.Put;
    return blitzOptions.buy(active, dir, exp, amount, balance);
  }
}
