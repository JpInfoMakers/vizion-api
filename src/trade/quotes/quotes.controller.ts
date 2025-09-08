import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { QuotesService } from './quotes.service';

@Controller('trade/quotes')
export class QuotesController {
  constructor(private readonly svc: QuotesService) {}

  @Get('current/:activeId')
  getCurrent(@Param('activeId', ParseIntPipe) activeId: number) {
    return this.svc.getCurrentQuoteForActive(activeId);
  }
}
