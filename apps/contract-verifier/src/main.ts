import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('ContractVerifierBootstrap');
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT || 3005;
  await app.listen(port);
  logger.log(`🔍 ChordScan Contract Verifier Worker listening on port :${port}`);
}

bootstrap();
