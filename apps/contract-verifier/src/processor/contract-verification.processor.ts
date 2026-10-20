import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  CONTRACT_VERIFICATION_QUEUE,
  ContractVerificationJobData,
  ContractVerificationJobResult,
} from '@chordscan/queue';
import { SingleVerificationService } from '../services/single-verification.service';
import { ProxyVerificationService } from '../services/proxy-verification.service';

@Processor(CONTRACT_VERIFICATION_QUEUE, { concurrency: 2 })
export class ContractVerificationProcessor extends WorkerHost {
  private readonly logger = new Logger(ContractVerificationProcessor.name);

  constructor(
    private readonly singleService: SingleVerificationService,
    private readonly proxyService: ProxyVerificationService,
  ) {
    super();
  }

  async process(
    job: Job<ContractVerificationJobData>,
  ): Promise<ContractVerificationJobResult> {
    const jobId = job.id ?? 'unknown';
    const data = job.data;
    this.logger.log(`[Job #${jobId}] Processing verification: ${data.verificationType}`);

    try {
      if (data.verificationType === 'SINGLE') {
        const result = await this.singleService.verify(data);
        this.logger.log(`[Job #${jobId}] Single verification completed for ${data.contractAddress}`);
        return result;
      } else if (data.verificationType === 'PROXY') {
        const result = await this.proxyService.verify(data);
        this.logger.log(`[Job #${jobId}] Proxy verification completed for ${data.proxyAddress}`);
        return result;
      } else {
        throw new Error(`Unknown verification type: ${(data as any).verificationType}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[Job #${jobId}] Verification failed: ${msg}`);
      throw err;
    }
  }
}
