import { Injectable, OnApplicationBootstrap, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { WebSocketServer, WebSocket } from 'ws';
import { REDIS_CLIENT, Redis } from '@chordscan/redis';

export interface WsEventPayload<T = any> {
  type: 'new_transaction' | 'new_block' | 'network_stats' | 'connected' | 'pong';
  data?: T;
  timestamp: string;
}

@Injectable()
export class WebSocketService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(WebSocketService.name);
  private wss?: WebSocketServer;
  private subscriberRedis?: Redis;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async onApplicationBootstrap() {
    const server = this.adapterHost.httpAdapter?.getHttpServer();
    if (!server) {
      this.logger.error('[WS] HTTP Server not found for WebSocket attachment');
      return;
    }

    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientIp =
        (req.headers['x-real-ip'] as string) ||
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress;

      this.logger.log(`[WS] Client connected from ${clientIp} (active: ${this.wss?.clients.size})`);

      ws.send(
        JSON.stringify({
          type: 'connected',
          data: {
            message: 'ChordScan Live WebSocket Connected',
            network: 'chord_7613-1',
            chainId: 7613,
          },
          timestamp: new Date().toISOString(),
        }),
      );

      ws.on('message', (message: string) => {
        try {
          const parsed = JSON.parse(message.toString());
          if (parsed.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          }
        } catch {
          // ignore non-json messages
        }
      });

      ws.on('close', () => {
        this.logger.log(`[WS] Client disconnected (active: ${this.wss?.clients.size})`);
      });

      ws.on('error', (err) => {
        this.logger.warn(`[WS] Client socket error: ${err.message}`);
      });
    });

    this.logger.log('⚡ ChordScan WebSocket Gateway mounted on /ws');

    // Redis Pub/Sub Subscriber 구성
    try {
      this.subscriberRedis = this.redis.duplicate();
      await this.subscriberRedis.subscribe('chord:blocks', 'chord:txs', 'chord:stats');

      this.subscriberRedis.on('message', (channel: string, message: string) => {
        try {
          const parsed = JSON.parse(message);
          if (channel === 'chord:blocks') {
            this.broadcast('new_block', parsed);
          } else if (channel === 'chord:txs') {
            this.broadcast('new_transaction', parsed);
          } else if (channel === 'chord:stats') {
            this.broadcast('network_stats', parsed);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Failed to parse Pub/Sub message on ${channel}: ${msg}`);
        }
      });
      this.logger.log('📡 Subscribed to Redis channels: chord:blocks, chord:txs, chord:stats');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to initialize Redis Pub/Sub subscriber: ${msg}`);
    }
  }

  broadcast<T>(type: WsEventPayload['type'], data: T) {
    if (!this.wss || this.wss.clients.size === 0) return;

    const payload: WsEventPayload<T> = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };
    const message = JSON.stringify(payload);

    let sentCount = 0;
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sentCount++;
      }
    }
    if (sentCount > 0) {
      this.logger.debug(`[WS] Broadcasted ${type} to ${sentCount} clients`);
    }
  }

  getClientCount(): number {
    return this.wss?.clients.size || 0;
  }

  async onModuleDestroy() {
    this.wss?.close();
    if (this.subscriberRedis) {
      await this.subscriberRedis.quit();
    }
  }
}
