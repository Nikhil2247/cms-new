import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { LruCacheService } from './lru-cache.service';

@Injectable()
export class CacheWarmerService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmerService.name);
  private isWarming = false;

  constructor(
    private prisma: PrismaService,
    private cache: LruCacheService,
  ) {}

  async onModuleInit() {
    // Warm cache 5 seconds after startup
    setTimeout(() => this.warmAll(), 5000);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledWarm() {
    await this.warmAll();
  }

  async warmAll(): Promise<void> {
    if (this.isWarming) {
      this.logger.warn('Cache warming already in progress, skipping');
      return;
    }

    this.isWarming = true;
    this.logger.log('Starting cache warming...');
    const start = Date.now();

    try {
      await Promise.allSettled([
        this.warmInstitutions(),
        this.warmBatches(),
        this.warmDepartments(),
        this.warmDashboardStats(),
        this.warmActiveStudentCounts(),
      ]);

      this.logger.log(`Cache warming completed in ${Date.now() - start}ms`);
    } catch (error) {
      this.logger.error('Cache warming failed', error);
    } finally {
      this.isWarming = false;
    }
  }

  private async warmInstitutions(): Promise<void> {
    const institutions = await this.prisma.institution.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, type: true },
      orderBy: { name: 'asc' },
    });

    await this.cache.set('lookup:institutions', institutions, { ttl: 600000 }); // 10 min
    this.logger.debug(`Warmed ${institutions.length} institutions`);
  }

  private async warmBatches(): Promise<void> {
    const batches = await this.prisma.batch.findMany({
      where: { isActive: true },
      select: { id: true, name: true, institutionId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    await this.cache.set('lookup:batches', batches, { ttl: 600000 });
    this.logger.debug(`Warmed ${batches.length} batches`);
  }

  private async warmDepartments(): Promise<void> {
    const departments = await this.prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, institutionId: true },
      orderBy: { name: 'asc' },
    });

    await this.cache.set('lookup:departments', departments, { ttl: 600000 });
    this.logger.debug(`Warmed ${departments.length} departments`);
  }

  private async warmDashboardStats(): Promise<void> {
    const [institutions, students, industries, internships] = await Promise.all([
      this.prisma.institution.count({ where: { isActive: true } }),
      this.prisma.student.count({ where: { isActive: true } }),
      this.prisma.industry.count({ where: { isApproved: true } }),
      this.prisma.internship.count({ where: { isActive: true } }),
    ]);

    await this.cache.set('stats:global', {
      totalInstitutions: institutions,
      totalStudents: students,
      totalIndustries: industries,
      activeInternships: internships,
      updatedAt: new Date(),
    }, { ttl: 60000 }); // 1 min

    this.logger.debug('Warmed global dashboard stats');
  }

  private async warmActiveStudentCounts(): Promise<void> {
    const counts = await this.prisma.student.groupBy({
      by: ['institutionId'],
      where: { isActive: true },
      _count: true,
    });

    const countMap = counts.reduce((acc, curr) => {
      acc[curr.institutionId] = curr._count;
      return acc;
    }, {} as Record<string, number>);

    await this.cache.set('stats:studentCounts', countMap, { ttl: 60000 });
    this.logger.debug(`Warmed student counts for ${counts.length} institutions`);
  }

  getStatus() {
    return {
      isWarming: this.isWarming,
      cacheMetrics: this.cache.getMetrics(),
    };
  }
}
