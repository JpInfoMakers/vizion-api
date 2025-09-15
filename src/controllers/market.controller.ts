import { Controller, Get, Param, Query, UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MarketService } from '../services/market.service';
import { ListActivesQuery } from '../dtos/actives.dto';
import { GetCandlesQuery } from '../dtos/candles.dto';

@UseGuards(JwtAuthGuard)
@Controller('v1/trade/market')
export class MarketController {
  private readonly logger = new Logger(MarketController.name);

  constructor(private readonly svc: MarketService) {}

  @Get('actives')
  listActivesLegacy(@CurrentUser('id') userId: string, @Query() q: ListActivesQuery) {
    return this.svc.listActives(userId, q.kind as any, q.at);
  }

  @Get('actives/:kind')
  listActivesByParam(
    @CurrentUser('id') userId: string,
    @Param('kind') kind: string,
    @Query('at') at?: string,
  ) {
    return this.svc.listActives(userId, kind as any, at);
  }

  @Get('actives/all')
  async listAllActives(@CurrentUser('id') userId: string) {
    const kinds = [
      'blitz',
      'turbo',
      'binary',
      'digital',
      'margin-forex',
      'margin-cfd',
      'margin-crypto',
    ] as const;

    const results = await Promise.all(
      kinds.map(async (kind) => {
        try {
          const list = await this.svc.listActives(userId, kind);
          return list.map((item) => ({ ...item, kind }));
        } catch (err) {
          this.logger.warn(`Erro ao buscar ${kind}: ${err}`);
          return [];
        }
      }),
    );

    return results.flat();
  }

  @Get('candles')
  async getCandles(@CurrentUser('id') userId: string, @Query() q: GetCandlesQuery) {
    this.logger.log(`[getCandles] IN userId=${userId} query=${JSON.stringify(q)}`);
    try {
      const data = await this.svc.getCandles(userId, q);
      this.logger.log(`[getCandles] OK candles=${Array.isArray(data) ? data.length : '??'}`);
      return data;
    } catch (err) {
      this.logger.error(
        `[getCandles] ERRO userId=${userId} query=${JSON.stringify(q)} -> ${err?.message}`,
        err?.stack,
      );
      throw err;
    }
  }
}
