import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { InstrumentType } from '@tradecodehub/client-sdk-js';

@Controller('trade/positions')
export class PositionsController {
  constructor(private readonly svc: PositionsService) {}

  @Get()
  getAll() {
    return this.svc.getAll();
  }

  @Get('history')
  history() {
    return this.svc.history();
  }

  @Get('by-instrument/:type')
  byInstrument(@Param('type') type: string) {
    // Map string to enum key if possible
    const key = type as keyof typeof InstrumentType;
    const enumValue = InstrumentType[key];
    if (enumValue === undefined) {
      return [];
    }
    return this.svc.getByInstrument(enumValue);
  }

  @Get(':externalId/pnl')
  pnl(@Param('externalId', ParseIntPipe) externalId: number) {
    return this.svc.pnlInfo(externalId);
  }
}
