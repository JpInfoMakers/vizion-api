import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../entity/user.entity';

import { TradeService } from '../services/trade.service';
import { BalancesService } from '../services/balances.service';
import { QuotesService } from '../services/quotes.service';
import { BlitzOptionsService } from '../services/blitz-options.service';
import { TurboOptionsService } from '../services/turbo-options.service';
import { BinaryOptionsService } from '../services/binary-options.service';
import { DigitalOptionsService } from '../services/digital-options.service';
import { PositionsService } from '../services/positions.service';

import { BalancesController } from '../controllers/balances.controller';
import { QuotesController } from '../controllers/quotes.controller';
import { PositionsController } from '../controllers/positions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
  ],
  providers: [
    TradeService,
    BalancesService,
    QuotesService,
    BlitzOptionsService,
    TurboOptionsService,
    BinaryOptionsService,
    DigitalOptionsService,
    PositionsService,
  ],
  controllers: [BalancesController, QuotesController, PositionsController],
  exports: [
    TradeService,
    BalancesService,
    QuotesService,
    BlitzOptionsService,
    TurboOptionsService,
    BinaryOptionsService,
    DigitalOptionsService,
    PositionsService,
  ],
})
export class TradeModule {}
