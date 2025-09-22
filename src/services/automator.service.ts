import { Injectable, Logger } from '@nestjs/common';
import { OpenIAService, ResponseData } from './openia.service';
import { BuyService } from './buy.service';
import { BalanceType } from '@tradecodehub/client-sdk-js';

@Injectable()
export class AutomatorService extends OpenIAService {
  private readonly automatorLogger = new Logger(AutomatorService.name);

  constructor(private buyService: BuyService) {
    super();
  }

  async start(
    userId: string,
    {
      img,
      form,
      type_balance,
      fromBalanceId,
    }: { img: string; form: any; type_balance?: BalanceType; fromBalanceId?: number },
  ) {
    let attempts = 0;
    const maxAttempts = 5;

    this.automatorLogger.debug(`Iniciando automação para user=${userId}, tentativas=${maxAttempts}`);

    while (attempts++ < maxAttempts) {
      try {
        this.automatorLogger.debug(`Tentativa ${attempts}/${maxAttempts}`);

        const analyser: ResponseData = await this.find(img);
        this.automatorLogger.debug(`Resposta do analyser: ${JSON.stringify(analyser)}`);

        const rec = analyser.recomendacao.toLowerCase() as 'compra' | 'venda';
        const finalRec = form.invert ? (rec === 'compra' ? 'venda' : 'compra') : rec;

        form.recomendacao = finalRec;
        form.probabilidade = analyser.probabilidade;

        this.automatorLogger.debug(`Form após ajustes: ${JSON.stringify(form)}`);

        const response = await this.buyService.store(
          userId,
          form,
          { fromBalanceId, balanceType: type_balance },
        );

        this.automatorLogger.debug(`Resposta do buyService.store: ${JSON.stringify(response)}`);

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

          const result = {
            data: {
              direction: finalRec,
              probability: analyser.probabilidade,
              entrada: response.option.price,
              expiration: diffInMs,
              hour_open: hourOpen,
              price: response.option.openQuoteValue,
              spreed: response.pair.profitCommissionPercent,
              funds: response.funds,
            },
          };

          this.automatorLogger.debug(`Resultado final: ${JSON.stringify(result)}`);
          return result;
        } else {
          this.automatorLogger.warn(`buyService.store retornou sem fundos: ${JSON.stringify(response)}`);
          return { data: { funds: false } };
        }
      } catch (err) {
        this.automatorLogger.error(`Erro na tentativa ${attempts}:`, err.stack || err);
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
    }

    this.automatorLogger.error('Falhou após múltiplas tentativas');
    return { message: 'Consulta inválida após múltiplas tentativas', data: [] };
  }
}
