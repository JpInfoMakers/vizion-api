import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { TradeService } from './trade.service';
import { BalancesService } from './balances.service';
import { BlitzOptionsDirection, BalanceType } from '@tradecodehub/client-sdk-js';

type AutomatorFormRow = {
  ativo: string | number;
  valor: number;
  expiration?: number;
  invert?: boolean;
};
type AutomatorForm = AutomatorFormRow[] & {
  recomendacao?: 'compra' | 'venda';
  probabilidade?: number;
};

@Injectable()
export class BuyService {
  private readonly logger = new Logger(BuyService.name);

  constructor(
    private readonly trade: TradeService,
    private readonly balancesService: BalancesService,
  ) {}

  async store(
    userId: string,
    form: AutomatorForm,
    opts?: { fromBalanceId?: number; balanceType?: BalanceType },
  ) {
    if (!Array.isArray(form) || !form[0]?.ativo || !form[0]?.valor) {
      throw new BadRequestException('Form inválido');
    }

    const entrada = Number(form[0].valor);
    if (!(entrada > 0)) throw new BadRequestException('Valor de entrada inválido');

    const sdk = await this.trade.getClientForUser(userId);

    // ---- balance ----
    const balances = await sdk.balances();
    const balance =
      (opts?.fromBalanceId ? balances.getBalanceById(opts.fromBalanceId) : null) ||
      (opts?.balanceType ? await this.balancesService.findByType(userId, opts.balanceType) : null) ||
      balances.getBalances()[0];

    if (!balance) throw new BadRequestException('Nenhum balance disponível');
    if (!(balance.amount > entrada)) return { funds: false };

    // ---- blitz options ----
    const blitz = await sdk.blitzOptions();
    const actives = blitz.getActives();
    if (!actives?.length) throw new BadRequestException('Nenhum ativo disponível');

    const target = form[0].ativo;
    const active =
      actives.find((a: any) => `${a.id}` === `${target}`) ||
      actives.find((a: any) => (a.ticker || '').toLowerCase() === String(target).toLowerCase()) ||
      actives[0];

    if (!active) throw new BadRequestException('Ativo não encontrado');
    if (!active.canBeBoughtAt?.(new Date())) {
      throw new BadRequestException('Ativo indisponível para compra agora');
    }

    const expiration = form[0].expiration ?? active.expirationTimes?.[0];
    if (!expiration) throw new BadRequestException('Sem tempo de expiração disponível');

    const dir =
      (form as any).recomendacao === 'compra'
        ? BlitzOptionsDirection.Call
        : BlitzOptionsDirection.Put;

    const option = await blitz.buy(active, dir, expiration, entrada, balance);

    // Campos compatíveis com o SDK que você enviou
    const openedAt: Date = option.openedAt ?? new Date();
    const expiredAt: Date =
      option.expiredAt ?? new Date(openedAt.getTime() + 60_000);

    return {
      option: {
        id: option.id,
        openedAt,
        expiredAt,
        price: option.price ?? entrada,
        openQuoteValue: option.openQuoteValue ?? null,
        direction: option.direction,
      },
      pair: {
        id: active.id,
        ticker: active.ticker,
        profitCommissionPercent: active.profitCommissionPercent ?? 0,
        expirationTimes: active.expirationTimes ?? [],
      },
      funds: true,
    };
  }
}
