import { Injectable, BadRequestException } from '@nestjs/common';
import { TurboOptionsDirection } from '@tradecodehub/client-sdk-js';
import { TradeService } from './trade.service';

@Injectable()
export class TurboOptionsService {
  constructor(private readonly trade: TradeService) {}

  async buyFirstAvailable(userId: string, amount: number, direction: 'call' | 'put', fromBalanceId?: number) {
    const sdk = await this.trade.getClientForUser(userId);
    const balances = await sdk.balances();
    const balance = fromBalanceId
      ? balances.getBalanceById(fromBalanceId)
      : balances.getBalances()[0];
    if (!balance) throw new BadRequestException('Nenhum balance disponível');

    const turbo = await sdk.turboOptions();
    const actives = turbo.getActives();
    if (!actives || actives.length === 0) throw new BadRequestException('Nenhum ativo disponível');

    const active = actives[0];
    const instruments = await active.instruments();
    const avail = instruments.getAvailableForBuyAt(new Date());
    if (!avail || avail.length === 0) throw new BadRequestException('Nenhum instrumento disponível');

    const first = avail[0];
    const dir = direction === 'call' ? TurboOptionsDirection.Call : TurboOptionsDirection.Put;
    return turbo.buy(first, dir, amount, balance);
  }
}
