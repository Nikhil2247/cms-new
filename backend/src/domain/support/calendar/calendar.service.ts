import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

export interface CreateEventDto {
  title: string;
  startDate?: Date;
  endDate?: Date;
  institutionId?: string;
}

export interface UpdateEventDto extends Partial<CreateEventDto> {}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async createEvent(creatorId: string, data: CreateEventDto) {
    try {
      this.logger.log(`Creating calendar event by user ${creatorId}`);

      const user = await this.prisma.user.findUnique({
        where: { id: creatorId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const event = await this.prisma.calendar.create({
        data: {
          title: data.title,
          startDate: data.startDate,
          endDate: data.endDate,
          institutionId: data.institutionId,
        },
        include: {
          Institution: true,
        },
      });

      // Invalidate cache
      await this.cache.del('calendar:events:all');

      return event;
    } catch (error) {
      this.logger.error(`Failed to create calendar event: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getEvents(institutionId?: string, dateRange?: DateRange) {
    try {
      const cacheKey = institutionId
        ? `calendar:events:institution:${institutionId}`
        : 'calendar:events:all';

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          const where: any = {};

          if (institutionId) {
            where.institutionId = institutionId;
          }

          if (dateRange) {
            where.AND = [
              {
                startDate: {
                  lte: dateRange.endDate,
                },
              },
              {
                endDate: {
                  gte: dateRange.startDate,
                },
              },
            ];
          }

          return await this.prisma.calendar.findMany({
            where,
            include: {
              Institution: true,
            },
            orderBy: { startDate: 'asc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get calendar events: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateEvent(id: string, data: UpdateEventDto) {
    try {
      this.logger.log(`Updating calendar event ${id}`);

      const event = await this.prisma.calendar.findUnique({
        where: { id },
      });

      if (!event) {
        throw new NotFoundException('Calendar event not found');
      }

      const updated = await this.prisma.calendar.update({
        where: { id },
        data: {
          ...(data.title ? { title: data.title } : {}),
          ...(data.startDate ? { startDate: data.startDate } : {}),
          ...(data.endDate ? { endDate: data.endDate } : {}),
          ...(data.institutionId !== undefined ? { institutionId: data.institutionId } : {}),
        },
        include: {
          Institution: true,
        },
      });

      // Invalidate cache
      await this.cache.del('calendar:events:all');

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update calendar event: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteEvent(id: string) {
    try {
      this.logger.log(`Deleting calendar event ${id}`);

      const event = await this.prisma.calendar.findUnique({
        where: { id },
      });

      if (!event) {
        throw new NotFoundException('Calendar event not found');
      }

      await this.prisma.calendar.delete({
        where: { id },
      });

      // Invalidate cache
      await this.cache.del('calendar:events:all');

      return { success: true, message: 'Calendar event deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete calendar event: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUpcomingEvents(limit: number = 10) {
    try {
      const now = new Date();

      return await this.prisma.calendar.findMany({
        where: {
          startDate: {
            gte: now,
          },
        },
        include: {
          Institution: true,
        },
        orderBy: { startDate: 'asc' },
        take: limit,
      });
    } catch (error) {
      this.logger.error(`Failed to get upcoming events: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getEventsByType(eventType: string) {
    try {
      return await this.prisma.calendar.findMany({
        where: {
          title: { contains: eventType, mode: 'insensitive' },
        },
        include: { Institution: true },
        orderBy: { startDate: 'asc' },
      });
    } catch (error) {
      this.logger.error(`Failed to get events by type: ${error.message}`, error.stack);
      throw error;
    }
  }
}
