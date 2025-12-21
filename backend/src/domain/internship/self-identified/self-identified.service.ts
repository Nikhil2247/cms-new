import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

export interface SubmitSelfIdentifiedDto {
  companyName: string;
  companyAddress: string;
  companyEmail?: string;
  companyPhone?: string;
  role: string;
  stipend?: number;
  startDate: Date;
  endDate: Date;
  mentorName?: string;
  mentorDesignation?: string;
  description?: string;
  supportingDocuments?: string[];
}

@Injectable()
export class SelfIdentifiedService {
  private readonly logger = new Logger(SelfIdentifiedService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async submitSelfIdentified(studentId: string, data: SubmitSelfIdentifiedDto) {
    try {
      this.logger.log(`Submitting self-identified internship for student ${studentId}`);

      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
      });

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      const selfIdentified = await this.prisma.internshipApplication.create({
        data: {
          studentId,
          internshipId: null,
          isSelfIdentified: true,
          companyName: data.companyName,
          companyAddress: data.companyAddress,
          companyEmail: data.companyEmail,
          companyContact: data.companyPhone,
          jobProfile: data.role,
          stipend: data.stipend !== undefined ? String(data.stipend) : null,
          startDate: data.startDate,
          endDate: data.endDate,
          additionalInfo: data.description,
          facultyMentorName: data.mentorName,
          facultyMentorDesignation: data.mentorDesignation,
          status: ApplicationStatus.APPLIED,
        },
        include: {
          student: {
            include: {
              user: true,
              Institution: true,
            },
          },
        },
      });

      // Invalidate cache
      await this.cache.del(`self-identified:student:${studentId}`);

      return selfIdentified;
    } catch (error) {
      this.logger.error(`Failed to submit self-identified internship: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getSelfIdentifiedByStudent(studentId: string) {
    try {
      const cacheKey = `self-identified:student:${studentId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.internshipApplication.findMany({
            where: { studentId, isSelfIdentified: true },
            include: {
              mentor: true,
            },
            orderBy: { createdAt: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get self-identified internships for student ${studentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async approveSelfIdentified(id: string, mentorId: string, remarks?: string) {
    try {
      this.logger.log(`Approving self-identified internship ${id} by mentor ${mentorId}`);

      const selfIdentified = await this.prisma.internshipApplication.findUnique({
        where: { id },
      });

      if (!selfIdentified) {
        throw new NotFoundException('Self-identified internship not found');
      }

      if (!selfIdentified.isSelfIdentified) {
        throw new BadRequestException('Not a self-identified internship');
      }

      if (selfIdentified.status !== ApplicationStatus.APPLIED) {
        throw new BadRequestException('Can only approve pending self-identified internships');
      }

      const approved = await this.prisma.internshipApplication.update({
        where: { id },
        data: {
          status: ApplicationStatus.APPROVED,
          mentorId,
          reviewedBy: mentorId,
          reviewedAt: new Date(),
          reviewRemarks: remarks,
        },
        include: {
          student: true,
          mentor: true,
        },
      });

      // Invalidate cache
      await this.cache.del(`self-identified:student:${selfIdentified.studentId}`);

      return approved;
    } catch (error) {
      this.logger.error(`Failed to approve self-identified internship: ${error.message}`, error.stack);
      throw error;
    }
  }

  async rejectSelfIdentified(id: string, mentorId: string, reason: string) {
    try {
      this.logger.log(`Rejecting self-identified internship ${id} by mentor ${mentorId}`);

      const selfIdentified = await this.prisma.internshipApplication.findUnique({
        where: { id },
      });

      if (!selfIdentified) {
        throw new NotFoundException('Self-identified internship not found');
      }

      if (!selfIdentified.isSelfIdentified) {
        throw new BadRequestException('Not a self-identified internship');
      }

      if (selfIdentified.status !== ApplicationStatus.APPLIED) {
        throw new BadRequestException('Can only reject pending self-identified internships');
      }

      const rejected = await this.prisma.internshipApplication.update({
        where: { id },
        data: {
          status: ApplicationStatus.REJECTED,
          reviewedBy: mentorId,
          reviewedAt: new Date(),
          reviewRemarks: reason,
        },
        include: {
          student: true,
          mentor: true,
        },
      });

      // Invalidate cache
      await this.cache.del(`self-identified:student:${selfIdentified.studentId}`);

      return rejected;
    } catch (error) {
      this.logger.error(`Failed to reject self-identified internship: ${error.message}`, error.stack);
      throw error;
    }
  }
}
