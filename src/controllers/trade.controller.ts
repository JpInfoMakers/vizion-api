import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { BinaryOptionsService } from '../services/binary-options.service';
import { BlitzOptionsService } from '../services/blitz-options.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { BuyDto } from '../dtos/buy.dto';
import { AccessTokenQueryGuard } from '../guards/access-token-query.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@UseGuards(AccessTokenQueryGuard, JwtAuthGuard)
@Controller('v1/trade')
export class TradeController {
  constructor(
    private readonly binary: BinaryOptionsService,
    private readonly blitz: BlitzOptionsService,
  ) {}

  @Post('binary/buy')
  async buyBinary(@CurrentUser('id') userId: string, @Body() dto: BuyDto) {
    const { amount, direction, fromBalanceId } = dto;
    return this.binary.buyFirstAvailable(userId, amount, direction, fromBalanceId);
  }

  @Post('blitz/buy')
  async buyBlitz(@CurrentUser('id') userId: string, @Body() dto: BuyDto) {
    const { amount, direction, fromBalanceId } = dto;
    return this.blitz.buyFirstAvailable(userId, amount, direction, fromBalanceId);
  }
}
