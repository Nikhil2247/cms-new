import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // ms

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'event', level: 'error' },
              { emit: 'event', level: 'warn' },
            ]
          : [{ emit: 'event', level: 'error' }],
      // Connection pool configuration for MongoDB
      // Uses DATABASE_URL with connection pool parameters
      // Recommended: ?maxPoolSize=20&minPoolSize=5&maxIdleTimeMS=30000
    });

    // Log queries in development mode
    if (process.env.NODE_ENV === 'development') {
      (this.$on as any)('query', (e: Prisma.QueryEvent) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    // Always log errors
    (this.$on as any)('error', (e: Prisma.LogEvent) => {
      this.logger.error(`Prisma Error: ${e.message}`);
    });

    (this.$on as any)('warn', (e: Prisma.LogEvent) => {
      this.logger.warn(`Prisma Warning: ${e.message}`);
    });
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  /**
   * Connect to database with retry logic
   */
  private async connectWithRetry(attempt = 1): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error(
        `Failed to connect to database (attempt ${attempt}/${this.maxRetries}): ${error.message}`,
      );

      if (attempt < this.maxRetries) {
        this.logger.log(`Retrying in ${this.retryDelay}ms...`);
        await this.delay(this.retryDelay * attempt); // Exponential backoff
        return this.connectWithRetry(attempt + 1);
      }

      throw new Error(
        `Failed to connect to database after ${this.maxRetries} attempts: ${error.message}`,
      );
    }
  }

  /**
   * Helper to create a delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Health check for database connection
   */
  async isHealthy(): Promise<boolean> {
    try {
      // PostgreSQL health check - simple query
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute a transaction with automatic retry on transient errors
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Check if error is retryable (connection issues, timeouts)
        const isRetryable =
          error.code === 'P2024' || // Connection pool timeout
          error.code === 'P2028' || // Transaction API error
          error.message?.includes('connection') ||
          error.message?.includes('timeout');

        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }

        this.logger.warn(
          `Database operation failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying...`,
        );
        await this.delay(this.retryDelay * attempt);
      }
    }

    throw lastError;
  }
}
