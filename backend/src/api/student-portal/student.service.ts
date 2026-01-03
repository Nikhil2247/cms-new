import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { LruCacheService } from '../../core/cache/lru-cache.service';
import { CacheService } from '../../core/cache/cache.service';
import { FacultyVisitService } from '../../domain/report/faculty-visit/faculty-visit.service';
import { Prisma, ApplicationStatus, InternshipStatus, InternshipPhase, MonthlyReportStatus, DocumentType, AuditAction, AuditCategory, AuditSeverity, Role } from '../../generated/prisma/client';
import { AuditService } from '../../infrastructure/audit/audit.service';
import {
  calculateExpectedMonths,
  MonthlyCycle,
  getReportSubmissionStatus as getMonthlyReportStatus,
  MONTHLY_CYCLE,
  getMonthName,
} from '../../common/utils/monthly-cycle.util';

// Month names for display
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Report submission status types
type ReportSubmissionStatus = 'NOT_YET_DUE' | 'CAN_SUBMIT' | 'OVERDUE' | 'SUBMITTED' | 'APPROVED';

/**
 * Report period based on calendar months
 * Uses the monthly cycle system where reports are due on the 5th of the following month
 * @see monthly-cycle.util.ts
 */
interface ReportPeriod {
  monthNumber: number; // 1-12
  month: number; // For backward compatibility (same as monthNumber)
  year: number;
  periodStartDate: Date; // First day of month
  periodEndDate: Date; // Last day of month
  submissionWindowStart: Date; // First day of next month
  submissionWindowEnd: Date; // 5th of next month (reportDueDate)
  dueDate: Date;
  isPartialMonth: boolean; // True if daysInMonth < full month
  isFinalReport: boolean;
  daysInMonth: number;
}

