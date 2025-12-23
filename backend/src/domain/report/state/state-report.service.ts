import { Injectable, Logger } from '@nestjs/common';
import { ApplicationStatus, InternshipStatus, MonthlyReportStatus, Role } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

@Injectable()
export class StateReportService {
  private readonly logger = new Logger(StateReportService.name);
  private readonly CACHE_TTL = 600; // 10 minutes for state-level reports

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getDashboardStats() {
    try {
      const cacheKey = 'state:dashboard:stats';

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          const [
            totalInstitutions,
            totalStudents,
            totalIndustries,
            activeInternships,
            totalFaculty,
          ] = await Promise.all([
            this.prisma.institution.count(),
            this.prisma.student.count(),
            this.prisma.industry.count({ where: { isApproved: true } }),
            // Only count self-identified internships
            this.prisma.internshipApplication.count({
              where: {
                isSelfIdentified: true,
                status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED] }
              },
            }),
            this.prisma.user.count({
              where: { role: { in: [Role.TEACHER, Role.FACULTY_SUPERVISOR] } },
            }),
          ]);

          return {
            totalInstitutions,
            totalStudents,
            totalIndustries,
            activeInternships,
            totalFaculty,
          };
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get dashboard stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getInstitutionPerformance() {
    try {
      const cacheKey = 'state:institution:performance';

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          const institutions = await this.prisma.institution.findMany({
            select: { id: true, name: true },
          });

          const performance = await Promise.all(
            institutions.map(async (institution) => {
              const [
                totalStudents,
                totalFaculty,
                activeInternships,
                completedInternships,
                monthlyReports,
              ] = await Promise.all([
                this.prisma.student.count({ where: { institutionId: institution.id } }),
                this.prisma.user.count({
                  where: {
                    institutionId: institution.id,
                    role: { in: [Role.TEACHER, Role.FACULTY_SUPERVISOR] },
                  },
                }),
                // Only count self-identified internships
                this.prisma.internshipApplication.count({
                  where: {
                    student: { institutionId: institution.id },
                    isSelfIdentified: true,
                    status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED] },
                  },
                }),
                this.prisma.internshipApplication.count({
                  where: {
                    student: { institutionId: institution.id },
                    isSelfIdentified: true,
                    status: ApplicationStatus.COMPLETED,
                  },
                }),
                this.prisma.monthlyReport.count({
                  where: {
                    student: { institutionId: institution.id },
                    status: MonthlyReportStatus.APPROVED,
                  },
                }),
              ]);

              return {
                institutionId: institution.id,
                institutionName: institution.name,
                totalStudents,
                totalFaculty,
                activeInternships,
                completedInternships,
                approvedReports: monthlyReports,
                performanceScore: this.calculatePerformanceScore({
                  students: totalStudents,
                  activeInternships,
                  completedInternships,
                  approvedReports: monthlyReports,
                }),
              };
            }),
          );

