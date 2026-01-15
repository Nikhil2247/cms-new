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
   * Format a date to Indian Standard Time (IST, UTC+5:30)
   * Returns formatted string in 'DD/MM/YYYY HH:mm:ss IST' format
   * Returns empty string for null/undefined/invalid input
   */
  private formatToIST(date: any): string {
    try {
      if (date === null || date === undefined || date === '') return '';

      // Convert to Date object
      let dateObj: Date;
      if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string' || typeof date === 'number') {
        dateObj = new Date(date);
      } else {
        return '';
      }

      // Check if date is valid
      const timestamp = dateObj.getTime();
      if (isNaN(timestamp) || !isFinite(timestamp)) return '';

      // IST is UTC+5:30
      const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
      const istDate = new Date(timestamp + istOffset);

      const day = String(istDate.getUTCDate()).padStart(2, '0');
      const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
      const year = istDate.getUTCFullYear();
      const hours = String(istDate.getUTCHours()).padStart(2, '0');
      const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
      const seconds = String(istDate.getUTCSeconds()).padStart(2, '0');

      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds} IST`;
    } catch (error) {
      return '';
    }
  }

  /**
   * Format a date to Indian Standard Time (IST) - date only format
   * Returns formatted string in 'DD/MM/YYYY' format
   * Returns empty string for null/undefined/invalid input
   */
  private formatToISTDateOnly(date: any): string {
    try {
      if (date === null || date === undefined || date === '') return '';

      // Convert to Date object
      let dateObj: Date;
      if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string' || typeof date === 'number') {
        dateObj = new Date(date);
      } else {
        return '';
      }

      // Check if date is valid
      const timestamp = dateObj.getTime();
      if (isNaN(timestamp) || !isFinite(timestamp)) return '';

      // IST is UTC+5:30
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(timestamp + istOffset);

      const day = String(istDate.getUTCDate()).padStart(2, '0');
      const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
      const year = istDate.getUTCFullYear();

      return `${day}/${month}/${year}`;
    } catch (error) {
      return '';
    }
  }

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
    // Default to active students with active user accounts
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      where.user = { active: isActiveValue };
      this.logger.debug(
        `Student directory filter: isActive=${isActiveValue} (raw: ${String(filters?.isActive)})`,
      );
    } else {
      // By default, only show active students with active user accounts
      where.user = { active: true };
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
            rollNumber: true,
            branchName: true,
          }
        },
        branch: { select: { id: true, name: true } },
        Institution: { select: { id: true, name: true, shortName: true } },
        // Get internship applications with mentor and status info
        internshipApplications: {
          select: {
            id: true,
            status: true,
            internshipPhase: true,
            companyName: true,
            jobProfile: true,
            mentor: { select: { id: true, name: true } },
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
        rollNumber: student.user.rollNumber,
        name: student.user.name,
        email: student.user.email ?? '',
        phoneNumber: student.user.phoneNo ?? '',

        // Academic info
        branchName: student.branch?.name ?? student.user.branchName ?? '',
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
        placementsCount: 0,
        isPlaced: false,

        // Status info
        clearanceStatus: student.clearanceStatus,
        isActive: student.user?.active ?? false,
        studentActive: student.user?.active ?? false,
        userActive: student.user?.active ?? false,

        // Timestamps (formatted in IST)
        createdAt: this.formatToIST(student.createdAt),
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
      studentWhere.user = { active: isActiveValue };
    } else {
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
    // Use createdAt for filtering since appliedDate/applicationDate default to migration timestamp
    // Database stores dates in UTC, so use UTC for filtering
    if (filters?.startDate || filters?.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (filters.startDate) {
        // Parse date and create UTC start of day
        const startDate = new Date(filters.startDate);
        dateFilter.gte = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 0, 0, 0, 0));
      }
      if (filters.endDate) {
        // Parse date and create UTC end of day
        const endDate = new Date(filters.endDate);
        dateFilter.lte = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23, 59, 59, 999));
      }
      // Apply to createdAt (which has actual application date from migrated data)
      where.createdAt = dateFilter;
    }

    const applications = await this.prisma.internshipApplication.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            institutionId: true,
            user: { select: { name: true, rollNumber: true, branchName: true, active: true } },
            mentorAssignments: {
              where: { isActive: true },
              select: { mentor: { select: { name: true } } },
              take: 1,
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

    return applications.map((application) => {
      // Parse city from companyAddress (e.g., "123 Street, City, State" -> "City")
      let companyCity = '';
      if (application.companyAddress) {
        const addressParts = application.companyAddress.split(',').map(part => part.trim());
        // Assume city is the second-to-last part or second part
        if (addressParts.length >= 2) {
          companyCity = addressParts[1] || '';
        }
      }

      // Get mentor name from application's direct mentor or from student's mentor assignment
      const mentorName = application.mentor?.name
        ?? application.student.mentorAssignments?.[0]?.mentor?.name
        ?? 'N/A';

      // Determine internship status (same logic as student directory report)
      let internshipStatus = 'Not Started';
      switch (application.status) {
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
          internshipStatus = application.status ?? 'Unknown';
      }

      return {
        studentName: application.student.user?.name,
        rollNumber: application.student.user?.rollNumber,
        branchName: application.student.user?.branchName,
        companyName: application.companyName,
        companyCity,
        jobProfile: application.jobProfile,
        // Use createdAt as the applied date since it's properly migrated from source data
        // (appliedDate and applicationDate both default to migration timestamp)
        appliedDate: this.formatToIST(application.createdAt),
        startDate: this.formatToISTDateOnly(application.startDate),
        endDate: this.formatToISTDateOnly(application.endDate),
        duration: application.internshipDuration,
        status: application.status,
        internshipStatus,
        verificationStatus: (application as any).verificationStatus ?? 'N/A',
        mentorName,
        reportsSubmitted: application._count.monthlyReports,
        location: application.companyAddress,
        isSelfIdentified: application.isSelfIdentified,
        isActive: application.student.user?.active ?? false,
        userActive: application.student.user?.active ?? true,
      };
    });
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
    const where: Record<string, unknown> = { isDeleted: false };
    const { take, skip } = this.getPaginationParams(pagination);

    // Build student filter with active checks
    const studentFilter: Record<string, unknown> = {};
    if (filters?.institutionId) {
      studentFilter.institutionId = filters.institutionId;
    }

    // Default to active students only, unless explicitly filtering for inactive
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      studentFilter.user = { active: isActiveValue };
    } else {
      // By default, only show visits for active students with active accounts
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
    // Database stores dates in UTC, so use UTC for filtering
    if (filters?.startDate || filters?.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        dateFilter.gte = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 0, 0, 0, 0));
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        dateFilter.lte = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23, 59, 59, 999));
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
          select: {
            id: true,
            companyName: true,
            student: { select: { id: true, user: { select: { name: true, rollNumber: true, active: true } } } },
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
      studentName: visit.application.student.user?.name,
      rollNumber: visit.application.student.user?.rollNumber,
      studentActive: visit.application.student.user?.active,
      companyName: visit.application.companyName,
      visitDate: this.formatToIST(visit.visitDate),
      visitType: visit.visitType,
      visitLocation: visit.visitLocation,
      followUpRequired: visit.followUpRequired,
      nextVisitDate: this.formatToISTDateOnly(visit.nextVisitDate),
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
    const where: Record<string, unknown> = {
      isDeleted: false,
    };
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
      studentFilter.user = { active: isActiveValue };
    } else {
      // By default, only show reports for active students with active accounts
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
            user: { select: { name: true, rollNumber: true, active: true } },
          },
        },
        application: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
      take,
      skip,
      orderBy: [{ reportYear: 'desc' }, { reportMonth: 'desc' }],
    });

    this.warnOnLargeResultSet(reports.length, 'MonthlyReport');

    return reports.map((report) => ({
      studentName: report.student.user?.name,
      rollNumber: report.student.user?.rollNumber,
      companyName: report.application.companyName ?? '',
      month: report.reportMonth,
      year: report.reportYear,
      status: report.status,
      submittedAt: this.formatToIST(report.submittedAt),
      reportFileUrl: report.reportFileUrl,
      isActive: report.student.user?.active ?? false,
      userActive: report.student.user?.active ?? true,
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
    // Placement feature removed from schema
    return [];
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
          user: { active: true },
        },
      }),
      // Only count active faculty members
      this.prisma.user.count({
        where: {
          institutionId,
          role: { in: [Role.TEACHER] },
          active: true,
        },
      }),
      // Internship portal removed; derive from self-identified applications
      this.prisma.internshipApplication.count({
        where: {
          isActive: true,
          isSelfIdentified: true,
          internshipPhase: 'ACTIVE' as any,
          student: { institutionId, user: { active: true } },
        },
      }),
      this.prisma.internshipApplication.count({
        where: {
          isActive: true,
          isSelfIdentified: true,
          internshipPhase: 'COMPLETED' as any,
          student: { institutionId, user: { active: true } },
        },
      }),
      Promise.resolve(0),
      // Only count applications from active students with active applications
      this.prisma.internshipApplication.count({
        where: {
          isActive: true,
          student: { institutionId, user: { active: true } },
        },
      }),
      this.prisma.branch.findMany({
        where: { institutionId },
        include: {
          _count: {
            select: {
              students: {
                where: { user: { active: true } },
              },
            },
          },
        },
      }),
      Promise.resolve({ _avg: { salary: 0 } }),
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
        value: (avgPlacementSalary as any)._avg?.salary || 0,
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
      where.user = { active: isActiveValue };
    }

    // Fetch students with their internship applications and monthly reports
    const students = await this.prisma.student.findMany({
      where,
      include: {
        user: { select: { name: true, rollNumber: true, branchName: true, active: true } },
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
        rollNumber: student.user?.rollNumber,
        name: student.user?.name,
        branchName: student.branch?.name ?? student.user?.branchName,
        mentorName,
        joiningReportStatus: activeApplications.length > 0 ? 'Submitted' : 'Not Started',
        monthlyReportsSubmitted: submittedReports.length,
        monthlyReportsPending: pendingReports.length,
        lastReportDate: this.formatToIST(lastReport?.submittedAt ?? null),
        complianceScore,
        complianceLevel,
        isActive: student.user?.active ?? false,
        userActive: student.user?.active ?? true,
      };
    });

    // Apply complianceLevel filter if specified
    if (filters?.complianceLevel) {
      return results.filter((r) => r.complianceLevel === filters.complianceLevel);
    }

    return results;
  }


  /**
   * Generate Students Without Internship Report
   * Returns students who have not filled any internship application
   * Includes: Name, Roll Number, College Name, Mentor Name
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateStudentsWithoutInternshipReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    // Institution filter
    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    // Branch filter
    if (filters?.branchId) {
      where.branchId = filters.branchId;
    }

    // Year filter
    if (filters?.currentYear !== undefined && filters?.currentYear !== null) {
      where.currentYear = Number(filters.currentYear);
    }

    // Handle isActive filter - default to active students with active user accounts
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      where.user = { active: isActiveValue };
    } else {
      where.user = { active: true };
    }

    // Mentor filter (applied post-query)
    const mentorFilter = filters?.mentorId;

    // Find students who have NO internship applications at all
    const students = await this.prisma.student.findMany({
      where: {
        ...where,
        internshipApplications: {
          none: {},
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNo: true,
            active: true,
            rollNumber: true,
            branchName: true,
          },
        },
        branch: { select: { id: true, name: true } },
        Institution: { select: { id: true, name: true, shortName: true } },
        mentorAssignments: {
          where: { isActive: true },
          select: {
            mentor: { select: { id: true, name: true } },
          },
          orderBy: { assignmentDate: 'desc' },
          take: 1,
        },
      },
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });

    this.warnOnLargeResultSet(students.length, 'StudentsWithoutInternshipReport');

    // Apply mentor filter if specified
    let filteredStudents = students;
    if (mentorFilter) {
      filteredStudents = students.filter((student) => {
        const assignedMentor = student.mentorAssignments[0]?.mentor?.id;
        return assignedMentor === mentorFilter;
      });
    }

    return filteredStudents.map((student) => {
      const mentorName = student.mentorAssignments[0]?.mentor?.name ?? 'Not Assigned';

      return {
        rollNumber: student.user.rollNumber,
        name: student.user.name,
        email: student.user.email ?? '',
        phoneNumber: student.user.phoneNo ?? '',
        branchName: student.branch?.name ?? student.user.branchName ?? '',
        currentYear: student.currentYear,
        currentSemester: student.currentSemester,
        institutionName: student.Institution?.name ?? '',
        mentorName,
        isActive: student.user?.active ?? false,
        createdAt: this.formatToIST(student.createdAt),
      };
    });
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

    // Handle account status filter - checks User.active
    const accountActive = this.parseBooleanLike(filters?.isActive);
    if (accountActive !== undefined) {
      where.active = accountActive;
      // For students, also check that Student record exists
      if (accountActive === true) {
        where.OR = [
          { role: { not: 'STUDENT' } }, // Non-students just need User.active
          { role: 'STUDENT', Student: { isNot: null } }, // Students need User.active AND Student record
        ];
      }
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        Institution: { select: { name: true } },
        Student: { select: { id: true } }, // Include Student relation for accurate reporting
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

      // For students: check User.active AND Student record exists
      // For non-students: only check User.active
      const userActive = user.active;
      const studentActive = user.role === 'STUDENT' ? ((user as any).Student ? true : false) : null;
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
        accountCreatedAt: this.formatToIST(user.createdAt),
        loginCount: user.loginCount,
        lastLoginAt: this.formatToIST(user.lastLoginAt),
        previousLoginAt: this.formatToIST(user.previousLoginAt),
        lastLoginIp: user.lastLoginIp,
        hasChangedPassword: user.hasChangedDefaultPassword,
        passwordChangedAt: this.formatToIST(user.passwordChangedAt),
        daysSinceLastLogin,
        daysSinceCreation,
        isActive, // Combined: User.active AND (for students) Student record exists
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

    // Filter by active users only by default (User.active and Student record exists for students)
    const accountActive = this.parseBooleanLike(filters?.isActive);
    if (accountActive !== undefined) {
      userFilter.active = accountActive;
      if (accountActive === true) {
        userFilter.OR = [
          { role: { not: 'STUDENT' } },
          { role: 'STUDENT', Student: { isNot: null } },
        ];
      }
    } else {
      // Default to active users only
      userFilter.active = true;
      userFilter.OR = [
        { role: { not: 'STUDENT' } },
        { role: 'STUDENT', Student: { isNot: null } },
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
    // Database stores dates in UTC, so use UTC for filtering
    if (filters?.startDate || filters?.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        dateFilter.gte = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 0, 0, 0, 0));
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        dateFilter.lte = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23, 59, 59, 999));
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
            Student: { select: { id: true } },
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
        ? ((session.user as any).Student ? true : false)
        : null;
      const isUserActive = session.user.role === 'STUDENT'
        ? (userActive && studentActive === true)
        : userActive;

      return {
        userName: session.user.name,
        email: session.user.email,
        role: session.user.role,
        institutionName: session.user.Institution?.name ?? 'N/A',
        sessionStartedAt: this.formatToIST(session.createdAt),
        lastActivityAt: this.formatToIST(session.lastActivityAt),
        sessionDuration,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        deviceInfo: session.deviceInfo,
        isActive: isSessionActive, // Session active status
        isUserActive, // User account active status (combined)
        userActive, // User.active
        studentActive, // Student record exists (null for non-students)
        expiresAt: this.formatToIST(session.expiresAt),
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
    // For students, we also check that Student record exists
    const accountActive = this.parseBooleanLike(filters?.isActive);
    if (accountActive !== undefined) {
      where.active = accountActive;
      // For students, also filter by Student record existence when filtering for active users
      if (accountActive === true) {
        where.OR = [
          { role: { not: 'STUDENT' } }, // Non-students just need User.active
          { role: 'STUDENT', Student: { isNot: null } }, // Students need User.active AND Student record
        ];
      }
    } else {
      // Default to active users only (User.active AND Student record exists for students)
      where.active = true;
      where.OR = [
        { role: { not: 'STUDENT' } },
        { role: 'STUDENT', Student: { isNot: null } },
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
        Student: { select: { id: true } }, // Include Student relation
      },
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });

    this.warnOnLargeResultSet(users.length, 'NeverLoggedInUsersReport');

    const now = new Date();

    return users.map((user) => {
      const userActive = user.active;
      const studentActive = user.role === 'STUDENT' ? ((user as any).Student ? true : false) : null;
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
        accountCreatedAt: this.formatToIST(user.createdAt),
        daysSinceCreation: Math.floor((now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        hasChangedPassword: user.hasChangedDefaultPassword,
        isActive, // Combined: User.active AND (for students) Student record exists
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
    // For students, we also check that Student record exists
    const accountActive = this.parseBooleanLike(filters?.isActive);
    if (accountActive !== undefined) {
      where.active = accountActive;
      if (accountActive === true) {
        where.OR = [
          { role: { not: 'STUDENT' } },
          { role: 'STUDENT', Student: { isNot: null } },
        ];
      }
    } else {
      // Default to active users only (User.active AND Student record exists for students)
      where.active = true;
      where.OR = [
        { role: { not: 'STUDENT' } },
        { role: 'STUDENT', Student: { isNot: null } },
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
        Student: { select: { id: true } },
      },
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });

    this.warnOnLargeResultSet(users.length, 'DefaultPasswordUsersReport');

    const now = new Date();

    return users.map((user) => {
      const userActive = user.active;
      const studentActive = user.role === 'STUDENT' ? ((user as any).Student ? true : false) : null;
      const isActive = user.role === 'STUDENT'
        ? (userActive && studentActive === true)
        : userActive;

      return {
        userName: user.name,
        email: user.email,
        phoneNo: user.phoneNo,
        role: user.role,
        institutionName: user.Institution?.name ?? 'N/A',
        accountCreatedAt: this.formatToIST(user.createdAt),
        daysSinceCreation: Math.floor((now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        loginCount: user.loginCount,
        lastLoginAt: this.formatToIST(user.lastLoginAt),
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
    // For students, we also check that Student record exists
    const accountActive = this.parseBooleanLike(filters?.isActive);
    if (accountActive !== undefined) {
      where.active = accountActive;
      if (accountActive === true) {
        where.AND = [
          {
            OR: [
              { role: { not: 'STUDENT' } },
              { role: 'STUDENT', Student: { isNot: null } },
            ],
          },
        ];
      }
    } else {
      // Default to active users only (User.active AND Student record exists for students)
      where.active = true;
      where.AND = [
        {
          OR: [
            { role: { not: 'STUDENT' } },
            { role: 'STUDENT', Student: { isNot: null } },
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
        Student: { select: { id: true } },
      },
      take,
      skip,
      orderBy: { lastLoginAt: 'asc' },
    });

    this.warnOnLargeResultSet(users.length, 'InactiveUsersReport');

    const now = new Date();

    return users.map((user) => {
      const userActive = user.active;
      const studentActive = user.role === 'STUDENT' ? ((user as any).Student ? true : false) : null;
      const isActive = user.role === 'STUDENT'
        ? (userActive && studentActive === true)
        : userActive;

      return {
        userName: user.name,
        email: user.email,
        phoneNo: user.phoneNo,
        role: user.role,
        institutionName: user.Institution?.name ?? 'N/A',
        lastLoginAt: this.formatToIST(user.lastLoginAt),
        daysSinceLastLogin: user.lastLoginAt
          ? Math.floor((now.getTime() - user.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24))
          : null,
        loginCount: user.loginCount,
        accountCreatedAt: this.formatToIST(user.createdAt),
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
    // Database stores dates in UTC, so use UTC for filtering
    if (filters?.startDate || filters?.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        dateFilter.gte = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 0, 0, 0, 0));
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        dateFilter.lte = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23, 59, 59, 999));
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
      timestamp: this.formatToIST(log.timestamp),
    }));
  }

  /**
   * Generate report based on type
   * Uses exact type matching with switch statement to prevent routing bugs
   * @param type - Report type (must match keys in definitions/*.definition.ts)
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
    const typeStr = String(type).toLowerCase();

    // SECURITY: Validate institution isolation before generating any report
    this.validateInstitutionIsolation(typeStr, filters, isAdmin);

    this.logger.log(
      `Generating report: ${type}, institutionId: ${filters?.institutionId || 'N/A'}, ` +
      `pagination: take=${pagination?.take ?? DEFAULT_MAX_RECORDS}, skip=${pagination?.skip ?? 0}`,
    );

    // Use exact type matching to prevent routing bugs
    switch (typeStr) {
      // ==================== Student Reports (4) ====================
      case 'student-directory':
      case 'student-internship-status':
      case 'student-by-branch':
        return this.generateStudentProgressReport(filters, pagination);
      case 'student-compliance':
        return this.generateStudentComplianceReport(filters, pagination);
      case 'students-without-internship':
        return this.generateStudentsWithoutInternshipReport(filters, pagination);

      // ==================== Mentor Reports (4) ====================
      case 'mentor-list':
        return this.generateMentorListReport(filters, pagination);
      case 'mentor-student-assignments':
        return this.generateMentorStudentAssignmentsReport(filters, pagination);
      case 'mentor-utilization':
        return this.generateMentorUtilizationReport(filters, pagination);
      case 'unassigned-students':
        return this.generateUnassignedStudentsReport(filters, pagination);

      // ==================== Internship Reports (4) ====================
      case 'internship-applications':
        return this.generateInternshipReport(filters, pagination);
      case 'internship-by-institution':
        return this.generateInternshipByInstitutionReport(filters, pagination);
      case 'internship-by-industry':
        return this.generateInternshipByIndustryReport(filters, pagination);
      case 'self-identified-internships':
        // Set filter to only show self-identified internships
        return this.generateInternshipReport({ ...filters, isSelfIdentified: true }, pagination);

      // ==================== Compliance Reports (3) ====================
      case 'faculty-visit-compliance':
        return this.generateFacultyVisitComplianceReport(filters, pagination);
      case 'monthly-report-compliance':
        return this.generateMonthlyReportComplianceReport(filters, pagination);
      case 'joining-report-status':
        return this.generateJoiningReportStatusReport(filters, pagination);

      // ==================== Institute Reports (3) ====================
      case 'institute-summary':
        return this.generateInstituteSummaryReport(filters, pagination);
      case 'institute-comparison':
        return this.generateInstituteComparisonReport(filters, pagination);
      case 'branch-wise-summary':
        return this.generateBranchWiseSummaryReport(filters, pagination);

      // ==================== Pending Reports (4) ====================
      case 'pending-monthly-visits':
        return this.generatePendingMonthlyVisitsReport(filters, pagination);
      case 'pending-monthly-reports':
        return this.generatePendingMonthlyReportsReport(filters, pagination);
      case 'pending-joining-letters':
        return this.generatePendingJoiningLettersReport(filters, pagination);
      case 'pending-mentor-assignments':
        return this.generateUnassignedStudentsReport(filters, pagination); // Same as unassigned-students

      // ==================== User Activity Reports (6) ====================
      case 'user-login-activity':
        return this.generateUserLoginActivityReport(filters, pagination);
      case 'user-session-history':
        return this.generateUserSessionHistoryReport(filters, pagination);
      case 'never-logged-in-users':
        return this.generateNeverLoggedInUsersReport(filters, pagination);
      case 'default-password-users':
        return this.generateDefaultPasswordUsersReport(filters, pagination);
      case 'inactive-users':
        return this.generateInactiveUsersReport(filters, pagination);
      case 'user-audit-log':
        return this.generateUserAuditLogReport(filters, pagination);

      // ==================== Legacy Support ====================
      // Support for legacy enum values
      case ReportType.STUDENT_PROGRESS:
        return this.generateStudentProgressReport(filters, pagination);
      case ReportType.INTERNSHIP:
        return this.generateInternshipReport(filters, pagination);
      case ReportType.FACULTY_VISIT:
        return this.generateFacultyVisitReport(filters, pagination);
      case ReportType.MONTHLY:
        return this.generateMonthlyReport(filters, pagination);
      case ReportType.PLACEMENT:
        return this.generatePlacementReport(filters, pagination);
      case ReportType.INSTITUTION_PERFORMANCE:
        return this.generateInstitutionPerformanceReport(filters);

      default:
        this.logger.error(`Unknown report type requested: ${type}`);
        throw new ForbiddenException(`Unknown report type: ${type}. Valid types: student-directory, mentor-list, internship-applications, etc.`);
    }
  }

  // ==================== Mentor Report Generators ====================

  /**
   * Generate Mentor List Report
   * Lists all faculty members who can be assigned as mentors
   * @param filters - Filter criteria (institutionId, isActive)
   * @param pagination - Optional pagination options
   */
  async generateMentorListReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      role: Role.TEACHER,
    };
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.department) {
      where.branchName = filters.department;
    }

    // Default to active faculty only
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      where.active = isActiveValue;
    } else {
      where.active = true;
    }

    const mentors = await this.prisma.user.findMany({
      where,
      include: {
        Institution: { select: { name: true } },
        mentorAssignments: {
          where: { isActive: true },
          include: {
            student: {
              include: {
                internshipApplications: {
                  where: { isActive: true },
                  select: { id: true, completedVisitsCount: true },
                },
              },
            },
          },
        },
        _count: {
          select: {
            mentorAssignments: { where: { isActive: true } },
          },
        },
      },
      take,
      skip,
      orderBy: { name: 'asc' },
    });

    this.warnOnLargeResultSet(mentors.length, 'MentorListReport');

    // Apply hasAssignments filter if specified
    let filteredMentors = mentors;
    if (filters?.hasAssignments !== undefined) {
      const hasAssignments = this.parseBooleanLike(filters.hasAssignments);
      if (hasAssignments === true) {
        filteredMentors = mentors.filter((m) => m._count.mentorAssignments > 0);
      } else if (hasAssignments === false) {
        filteredMentors = mentors.filter((m) => m._count.mentorAssignments === 0);
      }
    }

    return filteredMentors.map((mentor) => {
      // Count active internships and visits from assignments
      let activeInternships = 0;
      let visitsCompleted = 0;

      mentor.mentorAssignments.forEach((assignment) => {
        assignment.student.internshipApplications.forEach((app) => {
          activeInternships++;
          visitsCompleted += app.completedVisitsCount;
        });
      });

      return {
        name: mentor.name,
        email: mentor.email,
        phoneNumber: mentor.phoneNo,
        designation: mentor.designation,
        department: mentor.branchName ?? 'N/A',
        institutionName: mentor.Institution?.name ?? 'N/A',
        assignedStudents: mentor._count.mentorAssignments,
        activeInternships,
        visitsCompleted,
        isActive: mentor.active,
      };
    });
  }

  /**
   * Generate Mentor-Student Assignments Report
   * Shows mentor-student assignment relationships - matches mentor-reports.definition.ts columns
   * @param filters - Filter criteria (institutionId, mentorId, branchId, isActive)
   * @param pagination - Optional pagination options
   */
  async generateMentorStudentAssignmentsReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      isActive: true,
    };
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.mentorId) {
      where.mentorId = filters.mentorId;
    }

    // Build student filter
    const studentFilter: Record<string, unknown> = {};
    if (filters?.institutionId) {
      studentFilter.institutionId = filters.institutionId;
    }
    if (filters?.branchId) {
      studentFilter.branchId = filters.branchId;
    }

    // Default to active students and mentors
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      studentFilter.user = { active: isActiveValue };
      where.mentor = { active: isActiveValue };
    } else {
      studentFilter.user = { active: true };
      where.mentor = { active: true };
    }

    if (Object.keys(studentFilter).length > 0) {
      where.student = studentFilter;
    }

    const assignments = await this.prisma.mentorAssignment.findMany({
      where,
      include: {
        mentor: { select: { id: true, name: true, email: true, designation: true, active: true } },
        student: {
          select: {
            id: true,
            user: { select: { name: true, rollNumber: true, branchName: true, active: true } },
            Institution: { select: { name: true } },
            branch: { select: { name: true } },
            internshipApplications: {
              where: { isActive: true },
              select: {
                companyName: true,
                internshipPhase: true,
                status: true,
                completedVisitsCount: true,
                submittedReportsCount: true,
                facultyVisitLogs: {
                  select: { visitDate: true },
                  orderBy: { visitDate: 'desc' },
                  take: 1,
                },
              },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
            monthlyReports: {
              where: { status: 'APPROVED' },
              select: { id: true },
            },
          },
        },
      },
      take,
      skip,
      orderBy: { assignmentDate: 'desc' },
    });

    this.warnOnLargeResultSet(assignments.length, 'MentorStudentAssignmentsReport');

    return assignments.map((assignment) => {
      const app = assignment.student.internshipApplications[0];
      const lastVisit = app?.facultyVisitLogs[0]?.visitDate ?? null;

      // Map internship phase to status string
      let internshipStatus = 'Not Started';
      if (app) {
        switch (app.internshipPhase) {
          case 'ACTIVE': internshipStatus = 'Active'; break;
          case 'COMPLETED': internshipStatus = 'Completed'; break;
          case 'NOT_STARTED': internshipStatus = 'Not Started'; break;
          default: internshipStatus = app.status ?? 'Unknown';
        }
      }

      return {
        mentorName: assignment.mentor.name,
        mentorEmail: assignment.mentor.email,
        studentName: assignment.student.user?.name,
        studentRollNumber: assignment.student.user?.rollNumber,
        branchName: assignment.student.branch?.name ?? assignment.student.user?.branchName,
        companyName: app?.companyName ?? 'N/A',
        internshipStatus,
        assignedDate: this.formatToISTDateOnly(assignment.assignmentDate),
        lastVisitDate: this.formatToIST(lastVisit),
        reportsReviewed: assignment.student.monthlyReports.length,
        studentActive: assignment.student.user?.active ?? false,
        mentorActive: assignment.mentor.active,
      };
    });
  }

  /**
   * Generate Mentor Utilization Report
   * Shows mentor workload and utilization metrics
   * @param filters - Filter criteria (institutionId, isActive)
   * @param pagination - Optional pagination options
   */
  async generateMentorUtilizationReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      role: Role.TEACHER,
    };
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    // Default to active faculty only
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      where.active = isActiveValue;
    } else {
      where.active = true;
    }

    const mentors = await this.prisma.user.findMany({
      where,
      include: {
        Institution: { select: { name: true } },
        mentorAssignments: {
          include: {
            student: {
              include: {
                internshipApplications: {
                  where: { isActive: true },
                  select: {
                    status: true,
                    internshipPhase: true,
                    completedVisitsCount: true,
                    totalExpectedVisits: true,
                  },
                },
              },
            },
          },
        },
        facultyVisitLogs: {
          where: { isDeleted: false },
          select: { id: true, visitDate: true },
        },
      },
      take,
      skip,
      orderBy: { name: 'asc' },
    });

    this.warnOnLargeResultSet(mentors.length, 'MentorUtilizationReport');

    return mentors.map((mentor) => {
      const activeAssignments = mentor.mentorAssignments.filter((a) => a.isActive);
      const totalAssigned = activeAssignments.length;

      // Count active and completed internships from assigned students
      let activeInternships = 0;
      let completedInternships = 0;
      let totalExpectedVisits = 0;
      let completedVisits = 0;

      activeAssignments.forEach((assignment) => {
        assignment.student.internshipApplications.forEach((app) => {
          if (app.internshipPhase === 'ACTIVE') activeInternships++;
          if (app.internshipPhase === 'COMPLETED') completedInternships++;
          totalExpectedVisits += app.totalExpectedVisits;
          completedVisits += app.completedVisitsCount;
        });
      });

      const utilizationRate = totalExpectedVisits > 0
        ? Math.round((completedVisits / totalExpectedVisits) * 100)
        : 0;

      const lastVisit = mentor.facultyVisitLogs.length > 0
        ? mentor.facultyVisitLogs.sort((a, b) => b.visitDate.getTime() - a.visitDate.getTime())[0]?.visitDate
        : null;

      return {
        mentorName: mentor.name,
        email: mentor.email,
        designation: mentor.designation,
        department: mentor.branchName,
        institutionName: mentor.Institution?.name ?? 'N/A',
        totalAssigned,
        activeAssignments: totalAssigned,
        activeInternships,
        completedInternships,
        totalVisitsCompleted: mentor.facultyVisitLogs.length,
        utilizationRate,
        lastVisitDate: this.formatToIST(lastVisit),
        isActive: mentor.active,
      };
    });
  }

  /**
   * Generate Unassigned Students Report
   * Lists students who don't have a mentor assigned
   * @param filters - Filter criteria (institutionId, branchId, isActive)
   * @param pagination - Optional pagination options
   */
  async generateUnassignedStudentsReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      // Students with NO active mentor assignment
      mentorAssignments: {
        none: { isActive: true },
      },
    };
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.branchId) {
      where.branchId = filters.branchId;
    }

    if (filters?.currentYear) {
      where.currentYear = Number(filters.currentYear);
    }

    // Default to active students only
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      where.user = { active: isActiveValue };
    } else {
      where.user = { active: true };
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        user: { select: { name: true, rollNumber: true, branchName: true, email: true, phoneNo: true, active: true } },
        branch: { select: { name: true } },
        Institution: { select: { name: true } },
        internshipApplications: {
          where: { isActive: true },
          select: { id: true, status: true, companyName: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });

    this.warnOnLargeResultSet(students.length, 'UnassignedStudentsReport');

    return students.map((student) => {
      const activeInternship = student.internshipApplications[0];
      return {
        studentName: student.user?.name,
        rollNumber: student.user?.rollNumber,
        email: student.user?.email,
        phoneNo: student.user?.phoneNo,
        branchName: student.branch?.name ?? student.user?.branchName,
        currentYear: student.currentYear,
        currentSemester: student.currentSemester,
        institutionName: student.Institution?.name ?? 'N/A',
        hasActiveInternship: !!activeInternship,
        internshipStatus: activeInternship?.status ?? 'None',
        companyName: activeInternship?.companyName ?? 'N/A',
        isActive: student.user?.active ?? false,
        userActive: student.user?.active ?? true,
      };
    });
  }

  // ==================== Internship Summary Report Generators ====================

  /**
   * Generate Internship by Institution Report
   * Aggregates internship data by institution
   * @param filters - Filter criteria (district, city)
   * @param pagination - Optional pagination options
   */
  async generateInternshipByInstitutionReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const { take, skip } = this.getPaginationParams(pagination);

    const institutions = await this.prisma.institution.findMany({
      where: filters?.district ? { district: filters.district } : undefined,
      include: {
        _count: {
          select: {
            Student: { where: { user: { active: true } } },
          },
        },
        Student: {
          where: { user: { active: true } },
          include: {
            internshipApplications: {
              where: { isActive: true },
              select: {
                status: true,
                internshipPhase: true,
                isSelfIdentified: true,
              },
            },
          },
        },
      },
      take,
      skip,
      orderBy: { name: 'asc' },
    });

    this.warnOnLargeResultSet(institutions.length, 'InternshipByInstitutionReport');

    return institutions.map((inst) => {
      let activeInternships = 0;
      let completedInternships = 0;
      let pendingApplications = 0;
      let selfIdentified = 0;

      inst.Student.forEach((student) => {
        student.internshipApplications.forEach((app) => {
          if (app.internshipPhase === 'ACTIVE') activeInternships++;
          if (app.internshipPhase === 'COMPLETED') completedInternships++;
          if (['SUBMITTED', 'UNDER_REVIEW'].includes(app.status)) pendingApplications++;
          if (app.isSelfIdentified) selfIdentified++;
        });
      });

      const totalStudents = inst._count.Student;
      const totalInternships = activeInternships + completedInternships;
      const internshipRate = totalStudents > 0 ? Math.round((totalInternships / totalStudents) * 100) : 0;

      return {
        institutionName: inst.name,
        institutionCode: inst.shortName,
        city: inst.city,
        district: inst.district,
        totalStudents,
        activeInternships,
        completedInternships,
        pendingApplications,
        selfIdentified,
        internshipRate,
      };
    });
  }

  /**
   * Generate Internship by Industry Report
   * Aggregates internship data by company/industry
   * @param filters - Filter criteria (institutionId, industryType, isVerified)
   * @param pagination - Optional pagination options
   */
  async generateInternshipByIndustryReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      isActive: true,
    };
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.student = { institutionId: filters.institutionId };
    }

    // Group by company name
    const applications = await this.prisma.internshipApplication.findMany({
      where,
      select: {
        companyName: true,
        companyAddress: true,
        internshipDuration: true,
        stipend: true,
        internshipPhase: true,
        status: true,
      },
      take: 50000, // Get all for grouping
    });

    // Group by company
    const companyMap = new Map<string, {
      companyName: string;
      city: string;
      totalInternships: number;
      activeInternships: number;
      completedInternships: number;
      durations: number[];
      stipends: number[];
    }>();

    applications.forEach((app) => {
      const key = app.companyName || 'Unknown';
      if (!companyMap.has(key)) {
        // Extract city from address
        let city = '';
        if (app.companyAddress) {
          const parts = app.companyAddress.split(',').map((p) => p.trim());
          city = parts.length >= 2 ? parts[1] : '';
        }

        companyMap.set(key, {
          companyName: app.companyName ?? 'Unknown',
          city,
          totalInternships: 0,
          activeInternships: 0,
          completedInternships: 0,
          durations: [],
          stipends: [],
        });
      }

      const data = companyMap.get(key)!;
      data.totalInternships++;
      if (app.internshipPhase === 'ACTIVE') data.activeInternships++;
      if (app.internshipPhase === 'COMPLETED') data.completedInternships++;
      // Parse string duration/stipend to numbers
      if (app.internshipDuration) {
        const durationNum = parseFloat(app.internshipDuration);
        if (!isNaN(durationNum)) data.durations.push(durationNum);
      }
      if (app.stipend) {
        const stipendNum = parseFloat(app.stipend);
        if (!isNaN(stipendNum)) data.stipends.push(stipendNum);
      }
    });

    // Convert to array and apply pagination
    const results = Array.from(companyMap.values())
      .sort((a, b) => b.totalInternships - a.totalInternships)
      .slice(skip, skip + take);

    this.warnOnLargeResultSet(results.length, 'InternshipByIndustryReport');

    return results.map((data) => ({
      companyName: data.companyName,
      industryType: 'N/A', // Would need company industry field
      city: data.city,
      totalInternships: data.totalInternships,
      activeInternships: data.activeInternships,
      completedInternships: data.completedInternships,
      avgDuration: data.durations.length > 0
        ? Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length)
        : 0,
      avgStipend: data.stipends.length > 0
        ? Math.round(data.stipends.reduce((a, b) => a + b, 0) / data.stipends.length)
        : 0,
      isVerified: true, // Would need company verification field
    }));
  }

  // ==================== Compliance Report Generators ====================

  /**
   * Generate Faculty Visit Compliance Report
   * Tracks faculty visit compliance for internship monitoring
   * @param filters - Filter criteria (institutionId, month, year, complianceLevel)
   * @param pagination - Optional pagination options
   */
  async generateFacultyVisitComplianceReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      role: Role.TEACHER,
    };
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    // Default to active faculty
    const facultyActive = this.parseBooleanLike(filters?.facultyActive);
    if (facultyActive !== undefined) {
      where.active = facultyActive;
    } else {
      where.active = true;
    }

    // Build date filter for visits based on month/year
    const visitLogsWhere: Record<string, unknown> = { isDeleted: false };
    if (filters?.month && filters?.year) {
      const filterMonth = Number(filters.month);
      const filterYear = Number(filters.year);
      const startDate = new Date(filterYear, filterMonth - 1, 1);
      const endDate = new Date(filterYear, filterMonth, 0, 23, 59, 59, 999);
      visitLogsWhere.visitDate = {
        gte: startDate,
        lte: endDate,
      };
    } else if (filters?.year) {
      const filterYear = Number(filters.year);
      const startDate = new Date(filterYear, 0, 1);
      const endDate = new Date(filterYear, 11, 31, 23, 59, 59, 999);
      visitLogsWhere.visitDate = {
        gte: startDate,
        lte: endDate,
      };
    }

    const mentors = await this.prisma.user.findMany({
      where,
      include: {
        Institution: { select: { name: true } },
        mentorAssignments: {
          where: { isActive: true },
          include: {
            student: {
              include: {
                internshipApplications: {
                  where: { isActive: true },
                  select: {
                    totalExpectedVisits: true,
                    completedVisitsCount: true,
                  },
                },
              },
            },
          },
        },
        facultyVisitLogs: {
          where: visitLogsWhere,
          select: { visitDate: true, nextVisitDate: true },
          orderBy: { visitDate: 'desc' },
        },
      },
      take,
      skip,
      orderBy: { name: 'asc' },
    });

    this.warnOnLargeResultSet(mentors.length, 'FacultyVisitComplianceReport');

    // Check if month/year filter is applied
    const hasMonthYearFilter = filters?.month || filters?.year;

    const results = mentors.map((mentor) => {
      const assignedStudents = mentor.mentorAssignments.length;
      let requiredVisits = 0;
      let completedVisits = 0;

      mentor.mentorAssignments.forEach((assignment) => {
        assignment.student.internshipApplications.forEach((app) => {
          requiredVisits += app.totalExpectedVisits;
          // When filtering by month/year, use filtered visit logs count
          // Otherwise use the stored completedVisitsCount
          if (hasMonthYearFilter) {
            // For filtered period, count visits from filtered facultyVisitLogs
            completedVisits = mentor.facultyVisitLogs.length;
          } else {
            completedVisits += app.completedVisitsCount;
          }
        });
      });

      const pendingVisits = Math.max(0, requiredVisits - completedVisits);
      const compliancePercent = requiredVisits > 0
        ? Math.round((completedVisits / requiredVisits) * 100)
        : 100;

      let complianceLevel = 'low';
      if (compliancePercent >= 80) complianceLevel = 'high';
      else if (compliancePercent >= 50) complianceLevel = 'medium';

      const lastVisit = mentor.facultyVisitLogs[0];
      const nextScheduled = mentor.facultyVisitLogs.find((v) => v.nextVisitDate)?.nextVisitDate;

      return {
        mentorName: mentor.name,
        department: mentor.branchName,
        institutionName: mentor.Institution?.name ?? 'N/A',
        assignedStudents,
        requiredVisits,
        completedVisits,
        pendingVisits,
        compliancePercent,
        complianceLevel,
        lastVisitDate: this.formatToIST(lastVisit?.visitDate ?? null),
        nextScheduledVisit: this.formatToISTDateOnly(nextScheduled ?? null),
        facultyActive: mentor.active,
      };
    });

    // Apply compliance level filter if specified
    if (filters?.complianceLevel) {
      return results.filter((r) => r.complianceLevel === filters.complianceLevel);
    }

    return results;
  }

  /**
   * Generate Monthly Report Compliance Report
   * Student monthly report submission compliance
   * @param filters - Filter criteria (institutionId, branchId, mentorId, month, year)
   * @param pagination - Optional pagination options
   */
  async generateMonthlyReportComplianceReport(
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

    // Default to active students only
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      where.user = { active: isActiveValue };
    } else {
      where.user = { active: true };
    }

    // Build monthly reports filter based on month/year
    const monthlyReportsWhere: Record<string, unknown> = {};
    if (filters?.month) {
      monthlyReportsWhere.reportMonth = Number(filters.month);
    }
    if (filters?.year) {
      monthlyReportsWhere.reportYear = Number(filters.year);
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        user: { select: { name: true, rollNumber: true, branchName: true, active: true } },
        branch: { select: { name: true } },
        internshipApplications: {
          where: { isActive: true },
          select: {
            companyName: true,
            totalExpectedReports: true,
            submittedReportsCount: true,
            mentor: { select: { id: true, name: true } },
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        monthlyReports: {
          where: Object.keys(monthlyReportsWhere).length > 0 ? monthlyReportsWhere : undefined,
          select: { status: true, submittedAt: true, reportMonth: true, reportYear: true },
          orderBy: { submittedAt: 'desc' },
        },
      },
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });

    this.warnOnLargeResultSet(students.length, 'MonthlyReportComplianceReport');

    const results: any[] = [];

    for (const student of students) {
      const app = student.internshipApplications[0];

      // Apply mentor filter if specified
      if (filters?.mentorId && app?.mentor?.id !== filters.mentorId) continue;

      // When filtering by specific month/year, calculate compliance based on filtered reports
      let submitted = 0;
      let approved = 0;
      let totalExpected = 0;

      if (filters?.month && filters?.year) {
        // For specific month/year: check if report for that month exists
        totalExpected = 1; // One report expected per month
        submitted = student.monthlyReports.length > 0 ? 1 : 0;
        approved = student.monthlyReports.filter((r) => r.status === MonthlyReportStatus.APPROVED).length > 0 ? 1 : 0;
      } else {
        // Overall compliance
        totalExpected = app?.totalExpectedReports ?? 0;
        submitted = student.monthlyReports.length;
        approved = student.monthlyReports.filter((r) => r.status === MonthlyReportStatus.APPROVED).length;
      }

      const pending = Math.max(0, totalExpected - submitted);
      const compliancePercent = totalExpected > 0
        ? Math.round((submitted / totalExpected) * 100)
        : 0;

      const lastSubmission = student.monthlyReports[0]?.submittedAt;

      results.push({
        studentName: student.user?.name,
        rollNumber: student.user?.rollNumber,
        branchName: student.branch?.name ?? student.user?.branchName,
        mentorName: app?.mentor?.name ?? 'N/A',
        companyName: app?.companyName ?? 'N/A',
        totalReportsExpected: totalExpected,
        reportsSubmitted: submitted,
        reportsApproved: approved,
        reportsPending: pending,
        compliancePercent,
        lastSubmissionDate: this.formatToIST(lastSubmission ?? null),
        isActive: student.user?.active ?? false,
        userActive: student.user?.active ?? true,
      });
    }

    return results;
  }

  /**
   * Generate Joining Report Status Report
   * Track joining letter/report submission status
   * @param filters - Filter criteria (institutionId, branchId, joiningLetterStatus)
   * @param pagination - Optional pagination options
   */
  async generateJoiningReportStatusReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      isActive: true,
    };
    const { take, skip } = this.getPaginationParams(pagination);

    // Build student filter
    const studentFilter: Record<string, unknown> = {};
    if (filters?.institutionId) {
      studentFilter.institutionId = filters.institutionId;
    }
    if (filters?.branchId) {
      studentFilter.branchId = filters.branchId;
    }

    // Default to active students only
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      studentFilter.user = { active: isActiveValue };
    } else {
      studentFilter.user = { active: true };
    }

    if (Object.keys(studentFilter).length > 0) {
      where.student = studentFilter;
    }

    const applications = await this.prisma.internshipApplication.findMany({
      where,
      include: {
        student: {
          select: {
            user: { select: { name: true, rollNumber: true, branchName: true, active: true } },
            branch: { select: { name: true } },
          },
        },
        mentor: { select: { name: true } },
      },
      take,
      skip,
      orderBy: { startDate: 'desc' },
    });

    this.warnOnLargeResultSet(applications.length, 'JoiningReportStatusReport');

    const now = new Date();

    const results = applications.map((app) => {
      // Determine joining letter status based on joiningLetterUrl presence
      // All joining letters are auto-approved per user requirement
      let joiningLetterStatus = 'PENDING';
      if (app.joiningLetterUrl) {
        joiningLetterStatus = 'APPROVED';
      }

      const startDate = app.startDate ?? app.joiningDate;
      const daysSinceStart = startDate
        ? Math.floor((now.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        studentName: app.student.user?.name,
        rollNumber: app.student.user?.rollNumber,
        branchName: app.student.branch?.name ?? app.student.user?.branchName,
        companyName: app.companyName,
        internshipStartDate: this.formatToISTDateOnly(startDate),
        joiningLetterStatus,
        joiningLetterSubmittedAt: this.formatToIST(app.joiningLetterUrl ? app.createdAt : null), // Use createdAt as proxy
        joiningLetterApprovedAt: this.formatToIST(app.joiningLetterUrl ? app.createdAt : null),
        daysSinceStart,
        mentorName: app.mentor?.name ?? 'N/A',
        isActive: app.student.user?.active ?? false,
        userActive: app.student.user?.active ?? true,
      };
    });

    // Apply joining letter status filter if specified
    if (filters?.joiningLetterStatus) {
      return results.filter((r) => r.joiningLetterStatus === filters.joiningLetterStatus);
    }

    return results;
  }

  // ==================== Institute Report Generators ====================

  /**
   * Generate Institute Summary Report
   * Summary statistics for each institution
   * @param filters - Filter criteria
   * @param pagination - Optional pagination options
   */
  async generateInstituteSummaryReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const { take, skip } = this.getPaginationParams(pagination);

    const institutions = await this.prisma.institution.findMany({
      include: {
        _count: {
          select: {
            Student: { where: { user: { active: true } } },
            users: { where: { active: true, role: Role.TEACHER } },
            Branch: true,
          },
        },
        Student: {
          where: { user: { active: true } },
          include: {
            internshipApplications: {
              where: { isActive: true },
              select: { internshipPhase: true },
            },
          },
        },
      },
      take,
      skip,
      orderBy: { name: 'asc' },
    });

    this.warnOnLargeResultSet(institutions.length, 'InstituteSummaryReport');

    return institutions.map((inst) => {
      let activeInternships = 0;
      let completedInternships = 0;

      inst.Student.forEach((student) => {
        student.internshipApplications.forEach((app) => {
          if (app.internshipPhase === 'ACTIVE') activeInternships++;
          if (app.internshipPhase === 'COMPLETED') completedInternships++;
        });
      });

      const totalStudents = inst._count.Student;
      const internshipRate = totalStudents > 0
        ? Math.round(((activeInternships + completedInternships) / totalStudents) * 100)
        : 0;

      return {
        institutionName: inst.name,
        institutionCode: inst.shortName,
        city: inst.city,
        district: inst.district,
        totalStudents,
        totalFaculty: inst._count.users,
        totalBranches: inst._count.Branch,
        activeInternships,
        completedInternships,
        internshipRate,
      };
    });
  }

  /**
   * Generate Institute Comparison Report
   * Compare multiple institutions side by side
   * @param filters - Filter criteria
   * @param pagination - Optional pagination options
   */
  async generateInstituteComparisonReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    // Similar to summary but with comparison metrics
    return this.generateInstituteSummaryReport(filters, pagination);
  }

  /**
   * Generate Branch Wise Summary Report
   * Summary statistics broken down by branch
   * @param filters - Filter criteria (institutionId)
   * @param pagination - Optional pagination options
   */
  async generateBranchWiseSummaryReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    const branches = await this.prisma.branch.findMany({
      where,
      include: {
        institution: { select: { name: true } },
        students: {
          where: { user: { active: true } },
          include: {
            internshipApplications: {
              where: { isActive: true },
              select: { internshipPhase: true, status: true },
            },
          },
        },
      },
      take,
      skip,
      orderBy: { name: 'asc' },
    });

    this.warnOnLargeResultSet(branches.length, 'BranchWiseSummaryReport');

    return branches.map((branch) => {
      let activeInternships = 0;
      let completedInternships = 0;
      let appliedCount = 0;

      branch.students.forEach((student) => {
        student.internshipApplications.forEach((app) => {
          if (app.internshipPhase === 'ACTIVE') activeInternships++;
          if (app.internshipPhase === 'COMPLETED') completedInternships++;
          if (['APPLIED', 'SUBMITTED'].includes(app.status)) appliedCount++;
        });
      });

      const totalStudents = branch.students.length;
      const internshipRate = totalStudents > 0
        ? Math.round(((activeInternships + completedInternships) / totalStudents) * 100)
        : 0;

      return {
        branchName: branch.name,
        branchCode: branch.code,
        institutionName: branch.institution?.name ?? 'N/A',
        totalStudents,
        activeInternships,
        completedInternships,
        appliedCount,
        internshipRate,
      };
    });
  }

  // ==================== Pending Report Generators ====================

  /**
   * Generate Pending Monthly Visits Report
   * Faculty with overdue visits - matches pending-reports.definition.ts columns
   * @param filters - Filter criteria (institutionId, mentorId, month, year, urgency)
   * @param pagination - Optional pagination options
   */
  async generatePendingMonthlyVisitsReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      role: Role.TEACHER,
      active: true,
    };
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.mentorId) {
      where.id = filters.mentorId;
    }

    // Build date filter for visits based on month/year
    const visitLogsWhere: Record<string, unknown> = {};
    if (filters?.month && filters?.year) {
      const filterMonth = Number(filters.month);
      const filterYear = Number(filters.year);
      const startDate = new Date(filterYear, filterMonth - 1, 1);
      const endDate = new Date(filterYear, filterMonth, 0, 23, 59, 59, 999);
      visitLogsWhere.visitDate = {
        gte: startDate,
        lte: endDate,
      };
    } else if (filters?.year) {
      const filterYear = Number(filters.year);
      const startDate = new Date(filterYear, 0, 1);
      const endDate = new Date(filterYear, 11, 31, 23, 59, 59, 999);
      visitLogsWhere.visitDate = {
        gte: startDate,
        lte: endDate,
      };
    }

    const mentors = await this.prisma.user.findMany({
      where,
      include: {
        Institution: { select: { name: true } },
        mentorAssignments: {
          where: { isActive: true },
          include: {
            student: {
              include: {
                user: { select: { name: true, rollNumber: true, active: true } },
                internshipApplications: {
                  where: { isActive: true },
                  select: {
                    id: true,
                    companyName: true,
                    totalExpectedVisits: true,
                    completedVisitsCount: true,
                    facultyVisitLogs: {
                      where: Object.keys(visitLogsWhere).length > 0 ? visitLogsWhere : undefined,
                      select: { visitDate: true },
                      orderBy: { visitDate: 'desc' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      take,
      skip,
      orderBy: { name: 'asc' },
    });

    this.warnOnLargeResultSet(mentors.length, 'PendingMonthlyVisitsReport');

    const now = new Date();
    const results: any[] = [];

    // Determine the reference date for calculations (either filter date or now)
    let referenceDate = now;
    if (filters?.month && filters?.year) {
      const filterMonth = Number(filters.month);
      const filterYear = Number(filters.year);
      // Use end of the specified month as reference
      referenceDate = new Date(filterYear, filterMonth, 0, 23, 59, 59, 999);
    }

    mentors.forEach((mentor) => {
      mentor.mentorAssignments.forEach((assignment) => {
        // Only include active students
        if (!assignment.student.user?.active) return;

        assignment.student.internshipApplications.forEach((app) => {
          // When filtering by month/year, calculate visits due based on filtered visits
          const visitsInPeriod = app.facultyVisitLogs.length;
          const visitsDue = filters?.month && filters?.year
            ? (visitsInPeriod === 0 ? 1 : 0) // If no visit in the period, 1 visit is due
            : app.totalExpectedVisits - app.completedVisitsCount;

          if (visitsDue > 0) {
            const lastVisit = app.facultyVisitLogs[0]?.visitDate ?? null;
            const daysSinceLastVisit = lastVisit
              ? Math.floor((referenceDate.getTime() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24))
              : null;

            // Apply urgency filter if specified
            if (filters?.urgency) {
              if (filters.urgency === 'critical' && (daysSinceLastVisit === null || daysSinceLastVisit <= 30)) return;
              if (filters.urgency === 'high' && (daysSinceLastVisit === null || daysSinceLastVisit < 15 || daysSinceLastVisit > 30)) return;
              if (filters.urgency === 'normal' && daysSinceLastVisit !== null && daysSinceLastVisit >= 15) return;
            }

            results.push({
              mentorName: mentor.name,
              mentorEmail: mentor.email,
              mentorPhone: mentor.phoneNo,
              department: mentor.designation ?? 'N/A',
              institutionName: mentor.Institution?.name ?? 'N/A',
              studentName: assignment.student.user?.name,
              rollNumber: assignment.student.user?.rollNumber,
              companyName: app.companyName,
              lastVisitDate: this.formatToIST(lastVisit),
              daysSinceLastVisit,
              visitsDue,
            });
          }
        });
      });
    });

    return results;
  }

  /**
   * Generate Pending Monthly Reports Report
   * Students with overdue monthly reports - matches pending-reports.definition.ts columns
   * @param filters - Filter criteria (institutionId, branchId, mentorId, month, year)
   * @param pagination - Optional pagination options
   */
  async generatePendingMonthlyReportsReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      user: { active: true },
    };
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.branchId) {
      where.branchId = filters.branchId;
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        user: { select: { name: true, rollNumber: true, branchName: true, active: true } },
        branch: { select: { name: true } },
        Institution: { select: { name: true } },
        internshipApplications: {
          where: { isActive: true },
          select: {
            companyName: true,
            startDate: true,
            endDate: true,
            totalExpectedReports: true,
            submittedReportsCount: true,
            mentor: { select: { id: true, name: true } },
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        monthlyReports: {
          select: { submittedAt: true, reportMonth: true, reportYear: true },
          orderBy: { submittedAt: 'desc' },
        },
      },
      take,
      skip,
      orderBy: { createdAt: 'desc' },
    });

    this.warnOnLargeResultSet(students.length, 'PendingMonthlyReportsReport');

    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    const results: any[] = [];

    // Determine if we're filtering by specific month/year
    const filterMonth = filters?.month ? Number(filters.month) : null;
    const filterYear = filters?.year ? Number(filters.year) : null;

    for (const student of students) {
      const app = student.internshipApplications[0];
      if (!app) continue;

      // Apply mentor filter if specified
      if (filters?.mentorId && app.mentor?.id !== filters.mentorId) continue;

      // Get internship date range
      const startDate = app.startDate ? new Date(app.startDate) : null;
      const endDate = app.endDate ? new Date(app.endDate) : null;

      if (!startDate) continue;

      // Create a set of submitted report months for quick lookup
      const submittedMonths = new Set(
        student.monthlyReports.map(r => `${r.reportYear}-${r.reportMonth}`)
      );

      // Get the last submitted report
      const lastReport = student.monthlyReports[0];

      // If filtering by specific month/year, check if that month's report is pending
      if (filterMonth && filterYear) {
        const filterKey = `${filterYear}-${filterMonth}`;

        // Check if student should have submitted for this month
        // (internship was active during this month)
        const filterMonthStart = new Date(filterYear, filterMonth - 1, 1);
        const filterMonthEnd = new Date(filterYear, filterMonth, 0);

        // Skip if internship hadn't started yet
        if (startDate > filterMonthEnd) continue;

        // Skip if internship ended before this month
        if (endDate && endDate < filterMonthStart) continue;

        // Skip if report already submitted for this month
        if (submittedMonths.has(filterKey)) continue;

        // Calculate reports expected up to and including the filtered month
        // Count months from internship start to filter month
        const internshipStartMonth = startDate.getMonth() + 1;
        const internshipStartYear = startDate.getFullYear();

        let reportsExpectedUpToFilter = 0;
        let tempYear = internshipStartYear;
        let tempMonth = internshipStartMonth;

        while (tempYear < filterYear || (tempYear === filterYear && tempMonth <= filterMonth)) {
          // Check if internship was active in this month
          const monthStart = new Date(tempYear, tempMonth - 1, 1);
          if (!endDate || endDate >= monthStart) {
            reportsExpectedUpToFilter++;
          }
          tempMonth++;
          if (tempMonth > 12) {
            tempMonth = 1;
            tempYear++;
          }
        }

        // Calculate reports submitted up to and including the filtered month
        const reportsSubmittedUpToFilter = student.monthlyReports.filter(r => {
          if (r.reportYear < filterYear) return true;
          if (r.reportYear === filterYear && r.reportMonth <= filterMonth) return true;
          return false;
        }).length;

        // Calculate days past due
        const dueDate = new Date(filterYear, filterMonth, 5); // 5th of the next month
        const daysPastDue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

        results.push({
          studentName: student.user?.name,
          rollNumber: student.user?.rollNumber,
          branchName: student.branch?.name ?? student.user?.branchName,
          mentorName: app.mentor?.name ?? 'N/A',
          companyName: app.companyName,
          pendingMonth: monthNames[filterMonth],
          pendingYear: filterYear,
          daysPastDue,
          lastSubmittedReport: lastReport?.submittedAt ?? null,
          reportsSubmitted: reportsSubmittedUpToFilter,
          reportsExpected: reportsExpectedUpToFilter,
        });
      } else {
        // No month/year filter - show first pending month for each student
        if (app.totalExpectedReports <= app.submittedReportsCount) continue;

        // Calculate pending month (first month without a report)
        let pendingMonth = currentMonth;
        let pendingYear = currentYear;

        if (lastReport) {
          // Next month after last report
          pendingMonth = lastReport.reportMonth + 1;
          pendingYear = lastReport.reportYear;
          if (pendingMonth > 12) {
            pendingMonth = 1;
            pendingYear++;
          }
        } else {
          // Start from internship start date
          pendingMonth = startDate.getMonth() + 1;
          pendingYear = startDate.getFullYear();
        }

        // Calculate days past due (assuming reports due by 5th of following month)
        const dueDate = new Date(pendingYear, pendingMonth, 5);
        const daysPastDue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

        results.push({
          studentName: student.user?.name,
          rollNumber: student.user?.rollNumber,
          branchName: student.branch?.name ?? student.user?.branchName,
          mentorName: app.mentor?.name ?? 'N/A',
          companyName: app.companyName,
          pendingMonth: monthNames[pendingMonth],
          pendingYear,
          daysPastDue,
          lastSubmittedReport: lastReport?.submittedAt ?? null,
          reportsSubmitted: app.submittedReportsCount,
          reportsExpected: app.totalExpectedReports,
        });
      }
    }

    return results;
  }

  /**
   * Generate Pending Joining Letters Report
   * Students who haven't submitted joining letter - matches pending-reports.definition.ts columns
   * @param filters - Filter criteria (institutionId, branchId, mentorId, urgency)
   * @param pagination - Optional pagination options
   */
  async generatePendingJoiningLettersReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      isActive: true,
      joiningLetterUrl: null, // No joining letter submitted
    };
    const { take, skip } = this.getPaginationParams(pagination);

    // Build student filter
    const studentFilter: Record<string, unknown> = {
      user: { active: true },
    };
    if (filters?.institutionId) {
      studentFilter.institutionId = filters.institutionId;
    }
    if (filters?.branchId) {
      studentFilter.branchId = filters.branchId;
    }

    where.student = studentFilter;

    // Apply mentor filter if specified
    if (filters?.mentorId) {
      where.mentorId = filters.mentorId;
    }

    const applications = await this.prisma.internshipApplication.findMany({
      where,
      include: {
        student: {
          select: {
            user: { select: { name: true, email: true, phoneNo: true, rollNumber: true, branchName: true, active: true } },
            branch: { select: { name: true } },
            Institution: { select: { name: true } },
          },
        },
        mentor: { select: { name: true } },
      },
      take,
      skip,
      orderBy: { startDate: 'desc' },
    });

    this.warnOnLargeResultSet(applications.length, 'PendingJoiningLettersReport');

    const now = new Date();

    const results = applications.map((app) => {
      const startDate = app.startDate ?? app.joiningDate;
      const daysSinceStart = startDate
        ? Math.floor((now.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        studentName: app.student.user?.name,
        rollNumber: app.student.user?.rollNumber,
        email: app.student.user?.email,
        phoneNumber: app.student.user?.phoneNo,
        branchName: app.student.branch?.name ?? app.student.user?.branchName,
        mentorName: app.mentor?.name ?? 'N/A',
        companyName: app.companyName,
        internshipStartDate: this.formatToISTDateOnly(startDate),
        daysSinceStart,
        institutionName: app.student.Institution?.name ?? 'N/A',
      };
    });

    // Apply urgency filter if specified
    if (filters?.urgency) {
      return results.filter((r) => {
        if (filters.urgency === 'critical') return r.daysSinceStart > 14;
        if (filters.urgency === 'high') return r.daysSinceStart >= 7 && r.daysSinceStart <= 14;
        if (filters.urgency === 'normal') return r.daysSinceStart < 7;
        return true;
      });
    }

    return results;
  }
}
