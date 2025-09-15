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
    if (!wsUrl) throw new UnauthorizedException('WS do broker não configurado');
    return ClientSdk.create(wsUrl, platformId, new SsidAuthMethod(ssid));
  }

  private async loginWithSsid(userId: string, ssid: string): Promise<ClientSdk> {
    const sdk = await this.createSdkWithSsid(ssid);
    this.cache.set(userId, { sdk, ssid });
    return sdk;
  }

  async getClientForUser(userId: string): Promise<ClientSdk> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuário inválido');

    const effectiveSsid = (user as any).brokerSsid ?? (user as any).ssid ?? null;
    if (!effectiveSsid) throw new UnauthorizedException('Conecte sua conta ao broker');

    const cached = this.cache.get(userId);
    if (cached && cached.ssid === effectiveSsid) return cached.sdk;

    try {
      return await this.loginWithSsid(userId, effectiveSsid);
    } catch {
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
