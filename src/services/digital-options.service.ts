import { Injectable, BadRequestException } from '@nestjs/common';
import { DigitalOptionsDirection } from '@tradecodehub/client-sdk-js';
import { TradeService } from './trade.service';

@Injectable()
export class DigitalOptionsService {
  constructor(private readonly trade: TradeService) {}
  
  async buyFirstAvailable(
    userId: string,
    amount: number,
    direction: 'call' | 'put',
    fromBalanceId?: number,
  ) {
    const sdk = await this.trade.getClientForUser(userId);

    const balances = await sdk.balances();
    const balance = fromBalanceId
      ? balances.getBalanceById(fromBalanceId)
      : balances.getBalances()[0];
    if (!balance) {
      throw new BadRequestException('Nenhum balance disponível para operar.');
    }

    const digital = await sdk.digitalOptions();

    const underlyings = digital.getUnderlyingsAvailableForTradingAt(new Date());
    if (!underlyings || underlyings.length === 0) {
      throw new BadRequestException('Nenhum underlying disponível para negociação agora.');
    }

    const firstUnderlying = underlyings[0];
    const instruments = await firstUnderlying.instruments();

    const avail = instruments.getAvailableForBuyAt(new Date());
    if (!avail || avail.length === 0) {
      throw new BadRequestException('Nenhum instrumento disponível para compra neste momento.');
    }

    const first = avail[0];
    const dir =
      direction === 'call' ? DigitalOptionsDirection.Call : DigitalOptionsDirection.Put;

    return digital.buySpotStrike(first, dir, amount, balance);
  }

}
