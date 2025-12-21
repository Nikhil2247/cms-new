import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redlock from 'redlock';
import Redis from 'ioredis';

@Injectable()
export class RedlockService implements OnModuleInit {
  private readonly logger = new Logger(RedlockService.name);
  private redlock: Redlock;
  private redis: Redis;

  async onModuleInit() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    this.redlock = new Redlock([this.redis], {
      driftFactor: 0.01,
      retryCount: 10,
      retryDelay: 200,
      retryJitter: 200,
      automaticExtensionThreshold: 500,
    });

    this.redlock.on('error', (error) => {
      this.logger.error('Redlock error', error);
    });
  }

  async acquireLock(resource: string, ttl: number = 5000) {
    try {
      return await this.redlock.acquire([`lock:${resource}`], ttl);
    } catch (error) {
      this.logger.warn(`Failed to acquire lock for ${resource}`);
      throw error;
    }
  }

  async withLock<T>(
    resource: string,
    operation: () => Promise<T>,
    ttl: number = 5000,
  ): Promise<T> {
    const lock = await this.acquireLock(resource, ttl);
    try {
      return await operation();
    } finally {
      await lock.release();
    }
  }
}
