import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HttpHealthIndicator,
  HealthCheck,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HealthCheckError,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  private async prismaPing(): Promise<HealthIndicatorResult> {
    try {
      // MongoDB ping via Prisma
      await this.prisma.$runCommandRaw({ ping: 1 } as any);
      return { database: { status: 'up' as const } };
    } catch (error) {
      throw new HealthCheckError('Database check failed', {
        database: { status: 'down' as const },
      });
    }
  }

  /**
   * Basic health check
   */
  @Get()
  @HealthCheck()
  async check() {
    return this.health.check([
      () => this.prismaPing(),
    ]);
  }

  /**
   * Database health check
   */
  @Get('db')
  @HealthCheck()
  async checkDatabase() {
    return this.health.check([
      () => this.prismaPing(),
    ]);
  }

  /**
   * Redis health check
   */
  @Get('redis')
  @HealthCheck()
  async checkRedis() {
    const redisHost = this.configService.get('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get('REDIS_PORT', 6379);

    return this.health.check([
      () =>
        this.http.pingCheck(
          'redis',
          `http://${redisHost}:${redisPort}`,
        ),
    ]);
  }

  /**
   * Detailed health check including memory, disk, database, and Redis
   */
  @Get('detailed')
  @HealthCheck()
  async checkDetailed() {
    const redisHost = this.configService.get('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get('REDIS_PORT', 6379);

    return this.health.check([
      // Database check
      () => this.prismaPing(),

      // Memory heap check (should not exceed 150MB)
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),

      // Memory RSS check (should not exceed 150MB)
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),

      // Disk storage check (should have at least 50% free space)
      () =>
        this.disk.checkStorage('storage', {
          path: '/',
          thresholdPercent: 0.5,
        }),

      // Redis check (commented out as HTTP check might not work for Redis)
      // () =>
      //   this.http.pingCheck(
      //     'redis',
      //     `http://${redisHost}:${redisPort}`,
      //   ),
    ]);
  }

  /**
   * Memory health check
   */
  @Get('memory')
  @HealthCheck()
  async checkMemory() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 200 * 1024 * 1024),
    ]);
  }

  /**
   * Disk health check
   */
  @Get('disk')
  @HealthCheck()
  async checkDisk() {
    return this.health.check([
      () =>
        this.disk.checkStorage('storage', {
          path: '/',
          thresholdPercent: 0.5,
        }),
    ]);
  }

  /**
   * Readiness probe (for Kubernetes)
   */
  @Get('ready')
  @HealthCheck()
  async checkReadiness() {
    return this.health.check([
      () => this.prismaPing(),
    ]);
  }

  /**
   * Liveness probe (for Kubernetes)
   */
  @Get('live')
  @HealthCheck()
  async checkLiveness() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
    ]);
  }
}
