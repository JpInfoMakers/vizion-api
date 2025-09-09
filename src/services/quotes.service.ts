import { Injectable } from '@nestjs/common';
import { TradeService } from './trade.service';

@Injectable()
export class QuotesService {
  constructor(private readonly trade: TradeService) {}

  async getCurrentQuoteForActive(userId: string, activeId: number) {
    const sdk = await this.trade.getClientForUser(userId);
    const quotes = await sdk.quotes();
    return quotes.getCurrentQuoteForActive(activeId);
  }

  async subscribeCurrentQuote(userId: string, activeId: number, cb?: (q: any) => void) {
    const sdk = await this.trade.getClientForUser(userId);
    const quotes = await sdk.quotes();
    const cq = await quotes.getCurrentQuoteForActive(activeId);
    cq.subscribeOnUpdate((u: any) => {
      cb?.(u);
      if (!cb) console.log(u);
    });
  }
}
