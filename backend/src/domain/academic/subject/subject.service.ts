import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

export interface CreateSubjectDto {
  subjectName: string;
  subjectCode: string;
  syllabusYear: number;
  semesterNumber?: string;
  branchName?: string;
  maxMarks: number;
  subjectType: string;
}

@Injectable()
export class SubjectService {
  private readonly logger = new Logger(SubjectService.name);
  private readonly CACHE_TTL = 600; // 10 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getSubjectsByBranch(branchId: string) {
    try {
      const cacheKey = `subjects:branch:${branchId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.subject.findMany({
            where: { branchId },
            include: {
              Branch: true,
              Institution: true,
            },
            orderBy: [
              { syllabusYear: 'desc' },
              { subjectName: 'asc' },
            ],
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get subjects for branch ${branchId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async createSubject(data: CreateSubjectDto & { branchId: string }) {
    try {
      this.logger.log(`Creating subject ${data.subjectName} for branch ${data.branchId}`);

      const branch = await this.prisma.branch.findUnique({ where: { id: data.branchId } });

      if (!branch) {
        throw new NotFoundException('Branch not found');
      }

      // Check for duplicate subject code
      const existingSubject = await this.prisma.subject.findFirst({
        where: {
          subjectCode: data.subjectCode,
          branchId: data.branchId,
        },
      });

      if (existingSubject) {
        throw new BadRequestException('Subject with this code already exists for this branch');
      }

      const subject = await this.prisma.subject.create({
        data: {
          syllabusYear: data.syllabusYear,
          semesterNumber: data.semesterNumber,
          branchId: data.branchId,
          branchName: data.branchName ?? branch.name,
          subjectName: data.subjectName,
          subjectCode: data.subjectCode,
          maxMarks: data.maxMarks,
          subjectType: data.subjectType,
        },
        include: {
          Branch: true,
          Institution: true,
        },
      });

      // Invalidate cache
      await this.cache.del(`subjects:branch:${data.branchId}`);

      return subject;
    } catch (error) {
      this.logger.error(`Failed to create subject: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getSubjectsBySemester(semesterId: string) {
    try {
      const cacheKey = `subjects:semester:${semesterId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.subject.findMany({
            where: { semesterNumber: semesterId },
            include: {
              Branch: true,
              Institution: true,
            },
            orderBy: { subjectName: 'asc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get subjects for semester ${semesterId}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
