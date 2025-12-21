import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { ScholarshipStatus, ScholarshipType } from '@prisma/client';

export interface ApplyScholarshipDto {
  scholarshipType: ScholarshipType;
  amount: number;
}

@Injectable()
export class ScholarshipService {
  private readonly logger = new Logger(ScholarshipService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async applyScholarship(studentId: string, data: ApplyScholarshipDto) {
    try {
      this.logger.log(`Processing scholarship application for student ${studentId}`);

      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
      });

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      if (data.amount <= 0) {
        throw new BadRequestException('Scholarship amount must be greater than 0');
      }

      if (student.scholarshipId) {
        throw new BadRequestException('Student already has a scholarship assigned');
      }

      const scholarship = await this.prisma.scholarship.create({
        data: {
          type: data.scholarshipType,
          amount: data.amount,
          institutionId: student.institutionId ?? undefined,
          status: null,
        },
        include: { Institution: true },
      });

      await this.prisma.student.update({
        where: { id: studentId },
        data: { scholarshipId: scholarship.id },
      });

      // Invalidate cache
      await this.cache.del(`scholarships:student:${studentId}`);

      return scholarship;
    } catch (error) {
      this.logger.error(`Failed to apply for scholarship: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getScholarshipsByStudent(studentId: string) {
    try {
      const cacheKey = `scholarships:student:${studentId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          const scholarships = await this.prisma.scholarship.findMany({
            where: { students: { some: { id: studentId } } },
            include: {
              Institution: true,
              students: { include: { user: true, Institution: true } },
            },
            orderBy: { createdAt: 'desc' },
          });

          const totalApproved = scholarships
            .filter(s => s.status === 'APPROVED')
            .reduce((sum, s) => sum + s.amount, 0);

          const totalPending = scholarships.filter(s => !s.status).length;
          const totalApprovedCount = scholarships.filter(s => s.status === 'APPROVED').length;
          const totalRejected = scholarships.filter(s => s.status === 'REJECTED').length;

          return {
            scholarships,
            statistics: {
              totalApprovedAmount: totalApproved,
              totalPending,
              totalApproved: totalApprovedCount,
              totalRejected,
              total: scholarships.length,
            },
          };
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get scholarships for student ${studentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async approveScholarship(id: string, approvedBy: string) {
    try {
      this.logger.log(`Approving scholarship ${id} by user ${approvedBy}`);

      const scholarship = await this.prisma.scholarship.findUnique({
        where: { id },
      });

      if (!scholarship) {
        throw new NotFoundException('Scholarship not found');
      }

      if (scholarship.status) {
        throw new BadRequestException('Scholarship is already processed');
      }

      const approved = await this.prisma.scholarship.update({
        where: { id },
        data: {
          status: ScholarshipStatus.APPROVED,
        },
        include: {
          Institution: true,
          students: { include: { user: true, Institution: true } },
        },
      });

      // Invalidate cache
      for (const student of approved.students) {
        await this.cache.del(`scholarships:student:${student.id}`);
      }

      return approved;
    } catch (error) {
      this.logger.error(`Failed to approve scholarship: ${error.message}`, error.stack);
      throw error;
    }
  }

  async rejectScholarship(id: string, rejectedBy: string, reason: string) {
    try {
      this.logger.log(`Rejecting scholarship ${id} by user ${rejectedBy}`);

      const scholarship = await this.prisma.scholarship.findUnique({
        where: { id },
      });

      if (!scholarship) {
        throw new NotFoundException('Scholarship not found');
      }

      if (scholarship.status) {
        throw new BadRequestException('Scholarship is already processed');
      }

      const rejected = await this.prisma.scholarship.update({
        where: { id },
        data: {
          status: ScholarshipStatus.REJECTED,
        },
        include: {
          Institution: true,
          students: { include: { user: true, Institution: true } },
        },
      });

      // Invalidate cache
      for (const student of rejected.students) {
        await this.cache.del(`scholarships:student:${student.id}`);
      }

      return rejected;
    } catch (error) {
      this.logger.error(`Failed to reject scholarship: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getScholarshipsByInstitution(institutionId: string) {
    try {
      const cacheKey = `scholarships:institution:${institutionId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.scholarship.findMany({
            where: {
              institutionId,
            },
            include: {
              Institution: true,
              students: { include: { user: true, Institution: true } },
            },
            orderBy: { createdAt: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get scholarships for institution ${institutionId}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
