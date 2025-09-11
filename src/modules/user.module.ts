import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/entity/user.entity';
import { UserService } from 'src/services/user.service';
import { ImageModule } from './image.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    ImageModule,
  ],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
