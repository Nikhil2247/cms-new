import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { LruCacheService } from '../../core/cache/lru-cache.service';
import { Prisma, ApplicationStatus, InternshipStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Import domain services for business logic reuse
import { StateReportService } from '../../domain/report/state/state-report.service';
import { PlacementService } from '../../domain/placement/placement.service';
import { InternshipApplicationService } from '../../domain/internship/application/internship-application.service';
import { FacultyVisitService } from '../../domain/report/faculty-visit/faculty-visit.service';
import { MonthlyReportService } from '../../domain/report/monthly/monthly-report.service';

@Injectable()
export class StateService {
  private readonly logger = new Logger(StateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    // Domain services for business logic
    private readonly stateReportService: StateReportService,
    private readonly placementService: PlacementService,
    private readonly applicationService: InternshipApplicationService,
    private readonly facultyVisitService: FacultyVisitService,
    private readonly monthlyReportService: MonthlyReportService,
  ) {}

  /**
   * Get State Directorate Dashboard Statistics
   * Uses domain services where available, with state-level aggregation
   */
  async getDashboardStats() {
    const cacheKey = 'state:dashboard:stats';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const now = new Date();
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const lastMonthDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Current and previous month dates for detailed stats
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        // Start of current month and previous month
        const startOfCurrentMonth = new Date(currentYear, currentMonth - 1, 1);
        const startOfPrevMonth = new Date(prevMonthYear, prevMonth - 1, 1);
        const endOfPrevMonth = new Date(currentYear, currentMonth - 1, 0);

        // Use parallel queries for efficiency
        // Only count self-identified internships (not placement-based)
        const [
          totalInstitutions,
          activeInstitutions,
          totalStudents,
          activeStudents,
          totalFaculty,
          activeFaculty,
          totalSelfIdentifiedInternships,
          activeSelfIdentifiedInternships,
          totalApplications,
          acceptedApplications,
          totalIndustries,
          approvedIndustries,
          // Mentor assignments
          totalAssignments,
          activeAssignments,
          // Faculty visits
          visitsThisMonth,
          visitsLastMonth,
          totalFacultyVisits,
          // Monthly reports
          reportsSubmittedThisMonth,
          reportsSubmittedLastMonth,
          reportsPendingReview,
          reportsApprovedThisMonth,
          totalReportsSubmitted,
          // Recent activity
          recentApplications,
          recentIndustryRegistrations,
        ] = await this.prisma.$transaction([
          this.prisma.institution.count(),
          this.prisma.institution.count({ where: { isActive: true } }),
          this.prisma.student.count(),
          this.prisma.student.count({ where: { isActive: true } }),
          this.prisma.user.count({
            where: { role: { in: [Role.TEACHER, Role.FACULTY_SUPERVISOR] } },
          }),
          this.prisma.user.count({
            where: {
              role: { in: [Role.TEACHER, Role.FACULTY_SUPERVISOR] },
              active: true,
            },
          }),
          // Count self-identified internships only
          this.prisma.internshipApplication.count({
            where: { isSelfIdentified: true },
          }),
          this.prisma.internshipApplication.count({
            where: {
              isSelfIdentified: true,
              internshipStatus: 'ONGOING',
            },
          }),
          // All application counts are for self-identified only
          this.prisma.internshipApplication.count({
            where: { isSelfIdentified: true },
          }),
          this.prisma.internshipApplication.count({
            where: { isSelfIdentified: true, status: ApplicationStatus.APPROVED },
          }),
          this.prisma.industry.count(),
          this.prisma.industry.count({
            where: { isApproved: true, isVerified: true },
          }),
          // Mentor assignments
          this.prisma.mentorAssignment.count(),
          this.prisma.mentorAssignment.count({ where: { isActive: true } }),
          // Faculty visits - this month
          this.prisma.facultyVisitLog.count({
            where: { visitDate: { gte: startOfCurrentMonth } },
          }),
          // Faculty visits - last month
          this.prisma.facultyVisitLog.count({
            where: { visitDate: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
          }),
          // Total faculty visits
          this.prisma.facultyVisitLog.count(),
          // Monthly reports - submitted this month
          this.prisma.monthlyReport.count({
            where: {
              reportMonth: currentMonth,
              reportYear: currentYear,
              status: { in: ['SUBMITTED', 'APPROVED'] },
            },
          }),
          // Monthly reports - submitted last month
          this.prisma.monthlyReport.count({
            where: {
              reportMonth: prevMonth,
              reportYear: prevMonthYear,
              status: { in: ['SUBMITTED', 'APPROVED'] },
            },
          }),
          // Monthly reports - pending review
          this.prisma.monthlyReport.count({ where: { status: 'SUBMITTED' } }),
          // Monthly reports - approved this month
          this.prisma.monthlyReport.count({
            where: {
              reportMonth: currentMonth,
              reportYear: currentYear,
              status: 'APPROVED',
            },
          }),
          // Total reports submitted
          this.prisma.monthlyReport.count({
            where: { status: { in: ['SUBMITTED', 'APPROVED'] } },
          }),
          // Recent activity
          this.prisma.internshipApplication.count({
            where: { isSelfIdentified: true, createdAt: { gte: lastWeek } },
          }),
          this.prisma.industry.count({
            where: { createdAt: { gte: lastMonthDate } },
          }),
        ]);

        // Calculate students with ongoing internships who need mentor assignments
        const studentsWithOngoingInternships = activeSelfIdentifiedInternships;
        const unassignedStudents = Math.max(0, studentsWithOngoingInternships - activeAssignments);

        // Calculate expected reports and visits
        const expectedReportsThisMonth = activeSelfIdentifiedInternships;
        const missingReportsThisMonth = Math.max(0, expectedReportsThisMonth - reportsSubmittedThisMonth);
        const missingReportsLastMonth = Math.max(0, expectedReportsThisMonth - reportsSubmittedLastMonth);
        const expectedVisitsThisMonth = activeSelfIdentifiedInternships;
        const pendingVisitsThisMonth = Math.max(0, expectedVisitsThisMonth - visitsThisMonth);

        return {
          institutions: {
            total: totalInstitutions,
            active: activeInstitutions,
          },
          students: {
            total: totalStudents,
            active: activeStudents,
          },
          faculty: {
            total: totalFaculty,
            active: activeFaculty,
          },
          totalFaculty,
          activeFaculty,
          internships: {
            total: totalSelfIdentifiedInternships,
            active: activeSelfIdentifiedInternships,
          },
          applications: {
            total: totalApplications,
            accepted: acceptedApplications,
            approvalRate: totalApplications > 0
              ? ((acceptedApplications / totalApplications) * 100).toFixed(2)
              : 0,
          },
          industries: {
            total: totalIndustries,
            approved: approvedIndustries,
          },
          // Mentor Assignments Card
          assignments: {
            total: totalAssignments,
            active: activeAssignments,
            assigned: activeAssignments,
            unassigned: unassignedStudents,
            studentsWithInternships: studentsWithOngoingInternships,
          },
          // Faculty Visits Card with details
          facultyVisits: {
            total: totalFacultyVisits,
            thisMonth: visitsThisMonth,
            lastMonth: visitsLastMonth,
            expectedThisMonth: expectedVisitsThisMonth,
            pendingThisMonth: pendingVisitsThisMonth,
            completionRate: expectedVisitsThisMonth > 0
              ? ((visitsThisMonth / expectedVisitsThisMonth) * 100).toFixed(1)
              : '100',
          },
          // Monthly Reports Card with details
          monthlyReports: {
            total: totalReportsSubmitted,
            thisMonth: reportsSubmittedThisMonth,
            lastMonth: reportsSubmittedLastMonth,
            pendingReview: reportsPendingReview,
            approvedThisMonth: reportsApprovedThisMonth,
            expectedThisMonth: expectedReportsThisMonth,
            missingThisMonth: missingReportsThisMonth,
            missingLastMonth: missingReportsLastMonth,
            submissionRate: expectedReportsThisMonth > 0
              ? ((reportsSubmittedThisMonth / expectedReportsThisMonth) * 100).toFixed(1)
              : '100',
          },
          compliance: {
            totalVisits: totalFacultyVisits,
            pendingReports: reportsPendingReview,
          },
          recentActivity: {
            applicationsLastWeek: recentApplications,
            industriesLastMonth: recentIndustryRegistrations,
          },
        };
      },
      { ttl: 300, tags: ['state', 'dashboard'] },
    );
  }

  // Backwards-compatible alias
  async getDashboard() {
    return this.getDashboardStats();
  }

  /**
   * Get paginated list of institutions with filters
   */
  async getInstitutions(params: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    isActive?: boolean;
    cursor?: string;
  }) {
    const { page, limit, search, type, isActive, cursor } = params;

    const pageNum = Math.max(1, Math.floor(Number(page) || 1));
    const limitNum = Math.max(1, Math.min(100, Math.floor(Number(limit) || 10)));

    const where: Prisma.InstitutionWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { district: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (type) {
      where.type = type as any;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const query: Prisma.InstitutionFindManyArgs = {
      where,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            users: {
              where: {
                role: { in: [Role.TEACHER, Role.FACULTY_SUPERVISOR] },
              },
            },
            Student: true,
            internships: true,
            batches: true,
          },
        },
      },
    };

    if (cursor) {
      query.cursor = { id: cursor };
      query.skip = 1;
    } else {
      query.skip = Math.max(0, (pageNum - 1) * limitNum);
    }

    const [institutions, total] = await Promise.all([
      this.prisma.institution.findMany(query),
      this.prisma.institution.count({ where }),
    ]);

    const nextCursor = institutions.length === limitNum
      ? institutions[institutions.length - 1].id
      : null;

    return {
      data: institutions,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      nextCursor,
    };
  }

  /**
   * Get institutions with comprehensive statistics for dashboard
   * Includes: students, internships, assignments, visits, reports
   */
  async getInstitutionsWithStats(params: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { page = 1, limit = 10, search } = params;
    const skip = (page - 1) * limit;

    // Get current month info
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0);

    const where: Prisma.InstitutionWhereInput = { isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get institutions with basic info and batch all stats queries
    const [institutions, total] = await Promise.all([
      this.prisma.institution.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          code: true,
          city: true,
          isActive: true,
        },
      }),
      this.prisma.institution.count({ where }),
    ]);

    const institutionIds = institutions.map(i => i.id);

    // Batch all stats queries - run once for all institutions instead of N+1
    const [
      studentCounts,
      internshipCounts,
      assignmentCounts,
      visitCounts,
      reportCounts,
      facultyCounts,
    ] = await Promise.all([
      // 1. Total students per institution
      this.prisma.student.groupBy({
        by: ['institutionId'],
        where: { institutionId: { in: institutionIds }, isActive: true },
        _count: true,
      }),

      // 2. Students with active self-identified internships per institution
      this.prisma.internshipApplication.groupBy({
        by: ['studentId'],
        where: {
          student: { institutionId: { in: institutionIds } },
          isSelfIdentified: true,
          internshipStatus: 'ONGOING',
        },
        _count: true,
      }).then(async (results) => {
        // Get student institutionIds to group by institution
        const studentIds = results.map(r => r.studentId);
        if (studentIds.length === 0) return new Map<string, number>();

        const students = await this.prisma.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, institutionId: true },
        });

        const instCounts = new Map<string, number>();
        for (const student of students) {
          instCounts.set(student.institutionId, (instCounts.get(student.institutionId) || 0) + 1);
        }
        return instCounts;
      }),

      // 3. Active mentor assignments per institution
      this.prisma.mentorAssignment.groupBy({
        by: ['studentId'],
        where: {
          student: { institutionId: { in: institutionIds } },
          isActive: true,
        },
        _count: true,
      }).then(async (results) => {
        const studentIds = results.map(r => r.studentId);
        if (studentIds.length === 0) return new Map<string, number>();

        const students = await this.prisma.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, institutionId: true },
        });

        const instCounts = new Map<string, number>();
        for (const student of students) {
          instCounts.set(student.institutionId, (instCounts.get(student.institutionId) || 0) + 1);
        }
        return instCounts;
      }),

      // 4. Faculty visits this month per institution
      this.prisma.facultyVisitLog.findMany({
        where: {
          visitDate: { gte: startOfMonth, lte: endOfMonth },
          application: { student: { institutionId: { in: institutionIds } } },
        },
        select: {
          application: { select: { student: { select: { institutionId: true } } } },
        },
      }).then((results) => {
        const instCounts = new Map<string, number>();
        for (const visit of results) {
          const instId = visit.application.student.institutionId;
          instCounts.set(instId, (instCounts.get(instId) || 0) + 1);
        }
        return instCounts;
      }),

      // 5. Monthly reports submitted this month per institution
      this.prisma.monthlyReport.groupBy({
        by: ['studentId'],
        where: {
          student: { institutionId: { in: institutionIds } },
          reportMonth: currentMonth,
          reportYear: currentYear,
          status: { in: ['SUBMITTED', 'APPROVED'] },
        },
        _count: true,
      }).then(async (results) => {
        const studentIds = results.map(r => r.studentId);
        if (studentIds.length === 0) return new Map<string, number>();

        const students = await this.prisma.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, institutionId: true },
        });

        const instCounts = new Map<string, number>();
        for (const student of students) {
          instCounts.set(student.institutionId, (instCounts.get(student.institutionId) || 0) + 1);
        }
        return instCounts;
      }),

      // 6. Total faculty per institution
      this.prisma.user.groupBy({
        by: ['institutionId'],
        where: {
          institutionId: { in: institutionIds },
          role: { in: [Role.TEACHER, Role.FACULTY_SUPERVISOR] },
          active: true,
        },
        _count: true,
      }),
    ]);

    // Build lookup maps for O(1) access
    const studentCountMap = new Map(studentCounts.map(c => [c.institutionId, c._count]));
    const facultyCountMap = new Map(facultyCounts.map(c => [c.institutionId, c._count]));

    // Build institutions with stats
    const institutionsWithStats = institutions.map((inst) => {
      const totalStudents = studentCountMap.get(inst.id) || 0;
      const studentsWithInternships = internshipCounts.get(inst.id) || 0;
      const activeAssignments = assignmentCounts.get(inst.id) || 0;
      const facultyVisitsThisMonth = visitCounts.get(inst.id) || 0;
      const reportsSubmittedThisMonth = reportCounts.get(inst.id) || 0;
      const totalFaculty = facultyCountMap.get(inst.id) || 0;

      // Calculate unassigned students (those with internships but no mentor)
      const unassignedStudents = Math.max(0, studentsWithInternships - activeAssignments);

      // Calculate missing reports (students with internships who haven't submitted)
      const missingReports = Math.max(0, studentsWithInternships - reportsSubmittedThisMonth);

      return {
        ...inst,
        stats: {
          totalStudents,
          studentsWithInternships,
          assigned: activeAssignments,
          unassigned: unassignedStudents,
          facultyVisits: facultyVisitsThisMonth,
          reportsSubmitted: reportsSubmittedThisMonth,
          reportsMissing: missingReports,
          totalFaculty,
        },
      };
    });

    return {
      data: institutionsWithStats,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      month: currentMonth,
      year: currentYear,
    };
  }

  /**
   * Get institution by ID with detailed information
   */
  async getInstitutionById(id: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      include: {
        users: {
          where: { role: 'PRINCIPAL' },
          take: 10,
        },
        Student: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        batches: {
          where: { isActive: true },
        },
        _count: {
          select: {
            users: true,
            Student: true,
            internships: true,
            industries: true,
          },
        },
      },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${id} not found`);
    }

    return institution;
  }

  /**
   * Get institution overview with detailed statistics including self-identified internships
   */
  async getInstitutionOverview(id: string) {
    // Verify institution exists
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        district: true,
        type: true,
        isActive: true,
        address: true,
        contactEmail: true,
        contactPhone: true,
      },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${id} not found`);
    }
    const { contactEmail, contactPhone, ...institutionData } = institution;
    const normalizedInstitution = {
      ...institutionData,
      email: contactEmail ?? null,
      phoneNo: contactPhone ?? null,
    };

    // Get current month/year for time-based queries
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0);
    const completedThrough = now < endOfMonth ? now : endOfMonth;

    // Use Promise.all for parallel queries
    const [
      totalStudents,
      assignedStudents,
      internshipsAdded,
      internshipsActive,
      // Self-identified internship stats
      selfIdentifiedTotal,
      selfIdentifiedApproved,
      selfIdentifiedPending,
      selfIdentifiedRejected,
      // Joining letter stats
      joiningLettersSubmitted,
      joiningLettersPending,
      joiningLettersApproved,
      joiningLettersRejected,
      // Monthly reports stats
      monthlyReportsSubmitted,
      monthlyReportsPending,
      monthlyReportsApproved,
      monthlyReportsRejected,
      monthlyReportsNotSubmitted,
      // Faculty visits
      facultyVisitsScheduled,
      facultyVisitsCompleted,
      facultyVisitsToBeDone,
      // Branch-wise data
      branchWiseStudents,
      // Company count
      companiesCount,
      // Faculty count
      facultyCount,
    ] = await Promise.all([
      // Total students
      this.prisma.student.count({ where: { institutionId: id } }),

      // Assigned students (with active mentor)
      this.prisma.mentorAssignment.count({
        where: {
          student: { institutionId: id },
          isActive: true,
        },
      }),

      // Internships added by institution
      this.prisma.internship.count({ where: { institutionId: id } }),

      // Active internships
      this.prisma.internship.count({
        where: {
          institutionId: id,
          status: InternshipStatus.ACTIVE,
          isActive: true,
        },
      }),

      // Self-identified internship total
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id },
          isSelfIdentified: true,
        },
      }),

      // Self-identified approved
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id },
          isSelfIdentified: true,
          status: ApplicationStatus.APPROVED,
        },
      }),

      // Self-identified pending
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id },
          isSelfIdentified: true,
          status: ApplicationStatus.APPLIED,
        },
      }),

      // Self-identified rejected
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id },
          isSelfIdentified: true,
          status: ApplicationStatus.REJECTED,
        },
      }),

      // Joining letters submitted (self-identified with joining letter)
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id },
          isSelfIdentified: true,
          joiningLetterUrl: { not: null },
        },
      }),

      // Joining letters pending (approved self-identified without joining letter)
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id },
          isSelfIdentified: true,
          status: ApplicationStatus.APPROVED,
          joiningLetterUrl: null,
        },
      }),

      // Joining letters approved (with verified status)
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id },
          isSelfIdentified: true,
          joiningLetterUrl: { not: null },
          hasJoined: true,
        },
      }),

      // Joining letters rejected
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id },
          isSelfIdentified: true,
          joiningLetterUrl: { not: null },
          hasJoined: false,
          reviewedBy: { not: null },
        },
      }),

      // Monthly reports submitted for current month
      this.prisma.monthlyReport.count({
        where: {
          student: { institutionId: id },
          reportMonth: currentMonth,
          reportYear: currentYear,
          status: 'SUBMITTED',
        },
      }),

      // Monthly reports pending (draft) for current month
      this.prisma.monthlyReport.count({
        where: {
          student: { institutionId: id },
          reportMonth: currentMonth,
          reportYear: currentYear,
          status: 'DRAFT',
        },
      }),

      // Monthly reports approved
      this.prisma.monthlyReport.count({
        where: {
          student: { institutionId: id },
          reportMonth: currentMonth,
          reportYear: currentYear,
          status: 'APPROVED',
        },
      }),

      // Monthly reports rejected
      this.prisma.monthlyReport.count({
        where: {
          student: { institutionId: id },
          reportMonth: currentMonth,
          reportYear: currentYear,
          status: 'REJECTED',
        },
      }),

      // Students without monthly report this month (need to calculate after total students)
      this.prisma.student.count({
        where: {
          institutionId: id,
          monthlyReports: {
            none: {
              reportMonth: currentMonth,
              reportYear: currentYear,
            },
          },
          internshipApplications: {
            some: {
              status: ApplicationStatus.APPROVED,
              isSelfIdentified: true,
            },
          },
        },
      }),

      // Faculty visits scheduled this month
      this.prisma.facultyVisitLog.count({
        where: {
          application: { student: { institutionId: id } },
          visitDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),

      // Faculty visits completed this month
      this.prisma.facultyVisitLog.count({
        where: {
          application: { student: { institutionId: id } },
          visitDate: {
            gte: startOfMonth,
            lte: completedThrough,
          },
        },
      }),

      // Faculty visits to be done (scheduled but not completed)
      this.prisma.facultyVisitLog.count({
        where: {
          application: { student: { institutionId: id } },
          visitDate: {
            gt: now,
            lte: endOfMonth,
          },
        },
      }),

      // Branch-wise student distribution
      this.prisma.student.groupBy({
        by: ['branchName'],
        where: { institutionId: id },
        _count: { id: true },
      }),

      // Companies linked to institution
      this.prisma.industry.count({
        where: {
          internships: {
            some: { institutionId: id },
          },
        },
      }),

      // Faculty count
      this.prisma.user.count({
        where: {
          institutionId: id,
          role: { in: [Role.TEACHER, Role.FACULTY_SUPERVISOR] },
          active: true,
        },
      }),
    ]);

    const unassignedStudents = totalStudents - assignedStudents;

    // Calculate compliance score
    const mentorAssignmentRate = totalStudents > 0 ? (assignedStudents / totalStudents) * 100 : 0;
    const joiningLetterRate = selfIdentifiedApproved > 0 ? (joiningLettersSubmitted / selfIdentifiedApproved) * 100 : 0;
    const monthlyReportRate = selfIdentifiedApproved > 0 ? ((monthlyReportsSubmitted + monthlyReportsApproved) / selfIdentifiedApproved) * 100 : 0;
    const complianceScore = Math.round((mentorAssignmentRate + joiningLetterRate + monthlyReportRate) / 3);

    return {
      institution: normalizedInstitution,
      totalStudents,
      assignedStudents,
      unassignedStudents,
      internshipsAdded,
      internshipsActive,
      // Self-identified internship comprehensive data
      selfIdentifiedInternships: {
        total: selfIdentifiedTotal,
        approved: selfIdentifiedApproved,
        pending: selfIdentifiedPending,
        rejected: selfIdentifiedRejected,
        rate: totalStudents > 0 ? Math.round((selfIdentifiedTotal / totalStudents) * 100) : 0,
      },
      joiningLetterStatus: {
        submitted: joiningLettersSubmitted,
        pending: joiningLettersPending,
        approved: joiningLettersApproved,
        rejected: joiningLettersRejected,
        rate: selfIdentifiedApproved > 0 ? Math.round((joiningLettersSubmitted / selfIdentifiedApproved) * 100) : 0,
      },
      monthlyReportStatus: {
        submitted: monthlyReportsSubmitted,
        pending: monthlyReportsPending,
        approved: monthlyReportsApproved,
        rejected: monthlyReportsRejected,
        notSubmitted: monthlyReportsNotSubmitted,
        rate: selfIdentifiedApproved > 0 ? Math.round(((monthlyReportsSubmitted + monthlyReportsApproved) / selfIdentifiedApproved) * 100) : 0,
        currentMonth: currentMonth,
        currentYear: currentYear,
      },
      facultyVisits: {
        scheduled: facultyVisitsScheduled,
        completed: facultyVisitsCompleted,
        toBeDone: facultyVisitsToBeDone,
        completionRate: facultyVisitsScheduled > 0 ? Math.round((facultyVisitsCompleted / facultyVisitsScheduled) * 100) : 0,
      },
      mentorAssignment: {
        assigned: assignedStudents,
        unassigned: unassignedStudents,
        rate: mentorAssignmentRate,
      },
      branchWiseData: branchWiseStudents.map(b => ({
        branch: b.branchName || 'Unknown',
        count: b._count.id,
      })),
      companiesCount,
      facultyCount,
      complianceScore,
    };
  }

  /**
   * Get institution students with cursor pagination and comprehensive filters
   */
  async getInstitutionStudents(
    id: string,
    params: {
      cursor?: string;
      limit: number;
      search?: string;
      filter: 'assigned' | 'unassigned' | 'all';
      branch?: string;
      companyId?: string;
      reportStatus?: 'submitted' | 'pending' | 'not_submitted' | 'all';
      visitStatus?: 'visited' | 'pending' | 'all';
      selfIdentified?: 'yes' | 'no' | 'all';
    },
  ) {
    const { cursor, limit, search, filter, branch, companyId, reportStatus, visitStatus, selfIdentified } = params;

    // Verify institution exists
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${id} not found`);
    }

    // Get current month/year for report filtering
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Build where clause
    const where: Prisma.StudentWhereInput = { institutionId: id };

    // Apply search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { rollNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Apply assignment filter
    if (filter === 'assigned') {
      where.mentorAssignments = {
        some: { isActive: true },
      };
    } else if (filter === 'unassigned') {
      where.mentorAssignments = {
        none: { isActive: true },
      };
    }

    // Apply branch filter
    if (branch && branch !== 'all') {
      where.branchName = branch;
    }

    // Apply company filter
    if (companyId && companyId !== 'all') {
      where.internshipApplications = {
        some: {
          status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.SELECTED] },
          internship: {
            industryId: companyId,
          },
        },
      };
    }

    // Apply self-identified filter
    if (selfIdentified === 'yes') {
      where.internshipApplications = {
        ...where.internshipApplications,
        some: {
          ...(where.internshipApplications as any)?.some,
          isSelfIdentified: true,
        },
      };
    } else if (selfIdentified === 'no') {
      where.internshipApplications = {
        none: {
          isSelfIdentified: true,
        },
      };
    }

    // Apply report status filter
    if (reportStatus && reportStatus !== 'all') {
      if (reportStatus === 'submitted') {
        where.monthlyReports = {
          some: {
            reportMonth: currentMonth,
            reportYear: currentYear,
            status: { in: ['SUBMITTED', 'APPROVED'] },
          },
        };
      } else if (reportStatus === 'pending') {
        where.monthlyReports = {
          some: {
            reportMonth: currentMonth,
            reportYear: currentYear,
            status: 'DRAFT',
          },
        };
      } else if (reportStatus === 'not_submitted') {
        where.monthlyReports = {
          none: {
            reportMonth: currentMonth,
            reportYear: currentYear,
          },
        };
      }
    }

    // Build query with proper typing for cursor pagination
    const query: Prisma.StudentFindManyArgs = {
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        mentorAssignments: {
          where: { isActive: true },
          include: {
            mentor: {
              select: {
                id: true,
                name: true,
                email: true,
                phoneNo: true,
              },
            },
          },
        },
        internshipApplications: {
          where: {
            status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.SELECTED] },
          },
          include: {
            internship: {
              select: {
                id: true,
                title: true,
                industry: {
                  select: {
                    id: true,
                    companyName: true,
                    industryType: true,
                    city: true,
                  },
                },
              },
            },
            facultyVisitLogs: {
              orderBy: { visitDate: 'desc' as const },
              take: 1,
              select: {
                id: true,
                visitDate: true,
              },
            },
          },
        },
        monthlyReports: {
          where: {
            reportMonth: currentMonth,
            reportYear: currentYear,
          },
          orderBy: { submittedAt: 'desc' as const },
          take: 1,
          select: {
            id: true,
            status: true,
            submittedAt: true,
            reportMonth: true,
            reportYear: true,
          },
        },
      },
    };

    // Apply cursor pagination
    if (cursor) {
      query.cursor = { id: cursor };
      query.skip = 1;
    }

    // Execute queries in parallel
    const [students, total, branches] = await Promise.all([
      this.prisma.student.findMany(query),
      this.prisma.student.count({ where }),
      // Get unique branches for filter dropdown
      this.prisma.student.findMany({
        where: { institutionId: id },
        select: { branchName: true },
        distinct: ['branchName'],
      }),
    ]);

    // Transform students to include computed fields
    const resolveJoiningLetterStatus = (app: any) => {
      if (!app?.joiningLetterUrl) {
        return null;
      }
      if (app.hasJoined) {
        return 'APPROVED';
      }
      if (app.reviewedBy) {
        return 'REJECTED';
      }
      return 'PENDING';
    };

    const transformedStudents = students.map((student: any) => {
      const selfIdentifiedApp = student.internshipApplications?.find((app: any) => app.isSelfIdentified);
      const latestReport = student.monthlyReports?.[0];
      const latestVisit = student.internshipApplications?.[0]?.facultyVisitLogs?.[0];
      const activeMentor = student.mentorAssignments?.find((ma: any) => ma.isActive)?.mentor;
      const approvedApp = student.internshipApplications?.find((app: any) =>
        app.status === 'APPROVED' || app.status === 'SELECTED'
      );

      return {
        ...student,
        // Computed fields for easy access
        hasSelfIdentifiedInternship: !!selfIdentifiedApp,
        selfIdentifiedData: selfIdentifiedApp ? {
          companyName: selfIdentifiedApp.companyName,
          companyAddress: selfIdentifiedApp.companyAddress,
          companyContact: selfIdentifiedApp.companyContact,
          companyEmail: selfIdentifiedApp.companyEmail,
          hrName: selfIdentifiedApp.hrName,
          joiningLetterUrl: selfIdentifiedApp.joiningLetterUrl,
          joiningLetterStatus: resolveJoiningLetterStatus(selfIdentifiedApp),
          status: selfIdentifiedApp.status,
        } : null,
        currentMonthReport: latestReport ? {
          id: latestReport.id,
          status: latestReport.status,
          submittedAt: latestReport.submittedAt,
        } : null,
        lastFacultyVisit: latestVisit ? {
          id: latestVisit.id,
          date: latestVisit.visitDate,
          status: latestVisit.visitDate.getTime() <= now.getTime() ? 'COMPLETED' : 'SCHEDULED',
        } : null,
        mentor: activeMentor || null,
        company: approvedApp?.internship?.industry || null,
      };
    });

    // Calculate next cursor
    const hasMore = students.length === limit;
    const nextCursor = hasMore ? students[students.length - 1].id : null;

    return {
      students: transformedStudents,
      nextCursor,
      total,
      hasMore,
      filters: {
        branches: branches.map(b => b.branchName).filter(Boolean),
      },
    };
  }

  /**
   * Get institution companies with student counts, branch-wise data, and self-identified info
   * OPTIMIZED: Single query approach to avoid N+1 problem
   */
  async getInstitutionCompanies(id: string, params: { limit: number; search?: string }) {
    const { limit, search } = params;

    // Build where clause for industries - include institution check
    const industryWhere: Prisma.IndustryWhereInput = {
      internships: {
        some: { institutionId: id },
      },
    };

    if (search) {
      industryWhere.companyName = { contains: search, mode: 'insensitive' };
    }

    // Single optimized query - fetch industries with all related data in one go
    const industries = await this.prisma.industry.findMany({
      where: industryWhere,
      take: limit,
      select: {
        id: true,
        companyName: true,
        industryType: true,
        city: true,
        state: true,
        isApproved: true,
        isVerified: true,
        primaryEmail: true,
        primaryPhone: true,
        internships: {
          where: { institutionId: id },
          select: {
            applications: {
              where: {
                status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.SELECTED] },
                student: { institutionId: id },
              },
              select: {
                id: true,
                isSelfIdentified: true,
                status: true,
                joiningLetterUrl: true,
                hasJoined: true,
                reviewedBy: true,
                student: {
                  select: {
                    id: true,
                    name: true,
                    rollNumber: true,
                    branchName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Return early if no industries found
    if (industries.length === 0) {
      return {
        companies: [],
        total: 0,
        summary: { totalStudents: 0, totalSelfIdentified: 0, selfIdentifiedRate: 0 },
      };
    }

    // Transform data in memory (no additional queries)
    const companiesWithData = industries.map((industry) => {
      const resolveJoiningLetterStatus = (app: any) => {
        if (!app?.joiningLetterUrl) {
          return null;
        }
        if (app.hasJoined) {
          return 'APPROVED';
        }
        if (app.reviewedBy) {
          return 'REJECTED';
        }
        return 'PENDING';
      };

      // Flatten all applications from all internships for this company
      const allApplications = industry.internships.flatMap(i => i.applications);

      // Use a Map to deduplicate students (student might have multiple applications)
      const studentMap = new Map<string, any>();
      let selfIdentifiedCount = 0;

      allApplications.forEach((app) => {
        const student = app.student;
        if (!studentMap.has(student.id)) {
          studentMap.set(student.id, {
            id: student.id,
            name: student.name,
            rollNumber: student.rollNumber,
            branch: student.branchName,
            email: student.email,
            isSelfIdentified: app.isSelfIdentified || false,
            joiningLetterStatus: resolveJoiningLetterStatus(app),
          });
          if (app.isSelfIdentified) {
            selfIdentifiedCount++;
          }
        }
      });

      const students = Array.from(studentMap.values());

      // Calculate branch-wise distribution
      const branchWise: Record<string, { total: number; selfIdentified: number }> = {};
      students.forEach((student) => {
        const branch = student.branch || 'Unknown';
        if (!branchWise[branch]) {
          branchWise[branch] = { total: 0, selfIdentified: 0 };
        }
        branchWise[branch].total++;
        if (student.isSelfIdentified) {
          branchWise[branch].selfIdentified++;
        }
      });

      // Remove internships from response (not needed in frontend)
      const { internships, primaryEmail, primaryPhone, ...industryData } = industry;

      return {
        ...industryData,
        email: primaryEmail,
        phoneNo: primaryPhone,
        studentCount: students.length,
        selfIdentifiedCount,
        branchWiseData: Object.entries(branchWise).map(([branch, data]) => ({
          branch,
          total: data.total,
          selfIdentified: data.selfIdentified,
        })),
        students,
      };
    });

    // Filter out companies with no students and sort by student count
    const filteredCompanies = companiesWithData
      .filter(c => c.studentCount > 0)
      .sort((a, b) => b.studentCount - a.studentCount);

    // Calculate summary
    const totalStudents = filteredCompanies.reduce((sum, c) => sum + c.studentCount, 0);
    const totalSelfIdentified = filteredCompanies.reduce((sum, c) => sum + c.selfIdentifiedCount, 0);

    return {
      companies: filteredCompanies,
      total: filteredCompanies.length,
      summary: {
        totalStudents,
        totalSelfIdentified,
        selfIdentifiedRate: totalStudents > 0 ? Math.round((totalSelfIdentified / totalStudents) * 100) : 0,
      },
    };
  }

  /**
   * Get institution faculty and principal with stats
   * OPTIMIZED: Batch queries to avoid N+1 problem
   */
  async getInstitutionFacultyAndPrincipal(id: string) {
    // Get current month for visit stats - compute once
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0);

    // Fetch all users (principal + faculty) in a single query
    const completedThrough = now < endOfMonth ? now : endOfMonth;
    const [allUsers, mentorStats, visitStats, completedVisitStats, reportStats, principalStatsData] = await Promise.all([
      // Get all users at once
      this.prisma.user.findMany({
        where: {
          institutionId: id,
          role: { in: [Role.PRINCIPAL, Role.TEACHER, Role.FACULTY_SUPERVISOR] },
          active: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phoneNo: true,
          role: true,
          branchName: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      }),

      // Get mentor assignment counts grouped by mentor
      this.prisma.mentorAssignment.groupBy({
        by: ['mentorId'],
        where: {
          mentor: { institutionId: id },
          isActive: true,
        },
        _count: { id: true },
      }),

      // Get faculty visit stats grouped by faculty
      this.prisma.facultyVisitLog.groupBy({
        by: ['facultyId'],
        where: {
          faculty: { institutionId: id },
          visitDate: { gte: startOfMonth, lte: endOfMonth },
        },
        _count: { id: true },
      }),

      // Get completed visit stats grouped by faculty
      this.prisma.facultyVisitLog.groupBy({
        by: ['facultyId'],
        where: {
          faculty: { institutionId: id },
          visitDate: { gte: startOfMonth, lte: completedThrough },
        },
        _count: { id: true },
      }),

      // Get monthly report review counts grouped by reviewer (only where reviewedBy is not null)
      this.prisma.monthlyReport.groupBy({
        by: ['reviewedBy'],
        where: {
          reviewedBy: { not: null },
          reviewedAt: { gte: startOfMonth, lte: endOfMonth },
          application: { student: { institutionId: id } },
        },
        _count: { id: true },
      }),

      // Get principal stats in one query
      Promise.all([
        this.prisma.student.count({ where: { institutionId: id } }),
        this.prisma.user.count({
          where: { institutionId: id, role: { in: [Role.TEACHER, Role.FACULTY_SUPERVISOR] }, active: true },
        }),
        this.prisma.internshipApplication.count({
          where: { student: { institutionId: id }, status: ApplicationStatus.APPLIED },
        }),
      ]),
    ]);

    // Return early if no users found (institution doesn't exist or has no users)
    if (allUsers.length === 0) {
      return {
        principal: null,
        faculty: [],
        summary: {
          totalFaculty: 0,
          totalStudentsAssigned: 0,
          totalVisitsScheduled: 0,
          totalVisitsCompleted: 0,
          overallVisitCompletionRate: 0,
        },
      };
    }

    // Create lookup maps for O(1) access
    const mentorCountMap = new Map(
      mentorStats.map(m => [m.mentorId, m._count.id])
    );

    // Process visit stats into a nested map: facultyId -> { scheduled, completed }
    const visitCountMap = new Map<string, { scheduled: number; completed: number }>();
    visitStats.forEach(v => {
      visitCountMap.set(v.facultyId, { scheduled: v._count.id, completed: 0 });
    });
    completedVisitStats.forEach(v => {
      const entry = visitCountMap.get(v.facultyId) || { scheduled: 0, completed: 0 };
      entry.completed = v._count.id;
      visitCountMap.set(v.facultyId, entry);
    });

    const reportCountMap = new Map(
      reportStats.filter(r => r.reviewedBy).map(r => [r.reviewedBy!, r._count.id])
    );

    // Separate principal and faculty
    const principal = allUsers.find(u => u.role === 'PRINCIPAL') || null;
    const faculty = allUsers.filter(u => u.role !== 'PRINCIPAL');

    // Attach stats to faculty (no additional queries)
    const facultyWithStats = faculty.map(f => {
      const assignedStudents = mentorCountMap.get(f.id) || 0;
      const visits = visitCountMap.get(f.id) || { scheduled: 0, completed: 0 };
      const reportsReviewed = reportCountMap.get(f.id) || 0;

      return {
        ...f,
        stats: {
          assignedStudents,
          visitsScheduled: visits.scheduled,
          visitsCompleted: visits.completed,
          visitsPending: visits.scheduled - visits.completed,
          reportsReviewed,
          visitCompletionRate: visits.scheduled > 0
            ? Math.round((visits.completed / visits.scheduled) * 100)
            : 0,
        },
      };
    });

    // Principal stats
    const principalStats = principal ? {
      totalStudents: principalStatsData[0],
      totalFaculty: principalStatsData[1],
      pendingApprovals: principalStatsData[2],
    } : null;

    // Summary statistics (computed from already fetched data)
    const totalAssigned = facultyWithStats.reduce((sum, f) => sum + f.stats.assignedStudents, 0);
    const totalVisitsCompleted = facultyWithStats.reduce((sum, f) => sum + f.stats.visitsCompleted, 0);
    const totalVisitsScheduled = facultyWithStats.reduce((sum, f) => sum + f.stats.visitsScheduled, 0);

    return {
      principal: principal ? {
        ...principal,
        stats: principalStats,
      } : null,
      faculty: facultyWithStats,
      summary: {
        totalFaculty: faculty.length,
        totalStudentsAssigned: totalAssigned,
        totalVisitsScheduled,
        totalVisitsCompleted,
        overallVisitCompletionRate: totalVisitsScheduled > 0 ? Math.round((totalVisitsCompleted / totalVisitsScheduled) * 100) : 0,
      },
    };
  }

  /**
   * Create a new institution
   */
  async createInstitution(data: Prisma.InstitutionCreateInput) {
    const institution = await this.prisma.institution.create({
      data,
      include: {
        _count: {
          select: {
            users: true,
            Student: true,
          },
        },
      },
    });

    await this.cache.invalidateByTags(['state', 'institutions']);
    return institution;
  }

  /**
   * Update institution details
   */
  async updateInstitution(id: string, data: Prisma.InstitutionUpdateInput) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${id} not found`);
    }

    const updated = await this.prisma.institution.update({
      where: { id },
      data,
    });

    await this.cache.invalidateByTags(['state', 'institutions', `institution:${id}`]);
    return updated;
  }

  /**
   * Delete institution (soft delete)
   */
  async deleteInstitution(id: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${id} not found`);
    }

    const activeStudentsCount = await this.prisma.student.count({
      where: { institutionId: id, isActive: true },
    });

    if (activeStudentsCount > 0) {
      throw new BadRequestException(
        `Cannot delete institution with ${activeStudentsCount} active students`,
      );
    }

    const deleted = await this.prisma.institution.update({
      where: { id },
      data: { isActive: false },
    });

    await this.cache.invalidateByTags(['state', 'institutions', `institution:${id}`]);
    return deleted;
  }

  /**
   * Get list of principals with filters
   */
  async getPrincipals(params: {
    institutionId?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { institutionId, page = 1, limit = 10, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = { role: 'PRINCIPAL' };

    if (institutionId) {
      where.institutionId = institutionId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [principals, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          Institution: {
            select: { id: true, name: true, code: true, city: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: principals,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new principal account
   */
  async createPrincipal(data: {
    name: string;
    email: string;
    password: string;
    institutionId: string;
    phoneNo?: string;
    designation?: string;
  }) {
    const institution = await this.prisma.institution.findUnique({
      where: { id: data.institutionId },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${data.institutionId} not found`);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new BadRequestException(`User with email ${data.email} already exists`);
    }

    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const principal = await this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        role: 'PRINCIPAL',
        active: true,
        hasChangedDefaultPassword: false,
      },
      include: { Institution: true },
    });

    // Remove password from response
    const { password: _, ...principalWithoutPassword } = principal;

    await this.cache.invalidateByTags(['state', 'principals']);
    return principalWithoutPassword;
  }

  /**
   * Get principal by ID
   */
  async getPrincipalById(id: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id, role: 'PRINCIPAL' },
      include: {
        Institution: {
          select: { id: true, name: true, code: true, city: true },
        },
      },
    });

    if (!principal) {
      throw new NotFoundException(`Principal with ID ${id} not found`);
    }

    return principal;
  }

  /**
   * Update principal by ID
   */
  async updatePrincipal(id: string, data: {
    name?: string;
    email?: string;
    phoneNo?: string;
    phone?: string;
    institutionId?: string;
    isActive?: boolean;
    active?: boolean;
    dob?: string;
    dateOfBirth?: string;
    designation?: string;
  }) {
    const existingPrincipal = await this.prisma.user.findUnique({
      where: { id, role: 'PRINCIPAL' },
    });

    if (!existingPrincipal) {
      throw new NotFoundException(`Principal with ID ${id} not found`);
    }

    if (data.institutionId) {
      const institution = await this.prisma.institution.findUnique({
        where: { id: data.institutionId },
      });

      if (!institution) {
        throw new NotFoundException(`Institution with ID ${data.institutionId} not found`);
      }
    }

    // Check if email is being changed and if it's already in use
    if (data.email && data.email !== existingPrincipal.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (emailExists) {
        throw new BadRequestException(`Email ${data.email} is already in use`);
      }
    }

    // Map frontend field names to Prisma field names
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.phoneNo || data.phone) updateData.phoneNo = data.phoneNo || data.phone;
    if (data.institutionId) updateData.institutionId = data.institutionId;
    if (data.designation) updateData.designation = data.designation;
    if (data.dob || data.dateOfBirth) updateData.dob = data.dob || data.dateOfBirth;
    if (typeof data.active === 'boolean') updateData.active = data.active;
    if (typeof data.isActive === 'boolean') updateData.active = data.isActive;

    const updatedPrincipal = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        Institution: {
          select: { id: true, name: true, code: true, city: true },
        },
      },
    });

    await this.cache.invalidateByTags(['state', 'principals']);
    return updatedPrincipal;
  }

  /**
   * Delete principal by ID
   */
  async deletePrincipal(id: string) {
    const existingPrincipal = await this.prisma.user.findUnique({
      where: { id, role: 'PRINCIPAL' },
    });

    if (!existingPrincipal) {
      throw new NotFoundException(`Principal with ID ${id} not found`);
    }

    await this.prisma.user.delete({
      where: { id },
    });

    await this.cache.invalidateByTags(['state', 'principals']);
    return { success: true, message: 'Principal deleted successfully' };
  }

  /**
   * Reset principal password
   */
  async resetPrincipalPassword(id: string) {
    const existingPrincipal = await this.prisma.user.findUnique({
      where: { id, role: 'PRINCIPAL' },
    });

    if (!existingPrincipal) {
      throw new NotFoundException(`Principal with ID ${id} not found`);
    }

    // Generate a new random password
    const newPassword = this.generateRandomPassword();
    
    this.logger.log(`Resetting password for principal: ${existingPrincipal.email}`);
    this.logger.log(`New password (plain): ${newPassword}`);

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    this.logger.log(`New password (hashed): ${hashedPassword}`);

    // Update the user's password
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
    
    this.logger.log(`Password updated in database for user: ${updatedUser.email}`);

    await this.cache.invalidateByTags(['state', 'principals']);

    return {
      success: true,
      message: 'Password reset successfully',
      newPassword, // Return the plain password so it can be shared with the user
    };
  }

  /**
   * Generate a random password
   */
  private generateRandomPassword(): string {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    // Ensure at least one of each type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
    password += '0123456789'[Math.floor(Math.random() * 10)]; // number
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special char
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  // ==================== Staff Management ====================

  /**
   * Get all staff across institutions with filtering
   */
  async getStaff(params: {
    institutionId?: string;
    role?: string;
    branchName?: string;
    search?: string;
    active?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { institutionId, role, branchName, search, active, page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    // Staff roles - TEACHER, FACULTY_SUPERVISOR, PLACEMENT_OFFICER, etc. (excluding PRINCIPAL, STUDENT, STATE_DIRECTORATE, INDUSTRY roles)
    const staffRoles: Role[] = [
      Role.TEACHER,
      Role.FACULTY_SUPERVISOR,
      Role.PLACEMENT_OFFICER,
      Role.ACCOUNTANT,
      Role.ADMISSION_OFFICER,
      Role.EXAMINATION_OFFICER,
      Role.PMS_OFFICER,
      Role.EXTRACURRICULAR_HEAD,
    ];

    const where: Prisma.UserWhereInput = {
      role: role ? (role as Role) : { in: staffRoles },
    };

    if (institutionId) {
      where.institutionId = institutionId;
    }

    if (branchName) {
      where.branchName = { contains: branchName, mode: 'insensitive' };
    }

    if (active !== undefined) {
      where.active = active;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [staff, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phoneNo: true,
          role: true,
          branchName: true,
          designation: true,
          active: true,
          createdAt: true,
          lastLoginAt: true,
          Institution: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: staff,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new staff member
   */
  async createStaff(data: {
    name: string;
    email: string;
    password: string;
    institutionId: string;
    role: string;
    phoneNo?: string;
    branchName?: string;
    designation?: string;
  }) {
    const institution = await this.prisma.institution.findUnique({
      where: { id: data.institutionId },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${data.institutionId} not found`);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new BadRequestException(`User with email ${data.email} already exists`);
    }

    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const staff = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role as Role,
        institutionId: data.institutionId,
        phoneNo: data.phoneNo,
        branchName: data.branchName,
        designation: data.designation,
        active: true,
        hasChangedDefaultPassword: false,
      },
      include: { Institution: true },
    });

    // Remove password from response
    const { password: _, ...staffWithoutPassword } = staff;

    await this.cache.invalidateByTags(['state', 'staff']);
    return staffWithoutPassword;
  }

  /**
   * Get staff member by ID
   */
  async getStaffById(id: string) {
    const staffRoles: Role[] = [
      Role.TEACHER,
      Role.FACULTY_SUPERVISOR,
      Role.PLACEMENT_OFFICER,
      Role.ACCOUNTANT,
      Role.ADMISSION_OFFICER,
      Role.EXAMINATION_OFFICER,
      Role.PMS_OFFICER,
      Role.EXTRACURRICULAR_HEAD,
    ];

    const staff = await this.prisma.user.findUnique({
      where: { id, role: { in: staffRoles } },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNo: true,
        role: true,
        branchName: true,
        designation: true,
        active: true,
        createdAt: true,
        lastLoginAt: true,
        institutionId: true,
        Institution: {
          select: { id: true, name: true, code: true, city: true },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    return staff;
  }

  /**
   * Update staff member by ID
   */
  async updateStaff(id: string, data: {
    name?: string;
    email?: string;
    institutionId?: string;
    role?: string;
    phoneNo?: string;
    branchName?: string;
    designation?: string;
    active?: boolean;
  }) {
    const staffRoles: Role[] = [
      Role.TEACHER,
      Role.FACULTY_SUPERVISOR,
      Role.PLACEMENT_OFFICER,
      Role.ACCOUNTANT,
      Role.ADMISSION_OFFICER,
      Role.EXAMINATION_OFFICER,
      Role.PMS_OFFICER,
      Role.EXTRACURRICULAR_HEAD,
    ];

    const existingStaff = await this.prisma.user.findUnique({
      where: { id, role: { in: staffRoles } },
    });

    if (!existingStaff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    if (data.institutionId) {
      const institution = await this.prisma.institution.findUnique({
        where: { id: data.institutionId },
      });

      if (!institution) {
        throw new NotFoundException(`Institution with ID ${data.institutionId} not found`);
      }
    }

    // Check if email is being changed and if it's already in use
    if (data.email && data.email !== existingStaff.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (emailExists) {
        throw new BadRequestException(`Email ${data.email} is already in use`);
      }
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.institutionId !== undefined) updateData.Institution = { connect: { id: data.institutionId } };
    if (data.role !== undefined) updateData.role = data.role as Role;
    if (data.phoneNo !== undefined) updateData.phoneNo = data.phoneNo;
    if (data.branchName !== undefined) updateData.branchName = data.branchName;
    if (data.designation !== undefined) updateData.designation = data.designation;
    if (data.active !== undefined) updateData.active = data.active;

    const staff = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { Institution: true },
    });

    // Remove password from response
    const { password: _, ...staffWithoutPassword } = staff;

    await this.cache.invalidateByTags(['state', 'staff']);
    return staffWithoutPassword;
  }

  /**
   * Delete staff member by ID
   */
  async deleteStaff(id: string) {
    const staffRoles: Role[] = [
      Role.TEACHER,
      Role.FACULTY_SUPERVISOR,
      Role.PLACEMENT_OFFICER,
      Role.ACCOUNTANT,
      Role.ADMISSION_OFFICER,
      Role.EXAMINATION_OFFICER,
      Role.PMS_OFFICER,
      Role.EXTRACURRICULAR_HEAD,
    ];

    const existingStaff = await this.prisma.user.findUnique({
      where: { id, role: { in: staffRoles } },
    });

    if (!existingStaff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    await this.prisma.user.delete({ where: { id } });
    await this.cache.invalidateByTags(['state', 'staff']);

    return { success: true, message: 'Staff member deleted successfully' };
  }

  /**
   * Reset staff member password
   */
  async resetStaffPassword(id: string) {
    const staffRoles: Role[] = [
      Role.TEACHER,
      Role.FACULTY_SUPERVISOR,
      Role.PLACEMENT_OFFICER,
      Role.ACCOUNTANT,
      Role.ADMISSION_OFFICER,
      Role.EXAMINATION_OFFICER,
      Role.PMS_OFFICER,
      Role.EXTRACURRICULAR_HEAD,
    ];

    const existingStaff = await this.prisma.user.findUnique({
      where: { id, role: { in: staffRoles } },
    });

    if (!existingStaff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    // Generate a new random password
    const newPassword = this.generateRandomPassword();

    this.logger.log(`Resetting password for staff: ${existingStaff.email}`);

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword, hasChangedDefaultPassword: false },
    });

    await this.cache.invalidateByTags(['state', 'staff']);

    return {
      success: true,
      message: 'Password reset successfully',
      newPassword, // Return the plain password so it can be shared with the user
    };
  }

  /**
   * Get all users for credentials management
   */
  async getUsers(params: {
    role?: string;
    institutionId?: string;
    search?: string;
    active?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { role, institutionId, search, active, page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (role) {
      where.role = role as Role;
    }

    if (institutionId) {
      where.institutionId = institutionId;
    }

    if (active !== undefined) {
      where.active = active;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          institutionId: true,
          lastLoginAt: true,
          createdAt: true,
          Institution: {
            select: { id: true, name: true },
          },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

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
   */
  async getInstitutionReports(params: {
    fromDate?: string;
    toDate?: string;
    reportType?: string;
  }) {
    const { fromDate, toDate } = params;
    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;

    const createdAtFilter = (from || to)
      ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : undefined;

    const institutions = await this.prisma.institution.findMany({
      where: createdAtFilter,
      orderBy: { createdAt: 'desc' },
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
    });

    return { data: institutions, total: institutions.length };
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
   * Approve industry registration
   */
  async approveIndustry(industryId: string, approvedBy: string) {
    const industry = await this.prisma.industry.findUnique({
      where: { id: industryId },
    });

    if (!industry) {
      throw new NotFoundException(`Industry with ID ${industryId} not found`);
    }

    if (industry.isApproved) {
      throw new BadRequestException('Industry is already approved');
    }

    const updated = await this.prisma.industry.update({
      where: { id: industryId },
      data: {
        isApproved: true,
        approvedAt: new Date(),
        approvedBy,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await this.cache.invalidateByTags(['state', 'industries', `industry:${industryId}`]);
    return updated;
  }

  /**
   * Reject industry registration
   */
  async rejectIndustry(industryId: string, reason?: string) {
    const industry = await this.prisma.industry.findUnique({
      where: { id: industryId },
    });

    if (!industry) {
      throw new NotFoundException(`Industry with ID ${industryId} not found`);
    }

    if (industry.isApproved) {
      throw new BadRequestException('Cannot reject an already approved industry');
    }

    const updated = await this.prisma.industry.update({
      where: { id: industryId },
      data: { isApproved: false, isVerified: false },
    });

    await this.cache.invalidateByTags(['state', 'industries', `industry:${industryId}`]);
    return { ...updated, rejectionReason: reason };
  }

  /**
   * Get pending industry approvals
   */
  async getPendingIndustries(params: { page?: number; limit?: number }) {
    const { page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.IndustryWhereInput = { isApproved: false };

    const [industries, total] = await Promise.all([
      this.prisma.industry.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, createdAt: true } },
          _count: { select: { internships: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.industry.count({ where }),
    ]);

    return {
      data: industries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get top performing institutions
   * Uses domain service for institution performance
   */
  async getTopPerformers(params: { limit?: number; month?: number; year?: number }) {
    const { limit = 5, month, year } = params;

    // Get current month info for stats
    const now = new Date();
    const currentMonth = month ?? now.getMonth() + 1;
    const currentYear = year ?? now.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0);

    // Use domain service for base performance data
    const institutionPerformance = await this.stateReportService.getInstitutionPerformance();

    // Get comprehensive stats for each institution
    const performanceWithStats = await Promise.all(
      institutionPerformance.slice(0, limit * 2).map(async (inst: any) => {
        const dateFilter: any = {};
        if (month && year) {
          dateFilter.createdAt = { gte: startOfMonth, lte: endOfMonth };
        }

        // Get comprehensive stats for the institution
        const [
          totalStudents,
          studentsWithInternships,
          activeAssignments,
          facultyVisitsThisMonth,
          reportsSubmittedThisMonth,
        ] = await Promise.all([
          this.prisma.student.count({
            where: { institutionId: inst.institutionId, isActive: true },
          }),
          this.prisma.internshipApplication.count({
            where: {
              student: { institutionId: inst.institutionId },
              isSelfIdentified: true,
              internshipStatus: 'ONGOING',
            },
          }),
          this.prisma.mentorAssignment.count({
            where: {
              student: { institutionId: inst.institutionId },
              isActive: true,
            },
          }),
          this.prisma.facultyVisitLog.count({
            where: {
              application: { student: { institutionId: inst.institutionId } },
              visitDate: { gte: startOfMonth, lte: endOfMonth },
            },
          }),
          this.prisma.monthlyReport.count({
            where: {
              student: { institutionId: inst.institutionId },
              reportMonth: currentMonth,
              reportYear: currentYear,
              status: { in: ['SUBMITTED', 'APPROVED'] },
            },
          }),
        ]);

        const unassigned = Math.max(0, studentsWithInternships - activeAssignments);
        const reportsMissing = Math.max(0, studentsWithInternships - reportsSubmittedThisMonth);

        // Calculate compliance score
        let score = 100;
        if (studentsWithInternships > 0) {
          const assignmentScore = (activeAssignments / studentsWithInternships) * 100;
          const visitScore = facultyVisitsThisMonth > 0
            ? Math.min((facultyVisitsThisMonth / studentsWithInternships) * 100, 100)
            : 0;
          const reportScore = (reportsSubmittedThisMonth / studentsWithInternships) * 100;
          score = Math.round((assignmentScore + visitScore + reportScore) / 3);
        }

        return {
          id: inst.institutionId,
          name: inst.institutionName,
          city: inst.city,
          // Stats object for frontend compatibility
          stats: {
            totalStudents,
            studentsWithInternships,
            assigned: activeAssignments,
            unassigned,
            facultyVisits: facultyVisitsThisMonth,
            reportsSubmitted: reportsSubmittedThisMonth,
            reportsMissing,
          },
          // Direct score for sorting and display
          score,
          // Keep these for backwards compatibility
          placementRate: score,
          approvalRate: score,
          studentsCount: totalStudents,
          internshipsCount: studentsWithInternships,
        };
      }),
    );

    const sorted = performanceWithStats.sort((a, b) => b.score - a.score);

    return {
      topPerformers: sorted.slice(0, limit),
      bottomPerformers: sorted.slice(-limit).reverse(),
    };
  }

  /**
   * Get top industry partners
   * Uses domain service for industry statistics
   */
  async getTopIndustries(params: { limit?: number }) {
    const { limit = 10 } = params;

    // Use domain service for top industries
    const topIndustries = await this.stateReportService.getTopIndustries(limit);

    // Transform to expected format
    return {
      data: topIndustries.map((ind: any) => ({
        id: ind.industryId,
        name: ind.industryName,
        internsHired: ind.acceptedApplications,
        activePostings: ind.activePostings,
        totalInternships: ind.totalPostings,
        rating: ind.acceptanceRate > 50 ? Math.min(5, 3 + (ind.acceptanceRate / 25)) : null,
      })),
      total: topIndustries.length,
    };
  }

  /**
   * Get joining letter statistics
   * Uses domain service for base stats
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
        const [totalStudents, placements, institutions] = await Promise.all([
          this.prisma.student.count({ where: { isActive: true } }),
          this.prisma.placement.findMany({
            include: {
              student: { include: { branch: true, Institution: true } },
            },
          }),
          this.prisma.institution.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
          }),
        ]);

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
      // Self-identified internships count
      this.prisma.internshipApplication.count({
        where: { ...dateFilter, isSelfIdentified: true, internshipStatus: 'ONGOING' },
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

  /**
   * Get faculty/mentors from an institution
   */
  async getInstitutionMentors(institutionId: string) {
    const mentors = await this.prisma.user.findMany({
      where: {
        institutionId,
        role: { in: [Role.FACULTY_SUPERVISOR, Role.TEACHER] },
        active: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        _count: {
          select: {
            mentorAssignments: {
              where: { isActive: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return mentors.map(mentor => ({
      id: mentor.id,
      name: mentor.name,
      email: mentor.email,
      role: mentor.role,
      activeAssignments: mentor._count.mentorAssignments,
    }));
  }

  /**
   * Assign mentor to student (State Directorate override)
   */
  async assignMentorToStudent(studentId: string, mentorId: string, assignedBy: string) {
    // Validate student exists
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, institutionId: true, name: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Validate mentor exists and belongs to same institution
    const mentor = await this.prisma.user.findUnique({
      where: { id: mentorId },
      select: { id: true, name: true, institutionId: true, role: true },
    });

    if (!mentor) {
      throw new NotFoundException('Mentor not found');
    }

    if (mentor.institutionId !== student.institutionId) {
      throw new BadRequestException('Mentor must belong to the same institution as the student');
    }

    if (mentor.role !== Role.FACULTY_SUPERVISOR && mentor.role !== Role.TEACHER) {
      throw new BadRequestException('Selected user is not a valid mentor');
    }

    // Deactivate existing assignments
    await this.prisma.mentorAssignment.updateMany({
      where: { studentId, isActive: true },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: assignedBy,
        deactivationReason: 'Reassigned by State Directorate',
      },
    });

    // Create new assignment
    const assignment = await this.prisma.mentorAssignment.create({
      data: {
        studentId,
        mentorId,
        assignedBy,
        academicYear: this.getCurrentAcademicYear(),
        assignmentDate: new Date(),
        assignmentReason: 'Assigned by State Directorate',
        isActive: true,
      },
      include: {
        mentor: { select: { id: true, name: true, email: true } },
      },
    });

    // Invalidate cache
    await Promise.all([
      this.cache.mdel(`mentor:assignments:${mentorId}`),
      this.cache.mdel(`mentor:student:${studentId}`),
      this.cache.mdel(`state:institute:${student.institutionId}:students`),
    ]);

    return {
      success: true,
      message: `Mentor ${mentor.name} assigned to student ${student.name}`,
      assignment,
    };
  }

  /**
   * Remove mentor from student (State Directorate)
   */
  async removeMentorFromStudent(studentId: string, removedBy: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, institutionId: true, name: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const result = await this.prisma.mentorAssignment.updateMany({
      where: { studentId, isActive: true },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: removedBy,
        deactivationReason: 'Removed by State Directorate',
      },
    });

    // Invalidate cache
    await this.cache.mdel(`mentor:student:${studentId}`);
    await this.cache.mdel(`state:institute:${student.institutionId}:students`);

    return {
      success: true,
      message: result.count > 0 ? 'Mentor removed successfully' : 'No active mentor assignment found',
      removed: result.count,
    };
  }

  private getCurrentAcademicYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const startYear = month >= 6 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
  }

  /**
   * Get critical alerts for state dashboard
   * Returns institutions with compliance < 50%, students without mentors for > 7 days,
   * missing monthly reports (overdue by > 5 days), and faculty visit gaps (> 30 days)
   */
  async getCriticalAlerts() {
    const cacheKey = 'state:dashboard:critical-alerts';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Run all independent queries in parallel
        const [
          institutionsWithStats,
          studentsWithoutMentors,
          missingReports,
          institutions,
          allLastVisits,
        ] = await Promise.all([
          // 1. Get institutions with stats
          this.getInstitutionsWithStats({ page: 1, limit: 100 }),

          // 2. Students without mentors for > 7 days
          this.prisma.student.findMany({
            where: {
              isActive: true,
              internshipApplications: {
                some: {
                  isSelfIdentified: true,
                  internshipStatus: 'ONGOING',
                  createdAt: { lte: sevenDaysAgo },
                },
              },
              mentorAssignments: {
                none: { isActive: true },
              },
            },
            select: {
              id: true,
              name: true,
              rollNumber: true,
              Institution: { select: { id: true, name: true, code: true } },
              internshipApplications: {
                where: { isSelfIdentified: true, internshipStatus: 'ONGOING' },
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { createdAt: true },
              },
            },
            take: 20,
          }),

          // 3. Missing monthly reports (overdue by > 5 days)
          now.getDate() > 5 ? this.prisma.student.findMany({
            where: {
              isActive: true,
              internshipApplications: {
                some: {
                  isSelfIdentified: true,
                  internshipStatus: 'ONGOING',
                },
              },
              monthlyReports: {
                none: {
                  reportMonth: currentMonth,
                  reportYear: currentYear,
                  status: { in: ['SUBMITTED', 'APPROVED'] },
                },
              },
            },
            select: {
              id: true,
              name: true,
              rollNumber: true,
              Institution: { select: { id: true, name: true, code: true } },
            },
            take: 20,
          }) : Promise.resolve([]),

          // 4. Get all institutions
          this.prisma.institution.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true },
          }),

          // 5. Get last visit per institution using raw aggregation - avoiding N+1
          this.prisma.facultyVisitLog.groupBy({
            by: ['applicationId'],
            _max: { visitDate: true },
          }),
        ]);

        // Calculate low compliance institutions
        const lowCompliance = institutionsWithStats.data
          .filter((inst: any) => {
            const { stats } = inst;
            if (stats.studentsWithInternships === 0) return false;

            const mentorCoverage = (stats.assigned / stats.studentsWithInternships) * 100;
            const visitScore = stats.facultyVisits > 0
              ? Math.min((stats.facultyVisits / stats.studentsWithInternships) * 100, 100)
              : 0;
            const reportScore = (stats.reportsSubmitted / stats.studentsWithInternships) * 100;
            const overallCompliance = (mentorCoverage + visitScore + reportScore) / 3;
            return overallCompliance < 50;
          })
          .map((inst: any) => ({
            institutionId: inst.id,
            institutionName: inst.name,
            institutionCode: inst.code,
            city: inst.city,
            complianceScore: Math.round(
              ((inst.stats.assigned / inst.stats.studentsWithInternships) * 100 +
                (inst.stats.facultyVisits > 0 ? Math.min((inst.stats.facultyVisits / inst.stats.studentsWithInternships) * 100, 100) : 0) +
                (inst.stats.reportsSubmitted / inst.stats.studentsWithInternships) * 100) / 3),
          }));

        // Calculate visit gaps efficiently - get last visit per institution in batch
        const applicationIds = allLastVisits.map(v => v.applicationId);
        const applicationsWithInstitution = applicationIds.length > 0
          ? await this.prisma.internshipApplication.findMany({
              where: { id: { in: applicationIds } },
              select: {
                id: true,
                student: { select: { institutionId: true } },
              },
            })
          : [];

        // Build map of institution -> last visit date
        const institutionLastVisit = new Map<string, Date>();
        for (const app of applicationsWithInstitution) {
          const visitInfo = allLastVisits.find(v => v.applicationId === app.id);
          if (visitInfo?._max.visitDate) {
            const instId = app.student.institutionId;
            const existingDate = institutionLastVisit.get(instId);
            const visitDate = new Date(visitInfo._max.visitDate);
            if (!existingDate || visitDate > existingDate) {
              institutionLastVisit.set(instId, visitDate);
            }
          }
        }

        // Find institutions with visit gaps
        const visitGaps: any[] = [];
        for (const inst of institutions) {
          const lastVisitDate = institutionLastVisit.get(inst.id);
          if (lastVisitDate && lastVisitDate < thirtyDaysAgo) {
            const daysSince = Math.floor((now.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24));
            visitGaps.push({
              institutionId: inst.id,
              institutionName: inst.name,
              institutionCode: inst.code,
              lastVisitDate: lastVisitDate,
              daysSinceLastVisit: daysSince,
            });
          }
        }

        return {
          timestamp: now.toISOString(),
          summary: {
            totalAlerts: lowCompliance.length + studentsWithoutMentors.length + missingReports.length + visitGaps.length,
            lowComplianceCount: lowCompliance.length,
            studentsWithoutMentorsCount: studentsWithoutMentors.length,
            missingReportsCount: missingReports.length,
            visitGapsCount: visitGaps.length,
          },
          alerts: {
            lowComplianceInstitutions: lowCompliance,
            studentsWithoutMentors: studentsWithoutMentors.map(s => ({
              studentId: s.id,
              studentName: s.name,
              rollNumber: s.rollNumber,
              institutionName: s.Institution?.name,
              institutionCode: s.Institution?.code,
              daysSinceInternshipStarted: s.internshipApplications[0]
                ? Math.floor((now.getTime() - new Date(s.internshipApplications[0].createdAt).getTime()) / (1000 * 60 * 60 * 24))
                : null,
            })),
            missingReports: missingReports.map(s => ({
              studentId: s.id,
              studentName: s.name,
              rollNumber: s.rollNumber,
              institutionName: s.Institution?.name,
              institutionCode: s.Institution?.code,
              daysOverdue: now.getDate() - 5,
            })),
            facultyVisitGaps: visitGaps,
          },
        };
      },
      { ttl: 300, tags: ['state', 'dashboard', 'alerts'] },
    );
  }

  /**
   * Get action items for state dashboard
   * Returns pending approvals, institutions requiring intervention, and overdue compliance items
   */
  async getActionItems() {
    const cacheKey = 'state:dashboard:action-items';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

        // Run all independent queries in parallel
        const [pendingApprovals, institutionsWithStats, overdueItems] = await Promise.all([
          // 1. Pending principal approvals (industry registrations)
          this.prisma.industry.findMany({
            where: { isApproved: false },
            select: {
              id: true,
              companyName: true,
              industryType: true,
              city: true,
              state: true,
              createdAt: true,
              user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'asc' },
            take: 20,
          }),

          // 2. Get institutions with stats
          this.getInstitutionsWithStats({ page: 1, limit: 100 }),

          // 3. Overdue compliance items
          this.prisma.student.findMany({
            where: {
              isActive: true,
              internshipApplications: {
                some: {
                  isSelfIdentified: true,
                  internshipStatus: 'ONGOING',
                  createdAt: { lte: fifteenDaysAgo },
                },
              },
              monthlyReports: {
                none: {
                  reportMonth: currentMonth,
                  reportYear: currentYear,
                  status: { in: ['SUBMITTED', 'APPROVED'] },
                },
              },
            },
            select: {
              id: true,
              name: true,
              rollNumber: true,
              Institution: { select: { id: true, name: true, code: true } },
            },
            take: 15,
          }),
        ]);

        // Institutions requiring intervention (compliance < 30%)
        const requiresIntervention = institutionsWithStats.data
          .filter((inst: any) => {
            const { stats } = inst;
            if (stats.studentsWithInternships === 0) return false;

            const assignmentRate = (stats.assigned / stats.studentsWithInternships) * 100;
            const visitRate = stats.facultyVisits > 0
              ? Math.min((stats.facultyVisits / stats.studentsWithInternships) * 100, 100)
              : 0;
            const reportRate = (stats.reportsSubmitted / stats.studentsWithInternships) * 100;
            const overallCompliance = (assignmentRate + visitRate + reportRate) / 3;
            return overallCompliance < 30;
          })
          .map((inst: any) => ({
            institutionId: inst.id,
            institutionName: inst.name,
            institutionCode: inst.code,
            city: inst.city,
            complianceScore: Math.round(
              ((inst.stats.assigned / inst.stats.studentsWithInternships) * 100 +
                (inst.stats.facultyVisits > 0 ? Math.min((inst.stats.facultyVisits / inst.stats.studentsWithInternships) * 100, 100) : 0) +
                (inst.stats.reportsSubmitted / inst.stats.studentsWithInternships) * 100) / 3),
            issues: [
              inst.stats.unassigned > 0 && `${inst.stats.unassigned} students without mentors`,
              inst.stats.facultyVisits === 0 && 'No faculty visits this month',
              inst.stats.reportsMissing > 0 && `${inst.stats.reportsMissing} missing reports`,
            ].filter(Boolean),
          }));

        return {
          timestamp: now.toISOString(),
          summary: {
            totalActionItems: pendingApprovals.length + requiresIntervention.length + overdueItems.length,
            pendingApprovalsCount: pendingApprovals.length,
            interventionRequiredCount: requiresIntervention.length,
            overdueComplianceCount: overdueItems.length,
          },
          actions: {
            pendingIndustryApprovals: pendingApprovals.map(p => ({
              industryId: p.id,
              companyName: p.companyName,
              industryType: p.industryType,
              city: p.city,
              state: p.state,
              submittedAt: p.createdAt,
              contactName: p.user?.name,
              contactEmail: p.user?.email,
              daysPending: Math.floor((now.getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
              priority: Math.floor((now.getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24)) > 7 ? 'high' : 'normal',
            })),
            institutionsRequiringIntervention: requiresIntervention,
            overdueComplianceItems: overdueItems.map(s => ({
              studentId: s.id,
              studentName: s.name,
              rollNumber: s.rollNumber,
              institutionName: s.Institution?.name,
              institutionCode: s.Institution?.code,
              daysOverdue: 15,
              priority: 'high',
            })),
          },
        };
      },
      { ttl: 300, tags: ['state', 'dashboard', 'actions'] },
    );
  }

  /**
   * Get compliance summary for state dashboard
   * Returns overall compliance metrics and breakdown by institution
   */
  async getComplianceSummary() {
    const cacheKey = 'state:compliance:summary';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const startOfMonth = new Date(currentYear, currentMonth - 1, 1);

        // Run state-wide counts AND institution stats in parallel
        const [
          totalInstitutions,
          totalStudentsWithInternships,
          totalAssignments,
          totalVisitsThisMonth,
          totalReportsThisMonth,
          institutionsWithStats,
        ] = await Promise.all([
          this.prisma.institution.count({ where: { isActive: true } }),
          this.prisma.internshipApplication.count({
            where: {
              isSelfIdentified: true,
              internshipStatus: 'ONGOING',
            },
          }),
          this.prisma.mentorAssignment.count({ where: { isActive: true } }),
          this.prisma.facultyVisitLog.count({
            where: { visitDate: { gte: startOfMonth } },
          }),
          this.prisma.monthlyReport.count({
            where: {
              reportMonth: currentMonth,
              reportYear: currentYear,
              status: { in: ['SUBMITTED', 'APPROVED'] },
            },
          }),
          // Run institution stats in parallel with state-wide counts
          this.getInstitutionsWithStats({ page: 1, limit: 100 }),
        ]);

        // Calculate state-wide compliance rates
        const mentorCoverageRate = totalStudentsWithInternships > 0
          ? Math.round((totalAssignments / totalStudentsWithInternships) * 100)
          : 100;
        const visitComplianceRate = totalStudentsWithInternships > 0
          ? Math.round(Math.min((totalVisitsThisMonth / totalStudentsWithInternships) * 100, 100))
          : 100;
        const reportComplianceRate = totalStudentsWithInternships > 0
          ? Math.round((totalReportsThisMonth / totalStudentsWithInternships) * 100)
          : 100;
        const overallCompliance = Math.round((mentorCoverageRate + visitComplianceRate + reportComplianceRate) / 3);

        // Process institution-wise compliance breakdown
        const institutionCompliance = institutionsWithStats.data.map((inst: any) => {
          const { stats } = inst;
          const mentorCov = stats.studentsWithInternships > 0
            ? Math.round((stats.assigned / stats.studentsWithInternships) * 100)
            : 100;
          const visitComp = stats.studentsWithInternships > 0
            ? Math.round(Math.min((stats.facultyVisits / stats.studentsWithInternships) * 100, 100))
            : 100;
          const reportComp = stats.studentsWithInternships > 0
            ? Math.round((stats.reportsSubmitted / stats.studentsWithInternships) * 100)
            : 100;
          const overall = Math.round((mentorCov + visitComp + reportComp) / 3);

          return {
            institutionId: inst.id,
            institutionName: inst.name,
            institutionCode: inst.code,
            city: inst.city,
            overallScore: overall,
            mentorCoverage: mentorCov,
            visitCompliance: visitComp,
            reportCompliance: reportComp,
            studentsWithInternships: stats.studentsWithInternships,
            studentsWithMentors: stats.assigned,
            visitsThisMonth: stats.facultyVisits,
            reportsThisMonth: stats.reportsSubmitted,
          };
        }).sort((a: any, b: any) => a.overallScore - b.overallScore);

        return {
          timestamp: now.toISOString(),
          month: currentMonth,
          year: currentYear,
          stateWide: {
            totalInstitutions,
            totalStudentsWithInternships,
            totalMentorAssignments: totalAssignments,
            totalVisitsThisMonth,
            totalReportsThisMonth,
            overallComplianceScore: overallCompliance,
            mentorCoverageRate,
            visitComplianceRate,
            reportComplianceRate,
          },
          distribution: {
            excellent: institutionCompliance.filter((i: any) => i.overallScore >= 80).length,
            good: institutionCompliance.filter((i: any) => i.overallScore >= 60 && i.overallScore < 80).length,
            needsImprovement: institutionCompliance.filter((i: any) => i.overallScore >= 40 && i.overallScore < 60).length,
            critical: institutionCompliance.filter((i: any) => i.overallScore < 40).length,
          },
          institutions: institutionCompliance,
        };
      },
      { ttl: 300, tags: ['state', 'compliance'] },
    );
  }
}
