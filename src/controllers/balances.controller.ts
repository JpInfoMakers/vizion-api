import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { BalanceType } from '@tradecodehub/client-sdk-js';
import { BalancesService } from 'src/services/balances.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { CurrentUser } from 'src/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('trade/balances')
export class BalancesController {
  constructor(private readonly svc: BalancesService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.svc.listAll(userId);
  }

  @Get('real')
  getReal(@CurrentUser('id') userId: string) {
    return this.svc.findByType(userId, BalanceType.Real);
  }

  @Get('demo')
  getDemo(@CurrentUser('id') userId: string) {
    return this.svc.findByType(userId, BalanceType.Demo);
  }

  @Get('id/:id')
  getById(@CurrentUser('id') userId: string, @Param('id', ParseIntPipe) id: number) {
    return this.svc.getById(userId, id);
  }
}