@Injectable()
export class StudentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly redisCache: CacheService,
    private readonly facultyVisitService: FacultyVisitService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Helper: Calculate all expected report periods for an internship
   *
   * Uses calendar months for report periods
   * - Month Inclusion Rule: Both first and last months require >10 days to be included
   * - Report Due Date: 5th of the next month
   *
   * Example:
   * - Internship: Jan 15 - May 15
   * - January: 16 days (>10) -> Report due Feb 5
   * - February: 28 days -> Report due Mar 5
   * - March: 31 days -> Report due Apr 5
   * - April: 30 days -> Report due May 5
   * - May: 15 days (>10) -> Report due Jun 5
   */
  private calculateExpectedReportPeriods(startDate: Date, endDate: Date): ReportPeriod[] {
    const months = calculateExpectedMonths(startDate, endDate);

    return months.map((month: MonthlyCycle) => {
      // Calculate first day of the month
      const periodStartDate = new Date(month.year, month.monthNumber - 1, 1);
      periodStartDate.setHours(0, 0, 0, 0);

      // Calculate last day of the month
      const periodEndDate = new Date(month.year, month.monthNumber, 0);
      periodEndDate.setHours(23, 59, 59, 999);

      // Submission window starts on first day of next month
      const nextMonth = month.monthNumber === 12 ? 1 : month.monthNumber + 1;
      const nextYear = month.monthNumber === 12 ? month.year + 1 : month.year;
      const submissionWindowStart = new Date(nextYear, nextMonth - 1, 1);
      submissionWindowStart.setHours(0, 0, 0, 0);

      // Get total days in the full month for partial month check
      const totalDaysInFullMonth = new Date(month.year, month.monthNumber, 0).getDate();

      return {
        monthNumber: month.monthNumber,
        month: month.monthNumber, // For backward compatibility
        year: month.year,
        periodStartDate,
        periodEndDate,
        submissionWindowStart,
        submissionWindowEnd: month.reportDueDate,
        dueDate: month.reportDueDate,
        isPartialMonth: month.daysInMonth < totalDaysInFullMonth,
        isFinalReport: month.isLastMonth,
        daysInMonth: month.daysInMonth,
      };
    });
  }

  /**
   * Helper: Get submission status for a report
   * HIGH PRIORITY FIX 10.6: Case-insensitive status comparisons
   */
  private getReportSubmissionStatus(report: any): {
    status: ReportSubmissionStatus;
    label: string;
    color: string;
    canSubmit: boolean;
    sublabel?: string;
  } {
    const now = new Date();

    // Normalize status for comparison (case-insensitive)
    const normalizedStatus = report.status ?
      (typeof report.status === 'string' ? report.status.toUpperCase() : report.status) :
      null;

    // If report is already submitted/approved
    if (normalizedStatus === MonthlyReportStatus.APPROVED || normalizedStatus === 'APPROVED' || report.isApproved) {
      return { status: 'APPROVED', label: 'Approved', color: 'green', canSubmit: false };
    }

    if (normalizedStatus === MonthlyReportStatus.SUBMITTED || normalizedStatus === 'SUBMITTED') {
      return { status: 'SUBMITTED', label: 'Submitted', color: 'blue', canSubmit: false };
    }

    // Calculate submission window if not stored
    const windowStart = report.submissionWindowStart ? new Date(report.submissionWindowStart) : null;
    const windowEnd = report.submissionWindowEnd ? new Date(report.submissionWindowEnd) : null;

    if (!windowStart || !windowEnd) {
      // Fallback: use monthly cycle calculation based on period dates
      // Reports are due on the 5th of the following month
      const periodEndDate = report.periodEndDate ? new Date(report.periodEndDate) : null;

      if (periodEndDate) {
        // Calculate submission window: first day of next month to 5th of next month
        const reportMonth = periodEndDate.getMonth() + 1; // 1-12
        const reportYear = periodEndDate.getFullYear();
        const nextMonth = reportMonth === 12 ? 1 : reportMonth + 1;
        const nextYear = reportMonth === 12 ? reportYear + 1 : reportYear;

        const calcWindowStart = new Date(nextYear, nextMonth - 1, 1);
        calcWindowStart.setHours(0, 0, 0, 0);

        const calcWindowEnd = new Date(nextYear, nextMonth - 1, MONTHLY_CYCLE.REPORT_DUE_DAY);
        calcWindowEnd.setHours(23, 59, 59, 999);

        if (now < calcWindowStart) {
          const daysUntil = Math.ceil((calcWindowStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return {
            status: 'NOT_YET_DUE',
            label: 'In Progress',
            color: 'default',
            canSubmit: false,
            sublabel: `Month ends in ${daysUntil} days`
          };
        }

        if (now >= calcWindowStart && now <= calcWindowEnd) {
          const daysLeft = Math.ceil((calcWindowEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return {
            status: 'CAN_SUBMIT',
            label: 'Submit Now',
            color: 'blue',
            canSubmit: true,
            sublabel: `${daysLeft} days left`
          };
        }

        const daysOverdue = Math.ceil((now.getTime() - calcWindowEnd.getTime()) / (1000 * 60 * 60 * 24));
        return {
          status: 'OVERDUE',
          label: 'Overdue',
          color: 'red',
          canSubmit: true,
          sublabel: `${daysOverdue} days overdue`
        };
      }

      // No valid period end date available - cannot determine status
      return {
        status: 'NOT_YET_DUE',
        label: 'Pending',
        color: 'default',
        canSubmit: false,
        sublabel: 'Unable to calculate due date'
      };
    }

    // Use stored submission window
    if (now < windowStart) {
      const daysUntil = Math.ceil((windowStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        status: 'NOT_YET_DUE',
        label: 'Not Yet Due',
        color: 'default',
        canSubmit: false,
        sublabel: `Opens in ${daysUntil} days`
      };
    }

    if (now >= windowStart && now <= windowEnd) {
      const daysLeft = Math.ceil((windowEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        status: 'CAN_SUBMIT',
        label: 'Submit Now',
        color: 'blue',
        canSubmit: true,
        sublabel: `${daysLeft} days left`
      };
    }

    const daysOverdue = Math.ceil((now.getTime() - windowEnd.getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: 'OVERDUE',
      label: 'Overdue',
      color: 'red',
      canSubmit: true,
      sublabel: `${daysOverdue} days overdue`
    };
  }

  /**
   * Get student dashboard - internship status, report status
   */
  async getDashboard(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const studentId = student.id;
    const cacheKey = `student:dashboard:${studentId}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // OPTIMIZED: Get current self-identified internship with only necessary fields
        const currentInternship = await this.prisma.internshipApplication.findFirst({
          where: {
            studentId,
            isSelfIdentified: true,
            status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED] },
            internshipPhase: InternshipPhase.ACTIVE,
          },
          select: {
            id: true,
            status: true,
            isSelfIdentified: true,
            companyName: true,
            jobProfile: true,
            startDate: true,
            endDate: true,
            joiningDate: true,
            internshipDuration: true,
            joiningLetterUrl: true,
            joiningLetterUploadedAt: true,
            facultyMentorName: true,
            totalExpectedReports: true,
            totalExpectedVisits: true,
            internship: {
              select: {
                id: true,
                title: true,
                startDate: true,
                endDate: true,
                industry: {
                  select: {
                    id: true,
                    companyName: true,
                    city: true,
                  },
                },
              },
            },
            mentor: {
              select: {
                id: true,
                name: true,
                email: true,
                phoneNo: true,
              },
            },
          },
        });

        // Get pending reports count
        const pendingReports = await this.prisma.monthlyReport.count({
          where: {
            studentId,
            status: MonthlyReportStatus.DRAFT,
          },
        });

        // Get available internships count
        const availableInternships = await this.prisma.internship.count({
          where: {
            status: InternshipStatus.ACTIVE,
            isActive: true,
            applicationDeadline: {
              gte: new Date(),
            },
          },
        });

        // FIXED: Get total self-identified applications count - filter by appropriate status
        const totalApplications = await this.prisma.internshipApplication.count({
          where: {
            studentId,
            isSelfIdentified: true,
            status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED, ApplicationStatus.COMPLETED] },
          },
        });

        // Get upcoming deadlines
        const upcomingDeadlines = await this.prisma.monthlyReport.findMany({
          where: {
            studentId,
            status: { in: [MonthlyReportStatus.DRAFT, MonthlyReportStatus.REVISION_REQUIRED] },
          },
          take: 3,
          orderBy: { reportMonth: 'asc' },
        });

        // Get recent notifications (placeholder - would integrate with notification system)
        const notifications = [];

        // OPTIMIZED: Get recent activities with only necessary fields
        const recentActivities = await this.prisma.internshipApplication.findMany({
          where: { studentId, isSelfIdentified: true },
          take: 5,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            status: true,
            companyName: true,
            jobProfile: true,
            isSelfIdentified: true,
            updatedAt: true,
            createdAt: true,
            internship: {
              select: {
                title: true,
              },
            },
          },
        });

        return {
          profile: {
            id: student.id,
            name: student.name,
            rollNumber: student.rollNumber,
            email: student.email,
          },
          currentInternship,
          upcomingDeadlines,
          pendingReports,
          availableInternships,
          totalApplications,
          notifications,
          recentActivities,
        };
      },
      { ttl: 300, tags: ['student', `student:${studentId}`] },
    );
  }

  /**
   * Get student profile
   */
  async getProfile(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phoneNo: true,
            active: true,
            Institution: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        batch: true,
        branch: true,
        mentorAssignments: {
          where: { isActive: true },
          include: {
            mentor: {
              select: {
                id: true,
                name: true,
                email: true,
                phoneNo: true,
                designation: true,
              },
            },
          },
        },
        internshipPreferences: true,
        // OPTIMIZED: Include only necessary fields for Career Track section
        internshipApplications: {
          select: {
            id: true,
            status: true,
            isSelfIdentified: true,
            companyName: true,
            jobProfile: true,
            startDate: true,
            endDate: true,
            joiningDate: true,
            internshipDuration: true,
            joiningLetterUrl: true,
            joiningLetterUploadedAt: true,
            facultyMentorName: true,
            facultyMentorEmail: true,
            totalExpectedReports: true,
            totalExpectedVisits: true,
            createdAt: true,
            updatedAt: true,
            internship: {
              select: {
                id: true,
                title: true,
                startDate: true,
                endDate: true,
                industry: {
                  select: {
                    id: true,
                    companyName: true,
                    city: true,
                  },
                },
              },
            },
            mentor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { appliedDate: 'desc' },
        },
        _count: {
          select: {
            internshipApplications: true,
            monthlyReports: true,
            grievances: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  /**
   * Update student profile
   * Syncs common fields (name, email, contact) to User record
   */
  async updateProfile(userId: string, updateProfileDto: Prisma.StudentUpdateInput) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // IMPORTANT: Do not allow Student Portal to toggle activation/deactivation or perform nested updates.
    // This endpoint is intended only for basic profile fields.
    const dto: any = updateProfileDto as any;
    const allowedKeys = new Set([
      'name',
      'email',
      'contact',
      'address',
      'pinCode',
      'tehsil',
      'district',
      'city',
      'state',
      'dob',
      'parentName',
      'parentContact',
      'motherName',
      'gender',
    ]);

    const safeUpdateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(dto ?? {})) {
      if (!allowedKeys.has(key)) continue;
      if (value === undefined) continue;
      safeUpdateData[key] = value;
    }

    // Build user update data for synced fields
    const userUpdateData: any = {};
    if (safeUpdateData.name) userUpdateData.name = safeUpdateData.name;
    if (safeUpdateData.email) userUpdateData.email = safeUpdateData.email;
    if (safeUpdateData.contact) userUpdateData.phoneNo = safeUpdateData.contact; // Student.contact -> User.phoneNo

    if (Object.keys(safeUpdateData).length === 0 && Object.keys(userUpdateData).length === 0) {
      return student;
    }

    // Use transaction to sync Student and User records
    const [updated] = await this.prisma.$transaction([
      this.prisma.student.update({
        where: { userId },
        data: safeUpdateData,
        include: {
          user: true,
          batch: true,
          branch: true,
        },
      }),
      // Only update user if there are fields to sync
      ...(Object.keys(userUpdateData).length > 0
        ? [this.prisma.user.update({
            where: { id: userId },
            data: userUpdateData,
          })]
        : []),
    ]);

    // Audit profile update
    this.auditService.log({
      action: AuditAction.STUDENT_PROFILE_UPDATE,
      entityType: 'Student',
      entityId: student.id,
      userId,
      userName: student.user?.name,
      userRole: student.user?.role || Role.STUDENT,
      description: `Student profile updated: ${student.name}`,
      category: AuditCategory.PROFILE_MANAGEMENT,
      severity: AuditSeverity.LOW,
      institutionId: student.institutionId || undefined,
      newValues: safeUpdateData as any,
    }).catch(() => {});

    await this.cache.invalidateByTags(['student', `student:${updated.id}`, `user:${userId}`]);

    return updated;
  }

  /**
   * Upload profile image
   */
  async uploadProfileImage(userId: string, imageUrl: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const updated = await this.prisma.student.update({
      where: { userId },
      data: {
        profileImage: imageUrl,
      },
    });

    // Audit profile image upload
    this.auditService.log({
      action: AuditAction.STUDENT_PROFILE_UPDATE,
      entityType: 'Student',
      entityId: student.id,
      userId,
      userName: student.user?.name,
      userRole: student.user?.role || Role.STUDENT,
      description: `Profile image uploaded for student: ${student.name}`,
      category: AuditCategory.PROFILE_MANAGEMENT,
      severity: AuditSeverity.LOW,
      institutionId: student.institutionId || undefined,
      newValues: { profileImage: imageUrl },
    }).catch(() => {});

    await this.cache.invalidateByTags(['student', `student:${student.id}`]);

    return {
      success: true,
      imageUrl,
      message: 'Profile image uploaded successfully',
    };
  }

  /**
   * Get available internships for student
   */
  async getAvailableInternships(userId: string, params: {
    page?: number;
    limit?: number;
    search?: string;
    industryType?: string;
    location?: string;
  }) {
    const { page = 1, limit = 10, search, industryType, location } = params;
    const skip = (page - 1) * limit;

    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: {
        id: true,
        branchName: true,
        currentSemester: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const where: Prisma.InternshipWhereInput = {
      status: InternshipStatus.ACTIVE,
      isActive: true,
      applicationDeadline: {
        gte: new Date(),
      },
    };

    // Filter by eligible branches if student branch is set
    if (student.branchName) {
      where.eligibleBranches = {
        has: student.branchName,
      };
    }

    // Filter by eligible semesters if student semester is set
    if (student.currentSemester) {
      where.eligibleSemesters = {
        has: student.currentSemester.toString(),
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { fieldOfWork: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (location) {
      where.workLocation = { contains: location, mode: 'insensitive' };
    }

    if (industryType) {
      where.industry = {
        industryType: industryType as any,
      };
    }

    const [internships, total] = await Promise.all([
      this.prisma.internship.findMany({
        where,
        skip,
        take: limit,
        include: {
          industry: {
            select: {
              id: true,
              companyName: true,
              industryType: true,
              city: true,
              state: true,
            },
          },
          _count: {
            select: {
              applications: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.internship.count({ where }),
    ]);

    // Check if student has already applied to these internships
    const internshipIds = internships.map(i => i.id);
    const existingApplications = await this.prisma.internshipApplication.findMany({
      where: {
        studentId: student.id,
        internshipId: { in: internshipIds },
      },
      select: {
        internshipId: true,
        status: true,
      },
    });

    const applicationsMap = new Map(
      existingApplications.map(app => [app.internshipId, app.status])
    );

    const internshipsWithStatus = internships.map(internship => ({
      ...internship,
      hasApplied: applicationsMap.has(internship.id),
      applicationStatus: applicationsMap.get(internship.id) || null,
    }));

    return {
      internships: internshipsWithStatus,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Apply for internship
   */
  async applyToInternship(userId: string, internshipId: string, applicationDto: {
    coverLetter?: string;
    resume?: string;
    additionalInfo?: string;
  }) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const studentId = student.id;

    // Check if internship exists and is active
    const internship = await this.prisma.internship.findUnique({
      where: { id: internshipId },
    });

    if (!internship) {
      throw new NotFoundException('Internship not found');
    }

    if (internship.status !== InternshipStatus.ACTIVE || !internship.isActive) {
      throw new BadRequestException('Internship is not active');
    }

    if (new Date(internship.applicationDeadline) < new Date()) {
      throw new BadRequestException('Application deadline has passed');
    }

    // Check if student has already applied
    const existingApplication = await this.prisma.internshipApplication.findFirst({
      where: {
        studentId,
        internshipId,
      },
    });

    if (existingApplication) {
      throw new BadRequestException('You have already applied to this internship');
    }

    // Check if student already has an active internship
    const activeApplication = await this.prisma.internshipApplication.findFirst({
      where: {
        studentId,
        status: { in: [ApplicationStatus.SELECTED, ApplicationStatus.JOINED] },
      },
    });

    if (activeApplication) {
      throw new BadRequestException('You already have an active internship');
    }

    const application = await this.prisma.internshipApplication.create({
      data: {
        studentId,
        internshipId,
        status: ApplicationStatus.APPLIED,
        isSelfIdentified: false,
        ...applicationDto,
      },
      include: {
        internship: {
          include: {
            industry: true,
          },
        },
      },
    });

    // Audit internship application
    this.auditService.log({
      action: AuditAction.APPLICATION_SUBMIT,
      entityType: 'InternshipApplication',
      entityId: application.id,
      userId,
      userName: student.user?.name || student.name,
      userRole: student.user?.role || Role.STUDENT,
      description: `Applied to internship: ${internship.title} at ${application.internship?.industry?.companyName || 'Unknown Company'}`,
      category: AuditCategory.APPLICATION_PROCESS,
      severity: AuditSeverity.MEDIUM,
      institutionId: student.institutionId || undefined,
      newValues: {
        applicationId: application.id,
        internshipId,
        internshipTitle: internship.title,
        status: ApplicationStatus.APPLIED,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `student:${studentId}`]);

    return application;
  }

  /**
   * Get student applications
   */
  async getApplications(
    userId: string,
    params: { page?: number; limit?: number; status?: string },
  ) {
    const { page = 1, limit = 10, status } = params;
    const skip = (page - 1) * limit;

    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const where: Prisma.InternshipApplicationWhereInput = {
      studentId: student.id,
    };

    if (status) {
      where.status = status as ApplicationStatus;
    }

    const [applications, total] = await Promise.all([
      this.prisma.internshipApplication.findMany({
        where,
        skip,
        take: limit,
        include: {
          internship: {
            include: {
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
          mentor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              monthlyReports: true,
              facultyVisitLogs: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.internshipApplication.count({ where }),
    ]);

    return {
      applications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get internship details + student's application (if any)
   */
  async getInternshipDetails(userId: string, internshipId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const internship = await this.prisma.internship.findUnique({
      where: { id: internshipId },
      include: {
        industry: true,
      },
    });

    if (!internship) {
      throw new NotFoundException('Internship not found');
    }

    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        studentId: student.id,
        internshipId,
      },
      select: {
        id: true,
        status: true,
        appliedDate: true,
        isSelfIdentified: true,
      },
    });

    return { internship, application };
  }

  /**
   * Get application details by ID (with ownership verification)
   */
  async getApplicationDetails(userId: string, id: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const application = await this.prisma.internshipApplication.findUnique({
      where: { id },
      include: {
        internship: {
          include: {
            industry: true,
          },
        },
        mentor: true,
        monthlyReports: true,
        facultyVisitLogs: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Verify ownership
    if (application.studentId !== student.id) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  /**
   * Withdraw an application
   */
  async withdrawApplication(userId: string, applicationId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const application = await this.prisma.internshipApplication.findUnique({
      where: { id: applicationId },
      include: { internship: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Verify ownership
    if (application.studentId !== student.id) {
      throw new NotFoundException('Application not found');
    }

    // Check if application can be withdrawn
    const nonWithdrawableStatuses: ApplicationStatus[] = [
      ApplicationStatus.SELECTED,
      ApplicationStatus.JOINED,
      ApplicationStatus.COMPLETED,
      ApplicationStatus.WITHDRAWN,
    ];

    if (nonWithdrawableStatuses.includes(application.status)) {
      throw new BadRequestException(
        `Cannot withdraw application with status: ${application.status}`
      );
    }

    const oldStatus = application.status;

    const updated = await this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.WITHDRAWN,
      },
      include: {
        internship: {
          include: {
            industry: true,
          },
        },
      },
    });

    // Audit application withdrawal
    this.auditService.log({
      action: AuditAction.APPLICATION_WITHDRAW,
      entityType: 'InternshipApplication',
      entityId: applicationId,
      userId,
      userName: student.user?.name,
      userRole: student.user?.role || Role.STUDENT,
      description: `Application withdrawn: ${application.internship?.title || application.companyName}`,
      category: AuditCategory.APPLICATION_PROCESS,
      severity: AuditSeverity.MEDIUM,
      institutionId: student.institutionId || undefined,
      oldValues: { status: oldStatus },
      newValues: { status: ApplicationStatus.WITHDRAWN },
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `student:${student.id}`]);

    return {
      success: true,
      message: 'Application withdrawn successfully',
      application: updated,
    };
  }

  /**
   * Update self-identified application (company info, joining letter)
   * Note: Time period (startDate, endDate) cannot be modified by student
   */
  async updateSelfIdentifiedApplication(
    userId: string,
    applicationId: string,
    updateDto: {
      companyName?: string;
      companyAddress?: string;
      companyContact?: string;
      companyEmail?: string;
      hrName?: string;
      hrContact?: string;
      hrEmail?: string;
      jobProfile?: string;
      joiningLetterUrl?: string;
      deleteJoiningLetter?: boolean;
    },
  ) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const application = await this.prisma.internshipApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Verify ownership
    if (application.studentId !== student.id) {
      throw new NotFoundException('Application not found');
    }

    // Only allow updates for self-identified applications
    if (!application.isSelfIdentified) {
      throw new BadRequestException('Only self-identified applications can be updated');
    }

    const oldValues = {
      companyName: application.companyName,
      companyAddress: application.companyAddress,
      companyContact: application.companyContact,
      companyEmail: application.companyEmail,
      hrName: application.hrName,
      hrContact: application.hrContact,
      hrEmail: application.hrEmail,
      jobProfile: application.jobProfile,
      joiningLetterUrl: application.joiningLetterUrl,
    };

    // Build update data - explicitly exclude time period fields
    const updateData: any = {};

    if (updateDto.companyName !== undefined) updateData.companyName = updateDto.companyName;
    if (updateDto.companyAddress !== undefined) updateData.companyAddress = updateDto.companyAddress;
    if (updateDto.companyContact !== undefined) updateData.companyContact = updateDto.companyContact;
    if (updateDto.companyEmail !== undefined) updateData.companyEmail = updateDto.companyEmail;
    if (updateDto.hrName !== undefined) updateData.hrName = updateDto.hrName;
    if (updateDto.hrContact !== undefined) updateData.hrContact = updateDto.hrContact;
    if (updateDto.hrEmail !== undefined) updateData.hrEmail = updateDto.hrEmail;
    if (updateDto.jobProfile !== undefined) updateData.jobProfile = updateDto.jobProfile;

    // Handle joining letter
    if (updateDto.deleteJoiningLetter) {
      updateData.joiningLetterUrl = null;
      updateData.joiningLetterUploadedAt = null;
    } else if (updateDto.joiningLetterUrl !== undefined) {
      updateData.joiningLetterUrl = updateDto.joiningLetterUrl;
      updateData.joiningLetterUploadedAt = new Date();
    }

    const updated = await this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: updateData,
      include: {
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Audit application update
    this.auditService.log({
      action: AuditAction.APPLICATION_UPDATE,
      entityType: 'InternshipApplication',
      entityId: applicationId,
      userId,
      userName: student.user?.name || student.name,
      userRole: student.user?.role || Role.STUDENT,
      description: `Self-identified application updated: ${updated.companyName}`,
      category: AuditCategory.APPLICATION_PROCESS,
      severity: AuditSeverity.LOW,
      institutionId: student.institutionId || undefined,
      oldValues,
      newValues: updateData,
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `student:${student.id}`]);

    return {
      success: true,
      message: 'Application updated successfully',
      application: updated,
    };
  }

  /**
   * Submit self-identified internship
   */
  async submitSelfIdentified(userId: string, selfIdentifiedDto: {
    companyName: string;
    companyAddress: string;
    companyContact?: string;
    companyEmail?: string;
    hrName?: string;
    hrDesignation?: string;
    hrContact?: string;
    hrEmail?: string;
    internshipDuration?: string;
    stipend?: string;
    startDate?: Date;
    endDate?: Date;
    jobProfile?: string;
    joiningLetterUrl?: string;
    coverLetter?: string;
  }) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const studentId = student.id;

    // Check if student already has an active internship
    const activeApplication = await this.prisma.internshipApplication.findFirst({
      where: {
        studentId,
        status: { in: [ApplicationStatus.SELECTED, ApplicationStatus.JOINED, ApplicationStatus.APPLIED] },
      },
    });

    if (activeApplication && !activeApplication.isSelfIdentified) {
      throw new BadRequestException('You already have an active internship application');
    }

    // Self-identified internships are auto-approved
    // If joiningLetterUrl is provided, auto-approve joining as well
    const hasJoiningLetter = !!selfIdentifiedDto.joiningLetterUrl;
    const application = await this.prisma.internshipApplication.create({
      data: {
        studentId,
        isSelfIdentified: true,
        status: ApplicationStatus.APPROVED,
        internshipPhase: InternshipPhase.ACTIVE,
        reviewedAt: new Date(),
        joiningLetterUploadedAt: hasJoiningLetter ? new Date() : null,
        joiningDate: hasJoiningLetter ? new Date() : null,
        ...selfIdentifiedDto,
      },
    });

    // Audit self-identified internship submission
    this.auditService.log({
      action: AuditAction.APPLICATION_SUBMIT,
      entityType: 'InternshipApplication',
      entityId: application.id,
      userId,
      userName: student.user?.name,
      userRole: student.user?.role || Role.STUDENT,
      description: `Self-identified internship submitted: ${selfIdentifiedDto.companyName}`,
      category: AuditCategory.APPLICATION_PROCESS,
      severity: AuditSeverity.MEDIUM,
      institutionId: student.institutionId || undefined,
      newValues: {
        applicationId: application.id,
        companyName: selfIdentifiedDto.companyName,
        isSelfIdentified: true,
        status: ApplicationStatus.APPROVED,
        startDate: selfIdentifiedDto.startDate,
        endDate: selfIdentifiedDto.endDate,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `student:${studentId}`]);

    return application;
  }

  /**
   * Get self-identified internship applications
   */
  async getSelfIdentified(userId: string, params: { page?: number; limit?: number }) {
    const { page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const where: Prisma.InternshipApplicationWhereInput = {
      studentId: student.id,
      isSelfIdentified: true,
    };

    const [applications, total] = await Promise.all([
      this.prisma.internshipApplication.findMany({
        where,
        skip,
        take: limit,
        include: {
          mentor: {
            select: {
              id: true,
              name: true,
              email: true,
              phoneNo: true,
              designation: true,
            },
          },
          internship: {
            include: {
              industry: {
                select: {
                  id: true,
                  companyName: true,
                  industryType: true,
                  city: true,
                  state: true,
                },
              },
            },
          },
          _count: {
            select: {
              monthlyReports: true,
              facultyVisitLogs: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.internshipApplication.count({ where }),
    ]);

    return {
      applications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Submit monthly report with AUTO-APPROVAL
   * - If a DRAFT report exists, update it with file and auto-approve
   * - If no report exists, create and auto-approve
   * - Check submission window and mark overdue if applicable
   */
  async submitMonthlyReport(userId: string, reportDto: {
    applicationId: string;
    reportMonth: number;
    reportYear: number;
    reportFileUrl: string; // Required for submission
    monthName?: string;
  }) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const studentId = student.id;

    // Require file URL for submission
    if (!reportDto.reportFileUrl) {
      throw new BadRequestException('Report file is required for submission');
    }

    // Verify application belongs to student
    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: reportDto.applicationId,
        studentId,
      },
      select: {
        id: true,
        startDate: true,
        joiningDate: true,
        endDate: true,
        completionDate: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // CRITICAL FIX 10.1: Monthly Report Timing Validation
    // Validate report month is not before internship started
    const internshipStartDate = application.startDate || application.joiningDate;
    if (internshipStartDate) {
      const reportDate = new Date(reportDto.reportYear, reportDto.reportMonth - 1, 1);
      const startDate = new Date(internshipStartDate.getFullYear(), internshipStartDate.getMonth(), 1);

      if (reportDate < startDate) {
        throw new BadRequestException(
          `Cannot submit report for ${MONTH_NAMES[reportDto.reportMonth - 1]} ${reportDto.reportYear}. ` +
          `Internship started in ${MONTH_NAMES[internshipStartDate.getMonth()]} ${internshipStartDate.getFullYear()}.`
        );
      }
    }

    // Validate report month is not after internship ended
    const internshipEndDate = application.endDate || application.completionDate;
    if (internshipEndDate) {
      const reportDate = new Date(reportDto.reportYear, reportDto.reportMonth - 1, 1);
      const endDate = new Date(internshipEndDate.getFullYear(), internshipEndDate.getMonth(), 1);

      if (reportDate > endDate) {
        throw new BadRequestException(
          `Cannot submit report for ${MONTH_NAMES[reportDto.reportMonth - 1]} ${reportDto.reportYear}. ` +
          `Internship ended in ${MONTH_NAMES[internshipEndDate.getMonth()]} ${internshipEndDate.getFullYear()}.`
        );
      }
    }

    // Check if report for this month already exists
    const existingReport = await this.prisma.monthlyReport.findFirst({
      where: {
        applicationId: reportDto.applicationId,
        reportMonth: reportDto.reportMonth,
        reportYear: reportDto.reportYear,
      },
    });

    // Calculate submission window
    const nextMonth = reportDto.reportMonth === 12 ? 1 : reportDto.reportMonth + 1;
    const nextYear = reportDto.reportMonth === 12 ? reportDto.reportYear + 1 : reportDto.reportYear;
    const submissionWindowStart = new Date(nextYear, nextMonth - 1, 1);
    const submissionWindowEnd = new Date(nextYear, nextMonth - 1, 10, 23, 59, 59);
    const now = new Date();
    const isOverdue = now > submissionWindowEnd;

    // If report already exists
    if (existingReport) {
      // Don't allow re-submission if already approved
      if (existingReport.status === MonthlyReportStatus.APPROVED) {
        throw new BadRequestException('Report has already been approved');
      }

      // Calculate period dates if not already set
      const periodStartDate = existingReport.periodStartDate || new Date(reportDto.reportYear, reportDto.reportMonth - 1, 1);
      const periodEndDate = existingReport.periodEndDate || new Date(reportDto.reportYear, reportDto.reportMonth, 0, 23, 59, 59);

      // Update existing report with file and AUTO-APPROVE
      const updated = await this.prisma.monthlyReport.update({
        where: { id: existingReport.id },
        data: {
          reportFileUrl: reportDto.reportFileUrl,
          monthName: reportDto.monthName || MONTH_NAMES[reportDto.reportMonth - 1],
          status: MonthlyReportStatus.APPROVED, // AUTO-APPROVAL
          isApproved: true,
          approvedAt: now,
          submittedAt: now,
          submissionWindowStart: existingReport.submissionWindowStart || submissionWindowStart,
          submissionWindowEnd: existingReport.submissionWindowEnd || submissionWindowEnd,
          dueDate: existingReport.dueDate || submissionWindowEnd,
          periodStartDate,
          periodEndDate,
          isOverdue,
        },
      });

      // Audit monthly report submission (update)
      this.auditService.log({
        action: AuditAction.MONTHLY_REPORT_SUBMIT,
        entityType: 'MonthlyReport',
        entityId: updated.id,
        userId,
        userName: student.user?.name || student.name,
        userRole: student.user?.role || Role.STUDENT,
        description: `Monthly report submitted for ${MONTH_NAMES[reportDto.reportMonth - 1]} ${reportDto.reportYear}${isOverdue ? ' (overdue)' : ''}`,
        category: AuditCategory.INTERNSHIP_WORKFLOW,
        severity: isOverdue ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
        institutionId: student.institutionId || undefined,
        newValues: {
          reportId: updated.id,
          reportMonth: reportDto.reportMonth,
          reportYear: reportDto.reportYear,
          status: MonthlyReportStatus.APPROVED,
          isOverdue,
          autoApproved: true,
        },
      }).catch(() => {});

      await this.cache.invalidateByTags(['reports', `student:${studentId}`]);

      return {
        ...updated,
        message: 'Report submitted and auto-approved successfully',
        autoApproved: true,
      };
    }

    // Calculate period dates for the report
    const periodStartDate = new Date(reportDto.reportYear, reportDto.reportMonth - 1, 1);
    const periodEndDate = new Date(reportDto.reportYear, reportDto.reportMonth, 0, 23, 59, 59);

    // Create new report with AUTO-APPROVAL
    const report = await this.prisma.monthlyReport.create({
      data: {
        applicationId: reportDto.applicationId,
        studentId,
        reportMonth: reportDto.reportMonth,
        reportYear: reportDto.reportYear,
        reportFileUrl: reportDto.reportFileUrl,
        monthName: reportDto.monthName || MONTH_NAMES[reportDto.reportMonth - 1],
        status: MonthlyReportStatus.APPROVED, // AUTO-APPROVAL
        isApproved: true,
        approvedAt: now,
        submittedAt: now,
        submissionWindowStart,
        submissionWindowEnd,
        dueDate: submissionWindowEnd,
        periodStartDate,
        periodEndDate,
        isOverdue,
      },
    });

    // Audit monthly report submission (create)
    this.auditService.log({
      action: AuditAction.MONTHLY_REPORT_SUBMIT,
      entityType: 'MonthlyReport',
      entityId: report.id,
      userId,
      userName: student.user?.name || student.name,
      userRole: student.user?.role || Role.STUDENT,
      description: `Monthly report submitted for ${MONTH_NAMES[reportDto.reportMonth - 1]} ${reportDto.reportYear}${isOverdue ? ' (overdue)' : ''}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: isOverdue ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
      institutionId: student.institutionId || undefined,
      newValues: {
        reportId: report.id,
        reportMonth: reportDto.reportMonth,
        reportYear: reportDto.reportYear,
        status: MonthlyReportStatus.APPROVED,
        isOverdue,
        autoApproved: true,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['reports', `student:${studentId}`]);

    return {
      ...report,
      message: 'Report submitted and auto-approved successfully',
      autoApproved: true,
    };
  }

  /**
   * Update a monthly report (student-owned)
   */
  async updateMonthlyReport(userId: string, id: string, reportDto: {
    reportFileUrl?: string;
    monthName?: string;
    status?: MonthlyReportStatus;
    reviewComments?: string;
  }) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const studentId = student.id;

    const existing = await this.prisma.monthlyReport.findFirst({
      where: { id, studentId },
    });

    if (!existing) {
      throw new NotFoundException('Monthly report not found');
    }

    const oldValues = {
      reportFileUrl: existing.reportFileUrl,
      monthName: existing.monthName,
      status: existing.status,
    };

    const updated = await this.prisma.monthlyReport.update({
      where: { id },
      data: {
        reportFileUrl: reportDto.reportFileUrl,
        monthName: reportDto.monthName,
        status: reportDto.status,
        reviewComments: reportDto.reviewComments,
        submittedAt: reportDto.status === MonthlyReportStatus.SUBMITTED ? new Date() : undefined,
      },
    });

    // Audit monthly report update
    this.auditService.log({
      action: AuditAction.MONTHLY_REPORT_SUBMIT,
      entityType: 'MonthlyReport',
      entityId: id,
      userId,
      userName: student.user?.name || student.name,
      userRole: student.user?.role || Role.STUDENT,
      description: `Monthly report updated for ${existing.monthName || MONTH_NAMES[(existing.reportMonth || 1) - 1]} ${existing.reportYear}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.LOW,
      institutionId: student.institutionId || undefined,
      oldValues,
      newValues: reportDto,
    }).catch(() => {});

    await this.cache.invalidateByTags(['reports', `student:${studentId}`]);
    return updated;
  }

  /**
   * Delete a monthly report (student-owned, non-approved only)
   */
  async deleteMonthlyReport(userId: string, id: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const studentId = student.id;

    const existing = await this.prisma.monthlyReport.findFirst({
      where: { id, studentId },
    });

    if (!existing) {
      throw new NotFoundException('Monthly report not found');
    }

    // Only allow deletion of non-approved reports
    if (existing.status === MonthlyReportStatus.APPROVED) {
      throw new BadRequestException('Approved reports cannot be deleted');
    }

    await this.prisma.monthlyReport.delete({
      where: { id },
    });

    // Audit monthly report deletion
    this.auditService.log({
      action: AuditAction.MONTHLY_REPORT_DELETE,
      entityType: 'MonthlyReport',
      entityId: id,
      userId,
      userName: student.user?.name || student.name,
      userRole: student.user?.role || Role.STUDENT,
      description: `Monthly report deleted for ${existing.monthName || MONTH_NAMES[(existing.reportMonth || 1) - 1]} ${existing.reportYear}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: student.institutionId || undefined,
      oldValues: {
        reportId: id,
        reportMonth: existing.reportMonth,
        reportYear: existing.reportYear,
        status: existing.status,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['reports', `student:${studentId}`]);

    return {
      success: true,
      message: 'Monthly report deleted successfully',
    };
  }

  /**
   * Get student documents
   */
  async getDocuments(userId: string, params: { page?: number; limit?: number; type?: string }) {
    const { page = 1, limit = 10, type } = params;
    const skip = (page - 1) * limit;

    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const where: Prisma.DocumentWhereInput = {
      studentId: student.id,
      ...(type ? { type: type as DocumentType } : {}),
    };

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      documents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Upload a document
   */
  async uploadDocument(userId: string, file: any, documentDto: { type: string }) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const fileUrl = (file as any)?.path || (file as any)?.location || (file as any)?.url || '';
    const fileName = (file as any)?.originalname || (file as any)?.filename || 'document';

    const created = await this.prisma.document.create({
      data: {
        studentId: student.id,
        type: documentDto.type as DocumentType,
        fileName,
        fileUrl,
      },
    });

    // Audit document upload
    this.auditService.log({
      action: AuditAction.STUDENT_DOCUMENT_UPLOAD,
      entityType: 'Document',
      entityId: created.id,
      userId,
      userName: student.user?.name || student.name,
      userRole: student.user?.role || Role.STUDENT,
      description: `Document uploaded: ${fileName} (${documentDto.type})`,
      category: AuditCategory.PROFILE_MANAGEMENT,
      severity: AuditSeverity.LOW,
      institutionId: student.institutionId || undefined,
      newValues: {
        documentId: created.id,
        fileName,
        fileUrl,
        type: documentDto.type,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['documents', `student:${student.id}`]);
    return created;
  }

  /**
   * Delete a document
   */
  async deleteDocument(userId: string, id: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const document = await this.prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.prisma.document.delete({ where: { id } });

    // Audit document deletion
    this.auditService.log({
      action: AuditAction.STUDENT_DOCUMENT_DELETE,
      entityType: 'Document',
      entityId: id,
      userId,
      userName: student.user?.name || student.name,
      userRole: student.user?.role || Role.STUDENT,
      description: `Document deleted: ${document.fileName}`,
      category: AuditCategory.PROFILE_MANAGEMENT,
      severity: AuditSeverity.MEDIUM,
      institutionId: student.institutionId || undefined,
      oldValues: {
        documentId: id,
        fileName: document.fileName,
        type: document.type,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['documents', `student:${student.id}`]);
    return { success: true, message: 'Document deleted successfully' };
  }

  /**
   * Get monthly reports
   * CRITICAL FIX 10.3: Filter reports by valid internship period
   */
  async getMonthlyReports(userId: string, params: { page?: number; limit?: number; applicationId?: string }) {
    const { page = 1, limit = 10, applicationId } = params;
    const skip = (page - 1) * limit;

    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const studentId = student.id;

    // Build where clause with optional applicationId filter
    const where: any = { studentId };
    if (applicationId) {
      where.applicationId = applicationId;
    }

    const [reports, total] = await Promise.all([
      this.prisma.monthlyReport.findMany({
        where,
        skip,
        take: limit,
        include: {
          // OPTIMIZED: Only select necessary fields from application
          application: {
            select: {
              id: true,
              companyName: true,
              isSelfIdentified: true,
              startDate: true,
              endDate: true,
              joiningDate: true,
              completionDate: true,
              internship: {
                select: {
                  id: true,
                  title: true,
                  industry: {
                    select: {
                      companyName: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          { reportYear: 'desc' },
          { reportMonth: 'desc' },
        ],
      }),
      this.prisma.monthlyReport.count({ where }),
    ]);

    // CRITICAL FIX 10.3: Filter reports for valid internship period only
    const validReports = reports.filter((report) => {
      const application = report.application;
      if (!application) return true; // Keep if no application data

      const internshipStartDate = application.startDate || application.joiningDate;
      const internshipEndDate = application.endDate || application.completionDate;

      // If no start date, keep all reports
      if (!internshipStartDate) return true;

      const reportDate = new Date(report.reportYear, report.reportMonth - 1, 1);
      const startDate = new Date(internshipStartDate.getFullYear(), internshipStartDate.getMonth(), 1);

      // Filter out reports before internship started
      if (reportDate < startDate) return false;

      // Filter out reports after internship ended
      if (internshipEndDate) {
        const endDate = new Date(internshipEndDate.getFullYear(), internshipEndDate.getMonth(), 1);
        if (reportDate > endDate) return false;
      }

      return true;
    });

    return {
      reports: validReports,
      total: validReports.length,
      page,
      limit,
      totalPages: Math.ceil(validReports.length / limit),
    };
  }

  /**
   * Submit grievance
   */
  async submitGrievance(userId: string, grievanceDto: {
    title: string;
    category: string;
    description: string;
    severity?: string;
    internshipId?: string;
    industryId?: string;
    actionRequested?: string;
    preferredContactMethod?: string;
    attachments?: string[];
    assignedToId?: string;
  }) {
    console.log('[StudentService.submitGrievance] Received grievanceDto:', JSON.stringify(grievanceDto, null, 2));
    console.log('[StudentService.submitGrievance] assignedToId:', grievanceDto.assignedToId);

    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const studentId = student.id;

    const grievance = await this.prisma.grievance.create({
      data: {
        studentId,
        title: grievanceDto.title,
        category: grievanceDto.category as any,
        description: grievanceDto.description,
        severity: (grievanceDto.severity as any) || 'MEDIUM',
        internshipId: grievanceDto.internshipId,
        industryId: grievanceDto.industryId,
        actionRequested: grievanceDto.actionRequested,
        preferredContactMethod: grievanceDto.preferredContactMethod,
        attachments: grievanceDto.attachments || [],
        assignedToId: grievanceDto.assignedToId,
        escalationLevel: 'MENTOR',
        status: 'SUBMITTED',
      },
    });

    // Audit grievance submission
    this.auditService.log({
      action: AuditAction.GRIEVANCE_SUBMIT,
      entityType: 'Grievance',
      entityId: grievance.id,
      userId,
      userName: student.user?.name || student.name,
      userRole: student.user?.role || Role.STUDENT,
      description: `Grievance submitted: ${grievanceDto.title} (${grievanceDto.category})`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: grievanceDto.severity === 'HIGH' || grievanceDto.severity === 'CRITICAL'
        ? AuditSeverity.HIGH
        : AuditSeverity.MEDIUM,
      institutionId: student.institutionId || undefined,
      newValues: {
        grievanceId: grievance.id,
        title: grievanceDto.title,
        category: grievanceDto.category,
        severity: grievanceDto.severity || 'MEDIUM',
        status: 'PENDING',
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['grievances', `student:${studentId}`]);

    // Invalidate Redis cache for assigned faculty so they see the new grievance
    if (grievanceDto.assignedToId) {
      await this.redisCache.del(`grievances:faculty:${grievanceDto.assignedToId}`);
    }

    return grievance;
  }

  /**
   * Get grievances
   */
  async getGrievances(
    userId: string,
    params: { page?: number; limit?: number; status?: string },
  ) {
    const { page = 1, limit = 10, status } = params;
    const skip = (page - 1) * limit;

    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const where: Prisma.GrievanceWhereInput = {
      studentId: student.id,
    };

    if (status) {
      where.status = status as any;
    }

    const [grievances, total] = await Promise.all([
      // OPTIMIZED: Only select necessary fields for list view
      this.prisma.grievance.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          category: true,
          description: true,
          severity: true,
          status: true,
          submittedDate: true,
          resolvedDate: true,
          resolution: true,
          createdAt: true,
          updatedAt: true,
          internship: {
            select: {
              id: true,
              title: true,
            },
          },
          industry: {
            select: {
              id: true,
              companyName: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { submittedDate: 'desc' },
      }),
      this.prisma.grievance.count({ where }),
    ]);

    return {
      grievances,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Submit technical query
   */
  async submitTechnicalQuery(userId: string, queryDto: {
    title?: string;
    description?: string;
    priority?: string;
    attachments?: string[];
  }) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const query = await this.prisma.technicalQuery.create({
      data: {
        userId: student.userId,
        title: queryDto.title,
        description: queryDto.description,
        priority: (queryDto.priority as any) || 'MEDIUM',
        attachments: queryDto.attachments || [],
        status: 'OPEN',
        institutionId: student.institutionId,
      },
    });

    // Audit technical query submission
    this.auditService.log({
      action: AuditAction.TECHNICAL_QUERY_SUBMIT,
      entityType: 'TechnicalQuery',
      entityId: query.id,
      userId,
      userName: student.user?.name || student.name,
      userRole: student.user?.role || Role.STUDENT,
      description: `Technical query submitted: ${queryDto.title || 'Untitled'}`,
      category: AuditCategory.SUPPORT,
      severity: AuditSeverity.LOW,
      institutionId: student.institutionId || undefined,
      newValues: {
        queryId: query.id,
        title: queryDto.title,
        priority: queryDto.priority || 'MEDIUM',
        status: 'OPEN',
      },
    }).catch(() => {});

    return query;
  }

  /**
   * Generate expected reports for an application
   * Called when internship starts or application is approved
   */
  async generateExpectedReports(applicationId: string) {
    const application = await this.prisma.internshipApplication.findUnique({
      where: { id: applicationId },
      include: { student: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Check if reports already generated
    if (application.reportsGenerated) {
      return { message: 'Reports already generated', count: 0 };
    }

    // Get start and end dates
    const startDate = application.startDate || application.joiningDate;
    const endDate = application.endDate || application.completionDate;

    if (!startDate || !endDate) {
      throw new BadRequestException('Start date and end date are required to generate reports');
    }

    // Calculate expected periods
    const periods = this.calculateExpectedReportPeriods(startDate, endDate);

    // Create DRAFT reports for each period
    const createdReports = [];
    for (const period of periods) {
      // Check if report already exists
      const existing = await this.prisma.monthlyReport.findFirst({
        where: {
          applicationId,
          reportMonth: period.month,
          reportYear: period.year,
        },
      });

      if (!existing) {
        const report = await this.prisma.monthlyReport.create({
          data: {
            applicationId,
            studentId: application.studentId,
            reportMonth: period.month,
            reportYear: period.year,
            monthName: MONTH_NAMES[period.month - 1],
            status: MonthlyReportStatus.DRAFT,
            periodStartDate: period.periodStartDate,
            periodEndDate: period.periodEndDate,
            submissionWindowStart: period.submissionWindowStart,
            submissionWindowEnd: period.submissionWindowEnd,
            dueDate: period.dueDate,
            isPartialMonth: period.isPartialMonth,
            isFinalReport: period.isFinalReport,
          },
        });
        createdReports.push(report);
      }
    }

    // Update application to mark reports as generated
    await this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: {
        reportsGenerated: true,
        totalExpectedReports: periods.length,
      },
    });

    await this.cache.invalidateByTags(['reports', `student:${application.studentId}`]);

    return {
      message: `Generated ${createdReports.length} expected reports`,
      count: createdReports.length,
      totalExpected: periods.length,
      reports: createdReports,
    };
  }

  /**
   * Get monthly reports with submission status for an application
   * Returns all expected reports with their current status
   */
  async getMonthlyReportsWithStatus(userId: string, applicationId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Verify ownership
    const application = await this.prisma.internshipApplication.findFirst({
      where: { id: applicationId, studentId: student.id },
      include: {
        internship: {
          include: {
            industry: {
              select: { companyName: true },
            },
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Get all reports for this application
    const reports = await this.prisma.monthlyReport.findMany({
      where: { applicationId },
      orderBy: [{ reportYear: 'asc' }, { reportMonth: 'asc' }],
    });

    // If no reports exist and we have dates, generate them
    if (reports.length === 0 && application.startDate && application.endDate) {
      await this.generateExpectedReports(applicationId);
      // Re-fetch after generation
      const newReports = await this.prisma.monthlyReport.findMany({
        where: { applicationId },
        orderBy: [{ reportYear: 'asc' }, { reportMonth: 'asc' }],
      });
      return this.formatReportsWithStatus(newReports, application);
    }

    return this.formatReportsWithStatus(reports, application);
  }

  /**
   * Helper: Format reports with submission status
   * HIGH PRIORITY FIX 10.5: Progress calculated based on valid reports only
   */
  private formatReportsWithStatus(reports: any[], application: any) {
    const internshipStartDate = application.startDate || application.joiningDate;
    const internshipEndDate = application.endDate || application.completionDate;

    // Filter for valid reports (within internship period)
    const validReports = reports.filter((report) => {
      if (!internshipStartDate) return true;

      const reportDate = new Date(report.reportYear, report.reportMonth - 1, 1);
      const startDate = new Date(internshipStartDate.getFullYear(), internshipStartDate.getMonth(), 1);

      // Filter out reports before internship started
      if (reportDate < startDate) return false;

      // Filter out reports after internship ended
      if (internshipEndDate) {
        const endDate = new Date(internshipEndDate.getFullYear(), internshipEndDate.getMonth(), 1);
        if (reportDate > endDate) return false;
      }

      return true;
    });

    const reportsWithStatus = validReports.map((report) => {
      const submissionStatus = this.getReportSubmissionStatus(report);
      return {
        ...report,
        submissionStatus,
        autoApproved: report.isApproved && report.status === MonthlyReportStatus.APPROVED, // HIGH PRIORITY FIX 10.4
      };
    });

    // Calculate progress - only for valid reports
    const total = validReports.length;
    const approved = validReports.filter((r) => r.status === MonthlyReportStatus.APPROVED).length;
    const submitted = validReports.filter((r) => r.status === MonthlyReportStatus.SUBMITTED).length;
    const draft = validReports.filter((r) => r.status === MonthlyReportStatus.DRAFT).length;
    const overdue = validReports.filter((r) => {
      if (r.status === MonthlyReportStatus.APPROVED) return false;
      const status = this.getReportSubmissionStatus(r);
      return status.status === 'OVERDUE';
    }).length;

    return {
      reports: reportsWithStatus,
      progress: {
        total,
        approved,
        submitted,
        draft,
        overdue,
        percentage: total > 0 ? Math.round((approved / total) * 100) : 0,
      },
      internship: {
        startDate: application.startDate,
        endDate: application.endDate,
        companyName: application.companyName || application.internship?.industry?.companyName,
      },
    };
  }

  /**
   * View a specific monthly report
   * HIGH PRIORITY FIX 10.4: Include autoApproved flag in response
   */
  async viewMonthlyReport(userId: string, reportId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const report = await this.prisma.monthlyReport.findFirst({
      where: { id: reportId, studentId: student.id },
      include: {
        application: {
          select: {
            companyName: true,
            startDate: true,
            endDate: true,
            joiningDate: true,
            completionDate: true,
            internship: {
              include: {
                industry: {
                  select: { companyName: true },
                },
              },
            },
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const submissionStatus = this.getReportSubmissionStatus(report);

    return {
      ...report,
      submissionStatus,
      autoApproved: report.isApproved && report.status === MonthlyReportStatus.APPROVED,
    };
  }

  /**
   * Upload report file and save as DRAFT (for cases where user wants to upload before submitting)
   */
  async uploadReportFile(userId: string, reportDto: {
    applicationId: string;
    reportMonth: number;
    reportYear: number;
    reportFileUrl: string;
  }) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Verify application belongs to student
    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: reportDto.applicationId,
        studentId: student.id,
      },
      select: {
        id: true,
        startDate: true,
        joiningDate: true,
        endDate: true,
        completionDate: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // CRITICAL FIX 10.1: Validate report timing for upload as well
    const internshipStartDate = application.startDate || application.joiningDate;
    if (internshipStartDate) {
      const reportDate = new Date(reportDto.reportYear, reportDto.reportMonth - 1, 1);
      const startDate = new Date(internshipStartDate.getFullYear(), internshipStartDate.getMonth(), 1);

      if (reportDate < startDate) {
        throw new BadRequestException(
          `Cannot upload report for ${MONTH_NAMES[reportDto.reportMonth - 1]} ${reportDto.reportYear}. ` +
          `Internship started in ${MONTH_NAMES[internshipStartDate.getMonth()]} ${internshipStartDate.getFullYear()}.`
        );
      }
    }

    const internshipEndDate = application.endDate || application.completionDate;
    if (internshipEndDate) {
      const reportDate = new Date(reportDto.reportYear, reportDto.reportMonth - 1, 1);
      const endDate = new Date(internshipEndDate.getFullYear(), internshipEndDate.getMonth(), 1);

      if (reportDate > endDate) {
        throw new BadRequestException(
          `Cannot upload report for ${MONTH_NAMES[reportDto.reportMonth - 1]} ${reportDto.reportYear}. ` +
          `Internship ended in ${MONTH_NAMES[internshipEndDate.getMonth()]} ${internshipEndDate.getFullYear()}.`
        );
      }
    }

    // Check if report exists
    const existingReport = await this.prisma.monthlyReport.findFirst({
      where: {
        applicationId: reportDto.applicationId,
        reportMonth: reportDto.reportMonth,
        reportYear: reportDto.reportYear,
      },
    });

    if (existingReport) {
      // Don't update if already approved
      if (existingReport.status === MonthlyReportStatus.APPROVED) {
        throw new BadRequestException('Approved reports cannot be modified');
      }

      // Update existing report with file
      const updated = await this.prisma.monthlyReport.update({
        where: { id: existingReport.id },
        data: { reportFileUrl: reportDto.reportFileUrl },
      });

      // Audit report file upload (update)
      this.auditService.log({
        action: AuditAction.MONTHLY_REPORT_UPDATE,
        entityType: 'MonthlyReport',
        entityId: updated.id,
        userId,
        userName: student.user?.name || student.name,
        userRole: student.user?.role || Role.STUDENT,
        description: `Report file uploaded for ${MONTH_NAMES[reportDto.reportMonth - 1]} ${reportDto.reportYear}`,
        category: AuditCategory.INTERNSHIP_WORKFLOW,
        severity: AuditSeverity.LOW,
        institutionId: student.institutionId || undefined,
        newValues: {
          reportId: updated.id,
          reportMonth: reportDto.reportMonth,
          reportYear: reportDto.reportYear,
          reportFileUrl: reportDto.reportFileUrl,
        },
      }).catch(() => {});

      await this.cache.invalidateByTags(['reports', `student:${student.id}`]);
      return updated;
    }

    // Calculate submission window and period dates
    const nextMonth = reportDto.reportMonth === 12 ? 1 : reportDto.reportMonth + 1;
    const nextYear = reportDto.reportMonth === 12 ? reportDto.reportYear + 1 : reportDto.reportYear;
    const submissionWindowStart = new Date(nextYear, nextMonth - 1, 1);
    const submissionWindowEnd = new Date(nextYear, nextMonth - 1, 10, 23, 59, 59);
    const periodStartDate = new Date(reportDto.reportYear, reportDto.reportMonth - 1, 1);
    const periodEndDate = new Date(reportDto.reportYear, reportDto.reportMonth, 0, 23, 59, 59);

    // Create new DRAFT report with file
    const report = await this.prisma.monthlyReport.create({
      data: {
        applicationId: reportDto.applicationId,
        studentId: student.id,
        reportMonth: reportDto.reportMonth,
        reportYear: reportDto.reportYear,
        reportFileUrl: reportDto.reportFileUrl,
        monthName: MONTH_NAMES[reportDto.reportMonth - 1],
        status: MonthlyReportStatus.DRAFT,
        submissionWindowStart,
        submissionWindowEnd,
        dueDate: submissionWindowEnd,
        periodStartDate,
        periodEndDate,
      },
    });

    // Audit report file upload (create draft)
    this.auditService.log({
      action: AuditAction.MONTHLY_REPORT_UPDATE,
      entityType: 'MonthlyReport',
      entityId: report.id,
      userId,
      userName: student.user?.name || student.name,
      userRole: student.user?.role || Role.STUDENT,
      description: `Report file uploaded (draft) for ${MONTH_NAMES[reportDto.reportMonth - 1]} ${reportDto.reportYear}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.LOW,
      institutionId: student.institutionId || undefined,
      newValues: {
        reportId: report.id,
        reportMonth: reportDto.reportMonth,
        reportYear: reportDto.reportYear,
        reportFileUrl: reportDto.reportFileUrl,
        status: MonthlyReportStatus.DRAFT,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['reports', `student:${student.id}`]);
    return report;
  }

  /**
   * Get faculty visits with status for an application
   */
  async getFacultyVisitsWithStatus(applicationId: string) {
    return this.facultyVisitService.getMonthlyVisitStatus(applicationId);
  }

  /**
   * Generate expected faculty visits for an application
   */
  async generateExpectedVisits(applicationId: string) {
    return this.facultyVisitService.generateExpectedVisits(applicationId);
  }

  /**
   * Get the assigned mentor for the student
   */
  async getMyMentor(userId: string) {
    console.log('[StudentService.getMyMentor] userId:', userId);

    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    console.log('[StudentService.getMyMentor] studentId:', student.id);

    // Find active mentor assignment
    const assignment = await this.prisma.mentorAssignment.findFirst({
      where: {
        studentId: student.id,
        isActive: true,
      },
      include: {
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNo: true,
            designation: true,
          },
        },
      },
      orderBy: { assignmentDate: 'desc' },
    });

    console.log('[StudentService.getMyMentor] assignment found:', !!assignment);
    console.log('[StudentService.getMyMentor] mentor:', assignment?.mentor ? { id: assignment.mentor.id, name: assignment.mentor.name } : null);

    return {
      data: {
        mentor: assignment?.mentor || null,
        assignmentId: assignment?.id || null,
        assignmentDate: assignment?.assignmentDate || null,
      },
    };
  }
}
