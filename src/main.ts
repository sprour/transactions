import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger, ValidationPipe } from '@nestjs/common';
import { envConfig } from './config/env.config';

const env = envConfig();

async function bootstrap() {
  const logger = new Logger('bootstrap');
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
//  app.useGlobalInterceptors(new ErrorsInterceptor());
  app.useGlobalPipes(new ValidationPipe());
  const port = env.get('PORT');
  await app.listen(port);
  logger.log(`Application listening on port ${port}`);
}
bootstrap();
