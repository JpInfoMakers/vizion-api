import { Module } from '@nestjs/common';
import { tradeProviders } from './trade.providers';
import { TradeService } from './trade.service';
import { BalancesService } from './balances/balances.service';
import { BalancesController } from './balances/balances.controller';
import { QuotesService } from './quotes/quotes.service';
import { QuotesController } from './quotes/quotes.controller';
import { BlitzOptionsService } from './options/blitz-options.service';
import { TurboOptionsService } from './options/turbo-options.service';
import { BinaryOptionsService } from './options/binary-options.service';
import { DigitalOptionsService } from './options/digital-options.service';
import { PositionsService } from './positions/positions.service';
import { PositionsController } from './positions/positions.controller';

@Module({
  providers: [
    ...tradeProviders,
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
