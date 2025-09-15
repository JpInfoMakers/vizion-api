import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entity/user.entity';
import { ClientSdk, SsidAuthMethod } from '@tradecodehub/client-sdk-js';

type CacheItem = { sdk: ClientSdk; ssid: string };

@Injectable()
export class TradeService {
  constructor(@InjectRepository(UserEntity) private readonly users: Repository<UserEntity>) {}

  private cache = new Map<string, CacheItem>();

  private async createSdkWithSsid(ssid: string): Promise<ClientSdk> {
    const wsUrl = process.env.BROKER_WS_API_URL;
    const platformId = Number(process.env.BROKER_PLATFORM_ID ?? 1);

    console.log('[TradeService] criando SDK', { wsUrl, platformId, ssid: ssid?.slice(0, 6) });

    if (!wsUrl) throw new UnauthorizedException('WS do broker não configurado');

    return ClientSdk.create(wsUrl, platformId, new SsidAuthMethod(ssid));
  }

  private async loginWithSsid(userId: string, ssid: string): Promise<ClientSdk> {
    console.log('[TradeService] loginWithSsid', { userId, ssid: ssid?.slice(0, 6) });
    const sdk = await this.createSdkWithSsid(ssid);
    this.cache.set(userId, { sdk, ssid });
    return sdk;
  }

  async getClientForUser(userId: string): Promise<ClientSdk> {
    console.log('[TradeService] getClientForUser IN', { userId });

    const user = await this.users.findOne({ where: { id: userId } });
    console.log('[TradeService] user loaded', { exists: !!user, brokerSsid: user?.brokerSsid, legacySsid: (user as any)?.ssid });

    if (!user) throw new UnauthorizedException('Usuário inválido');

    const effectiveSsid = user.brokerSsid ?? (user as any).ssid ?? null;
    if (!effectiveSsid) {
      console.error('[TradeService] sem SSID -> 401');
      throw new UnauthorizedException('Conecte sua conta ao broker');
    }

    const cached = this.cache.get(userId);
    console.log('[TradeService] cache check', { hasCache: !!cached, cachedSsid: cached?.ssid });

    if (cached && cached.ssid === effectiveSsid) {
      console.log('[TradeService] usando cache');
      return cached.sdk;
    }

    try {
      console.log('[TradeService] criando nova sessão SDK');
      return await this.loginWithSsid(userId, effectiveSsid);
    } catch (e: any) {
      console.error('[TradeService] falha ao criar SDK', e?.message);
      this.cache.delete(userId);
      throw new UnauthorizedException('Sessão do broker inválida/expirada');
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
