import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../core/database/prisma.service';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import Redis from 'ioredis';

export interface ServiceHealth {
  status: 'up' | 'down';
  responseTime?: number;
  details?: Record<string, any>;
  error?: string;
  platform?: string;
  version?: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  services: {
    mongodb: ServiceHealth;
    redis: ServiceHealth;
    minio: ServiceHealth;
    system: ServiceHealth;
  };
  system: {
    uptime: number;
    version: string;
    nodeVersion: string;
    environment: string;
    startTime: Date;
    platform: string;
    arch: string;
    hostname: string;
  };
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    model: string;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  database: {
    activeConnections: number;
    totalCollections: number;
    totalDocuments: number;
    totalUsers: number;
    totalStudents: number;
    totalInstitutions: number;
  };
  sessions: {
    active: number;
    last24h: number;
  };
  application: {
    uptime: number;
    pid: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
  timestamp: Date;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly startTime = new Date();
  private redisClient: Redis | null = null;
  private lastCpuUsage: { idle: number; total: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.initRedisClient();
  }

  private initRedisClient() {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL');
      const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
      const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
      const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

      if (redisUrl) {
        this.redisClient = new Redis(redisUrl, {
          connectTimeout: 3000,
          commandTimeout: 3000,
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        });
      } else {
        this.redisClient = new Redis({
          host: redisHost,
          port: redisPort,
          password: redisPassword || undefined,
          connectTimeout: 3000,
          commandTimeout: 3000,
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        });
      }

      this.redisClient.on('error', (err) => {
        this.logger.debug(`Redis connection error: ${err.message}`);
      });
    } catch (error) {
      this.logger.warn('Failed to initialize Redis client for metrics', error);
    }
  }

  async getDetailedHealth(): Promise<SystemHealth> {
    const [mongodb, redis, minio] = await Promise.all([
      this.checkMongoHealth(),
      this.checkRedisHealth(),
      this.checkMinioHealth(),
    ]);

    // Create system service status
    const systemService: ServiceHealth = {
      status: 'up',
      responseTime: 0,
      platform: `${os.platform()} ${os.release()}`,
      version: process.version,
      details: {
        arch: os.arch(),
        hostname: os.hostname(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg(),
      },
    };

    const allUp = mongodb.status === 'up' && redis.status === 'up' && minio.status === 'up';
    const allDown = mongodb.status === 'down' && redis.status === 'down' && minio.status === 'down';

    return {
      status: allUp ? 'healthy' : allDown ? 'unhealthy' : 'degraded',
      uptime: process.uptime(),
      services: {
        mongodb,
        redis,
        minio,
        system: systemService,
      },
      system: {
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        nodeVersion: process.version,
        environment: this.configService.get('NODE_ENV', 'development'),
        startTime: this.startTime,
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
      },
    };
  }

  async getRealtimeMetrics(): Promise<SystemMetrics> {
    const [cpu, memory, disk, database, sessions] = await Promise.all([
      this.getCpuMetrics(),
      this.getMemoryMetrics(),
      this.getDiskMetrics(),
      this.getDatabaseMetrics(),
      this.getSessionMetrics(),
    ]);

    return {
      cpu,
      memory,
      disk,
      database,
      sessions,
      application: {
        uptime: process.uptime(),
        pid: process.pid,
        memoryUsage: process.memoryUsage(),
      },
      timestamp: new Date(),
    };
  }

  private async checkMongoHealth(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      await this.prisma.$runCommandRaw({ ping: 1 });
      return {
        status: 'up',
        responseTime: Date.now() - start,
        details: { connected: true },
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        error: error.message,
      };
    }
  }

