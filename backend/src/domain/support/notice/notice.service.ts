import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

export interface CreateNoticeDto {
  title: string;
  message: string;
  institutionId?: string;
}

export interface UpdateNoticeDto extends Partial<CreateNoticeDto> {}

@Injectable()
export class NoticeService {
  private readonly logger = new Logger(NoticeService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async createNotice(creatorId: string, data: CreateNoticeDto) {
    try {
      this.logger.log(`Creating notice by user ${creatorId}`);

      const user = await this.prisma.user.findUnique({
        where: { id: creatorId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const notice = await this.prisma.notice.create({
        data: {
          title: data.title,
          message: data.message,
          institutionId: data.institutionId,
        },
        include: {
          Institution: true,
        },
      });

      // Invalidate cache
      await this.cache.del('notices:all');

      return notice;
    } catch (error) {
      this.logger.error(`Failed to create notice: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getNotices(institutionId?: string) {
    try {
      const cacheKey = institutionId ? `notices:institution:${institutionId}` : 'notices:all';

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          const where: any = {};

          if (institutionId) where.institutionId = institutionId;

          return await this.prisma.notice.findMany({
            where,
            include: {
              Institution: true,
            },
            orderBy: [{ createdAt: 'desc' }],
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get notices: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateNotice(id: string, data: UpdateNoticeDto) {
    try {
      this.logger.log(`Updating notice ${id}`);

      const notice = await this.prisma.notice.findUnique({
        where: { id },
      });

      if (!notice) {
        throw new NotFoundException('Notice not found');
      }

      const updated = await this.prisma.notice.update({
        where: { id },
        data: {
          ...(data.title ? { title: data.title } : {}),
          ...(data.message ? { message: data.message } : {}),
          ...(data.institutionId !== undefined ? { institutionId: data.institutionId } : {}),
        },
        include: {
          Institution: true,
        },
      });

      // Invalidate cache
      await this.cache.del('notices:all');

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update notice: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteNotice(id: string) {
    try {
      this.logger.log(`Deleting notice ${id}`);

      const notice = await this.prisma.notice.findUnique({
        where: { id },
      });

      if (!notice) {
        throw new NotFoundException('Notice not found');
      }

      await this.prisma.notice.delete({
        where: { id },
      });

      // Invalidate cache
      await this.cache.del('notices:all');

      return { success: true, message: 'Notice deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete notice: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getActiveNotices() {
    try {
      return await this.prisma.notice.findMany({
        where: {},
        include: {
          Institution: true,
        },
        orderBy: [{ createdAt: 'desc' }],
      });
    } catch (error) {
      this.logger.error(`Failed to get active notices: ${error.message}`, error.stack);
      throw error;
    }
  }
}
