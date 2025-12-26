import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Role, VisitType, VisitLogStatus } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import {
  calculateFourWeekCycles,
  FourWeekCycle,
  FOUR_WEEK_CYCLE,
} from '../../../common/utils/four-week-cycle.util';

// Types for visit status
export type VisitStatusType = 'UPCOMING' | 'PENDING' | 'OVERDUE' | 'COMPLETED';

/**
 * Visit period now based on 4-week cycles (aligned with report cycles)
 * @see COMPLIANCE_CALCULATION_ANALYSIS.md Section V
 */
interface VisitPeriod {
  cycleNumber: number;
  month: number; // For backward compatibility
  year: number;  // For backward compatibility
  requiredByDate: Date;
  cycleStartDate: Date;
  cycleEndDate: Date;
  isPartialMonth: boolean; // Now refers to partial cycle
  daysInCycle: number;
}

export interface VisitWithStatus {
  id: string;
  visitMonth: number;
  visitYear: number;
  requiredByDate: Date;
  status: VisitLogStatus;
  submissionStatus: VisitStatusType;
  statusLabel: string;
  statusColor: string;
  visitDate?: Date;
  isCompleted: boolean;
  isOverdue: boolean;
}

/**
 * Calculate expected visit periods for internship
 *
 * UPDATED: Now uses 4-week cycles (aligned with report cycles)
 * @see COMPLIANCE_CALCULATION_ANALYSIS.md Section V
 *
 * Example:
 * - Internship Start: Dec 15, 2025
 * - Visit 1 due: Jan 11 (end of 4-week cycle 1)
 * - Visit 2 due: Feb 8 (end of 4-week cycle 2)
 * - Visit 3 due: Mar 8 (end of 4-week cycle 3)
 */
function calculateExpectedVisitPeriods(startDate: Date, endDate: Date): VisitPeriod[] {
  const cycles = calculateFourWeekCycles(startDate, endDate);

  return cycles.map((cycle: FourWeekCycle) => ({
    cycleNumber: cycle.cycleNumber,
    // For backward compatibility, use cycle end date for month/year reference
    month: cycle.cycleEndDate.getMonth() + 1,
    year: cycle.cycleEndDate.getFullYear(),
    // Visit should be completed by end of cycle (not submission window)
    requiredByDate: cycle.cycleEndDate,
    cycleStartDate: cycle.cycleStartDate,
    cycleEndDate: cycle.cycleEndDate,
    isPartialMonth: cycle.daysInCycle < FOUR_WEEK_CYCLE.DURATION_DAYS,
    daysInCycle: cycle.daysInCycle,
  }));
}

/**
 * Get visit submission status based on 4-week cycles
 * @see COMPLIANCE_CALCULATION_ANALYSIS.md Section V
 */
