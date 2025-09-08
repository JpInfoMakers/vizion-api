import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { BalancesService } from './balances.service';
import { BalanceType } from '@tradecodehub/client-sdk-js';

@Controller('trade/balances')
export class BalancesController {
  constructor(private readonly svc: BalancesService) {}

  @Get()
  list() {
    return this.svc.listAll();
  }

  @Get('real')
  getReal() {
    return this.svc.findByType(BalanceType.Real);
  }

  @Get('demo')
  getDemo() {
    return this.svc.findByType(BalanceType.Demo);
  }

  @Get('id/:id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getById(id);
  }
  
}
