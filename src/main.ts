import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'dotenv/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3333);
  console.log('🚀 App rodando em http://localhost:3333');
}
bootstrap();
