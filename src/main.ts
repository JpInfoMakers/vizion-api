import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyStatic from '@fastify/static';
import 'dotenv/config';
import path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 10 * 1024 * 1024 })
  );


  app.enableCors({
     origin: '*',
    // origin: [
    //   'http://localhost:9002',
    //   'https://tradervizion.com',
    // ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const uploadsRoot = path.resolve(process.cwd(), 'uploads');
  await app.register(fastifyStatic, {
    root: uploadsRoot,
    prefix: '/uploads/',
    decorateReply: false,
    index: false,
  });

  await app.listen(3333);
  console.log('🚀 App rodando em http://localhost:3333');
}
bootstrap();