          return performance.sort((a, b) => b.performanceScore - a.performanceScore);
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get institution performance: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getMonthlyReportStats(month: number, year: number) {
    try {
      const cacheKey = `state:monthly-reports:${year}-${month}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          const [total, approved, pending, rejected, needsRevision] = await Promise.all([
            this.prisma.monthlyReport.count({ where: { reportMonth: month, reportYear: year } }),
            this.prisma.monthlyReport.count({
              where: { reportMonth: month, reportYear: year, status: MonthlyReportStatus.APPROVED },
            }),
            this.prisma.monthlyReport.count({
              where: { reportMonth: month, reportYear: year, status: MonthlyReportStatus.SUBMITTED },
            }),
            this.prisma.monthlyReport.count({
              where: { reportMonth: month, reportYear: year, status: MonthlyReportStatus.REJECTED },
            }),
            this.prisma.monthlyReport.count({
              where: { reportMonth: month, reportYear: year, status: MonthlyReportStatus.REVISION_REQUIRED },
            }),
          ]);

          const rows = await this.prisma.monthlyReport.findMany({
            where: { reportMonth: month, reportYear: year },
            select: { studentId: true },
          });
          const uniqueStudents = new Set(rows.map((r) => r.studentId));

          return {
            month,
            year,
            total,
            approved,
            pending,
            rejected,
            needsRevision,
            submissionRate: total > 0 ? (approved / total) * 100 : 0,
            institutionCount: uniqueStudents.size,
          };
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get monthly report stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getFacultyVisitStats(month: number, year: number) {
    try {
      const cacheKey = `state:faculty-visits:${year}-${month}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0, 23, 59, 59);

          const [totalVisits, pendingFollowUps, facultyParticipation] = await Promise.all([
            this.prisma.facultyVisitLog.count({
              where: {
                visitDate: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            }),
            this.prisma.facultyVisitLog.count({
              where: {
                visitDate: {
                  gte: startDate,
                  lte: endDate,
                },
                followUpRequired: true,
              },
            }),
            this.prisma.facultyVisitLog.findMany({
              where: { visitDate: { gte: startDate, lte: endDate } },
              select: { facultyId: true },
            }),
          ]);

          const uniqueFaculty = new Set(facultyParticipation.map((r) => r.facultyId));

          return {
            month,
            year,
            totalVisits,
            pendingFollowUps,
            activeFaculty: uniqueFaculty.size,
            averageVisitsPerFaculty: uniqueFaculty.size > 0
              ? totalVisits / uniqueFaculty.size
              : 0,
          };
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get faculty visit stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getTopIndustries(limit: number = 10) {
    try {
      const cacheKey = `state:top-industries:${limit}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          const industries = await this.prisma.industry.findMany({
            where: { isApproved: true },
            include: {
              _count: {
                select: {
                  internships: true,
                },
              },
            },
            take: limit,
          });

          const industriesWithStats = await Promise.all(
            industries.map(async (industry) => {
              const [activePostings, totalApplications, acceptedApplications] = await Promise.all([
                this.prisma.internship.count({
                  where: {
                    industryId: industry.id,
                    isActive: true,
                    status: InternshipStatus.ACTIVE,
                  },
                }),
                this.prisma.internshipApplication.count({
                  where: {
                    internship: { industryId: industry.id },
                  },
                }),
                this.prisma.internshipApplication.count({
                  where: {
                    internship: { industryId: industry.id },
                    status: { in: [ApplicationStatus.SELECTED, ApplicationStatus.JOINED] },
                  },
                }),
              ]);

              return {
                industryId: industry.id,
                industryName: industry.companyName,
                totalPostings: industry._count.internships,
                activePostings,
                totalApplications,
                acceptedApplications,
                acceptanceRate: totalApplications > 0 ? (acceptedApplications / totalApplications) * 100 : 0,
              };
            }),
          );

          return industriesWithStats.sort((a, b) => b.acceptedApplications - a.acceptedApplications);
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get top industries: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getJoiningLetterStats() {
    try {
      const cacheKey = 'state:joining-letters:stats';

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          // Get all self-identified applications - use single query to avoid MongoDB count query issues
          const applications = await this.prisma.internshipApplication.findMany({
            where: { isSelfIdentified: true },
            select: {
              joiningLetterUrl: true,
              hasJoined: true,
              reviewedBy: true,
              student: {
                select: {
                  institutionId: true,
                  Institution: {
                    select: { id: true, name: true, code: true },
                  },
                },
              },
            },
          });

          // Aggregate by institution
          const institutionMap = new Map<string, {
            institutionId: string;
            institutionName: string;
            institutionCode: string;
            total: number;
            noLetter: number;
            pendingReview: number;
            verified: number;
            rejected: number;
          }>();

          for (const app of applications) {
            const instId = app.student.institutionId;
            const inst = app.student.Institution;

            if (!institutionMap.has(instId)) {
              institutionMap.set(instId, {
                institutionId: instId,
                institutionName: inst?.name || 'Unknown',
                institutionCode: inst?.code || '',
                total: 0,
                noLetter: 0,
                pendingReview: 0,
                verified: 0,
                rejected: 0,
              });
            }

            const stats = institutionMap.get(instId)!;
            stats.total++;

            // Check for no letter: null, undefined, or empty string
            const hasNoLetter = !app.joiningLetterUrl || app.joiningLetterUrl === '';
            if (hasNoLetter) {
              stats.noLetter++;
            } else if (app.hasJoined) {
              stats.verified++;
            } else if (app.reviewedBy) {
              stats.rejected++;
            } else {
              stats.pendingReview++;
            }
          }

          const institutionBreakdown = Array.from(institutionMap.values())
            .sort((a, b) => b.total - a.total);

          // Calculate summary totals from institution breakdown (more reliable than count queries with MongoDB)
          const summaryTotals = institutionBreakdown.reduce(
            (acc, inst) => ({
              total: acc.total + inst.total,
              noLetter: acc.noLetter + inst.noLetter,
              pendingReview: acc.pendingReview + inst.pendingReview,
              verified: acc.verified + inst.verified,
              rejected: acc.rejected + inst.rejected,
            }),
            { total: 0, noLetter: 0, pendingReview: 0, verified: 0, rejected: 0 }
          );

          // Get recent activity (last 10 verifications/rejections)
          const recentActivity = await this.prisma.internshipApplication.findMany({
            where: {
              isSelfIdentified: true,
              joiningLetterUrl: { not: null },
              reviewedAt: { not: null },
            },
            select: {
              id: true,
              hasJoined: true,
              reviewedAt: true,
              reviewedBy: true,
              reviewRemarks: true,
              student: {
                select: {
                  name: true,
                  rollNumber: true,
                  Institution: {
                    select: { name: true, code: true },
                  },
                },
              },
              companyName: true,
            },
            orderBy: { reviewedAt: 'desc' },
            take: 10,
          });

          const { total, noLetter, pendingReview, verified, rejected } = summaryTotals;
          const uploaded = pendingReview + verified + rejected;

          return {
            summary: {
              total,
              noLetter,
              pendingReview,
              verified,
              rejected,
              uploaded,
              verificationRate: uploaded > 0 ? Math.round((verified / uploaded) * 100) : 0,
              uploadRate: total > 0 ? Math.round((uploaded / total) * 100) : 0,
            },
            byInstitution: institutionBreakdown,
            recentActivity: recentActivity.map(a => ({
              id: a.id,
              action: a.hasJoined ? 'VERIFIED' : 'REJECTED',
              studentName: a.student.name,
              rollNumber: a.student.rollNumber,
              institutionName: a.student.Institution?.name,
              companyName: a.companyName,
              reviewedAt: a.reviewedAt,
              reviewedBy: a.reviewedBy,
              remarks: a.reviewRemarks,
            })),
          };
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get joining letter stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  private calculatePerformanceScore(data: {
    students: number;
    activeInternships: number;
    completedInternships: number;
    approvedReports: number;
  }): number {
    const { students, activeInternships, completedInternships, approvedReports } = data;

    if (students === 0) return 0;

    const internshipRate = ((activeInternships + completedInternships) / students) * 40;
    const completionRate = completedInternships > 0 ? (completedInternships / (activeInternships + completedInternships)) * 30 : 0;
    const reportRate = activeInternships > 0 ? (approvedReports / activeInternships) * 30 : 0;

    return Math.min(100, internshipRate + completionRate + reportRate);
  }
}
