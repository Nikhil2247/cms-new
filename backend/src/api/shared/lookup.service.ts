import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class LookupService {
  private readonly logger = new Logger(LookupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all active institutions
   */
  async getInstitutions() {
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
  }

  /**
   * Get batches, optionally filtered by institution
   */
  async getBatches(institutionId?: string) {
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
  }

  /**
   * Get all approved industries
   */
  async getIndustries() {
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
  }

  /**
   * Get departments, optionally filtered by institution
   */
  async getDepartments(institutionId?: string) {
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
  }

  /**
   * Get semesters, optionally filtered by institution
   */
  async getSemesters(institutionId?: string) {
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
  }

  /**
   * Get available user roles
   */
  async getRoles() {
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
  }
}
