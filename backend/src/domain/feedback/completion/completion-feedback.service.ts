import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

export interface SubmitCompletionFeedbackDto {
  internshipId: string;
  overallPerformanceRating: number;
  technicalCompetencyRating: number;
  professionalismRating: number;
  adaptabilityRating: number;
  problemSolvingRating: number;
  finalRating: number;
  keyAccomplishments?: string;
  strengthsObserved?: string;
  areasForDevelopment?: string;
  recommendation?: string;
  wouldRehire?: boolean;
  offerFullTime?: boolean;
  additionalComments?: string;
  certificateIssued?: boolean;
  certificateUrl?: string;
}

@Injectable()
export class CompletionFeedbackService {
  private readonly logger = new Logger(CompletionFeedbackService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async submitCompletionFeedback(
    industryId: string,
    studentId: string,
    data: SubmitCompletionFeedbackDto,
  ) {
    try {
      this.logger.log(`Submitting completion feedback for student ${studentId} by industry ${industryId}`);

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

      // Validate ratings are between 1-5
      const ratingFields = [
        'overallPerformanceRating',
        'technicalCompetencyRating',
        'professionalismRating',
        'adaptabilityRating',
        'problemSolvingRating',
        'finalRating',
      ];

      for (const field of ratingFields) {
        const value = data[field];
        if (value < 1 || value > 5) {
          throw new BadRequestException(`${field} must be between 1 and 5`);
        }
      }

      // Resolve application (CompletionFeedback is keyed by applicationId)
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

      // Check for duplicate completion feedback (applicationId is unique in schema)
      const existingFeedback = await this.prisma.completionFeedback.findFirst({
        where: {
          applicationId: application.id,
        },
      });

      if (existingFeedback) {
        throw new BadRequestException('Completion feedback already exists for this internship');
      }

      const feedback = await this.prisma.completionFeedback.create({
        data: {
          applicationId: application.id,
          industryId,

          industryFeedback: data.additionalComments,
          industryRating: data.finalRating,
          finalPerformance: data.keyAccomplishments,
          recommendForHire: data.wouldRehire,
          industrySubmittedAt: new Date(),

          isCompleted: true,
          completionCertificate: data.certificateUrl,
        },
        include: {
          Industry: true,
          application: {
            include: {
              student: { include: { user: true, Institution: true } },
              internship: { include: { industry: true } },
            },
          },
        },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`completion-feedback:student:${studentId}`),
        this.cache.del(`completion-feedback:industry:${industryId}`),
      ]);

      return feedback;
    } catch (error) {
      this.logger.error(`Failed to submit completion feedback: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getCompletionFeedbackByStudent(studentId: string) {
    try {
      const cacheKey = `completion-feedback:student:${studentId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.completionFeedback.findMany({
            where: { application: { studentId } },
            include: {
              Industry: true,
              application: {
                include: {
                  internship: { include: { industry: true } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get completion feedback for student ${studentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getCompletionFeedbackByIndustry(industryId: string) {
    try {
      const cacheKey = `completion-feedback:industry:${industryId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.completionFeedback.findMany({
            where: { industryId },
            include: {
              application: {
                include: {
                  student: { include: { user: true, Institution: true } },
                  internship: { include: { industry: true } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get completion feedback for industry ${industryId}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
