// src/services/trade.service.ts
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../entity/user.entity';
import { ClientSdk, SsidAuthMethod } from '@tradecodehub/client-sdk-js';
import { tradeEnv } from '../config/trade.config';

type CacheItem = { sdk: ClientSdk; ssid: string };

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);
  private cache = new Map<string, CacheItem>();

  constructor(@InjectRepository(UserEntity) private readonly users: Repository<UserEntity>) {}

  private async createAndVerifySdk(ssid: string): Promise<ClientSdk> {
    const env = tradeEnv();
    const wsUrl = env.WS_URL;
    const appId = env.APP_ID;

    this.logger.log(`[createAndVerifySdk] cfg wsUrl=${wsUrl} appId=${appId} ssid=${ssid?.slice(0,6) ?? '<nil>'}`);

    if (!wsUrl || !appId) {
      throw new UnauthorizedException('WS/AppId do broker não configurado');
    }

    // cria a sessão WS
    const sdk = await ClientSdk.create(wsUrl, appId, new SsidAuthMethod(ssid));

    // valida imediatamente pra evitar ficar com sessão morta no cache
    try {
      const now = await sdk.currentTime();
      this.logger.log(`[createAndVerifySdk] ok currentTime=${now instanceof Date ? now.toISOString() : now}`);
    } catch (e: any) {
      this.logger.error(`[createAndVerifySdk] falha ao validar sessão: ${e?.message || e}`);
      try { await sdk.shutdown(); } catch {}
      throw new UnauthorizedException('Sessão do broker inválida/expirada (validação falhou)');
    }

    return sdk;
  }

  private async loginWithSsid(userId: string, ssid: string): Promise<ClientSdk> {
    this.logger.log(`[loginWithSsid] userId=${userId} ssid=${ssid?.slice(0,6)}`);
    const sdk = await this.createAndVerifySdk(ssid);
    this.cache.set(userId, { sdk, ssid });
    return sdk;
  }

  async getClientForUser(userId: string): Promise<ClientSdk> {
    this.logger.log(`[getClientForUser] IN userId=${userId}`);
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuário inválido');

    const ssid = user.brokerSsid;
    if (!ssid) {
      this.logger.warn('[getClientForUser] usuário sem brokerSsid');
      throw new UnauthorizedException('Conecte sua conta ao broker');
    }

    const cached = this.cache.get(userId);
    if (cached && cached.ssid === ssid) {
      // opcional: ping leve para garantir que a sessão ainda responde
      try {
        await cached.sdk.currentTime();
        return cached.sdk;
      } catch (e: any) {
        this.logger.warn(`[getClientForUser] cache inválido (ping falhou): ${e?.message || e}`);
        this.cache.delete(userId);
        try { await cached.sdk.shutdown(); } catch {}
      }
    }

    // cria nova sessão validada
    try {
      return await this.loginWithSsid(userId, ssid);
    } catch (e: any) {
      this.cache.delete(userId);
      this.logger.error(`[getClientForUser] falha ao criar sessão: ${e?.message || e}`);
      throw new UnauthorizedException('Sessão do broker inválida/expirada');
    }
  }

  async invalidate(userId: string) {
    const c = this.cache.get(userId);
    if (c) {
      this.logger.warn(`[invalidate] derrubando sessão do userId=${userId}`);
      try { await c.sdk.shutdown(); } catch {}
      this.cache.delete(userId);
    }
  }
}
