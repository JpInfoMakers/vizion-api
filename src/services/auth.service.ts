// src/modules/auth/services/auth.service.ts
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from '../dtos/register.dto';
import { LoginDto } from '../dtos/login.dto';
import { hashPassword, comparePassword, sanitizeUser } from '../shared/utils';
import { UserService } from './user.service';
import { ClientSdk, SsidAuthMethod } from '@tradecodehub/client-sdk-js';
import { tradeEnv } from '../config/trade.config';
import { BrokerService } from './broker.service';
import { UpdateUserDto } from '../dtos/update-user.dto';
import type { File as FastifyFile } from '@nest-lab/fastify-multer';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
    private readonly broker: BrokerService
  ) {}

  private issueTokens(payload: { sub: string; email: string }) {
    const accessToken = this.jwt.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_TTL || '15m',
    });
    const refreshToken = this.jwt.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_TTL || '7d',
    });
    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    const { email, first_name, last_name, phone, password } = dto;
    const exists = await this.users.findByEmail(email);
    if (exists) throw new BadRequestException('E-mail já cadastrado');

    const registerPayload = {
      identifier: email,
      password,
      accepted: ['terms', 'privacy policy'],
      country_id: 30,
      first_name: `${first_name} ${last_name}`,
      timezone: 'America/Sao_Paulo',
    };

    const register_response = await this.broker.register(registerPayload);
    if (!register_response || register_response.code !== 'success') {
      throw new BadRequestException({
        message: 'Falha ao registrar no provedor externo',
        details: register_response,
      });
    }

    const login_response = await this.broker.login({ identifier: email, password });
    const { code, ssid } = login_response || {};
    if (code !== 'success' || !ssid) {
      throw new BadRequestException({
        message: 'Registro realizado, mas login externo falhou',
        details: login_response,
      });
    }

    const env = tradeEnv();
    if (!env.WS_URL || !env.APP_ID) {
      throw new BadRequestException('Configuração externa ausente: WS_URL / APP_ID');
    }
    await ClientSdk.create(env.WS_URL, env.APP_ID, new SsidAuthMethod(ssid));

    const passwordHash = await hashPassword(password);
    const user = await this.users.create({
      email,
      firstName: first_name,
      lastName: last_name,
      phone: phone ?? null,
      passwordHash,
    });

    await this.users.setSsid(user.id, ssid);

    const tokens = this.issueTokens({ sub: user.id, email: user.email });
    await this.users.updateRefreshToken(user.id, tokens.refreshToken);

    return { user: sanitizeUser({ ...user, ssid, sdkLinked: true } as any), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Credenciais inválidas');

    const ok = await comparePassword(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');

    if (!user.brokerSsid) {
      try {
        const resp = await this.broker.login({ identifier: dto.email, password: dto.password });
        if (resp?.code === 'success' && resp?.ssid) {
          const ssid = resp.ssid;
          const env = tradeEnv();
          if (env.WS_URL && env.APP_ID) {
            try {
              await ClientSdk.create(env.WS_URL, env.APP_ID, new SsidAuthMethod(ssid));
            } catch {}
          }
          await this.users.setSsid(user.id, ssid);
          (user as any).brokerSsid = ssid;
        }
      } catch {}
    }

    const tokens = this.issueTokens({ sub: user.id, email: user.email });
    await this.users.updateRefreshToken(user.id, tokens.refreshToken);

    const sdkLinked = !!(user as any).brokerSsid;
    return { user: sanitizeUser(user), sdkLinked, ...tokens };
  }

  updateUser(currentUserId: string, targetUserId: string, dto: UpdateUserDto, photo?: FastifyFile) {
    return this.users.updateUser(currentUserId, targetUserId, dto, photo);
  }

  async loginWithSsid(ssid: string) {
    if (!ssid) throw new BadRequestException('SSID ausente');

    const env = tradeEnv();
    if (!env.WS_URL || !env.APP_ID) {
      throw new BadRequestException('Configuração externa ausente: WS_URL / APP_ID');
    }

    await ClientSdk.create(env.WS_URL, env.APP_ID, new SsidAuthMethod(ssid));

    const user = await this.users.findOrCreateBySsid(ssid);
    const tokens = this.issueTokens({ sub: user.id, email: user.email });
    await this.users.updateRefreshToken(user.id, tokens.refreshToken);

    return { user: sanitizeUser(user), ...tokens };
  }

  async loginBroker(dto: LoginDto) {
    const resp = await this.broker.login({ identifier: dto.email, password: dto.password });
    if (resp.code === 'requests_limit_exceeded') {
      throw new BadRequestException('Login externo temporariamente indisponível');
    }
    if (resp.code !== 'success' || !resp.ssid) {
      throw new UnauthorizedException('Usuário não autenticado no provedor externo');
    }

    const ssid = resp.ssid;
    const env = tradeEnv();
    if (!env.WS_URL || !env.APP_ID) {
      throw new BadRequestException('Configuração externa ausente: WS_URL / APP_ID');
    }

    await ClientSdk.create(env.WS_URL, env.APP_ID, new SsidAuthMethod(ssid));

    let user = await this.users.findByEmail(dto.email);
    if (!user) {
      const { default: bcrypt } = await import('bcrypt');
      const { randomUUID } = await import('crypto');
      user = await this.users.create({
        email: dto.email,
        firstName: 'SDK',
        lastName: 'User',
        phone: null,
        passwordHash: await bcrypt.hash(randomUUID(), 10),
      });
    }

    await this.users.setSsid(user.id, ssid);

    const tokens = this.issueTokens({ sub: user.id, email: user.email });
    await this.users.updateRefreshToken(user.id, tokens.refreshToken);

    return { user: sanitizeUser({ ...user, ssid, sdkLinked: true } as any), ...tokens };
  }

  async refresh(refreshToken: string) {
    const payload = await this.users.verifyAndGetRefreshOwner(refreshToken);
    const tokens = this.issueTokens({ sub: payload.sub, email: payload.email });
    await this.users.updateRefreshToken(payload.sub, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string, refreshToken?: string) {
    await this.users.clearRefreshToken(userId, refreshToken);
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) return null;
    return { ...sanitizeUser(user), sdkLinked: !!user.brokerSsid };
  }
}
