import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyStatic from '@fastify/static';
import fastifySSE from 'fastify-sse-v2';
import 'dotenv/config';
import path from 'path';
import { AccessTokenQueryGuard } from './guards/access-token-query.guard';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 10 * 1024 * 1024 })
  );

  await app.register(fastifySSE);

  app.enableCors({
    origin: ['http://localhost:9002', 'https://tradervizion.com'],
    methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
    credentials: false,
  });

  const uploadsRoot = path.resolve(process.cwd(), 'uploads');
  await app.register(fastifyStatic, {
    root: uploadsRoot,
    prefix: '/uploads/',
    decorateReply: false,
    index: false,
  });

  const atq = app.get(AccessTokenQueryGuard);
  app.useGlobalGuards(atq);

  await app.listen(3333);
  console.log('🚀 App rodando em http://localhost:3333');
}
bootstrap();
