import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { GrievanceCategory, GrievancePriority, GrievanceStatus } from '@prisma/client';

export interface SubmitGrievanceDto {
  category: GrievanceCategory;
  subject: string;
  description: string;
  priority?: GrievancePriority;
  attachments?: string[];
  isAnonymous?: boolean;
}

export interface RespondToGrievanceDto {
  response: string;
  attachments?: string[];
}

@Injectable()
export class GrievanceService {
  private readonly logger = new Logger(GrievanceService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async submitGrievance(userId: string, data: SubmitGrievanceDto) {
    try {
      this.logger.log(`Submitting grievance for user ${userId}`);

      const student = await this.prisma.student.findUnique({ where: { userId } });
      if (!student) throw new NotFoundException('Student not found');

      const grievance = await this.prisma.grievance.create({
        data: {
          category: data.category,
          title: data.subject,
          description: data.description,
          severity: data.priority || GrievancePriority.MEDIUM,
          attachments: data.attachments || [],
          status: GrievanceStatus.SUBMITTED,
          studentId: student.id,
        },
        include: {
          student: { include: { user: true, Institution: true } },
          assignedTo: true,
          facultySupervisor: true,
          industry: true,
          internship: true,
        },
      });

      // Invalidate cache
      await this.cache.del(`grievances:user:${userId}`);

      return grievance;
    } catch (error) {
      this.logger.error(`Failed to submit grievance: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getGrievancesByUser(userId: string) {
    try {
      const cacheKey = `grievances:user:${userId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.grievance.findMany({
            where: { student: { userId } },
            include: {
              student: { include: { user: true, Institution: true } },
              assignedTo: true,
              facultySupervisor: true,
              industry: true,
              internship: true,
            },
            orderBy: { createdAt: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get grievances for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getGrievancesByInstitution(institutionId: string) {
    try {
      const cacheKey = `grievances:institution:${institutionId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.grievance.findMany({
            where: {
              student: { institutionId },
            },
            include: {
              student: { include: { user: true, Institution: true } },
              assignedTo: true,
              facultySupervisor: true,
              industry: true,
              internship: true,
            },
            orderBy: { createdAt: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get grievances for institution ${institutionId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async respondToGrievance(id: string, responderId: string, response: string) {
    try {
      this.logger.log(`Responding to grievance ${id} by user ${responderId}`);

      const grievance = await this.prisma.grievance.findUnique({
        where: { id },
        include: { student: { select: { userId: true } } },
      });

      if (!grievance) {
        throw new NotFoundException('Grievance not found');
      }

      const responded = await this.prisma.grievance.update({
        where: { id },
        data: {
          status: GrievanceStatus.RESOLVED,
          resolution: response,
          addressedDate: new Date(),
          resolvedDate: new Date(),
          assignedToId: responderId,
        },
        include: {
          student: { include: { user: true, Institution: true } },
          assignedTo: true,
          facultySupervisor: true,
          industry: true,
          internship: true,
        },
      });

      // Invalidate cache
      await this.cache.del(`grievances:user:${responded.student.userId}`);

      return responded;
    } catch (error) {
      this.logger.error(`Failed to respond to grievance: ${error.message}`, error.stack);
      throw error;
    }
  }

  async escalateGrievance(id: string) {
    try {
      this.logger.log(`Escalating grievance ${id}`);

      const grievance = await this.prisma.grievance.findUnique({
        where: { id },
        include: { student: { select: { userId: true } } },
      });

      if (!grievance) {
        throw new NotFoundException('Grievance not found');
      }

      const escalated = await this.prisma.grievance.update({
        where: { id },
        data: {
          status: GrievanceStatus.ESCALATED,
          severity: GrievancePriority.URGENT,
          escalationCount: { increment: 1 },
          escalatedAt: new Date(),
        },
        include: {
          student: { include: { user: true, Institution: true } },
          assignedTo: true,
          facultySupervisor: true,
          industry: true,
          internship: true,
        },
      });

      // Invalidate cache
      await this.cache.del(`grievances:user:${grievance.student.userId}`);

      return escalated;
    } catch (error) {
      this.logger.error(`Failed to escalate grievance: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateGrievanceStatus(id: string, status: string) {
    try {
      this.logger.log(`Updating grievance ${id} status to ${status}`);

      const grievance = await this.prisma.grievance.findUnique({
        where: { id },
        include: { student: { select: { userId: true } } },
      });

      if (!grievance) {
        throw new NotFoundException('Grievance not found');
      }

      const updated = await this.prisma.grievance.update({
        where: { id },
        data: {
          status: status as GrievanceStatus,
        },
      });

      // Invalidate cache
      await this.cache.del(`grievances:user:${grievance.student.userId}`);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update grievance status: ${error.message}`, error.stack);
      throw error;
    }
  }
}
