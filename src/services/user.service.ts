import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { UserEntity } from '../entity/user.entity';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { ImageService } from './image.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
    private readonly imageService: ImageService
  ) { }

  async create(data: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    passwordHash: string;
  }) {
    const user = this.repo.create({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone ?? null,
      passwordHash: data.passwordHash,
      refreshTokenHash: null,
      sdkLinked: false,
      ssid: null,
    });
    return this.repo.save(user);
  }

  async update(id: string, patch: Partial<UserEntity>) {
    await this.repo.update({ id }, patch);
    return this.findById(id);
  }

  async updateUser(currentUserId: string, targetUserId: string, dto: UpdateUserDto, photo?: Express.Multer.File) {
    if (currentUserId !== targetUserId) {
      throw new ForbiddenException('Você só pode alterar seu próprio perfil.');
    }

    const user = await this.repo.findOne({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (photo) {
      const result = await this.imageService.saveFile(photo, 'avatars');
      user.photoURL = result.publicUrl;
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.language !== undefined) user.language = dto.language;
    if (dto.baseCurrency !== undefined) user.baseCurrency = dto.baseCurrency;

    await this.repo.save(user);
    return user;
  }


  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findBySsid(ssid: string) {
    return this.repo.findOne({ where: { ssid } });
  }

  async setSsid(userId: string, ssid: string | null) {
    await this.repo.update({ id: userId }, { ssid, sdkLinked: !!ssid });
  }

  async updateRefreshToken(userId: string, refreshToken: string) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.repo.update({ id: userId }, { refreshTokenHash });
  }

  async clearRefreshToken(userId: string, specific?: string) {
    const user = await this.findById(userId);
    if (!user) return;
    if (!specific) {
      await this.repo.update({ id: userId }, { refreshTokenHash: null });
      return;
    }
    const ok = !!user.refreshTokenHash && (await bcrypt.compare(specific, user.refreshTokenHash));
    if (ok) await this.repo.update({ id: userId }, { refreshTokenHash: null });
  }

  async verifyAndGetRefreshOwner(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
      const user = await this.findById(payload.sub);
      if (!user || !user.refreshTokenHash) throw new UnauthorizedException();
      const ok = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!ok) throw new UnauthorizedException();
      return payload;
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
  }

  async markSdkLinked(userId: string, linked: boolean) {
    await this.repo.update({ id: userId }, { sdkLinked: linked });
  }

  async findOrCreateBySsid(ssid: string) {
    let user = await this.findBySsid(ssid);
    if (user) return user;
    user = this.repo.create({
      email: `ssid_${ssid}@local`,
      firstName: 'SDK',
      lastName: 'User',
      phone: null,
      passwordHash: await bcrypt.hash(crypto.randomUUID(), 10),
      ssid,
      sdkLinked: true,
    });
    return this.repo.save(user);
  }
}
