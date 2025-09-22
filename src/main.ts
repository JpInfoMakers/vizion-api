import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyStatic from '@fastify/static';
import fastifySSE from 'fastify-sse-v2';
import { Logger } from '@nestjs/common';
import 'dotenv/config';
import path from 'path';
import { AccessTokenQueryGuard } from './guards/access-token-query.guard';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 10 * 1024 * 1024 }),
    {
      logger: ['error', 'warn', 'log', 'debug'],
    },
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

  const port = Number(3333);
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 App rodando em http://localhost:${port} (NODE_ENV=${process.env.NODE_ENV || 'dev'})`);
}
bootstrap();