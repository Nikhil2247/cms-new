import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

export interface CreateApplicationDto {
  coverLetter?: string;
  resume?: string;
  additionalInfo?: string;
}

export interface UpdateApplicationStatusDto {
  status: 'PENDING' | 'SHORTLISTED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | ApplicationStatus;
  remarks?: string;
}

@Injectable()
export class InternshipApplicationService {
  private readonly logger = new Logger(InternshipApplicationService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private mapLegacyStatus(status: UpdateApplicationStatusDto['status']): ApplicationStatus {
    if (typeof status !== 'string') return status;

    switch (status) {
      case 'PENDING':
        return ApplicationStatus.APPLIED;
      case 'SHORTLISTED':
        return ApplicationStatus.SHORTLISTED;
      case 'ACCEPTED':
        return ApplicationStatus.SELECTED;
      case 'REJECTED':
        return ApplicationStatus.REJECTED;
      case 'WITHDRAWN':
        return ApplicationStatus.WITHDRAWN;
      default:
        return status as ApplicationStatus;
    }
  }

  async createApplication(
    studentId: string,
    internshipId: string,
    data: CreateApplicationDto,
  ) {
    try {
      this.logger.log(`Creating application for student ${studentId} to internship ${internshipId}`);

      // Check if student exists
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
      });

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      // Check if internship exists
      const internship = await this.prisma.internship.findUnique({
        where: { id: internshipId },
      });

      if (!internship) {
        throw new NotFoundException('Internship not found');
      }

      // Check if already applied
      const existingApplication = await this.prisma.internshipApplication.findFirst({
        where: {
          studentId,
          internshipId,
        },
      });

      if (existingApplication) {
        throw new BadRequestException('Already applied to this internship');
      }

      const application = await this.prisma.internshipApplication.create({
        data: {
          studentId,
          internshipId,
          coverLetter: data.coverLetter,
          resume: data.resume,
          additionalInfo: data.additionalInfo,
          status: ApplicationStatus.APPLIED,
        },
        include: {
          student: {
            include: {
              user: true,
              Institution: true,
            },
          },
          internship: {
            include: {
              industry: true,
            },
          },
        },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`applications:student:${studentId}`),
        this.cache.del(`applications:internship:${internshipId}`),
      ]);

      return application;
    } catch (error) {
      this.logger.error(`Failed to create application: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getApplicationsByStudent(studentId: string) {
    try {
      const cacheKey = `applications:student:${studentId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.internshipApplication.findMany({
            where: { studentId },
            include: {
              internship: {
                include: {
                  industry: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get applications for student ${studentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getApplicationsByInternship(internshipId: string) {
    try {
      const cacheKey = `applications:internship:${internshipId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.internshipApplication.findMany({
            where: { internshipId },
            include: {
              student: {
                include: {
                  user: true,
                  Institution: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get applications for internship ${internshipId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateApplicationStatus(
    id: string,
    status: UpdateApplicationStatusDto['status'],
    remarks?: string,
  ) {
    try {
      this.logger.log(`Updating application ${id} status to ${status}`);

      const application = await this.prisma.internshipApplication.findUnique({
        where: { id },
      });

      if (!application) {
        throw new NotFoundException('Application not found');
      }

      const updated = await this.prisma.internshipApplication.update({
        where: { id },
        data: {
          status: this.mapLegacyStatus(status),
          reviewRemarks: remarks,
          reviewedAt: new Date(),
        },
        include: {
          student: {
            include: {
              user: true,
              Institution: true,
            },
          },
          internship: {
            include: {
              industry: true,
            },
          },
        },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`applications:student:${application.studentId}`),
        this.cache.del(`applications:internship:${application.internshipId}`),
      ]);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update application status: ${error.message}`, error.stack);
      throw error;
    }
  }

  async withdrawApplication(id: string) {
    try {
      this.logger.log(`Withdrawing application ${id}`);

      const application = await this.prisma.internshipApplication.findUnique({
        where: { id },
      });

      if (!application) {
        throw new NotFoundException('Application not found');
      }

      if (
        application.status !== ApplicationStatus.APPLIED &&
        application.status !== ApplicationStatus.UNDER_REVIEW
      ) {
        throw new BadRequestException('Can only withdraw active applications');
      }

      const withdrawn = await this.prisma.internshipApplication.update({
        where: { id },
        data: {
          status: ApplicationStatus.WITHDRAWN,
        },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`applications:student:${application.studentId}`),
        this.cache.del(`applications:internship:${application.internshipId}`),
      ]);

      return withdrawn;
    } catch (error) {
      this.logger.error(`Failed to withdraw application: ${error.message}`, error.stack);
      throw error;
    }
  }
}
