import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/entity/user.entity';

import { TradeService } from 'src/services/trade.service';
import { BalancesService } from 'src/services/balances.service';
import { QuotesService } from 'src/services/quotes.service';
import { BlitzOptionsService } from 'src/services/blitz-options.service';
import { TurboOptionsService } from 'src/services/turbo-options.service';
import { BinaryOptionsService } from 'src/services/binary-options.service';
import { DigitalOptionsService } from 'src/services/digital-options.service';
import { PositionsService } from 'src/services/positions.service';

import { BalancesController } from 'src/controllers/balances.controller';
import { QuotesController } from 'src/controllers/quotes.controller';
import { PositionsController } from 'src/controllers/positions.controller';

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
