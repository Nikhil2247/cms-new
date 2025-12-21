import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';

/**
 * Cache configuration for different entity types
 */
const CACHE_CONFIG = {
  // Long-lived cache (rarely changes)
  institution: { ttl: 600000, namespace: 'inst' }, // 10 minutes
  batch: { ttl: 600000, namespace: 'batch' },
  branch: { ttl: 600000, namespace: 'branch' },
  
  // Medium-lived cache
  user: { ttl: 300000, namespace: 'user' }, // 5 minutes
  student: { ttl: 300000, namespace: 'student' },
  industry: { ttl: 300000, namespace: 'industry' },
  
  // Short-lived cache (frequent updates)
  internship: { ttl: 120000, namespace: 'intern' }, // 2 minutes
  internshipApplication: { ttl: 120000, namespace: 'app' },
  
  // Default
  default: { ttl: 300000, namespace: 'cache' },
} as const;

type ModelName = keyof typeof CACHE_CONFIG | string;

@Injectable()
export class PrismaCacheService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaCacheService.name);
  private cache: Keyv;
  private isRedisConnected = false;
  private cacheStats = {
    hits: 0,
    misses: 0,
    errors: 0,
  };

  constructor() {
    super();
    this.initializeCache();
  }

  private initializeCache() {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');
    const redisUrl = `redis://${redisHost}:${redisPort}`;

    try {
      const keyvRedis = new KeyvRedis(redisUrl);
      
      this.cache = new Keyv({
        store: keyvRedis,
        namespace: 'prisma',
        ttl: CACHE_CONFIG.default.ttl,
      });

      this.cache.on('error', (err) => {
        this.logger.error('Keyv Redis error:', err);
        this.isRedisConnected = false;
        this.cacheStats.errors++;
      });

      // Test connection
      this.testConnection();
    } catch (error) {
      this.logger.warn('Failed to initialize Redis cache, running without cache:', error);
      this.isRedisConnected = false;
    }
  }

  private async testConnection() {
    try {
      await this.cache.set('prisma:ping', 'pong', 5000);
      const result = await this.cache.get('prisma:ping');
      if (result === 'pong') {
        this.isRedisConnected = true;
        this.logger.log('✅ Prisma cache connected to Redis/DragonflyDB');
      }
    } catch (error) {
      this.logger.warn('Redis connection test failed:', error);
      this.isRedisConnected = false;
    }
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Prisma connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    if (this.cache) {
      await this.cache.disconnect();
    }
  }

  /**
   * Get cache TTL for a model
   */
  private getCacheTTL(model: ModelName): number {
    const config = CACHE_CONFIG[model as keyof typeof CACHE_CONFIG] || CACHE_CONFIG.default;
    return config.ttl;
  }

  /**
   * Generate cache key for a query
   */
  private generateCacheKey(model: string, operation: string, args: any): string {
    const argsHash = this.hashArgs(args);
    return `prisma:${model}:${operation}:${argsHash}`;
  }

  /**
   * Simple hash function for query arguments
   */
  private hashArgs(args: any): string {
    if (!args) return 'empty';
    try {
      const str = JSON.stringify(args, Object.keys(args).sort());
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(36);
    } catch {
      return 'error';
    }
  }

  /**
   * Get data from cache or execute query
   */
  async cachedQuery<T>(
    model: ModelName,
    operation: string,
    args: any,
    queryFn: () => Promise<T>,
  ): Promise<T> {
    if (!this.isRedisConnected) {
      return queryFn();
    }

    const cacheKey = this.generateCacheKey(model, operation, args);
    
    try {
      // Try to get from cache
      const cached = await this.cache.get(cacheKey);
      if (cached !== undefined) {
        this.cacheStats.hits++;
        return cached as T;
      }
      
      this.cacheStats.misses++;
      
      // Execute query
      const result = await queryFn();
      
      // Store in cache
      const ttl = this.getCacheTTL(model);
      await this.cache.set(cacheKey, result, ttl);
      
      return result;
    } catch (error) {
      this.cacheStats.errors++;
      this.logger.warn(`Cache error for ${cacheKey}:`, error);
      return queryFn();
    }
  }

  /**
   * Invalidate cache for a model
   */
  async invalidateModel(model: ModelName): Promise<void> {
    if (!this.isRedisConnected) return;
    
    try {
      // Note: Keyv doesn't have pattern delete, we'll clear namespace
      await this.cache.clear();
      this.logger.debug(`Cache invalidated for model: ${model}`);
    } catch (error) {
      this.logger.warn(`Failed to invalidate cache for ${model}:`, error);
    }
  }

  /**
   * Invalidate specific cache key
   */
  async invalidateKey(key: string): Promise<void> {
    if (!this.isRedisConnected) return;
    
    try {
      await this.cache.delete(key);
    } catch (error) {
      this.logger.warn(`Failed to invalidate key ${key}:`, error);
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache(): Promise<void> {
    if (!this.isRedisConnected) return;
    
    try {
      await this.cache.clear();
      this.logger.log('All Prisma cache cleared');
    } catch (error) {
      this.logger.warn('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? (this.cacheStats.hits / total * 100).toFixed(2) : '0.00';
    
    return {
      ...this.cacheStats,
      total,
      hitRate: `${hitRate}%`,
      isConnected: this.isRedisConnected,
    };
  }

  // === Cached Query Helpers ===

  /**
   * Cached findMany for Institution
   */
  async cachedInstitutionFindMany(args?: any) {
    return this.cachedQuery('institution', 'findMany', args, () =>
      this.institution.findMany(args)
    );
  }

  /**
   * Cached findUnique for Institution
   */
  async cachedInstitutionFindUnique(args: { where: { id: string } }) {
    return this.cachedQuery('institution', 'findUnique', args, () =>
      this.institution.findUnique(args)
    );
  }

  /**
   * Cached findMany for Industry
   */
  async cachedIndustryFindMany(args?: any) {
    return this.cachedQuery('industry', 'findMany', args, () =>
      this.industry.findMany(args)
    );
  }

  /**
   * Cached findMany for Student
   */
  async cachedStudentFindMany(args?: any) {
    return this.cachedQuery('student', 'findMany', args, () =>
      this.student.findMany(args)
    );
  }

  /**
   * Cached findMany for Internship
   */
  async cachedInternshipFindMany(args?: any) {
    return this.cachedQuery('internship', 'findMany', args, () =>
      this.internship.findMany(args)
    );
  }

  /**
   * Cached findMany for User
   */
  async cachedUserFindMany(args?: any) {
    return this.cachedQuery('user', 'findMany', args, () =>
      this.user.findMany(args)
    );
  }

  /**
   * Cached findUnique for User
   */
  async cachedUserFindUnique(args: { where: any; include?: any; select?: any }) {
    return this.cachedQuery('user', 'findUnique', args, () =>
      this.user.findUnique(args)
    );
  }

  // === Write operations with cache invalidation ===

  /**
   * Create with cache invalidation
   */
  async createWithInvalidation<T>(
    model: ModelName,
    createFn: () => Promise<T>,
  ): Promise<T> {
    const result = await createFn();
    await this.invalidateModel(model);
    return result;
  }

  /**
   * Update with cache invalidation
   */
  async updateWithInvalidation<T>(
    model: ModelName,
    updateFn: () => Promise<T>,
  ): Promise<T> {
    const result = await updateFn();
    await this.invalidateModel(model);
    return result;
  }

  /**
   * Delete with cache invalidation
   */
  async deleteWithInvalidation<T>(
    model: ModelName,
    deleteFn: () => Promise<T>,
  ): Promise<T> {
    const result = await deleteFn();
    await this.invalidateModel(model);
    return result;
  }
}
