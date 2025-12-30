import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LruCacheService } from '../../../core/cache/lru-cache.service';
import { Prisma, ApplicationStatus, MonthlyReportStatus } from '@prisma/client';

// Import domain services for business logic reuse
import { StateReportService } from '../../../domain/report/state/state-report.service';
import { PlacementService } from '../../../domain/placement/placement.service';
import { FacultyVisitService } from '../../../domain/report/faculty-visit/faculty-visit.service';
import { MonthlyReportService } from '../../../domain/report/monthly/monthly-report.service';
import { LookupService } from '../../shared/lookup.service';

@Injectable()
export class StateReportsService {
  private readonly logger = new Logger(StateReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly stateReportService: StateReportService,
    private readonly placementService: PlacementService,
    private readonly facultyVisitService: FacultyVisitService,
    private readonly monthlyReportService: MonthlyReportService,
    private readonly lookupService: LookupService,
  ) {}

  /**
   * Get institution performance metrics
   * Delegates to domain service for placement statistics
   */
  async getInstitutionPerformance(institutionId: string, params: {
    fromDate?: Date;
    toDate?: Date;
  }) {
    const { fromDate, toDate } = params;

    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${institutionId} not found`);
    }

    // Use placement service for statistics
    const placementStats = await this.placementService.getPlacementStatistics(institutionId);

    // Only count self-identified internships
    const dateFilter: Prisma.InternshipApplicationWhereInput = {
      student: { institutionId },
      isSelfIdentified: true,
    };

    if (fromDate || toDate) {
      dateFilter.createdAt = {};
      if (fromDate) dateFilter.createdAt.gte = fromDate;
      if (toDate) dateFilter.createdAt.lte = toDate;
    }

    const [
      totalStudents,
      totalApplications,
      approvedApplications,
      completedApplications,
      totalInternships,
      facultyVisits,
      monthlyReports,
    ] = await Promise.all([
      this.prisma.student.count({ where: { institutionId, isActive: true } }),
      this.prisma.internshipApplication.count({ where: dateFilter }),
      this.prisma.internshipApplication.count({
        where: { ...dateFilter, status: ApplicationStatus.APPROVED },
      }),
      this.prisma.internshipApplication.count({
        where: { ...dateFilter, status: ApplicationStatus.COMPLETED },
      }),
      this.prisma.internship.count({ where: { institutionId } }),
      this.prisma.facultyVisitLog.count({
        where: { application: { student: { institutionId } } },
      }),
      this.prisma.monthlyReport.count({
        where: { student: { institutionId } },
      }),
    ]);

    const approvalRate = totalApplications > 0
      ? ((approvedApplications / totalApplications) * 100).toFixed(2)
      : 0;

    const completionRate = approvedApplications > 0
      ? ((completedApplications / approvedApplications) * 100).toFixed(2)
      : 0;

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
        totalInternships,
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
  async getMonthlyReportStats(params: {
    institutionId?: string;
    month?: number;
    year?: number;
  }) {
    const { institutionId, month, year } = params;
    const targetMonth = month ?? new Date().getMonth() + 1;
    const targetYear = year ?? new Date().getFullYear();

    // Use domain service for monthly report stats
    const domainStats = await this.stateReportService.getMonthlyReportStats(targetMonth, targetYear);

    // Add institution-specific filter if needed
    if (institutionId) {
      const where: Prisma.MonthlyReportWhereInput = {
        student: { institutionId },
        reportMonth: targetMonth,
        reportYear: targetYear,
      };

      const [total, draft, submitted, approved, rejected] = await Promise.all([
        this.prisma.monthlyReport.count({ where }),
        this.prisma.monthlyReport.count({ where: { ...where, status: 'DRAFT' } }),
        this.prisma.monthlyReport.count({ where: { ...where, status: 'SUBMITTED' } }),
        this.prisma.monthlyReport.count({ where: { ...where, status: 'APPROVED' } }),
        this.prisma.monthlyReport.count({ where: { ...where, status: 'REJECTED' } }),
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
              internships: true,
              industries: true,
              placements: true,
            },
          },
        },
      }),
      this.prisma.institution.count({ where: createdAtFilter }),
    ]);

    return {
      data: institutions,
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
   * Uses domain service for detailed stats
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

    // Use domain service for base stats
    const baseStats = await this.stateReportService.getFacultyVisitStats(month, year);

    const where: Prisma.FacultyVisitLogWhereInput = {};

    if (institutionId) {
      where.application = { student: { institutionId } };
    }

    if (facultyId) {
      where.facultyId = facultyId;
    }

    if (fromDate || toDate) {
      where.visitDate = {};
      if (fromDate) where.visitDate.gte = fromDate;
      if (toDate) where.visitDate.lte = toDate;
    }

    const [totalVisits, physicalVisits, virtualVisits, visitsByFaculty] = await Promise.all([
      this.prisma.facultyVisitLog.count({ where }),
      this.prisma.facultyVisitLog.count({ where: { ...where, visitType: 'PHYSICAL' } }),
      this.prisma.facultyVisitLog.count({ where: { ...where, visitType: 'VIRTUAL' } }),
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
        byFaculty: visitsByFaculty.map(v => ({ facultyId: v.facultyId, count: v._count })),
      },
    };
  }

  /**
   * Get top performing institutions
   * Uses same compliance formula as getInstitutionsWithStats for consistency
   * OPTIMIZED: Uses groupBy aggregations instead of N+1 queries per institution
   */
  async getTopPerformers(params: { limit?: number; month?: number; year?: number }) {
    const { limit = 5, month, year } = params;
    const cacheKey = `state:top-performers:${limit}:${month || 'current'}:${year || 'current'}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // Get current month info for stats
        const now = new Date();
        const currentMonth = month ?? now.getMonth() + 1;
        const currentYear = year ?? now.getFullYear();

        // Get all institutions from LookupService (cached)
        const { institutions } = await this.lookupService.getInstitutions();
        const institutionIds = institutions.map(inst => inst.id);

        // Batch fetch all counts using groupBy - reduces from N*7 queries to 7 queries total
        const [
          studentCountsByInst,
          approvedAppsByInst,
          inTrainingByInst,
          joiningLettersByInst,
          mentorAssignmentsByInst,
          reportsThisMonthByInst,
        ] = await Promise.all([
          // Total students by institution
          this.prisma.student.groupBy({
            by: ['institutionId'],
            where: { institutionId: { in: institutionIds } },
            _count: { id: true },
          }),
          // Approved self-identified applications by institution
          this.prisma.internshipApplication.groupBy({
            by: ['studentId'],
            where: {
              student: { institutionId: { in: institutionIds } },
              isSelfIdentified: true,
              status: ApplicationStatus.APPROVED,
            },
            _count: { id: true },
          }).then(async (results) => {
            // We need to map studentId to institutionId
            const studentIds = results.map(r => r.studentId);
            const students = await this.prisma.student.findMany({
              where: { id: { in: studentIds } },
              select: { id: true, institutionId: true },
            });
            const studentToInst = new Map(students.map(s => [s.id, s.institutionId]));
            const instCounts = new Map<string, number>();
            results.forEach(r => {
              const instId = studentToInst.get(r.studentId);
              if (instId) {
                instCounts.set(instId, (instCounts.get(instId) || 0) + r._count.id);
              }
            });
            return instCounts;
          }),
          // Internships in training by institution (simplified - count approved self-identified)
          this.prisma.internshipApplication.groupBy({
            by: ['studentId'],
            where: {
              student: { institutionId: { in: institutionIds } },
              isSelfIdentified: true,
              status: ApplicationStatus.APPROVED,
              OR: [
                { startDate: null },
                {
                  startDate: { lte: now },
                  OR: [
                    { endDate: { gte: now } },
                    { endDate: null },
                  ],
                },
              ],
            },
            _count: { id: true },
          }).then(async (results) => {
            const studentIds = results.map(r => r.studentId);
            const students = await this.prisma.student.findMany({
              where: { id: { in: studentIds } },
              select: { id: true, institutionId: true },
            });
            const studentToInst = new Map(students.map(s => [s.id, s.institutionId]));
            const instCounts = new Map<string, number>();
            results.forEach(r => {
              const instId = studentToInst.get(r.studentId);
              if (instId) {
                instCounts.set(instId, (instCounts.get(instId) || 0) + r._count.id);
              }
            });
            return instCounts;
          }),
          // Joining letters submitted by institution
          this.prisma.internshipApplication.groupBy({
            by: ['studentId'],
            where: {
              student: { institutionId: { in: institutionIds } },
              isSelfIdentified: true,
              joiningLetterUrl: { not: null },
            },
            _count: { id: true },
          }).then(async (results) => {
            const studentIds = results.map(r => r.studentId);
            const students = await this.prisma.student.findMany({
              where: { id: { in: studentIds } },
              select: { id: true, institutionId: true },
            });
            const studentToInst = new Map(students.map(s => [s.id, s.institutionId]));
            const instCounts = new Map<string, number>();
            results.forEach(r => {
              const instId = studentToInst.get(r.studentId);
              if (instId) {
                instCounts.set(instId, (instCounts.get(instId) || 0) + r._count.id);
              }
            });
            return instCounts;
          }),
          // Active mentor assignments by institution (unique students)
          this.prisma.mentorAssignment.findMany({
            where: {
              student: { institutionId: { in: institutionIds } },
              isActive: true,
            },
            select: { studentId: true, student: { select: { institutionId: true } } },
            distinct: ['studentId'],
          }).then((results) => {
            const instCounts = new Map<string, number>();
            results.forEach(r => {
              const instId = r.student.institutionId;
              if (instId) {
                instCounts.set(instId, (instCounts.get(instId) || 0) + 1);
              }
            });
            return instCounts;
          }),
          // Monthly reports submitted this month by institution
          this.prisma.monthlyReport.findMany({
            where: {
              student: {
                institutionId: { in: institutionIds },
                internshipApplications: {
                  some: {
                    isSelfIdentified: true,
                    status: ApplicationStatus.APPROVED,
                  },
                },
              },
              reportMonth: currentMonth,
              reportYear: currentYear,
              status: { in: [MonthlyReportStatus.SUBMITTED, MonthlyReportStatus.APPROVED] },
            },
            select: { studentId: true, student: { select: { institutionId: true } } },
          }).then((results) => {
            const instCounts = new Map<string, number>();
            results.forEach(r => {
              const instId = r.student.institutionId;
              if (instId) {
                instCounts.set(instId, (instCounts.get(instId) || 0) + 1);
              }
            });
            return instCounts;
          }),
        ]);

        // Build lookup maps for student counts
        const studentCountMap = new Map(
          studentCountsByInst.map(s => [s.institutionId, s._count.id])
        );

        // Calculate performance for each institution
        const performanceWithStats = institutions.map((inst) => {
          const totalStudents = studentCountMap.get(inst.id) || 0;
          const selfIdentifiedApproved = approvedAppsByInst.get(inst.id) || 0;
          const internshipsInTraining = inTrainingByInst.get(inst.id) || 0;
          const joiningLettersSubmitted = joiningLettersByInst.get(inst.id) || 0;
          const activeAssignments = mentorAssignmentsByInst.get(inst.id) || 0;
          const reportsSubmittedThisMonth = reportsThisMonthByInst.get(inst.id) || 0;

          // Calculate unassigned (total students - students with mentors)
          const unassigned = Math.max(0, totalStudents - activeAssignments);

          // Calculate compliance score
          const mentorAssignmentRate = totalStudents > 0
            ? Math.min((activeAssignments / totalStudents) * 100, 100)
            : 100;
          const joiningLetterRate = selfIdentifiedApproved > 0
            ? Math.min((joiningLettersSubmitted / selfIdentifiedApproved) * 100, 100)
            : 0;
          const monthlyReportRate = internshipsInTraining > 0
            ? Math.min((reportsSubmittedThisMonth / internshipsInTraining) * 100, 100)
            : 100;
          const complianceScore = Math.round((mentorAssignmentRate + joiningLetterRate + monthlyReportRate) / 3);

          return {
            id: inst.id,
            name: inst.name,
            code: inst.code,
            city: inst.city,
            stats: {
              totalStudents,
              studentsWithInternships: selfIdentifiedApproved,
              selfIdentifiedApproved,
              joiningLettersSubmitted,
              assigned: activeAssignments,
              unassigned,
              reportsSubmitted: reportsSubmittedThisMonth,
              complianceScore,
            },
            score: complianceScore,
            placementRate: complianceScore,
          };
        });

        const sorted = performanceWithStats.sort((a, b) => b.score - a.score);

        return {
          topPerformers: sorted.slice(0, limit),
          bottomPerformers: sorted.slice(-limit).reverse(),
        };
      },
      { ttl: 900, tags: ['state', 'top-performers'] }, // OPTIMIZED: Increased from 5 to 15 minutes
    );
  }

  /**
   * Get joining letter statistics
   * Delegates to domain StateReportService
   */
  async getJoiningLetterStats() {
    return this.stateReportService.getJoiningLetterStats();
  }

  /**
   * Get state-wide placement trends
   * Aggregates trends across all institutions
   */
  async getStateWidePlacementTrends(years: number = 5) {
    const cacheKey = `state:placement:trends:${years}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - years;

        const placements = await this.prisma.placement.findMany({
          where: {
            createdAt: { gte: new Date(startYear, 0, 1) },
          },
          include: {
            student: {
              include: { Institution: true },
            },
          },
        });

        // Aggregate by year
        const yearlyStats = placements.reduce((acc, p) => {
          const year = p.createdAt.getFullYear();
          if (!acc[year]) {
            acc[year] = {
              year,
              totalPlacements: 0,
              totalSalary: 0,
              students: new Set<string>(),
              institutions: new Set<string>(),
            };
          }
          acc[year].totalPlacements++;
          acc[year].totalSalary += p.salary ?? 0;
          acc[year].students.add(p.studentId);
          if (p.student?.institutionId) {
            acc[year].institutions.add(p.student.institutionId);
          }
          return acc;
        }, {} as Record<number, any>);

        return Object.values(yearlyStats)
          .map((stat: any) => ({
            year: stat.year,
            totalPlacements: stat.totalPlacements,
            placedStudents: stat.students.size,
            participatingInstitutions: stat.institutions.size,
            averageSalary: stat.totalPlacements > 0 ? Math.round(stat.totalSalary / stat.totalPlacements) : 0,
          }))
          .sort((a: any, b: any) => a.year - b.year);
      },
      { ttl: 600, tags: ['state', 'placements'] },
    );
  }

  /**
   * Get state-wide placement statistics
   * Aggregates stats across all institutions
   */
  async getStateWidePlacementStats() {
    const cacheKey = 'state:placement:stats';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const [totalStudents, placements, lookupData] = await Promise.all([
          this.prisma.student.count({ where: { isActive: true } }),
          this.prisma.placement.findMany({
            include: {
              student: { include: { branch: true, Institution: true } },
            },
          }),
          this.lookupService.getInstitutions(),
        ]);
        const institutions = lookupData.institutions;

        const placedStudents = new Set(placements.map(p => p.studentId)).size;
        const totalPlacements = placements.length;
        const totalSalary = placements.reduce((sum, p) => sum + (p.salary ?? 0), 0);
        const highestSalary = placements.length > 0
          ? Math.max(...placements.map(p => p.salary ?? 0))
          : 0;

        // Status breakdown
        const statusBreakdown = placements.reduce((acc, p) => {
          acc[p.status] = (acc[p.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // Top companies
        const companyStats = placements.reduce((acc, p) => {
          acc[p.companyName] = (acc[p.companyName] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const topCompanies = Object.entries(companyStats)
          .map(([company, count]) => ({ company, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        // Branch-wise stats
        const branchStats = placements.reduce((acc, p) => {
          const branchName = p.student?.branch?.name || 'Unknown';
          if (!acc[branchName]) {
            acc[branchName] = { branch: branchName, placements: 0, students: new Set<string>() };
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

        // Institution-wise stats
        const institutionStats = placements.reduce((acc, p) => {
          const instId = p.student?.institutionId;
          const instName = p.student?.Institution?.name || 'Unknown';
          if (instId && !acc[instId]) {
            acc[instId] = { id: instId, name: instName, placements: 0, students: new Set<string>() };
          }
          if (instId) {
            acc[instId].placements++;
            acc[instId].students.add(p.studentId);
          }
          return acc;
        }, {} as Record<string, any>);

        const institutionWiseStats = Object.values(institutionStats)
          .map((stat: any) => ({
            id: stat.id,
            name: stat.name,
            totalPlacements: stat.placements,
            placedStudents: stat.students.size,
          }))
          .sort((a: any, b: any) => b.placedStudents - a.placedStudents);

        return {
          overview: {
            totalStudents,
            placedStudents,
            totalPlacements,
            placementRate: totalStudents > 0 ? ((placedStudents / totalStudents) * 100).toFixed(2) : 0,
            averageSalary: totalPlacements > 0 ? Math.round(totalSalary / totalPlacements) : 0,
            highestSalary,
            participatingInstitutions: institutions.length,
          },
          statusBreakdown,
          topCompanies,
          branchWiseStats,
          institutionWiseStats: institutionWiseStats.slice(0, 10),
        };
      },
      { ttl: 600, tags: ['state', 'placements'] },
    );
  }

  /**
   * Get monthly analytics data
   */
  async getMonthlyAnalytics(params: { month?: number; year?: number }) {
    const { month, year } = params;
    const currentDate = new Date();
    const targetMonth = month ?? currentDate.getMonth() + 1;
    const targetYear = year ?? currentDate.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);

    const dateFilter = { createdAt: { gte: startDate, lte: endDate } };

    // Focus on self-identified internships only
    const [
      newStudents,
      newApplications,
      approvedApplications,
      newInternships,
      newIndustries,
      facultyVisits,
      monthlyReports,
    ] = await Promise.all([
      this.prisma.student.count({ where: dateFilter }),
      // Self-identified applications only
      this.prisma.internshipApplication.count({
        where: { ...dateFilter, isSelfIdentified: true },
      }),
      // Use APPROVED status for self-identified internships
      this.prisma.internshipApplication.count({
        where: { ...dateFilter, isSelfIdentified: true, status: ApplicationStatus.APPROVED },
      }),
      // Self-identified approved internships count (active internships)
      this.prisma.internshipApplication.count({
        where: { ...dateFilter, isSelfIdentified: true, status: ApplicationStatus.APPROVED },
      }),
      this.prisma.industry.count({ where: dateFilter }),
      this.prisma.facultyVisitLog.count({
        where: { visitDate: { gte: startDate, lte: endDate } },
      }),
      this.prisma.monthlyReport.count({
        where: { reportMonth: targetMonth, reportYear: targetYear },
      }),
    ]);

    // Get trend data (last 6 months) - focused on self-identified internships
    const trendData = [];
    for (let i = 5; i >= 0; i--) {
      const trendMonth = new Date(targetYear, targetMonth - 1 - i, 1);
      const trendEndDate = new Date(trendMonth.getFullYear(), trendMonth.getMonth() + 1, 0);

      const [applications, approved] = await Promise.all([
        this.prisma.internshipApplication.count({
          where: {
            createdAt: { gte: trendMonth, lte: trendEndDate },
            isSelfIdentified: true,
          },
        }),
        this.prisma.internshipApplication.count({
          where: {
            createdAt: { gte: trendMonth, lte: trendEndDate },
            isSelfIdentified: true,
            status: ApplicationStatus.APPROVED,
          },
        }),
      ]);

      trendData.push({
        month: trendMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        applications,
        approved,
        // Keep placements for backwards compatibility
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
        // Keep for backwards compatibility
        selectedApplications: approvedApplications,
        newInternships,
        newIndustries,
        facultyVisits,
        monthlyReports,
        approvalRate: newApplications > 0
          ? ((approvedApplications / newApplications) * 100).toFixed(2)
          : 0,
        // Keep for backwards compatibility
        placementRate: newApplications > 0
          ? ((approvedApplications / newApplications) * 100).toFixed(2)
          : 0,
      },
      trend: trendData,
    };
  }
}
