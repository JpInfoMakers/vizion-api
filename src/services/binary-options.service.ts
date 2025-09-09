import { Injectable, BadRequestException } from '@nestjs/common';
import { BinaryOptionsDirection } from '@tradecodehub/client-sdk-js';
import { TradeService } from './trade.service';

@Injectable()
export class BinaryOptionsService {
  constructor(private readonly trade: TradeService) {}

  async buyFirstAvailable(userId: string, amount: number, direction: 'call' | 'put', fromBalanceId?: number) {
    const sdk = await this.trade.getClientForUser(userId);
    const balances = await sdk.balances();
    const balance = fromBalanceId
      ? balances.getBalanceById(fromBalanceId)
      : balances.getBalances()[0];
    if (!balance) throw new BadRequestException('Nenhum balance disponível');

    const binary = await sdk.binaryOptions();
    const actives = binary.getActives();
    if (!actives || actives.length === 0) throw new BadRequestException('Nenhum ativo disponível');

    const active = actives[0];
    const instruments = await active.instruments();
    const avail = instruments.getAvailableForBuyAt(new Date());
    if (!avail || avail.length === 0) throw new BadRequestException('Nenhum instrumento disponível');

    const first = avail[0];
    const dir = direction === 'call' ? BinaryOptionsDirection.Call : BinaryOptionsDirection.Put;
    return binary.buy(first, dir, amount, balance);
  }
}
