import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import LRUCacheImport from 'lru-cache';
import Redis from 'ioredis';
import { CircuitBreaker, CircuitState } from './circuit-breaker';

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
}

@Injectable()
export class LruCacheService implements OnModuleInit {
  private readonly logger = new Logger(LruCacheService.name);
  private localCache: any;
  private redis: Redis;
  private tagStore: Map<string, Set<string>>; // tag -> Set of cache keys
  private redisCircuitBreaker: CircuitBreaker;

  // Metrics
  private l1Hits = 0;
  private l1Misses = 0;
  private l2Hits = 0;
  private l2Misses = 0;

  constructor(private configService: ConfigService) {
    const LRUCacheCtor = (LRUCacheImport as any)?.LRUCache ?? (LRUCacheImport as any);

    // Initialize local LRU cache for hot data
    this.localCache = new LRUCacheCtor({
      max: 500, // Maximum 500 items in local cache
      ttl: 60000, // 1 minute TTL for local cache
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });

    // Initialize tag store
    this.tagStore = new Map();

    // Initialize circuit breaker for Redis
    this.redisCircuitBreaker = new CircuitBreaker('redis', {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 30000,
      halfOpenMaxCalls: 3,
    });
  }

  async onModuleInit() {
    // Initialize Redis connection
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis Client Error:', err);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis Client Connected');
    });
  }

  /**
   * Get value from cache (checks local LRU first, then Redis)
   */
  async get<T>(key: string): Promise<T | null> {
    // Try L1 first
    const l1Value = this.localCache.get(key);
    if (l1Value !== undefined) {
      this.l1Hits++;
      return l1Value as T;
    }
    this.l1Misses++;

    // Try Redis with circuit breaker
    if (this.redis && this.redisCircuitBreaker.getState() !== CircuitState.OPEN) {
      try {
        const value = await this.redisCircuitBreaker.execute(async () => {
          const data = await this.redis.get(key);
          return data ? JSON.parse(data) : null;
        });

        if (value !== null) {
          this.l2Hits++;
          this.localCache.set(key, value); // Populate L1
          return value;
        }
        this.l2Misses++;
      } catch (error) {
        this.logger.warn(`Redis get failed for key ${key}, using L1 only`);
      }
    }

    return null;
  }

  /**
   * Set value in both local and Redis cache
   */
  async set(key: string, value: any, options?: CacheOptions): Promise<void> {
    const ttlMsRaw = options?.ttl ?? 300000; // Default 5 minutes (in ms)
    const ttlMsParsed = Number(ttlMsRaw);
    const ttlMs = Number.isFinite(ttlMsParsed) && ttlMsParsed > 0 ? ttlMsParsed : 300000;

    // Set in local cache.
    // Newer lru-cache uses an options object with `ttl`, older versions use a numeric `maxAge` as the 3rd arg.
    const l1TtlMs = Math.min(ttlMs, 60000);
    try {
      this.localCache.set(key, value, { ttl: l1TtlMs });
    } catch {
      this.localCache.set(key, value, l1TtlMs);
    }

    // Set in Redis with circuit breaker
    if (this.redis && this.redisCircuitBreaker.getState() !== CircuitState.OPEN) {
      try {
        await this.redisCircuitBreaker.execute(async () => {
          const serialized = JSON.stringify(value);
          await this.redis.setex(key, Math.floor(ttlMs / 1000), serialized);

          // Handle tags if provided
          if (options?.tags && options.tags.length > 0) {
            await this.setTags(key, options.tags);
          }
        });
      } catch (error) {
        this.logger.warn(`Redis set failed for key ${key}`, error);
      }
    }
  }

  /**
   * Get from cache or fetch and set
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch the value
    const value = await fetcher();

    // Set in cache
    await this.set(key, value, options);

    return value;
  }

  /**
   * Delete a key from both local and Redis cache
   */
  async delete(key: string): Promise<void> {
    this.localCache.delete(key);
    if (this.redis && this.redisCircuitBreaker.getState() !== CircuitState.OPEN) {
      try {
        await this.redisCircuitBreaker.execute(async () => {
          await this.redis.del(key);
          // Remove from tag store
          this.removeFromAllTags(key);
        });
      } catch (error) {
        this.logger.warn(`Redis delete failed for key ${key}`, error);
      }
    }
  }

  /**
   * Invalidate cache by pattern (e.g., 'institution:*')
   */
  async invalidate(pattern: string): Promise<void> {
    // Clear matching keys from local cache
    for (const key of this.localCache.keys()) {
      if (this.matchPattern(key, pattern)) {
        this.localCache.delete(key);
      }
    }

    // Clear matching keys from Redis with circuit breaker
    if (this.redis && this.redisCircuitBreaker.getState() !== CircuitState.OPEN) {
      try {
        await this.redisCircuitBreaker.execute(async () => {
          const keys = await this.redis.keys(pattern);
          if (keys.length > 0) {
            await this.redis.del(...keys);
            // Remove from tag store
            keys.forEach((key) => this.removeFromAllTags(key));
          }
        });
      } catch (error) {
        this.logger.warn(`Redis invalidate failed for pattern ${pattern}`, error);
      }
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    const keysToDelete = new Set<string>();

    // Collect all keys associated with these tags
    for (const tag of tags) {
      const keys = this.tagStore.get(tag);
      if (keys) {
        keys.forEach((key) => keysToDelete.add(key));
      }
    }

    // Delete all collected keys
    for (const key of keysToDelete) {
      await this.delete(key);
    }

    // Clear the tags
    tags.forEach((tag) => this.tagStore.delete(tag));
  }

  /**
   * Clear all cache (both local and Redis)
   */
  async clear(): Promise<void> {
    this.localCache.clear();
    this.tagStore.clear();
    if (this.redis && this.redisCircuitBreaker.getState() !== CircuitState.OPEN) {
      try {
        await this.redisCircuitBreaker.execute(async () => {
          await this.redis.flushdb();
        });
      } catch (error) {
        this.logger.warn('Redis clear failed', error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      local: {
        size: this.localCache.size,
        max: this.localCache.max,
      },
      tags: {
        count: this.tagStore.size,
      },
    };
  }

  /**
   * Get comprehensive metrics including circuit breaker status
   */
  getMetrics() {
    return {
      l1: {
        size: this.localCache.size,
        hits: this.l1Hits,
        misses: this.l1Misses,
        hitRate: this.l1Hits / (this.l1Hits + this.l1Misses) || 0,
      },
      l2: {
        connected: !!this.redis,
        circuitState: this.redisCircuitBreaker.getState(),
        hits: this.l2Hits,
        misses: this.l2Misses,
        hitRate: this.l2Hits / (this.l2Hits + this.l2Misses) || 0,
      },
      circuit: this.redisCircuitBreaker.getMetrics(),
    };
  }

  /**
   * Set tags for a cache key
   */
  private async setTags(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      if (!this.tagStore.has(tag)) {
        this.tagStore.set(tag, new Set());
      }
      this.tagStore.get(tag)!.add(key);
    }

    // Store tags in Redis as well for distributed systems
    if (this.redis && this.redisCircuitBreaker.getState() !== CircuitState.OPEN) {
      try {
        await this.redisCircuitBreaker.execute(async () => {
          await this.redis.sadd(`tags:${key}`, ...tags);
          for (const tag of tags) {
            await this.redis.sadd(`tag:${tag}`, key);
          }
        });
      } catch (error) {
        this.logger.warn('Redis set tags error:', error);
      }
    }
  }

  /**
   * Remove key from all tag associations
   */
  private removeFromAllTags(key: string): void {
    for (const [tag, keys] of this.tagStore.entries()) {
      keys.delete(key);
      if (keys.size === 0) {
        this.tagStore.delete(tag);
      }
    }
  }

  /**
   * Simple pattern matching (supports * wildcard)
   */
  private matchPattern(key: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  }

  /**
   * Batch get multiple keys
   */
  async mget<T>(...keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map((key) => this.get<T>(key)));
  }

  /**
   * Batch set multiple keys
   */
  async mset(
    entries: Array<{ key: string; value: any; options?: CacheOptions }>,
  ): Promise<void> {
    await Promise.all(
      entries.map((entry) => this.set(entry.key, entry.value, entry.options)),
    );
  }

  /**
   * Batch delete multiple keys
   */
  async mdel(...keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.delete(key)));
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    if (this.localCache.has(key)) {
      return true;
    }

    if (this.redis && this.redisCircuitBreaker.getState() !== CircuitState.OPEN) {
      try {
        const exists = await this.redisCircuitBreaker.execute(async () => {
          return await this.redis.exists(key);
        });
        return exists === 1;
      } catch (error) {
        this.logger.warn('Redis has error:', error);
        return false;
      }
    }

    return false;
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    if (this.redis && this.redisCircuitBreaker.getState() !== CircuitState.OPEN) {
      try {
        return await this.redisCircuitBreaker.execute(async () => {
          return await this.redis.ttl(key);
        });
      } catch (error) {
        this.logger.warn('Redis TTL error:', error);
        return -1;
      }
    }
    return -1;
  }
}
