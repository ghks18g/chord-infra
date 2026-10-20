import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('IndexerBootstrap');
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const port = process.env.PORT || 3003;
  await app.listen(port);
  logger.log(`⚡ ChordScan Indexer Engine listening on port :${port}`);
}

bootstrap();
