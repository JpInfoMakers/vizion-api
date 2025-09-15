import { Controller, Sse, MessageEvent, Query, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { StreamService } from '../services/stream.service';

@UseGuards(JwtAuthGuard)
@Controller('v1/trade/stream')
export class StreamController {
  constructor(private readonly svc: StreamService) {}

  @Sse('quotes')
  quotes(
    @CurrentUser('id') userId: string,
    @Query('activeId') activeId: string,
  ): Observable<MessageEvent> {
    const id = Number(activeId);
    return this.svc.streamQuote(userId, id);
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