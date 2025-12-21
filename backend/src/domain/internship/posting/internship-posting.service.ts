import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

export interface CreatePostingDto {
  title: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  stipend?: number;
  duration?: number;
  location?: string;
  startDate?: Date;
  endDate?: Date;
  applicationDeadline?: Date;
  numberOfPositions?: number;
  skills?: string[];
  benefits?: string;
}

export interface UpdatePostingDto extends Partial<CreatePostingDto> {
  isActive?: boolean;
}

export interface PostingFilters {
  location?: string;
  minStipend?: number;
  maxStipend?: number;
  skills?: string[];
  isActive?: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

@Injectable()
export class InternshipPostingService {
  private readonly logger = new Logger(InternshipPostingService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private toDurationString(durationMonths?: number): string {
    if (!durationMonths || durationMonths <= 0) return '3 months';
    return `${durationMonths} months`;
  }

  async createPosting(industryId: string, data: CreatePostingDto) {
    try {
      this.logger.log(`Creating internship posting for industry ${industryId}`);

      const industry = await this.prisma.industry.findUnique({
        where: { id: industryId },
      });

      if (!industry) {
        throw new NotFoundException('Industry not found');
      }

      const applicationDeadline =
        data.applicationDeadline ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const posting = await this.prisma.internship.create({
        data: {
          industryId,
          title: data.title,
          description: data.description,
          detailedDescription: [data.responsibilities, data.benefits]
            .filter(Boolean)
            .join('\n\n') || null,
          fieldOfWork: data.requirements || 'General',
          numberOfPositions: data.numberOfPositions ?? 1,
          duration: this.toDurationString(data.duration),
          startDate: data.startDate,
          endDate: data.endDate,
          applicationDeadline,
          workLocation: data.location || 'Not specified',
          isRemoteAllowed: false,
          eligibleBranches: [],
          eligibleSemesters: [],
          minimumPercentage: null,
          isStipendProvided: data.stipend !== undefined && data.stipend !== null,
          stipendAmount: data.stipend ?? null,
          stipendDetails: null,
          requiredSkills: data.skills || [],
          preferredSkills: [],
          isActive: true,
        },
        include: {
          industry: true,
        },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`postings:industry:${industryId}`),
        this.cache.del('postings:available'),
      ]);

      return posting;
    } catch (error) {
      this.logger.error(`Failed to create internship posting: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updatePosting(id: string, data: UpdatePostingDto) {
    try {
      this.logger.log(`Updating internship posting ${id}`);

      const posting = await this.prisma.internship.findUnique({
        where: { id },
      });

      if (!posting) {
        throw new NotFoundException('Internship posting not found');
      }

      const updateData: any = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.responsibilities !== undefined || data.benefits !== undefined) {
        updateData.detailedDescription = [data.responsibilities, data.benefits]
          .filter(Boolean)
          .join('\n\n') || null;
      }
      if (data.requirements !== undefined) updateData.fieldOfWork = data.requirements || 'General';
      if (data.numberOfPositions !== undefined) updateData.numberOfPositions = data.numberOfPositions;
      if (data.duration !== undefined) updateData.duration = this.toDurationString(data.duration);
      if (data.startDate !== undefined) updateData.startDate = data.startDate;
      if (data.endDate !== undefined) updateData.endDate = data.endDate;
      if (data.applicationDeadline !== undefined) updateData.applicationDeadline = data.applicationDeadline;
      if (data.location !== undefined) updateData.workLocation = data.location || 'Not specified';
      if (data.skills !== undefined) updateData.requiredSkills = data.skills || [];
      if (data.stipend !== undefined) {
        updateData.isStipendProvided = data.stipend !== null;
        updateData.stipendAmount = data.stipend ?? null;
      }
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const updated = await this.prisma.internship.update({
        where: { id },
        data: updateData,
        include: {
          industry: true,
        },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`postings:industry:${posting.industryId}`),
        this.cache.del('postings:available'),
      ]);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update internship posting: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deletePosting(id: string) {
    try {
      this.logger.log(`Deleting internship posting ${id}`);

      const posting = await this.prisma.internship.findUnique({
        where: { id },
      });

      if (!posting) {
        throw new NotFoundException('Internship posting not found');
      }

      await this.prisma.internship.delete({
        where: { id },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`postings:industry:${posting.industryId}`),
        this.cache.del('postings:available'),
      ]);

      return { success: true, message: 'Internship posting deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete internship posting: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPostingsByIndustry(industryId: string) {
    try {
      const cacheKey = `postings:industry:${industryId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.internship.findMany({
            where: { industryId },
            include: {
              industry: true,
              applications: {
                include: {
                  student: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get postings for industry ${industryId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getAvailablePostings(
    filters: PostingFilters = {},
    pagination: PaginationParams = {},
  ) {
    try {
      const { page = 1, limit = 20 } = pagination;
      const skip = (page - 1) * limit;

      const where: any = {
        isActive: filters.isActive !== undefined ? filters.isActive : true,
      };

      if (filters.location) {
        where.workLocation = { contains: filters.location, mode: 'insensitive' };
      }

      if (filters.minStipend || filters.maxStipend) {
        where.stipendAmount = {};
        if (filters.minStipend) where.stipendAmount.gte = filters.minStipend;
        if (filters.maxStipend) where.stipendAmount.lte = filters.maxStipend;
      }

      if (filters.skills && filters.skills.length > 0) {
        where.requiredSkills = { hasSome: filters.skills };
      }

      const [postings, total] = await Promise.all([
        this.prisma.internship.findMany({
          where,
          include: {
            industry: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.internship.count({ where }),
      ]);

      return {
        data: postings,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get available postings: ${error.message}`, error.stack);
      throw error;
    }
  }
}
