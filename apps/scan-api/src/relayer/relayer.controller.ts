import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  BadRequestException,
  Logger,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import {
  RELAY_TX_QUEUE,
  RELAY_TX_JOB_NAME,
  RelayTxJobData,
  RelayTxJobResult,
} from '@chordscan/queue';
import { RelayDispatchDTO } from '@chordscan/types';
import { ethers } from 'ethers';

@Controller('api/relayer')
export class RelayerController {
  private readonly logger = new Logger(RelayerController.name);
  private queueEvents?: QueueEvents;

  private readonly sponsorAddress = ethers.getAddress(
    (process.env.RELAYER_SPONSOR_ADDRESS || '0x470cC21093319e612E9779cE2c1d53b0F84562F5').toLowerCase(),
  );
  private readonly chainId = Number(process.env.CHORD_CHAIN_ID || 7613);
  private readonly forwarderAddress = ethers.getAddress(
    (process.env.CHORD_FORWARDER_ADDRESS || '0x34ec2B8950c43c126d8e7F57dD67d3F134Ea1933').toLowerCase(),
  );

  constructor(
    @InjectQueue(RELAY_TX_QUEUE) private readonly relayQueue: Queue,
  ) {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = Number(process.env.REDIS_PORT || 6379);
    const password = process.env.REDIS_PASSWORD || undefined;

    this.queueEvents = new QueueEvents(RELAY_TX_QUEUE, {
      connection: { host, port, password },
    });
  }

  @Post('relay')
  @HttpCode(HttpStatus.OK)
  async dispatchRelay(
    @Body() dto: RelayDispatchDTO,
    @Query('wait') wait?: string,
  ) {
    if (!dto.from || !dto.to || !dto.data) {
      throw new BadRequestException('Required fields missing: from, to, data');
    }

    const jobData: RelayTxJobData = {
      from: dto.from,
      to: dto.to,
      data: dto.data,
      value: dto.value,
      gas: dto.gas,
      nonce: dto.nonce,
      deadline: dto.deadline,
      signature: dto.signature,
      forwarderAddress: this.forwarderAddress,
      submittedAt: Date.now(),
    };

    const job = await this.relayQueue.add(RELAY_TX_JOB_NAME, jobData, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    });

    this.logger.log(`[RelayController] Enqueued relay job #${job.id} for user ${dto.from}`);

    // 기본 동기 대기 (wait !== 'false') - 프론트엔드 및 CLI 즉각성 보장
    if (wait !== 'false' && this.queueEvents) {
      try {
        const result = (await job.waitUntilFinished(this.queueEvents, 12000)) as RelayTxJobResult;
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Job #${job.id} wait timed out or failed (${msg}), returning queued status`);
        return {
          success: false,
          status: 'QUEUED',
          jobId: job.id,
          message: `Relay transaction enqueued: ${msg}`,
        };
      }
    }

    return {
      status: 'QUEUED',
      jobId: job.id,
      message: 'Relay transaction queued for execution',
    };
  }

  @Get('status/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    const job = await this.relayQueue.getJob(jobId);
    if (!job) {
      return { status: 'NOT_FOUND', jobId };
    }

    const state = await job.getState();
    return {
      jobId: job.id,
      state,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
    };
  }

  @Get('info')
  getRelayerInfo() {
    return {
      chainId: this.chainId,
      sponsorAddress: this.sponsorAddress,
      forwarderAddress: this.forwarderAddress,
      queueName: RELAY_TX_QUEUE,
      status: 'OPERATIONAL',
    };
  }
}
