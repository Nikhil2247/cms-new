import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

export interface SubmitMonthlyFeedbackDto {
  month: number;
  year: number;
  internshipId: string;
  attendanceRating: number;
  punctualityRating: number;
  technicalSkillsRating: number;
  overallRating: number;
  strengths?: string;
  areasOfImprovement?: string;
  comments?: string;
  recommendForFuture?: boolean;
}

@Injectable()
export class MonthlyFeedbackService {
  private readonly logger = new Logger(MonthlyFeedbackService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async submitFeedback(
    industryId: string,
    studentId: string,
    data: SubmitMonthlyFeedbackDto,
  ) {
    try {
      this.logger.log(`Submitting monthly feedback for student ${studentId} by industry ${industryId}`);

      const [industry, student] = await Promise.all([
        this.prisma.industry.findUnique({ where: { id: industryId } }),
        this.prisma.student.findUnique({ where: { id: studentId } }),
      ]);

      if (!industry) {
        throw new NotFoundException('Industry not found');
      }

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      // Validate ratings are between 1-5 (schema supports a subset)
      const ratingFields = [
        'attendanceRating',
        'punctualityRating',
        'technicalSkillsRating',
        'overallRating',
      ];

      for (const field of ratingFields) {
        const value = data[field];
        if (value < 1 || value > 5) {
          throw new BadRequestException(`${field} must be between 1 and 5`);
        }
      }

      const feedbackMonth = new Date(Date.UTC(data.year, data.month - 1, 1));

      // Resolve application (required by schema)
      const application = await this.prisma.internshipApplication.findFirst({
        where: {
          studentId,
          internshipId: data.internshipId,
        },
        select: { id: true },
      });

      if (!application) {
        throw new NotFoundException('Internship application not found for this student');
      }

      // Check for duplicate feedback
      const existingFeedback = await this.prisma.monthlyFeedback.findFirst({
        where: {
          applicationId: application.id,
          feedbackMonth,
        },
      });

      if (existingFeedback) {
        throw new BadRequestException('Feedback for this month already exists');
      }

      const feedback = await this.prisma.monthlyFeedback.create({
        data: {
          applicationId: application.id,
          industryId,
          studentId,
          internshipId: data.internshipId,
          feedbackMonth,

          attendanceRating: data.attendanceRating,
          punctualityRating: data.punctualityRating,
          technicalSkillsRating: data.technicalSkillsRating,
          performanceRating: data.overallRating,
          overallRating: data.overallRating,

          strengths: data.strengths,
          areasForImprovement: data.areasOfImprovement,
          overallComments: data.comments,

          // Schema requires submittedBy (industry user). If caller passes industry user id here, it works.
          submittedBy: industryId,
        },
        include: {
          industry: true,
          student: {
            include: {
              user: true,
            },
          },
        },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`feedback:student:${studentId}`),
        this.cache.del(`feedback:industry:${industryId}`),
      ]);

      return feedback;
    } catch (error) {
      this.logger.error(`Failed to submit monthly feedback: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getFeedbackByStudent(studentId: string) {
    try {
      const cacheKey = `feedback:student:${studentId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.monthlyFeedback.findMany({
            where: { studentId },
            include: {
              industry: true,
            },
            orderBy: { feedbackMonth: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get feedback for student ${studentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getFeedbackByIndustry(industryId: string) {
    try {
      const cacheKey = `feedback:industry:${industryId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.monthlyFeedback.findMany({
            where: { industryId },
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
      this.logger.error(`Failed to get feedback for industry ${industryId}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
