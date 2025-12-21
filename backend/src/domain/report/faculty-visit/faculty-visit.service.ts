import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Role, VisitType } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

export interface CreateVisitLogDto {
  visitDate: Date;
  visitType?: VisitType;
  visitLocation?: string;
  visitDuration?: string;
  meetingMinutes?: string;
  issuesIdentified?: string;
  recommendations?: string;
  followUpRequired?: boolean;
  nextVisitDate?: Date;
  visitPhotos?: string[];
  filesUrl?: string;
}

export interface UpdateVisitLogDto extends Partial<CreateVisitLogDto> {
  // no extra fields for now
}

@Injectable()
export class FacultyVisitService {
  private readonly logger = new Logger(FacultyVisitService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async createVisitLog(
    facultyId: string,
    applicationId: string,
    data: CreateVisitLogDto,
  ) {
    try {
      this.logger.log(
        `Creating visit log for faculty ${facultyId} and application ${applicationId}`,
      );

      const [faculty, application, visitCount] = await Promise.all([
        this.prisma.user.findFirst({
          where: {
            id: facultyId,
            role: { in: [Role.TEACHER, Role.FACULTY_SUPERVISOR] },
          },
        }),
        this.prisma.internshipApplication.findFirst({
          where: {
            id: applicationId,
            mentorId: facultyId,
          },
          select: {
            id: true,
            studentId: true,
            internshipId: true,
          },
        }),
        this.prisma.facultyVisitLog.count({ where: { applicationId } }),
      ]);

      if (!faculty) {
        throw new NotFoundException('Faculty not found');
      }

      if (!application) {
        throw new NotFoundException(
          'Application not found or you are not the assigned mentor',
        );
      }

      const visitLog = await this.prisma.facultyVisitLog.create({
        data: {
          facultyId,
          applicationId,
          internshipId: application.internshipId,
          visitNumber: visitCount + 1,
          visitDate: data.visitDate,
          visitType: data.visitType,
          visitLocation: data.visitLocation,
          visitDuration: data.visitDuration,
          meetingMinutes: data.meetingMinutes,
          issuesIdentified: data.issuesIdentified,
          recommendations: data.recommendations,
          followUpRequired: data.followUpRequired,
          nextVisitDate: data.nextVisitDate,
          visitPhotos: data.visitPhotos ?? [],
          filesUrl: data.filesUrl,
        },
        include: {
          faculty: { select: { id: true, name: true, designation: true } },
          application: {
            include: {
              student: { select: { id: true, name: true, rollNumber: true } },
              internship: {
                include: {
                  industry: { select: { id: true, companyName: true } },
                },
              },
            },
          },
        },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`visits:faculty:${facultyId}`),
        this.cache.del(`visits:student:${application.studentId}`),
      ]);

      return visitLog;
    } catch (error) {
      this.logger.error(`Failed to create visit log: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getVisitLogsByFaculty(facultyId: string) {
    try {
      const cacheKey = `visits:faculty:${facultyId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.facultyVisitLog.findMany({
            where: { facultyId },
            include: {
              application: {
                include: {
                  student: {
                    select: {
                      id: true,
                      name: true,
                      rollNumber: true,
                      institutionId: true,
                    },
                  },
                  internship: {
                    include: {
                      industry: { select: { companyName: true } },
                    },
                  },
                },
              },
            },
            orderBy: { visitDate: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get visit logs for faculty ${facultyId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getVisitLogsByStudent(studentId: string) {
    try {
      const cacheKey = `visits:student:${studentId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.facultyVisitLog.findMany({
            where: { application: { studentId } },
            include: {
              faculty: { select: { id: true, name: true, designation: true } },
              application: {
                include: {
                  internship: {
                    include: {
                      industry: { select: { companyName: true } },
                    },
                  },
                },
              },
            },
            orderBy: { visitDate: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get visit logs for student ${studentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateVisitLog(id: string, data: UpdateVisitLogDto) {
    try {
      this.logger.log(`Updating visit log ${id}`);

      const visitLog = await this.prisma.facultyVisitLog.findUnique({
        where: { id },
        include: { application: { select: { studentId: true } } },
      });

      if (!visitLog) {
        throw new NotFoundException('Visit log not found');
      }

      const updated = await this.prisma.facultyVisitLog.update({
        where: { id },
        data: {
          visitDate: data.visitDate,
          visitType: data.visitType,
          visitLocation: data.visitLocation,
          visitDuration: data.visitDuration,
          meetingMinutes: data.meetingMinutes,
          issuesIdentified: data.issuesIdentified,
          recommendations: data.recommendations,
          followUpRequired: data.followUpRequired,
          nextVisitDate: data.nextVisitDate,
          visitPhotos: data.visitPhotos,
          filesUrl: data.filesUrl,
        },
        include: {
          faculty: { select: { id: true, name: true, designation: true } },
          application: { select: { id: true, studentId: true } },
        },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`visits:faculty:${visitLog.facultyId}`),
        this.cache.del(`visits:student:${visitLog.application.studentId}`),
      ]);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update visit log: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteVisitLog(id: string) {
    try {
      this.logger.log(`Deleting visit log ${id}`);

      const visitLog = await this.prisma.facultyVisitLog.findUnique({
        where: { id },
        include: { application: { select: { studentId: true } } },
      });

      if (!visitLog) {
        throw new NotFoundException('Visit log not found');
      }

      await this.prisma.facultyVisitLog.delete({
        where: { id },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`visits:faculty:${visitLog.facultyId}`),
        this.cache.del(`visits:student:${visitLog.application.studentId}`),
      ]);

      return { success: true, message: 'Visit log deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete visit log: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getVisitStatistics(institutionId: string) {
    try {
      const cacheKey = `visit-stats:institution:${institutionId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          const [totalVisits, pendingFollowUps, facultyStats] = await Promise.all([
            this.prisma.facultyVisitLog.count({
              where: {
                application: { student: { institutionId } },
              },
            }),
            this.prisma.facultyVisitLog.count({
              where: {
                application: { student: { institutionId } },
                followUpRequired: true,
              },
            }),
            this.prisma.facultyVisitLog.findMany({
              where: { application: { student: { institutionId } } },
              select: { facultyId: true },
            }),
          ]);

          const uniqueFaculty = new Set(facultyStats.map((row) => row.facultyId));

          return {
            totalVisits,
            pendingFollowUps,
            facultyCount: uniqueFaculty.size,
            averageVisitsPerFaculty:
              uniqueFaculty.size > 0 ? totalVisits / uniqueFaculty.size : 0,
          };
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get visit statistics: ${error.message}`, error.stack);
      throw error;
    }
  }
}