function getVisitSubmissionStatus(visit: any): { status: VisitStatusType; label: string; color: string; sublabel?: string } {
  const now = new Date();
  const requiredByDate = visit.requiredByDate ? new Date(visit.requiredByDate) : null;
  const cycleStartDate = visit.cycleStartDate ? new Date(visit.cycleStartDate) : null;

  // If visit is completed
  if (visit.status === VisitLogStatus.COMPLETED) {
    return {
      status: 'COMPLETED',
      label: 'Completed',
      color: 'green',
      sublabel: visit.visitDate ? `Visited on ${new Date(visit.visitDate).toLocaleDateString()}` : undefined,
    };
  }

  if (!requiredByDate) {
    return { status: 'PENDING', label: 'Pending', color: 'blue' };
  }

  // Check if overdue (past cycle end date)
  if (now > requiredByDate) {
    const daysOverdue = Math.floor((now.getTime() - requiredByDate.getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: 'OVERDUE',
      label: 'Overdue',
      color: 'red',
      sublabel: `${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue`,
    };
  }

  // Check if we're in the current cycle (between cycleStart and cycleEnd)
  if (cycleStartDate && now >= cycleStartDate && now <= requiredByDate) {
    const daysLeft = Math.ceil((requiredByDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: 'PENDING',
      label: 'Due This Cycle',
      color: 'blue',
      sublabel: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in cycle`,
    };
  }

  // Future cycle (not yet started)
  if (cycleStartDate && now < cycleStartDate) {
    const daysUntil = Math.ceil((cycleStartDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: 'UPCOMING',
      label: 'Upcoming',
      color: 'gray',
      sublabel: `Cycle starts in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
    };
  }

  // Default: upcoming
  return {
    status: 'UPCOMING',
    label: 'Upcoming',
    color: 'gray',
    sublabel: `Due by ${requiredByDate.toLocaleDateString()}`,
  };
}

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
            startDate: true,
            internship: {
              select: {
                startDate: true,
              },
            },
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

      // Validate visitDate is not before internship start date
      const internshipStartDate = application.internship?.startDate || application.startDate;
      if (internshipStartDate && data.visitDate < new Date(internshipStartDate)) {
        throw new BadRequestException(
          `Visit date cannot be before internship start date (${new Date(internshipStartDate).toLocaleDateString()})`,
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

  /**
   * Generate expected monthly visits for an application
   * Called when mentor is assigned or internship is approved
   */
  async generateExpectedVisits(applicationId: string) {
    try {
      this.logger.log(`Generating expected visits for application ${applicationId}`);

      // Get application with internship dates
      const application = await this.prisma.internshipApplication.findUnique({
        where: { id: applicationId },
        include: {
          internship: {
            select: {
              startDate: true,
              endDate: true,
            },
          },
        },
      });

      if (!application) {
        throw new NotFoundException('Application not found');
      }

      // Use internship dates or application dates
      const startDate = application.internship?.startDate || application.startDate;
      const endDate = application.internship?.endDate || application.endDate;

      if (!startDate || !endDate) {
        this.logger.warn(`Application ${applicationId} has no start/end dates, skipping visit generation`);
        return { count: 0, visits: [] };
      }

      // Calculate expected visit periods
      const periods = calculateExpectedVisitPeriods(new Date(startDate), new Date(endDate));

      // Check for existing visits
      const existingVisits = await this.prisma.facultyVisitLog.findMany({
        where: { applicationId },
        select: { visitMonth: true, visitYear: true },
      });

      const existingPeriods = new Set(
        existingVisits.map((v) => `${v.visitMonth}-${v.visitYear}`)
      );

      // Create missing visit records
      const newVisits = [];
      for (const period of periods) {
        const key = `${period.month}-${period.year}`;
        if (!existingPeriods.has(key)) {
          const visitData: any = {
            applicationId,
            internshipId: application.internshipId,
            visitMonth: period.month,
            visitYear: period.year,
            requiredByDate: period.requiredByDate,
            isMonthlyVisit: true,
            status: VisitLogStatus.SCHEDULED,
            visitNumber: 0, // Will be updated when visit is logged
          };

          // Only add facultyId if mentor is assigned
          if (application.mentorId) {
            visitData.facultyId = application.mentorId;
          }

          newVisits.push(visitData);
        }
      }

      // Batch create
      if (newVisits.length > 0) {
        await this.prisma.facultyVisitLog.createMany({
          data: newVisits,
        });
      }

      // Update application with expected visits count
      await this.prisma.internshipApplication.update({
        where: { id: applicationId },
        data: { totalExpectedVisits: periods.length },
      });

      // Invalidate cache
      if (application.mentorId) {
        await this.cache.del(`visits:faculty:${application.mentorId}`);
      }

      this.logger.log(`Generated ${newVisits.length} new expected visits for application ${applicationId}`);

      return {
        count: newVisits.length,
        total: periods.length,
        visits: newVisits,
      };
    } catch (error) {
      this.logger.error(`Failed to generate expected visits: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get monthly visits with status for an application
   */
  async getMonthlyVisitStatus(applicationId: string) {
    try {
      const cacheKey = `visits:application:${applicationId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          // Get all visits for application
          const visits = await this.prisma.facultyVisitLog.findMany({
            where: { applicationId },
            include: {
              faculty: { select: { id: true, name: true, designation: true } },
            },
            orderBy: [{ visitYear: 'asc' }, { visitMonth: 'asc' }],
          });

          // Format visits with status
          const visitsWithStatus = visits.map((visit) => {
            const statusInfo = getVisitSubmissionStatus(visit);
            return {
              id: visit.id,
              visitMonth: visit.visitMonth || 0,
              visitYear: visit.visitYear || 0,
              requiredByDate: visit.requiredByDate,
              status: visit.status,
              submissionStatus: statusInfo.status,
              statusLabel: statusInfo.label,
              statusColor: statusInfo.color,
              sublabel: statusInfo.sublabel,
              visitDate: visit.visitDate,
              isCompleted: visit.status === VisitLogStatus.COMPLETED,
              isOverdue: statusInfo.status === 'OVERDUE',
              faculty: visit.faculty,
              visitType: visit.visitType,
              visitLocation: visit.visitLocation,
              meetingMinutes: visit.meetingMinutes,
            };
          });

          // Calculate progress
          const total = visits.length;
          const completed = visits.filter((v) => v.status === VisitLogStatus.COMPLETED).length;
          const overdue = visitsWithStatus.filter((v) => v.isOverdue).length;
          const pending = total - completed;

          return {
            visits: visitsWithStatus,
            progress: {
              total,
              completed,
              pending,
              overdue,
              percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
            },
          };
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get monthly visit status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Mark a scheduled visit as completed
   */
  async completeMonthlyVisit(
    visitId: string,
    data: CreateVisitLogDto,
  ) {
    try {
      this.logger.log(`Completing monthly visit ${visitId}`);

      const visit = await this.prisma.facultyVisitLog.findUnique({
        where: { id: visitId },
        include: { application: { select: { studentId: true } } },
      });

      if (!visit) {
        throw new NotFoundException('Visit not found');
      }

      const updated = await this.prisma.facultyVisitLog.update({
        where: { id: visitId },
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
          visitPhotos: data.visitPhotos ?? [],
          filesUrl: data.filesUrl,
          status: VisitLogStatus.COMPLETED,
        },
        include: {
          faculty: { select: { id: true, name: true, designation: true } },
          application: {
            include: {
              student: { select: { id: true, name: true, rollNumber: true } },
            },
          },
        },
      });

      // Invalidate cache
      await Promise.all([
        this.cache.del(`visits:faculty:${visit.facultyId}`),
        this.cache.del(`visits:student:${visit.application.studentId}`),
        this.cache.del(`visits:application:${visit.applicationId}`),
      ]);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to complete monthly visit: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get visits for a specific application (for student view)
   */
  async getVisitsByApplication(applicationId: string) {
    try {
      return await this.prisma.facultyVisitLog.findMany({
        where: { applicationId },
        include: {
          faculty: { select: { id: true, name: true, designation: true } },
        },
        orderBy: [{ visitYear: 'asc' }, { visitMonth: 'asc' }],
      });
    } catch (error) {
      this.logger.error(`Failed to get visits for application ${applicationId}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
