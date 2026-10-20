import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('GasRelayerBootstrap');
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT || 3004;
  await app.listen(port);
  logger.log(`⚡ ChordScan Gas Relayer Worker listening on port :${port}`);
}

bootstrap();
