import { Injectable, BadRequestException } from '@nestjs/common';
import { OpenIAService, ResponseData } from './openia.service';
import { BuyService } from './buy.service';
import { BalanceType } from '@tradecodehub/client-sdk-js';

@Injectable()
export class AutomatorService extends OpenIAService {
  constructor(private buyService: BuyService) { super(); }

  async start(
    userId: string,
    {
      img,
      form,
      type_balance,
      fromBalanceId,
    }: { img: string; form: any; type_balance?: BalanceType; fromBalanceId?: number },
  ) {
    if (!form?.[0]?.ativo) throw new BadRequestException('Dados inválidos. Verifique os campos enviados.');

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts++ < maxAttempts) {
      try {
        const analyser: ResponseData = await this.find(img);

        const rec = (analyser.recomendacao.toLowerCase() as 'compra'|'venda');
        const finalRec =
          form[0]?.invert ? (rec === 'compra' ? 'venda' : 'compra') : rec;

        (form as any).recomendacao = finalRec;
        (form as any).probabilidade = analyser.probabilidade;

        const response = await this.buyService.store(
          userId,
          form,
          { fromBalanceId, balanceType: type_balance },
        );

        if (response?.funds) {
          const time1 = new Date(response.option.openedAt);
          const time2 = new Date(response.option.expiredAt);
          const diffInMs = time2.getTime() - time1.getTime() + 3000;

          const hourOpen = time1.toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          });

          return {
            data: {
              direction: finalRec,
              probability: analyser.probabilidade,
              entrada: response.option.price,
              expiration: diffInMs,
              hour_open: hourOpen,
              price: response.option.openQuoteValue,
              spreed: response.pair.profitCommissionPercent,
              funds: response.funds,
            }
          };
        } else {
          return { data: { funds: false } };
        }
      } catch {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
    }

    return { message: 'Consulta inválida após múltiplas tentativas', data: [] };
  }
}
