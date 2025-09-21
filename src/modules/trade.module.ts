import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../entity/user.entity';
import { AuthModule } from './auth.module';

import { TradeService } from '../services/trade.service';
import { BalancesService } from '../services/balances.service';
import { QuotesService } from '../services/quotes.service';
import { BlitzOptionsService } from '../services/blitz-options.service';
import { TurboOptionsService } from '../services/turbo-options.service';
import { BinaryOptionsService } from '../services/binary-options.service';
import { DigitalOptionsService } from '../services/digital-options.service';
import { PositionsService } from '../services/positions.service';
import { MarketService } from '../services/market.service';
import { StreamService } from '../services/stream.service';

import { BalancesController } from '../controllers/balances.controller';
import { QuotesController } from '../controllers/quotes.controller';
import { PositionsController } from '../controllers/positions.controller';
import { MarketController } from '../controllers/market.controller';
import { StreamController } from '../controllers/stream.controller';
import { TradeController } from '../controllers/trade.controller';
import { OrchestratorController } from '../controllers/orchestrator.controller';

import { SseJwtGuard } from '../guards/sse-jwt.guard';
import { ImageService } from '../services/image.service';
import { OpenIAService } from '../services/openia.service';
import { BuyService } from '../services/buy.service';
import { AutomatorService } from '../services/automator.service';
import { OrchestratorService } from '../services/orchestrator.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), AuthModule],
  providers: [
    SseJwtGuard,
    TradeService,
    BalancesService,
    QuotesService,
    BlitzOptionsService,
    TurboOptionsService,
    BinaryOptionsService,
    DigitalOptionsService,
    PositionsService,
    MarketService,
    StreamService,

    // orchestration stack
    ImageService,
    OpenIAService,
    BuyService,
    AutomatorService,
    OrchestratorService,
  ],
  controllers: [
    BalancesController,
    QuotesController,
    PositionsController,
    MarketController,
    StreamController,
    TradeController,          // opcional manter
    OrchestratorController,   // novo
  ],
  exports: [
    TradeService,
    BalancesService,
    QuotesService,
    BlitzOptionsService,
    TurboOptionsService,
    BinaryOptionsService,
    DigitalOptionsService,
    PositionsService,
    MarketService,
    StreamService,
    ImageService,
    OpenIAService,
    BuyService,
    AutomatorService,
    OrchestratorService,
  ],
})
export class TradeModule {}
