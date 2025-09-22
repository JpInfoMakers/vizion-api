import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { TradeService } from './trade.service';
import { BalancesService } from './balances.service';
import { BlitzOptionsDirection, BalanceType } from '@tradecodehub/client-sdk-js';

type AutomatorFormRow = {
  ativo: string | number;
  valor: number;
  expiration?: number; // front manda em ms (5_000 | 10_000 | 15_000)
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

  private normalizeExpirationSeconds(
    rawFromForm: number | undefined,
    allowedSeconds: number[] | undefined,
  ): number {
    // 1) determinar segundos a partir do valor do form
    let secondsFromForm: number | undefined = undefined;
    if (typeof rawFromForm === 'number' && Number.isFinite(rawFromForm)) {
      // heurística: se for >= 1000 e múltiplo de 5k/10k/15k, é ms vindo do front
      if (rawFromForm >= 1000) {
        // pode ser ms; converte para s arredondando
        secondsFromForm = Math.round(rawFromForm / 1000);
      } else {
        // já parecem segundos
        secondsFromForm = Math.round(rawFromForm);
      }
    }

    // 2) se temos lista de permitidos, escolher o melhor
    const list = Array.isArray(allowedSeconds) ? allowedSeconds.slice().sort((a,b)=>a-b) : [];

    // Se o form pediu 5/10/15 s, usar igual quando existir
    if (secondsFromForm && list.length) {
      if (list.includes(secondsFromForm)) return secondsFromForm;
      // escolhe o mais próximo
      let best = list[0];
      let bestDiff = Math.abs(list[0] - secondsFromForm);
      for (let i = 1; i < list.length; i++) {
        const d = Math.abs(list[i] - secondsFromForm);
        if (d < bestDiff) { best = list[i]; bestDiff = d; }
      }
      return best;
    }

    // 3) fallback: se não veio nada do form, pega o primeiro permitido
    if (list.length) return list[0];

    // 4) último recurso: 5s (muito comum no Blitz)
    return secondsFromForm || 5;
  }

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
    const allBalances = balances.getBalances();
    this.logger.debug(`[store] Balances total=${allBalances.length}`);

    const balance =
      (opts?.fromBalanceId ? balances.getBalanceById(opts.fromBalanceId) : null) ||
      (opts?.balanceType ? await this.balancesService.findByType(userId, opts.balanceType) : null) ||
      allBalances[0];

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

    // (opcional mas recomendado) pré-check, evita 4119:
    try {
      const canNow = typeof active.canBeBoughtAt === 'function' ? !!active.canBeBoughtAt(new Date()) : true;
      this.logger.debug(`[store] canBeBoughtAt(now)=${canNow}`);
      if (active.isSuspended || !canNow) {
        this.logger.warn(`[store] Ativo indisponível agora (isSuspended=${active.isSuspended}, canNow=${canNow}).`);
        throw new BadRequestException('Ativo indisponível para compra agora');
      }
    } catch (e) {
      this.logger.warn(`[store] canBeBoughtAt lançou erro; tratando como indisponível. err=${(e as any)?.message || e}`);
      throw new BadRequestException('Ativo indisponível para compra agora');
    }

    // Normaliza expiração (ms -> s) e casa com lista suportada:
    const expirationSec = this.normalizeExpirationSeconds(form.expiration, active.expirationTimes);
    this.logger.debug(
      `[store] Expiração normalizada: form.expiration=${form.expiration} -> expirationSec=${expirationSec} | allowed=${JSON.stringify(active.expirationTimes)}`
    );

    const dir =
      (form as any).recomendacao === 'compra'
        ? BlitzOptionsDirection.Call
        : BlitzOptionsDirection.Put;

    this.logger.debug(
      `[store] Preparando buy: ativo=${active.id}(${active.ticker}) dir=${form.recomendacao} expirationSec=${expirationSec} entrada=${entrada}`
    );

    // CHAMADA ao provedor
    const option = await blitz.buy(active, dir, expirationSec, entrada, balance);

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