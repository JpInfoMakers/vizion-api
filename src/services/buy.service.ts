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
type AutomatorForm = AutomatorFormRow & {
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
    this.logger.debug(`[store] IN userId=${userId} form=${JSON.stringify(form)} opts=${JSON.stringify(opts)}`);

    const entrada = Number(form.valor);
    if (!(entrada > 0)) {
      this.logger.warn(`[store] Entrada inválida: valor=${entrada}`);
      throw new BadRequestException('Valor de entrada inválido');
    }

    const sdk = await this.trade.getClientForUser(userId);
    this.logger.debug(`[store] SDK obtido para userId=${userId}`);

    const balances = await sdk.balances();
    this.logger.debug(`[store] Balances total=${balances.getBalances().length}`);

    const balance =
      (opts?.fromBalanceId ? balances.getBalanceById(opts.fromBalanceId) : null) ||
      (opts?.balanceType ? await this.balancesService.findByType(userId, opts.balanceType) : null) ||
      balances.getBalances()[0];

    if (!balance) {
      this.logger.error(`[store] Nenhum balance disponível para userId=${userId}`);
      throw new BadRequestException('Nenhum balance disponível');
    }
    this.logger.debug(`[store] Balance escolhido: id=${balance.id} tipo=${balance.type} amount=${balance.amount}`);

    if (!(balance.amount > entrada)) {
      this.logger.warn(`[store] Funds insuficientes: entrada=${entrada} balance=${balance.amount}`);
      return { funds: false };
    }

    const blitz = await sdk.blitzOptions();
    const actives = blitz.getActives();
    this.logger.debug(`[store] BlitzOptions ativos=${actives?.length}`);

    if (!actives?.length) throw new BadRequestException('Nenhum ativo disponível');

    const target = form.ativo;
    const active =
      actives.find((a: any) => `${a.id}` === `${target}`) ||
      actives.find((a: any) => (a.ticker || '').toLowerCase() === String(target).toLowerCase()) ||
      actives[0];

    if (!active) {
      this.logger.error(`[store] Ativo não encontrado. target=${target}`);
      throw new BadRequestException('Ativo não encontrado');
    }

    this.logger.debug(
      `[store] Active escolhido: id=${active.id} tk=${active.ticker} susp=${active.isSuspended} expirations=${JSON.stringify(active.expirationTimes)}`
    );

    if (!active.canBeBoughtAt?.(new Date())) {
      this.logger.warn(`[store] Active indisponível para compra agora. id=${active.id} tk=${active.ticker}`);
      throw new BadRequestException('Ativo indisponível para compra agora');
    }

    const expiration = form.expiration ?? active.expirationTimes?.[0];
    if (!expiration) {
      this.logger.error(`[store] Sem tempo de expiração disponível. active.id=${active.id}`);
      throw new BadRequestException('Sem tempo de expiração disponível');
    }

    const dir =
      (form as any).recomendacao === 'compra'
        ? BlitzOptionsDirection.Call
        : BlitzOptionsDirection.Put;

    this.logger.debug(
      `[store] Preparando buy: ativo=${active.id}(${active.ticker}) dir=${form.recomendacao} expiration=${expiration} entrada=${entrada}`
    );

    const option = await blitz.buy(active, dir, expiration, entrada, balance);

    const openedAt: Date = option.openedAt ?? new Date();
    const expiredAt: Date =
      option.expiredAt ?? new Date(openedAt.getTime() + 60_000);

    this.logger.log(
      `[store] Compra OK: optId=${option.id} dir=${option.direction} price=${option.price} openQuote=${option.openQuoteValue} openedAt=${openedAt.toISOString()} expiredAt=${expiredAt.toISOString()}`
    );

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
