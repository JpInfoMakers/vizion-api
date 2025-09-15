import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MarketService } from '../services/market.service';
import { ListActivesQuery } from '../dtos/actives.dto';
import { GetCandlesQuery } from '../dtos/candles.dto';

@UseGuards(JwtAuthGuard)
@Controller('v1/trade/market')
export class MarketController {
  constructor(private readonly svc: MarketService) {}

  @Get('actives')
  listActives(@CurrentUser('id') userId: string, @Query() q: ListActivesQuery) {
    return this.svc.listActives(userId, q.kind as any, q.at);
  }

  @Get('candles')
  getCandles(@CurrentUser('id') userId: string, @Query() q: GetCandlesQuery) {
    return this.svc.getCandles(userId, q);
  }
}
