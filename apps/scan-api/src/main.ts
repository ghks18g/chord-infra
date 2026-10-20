import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('ScanApiBootstrap');
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const port = process.env.PORT || 3002;
  await app.listen(port);
  logger.log(`⚡ ChordScan Scan API & WebSocket Gateway listening on port :${port}`);
}

bootstrap();
