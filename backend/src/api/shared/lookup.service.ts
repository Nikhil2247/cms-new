import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { LruCacheService } from '../../core/cache/lru-cache.service';

// Cache TTLs in milliseconds
const CACHE_TTL = {
  INSTITUTIONS: 10 * 60 * 1000, // 10 minutes
  BATCHES: 10 * 60 * 1000, // 10 minutes
  INDUSTRIES: 15 * 60 * 1000, // 15 minutes
  DEPARTMENTS: 10 * 60 * 1000, // 10 minutes
  SEMESTERS: 10 * 60 * 1000, // 10 minutes
  ROLES: 60 * 60 * 1000, // 1 hour (static data)
};

@Injectable()
export class LookupService {
  private readonly logger = new Logger(LookupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
  ) {}

  /**
   * Get all active institutions (cached)
   */
  async getInstitutions() {
    const cacheKey = 'lookup:institutions';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        try {
          const institutions = await this.prisma.institution.findMany({
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              code: true,
              shortName: true,
              type: true,
              city: true,
              state: true,
            },
            orderBy: { name: 'asc' },
          });

          return {
            institutions,
            total: institutions.length,
          };
        } catch (error) {
          this.logger.error('Failed to get institutions', error.stack);
          throw error;
        }
      },
      { ttl: CACHE_TTL.INSTITUTIONS, tags: ['lookup', 'institutions'] },
    );
  }

  /**
   * Get batches, optionally filtered by institution (cached)
   */
  async getBatches(institutionId?: string) {
    const cacheKey = institutionId
      ? `lookup:batches:${institutionId}`
      : 'lookup:batches:all';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        try {
          const where: any = { isActive: true };

          if (institutionId) {
            where.institutionId = institutionId;
          }

          const batches = await this.prisma.batch.findMany({
            where,
            select: {
              id: true,
              name: true,
              isActive: true,
              institutionId: true,
              createdAt: true,
            },
            orderBy: { name: 'desc' },
          });

          return {
            batches,
            total: batches.length,
          };
        } catch (error) {
          this.logger.error('Failed to get batches', error.stack);
          throw error;
        }
      },
      { ttl: CACHE_TTL.BATCHES, tags: ['lookup', 'batches'] },
    );
  }

  /**
   * Get all approved industries (cached)
   */
  async getIndustries() {
    const cacheKey = 'lookup:industries';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        try {
          const industries = await this.prisma.industry.findMany({
            where: {
              isApproved: true,
              isVerified: true,
            },
            select: {
              id: true,
              companyName: true,
              industryType: true,
              city: true,
              state: true,
              companySize: true,
              website: true,
            },
            orderBy: { companyName: 'asc' },
          });

          return {
            industries,
            total: industries.length,
          };
        } catch (error) {
          this.logger.error('Failed to get industries', error.stack);
          throw error;
        }
      },
      { ttl: CACHE_TTL.INDUSTRIES, tags: ['lookup', 'industries'] },
    );
  }

  /**
   * Get departments, optionally filtered by institution (cached)
   */
  async getDepartments(institutionId?: string) {
    const cacheKey = institutionId
      ? `lookup:departments:${institutionId}`
      : 'lookup:departments:all';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        try {
          const where: any = { isActive: true };

          if (institutionId) {
            where.institutionId = institutionId;
          }

          const departments = await this.prisma.department.findMany({
            where,
            select: {
              id: true,
              name: true,
              shortName: true,
              code: true,
              institutionId: true,
            },
            orderBy: { name: 'asc' },
          });

          return {
            departments,
            total: departments.length,
          };
        } catch (error) {
          this.logger.error('Failed to get departments', error.stack);
          throw error;
        }
      },
      { ttl: CACHE_TTL.DEPARTMENTS, tags: ['lookup', 'departments'] },
    );
  }

  /**
   * Get semesters, optionally filtered by institution (cached)
   */
  async getSemesters(institutionId?: string) {
    const cacheKey = institutionId
      ? `lookup:semesters:${institutionId}`
      : 'lookup:semesters:all';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        try {
          const where: any = { isActive: true };

          if (institutionId) {
            where.institutionId = institutionId;
          }

          const semesters = await this.prisma.semester.findMany({
            where,
            select: {
              id: true,
              number: true,
              isActive: true,
              institutionId: true,
            },
            orderBy: { number: 'asc' },
          });

          return {
            semesters,
            total: semesters.length,
          };
        } catch (error) {
          this.logger.error('Failed to get semesters', error.stack);
          throw error;
        }
      },
      { ttl: CACHE_TTL.SEMESTERS, tags: ['lookup', 'semesters'] },
    );
  }

  /**
   * Get available user roles (cached - static data)
   */
  async getRoles() {
    const cacheKey = 'lookup:roles';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        return {
          roles: [
            { value: 'STUDENT', label: 'Student' },
            { value: 'FACULTY', label: 'Faculty' },
            { value: 'COORDINATOR', label: 'Coordinator' },
            { value: 'PRINCIPAL', label: 'Principal' },
            { value: 'ADMIN', label: 'Admin' },
            { value: 'INDUSTRY', label: 'Industry Partner' },
            { value: 'SUPERVISOR', label: 'Supervisor' },
            { value: 'SYSTEM_ADMIN', label: 'System Administrator' },
            { value: 'STATE_DIRECTORATE', label: 'State Directorate' },
          ],
        };
      },
      { ttl: CACHE_TTL.ROLES, tags: ['lookup', 'roles'] },
    );
  }

  /**
   * Invalidate all lookup caches - call when data changes
   */
  async invalidateLookupCache(type?: 'institutions' | 'batches' | 'industries' | 'departments' | 'semesters') {
    if (type) {
      await this.cache.invalidateByTags([type]);
    } else {
      await this.cache.invalidateByTags(['lookup']);
    }
  }
}
