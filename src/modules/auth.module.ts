import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { UserModule } from './user.module';
import { BrokerService } from '../services/broker.service';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    UserModule,
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: process.env.JWT_ACCESS_TTL || '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, BrokerService],
  exports: [PassportModule, JwtModule]
})
export class AuthModule { }
