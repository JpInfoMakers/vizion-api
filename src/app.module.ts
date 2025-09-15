import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './controllers/auth.controller';
import { UserEntity } from './entity/user.entity';
import { AccessTokenQueryGuard } from './guards/access-token-query.guard';
import { UserModule } from './modules/user.module';
import { AuthService } from './services/auth.service';
import { BrokerService } from './services/broker.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UserModule,
    TypeOrmModule.forFeature([UserEntity]),
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: process.env.JWT_ACCESS_TTL || '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, BrokerService, JwtStrategy, AccessTokenQueryGuard],
  exports: [PassportModule, JwtModule, AccessTokenQueryGuard],
})
export class AuthModule {}
