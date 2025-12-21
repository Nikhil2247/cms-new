import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { TechnicalQueryPriority, TechnicalQueryStatus } from '@prisma/client';

export interface SubmitQueryDto {
  subject: string;
  description: string;
  priority?: TechnicalQueryPriority;
  attachments?: string[];
  institutionId?: string;
}

export interface RespondToQueryDto {
  response: string;
  attachments?: string[];
  resolvedStatus?: boolean;
}

@Injectable()
export class TechnicalQueryService {
  private readonly logger = new Logger(TechnicalQueryService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async submitQuery(userId: string, data: SubmitQueryDto) {
    try {
      this.logger.log(`Submitting technical query for user ${userId}`);

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const query = await this.prisma.technicalQuery.create({
        data: {
          userId,
          title: data.subject,
          description: data.description,
          priority: data.priority || TechnicalQueryPriority.MEDIUM,
          attachments: data.attachments || [],
          status: TechnicalQueryStatus.OPEN,
          institutionId: data.institutionId,
        },
        include: {
          user: true,
        },
      });

      // Invalidate cache
      await this.cache.del(`queries:user:${userId}`);

      return query;
    } catch (error) {
      this.logger.error(`Failed to submit technical query: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getQueriesByUser(userId: string) {
    try {
      const cacheKey = `queries:user:${userId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.technicalQuery.findMany({
            where: { userId },
            include: { user: true, Institution: true },
            orderBy: { createdAt: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get queries for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async respondToQuery(id: string, response: RespondToQueryDto & { responderId: string }) {
    try {
      this.logger.log(`Responding to technical query ${id}`);

      const query = await this.prisma.technicalQuery.findUnique({
        where: { id },
      });

      if (!query) {
        throw new NotFoundException('Technical query not found');
      }

      const responded = await this.prisma.technicalQuery.update({
        where: { id },
        data: {
          status: response.resolvedStatus ? TechnicalQueryStatus.RESOLVED : TechnicalQueryStatus.IN_PROGRESS,
          resolution: response.response,
          ...(response.attachments ? { attachments: response.attachments } : {}),
        },
        include: {
          user: true,
          Institution: true,
        },
      });

      // Invalidate cache
      await this.cache.del(`queries:user:${query.userId}`);

      return responded;
    } catch (error) {
      this.logger.error(`Failed to respond to technical query: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getAllQueries() {
    try {
      return await this.prisma.technicalQuery.findMany({
        include: {
          user: true,
          Institution: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(`Failed to get all queries: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateQueryStatus(id: string, status: string) {
    try {
      this.logger.log(`Updating query ${id} status to ${status}`);

      const query = await this.prisma.technicalQuery.findUnique({
        where: { id },
      });

      if (!query) {
        throw new NotFoundException('Technical query not found');
      }

      const updated = await this.prisma.technicalQuery.update({
        where: { id },
        data: {
          status: status as TechnicalQueryStatus,
        },
      });

      // Invalidate cache
      await this.cache.del(`queries:user:${query.userId}`);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update query status: ${error.message}`, error.stack);
      throw error;
    }
  }
}
