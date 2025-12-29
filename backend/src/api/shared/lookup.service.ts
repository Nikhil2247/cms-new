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
   * Get institutions (cached)
   * @param includeInactive - If true, includes inactive institutions (useful for reports)
   */
  async getInstitutions(includeInactive = false) {
    const cacheKey = includeInactive ? 'lookup:institutions:all' : 'lookup:institutions:active';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        try {
          const where = includeInactive ? {} : { isActive: true };

          const institutions = await this.prisma.institution.findMany({
            where,
            select: {
              id: true,
              name: true,
              code: true,
              shortName: true,
              type: true,
              city: true,
              state: true,
              isActive: true,
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
   * Get all batches (global data used by all institutions)
   */
  async getBatches() {
    const cacheKey = 'lookup:batches:all';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        try {
          const batches = await this.prisma.batch.findMany({
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              isActive: true,
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
   * Get all departments (global data used by all institutions)
   */
  async getDepartments() {
    const cacheKey = 'lookup:departments:all';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        try {
          const departments = await this.prisma.department.findMany({
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              shortName: true,
              code: true,
              isActive: true,
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
   * Get all branches (global data used by all institutions)
   */
  async getBranches() {
    const cacheKey = 'lookup:branches:all';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        try {
          const branches = await this.prisma.branch.findMany({
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              shortName: true,
              code: true,
              duration: true,
              isActive: true,
            },
            orderBy: { name: 'asc' },
          });

          return {
            branches,
            total: branches.length,
          };
        } catch (error) {
          this.logger.error('Failed to get branches', error.stack);
          throw error;
        }
      },
      { ttl: CACHE_TTL.DEPARTMENTS, tags: ['lookup', 'branches'] },
    );
  }

  /**
   * Invalidate all lookup caches - call when data changes
   */
  async invalidateLookupCache(type?: 'institutions' | 'batches' | 'industries' | 'departments' | 'semesters' | 'branches') {
    if (type) {
      await this.cache.invalidateByTags([type]);
    } else {
      await this.cache.invalidateByTags(['lookup']);
    }
  }

  // ==========================================
  // CRUD Operations
  // ==========================================

  // Batch CRUD
  async createBatch(data: { name: string }) {
    try {
      const batch = await this.prisma.batch.create({
        data: {
          name: data.name,
          isActive: true,
        },
      });
      await this.invalidateLookupCache('batches');
      return { success: true, batch };
    } catch (error) {
      this.logger.error('Failed to create batch', error.stack);
      throw error;
    }
  }

  async updateBatch(id: string, data: { name?: string; isActive?: boolean }) {
    try {
      const batch = await this.prisma.batch.update({
        where: { id },
        data,
      });
      await this.invalidateLookupCache('batches');
      return { success: true, batch };
    } catch (error) {
      this.logger.error('Failed to update batch', error.stack);
      throw error;
    }
  }

  async deleteBatch(id: string) {
    try {
      // Soft delete by setting isActive to false
      await this.prisma.batch.update({
        where: { id },
        data: { isActive: false },
      });
      await this.invalidateLookupCache('batches');
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to delete batch', error.stack);
      throw error;
    }
  }

  // Department CRUD
  async createDepartment(data: { name: string; shortName?: string; code: string }) {
    try {
      const department = await this.prisma.department.create({
        data: {
          name: data.name,
          shortName: data.shortName,
          code: data.code,
          isActive: true,
        },
      });
      await this.invalidateLookupCache('departments');
      return { success: true, department };
    } catch (error) {
      this.logger.error('Failed to create department', error.stack);
      throw error;
    }
  }

  async updateDepartment(id: string, data: { name?: string; shortName?: string; code?: string; isActive?: boolean }) {
    try {
      const department = await this.prisma.department.update({
        where: { id },
        data,
      });
      await this.invalidateLookupCache('departments');
      return { success: true, department };
    } catch (error) {
      this.logger.error('Failed to update department', error.stack);
      throw error;
    }
  }

  async deleteDepartment(id: string) {
    try {
      await this.prisma.department.update({
        where: { id },
        data: { isActive: false },
      });
      await this.invalidateLookupCache('departments');
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to delete department', error.stack);
      throw error;
    }
  }

  // Branch CRUD
  async createBranch(data: { name: string; shortName: string; code: string; duration: number }) {
    try {
      const branch = await this.prisma.branch.create({
        data: {
          name: data.name,
          shortName: data.shortName,
          code: data.code,
          duration: data.duration,
          isActive: true,
        },
      });
      await this.invalidateLookupCache('branches');
      return { success: true, branch };
    } catch (error) {
      this.logger.error('Failed to create branch', error.stack);
      throw error;
    }
  }

  async updateBranch(id: string, data: { name?: string; shortName?: string; code?: string; duration?: number; isActive?: boolean }) {
    try {
      const branch = await this.prisma.branch.update({
        where: { id },
        data,
      });
      await this.invalidateLookupCache('branches');
      return { success: true, branch };
    } catch (error) {
      this.logger.error('Failed to update branch', error.stack);
      throw error;
    }
  }

  async deleteBranch(id: string) {
    try {
      await this.prisma.branch.update({
        where: { id },
        data: { isActive: false },
      });
      await this.invalidateLookupCache('branches');
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to delete branch', error.stack);
      throw error;
    }
  }
}
