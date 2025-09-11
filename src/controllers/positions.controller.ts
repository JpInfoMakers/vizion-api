import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { InstrumentType } from '@tradecodehub/client-sdk-js';
import { PositionsService } from '../services/positions.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('v1/trade/positions')
export class PositionsController {
  constructor(private readonly svc: PositionsService) {}

  @Get()
  getAll(@CurrentUser('id') userId: string) {
    return this.svc.getAll(userId);
  }

  @Get('history')
  history(@CurrentUser('id') userId: string) {
    return this.svc.history(userId);
  }

  @Get('by-instrument/:type')
  byInstrument(@CurrentUser('id') userId: string, @Param('type') type: string) {
    const key = type as keyof typeof InstrumentType;
    const enumValue = InstrumentType[key];
    if (enumValue === undefined) return [];
    return this.svc.getByInstrument(userId, enumValue);
  }

  @Get(':externalId/pnl')
  pnl(@CurrentUser('id') userId: string, @Param('externalId', ParseIntPipe) externalId: number) {
    return this.svc.pnlInfo(userId, externalId);
  }
}
