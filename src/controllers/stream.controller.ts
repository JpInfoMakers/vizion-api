import { Controller, Sse, MessageEvent, Query, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { CurrentUser } from '../decorators/current-user.decorator';
import { SseJwtGuard } from '../guards/sse-jwt.guard';
import { StreamService } from '../services/stream.service';

@UseGuards(SseJwtGuard)
@Controller('v1/trade/stream')
export class StreamController {
  constructor(private readonly svc: StreamService) {}

  @Sse('quotes')
  quotes(
    @CurrentUser('id') userId: string,
    @Query('activeId') activeId: string,
  ): Observable<MessageEvent> {
    return this.svc.streamQuote(userId, Number(activeId));
  }

  @Sse('candles')
  candles(
    @CurrentUser('id') userId: string,
    @Query('activeId') activeId: string,
    @Query('size') size: string,
  ): Observable<MessageEvent> {
    return this.svc.streamRollingCandle(userId, Number(activeId), Number(size || 60));
  }
}
