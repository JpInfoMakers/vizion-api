import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from 'src/controllers/auth.controller';
import { AuthService } from 'src/services/auth.service';
import { UserModule } from './user.module';      // <- importe o módulo
import { BrokerService } from 'src/services/broker.service';

@Module({
  imports: [
    JwtModule.register({}),
    UserModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, BrokerService],
  exports: [AuthService],
})
export class AuthModule {}
