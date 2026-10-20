import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  RELAY_TX_QUEUE,
  RelayTxJobData,
  RelayTxJobResult,
} from '@chordscan/queue';
import { RelayExecutionService } from '../services/relay-execution.service';

@Processor(RELAY_TX_QUEUE, { concurrency: 1 })
export class RelayProcessor extends WorkerHost {
  private readonly logger = new Logger(RelayProcessor.name);

  constructor(private readonly executionService: RelayExecutionService) {
    super();
  }

  async process(job: Job<RelayTxJobData>): Promise<RelayTxJobResult> {
    const jobId = job.id ?? 'unknown';
    this.logger.log(`[RelayJob #${jobId}] Processing relay tx from ${job.data.from} -> ${job.data.to}`);

    try {
      const result = await this.executionService.executeRelay(job.data);
      this.logger.log(`[RelayJob #${jobId}] Successfully relayed tx: ${result.transactionHash}`);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[RelayJob #${jobId}] Failed to relay tx: ${msg}`);
      throw err;
    }
  }
}
