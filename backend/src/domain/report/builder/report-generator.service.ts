import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InternshipStatus, MonthlyReportStatus, Role } from '../../../generated/prisma/client';
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
 * Reports that require institution isolation for non-admin users
 * Admin users (STATE_DIRECTORATE, SYSTEM_ADMIN) can view all institutions
 * Non-admin users MUST have institutionId to prevent cross-tenant data leakage
 */
const INSTITUTION_REQUIRED_REPORTS = [
  'internship',
  'faculty',
  'mentor',
  'monthly',
  'placement',
  'compliance',
  'pending',
];

/**
 * Reports that allow viewing all institutions for admin users
 * When institutionId is not provided, returns data from all institutions
 */
const INSTITUTION_OPTIONAL_REPORTS = [
  'student',
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
   * Parse common boolean-ish inputs coming from JSON bodies, query params, or forms.
   * Returns undefined when the value is "not provided".
   */
  private parseBooleanLike(value: unknown): boolean | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
      return Boolean(value);
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y') return true;
      if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'n') return false;
    }
    return undefined;
  }

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
   * Admin users can bypass institution requirement for optional reports
   */
  private validateInstitutionIsolation(
    reportType: string,
    filters: any,
    isAdmin: boolean = false,
  ): void {
    const typeStr = reportType.toLowerCase();

    // Check if this report type strictly requires institution isolation
    const requiresInstitution = INSTITUTION_REQUIRED_REPORTS.some(
      (r) => typeStr.includes(r),
    );

    // Check if this report type allows optional institution for admins
    const isOptionalReport = INSTITUTION_OPTIONAL_REPORTS.some(
      (r) => typeStr.includes(r),
    );

    // For optional reports, admins can view all institutions
    if (isOptionalReport && isAdmin) {
      if (!filters?.institutionId) {
        this.logger.log(
          `Admin generating ${reportType} for all institutions`,
        );
      }
      return; // Allow admin to proceed without institutionId
    }

    // For required reports or non-admin users on optional reports
    if ((requiresInstitution || isOptionalReport) && !filters?.institutionId && !isAdmin) {
      this.logger.warn(
        `Report generation blocked: ${reportType} requires institutionId for non-admin users`,
      );
      throw new ForbiddenException(
        'Institution ID is required for this report type',
      );
    }
  }

  /**
   * Generate Student Progress Report (Student Directory)
   * Returns complete student information including institution, mentor, and internship status
   * @param filters - Filter criteria for the report (validated by StudentDirectoryFilterDto)
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateStudentProgressReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    // Institution filter - REQUIRED for non-admin users (enforced by validateInstitutionIsolation)
    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    // Branch filter - uses Branch model (not Department)
    if (filters?.branchId) {
      where.branchId = filters.branchId;
    } else if (filters?.departmentId) {
      // Backward compatibility: departmentId maps to branchId
      where.branchId = filters.departmentId;
    }

    // Year filter - support multiple filter names for flexibility
    if (filters?.year !== undefined && filters?.year !== null) {
      where.currentYear = Number(filters.year);
    } else if (filters?.currentYear !== undefined && filters?.currentYear !== null) {
      where.currentYear = Number(filters.currentYear);
    } else if (filters?.academicYear) {
      // For academicYear like "2024-2025", extract first year
      const yearStr = String(filters.academicYear);
      const yearMatch = yearStr.match(/^(\d{4})/);
      if (yearMatch) {
        where.currentYear = Number(yearMatch[1]);
      }
    }

    // Semester filter
    if (filters?.semester !== undefined && filters?.semester !== null) {
      where.currentSemester = Number(filters.semester);
    } else if (filters?.currentSemester !== undefined && filters?.currentSemester !== null) {
      where.currentSemester = Number(filters.currentSemester);
    }

    // IMPORTANT: isActive filter - properly handle boolean-ish values
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      where.isActive = isActiveValue;
      this.logger.debug(
        `Student directory filter: isActive=${isActiveValue} (raw: ${String(filters?.isActive)})`,
      );
    }

    // Mentor filter - filter students assigned to specific mentor
    let mentorFilter: string | undefined;
    if (filters?.mentorId) {
      mentorFilter = filters.mentorId;
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNo: true,
            active: true,
          }
        },
        branch: { select: { id: true, name: true } },
        Institution: { select: { id: true, name: true, shortName: true } },
        // Get internship applications with mentor and status info
        internshipApplications: {
          select: {
            id: true,
            status: true,
            mentor: { select: { id: true, name: true } },
            internship: {
              select: {
                id: true,
                title: true,
                status: true,
              }
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1, // Get most recent application
        },
        // Get mentor assignments
        mentorAssignments: {
          where: { isActive: true },
          select: {
            mentor: { select: { id: true, name: true } },
          },
          orderBy: { assignmentDate: 'desc' },
          take: 1, // Get current mentor
        },
        placements: {
          select: { id: true, status: true },
          take: 1,
        },
      },
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });

    this.warnOnLargeResultSet(students.length, 'StudentProgressReport');

    // Apply mentor filter if specified (post-query filter for complex relation)
    let filteredStudents = students;
    if (mentorFilter) {
      filteredStudents = students.filter((student) => {
        const applicationMentor = student.internshipApplications[0]?.mentor?.id;
        const assignedMentor = student.mentorAssignments[0]?.mentor?.id;
        return applicationMentor === mentorFilter || assignedMentor === mentorFilter;
      });
    }

    return filteredStudents.map((student) => {
      // Determine mentor name from assignment or application
      const mentorName =
        student.mentorAssignments[0]?.mentor?.name ??
        student.internshipApplications[0]?.mentor?.name ??
        'Not Assigned';

      // Determine internship status
      const latestApplication = student.internshipApplications[0];
      let internshipStatus = 'Not Started';
      if (latestApplication) {
        switch (latestApplication.status) {
          case 'COMPLETED':
            internshipStatus = 'Completed';
            break;
          case 'JOINED':
          case 'APPROVED':
          case 'SELECTED':
            internshipStatus = 'In Progress';
            break;
          case 'APPLIED':
          case 'UNDER_REVIEW':
          case 'SHORTLISTED':
            internshipStatus = 'Applied';
            break;
          case 'REJECTED':
          case 'WITHDRAWN':
            internshipStatus = 'Not Active';
            break;
          default:
            internshipStatus = latestApplication.status ?? 'Unknown';
        }
      }

      return {
        // Core student info
        rollNumber: student.rollNumber,
        name: student.name,
        email: student.email ?? student.user?.email ?? '',
        phoneNumber: student.contact ?? student.user?.phoneNo ?? '',

        // Academic info
        branchName: student.branch?.name ?? student.branchName ?? '',
        currentYear: student.currentYear,
        currentSemester: student.currentSemester,

        // Institution info
        institutionName: student.Institution?.name ?? '',
        institutionShortName: student.Institution?.shortName ?? '',

        // Mentor info
        mentorName,

        // Internship info
        internshipStatus,
        internshipsCount: student.internshipApplications.length,

        // Placement info
        placementsCount: student.placements.length,
        isPlaced: student.placements.length > 0,

        // Status info
        clearanceStatus: student.clearanceStatus,
        studentActive: student.isActive,
        userActive: student.user?.active ?? false,

        // Timestamps
        createdAt: student.createdAt,
      };
    });
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

    // Default to active applications only
    where.isActive = true;

    // Handle isSelfIdentified filter - default to showing all if not specified
    const isSelfIdentified = this.parseBooleanLike(filters?.isSelfIdentified);
    if (isSelfIdentified !== undefined) {
      where.isSelfIdentified = isSelfIdentified;
    }

    // Handle institution filter with proper nesting for student relation
    const studentWhere: Record<string, unknown> = {};
    if (filters?.institutionId) {
      studentWhere.institutionId = filters.institutionId;
    }
    if (filters?.branchId) {
      studentWhere.branchId = filters.branchId;
    }

    // Default to active students with active user accounts
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      studentWhere.isActive = isActiveValue;
    } else {
      studentWhere.isActive = true;
      studentWhere.user = { active: true };
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
            isActive: true,
            user: { select: { active: true } },
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
      isActive: application.student.isActive,
      userActive: (application.student as any).user?.active ?? true,
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

    // Build student filter with active checks
    const studentFilter: Record<string, unknown> = {};
    if (filters?.institutionId) {
      studentFilter.institutionId = filters.institutionId;
    }

    // Default to active students only, unless explicitly filtering for inactive
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      studentFilter.isActive = isActiveValue;
    } else {
      // By default, only show visits for active students with active accounts
      studentFilter.isActive = true;
      studentFilter.user = { active: true };
    }

    // Build faculty filter - default to active faculty
    const facultyFilter: Record<string, unknown> = {};
    const facultyActiveValue = this.parseBooleanLike(filters?.facultyActive);
    if (facultyActiveValue !== undefined) {
      facultyFilter.active = facultyActiveValue;
    } else {
      facultyFilter.active = true; // Default to active faculty
    }

    // Handle institution filter through application -> student relation
    if (Object.keys(studentFilter).length > 0) {
      where.application = { student: studentFilter };
    }

    // Apply faculty active filter
    where.faculty = facultyFilter;

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
    const followUpRequired = this.parseBooleanLike(filters?.followUpRequired);
    if (followUpRequired !== undefined) {
      where.followUpRequired = followUpRequired;
    }

    const visits = await this.prisma.facultyVisitLog.findMany({
      where,
      include: {
        faculty: { select: { id: true, name: true, designation: true, active: true } },
        application: {
          include: {
            student: { select: { id: true, name: true, rollNumber: true, isActive: true } },
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
      facultyActive: visit.faculty.active,
      studentName: visit.application.student.name,
      rollNumber: visit.application.student.rollNumber,
      studentActive: visit.application.student.isActive,
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

    // Build student filter with active checks
    const studentFilter: Record<string, unknown> = {};
    if (filters?.institutionId) {
      studentFilter.institutionId = filters.institutionId;
    }

    // Default to active students only, unless explicitly filtering for inactive
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      studentFilter.isActive = isActiveValue;
    } else {
      // By default, only show reports for active students with active accounts
      studentFilter.isActive = true;
      studentFilter.user = { active: true };
    }

    if (Object.keys(studentFilter).length > 0) {
      where.student = studentFilter;
    }

    if (filters?.month && filters?.year) {
      where.reportMonth = Number(filters.month);
      where.reportYear = Number(filters.year);
    }

    const reports = await this.prisma.monthlyReport.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            rollNumber: true,
            isActive: true,
            user: { select: { active: true } },
          },
        },
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
      isActive: report.student.isActive,
      userActive: (report.student as any).user?.active ?? true,
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

    // Build student filter with active checks
    const studentActiveFilter: Record<string, unknown> = {};

    // Default to active students only, unless explicitly filtering for inactive
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      studentActiveFilter.isActive = isActiveValue;
    } else {
      // By default, only show placements for active students with active accounts
      studentActiveFilter.isActive = true;
      studentActiveFilter.user = { active: true };
    }

    if (filters?.institutionId) {
      where.OR = [
        { institutionId: filters.institutionId },
        {
          student: {
            institutionId: filters.institutionId,
            ...studentActiveFilter,
          },
        },
      ];
    } else {
      // Apply student active filter directly when no institutionId
      where.student = studentActiveFilter;
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
        student: {
          select: {
            id: true,
            name: true,
            rollNumber: true,
            email: true,
            isActive: true,
            user: { select: { active: true } },
          },
        },
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
      isActive: placement.student.isActive,
      userActive: (placement.student as any).user?.active ?? true,
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
      // Only count active students with active user accounts
      this.prisma.student.count({
        where: {
          institutionId,
          isActive: true,
          user: { active: true },
        },
      }),
      // Only count active faculty members
      this.prisma.user.count({
        where: {
          institutionId,
          role: { in: [Role.TEACHER, Role.FACULTY_SUPERVISOR] },
          active: true,
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
      // Only count placements for active students
      this.prisma.placement.count({
        where: {
          OR: [
            { institutionId },
            { student: { institutionId, isActive: true, user: { active: true } } },
          ],
        },
      }),
      // Only count applications from active students with active applications
      this.prisma.internshipApplication.count({
        where: {
          isActive: true,
          student: { institutionId, isActive: true, user: { active: true } },
        },
      }),
      this.prisma.branch.findMany({
        where: { institutionId },
        include: {
          _count: {
            select: {
              students: {
                where: { isActive: true, user: { active: true } },
              },
            },
          },
        },
      }),
      // Only aggregate placement salary for active students
      this.prisma.placement.aggregate({
        where: {
          OR: [
            { institutionId },
            { student: { institutionId, isActive: true, user: { active: true } } },
          ],
        },
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
    const where: Record<string, unknown> = {
      // Only include active students with active user accounts by default
      isActive: true,
      user: { active: true },
    };
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.branchId) {
      where.branchId = filters.branchId;
    }

    // Handle explicit isActive filter override
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      where.isActive = isActiveValue;
    }

    // Fetch students with their internship applications and monthly reports
    const students = await this.prisma.student.findMany({
      where,
      include: {
        user: { select: { active: true } },
        branch: { select: { name: true } },
        internshipApplications: {
          where: {
            status: { in: ['APPROVED', 'SELECTED'] },
            isActive: true, // Only active applications
          },
          include: {
            mentor: { select: { name: true, active: true } },
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
        isActive: student.isActive,
        userActive: (student as any).user?.active ?? true,
      };
    });

    // Apply complianceLevel filter if specified
    if (filters?.complianceLevel) {
      return results.filter((r) => r.complianceLevel === filters.complianceLevel);
    }

    return results;
  }

  /**
   * Generate User Login Activity Report
   * Tracks user login activity, password changes, and first-time logins
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateUserLoginActivityReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.role) {
      if (Array.isArray(filters.role)) {
        where.role = { in: filters.role };
      } else {
        where.role = filters.role;
      }
    }

    // Handle login status filter
    if (filters?.loginStatus === 'logged_in') {
      where.loginCount = { gt: 0 };
    } else if (filters?.loginStatus === 'never_logged_in') {
      where.loginCount = 0;
    }

    // Handle password status filter
    if (filters?.passwordStatus === 'changed') {
      where.hasChangedDefaultPassword = true;
    } else if (filters?.passwordStatus === 'default') {
      where.hasChangedDefaultPassword = false;
    }

    // Handle activity status filter
    if (filters?.activityStatus) {
      const now = new Date();
      switch (filters.activityStatus) {
        case 'active_7':
          where.lastLoginAt = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
          break;
        case 'active_30':
          where.lastLoginAt = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
          break;
        case 'inactive_30':
          where.OR = [
            { lastLoginAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
            { lastLoginAt: null },
          ];
          break;
        case 'inactive_90':
          where.OR = [
            { lastLoginAt: { lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } },
            { lastLoginAt: null },
          ];
          break;
      }
    }

    // Handle account status filter - checks BOTH User.active AND Student.isActive for students
    const accountActive = this.parseBooleanLike(filters?.isActive);
    if (accountActive !== undefined) {
      where.active = accountActive;
      // For students, also filter by Student.isActive
      if (accountActive === true) {
        where.OR = [
          { role: { not: 'STUDENT' } }, // Non-students just need User.active
          { role: 'STUDENT', Student: { isActive: true } }, // Students need both User.active AND Student.isActive
        ];
      }
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        Institution: { select: { name: true } },
        Student: { select: { isActive: true } }, // Include Student.isActive for accurate reporting
      },
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });

    this.warnOnLargeResultSet(users.length, 'UserLoginActivityReport');

    const now = new Date();

    return users.map((user) => {
      const daysSinceCreation = Math.floor((now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const daysSinceLastLogin = user.lastLoginAt
        ? Math.floor((now.getTime() - user.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      let status = 'Never Logged In';
      if (user.loginCount > 0) {
        if (daysSinceLastLogin !== null && daysSinceLastLogin <= 7) {
          status = 'Active';
        } else if (daysSinceLastLogin !== null && daysSinceLastLogin <= 30) {
          status = 'Recently Active';
        } else {
          status = 'Inactive';
        }
      }

      // For students: check BOTH User.active AND Student.isActive
      // For non-students: only check User.active
      const userActive = user.active;
      const studentActive = user.role === 'STUDENT' ? ((user as any).Student?.isActive ?? false) : null;
      // isActive is true only when BOTH conditions are met (for students)
      const isActive = user.role === 'STUDENT'
        ? (userActive && studentActive === true)
        : userActive;

      return {
        userName: user.name,
        email: user.email,
        phoneNo: user.phoneNo,
        role: user.role,
        institutionName: user.Institution?.name ?? 'N/A',
        rollNumber: user.rollNumber,
        designation: user.designation,
        accountCreatedAt: user.createdAt,
        loginCount: user.loginCount,
        lastLoginAt: user.lastLoginAt,
        previousLoginAt: user.previousLoginAt,
        lastLoginIp: user.lastLoginIp,
        hasChangedPassword: user.hasChangedDefaultPassword,
        passwordChangedAt: user.passwordChangedAt,
        daysSinceLastLogin,
        daysSinceCreation,
        isActive, // Combined: User.active AND (for students) Student.isActive
        userActive, // User account active status
        studentActive, // Student record active status (null for non-students)
        status,
      };
    });
  }

  /**
   * Generate User Session History Report
   * Detailed session history including IP addresses, devices, and session duration
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateUserSessionHistoryReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    // Build user filter with institution and active status
    const userFilter: Record<string, unknown> = {};
    if (filters?.institutionId) {
      userFilter.institutionId = filters.institutionId;
    }

    // Filter by active users only by default (both User.active AND Student.isActive for students)
    const accountActive = this.parseBooleanLike(filters?.isActive);
    if (accountActive !== undefined) {
      userFilter.active = accountActive;
      if (accountActive === true) {
        userFilter.OR = [
          { role: { not: 'STUDENT' } },
          { role: 'STUDENT', Student: { isActive: true } },
        ];
      }
    } else {
      // Default to active users only
      userFilter.active = true;
      userFilter.OR = [
        { role: { not: 'STUDENT' } },
        { role: 'STUDENT', Student: { isActive: true } },
      ];
    }

    if (Object.keys(userFilter).length > 0) {
      where.user = userFilter;
    }

    // Handle session status filter
    const now = new Date();
    if (filters?.sessionStatus === 'active') {
      where.expiresAt = { gt: now };
      where.invalidatedAt = null;
    } else if (filters?.sessionStatus === 'expired') {
      where.expiresAt = { lt: now };
    } else if (filters?.sessionStatus === 'invalidated') {
      where.invalidatedAt = { not: null };
    }

    // Handle date range filter
    if (filters?.startDate || filters?.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (filters.startDate) {
        dateFilter.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        dateFilter.lte = new Date(filters.endDate);
      }
      where.createdAt = dateFilter;
    }

    const sessions = await this.prisma.userSession.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true,
            active: true,
            Institution: { select: { name: true } },
            Student: { select: { isActive: true } },
          },
        },
      },
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });

    this.warnOnLargeResultSet(sessions.length, 'UserSessionHistoryReport');

    return sessions.map((session) => {
      const sessionDuration = Math.floor(
        (session.lastActivityAt.getTime() - session.createdAt.getTime()) / (1000 * 60)
      );
      const isSessionActive = session.expiresAt > now && !session.invalidatedAt;

      // User active status
      const userActive = session.user.active;
      const studentActive = session.user.role === 'STUDENT'
        ? ((session.user as any).Student?.isActive ?? false)
        : null;
      const isUserActive = session.user.role === 'STUDENT'
        ? (userActive && studentActive === true)
        : userActive;

      return {
        userName: session.user.name,
        email: session.user.email,
        role: session.user.role,
        institutionName: session.user.Institution?.name ?? 'N/A',
        sessionStartedAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
        sessionDuration,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        deviceInfo: session.deviceInfo,
        isActive: isSessionActive, // Session active status
        isUserActive, // User account active status (combined)
        userActive, // User.active
        studentActive, // Student.isActive (null for non-students)
        expiresAt: session.expiresAt,
      };
    });
  }

  /**
   * Generate Never Logged In Users Report
   * Users who have never logged into the system since account creation
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateNeverLoggedInUsersReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      loginCount: 0,
    };
    const { take, skip } = this.getPaginationParams(pagination);

    // Default to active users only, unless explicitly filtering for inactive
    // This makes sense for "never logged in" report - we want to identify active users who haven't logged in
    // For students, we also check Student.isActive
    const accountActive = this.parseBooleanLike(filters?.isActive);
    if (accountActive !== undefined) {
      where.active = accountActive;
      // For students, also filter by Student.isActive when filtering for active users
      if (accountActive === true) {
        where.OR = [
          { role: { not: 'STUDENT' } }, // Non-students just need User.active
          { role: 'STUDENT', Student: { isActive: true } }, // Students need both
        ];
      }
    } else {
      // Default to active users only (both User.active AND Student.isActive for students)
      where.active = true;
      where.OR = [
        { role: { not: 'STUDENT' } },
        { role: 'STUDENT', Student: { isActive: true } },
      ];
    }

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.role) {
      if (Array.isArray(filters.role)) {
        where.role = { in: filters.role };
      } else {
        where.role = filters.role;
      }
    }

    if (filters?.createdAfter) {
      where.createdAt = { ...(where.createdAt as object || {}), gte: new Date(filters.createdAfter) };
    }

    if (filters?.createdBefore) {
      where.createdAt = { ...(where.createdAt as object || {}), lte: new Date(filters.createdBefore) };
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        Institution: { select: { name: true } },
        Student: { select: { isActive: true } }, // Include Student.isActive
      },
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });

    this.warnOnLargeResultSet(users.length, 'NeverLoggedInUsersReport');

    const now = new Date();

    return users.map((user) => {
      const userActive = user.active;
      const studentActive = user.role === 'STUDENT' ? ((user as any).Student?.isActive ?? false) : null;
      const isActive = user.role === 'STUDENT'
        ? (userActive && studentActive === true)
        : userActive;

      return {
        userName: user.name,
        email: user.email,
        phoneNo: user.phoneNo,
        role: user.role,
        institutionName: user.Institution?.name ?? 'N/A',
        rollNumber: user.rollNumber,
        accountCreatedAt: user.createdAt,
        daysSinceCreation: Math.floor((now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        hasChangedPassword: user.hasChangedDefaultPassword,
        isActive, // Combined: User.active AND (for students) Student.isActive
        userActive,
        studentActive,
      };
    });
  }

  /**
   * Generate Default Password Users Report
   * Users who have not changed their default password
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateDefaultPasswordUsersReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      hasChangedDefaultPassword: false,
    };
    const { take, skip } = this.getPaginationParams(pagination);

    // Default to active users only, unless explicitly filtering for inactive
    // Security concern: We want to identify active users with default passwords
    // For students, we also check Student.isActive
    const accountActive = this.parseBooleanLike(filters?.isActive);
    if (accountActive !== undefined) {
      where.active = accountActive;
      if (accountActive === true) {
        where.OR = [
          { role: { not: 'STUDENT' } },
          { role: 'STUDENT', Student: { isActive: true } },
        ];
      }
    } else {
      // Default to active users only (both User.active AND Student.isActive for students)
      where.active = true;
      where.OR = [
        { role: { not: 'STUDENT' } },
        { role: 'STUDENT', Student: { isActive: true } },
      ];
    }

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.role) {
      if (Array.isArray(filters.role)) {
        where.role = { in: filters.role };
      } else {
        where.role = filters.role;
      }
    }

    const hasLoggedIn = this.parseBooleanLike(filters?.hasLoggedIn);
    if (hasLoggedIn !== undefined) {
      where.loginCount = hasLoggedIn ? { gt: 0 } : 0;
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        Institution: { select: { name: true } },
        Student: { select: { isActive: true } },
      },
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });

    this.warnOnLargeResultSet(users.length, 'DefaultPasswordUsersReport');

    const now = new Date();

    return users.map((user) => {
      const userActive = user.active;
      const studentActive = user.role === 'STUDENT' ? ((user as any).Student?.isActive ?? false) : null;
      const isActive = user.role === 'STUDENT'
        ? (userActive && studentActive === true)
        : userActive;

      return {
        userName: user.name,
        email: user.email,
        phoneNo: user.phoneNo,
        role: user.role,
        institutionName: user.Institution?.name ?? 'N/A',
        accountCreatedAt: user.createdAt,
        daysSinceCreation: Math.floor((now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        loginCount: user.loginCount,
        lastLoginAt: user.lastLoginAt,
        isActive,
        userActive,
        studentActive,
      };
    });
  }

  /**
   * Generate Inactive Users Report
   * Users who have not logged in for a specified period
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateInactiveUsersReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    // Default to active users only, unless explicitly filtering for inactive
    // This report identifies active user accounts that haven't been used recently
    // For students, we also check Student.isActive
    const accountActive = this.parseBooleanLike(filters?.isActive);
    if (accountActive !== undefined) {
      where.active = accountActive;
      if (accountActive === true) {
        where.AND = [
          {
            OR: [
              { role: { not: 'STUDENT' } },
              { role: 'STUDENT', Student: { isActive: true } },
            ],
          },
        ];
      }
    } else {
      // Default to active users only (both User.active AND Student.isActive for students)
      where.active = true;
      where.AND = [
        {
          OR: [
            { role: { not: 'STUDENT' } },
            { role: 'STUDENT', Student: { isActive: true } },
          ],
        },
      ];
    }

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.role) {
      if (Array.isArray(filters.role)) {
        where.role = { in: filters.role };
      } else {
        where.role = filters.role;
      }
    }

    // Apply inactive days filter
    const inactiveDays = Number(filters?.inactiveDays) || 30;
    const cutoffDate = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);

    // Add to existing AND array or create new one
    const inactiveCondition = {
      OR: [
        { lastLoginAt: { lt: cutoffDate } },
        { lastLoginAt: null, loginCount: { gt: 0 } }, // Has logged in before but no lastLoginAt (edge case)
      ],
    };

    if (where.AND) {
      (where.AND as any[]).push(inactiveCondition);
    } else {
      where.AND = [inactiveCondition];
    }

    // Ensure we only get users who have logged in at least once
    where.loginCount = { gt: 0 };

    const users = await this.prisma.user.findMany({
      where,
      include: {
        Institution: { select: { name: true } },
        Student: { select: { isActive: true } },
      },
      take,
      skip,
      orderBy: { lastLoginAt: 'asc' },
    });

    this.warnOnLargeResultSet(users.length, 'InactiveUsersReport');

    const now = new Date();

    return users.map((user) => {
      const userActive = user.active;
      const studentActive = user.role === 'STUDENT' ? ((user as any).Student?.isActive ?? false) : null;
      const isActive = user.role === 'STUDENT'
        ? (userActive && studentActive === true)
        : userActive;

      return {
        userName: user.name,
        email: user.email,
        phoneNo: user.phoneNo,
        role: user.role,
        institutionName: user.Institution?.name ?? 'N/A',
        lastLoginAt: user.lastLoginAt,
        daysSinceLastLogin: user.lastLoginAt
          ? Math.floor((now.getTime() - user.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24))
          : null,
        loginCount: user.loginCount,
        accountCreatedAt: user.createdAt,
        isActive,
        userActive,
        studentActive,
      };
    });
  }

  /**
   * Generate User Audit Log Report
   * Complete audit trail of user actions in the system
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateUserAuditLogReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.action) {
      if (Array.isArray(filters.action)) {
        where.action = { in: filters.action };
      } else {
        where.action = filters.action;
      }
    }

    if (filters?.entityType) {
      where.entityType = filters.entityType;
    }

    // Handle date range filter
    if (filters?.startDate || filters?.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (filters.startDate) {
        dateFilter.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        dateFilter.lte = new Date(filters.endDate);
      }
      where.timestamp = dateFilter;
    }

    const auditLogs = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            Institution: { select: { name: true } },
          },
        },
      },
      take,
      skip,
      orderBy: { timestamp: 'desc' },
    });

    this.warnOnLargeResultSet(auditLogs.length, 'UserAuditLogReport');

    return auditLogs.map((log) => ({
      userName: log.userName ?? log.user?.name ?? 'Unknown',
      userRole: log.userRole,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      description: log.description,
      institutionName: log.user?.Institution?.name ?? 'N/A',
      category: log.category,
      severity: log.severity,
      timestamp: log.timestamp,
    }));
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

    // User Activity Reports
    if (typeStr === 'user-login-activity' || typeStr.includes('login-activity')) {
      return this.generateUserLoginActivityReport(filters, pagination);
    }

    if (typeStr === 'user-session-history' || typeStr.includes('session-history')) {
      return this.generateUserSessionHistoryReport(filters, pagination);
    }

    if (typeStr === 'never-logged-in-users' || typeStr.includes('never-logged')) {
      return this.generateNeverLoggedInUsersReport(filters, pagination);
    }

    if (typeStr === 'default-password-users' || typeStr.includes('default-password')) {
      return this.generateDefaultPasswordUsersReport(filters, pagination);
    }

    if (typeStr === 'inactive-users' || typeStr.includes('inactive-user')) {
      return this.generateInactiveUsersReport(filters, pagination);
    }

    if (typeStr === 'user-audit-log' || typeStr.includes('audit-log')) {
      return this.generateUserAuditLogReport(filters, pagination);
    }

    // Unknown report type - reject instead of defaulting
    this.logger.error(`Unknown report type requested: ${type}`);
    throw new ForbiddenException(`Unknown report type: ${type}`);
  }
}
