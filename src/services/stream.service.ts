import { Injectable, BadRequestException, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TradeService } from './trade.service';

@Injectable()
export class StreamService {
  constructor(private readonly trade: TradeService) {}

  streamQuote(userId: string, activeId: number): Observable<MessageEvent> {
    if (!activeId) throw new BadRequestException('activeId obrigatório');

    return new Observable<MessageEvent>((subscriber) => {
      let unsub: (() => void) | null = null;

      (async () => {
        const sdk = await this.trade.getClientForUser(userId);
        const quotes = await sdk.quotes();
        const cq = await quotes.getCurrentQuoteForActive(activeId);

        const handler = (q: any) => {
          const evt: MessageEvent = {
            data: {
              activeId: q.activeId,
              time: q.time?.toISOString?.() ?? new Date().toISOString(),
              bid: q.bid,
              ask: q.ask,
              value: q.value,
              phase: q.phase,
            },
          };
          subscriber.next(evt);
        };

        cq.subscribeOnUpdate(handler);
        unsub = () => cq.unsubscribeOnUpdate(handler);

        handler(cq);
      })().catch((err) => subscriber.error(err));

      return () => {
        try { unsub?.(); } catch {}
      };
    });
  }

  streamRollingCandle(userId: string, activeId: number, sizeSec: number): Observable<MessageEvent> {
    if (!activeId) throw new BadRequestException('activeId obrigatório');

    return new Observable<MessageEvent>((subscriber) => {
      let unsub: (() => void) | null = null;
      let bucket: { open?: number; high?: number; low?: number; volume: number; start?: number } = { volume: 0 };

      (async () => {
        const sdk = await this.trade.getClientForUser(userId);
        const quotes = await sdk.quotes();
        const cq = await quotes.getCurrentQuoteForActive(activeId);
        let lastClose = cq.value;

        const handler = (q: any) => {
          const now = new Date(q.time ?? Date.now()).getTime();
          if (!bucket.start) {
            bucket.start = now - (now % (sizeSec * 1000));
            bucket.open = q.value ?? lastClose;
            bucket.high = q.value ?? lastClose;
            bucket.low  = q.value ?? lastClose;
            bucket.volume = 0;
          }
          const windowEnd = bucket.start + sizeSec * 1000;

          if (now >= windowEnd) {
            const evtClose: MessageEvent = {
              data: {
                from: Math.floor(bucket.start/1000),
                to: Math.floor(windowEnd/1000),
                open: bucket.open!,
                close: lastClose ?? bucket.open!,
                min: bucket.low ?? bucket.open!,
                max: bucket.high ?? bucket.open!,
                volume: bucket.volume,
              },
            };
            subscriber.next(evtClose);
            bucket = { start: windowEnd, volume: 0, open: lastClose, high: lastClose, low: lastClose };
          }

          const v = q.value ?? lastClose;
          lastClose = v;
          bucket.high = Math.max(bucket.high ?? v, v);
          bucket.low  = Math.min(bucket.low ?? v, v);
          bucket.volume += 1;

          const evtPartial: MessageEvent = {
            data: {
              partial: true,
              from: Math.floor(bucket.start/1000),
              to: Math.floor((bucket.start + sizeSec*1000)/1000),
              open: bucket.open!,
              close: v,
              min: bucket.low ?? v,
              max: bucket.high ?? v,
              volume: bucket.volume,
            },
          };
          subscriber.next(evtPartial);
        };

        cq.subscribeOnUpdate(handler);
        unsub = () => cq.unsubscribeOnUpdate(handler);
        handler(cq);
      })().catch((err) => subscriber.error(err));

      return () => { try { unsub?.(); } catch {} };
    });
  }
}
