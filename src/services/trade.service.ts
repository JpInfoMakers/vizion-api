import { Injectable, UnauthorizedException, BadGatewayException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entity/user.entity';
import { ClientSdk, SsidAuthMethod } from '@tradecodehub/client-sdk-js';
import { tradeEnv } from '../config/trade.config';

type CacheItem = { sdk: ClientSdk; ssid: string };

function isStatus4000(err: any) {
  const msg = (err?.message || '').toString();
  return msg.includes('status 4000') || msg.includes('Status 4000') || (err?.code === 4000);
}

@Injectable()
export class TradeService {
  constructor(@InjectRepository(UserEntity) private readonly users: Repository<UserEntity>) {}

  private cache = new Map<string, CacheItem>();

  private async createSdkWithSsid(ssid: string): Promise<ClientSdk> {
    const env = tradeEnv();
    const wsUrl = env.WS_URL;
    const appId = env.APP_ID;

    console.log('[TradeService] createSdkWithSsid', { wsUrl, appId, ssid: ssid?.slice(0,6) });
    if (!wsUrl || !appId) {
      throw new UnauthorizedException('WS do broker não configurado (TRADE_WS_URL/TRADE_APP_ID ausentes)');
    }

    try {
      const sdk = await ClientSdk.create(wsUrl, appId, new SsidAuthMethod(ssid));
      await sdk.currentTime();
      return sdk;
    } catch (e: any) {
      console.error('[TradeService] SDK create/handshake failed', e?.message || e);
      if (isStatus4000(e)) {
        throw new UnauthorizedException('BROKER_SESSION_INVALID');
      }
      throw new BadGatewayException('BROKER_WS_UNAVAILABLE');
    }
  }

  private async loginWithSsid(userId: string, ssid: string): Promise<ClientSdk> {
    const sdk = await this.createSdkWithSsid(ssid);
    this.cache.set(userId, { sdk, ssid });
    return sdk;
  }

  async getClientForUser(userId: string): Promise<ClientSdk> {
    console.log('[TradeService] getClientForUser IN', { userId });

    const user = await this.users.findOne({ where: { id: userId } });
    console.log('[TradeService] user loaded', { exists: !!user, brokerSsid: user?.brokerSsid });

    if (!user) throw new UnauthorizedException('Usuário inválido');

    const effectiveSsid = user.brokerSsid ?? (user as any).ssid ?? null;
    if (!effectiveSsid) {
      console.error('[TradeService] sem SSID -> 401');
      throw new UnauthorizedException('Conecte sua conta ao broker');
    }

    const cached = this.cache.get(userId);
    if (cached && cached.ssid === effectiveSsid) return cached.sdk;

    try {
      return await this.loginWithSsid(userId, effectiveSsid);
    } catch (e: any) {
      if (isStatus4000(e) || e?.message === 'BROKER_SESSION_INVALID') {
        this.cache.delete(userId);
        throw new UnauthorizedException('Sessão do broker inválida/expirada');
      }
      this.cache.delete(userId);
      throw e;
    }
  }

  async invalidate(userId: string) {
    const c = this.cache.get(userId);
    if (c) {
      try { await c.sdk.shutdown(); } catch {}
      this.cache.delete(userId);
    }
  }
}
