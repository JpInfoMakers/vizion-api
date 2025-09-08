import { Injectable } from '@nestjs/common';
import { TradeService } from '../trade.service';

@Injectable()
export class QuotesService {
  constructor(private readonly trade: TradeService) {}

  async getCurrentQuoteForActive(activeId: number) {
    const quotes = await this.trade.getSdk().quotes();
    const currentQuote = await quotes.getCurrentQuoteForActive(activeId);
    return currentQuote;
  }

  async subscribeCurrentQuote(activeId: number, cb?: (q: any) => void) {
    const quotes = await this.trade.getSdk().quotes();
    const cq = await quotes.getCurrentQuoteForActive(activeId);
    cq.subscribeOnUpdate((u: any) => {
      cb?.(u);
      if (!cb) console.log(u);
    });
  }
}
