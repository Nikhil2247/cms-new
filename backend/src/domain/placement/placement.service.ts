import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { PlacementStatus } from '@prisma/client';

export interface RecordPlacementDto {
  companyName: string;
  jobRole: string;
  salary?: number;
  offerDate: Date;
}

export interface UpdatePlacementDto extends Partial<RecordPlacementDto> {
  status?: PlacementStatus;
}

@Injectable()
export class PlacementService {
  private readonly logger = new Logger(PlacementService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async recordPlacement(studentId: string, data: RecordPlacementDto) {
    try {
      this.logger.log(`Recording placement for student ${studentId}`);

      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        include: {
          Institution: true,
        },
      });

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      if (data.salary !== undefined && data.salary <= 0) {
        throw new BadRequestException('Salary amount must be greater than 0');
      }

      const placement = await this.prisma.placement.create({
        data: {
          studentId,
          companyName: data.companyName,
          jobRole: data.jobRole,
          salary: data.salary,
          offerDate: data.offerDate,
          status: PlacementStatus.OFFERED,
          institutionId: student.institutionId ?? undefined,
        },
        include: {
          student: {
            include: {
              user: true,
              Institution: true,
              branch: true,
            },
          },
        },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`placements:student:${studentId}`),
        this.cache.del(`placements:institution:${student.institutionId}`),
      ]);

      return placement;
    } catch (error) {
      this.logger.error(`Failed to record placement: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPlacementsByStudent(studentId: string) {
    try {
      const cacheKey = `placements:student:${studentId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.placement.findMany({
            where: { studentId },
            include: { student: true },
            orderBy: { createdAt: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get placements for student ${studentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPlacementsByInstitution(institutionId: string) {
    try {
      const cacheKey = `placements:institution:${institutionId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.placement.findMany({
            where: {
              institutionId,
            },
            include: {
              student: {
                include: {
                  user: true,
                  branch: true,
                  batch: true,
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
      this.logger.error(`Failed to get placements for institution ${institutionId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPlacementStatistics(institutionId: string) {
    try {
      const cacheKey = `placement-stats:institution:${institutionId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          // Run both queries in parallel
          const [placements, totalStudents] = await Promise.all([
            this.prisma.placement.findMany({
              where: {
                institutionId,
              },
              include: {
                student: {
                  include: {
                    batch: true,
                    branch: true,
                  },
                },
              },
            }),
            this.prisma.student.count({
              where: { institutionId },
            }),
          ]);

          const totalPlacements = placements.length;
          const placedStudents = new Set(placements.map(p => p.studentId)).size;

          const statusBreakdown = placements.reduce((acc, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          // Calculate average package
          const totalSalary = placements.reduce((sum, p) => sum + (p.salary ?? 0), 0);
          const averageSalary = totalPlacements > 0 ? totalSalary / totalPlacements : 0;

          // Find highest package
          const highestSalary = placements.length > 0
            ? Math.max(...placements.map(p => p.salary ?? 0))
            : 0;

          // Top companies
          const companyStats = placements.reduce((acc, p) => {
            const company = p.companyName;
            acc[company] = (acc[company] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const topCompanies = Object.entries(companyStats)
            .map(([company, count]) => ({ company, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

          // Branch-wise statistics
          const branchStats = placements.reduce((acc, p) => {
            const branchName = p.student.branch?.name || 'Unknown';
            if (!acc[branchName]) {
              acc[branchName] = {
                branch: branchName,
                placements: 0,
                students: new Set(),
              };
            }
            acc[branchName].placements++;
            acc[branchName].students.add(p.studentId);
            return acc;
          }, {} as Record<string, any>);

          const branchWiseStats = Object.values(branchStats).map((stat: any) => ({
            branch: stat.branch,
            totalPlacements: stat.placements,
            placedStudents: stat.students.size,
          }));

          return {
            overview: {
              totalStudents,
              placedStudents,
              totalPlacements,
              placementRate: totalStudents > 0 ? (placedStudents / totalStudents) * 100 : 0,
              averageSalary,
              highestSalary,
            },
            statusBreakdown,
            topCompanies,
            branchWiseStats,
          };
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get placement statistics: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updatePlacement(id: string, data: UpdatePlacementDto) {
    try {
      this.logger.log(`Updating placement ${id}`);

      const placement = await this.prisma.placement.findUnique({
        where: { id },
        include: {
          student: true,
        },
      });

      if (!placement) {
        throw new NotFoundException('Placement not found');
      }

      const updated = await this.prisma.placement.update({
        where: { id },
        data: {
          ...(data.companyName ? { companyName: data.companyName } : {}),
          ...(data.jobRole ? { jobRole: data.jobRole } : {}),
          ...(data.salary !== undefined ? { salary: data.salary } : {}),
          ...(data.offerDate ? { offerDate: data.offerDate } : {}),
          ...(data.status ? { status: data.status } : {}),
        },
        include: {
          student: {
            include: {
              user: true,
              Institution: true,
              branch: true,
            },
          },
        },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`placements:student:${placement.studentId}`),
        this.cache.del(`placements:institution:${placement.student.institutionId}`),
        this.cache.del(`placement-stats:institution:${placement.student.institutionId}`),
      ]);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update placement: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deletePlacement(id: string) {
    try {
      this.logger.log(`Deleting placement ${id}`);

      const placement = await this.prisma.placement.findUnique({
        where: { id },
        include: {
          student: true,
        },
      });

      if (!placement) {
        throw new NotFoundException('Placement not found');
      }

      await this.prisma.placement.delete({
        where: { id },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`placements:student:${placement.studentId}`),
        this.cache.del(`placements:institution:${placement.student.institutionId}`),
        this.cache.del(`placement-stats:institution:${placement.student.institutionId}`),
      ]);

      return { success: true, message: 'Placement deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete placement: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPlacementsByCompany(companyId: string) {
    try {
      return await this.prisma.placement.findMany({
        where: { companyName: companyId },
        include: {
          student: {
            include: {
              user: true,
              Institution: true,
              branch: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(`Failed to get placements for company ${companyId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPlacementTrends(institutionId: string, years: number = 5) {
    try {
      const cacheKey = `placement-trends:institution:${institutionId}:${years}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          const currentYear = new Date().getFullYear();
          const startYear = currentYear - years;

          const placements = await this.prisma.placement.findMany({
            where: {
              institutionId,
              createdAt: {
                gte: new Date(startYear, 0, 1),
              },
            },
            include: {
              student: {
                include: {
                  batch: true,
                },
              },
            },
          });

          const yearlyStats = placements.reduce((acc, p) => {
            const year = p.createdAt.getFullYear();
            if (!acc[year]) {
              acc[year] = {
                year,
                totalPlacements: 0,
                totalSalary: 0,
                students: new Set(),
              };
            }
            acc[year].totalPlacements++;
            acc[year].totalSalary += p.salary ?? 0;
            acc[year].students.add(p.studentId);
            return acc;
          }, {} as Record<number, any>);

          return Object.values(yearlyStats)
            .map((stat: any) => ({
              year: stat.year,
              totalPlacements: stat.totalPlacements,
              placedStudents: stat.students.size,
              averageSalary: stat.totalPlacements > 0 ? stat.totalSalary / stat.totalPlacements : 0,
            }))
            .sort((a, b) => a.year - b.year);
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get placement trends: ${error.message}`, error.stack);
      throw error;
    }
  }
}
