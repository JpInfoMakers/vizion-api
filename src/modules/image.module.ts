import { Module } from '@nestjs/common';
import { ImageService } from 'src/services/image.service';

@Module({
  providers: [ImageService],
  exports: [ImageService],
})
export class ImageModule {}