  private async checkRedisHealth(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      if (!this.redisClient) {
        return { status: 'down', error: 'Redis client not initialized' };
      }

      // Connect if not connected
      if (this.redisClient.status !== 'ready') {
        await this.redisClient.connect().catch(() => {});
      }

      await this.redisClient.ping();
      const info = await this.redisClient.info('memory');
      const usedMemory = info.match(/used_memory:(\d+)/)?.[1];
      const maxMemory = info.match(/maxmemory:(\d+)/)?.[1];

      return {
        status: 'up',
        responseTime: Date.now() - start,
        details: {
          connected: true,
          memoryUsed: usedMemory ? parseInt(usedMemory) : undefined,
          maxMemory: maxMemory ? parseInt(maxMemory) : undefined,
        },
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        error: error.message,
      };
    }
  }

  private async checkMinioHealth(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      // MINIO_ENDPOINT contains full URL like http://localhost:9000
      let minioEndpoint = this.configService.get<string>('MINIO_ENDPOINT', 'http://localhost:9000');

      // Ensure it has protocol
      if (!minioEndpoint.startsWith('http://') && !minioEndpoint.startsWith('https://')) {
        minioEndpoint = `http://${minioEndpoint}`;
      }

      // Remove trailing slash
      minioEndpoint = minioEndpoint.replace(/\/$/, '');

      const healthUrl = `${minioEndpoint}/minio/health/live`;
      this.logger.debug(`Checking MinIO health at: ${healthUrl}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        return {
          status: response.ok ? 'up' : 'down',
          responseTime: Date.now() - start,
          details: {
            httpStatus: response.status,
            endpoint: minioEndpoint,
          },
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        error: error.message,
        details: {
          endpoint: this.configService.get<string>('MINIO_ENDPOINT', 'http://localhost:9000'),
        },
      };
    }
  }

  private async getCpuMetrics() {
    const cpus = os.cpus();
    const loadAverage = os.loadavg();

    // Calculate CPU usage more accurately by comparing with previous measurement
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    let usage = 0;
    if (this.lastCpuUsage) {
      const idleDiff = totalIdle - this.lastCpuUsage.idle;
      const totalDiff = totalTick - this.lastCpuUsage.total;
      usage = totalDiff > 0 ? ((1 - idleDiff / totalDiff) * 100) : 0;
    } else {
      // First reading - use load average as approximation
      usage = (loadAverage[0] / cpus.length) * 100;
    }

    this.lastCpuUsage = { idle: totalIdle, total: totalTick };

    return {
      usage: Math.min(100, Math.max(0, Math.round(usage * 100) / 100)),
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      loadAverage,
    };
  }

  private async getMemoryMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const { heapUsed, heapTotal, external } = process.memoryUsage();

    return {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      usagePercent: Math.round((usedMem / totalMem) * 10000) / 100,
      heapUsed,
      heapTotal,
      external,
    };
  }

  private async getDiskMetrics() {
    try {
      // Try to get disk usage for the current working directory
      const diskPath = process.platform === 'win32' ? process.cwd().split(path.sep)[0] + path.sep : '/';

      if (process.platform === 'win32') {
        // Windows: Use wmic command
        const { execSync } = require('child_process');
        try {
          const drive = process.cwd().charAt(0).toUpperCase();
          const output = execSync(`wmic logicaldisk where "DeviceID='${drive}:'" get FreeSpace,Size /format:csv`, { encoding: 'utf-8' });
          const lines = output.trim().split('\n').filter(line => line.trim());
          if (lines.length >= 2) {
            const values = lines[1].split(',');
            const freeSpace = parseInt(values[1]) || 0;
            const totalSize = parseInt(values[2]) || 0;
            const usedSpace = totalSize - freeSpace;
            return {
              total: totalSize,
              used: usedSpace,
              free: freeSpace,
              usagePercent: totalSize > 0 ? Math.round((usedSpace / totalSize) * 10000) / 100 : 0,
            };
          }
        } catch (e) {
          this.logger.debug('Failed to get Windows disk metrics:', e.message);
        }
      } else {
        // Linux/Mac: Use df command
        const { execSync } = require('child_process');
        try {
          const output = execSync(`df -B1 ${diskPath} | tail -1`, { encoding: 'utf-8' });
          const parts = output.trim().split(/\s+/);
          if (parts.length >= 4) {
            const total = parseInt(parts[1]) || 0;
            const used = parseInt(parts[2]) || 0;
            const free = parseInt(parts[3]) || 0;
            return {
              total,
              used,
              free,
              usagePercent: total > 0 ? Math.round((used / total) * 10000) / 100 : 0,
            };
          }
        } catch (e) {
          this.logger.debug('Failed to get Linux disk metrics:', e.message);
        }
      }
    } catch (error) {
      this.logger.debug('Failed to get disk metrics', error.message);
    }

    // Fallback: return zeros
    return {
      total: 0,
      used: 0,
      free: 0,
      usagePercent: 0,
    };
  }

  private async getDatabaseMetrics() {
    try {
      // Get collection stats
      const collections = await this.prisma.$runCommandRaw({
        listCollections: 1,
      }) as any;

      const collectionCount = collections?.cursor?.firstBatch?.length || 0;

      // Get counts from key collections
      const [userCount, studentCount, institutionCount, internshipCount] = await Promise.all([
        this.prisma.user.count().catch(() => 0),
        this.prisma.student.count().catch(() => 0),
        this.prisma.institution.count().catch(() => 0),
        this.prisma.internship.count().catch(() => 0),
      ]);

      return {
        activeConnections: 1, // Prisma manages connection pool
        totalCollections: collectionCount,
        totalDocuments: userCount + studentCount + internshipCount,
        totalUsers: userCount,
        totalStudents: studentCount,
        totalInstitutions: institutionCount,
      };
    } catch (error) {
      this.logger.warn('Failed to get database metrics', error);
      return {
        activeConnections: 0,
        totalCollections: 0,
        totalDocuments: 0,
        totalUsers: 0,
        totalStudents: 0,
        totalInstitutions: 0,
      };
    }
  }

  private async getSessionMetrics() {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [activeCount, last24hCount] = await Promise.all([
        this.prisma.userSession.count({
          where: {
            invalidatedAt: null,
            expiresAt: { gt: now },
          },
        }).catch(() => 0),
        this.prisma.userSession.count({
          where: {
            createdAt: { gte: last24h },
          },
        }).catch(() => 0),
      ]);

      return {
        active: activeCount,
        last24h: last24hCount,
      };
    } catch (error) {
      this.logger.debug('Failed to get session metrics', error.message);
      return {
        active: 0,
        last24h: 0,
      };
    }
  }

  // Get quick summary for WebSocket updates
  async getQuickMetrics() {
    const [cpu, memory] = await Promise.all([
      this.getCpuMetrics(),
      this.getMemoryMetrics(),
    ]);

    return {
      cpu: cpu.usage,
      memory: memory.usagePercent,
      uptime: process.uptime(),
      timestamp: new Date(),
    };
  }
}
