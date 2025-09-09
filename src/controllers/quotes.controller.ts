import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { QuotesService } from 'src/services/quotes.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { CurrentUser } from 'src/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('v1/trade/quotes')
export class QuotesController {
  constructor(private readonly svc: QuotesService) {}

  @Get('current/:activeId')
  getCurrent(@CurrentUser('id') userId: string, @Param('activeId', ParseIntPipe) activeId: number) {
    return this.svc.getCurrentQuoteForActive(userId, activeId);
  }
  
}
