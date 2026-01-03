import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LruCacheService } from '../../../core/cache/lru-cache.service';
import { Prisma, ApplicationStatus, MonthlyReportStatus } from '../../../generated/prisma/client';
import { StateReportService } from '../../../domain/report/state/state-report.service';

@Injectable()
export class StateReportsService {
  private readonly logger = new Logger(StateReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly stateReportService: StateReportService,
  ) {}

  /**
   * Get institution performance metrics
   * Internship/industry portal removed; placements removed.
   */
  async getInstitutionPerformance(institutionId: string, params: { fromDate?: Date; toDate?: Date }) {
    const { fromDate, toDate } = params;

    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${institutionId} not found`);
    }

    // Placement feature removed from schema; keep response shape stable.
    const placementStats = {
      overview: {
        totalStudents: 0,
        placedStudents: 0,
        totalPlacements: 0,
        placementRate: 0,
        averageSalary: 0,
        highestSalary: 0,
      },
      statusBreakdown: {},
      topCompanies: [],
      branchWiseStats: [],
    };

    const dateFilter: Prisma.InternshipApplicationWhereInput = {
      student: { institutionId, isActive: true },
      isSelfIdentified: true,
    };

    if (fromDate || toDate) {
      dateFilter.createdAt = {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      };
    }

    const [totalStudents, totalApplications, approvedApplications, completedApplications, facultyVisits, monthlyReports] = await Promise.all([
      this.prisma.student.count({ where: { institutionId, isActive: true } }),
      this.prisma.internshipApplication.count({ where: dateFilter }),
      this.prisma.internshipApplication.count({ where: { ...dateFilter, status: ApplicationStatus.APPROVED } }),
      this.prisma.internshipApplication.count({ where: { ...dateFilter, status: ApplicationStatus.COMPLETED } }),
      this.prisma.facultyVisitLog.count({
        where: { application: { student: { institutionId, isActive: true } } },
      }),
      this.prisma.monthlyReport.count({
        where: { student: { institutionId, isActive: true } },
      }),
    ]);

    const approvalRate = totalApplications > 0
      ? ((approvedApplications / totalApplications) * 100).toFixed(2)
      : '0';
    const completionRate = approvedApplications > 0
      ? ((completedApplications / approvedApplications) * 100).toFixed(2)
      : '0';

    return {
      institution: {
        id: institution.id,
        name: institution.name,
        code: institution.code,
      },
      metrics: {
        totalStudents,
        totalApplications,
        approvedApplications,
        completedApplications,
        // Internship model removed; approximate with approved self-identified applications
        totalInternships: approvedApplications,
        approvalRate: Number(approvalRate),
        completionRate: Number(completionRate),
      },
      compliance: {
        facultyVisits,
        monthlyReports,
        averageVisitsPerApplication: approvedApplications > 0
          ? (facultyVisits / approvedApplications).toFixed(2)
          : 0,
      },
      placements: placementStats,
    };
  }

  /**
   * Get monthly report statistics
   * Uses domain service for detailed stats
   */
  async getMonthlyReportStats(params: { institutionId?: string; month?: number; year?: number }) {
    const { institutionId, month, year } = params;
    const targetMonth = month ?? new Date().getMonth() + 1;
    const targetYear = year ?? new Date().getFullYear();

    const domainStats = await this.stateReportService.getMonthlyReportStats(targetMonth, targetYear);

    if (institutionId) {
      const where: Prisma.MonthlyReportWhereInput = {
        student: { institutionId, isActive: true },
        reportMonth: targetMonth,
        reportYear: targetYear,
      };

      const [total, draft, submitted, approved, rejected] = await Promise.all([
        this.prisma.monthlyReport.count({ where }),
        this.prisma.monthlyReport.count({ where: { ...where, status: 'DRAFT' as any } }),
        this.prisma.monthlyReport.count({ where: { ...where, status: 'SUBMITTED' as any } }),
        this.prisma.monthlyReport.count({ where: { ...where, status: 'APPROVED' as any } }),
        this.prisma.monthlyReport.count({ where: { ...where, status: 'REJECTED' as any } }),
      ]);

      return {
        institutionId,
        ...domainStats,
        institutionStats: {
          total,
          byStatus: { draft, submitted, approved, rejected },
          submissionRate: total > 0 ? (((submitted + approved) / total) * 100).toFixed(2) : 0,
        },
      };
    }

    return domainStats;
  }

  /**
   * Get institution reports
   * OPTIMIZED: Added pagination with default limit of 100
   */
  async getInstitutionReports(params: {
    fromDate?: string;
    toDate?: string;
    reportType?: string;
    page?: number;
    limit?: number;
  }) {
    const { fromDate, toDate, page = 1, limit = 100 } = params;
    const skip = (page - 1) * limit;
    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;

    const createdAtFilter = (from || to)
      ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : undefined;

    const [institutions, total] = await Promise.all([
      this.prisma.institution.findMany({
        where: createdAtFilter,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              Student: true,
            },
          },
        },
      }),
      this.prisma.institution.count({ where: createdAtFilter }),
    ]);

    const data = institutions.map((inst) => ({
      ...(inst as any),
      _count: {
        ...(inst as any)._count,
        internships: 0,
        industries: 0,
        placements: 0,
      },
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get system-wide audit logs
   */
  async getAuditLogs(params: {
    institutionId?: string;
    userId?: string;
    action?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    const { institutionId, userId, action, fromDate, toDate, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = {};

    if (institutionId) where.institutionId = institutionId;
    if (userId) where.userId = userId;
    if (action) where.action = action as any;

    if (fromDate || toDate) {
      where.timestamp = {
        ...(fromDate ? { gte: new Date(fromDate) } : {}),
        ...(toDate ? { lte: new Date(toDate) } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, name: true, role: true } },
          Institution: { select: { id: true, name: true, code: true } },
        },
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get faculty visit statistics
   */
  async getFacultyVisitStats(params: {
    institutionId?: string;
    facultyId?: string;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const { institutionId, facultyId, fromDate, toDate } = params;
    const now = new Date();
    const month = fromDate?.getMonth() ?? now.getMonth() + 1;
    const year = fromDate?.getFullYear() ?? now.getFullYear();

    const baseStats = await this.stateReportService.getFacultyVisitStats(month, year);

    const where: Prisma.FacultyVisitLogWhereInput = {
      ...(institutionId ? { application: { student: { institutionId, isActive: true } } } : {}),
      ...(facultyId ? { facultyId } : {}),
      ...((fromDate || toDate)
        ? { visitDate: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
        : {}),
    };

    const [totalVisits, physicalVisits, virtualVisits, visitsByFaculty] = await Promise.all([
      this.prisma.facultyVisitLog.count({ where }),
      this.prisma.facultyVisitLog.count({ where: { ...where, visitType: 'PHYSICAL' as any } }),
      this.prisma.facultyVisitLog.count({ where: { ...where, visitType: 'VIRTUAL' as any } }),
      this.prisma.facultyVisitLog.groupBy({
        by: ['facultyId'],
        where,
        _count: true,
      }),
    ]);

    return {
      ...baseStats,
      filtered: {
        total: totalVisits,
        byType: { physical: physicalVisits, virtual: virtualVisits },
        byFaculty: visitsByFaculty.map((v) => ({ facultyId: v.facultyId, count: v._count })),
      },
    };
  }

  /**
   * Top performers
   * Portal and placement features removed; return empty lists for now.
   */
  async getTopPerformers(params: { limit?: number; month?: number; year?: number }) {
    const { limit = 5, month, year } = params;
    const cacheKey = `state:top-performers:${limit}:${month || 'current'}:${year || 'current'}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => ({
        topPerformers: [],
        bottomPerformers: [],
      }),
      { ttl: 900, tags: ['state', 'top-performers'] },
    );
  }

  async getJoiningLetterStats() {
    return this.stateReportService.getJoiningLetterStats();
  }

  async getStateWidePlacementTrends(years: number = 5) {
    const cacheKey = `state:placement:trends:${years}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => [],
      { ttl: 600, tags: ['state', 'placements'] },
    );
  }

  async getStateWidePlacementStats() {
    const cacheKey = 'state:placement:stats';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const totalStudents = await this.prisma.student.count({
          where: { isActive: true, Institution: { isActive: true } },
        });

        return {
          overview: {
            totalStudents,
            placedStudents: 0,
            totalPlacements: 0,
            totalSalary: 0,
            averageSalary: 0,
            highestSalary: 0,
            placementRate: '0.00',
          },
          breakdown: {
            status: {},
            topCompanies: [],
            branches: [],
            institutions: [],
          },
        };
      },
      { ttl: 600, tags: ['state', 'placements'] },
    );
  }

  /**
   * Monthly analytics for state dashboard
   * Focused on self-identified internship applications only
   */
  async getMonthlyAnalytics(params: { month?: number; year?: number; institutionId?: string }) {
    const { month, year, institutionId } = params;
    const currentDate = new Date();
    const targetMonth = month ?? currentDate.getMonth() + 1;
    const targetYear = year ?? currentDate.getFullYear();
    const cacheKey = `state:monthly-analytics:${targetYear}:${targetMonth}:${institutionId ?? 'all'}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0);

        const studentFilter: Prisma.StudentWhereInput = {
          isActive: true,
          Institution: { isActive: true },
          ...(institutionId ? { institutionId } : {}),
        };

        const applicationBaseWhere: Prisma.InternshipApplicationWhereInput = {
          createdAt: { gte: startDate, lte: endDate },
          isSelfIdentified: true,
          student: studentFilter,
        };

        const [newStudents, newApplications, approvedApplications, facultyVisits, monthlyReports] = await Promise.all([
          this.prisma.student.count({
            where: { ...studentFilter, createdAt: { gte: startDate, lte: endDate } },
          }),
          this.prisma.internshipApplication.count({ where: applicationBaseWhere }),
          this.prisma.internshipApplication.count({
            where: { ...applicationBaseWhere, status: ApplicationStatus.APPROVED },
          }),
          this.prisma.facultyVisitLog.count({
            where: {
              visitDate: { gte: startDate, lte: endDate },
              application: { student: studentFilter },
            },
          }),
          this.prisma.monthlyReport.count({
            where: {
              student: studentFilter,
              reportMonth: targetMonth,
              reportYear: targetYear,
            },
          }),
        ]);

        const trend: Array<{ month: string; applications: number; approved: number; placements: number }> = [];
        for (let i = 5; i >= 0; i--) {
          const trendMonthStart = new Date(targetYear, targetMonth - 1 - i, 1);
          const trendMonthEnd = new Date(trendMonthStart.getFullYear(), trendMonthStart.getMonth() + 1, 0);

          const trendWhere: Prisma.InternshipApplicationWhereInput = {
            createdAt: { gte: trendMonthStart, lte: trendMonthEnd },
            isSelfIdentified: true,
            student: studentFilter,
          };

          const [applications, approved] = await Promise.all([
            this.prisma.internshipApplication.count({ where: trendWhere }),
            this.prisma.internshipApplication.count({
              where: { ...trendWhere, status: ApplicationStatus.APPROVED },
            }),
          ]);

          trend.push({
            month: trendMonthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            applications,
            approved,
            placements: approved,
          });
        }

        return {
          month: targetMonth,
          year: targetYear,
          metrics: {
            newStudents,
            newApplications,
            approvedApplications,
            selectedApplications: approvedApplications,
            newInternships: approvedApplications,
            newIndustries: 0,
            facultyVisits,
            monthlyReports,
            approvalRate: newApplications > 0
              ? ((approvedApplications / newApplications) * 100).toFixed(2)
              : 0,
            placementRate: newApplications > 0
              ? ((approvedApplications / newApplications) * 100).toFixed(2)
              : 0,
          },
          trend,
        };
      },
      { ttl: 300, tags: ['state', 'monthly-analytics'] },
    );
  }
}
