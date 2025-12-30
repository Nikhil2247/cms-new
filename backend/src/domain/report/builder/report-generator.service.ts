import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InternshipStatus, MonthlyReportStatus, Role } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { ReportType } from './interfaces/report.interface';

/**
 * Pagination options for report generation
 * Prevents memory overflow on large datasets
 */
export interface ReportPaginationOptions {
  take?: number;  // Number of records to fetch (default: 10000)
  skip?: number;  // Number of records to skip (default: 0)
}

/** Default maximum records to prevent memory overflow */
const DEFAULT_MAX_RECORDS = 10000;
/** Warning threshold for large result sets */
const WARNING_THRESHOLD = 5000;

/**
 * Reports that require institution isolation
 * These reports MUST have institutionId to prevent cross-tenant data leakage
 */
const INSTITUTION_REQUIRED_REPORTS = [
  'student',
  'internship',
  'faculty',
  'mentor',
  'monthly',
  'placement',
  'compliance',
  'pending',
];

/**
 * Reports that can be run without institution filter (admin-only)
 */
const ADMIN_ONLY_REPORTS = ['institution_performance', 'system'];

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get pagination parameters with defaults
   * Enforces maximum record limit to prevent memory overflow
   */
  private getPaginationParams(pagination?: ReportPaginationOptions): { take: number; skip: number } {
    const take = Math.min(pagination?.take ?? DEFAULT_MAX_RECORDS, DEFAULT_MAX_RECORDS);
    const skip = pagination?.skip ?? 0;
    return { take, skip };
  }

  /**
   * Log warning if result set exceeds threshold
   */
  private warnOnLargeResultSet(resultCount: number, reportType: string): void {
    if (resultCount >= WARNING_THRESHOLD) {
      this.logger.warn(
        `Large result set: ${reportType} returned ${resultCount} records. ` +
        `Consider using pagination (skip/take) for better performance.`
      );
    }
  }

  /**
   * Validate institution isolation for reports
   * Throws ForbiddenException if institutionId is required but not provided
   */
  private validateInstitutionIsolation(
    reportType: string,
    filters: any,
    isAdmin: boolean = false,
  ): void {
    const typeStr = reportType.toLowerCase();

    // Check if this report type requires institution isolation
    const requiresInstitution = INSTITUTION_REQUIRED_REPORTS.some(
      (r) => typeStr.includes(r),
    );

    if (requiresInstitution && !filters?.institutionId && !isAdmin) {
      this.logger.warn(
        `Report generation blocked: ${reportType} requires institutionId`,
      );
      throw new ForbiddenException(
        'Institution ID is required for this report type',
      );
    }
  }

  /**
   * Generate Student Progress Report
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateStudentProgressReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    // The schema uses Branch (not Department) for academic grouping.
    if (filters?.branchId) {
      where.branchId = filters.branchId;
    } else if (filters?.departmentId) {
      where.branchId = filters.departmentId;
    }

    // Handle year filter - support both 'year' and 'currentYear' filter names
    if (filters?.year) {
      where.currentYear = Number(filters.year);
    } else if (filters?.currentYear) {
      where.currentYear = Number(filters.currentYear);
    } else if (filters?.academicYear) {
      // For academicYear like "2024-2025", extract first year
      const yearStr = String(filters.academicYear);
      const yearMatch = yearStr.match(/^(\d{4})/);
      if (yearMatch) {
        where.currentYear = Number(yearMatch[1]);
      }
    }

    if (filters?.semester || filters?.currentSemester) {
      where.currentSemester = Number(filters.semester || filters.currentSemester);
    }

    // Handle isActive filter - boolean filter
    if (filters?.isActive !== undefined && filters?.isActive !== null) {
      where.isActive = filters.isActive === true || filters.isActive === 'true';
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, phoneNo: true } },
        branch: { select: { name: true } },
        internshipApplications: { select: { id: true } },
        placements: { select: { id: true } },
      },
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });

    this.warnOnLargeResultSet(students.length, 'StudentProgressReport');

    return students.map((student) => ({
      rollNumber: student.rollNumber,
      name: student.name,
      email: student.email ?? student.user.email,
      phoneNumber: student.contact ?? student.user.phoneNo,
      branch: student.branch?.name ?? student.branchName,
      currentYear: student.currentYear,
      currentSemester: student.currentSemester,
      internshipsCount: student.internshipApplications.length,
      placementsCount: student.placements.length,
      status: student.clearanceStatus,
      isActive: student.isActive,
    }));
  }

  /**
   * Generate Internship Report
   * Supports filtering by isSelfIdentified, mentorId, status, date range, and verificationStatus
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateInternshipReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    // Handle isSelfIdentified filter - default to showing all if not specified
    if (filters?.isSelfIdentified !== undefined && filters?.isSelfIdentified !== null) {
      where.isSelfIdentified = filters.isSelfIdentified === true || filters.isSelfIdentified === 'true';
    }

    // Handle institution filter with proper nesting for student relation
    const studentWhere: Record<string, unknown> = {};
    if (filters?.institutionId) {
      studentWhere.institutionId = filters.institutionId;
    }
    if (filters?.branchId) {
      studentWhere.branchId = filters.branchId;
    }
    if (Object.keys(studentWhere).length > 0) {
      where.student = studentWhere;
    }

    // Handle status filter
    if (filters?.status) {
      where.status = filters.status;
    }

    // Handle mentor filter
    if (filters?.mentorId) {
      where.mentorId = filters.mentorId;
    }

    // Handle verification status filter
    if (filters?.verificationStatus) {
      where.verificationStatus = filters.verificationStatus;
    }

    // Handle date range filter (startDate and endDate from transformed dateRange)
    if (filters?.startDate || filters?.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (filters.startDate) {
        dateFilter.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        dateFilter.lte = new Date(filters.endDate);
      }
      // Apply to application's start date
      where.startDate = dateFilter;
    }

    const applications = await this.prisma.internshipApplication.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            rollNumber: true,
            branchName: true,
            institutionId: true,
          },
        },
        internship: {
          include: {
            industry: {
              select: {
                id: true,
                companyName: true,
                city: true,
              },
            },
          },
        },
        mentor: { select: { id: true, name: true } },
        _count: { select: { monthlyReports: true } },
      },
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });

    this.warnOnLargeResultSet(applications.length, 'InternshipReport');

    return applications.map((application) => ({
      studentName: application.student.name,
      rollNumber: application.student.rollNumber,
      branch: application.student.branchName,
      companyName:
        application.internship?.industry.companyName ?? application.companyName,
      companyCity: application.internship?.industry.city ?? '',
      jobProfile: application.jobProfile,
      startDate: application.internship?.startDate ?? application.startDate,
      endDate: application.internship?.endDate ?? application.endDate,
      duration: application.internship?.duration ?? application.internshipDuration,
      status: application.status,
      verificationStatus: (application as any).verificationStatus ?? 'N/A',
      mentorName: application.mentor?.name ?? 'N/A',
      reportsSubmitted: application._count.monthlyReports,
      location: application.internship?.workLocation ?? application.companyAddress,
      isSelfIdentified: application.isSelfIdentified,
    }));
  }

  /**
   * Generate Faculty Visit Report
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateFacultyVisitReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    // Handle institution filter through application -> student relation
    if (filters?.institutionId) {
      where.application = { student: { institutionId: filters.institutionId } };
    }

    // Handle faculty/mentor filter
    if (filters?.facultyId || filters?.mentorId) {
      where.facultyId = filters.facultyId || filters.mentorId;
    }

    // Handle date range filter (from transformed dateRange or direct startDate/endDate)
    if (filters?.startDate || filters?.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (filters.startDate) {
        dateFilter.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        dateFilter.lte = new Date(filters.endDate);
      }
      where.visitDate = dateFilter;
    }

    // Handle visit type filter
    if (filters?.visitType) {
      where.visitType = filters.visitType;
    }

    // Handle follow-up required filter
    if (filters?.followUpRequired !== undefined && filters?.followUpRequired !== null) {
      where.followUpRequired = filters.followUpRequired === true || filters.followUpRequired === 'true';
    }

    const visits = await this.prisma.facultyVisitLog.findMany({
      where,
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
      take,
      skip,
      orderBy: { visitDate: 'desc' },
    });

    this.warnOnLargeResultSet(visits.length, 'FacultyVisitReport');

    return visits.map((visit) => ({
      facultyName: visit.faculty.name,
      facultyDesignation: visit.faculty.designation,
      studentName: visit.application.student.name,
      rollNumber: visit.application.student.rollNumber,
      companyName: visit.application.internship?.industry.companyName,
      visitDate: visit.visitDate,
      visitType: visit.visitType,
      visitLocation: visit.visitLocation,
      followUpRequired: visit.followUpRequired,
      nextVisitDate: visit.nextVisitDate,
      meetingMinutes: visit.meetingMinutes,
    }));
  }

  /**
   * Generate Monthly Report
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateMonthlyReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.studentId) {
      where.studentId = filters.studentId;
    }

    if (filters?.institutionId) {
      where.student = { institutionId: filters.institutionId };
    }

    if (filters?.month && filters?.year) {
      where.reportMonth = Number(filters.month);
      where.reportYear = Number(filters.year);
    }

    const reports = await this.prisma.monthlyReport.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, rollNumber: true } },
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
      take,
      skip,
      orderBy: [{ reportYear: 'desc' }, { reportMonth: 'desc' }],
    });

    this.warnOnLargeResultSet(reports.length, 'MonthlyReport');

    return reports.map((report) => ({
      studentName: report.student.name,
      rollNumber: report.student.rollNumber,
      companyName: report.application.internship?.industry.companyName,
      month: report.reportMonth,
      year: report.reportYear,
      status: report.status,
      submittedAt: report.submittedAt,
      reportFileUrl: report.reportFileUrl,
    }));
  }

  /**
   * Generate Placement Report
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generatePlacementReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.OR = [
        { institutionId: filters.institutionId },
        { student: { institutionId: filters.institutionId } },
      ];
    }

    if (filters?.minSalary || filters?.maxSalary) {
      where.salary = {};
      if (filters.minSalary) {
        (where.salary as Record<string, unknown>).gte = Number(filters.minSalary);
      }
      if (filters.maxSalary) {
        (where.salary as Record<string, unknown>).lte = Number(filters.maxSalary);
      }
    }

    const placements = await this.prisma.placement.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, rollNumber: true, email: true } },
      },
      take,
      skip,
      orderBy: { offerDate: 'desc' },
    });

    this.warnOnLargeResultSet(placements.length, 'PlacementReport');

    return placements.map((placement) => ({
      studentName: placement.student.name,
      rollNumber: placement.student.rollNumber,
      email: placement.student.email,
      companyName: placement.companyName,
      jobRole: placement.jobRole,
      salary: placement.salary,
      offerDate: placement.offerDate,
      status: placement.status,
    }));
  }

  /**
   * Generate Institution Performance Report
   */
  async generateInstitutionPerformanceReport(filters: any): Promise<any[]> {
    const institutionId = filters.institutionId;

    if (!institutionId) {
      throw new Error('Institution ID is required');
    }

    const [
      totalStudents,
      totalFaculty,
      activeInternships,
      completedInternships,
      totalPlacements,
      totalApplications,
      branches,
      avgPlacementSalary,
    ] = await Promise.all([
      this.prisma.student.count({ where: { institutionId } }),
      this.prisma.user.count({
        where: {
          institutionId,
          role: { in: [Role.TEACHER, Role.FACULTY_SUPERVISOR] },
        },
      }),
      this.prisma.internship.count({
        where: {
          institutionId,
          status: InternshipStatus.ACTIVE,
          isActive: true,
        },
      }),
      this.prisma.internship.count({
        where: {
          institutionId,
          status: InternshipStatus.COMPLETED,
        },
      }),
      this.prisma.placement.count({
        where: { OR: [{ institutionId }, { student: { institutionId } }] },
      }),
      this.prisma.internshipApplication.count({
        where: { student: { institutionId } },
      }),
      this.prisma.branch.findMany({
        where: { institutionId },
        include: { _count: { select: { students: true } } },
      }),
      this.prisma.placement.aggregate({
        where: { OR: [{ institutionId }, { student: { institutionId } }] },
        _avg: { salary: true },
      }),
    ]);

    return [
      {
        metric: 'Total Students',
        value: totalStudents,
        category: 'Students',
      },
      {
        metric: 'Total Faculty',
        value: totalFaculty,
        category: 'Faculty',
      },
      {
        metric: 'Active Internships',
        value: activeInternships,
        category: 'Internships',
      },
      {
        metric: 'Completed Internships',
        value: completedInternships,
        category: 'Internships',
      },
      {
        metric: 'Total Applications',
        value: totalApplications,
        category: 'Internships',
      },
      {
        metric: 'Total Placements',
        value: totalPlacements,
        category: 'Placements',
      },
      {
        metric: 'Average Placement Salary',
        value: avgPlacementSalary._avg.salary || 0,
        category: 'Placements',
      },
      {
        metric: 'Total Branches',
        value: branches.length,
        category: 'Academic',
      },
      ...branches.map((branch) => ({
        metric: `${branch.name} - Students`,
        value: branch._count.students,
        category: 'Branch',
      })),
    ];
  }

  /**
   * Generate Student Compliance Report
   * Tracks student compliance with reporting requirements
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateStudentComplianceReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.branchId) {
      where.branchId = filters.branchId;
    }

    // Fetch students with their internship applications and monthly reports
    const students = await this.prisma.student.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        internshipApplications: {
          where: { status: { in: ['APPROVED', 'SELECTED'] } },
          include: {
            mentor: { select: { name: true } },
            monthlyReports: {
              select: { status: true, submittedAt: true },
              orderBy: { submittedAt: 'desc' },
            },
          },
        },
      },
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });

    this.warnOnLargeResultSet(students.length, 'StudentComplianceReport');

    const results = students.map((student) => {
      const activeApplications = student.internshipApplications;
      const allReports = activeApplications.flatMap((app) => app.monthlyReports);
      const submittedReports = allReports.filter((r) => r.status === MonthlyReportStatus.APPROVED || r.status === MonthlyReportStatus.SUBMITTED);
      const pendingReports = allReports.filter((r) => r.status === MonthlyReportStatus.DRAFT || r.status === MonthlyReportStatus.UNDER_REVIEW || r.status === MonthlyReportStatus.REVISION_REQUIRED);

      // Calculate expected reports (assume 1 per month of active internship)
      const expectedReports = Math.max(activeApplications.length * 3, 1); // At least 3 months expected
      const complianceScore = expectedReports > 0 ? Math.round((submittedReports.length / expectedReports) * 100) : 0;

      const lastReport = allReports[0];
      const mentorName = activeApplications[0]?.mentor?.name ?? 'N/A';

      // Determine compliance level
      let complianceLevel = 'low';
      if (complianceScore >= 80) complianceLevel = 'high';
      else if (complianceScore >= 50) complianceLevel = 'medium';

      return {
        rollNumber: student.rollNumber,
        name: student.name,
        branchName: student.branch?.name ?? student.branchName,
        mentorName,
        joiningReportStatus: activeApplications.length > 0 ? 'Submitted' : 'Not Started',
        monthlyReportsSubmitted: submittedReports.length,
        monthlyReportsPending: pendingReports.length,
        lastReportDate: lastReport?.submittedAt ?? null,
        complianceScore,
        complianceLevel,
      };
    });

    // Apply complianceLevel filter if specified
    if (filters?.complianceLevel) {
      return results.filter((r) => r.complianceLevel === filters.complianceLevel);
    }

    return results;
  }

  /**
   * Generate report based on type
   * @param type - Report type
   * @param filters - Filter parameters including institutionId
   * @param isAdmin - Whether the requesting user is an admin (can bypass institution isolation)
   * @param pagination - Optional pagination options (take, skip) to limit result sets
   */
  async generateReport(
    type: ReportType | string,
    filters: any,
    isAdmin: boolean = false,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    // Map new report types to generators
    const typeStr = String(type).toLowerCase();

    // SECURITY: Validate institution isolation before generating any report
    this.validateInstitutionIsolation(typeStr, filters, isAdmin);

    this.logger.log(
      `Generating report: ${type}, institutionId: ${filters?.institutionId || 'N/A'}, ` +
      `pagination: take=${pagination?.take ?? DEFAULT_MAX_RECORDS}, skip=${pagination?.skip ?? 0}`,
    );

    // Compliance reports - check this before generic student reports
    if (typeStr.includes('compliance')) {
      return this.generateStudentComplianceReport(filters, pagination);
    }

    // Student reports
    if (typeStr.includes('student') || typeStr === ReportType.STUDENT_PROGRESS) {
      return this.generateStudentProgressReport(filters, pagination);
    }

    // Internship reports (including self-identified)
    if (typeStr.includes('internship') || typeStr === ReportType.INTERNSHIP) {
      return this.generateInternshipReport(filters, pagination);
    }

    // Faculty/Mentor reports
    if (typeStr.includes('mentor') || typeStr.includes('faculty-visit') || typeStr === ReportType.FACULTY_VISIT) {
      return this.generateFacultyVisitReport(filters, pagination);
    }

    // Monthly reports
    if (typeStr.includes('monthly') || typeStr === ReportType.MONTHLY) {
      return this.generateMonthlyReport(filters, pagination);
    }

    // Placement reports
    if (typeStr.includes('placement') || typeStr === ReportType.PLACEMENT) {
      return this.generatePlacementReport(filters, pagination);
    }

    // Institution reports - requires institutionId by design
    // Note: Institution performance report doesn't need pagination (returns aggregated metrics)
    if (typeStr.includes('institut') || typeStr === ReportType.INSTITUTION_PERFORMANCE) {
      return this.generateInstitutionPerformanceReport(filters);
    }

    // Pending reports - use monthly report data
    if (typeStr.includes('pending')) {
      return this.generateMonthlyReport(filters, pagination);
    }

    // Unknown report type - reject instead of defaulting
    this.logger.error(`Unknown report type requested: ${type}`);
    throw new ForbiddenException(`Unknown report type: ${type}`);
  }
}
