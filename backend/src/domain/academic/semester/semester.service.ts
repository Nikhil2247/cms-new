import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

export interface CreateSemesterDto {
  name: string;
  number: number;
  startDate: Date;
  endDate: Date;
  isActive?: boolean;
}

@Injectable()
export class SemesterService {
  private readonly logger = new Logger(SemesterService.name);
  private readonly CACHE_TTL = 600; // 10 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getSemesters() {
    try {
      const cacheKey = 'semesters:all';

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.semester.findMany({
            orderBy: { number: 'asc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get semesters: ${error.message}`, error.stack);
      throw error;
    }
  }

  async createSemester(data: CreateSemesterDto) {
    try {
      this.logger.log(`Creating semester ${data.name}`);

      // Check for duplicate semester number
      const existingSemester = await this.prisma.semester.findFirst({
        where: { number: data.number },
      });

      if (existingSemester) {
        throw new BadRequestException('Semester with this number already exists');
      }

      const semester = await this.prisma.semester.create({
        data: {
          ...data,
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
      });

      // Invalidate cache
      await this.cache.del('semesters:all');

      return semester;
    } catch (error) {
      this.logger.error(`Failed to create semester: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getActiveSemester() {
    try {
      const cacheKey = 'semester:active';

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.semester.findFirst({
            where: { isActive: true },
            orderBy: { number: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get active semester: ${error.message}`, error.stack);
      throw error;
    }
  }
}
