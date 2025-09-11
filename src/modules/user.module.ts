import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserService } from '../services/user.service';
import { ImageModule } from './image.module';
import { UserEntity } from '../entity/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    ImageModule,
  ],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
