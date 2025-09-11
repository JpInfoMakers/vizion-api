import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientSdk, SsidAuthMethod } from '@tradecodehub/client-sdk-js';
import { UserEntity } from '../entity/user.entity';
import { tradeEnv } from '../config/trade.config';

@Injectable()
export class TradeService {
  constructor(@InjectRepository(UserEntity) private readonly users: Repository<UserEntity>) {}

  async getClientForUser(userId: string): Promise<ClientSdk> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || !user.ssid) throw new UnauthorizedException('Usuário não possui SSID vinculado');

    const env = tradeEnv();
    if (!env.WS_URL || !env.APP_ID) throw new Error('Faltam envs TRADE_WS_URL/TRADE_APP_ID');

    return ClientSdk.create(env.WS_URL, env.APP_ID, new SsidAuthMethod(user.ssid));
  }
}
