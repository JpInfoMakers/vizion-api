import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TradeModule } from './modules/trade.module';
import { UserEntity } from './entity/user.entity';
import { UserModule } from './modules/user.module';
import { AuthModule } from './modules/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        username: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        entities: [UserEntity],
        synchronize: true,
        logging: process.env.DB_LOG === 'true',
      }),
    }),
    UserModule,
    AuthModule,
    TradeModule
  ],
})
export class AppModule {}
