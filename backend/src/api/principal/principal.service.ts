import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { LruCacheService } from '../../core/cache/lru-cache.service';
import { Prisma, ApplicationStatus, Role, GrievanceStatus, MonthlyReportStatus, AuditAction, AuditCategory, AuditSeverity, InternshipPhase } from '../../generated/prisma/client';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { AssignMentorDto } from './dto/assign-mentor.dto';
import { UserService } from '../../domain/user/user.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import {
  calculateExpectedMonths,
  getTotalExpectedCount,
  getExpectedReportsAsOfToday,
  getExpectedVisitsAsOfToday,
  MONTHLY_CYCLE,
} from '../../common/utils/monthly-cycle.util';
import * as bcrypt from 'bcrypt';
import { ExcelUtils } from '../../core/common/utils/excel.util';
import { BCRYPT_SALT_ROUNDS } from '../../core/auth/services/auth.service';

// Static month names array - toLocaleString is unreliable in Node.js
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Injectable()
export class PrincipalService {
  private readonly logger = new Logger(PrincipalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly userService: UserService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get Principal Dashboard - Institution-specific statistics
   */
  async getDashboard(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
      include: { Institution: true },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    const institutionId = principal.institutionId;
    const cacheKey = `principal:dashboard:${institutionId}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // Get current month and year for filtering monthly reports
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();

        // Only count self-identified internships (auto-approved on submission)
        const [
          totalStudents,
          activeStudents,
          totalStaff,
          activeStaff,
          totalSelfIdentifiedInternships,
          ongoingInternships,
          completedInternships,
          totalBatches,
          activeBatches,
          pendingMonthlyReports,
          pendingGrievances,
          selfIdentifiedApplications,
          studentsByBranch,
        ] = await Promise.all([
          this.prisma.student.count({ where: { institutionId } }),
          this.prisma.student.count({ where: { institutionId, isActive: true } }),
          this.prisma.user.count({ where: { institutionId, role: { not: Role.STUDENT } } }),
          this.prisma.user.count({
            where: { institutionId, role: { not: Role.STUDENT }, active: true }
          }),
          // Count all self-identified internships
          this.prisma.internshipApplication.count({
            where: { student: { institutionId, isActive: true }, isSelfIdentified: true }
          }),
          // Count ongoing self-identified internships (auto-approved, in progress)
          this.prisma.internshipApplication.count({
            where: {
              student: { institutionId, isActive: true },
              isSelfIdentified: true,
              status: ApplicationStatus.JOINED,
              internshipPhase: InternshipPhase.ACTIVE,
            }
          }),
          // Count completed self-identified internships
          this.prisma.internshipApplication.count({
            where: {
              student: { institutionId, isActive: true },
              isSelfIdentified: true,
              internshipPhase: InternshipPhase.COMPLETED,
            }
          }),
          this.prisma.batch.count({ where: { institutionId } }),
          this.prisma.batch.count({ where: { institutionId, isActive: true } }),
          this.prisma.monthlyReport.count({
            where: {
              student: { institutionId, isActive: true },
              reportMonth: currentMonth,
              reportYear: currentYear,
              status: 'SUBMITTED',
            }
          }),
          this.prisma.grievance.count({
            where: {
              student: { institutionId },
              status: { in: ['PENDING', 'UNDER_REVIEW'] },
            }
          }),
          // OPTIMIZED: Use count() with OR conditions for null/empty string handling
          // PostgreSQL with Prisma handles this correctly unlike MongoDB
          this.prisma.internshipApplication.count({
            where: {
              student: { institutionId },
              isSelfIdentified: true,
              OR: [
                { joiningLetterUrl: null },
                { joiningLetterUrl: '' },
              ],
            },
          }),
          // Students grouped by branch/course
          this.prisma.branch.findMany({
            where: { institutionId },
            select: {
              id: true,
              name: true,
              _count: {
                select: {
                  students: true,
                },
              },
              students: {
                where: { isActive: true },
                select: { id: true },
              },
            },
          }),
        ]);

        // Pending joining letters now comes from the count query above
        const pendingJoiningLetters = selfIdentifiedApplications;

        // Completion rate for self-identified internships (auto-approved on submission)
        const completionRate = totalSelfIdentifiedInternships > 0
          ? Math.round((completedInternships / totalSelfIdentifiedInternships) * 100)
          : 0;

        // Format students by branch data
        const formattedStudentsByBranch = studentsByBranch.map((branch) => ({
          branchId: branch.id,
          branchName: branch.name,
          totalStudents: branch._count.students,
          activeStudents: branch.students.length,
        }));

        return {
          institution: {
            id: principal.Institution?.id,
            name: principal.Institution?.name,
            code: principal.Institution?.code,
          },
          students: {
            total: totalStudents,
            active: activeStudents,
          },
          staff: {
            total: totalStaff,
            active: activeStaff,
          },
          // Self-identified internships only (auto-approved, no placement-based)
          internships: {
            totalApplications: totalSelfIdentifiedInternships,
            ongoingInternships,
            completedInternships,
            completionRate,
          },
          pending: {
            // Self-identified internships are auto-approved, so no pending approvals
            monthlyReports: pendingMonthlyReports,
            grievances: pendingGrievances,
            joiningLetters: pendingJoiningLetters,
          },
          batches: {
            total: totalBatches,
            active: activeBatches,
          },
          // Students grouped by branch/course
          studentsByBranch: formattedStudentsByBranch,
        };
      },
      { ttl: 300, tags: ['principal', `institution:${institutionId}`] },
    );
  }

  /**
   * Get dashboard alerts for principal
   */
  async getDashboardAlerts(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    const institutionId = principal.institutionId;

    const [pendingSelfIdentified, upcomingDeadlines, pendingGrievances] = await Promise.all([
      this.prisma.internshipApplication.findMany({
        where: {
          student: { institutionId },
          isSelfIdentified: true,
          status: ApplicationStatus.APPLIED,
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              rollNumber: true,
            },
          },
        },
      }),
      this.prisma.internship.findMany({
        where: {
          institutionId,
          applicationDeadline: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
          },
          isActive: true,
        },
        take: 5,
        orderBy: { applicationDeadline: 'asc' },
      }),
      this.prisma.grievance.findMany({
        where: {
          student: { institutionId },
          status: 'PENDING',
        },
        take: 5,
        orderBy: { submittedDate: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              rollNumber: true,
            },
          },
        },
      }),
    ]);

    return {
      pendingSelfIdentified,
      upcomingDeadlines,
      pendingGrievances,
    };
  }

  /**
   * Get institution details
   */
  async getInstitution(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
      include: {
        Institution: {
          include: {
            settings: true,
            _count: {
              select: {
                users: true,
                Student: true,
                batches: true,
                internships: true,
              },
            },
          },
        },
      },
    });

    if (!principal || !principal.Institution) {
      throw new NotFoundException('Institution not found');
    }

    return principal.Institution;
  }

  /**
   * Get institution branches/departments
   */
  async getBranches(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
      select: { institutionId: true },
    });

    if (!principal?.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const branches = await this.prisma.branch.findMany({
      where: { institutionId: principal.institutionId, isActive: true },
      select: {
        id: true,
        name: true,
        shortName: true,
        code: true,
        duration: true,
      },
      orderBy: { name: 'asc' },
    });

    return branches;
  }

  /**
   * Update institution details
   */
  async updateInstitution(principalId: string, updateData: Prisma.InstitutionUpdateInput) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const updated = await this.prisma.institution.update({
      where: { id: principal.institutionId },
      data: updateData,
    });

    await this.cache.invalidateByTags([`institution:${principal.institutionId}`]);

    return updated;
  }

  /**
   * Get student progress with internship and report data
   */
  async getStudentProgress(principalId: string, query: {
    page?: number | string;
    limit?: number | string;
    search?: string;
    batchId?: string;
    branchId?: string;
    status?: string; // Internship status filter
    mentorId?: string; // Mentor filter
    joiningLetterStatus?: string; // Joining letter filter: 'uploaded', 'pending', 'all'
  }) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const { search, batchId, branchId, status, mentorId, joiningLetterStatus } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StudentWhereInput = {
      institutionId: principal.institutionId,
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { rollNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (batchId && batchId !== 'all') {
      where.batchId = batchId;
    }

    if (branchId && branchId !== 'all') {
      where.branchId = branchId;
    }

    // Filter by mentor
    if (mentorId && mentorId !== 'all') {
      if (mentorId === 'unassigned') {
        where.mentorAssignments = { none: { isActive: true } };
      } else {
        where.mentorAssignments = { some: { mentorId, isActive: true } };
      }
    }

    // Get students with their internship applications and reports
    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        include: {
          batch: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          mentorAssignments: {
            where: { isActive: true },
            include: {
              mentor: { select: { id: true, name: true } },
            },
            take: 1,
          },
          internshipApplications: {
            // Get the most recent application for each student (prioritize self-identified and active)
            orderBy: [
              { isSelfIdentified: 'desc' }, // Self-identified first
              { internshipPhase: 'desc' }, // ACTIVE > NOT_STARTED > COMPLETED
              { createdAt: 'desc' }, // Most recent first
            ],
            take: 1,
            select: {
              id: true,
              status: true,
              internshipPhase: true,
              joiningDate: true,
              completionDate: true,
              // Joining letter fields
              joiningLetterUrl: true,
              joiningLetterUploadedAt: true,
              reviewedAt: true,
              reviewRemarks: true,
              // Self-identified internship fields
              isSelfIdentified: true,
              companyName: true,
              companyAddress: true,
              companyContact: true,
              companyEmail: true,
              jobProfile: true,
              stipend: true,
              internshipDuration: true,
              startDate: true,
              endDate: true,
              // Pre-calculated expected values
              totalExpectedReports: true,
              totalExpectedVisits: true,
              facultyMentorName: true,
              facultyMentorEmail: true,
              facultyMentorContact: true,
              facultyMentorDesignation: true,
              internship: {
                select: {
                  id: true,
                  title: true,
                  startDate: true,
                  endDate: true,
                  duration: true,
                  workLocation: true,
                  stipendAmount: true,
                  industry: {
                    select: {
                      id: true,
                      companyName: true,
                      companyDescription: true,
                      industryType: true,
                      website: true,
                      primaryEmail: true,
                      primaryPhone: true,
                      address: true,
                      city: true,
                      state: true,
                    },
                  },
                },
              },
              monthlyReports: {
                select: {
                  id: true,
                  reportMonth: true,
                  reportYear: true,
                  status: true,
                  submittedAt: true,
                  reportFileUrl: true,
                },
                orderBy: [{ reportYear: 'asc' }, { reportMonth: 'asc' }],
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.student.count({ where }),
    ]);

    // Get application IDs for faculty visits query
    const applicationIds = students
      .map((s) => s.internshipApplications[0]?.id)
      .filter(Boolean) as string[];

    // Fetch faculty visits for all applications in a single query
    const facultyVisits = applicationIds.length > 0
      ? await this.prisma.facultyVisitLog.findMany({
          where: { applicationId: { in: applicationIds } },
          select: {
            applicationId: true,
            visitDate: true,
          },
          orderBy: { visitDate: 'desc' },
        })
      : [];

    // Create a map of applicationId -> { count, lastVisit }
    const facultyVisitsMap = new Map<string, { count: number; lastVisit: Date | null }>();
    for (const visit of facultyVisits) {
      const existing = facultyVisitsMap.get(visit.applicationId);
      if (!existing) {
        facultyVisitsMap.set(visit.applicationId, {
          count: 1,
          lastVisit: visit.visitDate,
        });
      } else {
        existing.count++;
        // lastVisit is already the most recent due to orderBy
      }
    }

    // Transform data for frontend
    const progressData = students.map((student) => {
      const application = student.internshipApplications[0];
      const mentor = student.mentorAssignments[0]?.mentor;
      const reports = application?.monthlyReports || [];

      /**
       * Get expected reports and visits - prefer stored values, fallback to calculation
       * Uses utility functions for accurate "as of now" calculations
       * @see COMPLIANCE_CALCULATION_ANALYSIS.md Section V (Q47-49)
       */
      let totalExpectedReports = 0;
      let totalExpectedVisits = 0;
      let expectedReportsAsOfNow = 0;
      let expectedVisitsAsOfNow = 0;

      if (application) {
        const startDate = (application as any).startDate || application.joiningDate;
        const endDate = (application as any).endDate || application.completionDate;

        // Use stored values if available
        const storedExpectedReports = (application as any).totalExpectedReports;
        const storedExpectedVisits = (application as any).totalExpectedVisits;

        if (startDate) {
          const start = new Date(startDate);
          const now = new Date();

          // Default end date: 6 months from start if not specified
          const effectiveEnd = endDate
            ? new Date(endDate)
            : new Date(start.getTime() + 180 * 24 * 60 * 60 * 1000);

          // Use stored values if available, otherwise calculate total
          totalExpectedReports = storedExpectedReports ?? getTotalExpectedCount(start, effectiveEnd);
          totalExpectedVisits = storedExpectedVisits ?? getTotalExpectedCount(start, effectiveEnd);

          // Calculate how many should be done by now using utility functions
          expectedReportsAsOfNow = getExpectedReportsAsOfToday(start, effectiveEnd);
          expectedVisitsAsOfNow = getExpectedVisitsAsOfToday(start, effectiveEnd);
        } else if (storedExpectedReports || storedExpectedVisits) {
          // Use stored values even if no startDate
          totalExpectedReports = storedExpectedReports || 0;
          totalExpectedVisits = storedExpectedVisits || 0;
        }
      }

      const submittedReports = reports.filter(
        (r) => r.status === 'SUBMITTED' || r.status === 'APPROVED',
      ).length;
      const approvedReports = reports.filter((r) => r.status === 'APPROVED').length;

      // Calculate completion percentage
      const completionPercentage = totalExpectedReports > 0
        ? Math.round((approvedReports / totalExpectedReports) * 100)
        : 0;

      // Determine internship status based on internshipPhase
      let internshipStatus = 'Not Started';
      if (application) {
        if (application.internshipPhase === 'COMPLETED') {
          internshipStatus = 'Completed';
        } else if (application.internshipPhase === 'ACTIVE') {
          // Check if delayed based on expected reports
          const expectedSubmitted = reports.filter((r) => {
            const reportDate = new Date(r.reportYear, r.reportMonth - 1);
            return reportDate <= new Date();
          }).length;
          internshipStatus = submittedReports < expectedSubmitted ? 'Delayed' : 'In Progress';
        } else if (application.status === 'JOINED') {
          internshipStatus = 'In Progress';
        } else if (application.status === 'SELECTED') {
          internshipStatus = 'In Progress';
        } else if (['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED'].includes(application.status)) {
          internshipStatus = 'Pending';
        } else if (['REJECTED', 'WITHDRAWN'].includes(application.status)) {
          internshipStatus = 'Not Started';
        }
      }

      // Build timeline
      const timeline: { children: string; color: string }[] = [];
      if (application) {
        // Check if joining letter is verified (reviewedAt exists and remarks don't contain 'reject')
        const isJoiningVerified = application.reviewedAt && !application.reviewRemarks?.toLowerCase().includes('reject');
        if (isJoiningVerified && application.joiningDate) {
          timeline.push({
            children: `Internship started - ${new Date(application.joiningDate).toLocaleDateString()}`,
            color: 'green',
          });
        }

        reports.forEach((report) => {
          const monthName = new Date(report.reportYear, report.reportMonth - 1).toLocaleString('default', { month: 'long' });
          if (report.status === 'APPROVED') {
            timeline.push({
              children: `${monthName} ${report.reportYear} report approved`,
              color: 'green',
            });
          } else if (report.status === 'SUBMITTED') {
            timeline.push({
              children: `${monthName} ${report.reportYear} report submitted`,
              color: 'blue',
            });
          } else if (report.status === 'REJECTED') {
            timeline.push({
              children: `${monthName} ${report.reportYear} report rejected`,
              color: 'red',
            });
          }
        });

        if (application.completionDate) {
          timeline.push({
            children: `Internship completed - ${new Date(application.completionDate).toLocaleDateString()}`,
            color: 'green',
          });
        }
      }

      // Get faculty visits data from the map
      const visitsData = application ? facultyVisitsMap.get(application.id) : null;

      return {
        id: student.id,
        name: student.name,
        rollNumber: student.rollNumber,
        batch: student.batch?.name || 'N/A',
        batchId: student.batchId,
        department: student.branch?.name || student.branchName || 'N/A',
        departmentId: student.branchId,
        internshipStatus,
        reportsSubmitted: submittedReports,
        totalReports: totalExpectedReports,
        expectedReportsAsOfNow,
        completionPercentage,
        mentor: mentor?.name || null,
        mentorId: mentor?.id || null,
        // Faculty visits data
        facultyVisitsCount: visitsData?.count || 0,
        totalExpectedVisits,
        expectedVisitsAsOfNow,
        lastFacultyVisit: visitsData?.lastVisit || null,
        timeline,
        application: application ? {
          id: application.id,
          status: application.status,
          internshipTitle: application.internship?.title,
          joiningDate: application.joiningDate,
          completionDate: application.completionDate,
          // Joining letter details
          joiningLetterUrl: (application as any).joiningLetterUrl,
          joiningLetterUploadedAt: (application as any).joiningLetterUploadedAt,
          hasJoiningLetter: !!(application as any).joiningLetterUrl,
          // Company/Industry details
          company: application.internship?.industry ? {
            id: application.internship.industry.id,
            name: application.internship.industry.companyName,
            description: application.internship.industry.companyDescription,
            type: application.internship.industry.industryType,
            website: application.internship.industry.website,
            logo: null,
            email: application.internship.industry.primaryEmail,
            phone: application.internship.industry.primaryPhone,
            address: application.internship.industry.address,
            city: application.internship.industry.city,
            state: application.internship.industry.state,
          } : (application as any).isSelfIdentified ? {
            name: (application as any).companyName,
            address: (application as any).companyAddress,
            contact: (application as any).companyContact,
            email: (application as any).companyEmail,
            isSelfIdentified: true,
          } : null,
          // Internship details
          workLocation: application.internship?.workLocation,
          stipendAmount: (application as any).isSelfIdentified
            ? (application as any).stipend
            : application.internship?.stipendAmount,
          duration: (application as any).isSelfIdentified
            ? (application as any).internshipDuration
            : application.internship?.duration,
          startDate: (application as any).isSelfIdentified
            ? (application as any).startDate
            : application.internship?.startDate,
          endDate: (application as any).isSelfIdentified
            ? (application as any).endDate
            : application.internship?.endDate,
          jobProfile: (application as any).jobProfile,
          isSelfIdentified: (application as any).isSelfIdentified,
          internshipPhase: (application as any).internshipPhase,
          // Faculty mentor details (for self-identified internships)
          facultyMentor: (application as any).isSelfIdentified ? {
            name: (application as any).facultyMentorName,
            email: (application as any).facultyMentorEmail,
            contact: (application as any).facultyMentorContact,
            designation: (application as any).facultyMentorDesignation,
          } : null,
        } : null,
        // Monthly reports with details
        monthlyReports: reports.map((report: any) => ({
          id: report.id,
          month: report.reportMonth,
          year: report.reportYear,
          monthName: new Date(report.reportYear, report.reportMonth - 1).toLocaleString('default', { month: 'long' }),
          status: report.status,
          submittedAt: report.submittedAt,
          summary: null,
          reportFileUrl: report.reportFileUrl,
        })),
      };
    });

    // Filter by status if provided
    let filteredData = progressData;
    if (status && status !== 'all') {
      filteredData = progressData.filter((s) => s.internshipStatus === status);
    }

    // Filter by joining letter status
    if (joiningLetterStatus && joiningLetterStatus !== 'all') {
      if (joiningLetterStatus === 'uploaded') {
        filteredData = filteredData.filter((s) => s.application?.hasJoiningLetter);
      } else if (joiningLetterStatus === 'pending') {
        // Show students with APPROVED or JOINED status who haven't uploaded joining letter
        filteredData = filteredData.filter(
          (s) => s.application && !s.application.hasJoiningLetter &&
                 (s.application.status === 'APPROVED' || s.application.status === 'JOINED')
        );
      }
    }

    // Get list of mentors for filter dropdown
    const [mentorsList, mentorAssignmentsList] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          institutionId: principal.institutionId,
          role: { in: ['FACULTY_SUPERVISOR', 'TEACHER'] },
          active: true,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: 'asc' },
      }),
      // Get all mentor assignments to count unique students per mentor
      this.prisma.mentorAssignment.findMany({
        where: {
          student: { institutionId: principal.institutionId },
          isActive: true,
        },
        select: { mentorId: true, studentId: true },
      }),
    ]);

    // Compute unique students per mentor
    const mentorStudentMap = new Map<string, Set<string>>();
    for (const { mentorId, studentId } of mentorAssignmentsList) {
      if (!mentorStudentMap.has(mentorId)) {
        mentorStudentMap.set(mentorId, new Set());
      }
      mentorStudentMap.get(mentorId)!.add(studentId);
    }

    const mentors = mentorsList.map((m) => ({
      ...m,
      assignedCount: mentorStudentMap.get(m.id)?.size || 0,
    }));

    // Calculate status counts for the entire dataset (not just current page)
    const [inProgressCount, completedCount, pendingCount] = await Promise.all([
      // In Progress: JOINED status with ACTIVE internshipPhase
      this.prisma.student.count({
        where: {
          ...where,
          internshipApplications: {
            some: {
              isSelfIdentified: true,
              status: ApplicationStatus.JOINED,
              internshipPhase: InternshipPhase.ACTIVE,
            },
          },
        },
      }),
      // Completed: COMPLETED internshipPhase
      this.prisma.student.count({
        where: {
          ...where,
          internshipApplications: {
            some: {
              isSelfIdentified: true,
              internshipPhase: InternshipPhase.COMPLETED,
            },
          },
        },
      }),
      // Pending: APPLIED, UNDER_REVIEW, SHORTLISTED status
      this.prisma.student.count({
        where: {
          ...where,
          internshipApplications: {
            some: {
              isSelfIdentified: true,
              status: { in: ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED'] },
            },
          },
        },
      }),
    ]);

    // Not started = total - (inProgress + completed + pending)
    const notStartedCount = Math.max(0, total - inProgressCount - completedCount - pendingCount);

    // Count delayed from computed progressData (accurate calculation based on report submissions)
    const delayedCount = progressData.filter((s) => s.internshipStatus === 'Delayed').length;
    // Adjust inProgress count to exclude delayed students (they overlap in DB queries)
    const adjustedInProgressCount = Math.max(0, inProgressCount - delayedCount);

    return {
      students: filteredData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      statusCounts: {
        total,
        inProgress: adjustedInProgressCount,
        completed: completedCount,
        pending: pendingCount,
        notStarted: notStartedCount,
        delayed: delayedCount,
      },
      mentors: mentors.map((m) => ({
        id: m.id,
        name: m.name,
        assignedCount: m.assignedCount,
      })),
    };
  }

  /**
   * Get students with pagination and filters
   */
  async getStudents(principalId: string, query: {
    page?: number | string;
    limit?: number | string;
    search?: string;
    batchId?: string;
    branchId?: string;
    isActive?: boolean | string; // Query params come as strings
    hasMentor?: string; // 'true', 'false', or undefined for all
    hasInternship?: string; // 'true' to filter only students with self-identified internships
  }) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Parse page and limit as numbers (query params come as strings)
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const { search, batchId, branchId, isActive, hasMentor, hasInternship } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StudentWhereInput = {
      institutionId: principal.institutionId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { rollNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (batchId) {
      where.batchId = batchId;
    }

    if (branchId) {
      where.branchId = branchId;
    }

    // Convert isActive string to boolean (query params come as strings)
    if (isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true' || isActive === true;
    }

    // Filter by mentor assignment status
    if (hasMentor === 'true') {
      where.mentorAssignments = {
        some: { isActive: true },
      };
    } else if (hasMentor === 'false') {
      where.mentorAssignments = {
        none: { isActive: true },
      };
    }

    // Filter by self-identified internship
    if (hasInternship === 'true') {
      where.internshipApplications = {
        some: { isSelfIdentified: true },
      };
    }

    // Determine if we need to include full internship data
    const includeInternships = hasInternship === 'true';

    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        include: {
          batch: true,
          branch: true,
          user: {
            select: {
              id: true,
              email: true,
              active: true,
            },
          },
          // Include self-identified internship applications when requested
          ...(includeInternships && {
            internshipApplications: {
              where: { isSelfIdentified: true },
              orderBy: { createdAt: 'desc' as const },
              take: 1,
              select: {
                id: true,
                status: true,
                internshipPhase: true,
                isSelfIdentified: true,
                companyName: true,
                companyAddress: true,
                companyContact: true,
                companyEmail: true,
                jobProfile: true,
                stipend: true,
                internshipDuration: true,
                startDate: true,
                endDate: true,
                joiningLetterUrl: true,
                joiningLetterUploadedAt: true,
                facultyMentorName: true,
                facultyMentorEmail: true,
                facultyMentorContact: true,
                facultyMentorDesignation: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            mentorAssignments: {
              where: { isActive: true },
              take: 1,
              include: {
                mentor: {
                  select: { id: true, name: true, email: true, designation: true, phoneNo: true },
                },
              },
            },
          }),
          _count: {
            select: {
              internshipApplications: true,
              monthlyReports: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.student.count({ where }),
    ]);

    // Transform response to include selfIdentifiedInternship for easier frontend access
    const transformedStudents = students.map((student: any) => {
      const mentor = student.mentorAssignments?.[0]?.mentor || null;
      return {
        ...student,
        selfIdentifiedInternship: student.internshipApplications?.[0] || null,
        mentor, // Add mentor at student level for easier access
      };
    });

    return {
      data: transformedStudents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get student by ID
   */
  async getStudentById(principalId: string, studentId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        institutionId: principal.institutionId,
      },
      include: {
        user: true,
        batch: true,
        branch: true,
        internshipApplications: {
          include: {
            internship: {
              include: {
                industry: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        mentorAssignments: {
          where: { isActive: true },
          include: {
            mentor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
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
   * Create a new student - delegates to domain UserService
   */
  async createStudent(principalId: string, createStudentDto: CreateStudentDto) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Handle branchId/departmentId (departmentId is an alias for branchId)
    const branchId = createStudentDto.branchId || createStudentDto.departmentId;
    let branchName: string | undefined;

    // Look up branch name if branchId is provided
    if (branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: branchId },
        select: { name: true },
      });
      branchName = branch?.name;
    }

    // Delegate to domain UserService for student creation
    const result = await this.userService.createStudent(principal.institutionId, {
      name: createStudentDto.name,
      email: createStudentDto.email,
      phoneNo: createStudentDto.phoneNo,
      rollNumber: createStudentDto.rollNumber,
      batchId: createStudentDto.batchId,
      branchId,
      branchName,
      dateOfBirth: createStudentDto.dateOfBirth,
      gender: createStudentDto.gender,
      address: createStudentDto.address,
      parentName: createStudentDto.parentName,
      parentContact: createStudentDto.parentPhone,
    });

    // Log student creation
    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'Student',
      entityId: result.student.id,
      userId: principalId,
      userName: principal.name,
      userRole: principal.role,
      description: `Student created: ${createStudentDto.name} (${createStudentDto.email})`,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.MEDIUM,
      institutionId: principal.institutionId,
      newValues: {
        studentId: result.student.id,
        email: createStudentDto.email,
        rollNumber: createStudentDto.rollNumber,
        batchId: createStudentDto.batchId,
      },
    }).catch(() => {}); // Non-blocking

    // TODO: Send email with temporary password to student
    // result.temporaryPassword contains the generated password

    await this.cache.invalidateByTags(['students', `institution:${principal.institutionId}`]);

    return result.student;
  }

  /**
   * Update student details
   */
  async updateStudent(principalId: string, studentId: string, updateStudentDto: UpdateStudentDto) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        institutionId: principal.institutionId,
      },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Prepare update data, handling branchId/departmentId mapping
    const updateData: any = { ...updateStudentDto };

    // Handle departmentId as alias for branchId
    if (updateData.departmentId !== undefined) {
      updateData.branchId = updateData.departmentId;
      delete updateData.departmentId;
    }

    // Look up branch name if branchId is being updated
    if (updateData.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: updateData.branchId },
        select: { name: true },
      });
      if (branch) {
        updateData.branchName = branch.name;
      }
    }

    // Handle parentPhone -> parentContact mapping
    if (updateData.parentPhone !== undefined) {
      updateData.parentContact = updateData.parentPhone;
      delete updateData.parentPhone;
    }

    // Handle phoneNo -> contact mapping for student model
    if (updateData.phoneNo !== undefined) {
      updateData.contact = updateData.phoneNo;
      delete updateData.phoneNo;
    }

    // Handle dateOfBirth -> dob mapping for student model
    if (updateData.dateOfBirth !== undefined) {
      updateData.dob = updateData.dateOfBirth;
      delete updateData.dateOfBirth;
    }

    // Remove fields not in Prisma schema
    delete updateData.bloodGroup;
    delete updateData.semesterId; // Not used, semester is managed through batch
    delete updateData.gender; // Gender is not directly on student model

    // Build user update data for synced fields
    const userUpdateData: any = {};
    if (updateData.name) userUpdateData.name = updateData.name;
    if (updateData.email) userUpdateData.email = updateData.email;
    if (updateData.contact) userUpdateData.phoneNo = updateData.contact; // Student.contact -> User.phoneNo
    if (typeof updateData.isActive === 'boolean') userUpdateData.active = updateData.isActive;

    // Always use transaction to keep Student and User in sync
    if (student.userId && Object.keys(userUpdateData).length > 0) {
      const [updatedStudent] = await this.prisma.$transaction([
        this.prisma.student.update({
          where: { id: studentId },
          data: updateData,
          include: {
            user: true,
            batch: true,
            branch: true,
          },
        }),
        this.prisma.user.update({
          where: { id: student.userId },
          data: userUpdateData,
        }),
      ]);

      await this.cache.invalidateByTags(['students', `student:${studentId}`, `user:${student.userId}`]);

      return updatedStudent;
    }

    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data: updateData,
      include: {
        user: true,
        batch: true,
        branch: true,
      },
    });

    await this.cache.invalidateByTags(['students', `student:${studentId}`]);

    return updated;
  }

  /**
   * Delete student (soft delete - deactivates user and student profile)
   */
  async deleteStudent(principalId: string, studentId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Find student and verify they belong to this institution
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });

    if (!student || student.institutionId !== principal.institutionId) {
      throw new NotFoundException('Student not found in your institution');
    }

    // Store info for audit before soft deletion
    const studentInfo = {
      studentId,
      userId: student.userId,
      email: student.user?.email,
      name: student.user?.name,
      rollNumber: student.rollNumber,
      wasActive: student.isActive,
    };

    // Soft delete - deactivate student and user, deactivate related assignments
    await this.prisma.$transaction([
      // Deactivate mentor assignments (preserve historical data)
      this.prisma.mentorAssignment.updateMany({
        where: { studentId, isActive: true },
        data: { isActive: false, deactivatedAt: new Date() },
      }),
      // Deactivate the student record
      this.prisma.student.update({
        where: { id: studentId },
        data: { isActive: false },
      }),
      // Deactivate the user account
      this.prisma.user.update({
        where: { id: student.userId },
        data: { active: false },
      }),
    ]);

    // Log student soft deletion
    this.auditService.log({
      action: AuditAction.USER_DELETION,
      entityType: 'Student',
      entityId: studentId,
      userId: principalId,
      userName: principal.name,
      userRole: principal.role,
      description: `Student deactivated (soft delete): ${studentInfo.name} (${studentInfo.email})`,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.HIGH,
      institutionId: principal.institutionId,
      oldValues: studentInfo,
      newValues: { isActive: false, active: false },
    }).catch(() => {}); // Non-blocking

    await this.cache.invalidateByTags(['students', `student:${studentId}`]);

    return { success: true, message: 'Student deactivated successfully' };
  }

  /**
   * Parse Excel/CSV file buffer to JSON
   */
  private async parseExcelFile(file: Express.Multer.File): Promise<any[]> {
    const { workbook } = await ExcelUtils.read(file.buffer);
    return ExcelUtils.sheetToJson(workbook, 0);
  }

  /**
   * Bulk upload students from CSV/Excel
   */
  async bulkUploadStudents(principalId: string, files: Express.Multer.File[]) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('No file provided');
    }

    const file = files[0];
    const studentsData = await this.parseExcelFile(file);

    if (studentsData.length === 0) {
      throw new BadRequestException('No valid data found in file');
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    // Process in batches of 10 for better performance with error isolation
    const BATCH_SIZE = 10;
    for (let i = 0; i < studentsData.length; i += BATCH_SIZE) {
      const batch = studentsData.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map((studentData) => this.createStudent(principalId, studentData)),
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            data: batch[index],
            error: result.reason?.message || 'Unknown error',
          });
        }
      });
    }

    return results;
  }

  /**
   * Bulk upload staff from CSV/Excel
   */
  async bulkUploadStaff(principalId: string, files: Express.Multer.File[]) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('No file provided');
    }

    const file = files[0];
    const staffData = await this.parseExcelFile(file);

    if (staffData.length === 0) {
      throw new BadRequestException('No valid data found in file');
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    // Process in batches of 10 for better performance with error isolation
    const BATCH_SIZE = 10;
    for (let i = 0; i < staffData.length; i += BATCH_SIZE) {
      const batch = staffData.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map((staffMember) => this.createStaff(principalId, staffMember)),
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            data: batch[index],
            error: result.reason?.message || 'Unknown error',
          });
        }
      });
    }

    return results;
  }

  /**
   * Get staff members
   */
  async getStaff(principalId: string, query: {
    page?: number | string;
    limit?: number | string;
    search?: string;
    role?: string;
    active?: string | boolean;
  }) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Parse page and limit as numbers (query params come as strings)
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const { search, role, active } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      institutionId: principal.institutionId,
      role: { not: Role.STUDENT },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role as Role;
    }

    // Handle active filter - support both string and boolean
    if (active !== undefined && active !== '') {
      where.active = active === true || active === 'true';
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
          designation: true,
          branchName: true,
          active: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Map branchName to department for frontend compatibility
    const transformedStaff = staff.map((s: any) => ({
      ...s,
      department: s.branchName, // Alias for frontend
    }));

    return {
      data: transformedStaff,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create staff member
   */
  async createStaff(principalId: string, createStaffDto: CreateStaffDto) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createStaffDto.email },
    });

    if (existingUser) {
      throw new BadRequestException(`User with email ${createStaffDto.email} already exists`);
    }

    // Use the role directly from the DTO (already validated)
    const staffRole: Role = createStaffDto.role as Role;

    // Generate and hash secure temporary password using domain service
    const temporaryPassword = this.userService.generateSecurePassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, BCRYPT_SALT_ROUNDS);

    const staff = await this.prisma.user.create({
      data: {
        name: createStaffDto.name,
        email: createStaffDto.email,
        password: hashedPassword,
        role: staffRole,
        active: true,
        phoneNo: createStaffDto.phoneNo,
        designation: createStaffDto.designation,
        branchName: createStaffDto.branchName,
        Institution: { connect: { id: principal.institutionId } },
      },
    });

    // Log staff creation
    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'Staff',
      entityId: staff.id,
      userId: principalId,
      userName: principal.name,
      userRole: principal.role,
      description: `Staff member created: ${createStaffDto.name} (${createStaffDto.email}) as ${staffRole}`,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.MEDIUM,
      institutionId: principal.institutionId,
      newValues: {
        staffId: staff.id,
        email: createStaffDto.email,
        role: staffRole,
        designation: createStaffDto.designation,
      },
    }).catch(() => {}); // Non-blocking

    // TODO: Send email with temporary password to staff

    await this.cache.invalidateByTags(['staff', `institution:${principal.institutionId}`]);

    return staff;
  }

  /**
   * Update staff member
   */
  async updateStaff(principalId: string, staffId: string, updateData: any) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const staff = await this.prisma.user.findFirst({
      where: {
        id: staffId,
        institutionId: principal.institutionId,
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    // Prepare update data for Prisma
    const prismaData: Prisma.UserUpdateInput = { ...updateData };

    const updated = await this.prisma.user.update({
      where: { id: staffId },
      data: prismaData,
    });

    await this.cache.invalidateByTags(['staff', `user:${staffId}`]);

    return updated;
  }

  /**
   * Deactivate staff member (soft delete)
   */
  async deleteStaff(principalId: string, staffId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const staff = await this.prisma.user.findFirst({
      where: {
        id: staffId,
        institutionId: principal.institutionId,
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    // Check if already deactivated
    if (staff.active === false) {
      throw new BadRequestException('Staff member is already deactivated');
    }

    // Store info for audit
    const staffInfo = {
      staffId,
      email: staff.email,
      name: staff.name,
      role: staff.role,
      previousStatus: staff.active,
    };

    // Soft delete - deactivate user and related mentor assignments
    await this.prisma.$transaction([
      // Deactivate mentor assignments where this staff is the mentor
      this.prisma.mentorAssignment.updateMany({
        where: { mentorId: staffId, isActive: true },
        data: { isActive: false, deactivatedAt: new Date() },
      }),
      // Deactivate the user (soft delete)
      this.prisma.user.update({
        where: { id: staffId },
        data: { active: false },
      }),
    ]);

    // Log staff deactivation
    this.auditService.log({
      action: AuditAction.USER_DEACTIVATION,
      entityType: 'Staff',
      entityId: staffId,
      userId: principalId,
      userName: principal.name,
      userRole: principal.role,
      description: `Staff member deactivated: ${staffInfo.name} (${staffInfo.email})`,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.HIGH,
      institutionId: principal.institutionId,
      oldValues: staffInfo,
      newValues: { active: false },
    }).catch(() => {}); // Non-blocking

    await this.cache.invalidateByTags(['staff', `user:${staffId}`]);

    return { success: true, message: 'Staff member deactivated successfully' };
  }

  /**
   * Get faculty mentors with breakdown of internal vs external assignments
   * @param principalId - The ID of the principal
   * @returns List of mentors with assignment counts (internal vs external)
   * @throws NotFoundException if principal or institution not found
   */
  async getMentors(principalId: string) {
    try {
      // Validate input
      if (!principalId || typeof principalId !== 'string') {
        throw new BadRequestException('Invalid principal ID');
      }

      const principal = await this.prisma.user.findUnique({
        where: { id: principalId },
        select: { id: true, institutionId: true },
      });

      if (!principal || !principal.institutionId) {
        throw new NotFoundException('Principal or institution not found');
      }

      const mentors = await this.prisma.user.findMany({
        where: {
          institutionId: principal.institutionId,
          role: { in: [Role.FACULTY_SUPERVISOR, Role.TEACHER] },
          active: true,
        },
        include: {
          mentorAssignments: {
            where: { isActive: true },
            include: {
              student: {
                select: {
                  id: true,
                  institutionId: true,
                },
              },
            },
          },
        },
      });

      // Transform to include internal vs external assignment counts with null safety
      return mentors.map(mentor => {
        const assignments = mentor.mentorAssignments || [];
        const internalAssignments = assignments.filter(a =>
          a.student?.institutionId && a.student.institutionId === principal.institutionId
        );
        const externalAssignments = assignments.filter(a =>
          a.student?.institutionId && a.student.institutionId !== principal.institutionId
        );

        // Omit mentorAssignments from response for cleaner API response
        const { mentorAssignments, ...mentorWithoutAssignments } = mentor;

        return {
          ...mentorWithoutAssignments,
          _count: {
            mentorAssignments: assignments.length,
            internalAssignments: internalAssignments.length,
            externalAssignments: externalAssignments.length,
          },
        };
      });
    } catch (error) {
      // Re-throw known exceptions
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      // Log and wrap unexpected errors
      this.logger.error(`Error fetching mentors for principal ${principalId}:`, error);
      throw new InternalServerErrorException('Failed to fetch mentors');
    }
  }

  /**
   * Get mentor assignments
   */
  async getMentorAssignments(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const assignments = await this.prisma.mentorAssignment.findMany({
      where: {
        student: {
          institutionId: principal.institutionId,
        },
        isActive: true,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            rollNumber: true,
          },
        },
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
            institutionId: true,
            Institution: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: { assignmentDate: 'desc' },
    });

    // Add flag for cross-institution assignments
    return assignments.map(a => ({
      ...a,
      isCrossInstitution: a.mentor?.institutionId && a.mentor.institutionId !== principal.institutionId,
    }));
  }

  /**
   * Get external mentor assignments (our faculty mentoring students from other institutions)
   * These assignments should NOT count towards our institution's student totals
   * @param principalId - The ID of the principal
   * @returns List of external mentor assignments with student and mentor details
   * @throws NotFoundException if principal or institution not found
   */
  async getExternalMentorAssignments(principalId: string) {
    try {
      // Validate input
      if (!principalId || typeof principalId !== 'string') {
        throw new BadRequestException('Invalid principal ID');
      }

      const principal = await this.prisma.user.findUnique({
        where: { id: principalId },
        select: { id: true, institutionId: true },
      });

      if (!principal || !principal.institutionId) {
        throw new NotFoundException('Principal or institution not found');
      }

      const assignments = await this.prisma.mentorAssignment.findMany({
        where: {
          mentor: {
            institutionId: principal.institutionId,
            role: { in: [Role.FACULTY_SUPERVISOR, Role.TEACHER] },
            active: true,
          },
          student: {
            institutionId: { not: principal.institutionId },
            isActive: true,
          },
          isActive: true,
        },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              rollNumber: true,
              email: true,
              contact: true,
              branchName: true,
              currentSemester: true,
              institutionId: true,
              Institution: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  city: true,
                  state: true,
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
              designation: true,
            },
          },
        },
        orderBy: { assignmentDate: 'desc' },
        take: 1000, // Limit to prevent performance issues
      });

      // Add external flag and ensure data integrity
      return assignments.map(a => ({
        ...a,
        isExternalStudent: true, // All students in this query are external
        student: {
          ...a.student,
          Institution: a.student?.Institution || {
            id: '',
            name: 'Unknown Institution',
            code: 'N/A',
            city: '',
            state: '',
          },
        },
      }));
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error fetching external mentor assignments for principal ${principalId}:`, error);
      throw new InternalServerErrorException('Failed to fetch external mentor assignments');
    }
  }

  /**
   * Assign mentor to student
   */
  async assignMentor(principalId: string, assignMentorDto: AssignMentorDto) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    if (!assignMentorDto.studentIds || assignMentorDto.studentIds.length === 0) {
      throw new BadRequestException('studentIds is required');
    }

    // Verify students belong to institution
    const students = await this.prisma.student.findMany({
      where: {
        id: { in: assignMentorDto.studentIds },
        institutionId: principal.institutionId,
      },
      select: { id: true },
    });

    if (students.length !== assignMentorDto.studentIds.length) {
      throw new NotFoundException('One or more students not found');
    }

    // Verify mentor belongs to institution (can be FACULTY_SUPERVISOR or TEACHER)
    const mentor = await this.prisma.user.findFirst({
      where: {
        id: assignMentorDto.mentorId,
        institutionId: principal.institutionId,
        role: { in: [Role.FACULTY_SUPERVISOR, Role.TEACHER] },
      },
    });

    if (!mentor) {
      throw new NotFoundException('Mentor not found');
    }

    // Deactivate existing assignment if any
    await this.prisma.mentorAssignment.updateMany({
      where: {
        studentId: { in: assignMentorDto.studentIds },
        isActive: true,
      },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: principalId,
      },
    });

    const assignments = await this.prisma.$transaction(
      assignMentorDto.studentIds.map(studentId =>
        this.prisma.mentorAssignment.create({
          data: {
            studentId,
            mentorId: assignMentorDto.mentorId,
            assignedBy: principalId,
            academicYear: assignMentorDto.academicYear,
            semester: assignMentorDto.semester,
            assignmentReason: assignMentorDto.reason ?? assignMentorDto.notes,
            isActive: true,
          },
          include: {
            student: true,
            mentor: true,
          },
        }),
      ),
    );

    // Log mentor assignment
    this.auditService.log({
      action: AuditAction.MENTOR_ASSIGN,
      entityType: 'MentorAssignment',
      entityId: mentor.id,
      userId: principalId,
      userName: principal.name,
      userRole: principal.role,
      description: `Mentor ${mentor.name} assigned to ${assignMentorDto.studentIds.length} student(s)`,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.MEDIUM,
      institutionId: principal.institutionId,
      newValues: {
        mentorId: assignMentorDto.mentorId,
        mentorName: mentor.name,
        studentCount: assignMentorDto.studentIds.length,
        studentIds: assignMentorDto.studentIds,
        academicYear: assignMentorDto.academicYear,
        semester: assignMentorDto.semester,
      },
    }).catch(() => {}); // Non-blocking

    await this.cache.invalidateByTags([
      'mentors',
      ...assignMentorDto.studentIds.map(studentId => `student:${studentId}`),
      `institution:${principal.institutionId}`,
    ]);

    return assignments;
  }

  /**
   * Get pending/missing reports grouped by month
   * Shows which students have not submitted their reports for each month
   */
  async getPendingReportsByMonth(principalId: string, query: {
    year?: number | string;
    batchId?: string;
    branchId?: string;
  }) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;
    const targetYear = Number(query.year) || new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const currentYear = new Date().getFullYear();

    // Build where clause for students
    const studentWhere: Prisma.StudentWhereInput = {
      institutionId,
      isActive: true,
    };

    if (query.batchId && query.batchId !== 'all') {
      studentWhere.batchId = query.batchId;
    }
    if (query.branchId && query.branchId !== 'all') {
      studentWhere.branchId = query.branchId;
    }

    // Get all students with active self-identified internships (JOINED status)
    const studentsWithInternships = await this.prisma.student.findMany({
      where: {
        ...studentWhere,
        internshipApplications: {
          some: {
            isSelfIdentified: true,
            status: { in: ['JOINED', 'SELECTED', 'APPROVED'] },
          },
        },
      },
      select: {
        id: true,
        name: true,
        rollNumber: true,
        batch: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        internshipApplications: {
          where: {
            isSelfIdentified: true,
            status: { in: ['JOINED', 'SELECTED', 'APPROVED'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            joiningDate: true,
            startDate: true,
            endDate: true,
            internship: {
              select: {
                duration: true,
                startDate: true,
              },
            },
            monthlyReports: {
              where: {
                reportYear: targetYear,
              },
              select: {
                reportMonth: true,
                reportYear: true,
                status: true,
                submittedAt: true,
              },
            },
          },
        },
        mentorAssignments: {
          where: { isActive: true },
          take: 1,
          select: {
            mentor: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Get month names
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    // Build pending reports by month
    const pendingByMonth: {
      month: number;
      monthName: string;
      year: number;
      isPast: boolean;
      totalExpected: number;
      submitted: number;
      pending: number;
      students: {
        id: string;
        name: string;
        rollNumber: string;
        batch: string;
        department: string;
        mentor: string | null;
        status: 'missing' | 'pending' | 'submitted' | 'approved';
        submittedAt: Date | null;
      }[];
    }[] = [];

    // Determine which months to show (up to current month if same year, or all 12 if past year)
    const maxMonth = targetYear < currentYear ? 12 : currentMonth;

    for (let month = 1; month <= maxMonth; month++) {
      const monthData = {
        month,
        monthName: monthNames[month - 1],
        year: targetYear,
        isPast: targetYear < currentYear || month < currentMonth,
        totalExpected: 0,
        submitted: 0,
        pending: 0,
        students: [] as any[],
      };

      for (const student of studentsWithInternships) {
        const application = student.internshipApplications[0];
        if (!application) continue;

        // Check if student should have submitted a report for this month
        const joiningDate = application.joiningDate ? new Date(application.joiningDate) : null;
        const joiningMonth = joiningDate ? joiningDate.getMonth() + 1 : null;
        const joiningYear = joiningDate ? joiningDate.getFullYear() : null;

        // Skip months before joining
        if (joiningYear && joiningMonth) {
          if (targetYear < joiningYear) continue;
          if (targetYear === joiningYear && month < joiningMonth) continue;
        }

        // Calculate expected duration from dates or duration string
        let expectedMonths = 6; // Fallback for legacy data
        const appStartDate = application.startDate || application.joiningDate;
        const appEndDate = application.endDate;

        if (appStartDate && appEndDate) {
          // Calculate duration from actual dates
          const start = new Date(appStartDate);
          const end = new Date(appEndDate);
          const yearsDiff = end.getFullYear() - start.getFullYear();
          const monthsDiff = end.getMonth() - start.getMonth();
          expectedMonths = Math.max(1, yearsDiff * 12 + monthsDiff + 1);
        } else if (application.internship?.duration) {
          const match = application.internship.duration.match(/(\d+)\s*month/i);
          if (match) expectedMonths = parseInt(match[1], 10);
        }

        // Check if month is within internship duration
        if (joiningMonth && joiningYear) {
          const monthsSinceJoining = (targetYear - joiningYear) * 12 + (month - joiningMonth);
          if (monthsSinceJoining >= expectedMonths) continue;
        }

        monthData.totalExpected++;

        // Check report status for this month
        const report = application.monthlyReports.find(
          (r) => r.reportMonth === month && r.reportYear === targetYear,
        );

        const mentor = student.mentorAssignments[0]?.mentor;

        let status: 'missing' | 'pending' | 'submitted' | 'approved' = 'missing';
        if (report) {
          if (report.status === 'APPROVED') {
            status = 'approved';
            monthData.submitted++;
          } else if (report.status === 'SUBMITTED' || report.status === 'UNDER_REVIEW') {
            status = 'submitted';
            monthData.submitted++;
          } else if (report.status === 'DRAFT' || report.status === 'REVISION_REQUIRED') {
            status = 'pending';
            monthData.pending++;
          }
        } else {
          // No report exists - it's missing
          monthData.pending++;
        }

        // Only add to students list if not approved (show missing/pending/submitted for review)
        if (status !== 'approved') {
          monthData.students.push({
            id: student.id,
            name: student.name,
            rollNumber: student.rollNumber,
            batch: student.batch?.name || 'N/A',
            department: student.branch?.name || 'N/A',
            mentor: mentor?.name || null,
            status,
            submittedAt: report?.submittedAt || null,
          });
        }
      }

      // Sort students: missing first, then pending, then submitted
      monthData.students.sort((a, b) => {
        const order = { missing: 0, pending: 1, submitted: 2, approved: 3 };
        return order[a.status] - order[b.status];
      });

      pendingByMonth.push(monthData);
    }

    // Calculate summary stats
    const summary = {
      totalStudentsWithInternships: studentsWithInternships.length,
      totalExpectedReports: pendingByMonth.reduce((sum, m) => sum + m.totalExpected, 0),
      totalSubmitted: pendingByMonth.reduce((sum, m) => sum + m.submitted, 0),
      totalPending: pendingByMonth.reduce((sum, m) => sum + m.pending, 0),
      monthsWithPending: pendingByMonth.filter((m) => m.pending > 0).length,
    };

    return {
      year: targetYear,
      summary,
      months: pendingByMonth.reverse(), // Most recent month first
    };
  }

  /**
   * Get faculty visit reports with stats for principal dashboard
   * Returns data formatted for the frontend FacultyReports component
   */
  async getFacultyReportsForDashboard(principalId: string, query: {
    page?: number | string;
    limit?: number | string;
    facultyId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.FacultyVisitLogWhereInput = {
      application: {
        student: {
          institutionId,
          isActive: true,
        },
      },
    };

    if (query.facultyId) {
      where.facultyId = query.facultyId;
    }

    if (query.startDate || query.endDate) {
      where.visitDate = {};
      if (query.startDate) {
        where.visitDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.visitDate.lte = new Date(query.endDate);
      }
    }

    // Get visit logs with related data
    const [logs, total, thisMonthCount, allRatings] = await Promise.all([
      this.prisma.facultyVisitLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { visitDate: 'desc' },
        include: {
          faculty: {
            select: { id: true, name: true, email: true },
          },
          application: {
            include: {
              student: {
                select: { id: true, name: true, rollNumber: true },
              },
              internship: {
                select: { title: true },
              },
            },
          },
        },
      }),
      this.prisma.facultyVisitLog.count({ where }),
      // Count visits this month
      this.prisma.facultyVisitLog.count({
        where: {
          ...where,
          visitDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      // Get all ratings for average calculation
      this.prisma.facultyVisitLog.findMany({
        where,
        select: {
          overallSatisfactionRating: true,
          studentProgressRating: true,
        },
      }),
    ]);

    // Calculate average rating
    const ratings = allRatings
      .map((r) => r.overallSatisfactionRating || r.studentProgressRating)
      .filter((r): r is number => r !== null && r !== undefined);
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;

    // Map visit type enum to display values
    const visitTypeMap: Record<string, string> = {
      PHYSICAL: 'In-Person',
      VIRTUAL: 'Virtual',
      TELEPHONIC: 'Phone',
    };

    // Transform logs to frontend format
    const reports = logs.map((log) => {
      // Determine status based on reportSubmittedTo and followUpRequired fields
      let status = 'Pending';
      if (log.reportSubmittedTo) {
        status = log.followUpRequired ? 'Under Review' : 'Approved';
      }

      return {
        id: log.id,
        facultyId: log.faculty.id,
        facultyName: log.faculty.name,
        studentId: log.application.student.id,
        studentName: log.application.student.name,
        studentRollNumber: log.application.student.rollNumber,
        internshipTitle: log.application.internship?.title || 'N/A',
        visitDate: log.visitDate,
        visitType: visitTypeMap[log.visitType] || log.visitType,
        status,
        rating: log.overallSatisfactionRating || log.studentProgressRating || 0,
        duration: log.visitDuration || 'N/A',
        location: log.visitLocation || 'N/A',
        summary: log.observationsAboutStudent || log.studentPerformance || '',
        observations: [
          log.workEnvironment && `Work Environment: ${log.workEnvironment}`,
          log.skillsDevelopment && `Skills Development: ${log.skillsDevelopment}`,
          log.attendanceStatus && `Attendance: ${log.attendanceStatus}`,
          log.workQuality && `Work Quality: ${log.workQuality}`,
        ].filter(Boolean).join('\n') || 'No observations recorded',
        recommendations: log.recommendations || 'No recommendations',
        issuesIdentified: log.issuesIdentified,
        actionRequired: log.actionRequired,
        feedbackSharedWithStudent: log.feedbackSharedWithStudent,
      };
    });

    // Get unique faculty list for filter dropdown
    const facultyList = await this.prisma.user.findMany({
      where: {
        institutionId,
        role: { in: [Role.FACULTY_SUPERVISOR, Role.TEACHER] },
        active: true,
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return {
      reports,
      stats: {
        totalVisits: total,
        avgRating,
        visitsThisMonth: thisMonthCount,
      },
      facultyList,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Reports: Generated report files scoped to institution
   */
  async getStudentReports(principalId: string, query: { reportType?: string; page?: number | string; limit?: number | string }) {
    const principal = await this.prisma.user.findUnique({ where: { id: principalId } });
    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const { reportType } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.GeneratedReportWhereInput = {
      institutionId: principal.institutionId,
    };
    if (reportType) where.reportType = reportType;

    const [reports, total] = await Promise.all([
      this.prisma.generatedReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { generatedAt: 'desc' },
      }),
      this.prisma.generatedReport.count({ where }),
    ]);

    return { reports, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Reports: Faculty visit logs scoped to institution
   */
  async getFacultyVisitReports(principalId: string, query: { page?: number | string; limit?: number | string }) {
    const principal = await this.prisma.user.findUnique({ where: { id: principalId } });
    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.FacultyVisitLogWhereInput = {
      application: {
        student: {
          institutionId: principal.institutionId,
          isActive: true,
        },
      },
    };

    const [logs, total] = await Promise.all([
      this.prisma.facultyVisitLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { visitDate: 'desc' },
        include: {
          faculty: { select: { id: true, name: true, email: true } },
          application: { include: { student: { select: { id: true, name: true, rollNumber: true } } } },
        },
      }),
      this.prisma.facultyVisitLog.count({ where }),
    ]);

    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Reports: Monthly reports scoped to institution
   */
  async getMonthlyReports(principalId: string, query: { page?: number | string; limit?: number | string; status?: string }) {
    const principal = await this.prisma.user.findUnique({ where: { id: principalId } });
    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const { status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.MonthlyReportWhereInput = {
      student: { institutionId: principal.institutionId },
    };
    if (status) where.status = status as any;

    const [reports, total] = await Promise.all([
      this.prisma.monthlyReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          student: { select: { id: true, name: true, rollNumber: true } },
          application: { select: { id: true, internshipId: true } },
        },
      }),
      this.prisma.monthlyReport.count({ where }),
    ]);

    return { reports, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Get batches
   */
  async getBatches(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const batches = await this.prisma.batch.findMany({
      where: {
        institutionId: principal.institutionId,
      },
      include: {
        _count: {
          select: {
            students: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return batches;
  }

  /**
   * Create batch
   */
  async createBatch(principalId: string, batchData: { name: string; isActive?: boolean }) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const batch = await this.prisma.batch.create({
      data: {
        name: batchData.name,
        isActive: batchData.isActive ?? true,
        institutionId: principal.institutionId,
      },
    });

    await this.cache.invalidateByTags(['batches', `institution:${principal.institutionId}`]);

    return batch;
  }

  /**
   * Get semesters
   */
  async getSemesters(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const semesters = await this.prisma.semester.findMany({
      where: {
        institutionId: principal.institutionId,
      },
      orderBy: { number: 'asc' },
    });

    return semesters;
  }

  /**
   * Get subjects
   */
  async getSubjects(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const subjects = await this.prisma.subject.findMany({
      where: {
        institutionId: principal.institutionId,
      },
      include: {
        Branch: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return subjects;
  }

  /**
   * Get analytics data (optimized with parallel queries)
   */
  async getAnalytics(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Run all queries in parallel for better performance
    const [
      totalStudents,
      batches,
      statusCounts,
      monthlyReportCounts,
    ] = await Promise.all([
      // Total active students count
      this.prisma.student.count({
        where: { institutionId, isActive: true },
      }),

      // Batches with active student counts
      this.prisma.batch.findMany({
        where: { institutionId },
        select: {
          name: true,
          _count: { select: { students: { where: { isActive: true } } } },
        },
      }),

      // Application status counts using groupBy (self-identified only)
      this.prisma.internshipApplication.groupBy({
        by: ['status'],
        where: {
          student: { institutionId },
          isSelfIdentified: true,
        },
        _count: { status: true },
      }),

      // Monthly report counts grouped by month and status
      this.prisma.monthlyReport.groupBy({
        by: ['reportMonth', 'reportYear', 'status'],
        where: {
          student: { institutionId },
          submittedAt: { gte: sixMonthsAgo },
        },
        _count: { status: true },
      }),
    ]);

    // Process status counts
    const statusMap: Record<string, number> = {};
    let totalApplications = 0;
    let activeInternships = 0;
    let completedInternships = 0;

    statusCounts.forEach((item) => {
      const count = item._count.status;
      statusMap[item.status] = count;
      totalApplications += count;

      if (item.status === 'SELECTED' || item.status === 'JOINED') {
        activeInternships += count;
      }
      if (item.status === 'COMPLETED') {
        completedInternships += count;
      }
    });

    const completionRate = totalApplications > 0
      ? Math.round((completedInternships / totalApplications) * 100)
      : 0;

    // Active rate: percentage of students with ongoing internships
    const activeRate = totalStudents > 0
      ? Math.round((activeInternships / totalStudents) * 100)
      : 0;

    // Format students by batch
    const studentsByBatch = batches.map((batch) => ({
      batch: batch.name,
      students: batch._count.students,
    }));

    // Format internship status for charts
    const internshipStatus = Object.entries(statusMap).map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value,
    }));

    // Process monthly progress (simplified - just show totals by status)
    const monthlyProgress = this.formatMonthlyProgress(monthlyReportCounts);

    return {
      totalStudents,
      activeInternships,
      completionRate,
      activeRate,
      studentsByBatch,
      internshipStatus,
      monthlyProgress,
    };
  }

  private formatMonthlyProgress(reportCounts: { reportMonth: number; reportYear: number; status: string; _count: { status: number } }[]) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();

    // Generate last 6 months with actual data
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthName = monthNames[date.getMonth()];
      const month = date.getMonth() + 1;
      const year = date.getFullYear();

      // Get counts for this specific month
      const approved = reportCounts
        .filter(r => r.reportMonth === month && r.reportYear === year && r.status === 'APPROVED')
        .reduce((sum, r) => sum + r._count.status, 0);

      const pending = reportCounts
        .filter(r => r.reportMonth === month && r.reportYear === year && (r.status === 'PENDING' || r.status === 'SUBMITTED'))
        .reduce((sum, r) => sum + r._count.status, 0);

      result.push({
        month: monthName,
        completed: approved,
        inProgress: pending,
      });
    }

    return result;
  }


  /**
   * Get internship statistics (optimized with single groupBy query)
   */
  async getInternshipStats(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;

    // Run queries in parallel
    const [statusCounts, activeInternships] = await Promise.all([
      // Status counts
      this.prisma.internshipApplication.groupBy({
        by: ['status'],
        where: {
          student: { institutionId, isActive: true },
          isSelfIdentified: true,
        },
        _count: { status: true },
      }),
      // Active internships with company details - limited to prevent memory issues
      this.prisma.internshipApplication.findMany({
        where: {
          student: { institutionId, isActive: true },
          isSelfIdentified: true,
          status: { in: ['APPROVED', 'SELECTED', 'JOINED'] },
        },
        select: {
          companyName: true,
          companyAddress: true,
          internship: {
            select: {
              industry: {
                select: {
                  companyName: true,
                  industryType: true,
                  city: true,
                  state: true,
                },
              },
            },
          },
        },
        take: 1000, // Limit to prevent memory issues with large datasets
        orderBy: { createdAt: 'desc' }, // Most recent first
      }),
    ]);

    // Process status counts
    const counts: Record<string, number> = {
      applied: 0,
      underReview: 0,
      selected: 0,
      approved: 0,
      joined: 0,
      completed: 0,
      rejected: 0,
    };

    let total = 0;
    statusCounts.forEach((item) => {
      const count = item._count.status;
      total += count;

      switch (item.status) {
        case 'APPLIED': counts.applied = count; break;
        case 'UNDER_REVIEW': counts.underReview = count; break;
        case 'SELECTED': counts.selected = count; break;
        case 'APPROVED': counts.approved = count; break;
        case 'JOINED': counts.joined = count; break;
        case 'COMPLETED': counts.completed = count; break;
        case 'REJECTED': counts.rejected = count; break;
      }
    });

    // Process company breakdown
    const companyMap = new Map<string, { count: number; location?: string; industryType?: string }>();
    const industryMap = new Map<string, number>();

    activeInternships.forEach((app) => {
      // Get company name (self-identified uses companyName field)
      const companyName = app.companyName || app.internship?.industry?.companyName || 'Unknown';
      const industryType = app.internship?.industry?.industryType || 'Other';
      const location = app.companyAddress ||
        (app.internship?.industry?.city && app.internship?.industry?.state
          ? `${app.internship.industry.city}, ${app.internship.industry.state}`
          : undefined);

      // Company aggregation
      if (!companyMap.has(companyName)) {
        companyMap.set(companyName, { count: 0, location, industryType });
      }
      const company = companyMap.get(companyName)!;
      company.count++;

      // Industry aggregation
      industryMap.set(industryType, (industryMap.get(industryType) || 0) + 1);
    });

    // Convert to sorted arrays
    const totalUniqueCompanies = companyMap.size;
    const byCompany = Array.from(companyMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const byIndustry = Array.from(industryMap.entries())
      .map(([type, count]) => ({ type: type.replace(/_/g, ' '), count }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      ...counts,
      activeRate: total > 0 ? Math.round(((counts.approved + counts.selected + counts.joined) / total) * 100) : 0,
      completionRate: total > 0 ? Math.round((counts.completed / total) * 100) : 0,
      totalUniqueCompanies,
      byCompany,
      byIndustry,
    };
  }

  /**
   * Get placement statistics (optimized with parallel queries)
   */
  async getPlacementStats(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;

    // Run queries in parallel (self-identified internships only, active students)
    const [totalStudents, completedApplications] = await Promise.all([
      this.prisma.student.count({
        where: { institutionId, isActive: true },
      }),
      this.prisma.internshipApplication.findMany({
        where: {
          student: { institutionId, isActive: true },
          isSelfIdentified: true,
          status: 'COMPLETED',
        },
        select: {
          companyName: true, // For self-identified, use companyName instead of industry
          internship: {
            select: {
              industry: {
                select: { industryType: true },
              },
            },
          },
        },
      }),
    ]);

    // Group by industry type
    const bySector: Record<string, number> = {};
    completedApplications.forEach((app) => {
      const sector = app.internship?.industry?.industryType || 'Other';
      bySector[sector] = (bySector[sector] || 0) + 1;
    });

    const placementBySector = Object.entries(bySector).map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value,
    }));

    const placedCount = completedApplications.length;

    return {
      totalStudents,
      placedCount,
      placementRate: totalStudents > 0 ? Math.round((placedCount / totalStudents) * 100) : 0,
      placementBySector,
    };
  }

  /**
   * Get mentor assignment statistics
   */
  async getMentorStats(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;

    // Run all queries in parallel
    const [
      totalMentors,
      allAssignments,
      totalStudents,
    ] = await Promise.all([
      // Count all faculty supervisors and teachers (potential mentors)
      this.prisma.user.count({
        where: {
          institutionId,
          role: { in: [Role.FACULTY_SUPERVISOR, Role.TEACHER] },
          active: true,
        },
      }),
      // Get all active assignments to compute mentor with assignments
      // Only count assignments for active students to match totalStudents count
      this.prisma.mentorAssignment.findMany({
        where: {
          student: { institutionId, isActive: true },
          isActive: true,
        },
        select: {
          mentorId: true,
          studentId: true,
        },
      }),
      // Total students
      this.prisma.student.count({
        where: { institutionId, isActive: true },
      }),
    ]);

    // Compute unique mentors with assignments
    // Note: allAssignments includes cross-institution mentors (mentors from other institutions)
    const allMentorsWithAssignments = new Set(allAssignments.map(a => a.mentorId));

    // Get local mentors (from this institution) who have assignments
    const localMentors = await this.prisma.user.findMany({
      where: {
        institutionId,
        role: { in: [Role.FACULTY_SUPERVISOR, Role.TEACHER] },
        active: true,
      },
      select: { id: true },
    });
    const localMentorIds = new Set(localMentors.map(m => m.id));

    // Count how many of our local mentors have assignments
    const localMentorsWithAssignments = [...allMentorsWithAssignments].filter(id => localMentorIds.has(id)).length;
    // Count external mentors (from other institutions) mentoring our students
    const externalMentors = [...allMentorsWithAssignments].filter(id => !localMentorIds.has(id)).length;

    const assignedMentors = localMentorsWithAssignments;
    const unassignedMentors = totalMentors - assignedMentors;

    // Compute students with/without mentors
    const studentsWithMentors = new Set(allAssignments.map(a => a.studentId)).size;
    // Ensure non-negative (safeguard against edge cases)
    const studentsWithoutMentors = Math.max(0, totalStudents - studentsWithMentors);

    // Get mentor distribution for load balancing display
    // Count unique students per mentor (avoid counting duplicate assignment records)
    const mentorStudentMap = new Map<string, Set<string>>();
    for (const { mentorId, studentId } of allAssignments) {
      if (!mentorStudentMap.has(mentorId)) {
        mentorStudentMap.set(mentorId, new Set());
      }
      mentorStudentMap.get(mentorId)!.add(studentId);
    }

    const avgStudentsPerMentor = assignedMentors > 0
      ? Math.round((studentsWithMentors / assignedMentors) * 10) / 10
      : 0;

    // Get external assignments (our mentors mentoring students from other institutions)
    // Wrap in try-catch to handle edge cases gracefully
    let externalAssignments = [];
    let externalStudentsCount = 0;
    let ourMentorsWithExternalAssignments = 0;
    let externalInstitutions = [];

    try {
      const localMentorIdsArray = Array.from(localMentorIds);

      // Only query if we have mentors to check
      if (localMentorIdsArray.length > 0) {
        externalAssignments = await this.prisma.mentorAssignment.findMany({
          where: {
            mentorId: { in: localMentorIdsArray },
            student: {
              institutionId: { not: institutionId },
              isActive: true,
            },
            isActive: true,
          },
          include: {
            student: {
              select: {
                id: true,
                institutionId: true,
                Institution: {
                  select: { id: true, name: true, code: true },
                },
              },
            },
          },
          take: 1000, // Limit for performance
        });

        // Calculate external mentoring stats with null safety
        externalStudentsCount = new Set(
          externalAssignments
            .filter(a => a.studentId)
            .map(a => a.studentId)
        ).size;

        ourMentorsWithExternalAssignments = new Set(
          externalAssignments
            .filter(a => a.mentorId)
            .map(a => a.mentorId)
        ).size;

        // Get unique external institutions (filter out null/undefined)
        const institutionMap = new Map();
        externalAssignments.forEach(a => {
          if (a.student?.Institution?.id) {
            institutionMap.set(a.student.Institution.id, a.student.Institution);
          }
        });
        externalInstitutions = Array.from(institutionMap.values());
      }
    } catch (error) {
      // Log error but don't fail the entire request
      this.logger.warn(`Failed to fetch external assignments for institution ${institutionId}:`, error);
      // externalAssignments remains empty array, counts remain 0
    }

    return {
      mentors: {
        total: totalMentors,
        assigned: assignedMentors,
        unassigned: unassignedMentors,
        external: externalMentors, // Mentors from other institutions mentoring our students
      },
      students: {
        total: totalStudents,
        withMentor: studentsWithMentors,
        withoutMentor: studentsWithoutMentors,
      },
      avgStudentsPerMentor,
      mentorLoadDistribution: Array.from(mentorStudentMap.entries())
        .map(([mentorId, students]) => ({
          mentorId,
          studentCount: students.size,
          isExternal: !localMentorIds.has(mentorId),
        }))
        .sort((a, b) => b.studentCount - a.studentCount),
      // New: External mentoring stats (our faculty mentoring students from other institutions)
      externalMentoring: {
        ourMentorsWithExternalAssignments,
        externalStudentsCount,
        externalInstitutions: externalInstitutions.map(inst => ({
          id: inst?.id || '',
          name: inst?.name || 'Unknown Institution',
          code: inst?.code || '',
        })),
      },
    };
  }

  /**
   * Remove mentor assignment from a student
   */
  async removeMentorAssignment(principalId: string, studentId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Verify student belongs to institution
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        institutionId: principal.institutionId,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Deactivate active assignment
    const result = await this.prisma.mentorAssignment.updateMany({
      where: {
        studentId,
        isActive: true,
      },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: principalId,
        deactivationReason: 'Removed by principal',
      },
    });

    await this.cache.invalidateByTags([
      'mentors',
      `student:${studentId}`,
      `institution:${principal.institutionId}`,
    ]);

    return {
      success: true,
      message: result.count > 0 ? 'Mentor assignment removed' : 'No active assignment found',
      count: result.count,
    };
  }

  /**
   * Bulk unassign mentors from students
   */
  async bulkUnassignMentors(principalId: string, studentIds: string[]) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    if (!studentIds || studentIds.length === 0) {
      throw new BadRequestException('studentIds is required');
    }

    // Verify students belong to institution
    const students = await this.prisma.student.findMany({
      where: {
        id: { in: studentIds },
        institutionId: principal.institutionId,
      },
      select: { id: true },
    });

    if (students.length !== studentIds.length) {
      throw new NotFoundException('One or more students not found');
    }

    // Deactivate all active assignments for these students
    const result = await this.prisma.mentorAssignment.updateMany({
      where: {
        studentId: { in: studentIds },
        isActive: true,
      },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: principalId,
        deactivationReason: 'Bulk unassigned by principal',
      },
    });

    await this.cache.invalidateByTags([
      'mentors',
      ...studentIds.map(id => `student:${id}`),
      `institution:${principal.institutionId}`,
    ]);

    return {
      success: true,
      message: `Removed ${result.count} mentor assignment(s)`,
      count: result.count,
    };
  }

  /**
   * Auto-assign unassigned students to mentors evenly
   */
  async autoAssignMentors(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;

    // Get current academic year
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const academicYear = month >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

    // Get all mentors and active assignments in parallel
    const [mentors, allActiveAssignments] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          institutionId,
          role: { in: [Role.FACULTY_SUPERVISOR, Role.TEACHER] },
          active: true,
        },
        select: {
          id: true,
          name: true,
        },
      }),
      // Get all active assignments to count unique students per mentor
      this.prisma.mentorAssignment.findMany({
        where: {
          student: { institutionId },
          isActive: true,
        },
        select: { studentId: true, mentorId: true },
      }),
    ]);

    if (mentors.length === 0) {
      throw new BadRequestException('No mentors available for assignment');
    }

    // Build unique students per mentor map and track assigned students
    const mentorStudentMap = new Map<string, Set<string>>();
    const assignedStudentIds = new Set<string>();
    for (const { mentorId, studentId } of allActiveAssignments) {
      assignedStudentIds.add(studentId);
      if (!mentorStudentMap.has(mentorId)) {
        mentorStudentMap.set(mentorId, new Set());
      }
      mentorStudentMap.get(mentorId)!.add(studentId);
    }

    const unassignedStudents = await this.prisma.student.findMany({
      where: {
        institutionId,
        isActive: true,
        id: { notIn: Array.from(assignedStudentIds) },
      },
      select: { id: true },
    });

    if (unassignedStudents.length === 0) {
      return {
        success: true,
        message: 'All students already have mentors assigned',
        assignedCount: 0,
      };
    }

    // Sort mentors by current load (ascending) for even distribution
    // Using unique student count, not assignment record count
    const mentorLoads = mentors.map(m => ({
      id: m.id,
      name: m.name,
      count: mentorStudentMap.get(m.id)?.size || 0,
    })).sort((a, b) => a.count - b.count);

    // Distribute students evenly
    const assignments: { studentId: string; mentorId: string }[] = [];
    let mentorIndex = 0;

    for (const student of unassignedStudents) {
      assignments.push({
        studentId: student.id,
        mentorId: mentorLoads[mentorIndex].id,
      });

      // Update the count in our local tracking
      mentorLoads[mentorIndex].count++;

      // Re-sort to always pick the mentor with least students
      mentorLoads.sort((a, b) => a.count - b.count);
    }

    // Create all assignments in a transaction
    const createdAssignments = await this.prisma.$transaction(
      assignments.map(({ studentId, mentorId }) =>
        this.prisma.mentorAssignment.create({
          data: {
            studentId,
            mentorId,
            assignedBy: principalId,
            academicYear,
            assignmentReason: 'Auto-assigned by system',
            isActive: true,
          },
        }),
      ),
    );

    await this.cache.invalidateByTags([
      'mentors',
      ...assignments.map(a => `student:${a.studentId}`),
      `institution:${institutionId}`,
    ]);

    return {
      success: true,
      message: `Auto-assigned ${createdAssignments.length} student(s) to mentors`,
      assignedCount: createdAssignments.length,
      distribution: mentorLoads.map(m => ({
        mentorId: m.id,
        mentorName: m.name,
        studentCount: m.count,
      })),
    };
  }

  /**
   * Get faculty progress list with assigned students count
   */
  async getFacultyProgressList(principalId: string, query: any) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const { search } = query;

    const where: any = {
      institutionId: principal.institutionId,
      role: { in: ['FACULTY_SUPERVISOR', 'TEACHER'] },
      active: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [faculty, mentorAssignmentsList, visitCounts] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phoneNo: true,
        },
        orderBy: { name: 'asc' },
      }),
      // Get all mentor assignments to count unique students per mentor
      this.prisma.mentorAssignment.findMany({
        where: {
          student: { institutionId: principal.institutionId },
          isActive: true,
        },
        select: { mentorId: true, studentId: true },
      }),
      // Get visit counts per faculty
      this.prisma.facultyVisitLog.groupBy({
        by: ['facultyId'],
        where: {
          faculty: { institutionId: principal.institutionId },
        },
        _count: { id: true },
      }),
    ]);

    // Compute unique students per mentor
    const mentorStudentMap = new Map<string, Set<string>>();
    for (const { mentorId, studentId } of mentorAssignmentsList) {
      if (!mentorStudentMap.has(mentorId)) {
        mentorStudentMap.set(mentorId, new Set());
      }
      mentorStudentMap.get(mentorId)!.add(studentId);
    }

    // Build visit count map
    const visitCountMap = new Map(visitCounts.map(v => [v.facultyId, v._count.id]));

    return {
      faculty: faculty.map((f) => ({
        id: f.id,
        name: f.name,
        email: f.email,
        phone: f.phoneNo,
        employeeId: null,
        assignedCount: mentorStudentMap.get(f.id)?.size || 0,
        totalVisits: visitCountMap.get(f.id) || 0,
      })),
    };
  }

  /**
   * Get detailed faculty progress with students and visits
   */
  async getFacultyProgressDetails(principalId: string, facultyId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Get faculty details - can be from this institution OR an external mentor
    // who has students from this institution assigned to them
    const faculty = await this.prisma.user.findFirst({
      where: {
        id: facultyId,
        role: { in: ['FACULTY_SUPERVISOR', 'TEACHER'] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNo: true,
        institutionId: true,
        Institution: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!faculty) {
      throw new NotFoundException('Faculty not found');
    }

    // Check if this is an external faculty - verify they have at least one student from our institution
    const isExternalFaculty = faculty.institutionId !== principal.institutionId;
    if (isExternalFaculty) {
      const hasOurStudents = await this.prisma.mentorAssignment.findFirst({
        where: {
          mentorId: facultyId,
          isActive: true,
          student: { institutionId: principal.institutionId },
        },
      });
      if (!hasOurStudents) {
        throw new NotFoundException('Faculty not found');
      }
    }

    // Get assigned students with their internship details
    // Only show students from this institution (for cross-institution mentors, only show relevant students)
    const mentorAssignments = await this.prisma.mentorAssignment.findMany({
      where: {
        mentorId: facultyId,
        isActive: true,
        student: { institutionId: principal.institutionId },
      },
      include: {
        student: {
          include: {
            batch: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
            internshipApplications: {
              where: {
                OR: [
                  { status: { in: ['JOINED', 'COMPLETED', 'SELECTED', 'APPROVED'] } },
                  { isSelfIdentified: true },
                ],
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                status: true,
                internshipPhase: true,
                isSelfIdentified: true,
                companyName: true,
                companyAddress: true,
                companyContact: true,
                companyEmail: true,
                jobProfile: true,
                stipend: true,
                internshipDuration: true,
                startDate: true,
                endDate: true,
                internship: {
                  select: {
                    id: true,
                    title: true,
                    industry: {
                      select: { companyName: true },
                    },
                  },
                },
                facultyVisitLogs: {
                  where: { facultyId },
                  orderBy: { visitDate: 'desc' },
                  take: 1,
                  select: { visitDate: true },
                },
                _count: {
                  select: { facultyVisitLogs: { where: { facultyId } } },
                },
              },
            },
          },
        },
      },
    });

    // Get all visits by this faculty
    const visits = await this.prisma.facultyVisitLog.findMany({
      where: {
        facultyId,
        application: {
          student: {
            institutionId: principal.institutionId,
          },
        },
      },
      orderBy: { visitDate: 'desc' },
      include: {
        application: {
          include: {
            student: {
              select: { id: true, name: true, rollNumber: true },
            },
            internship: {
              select: {
                title: true,
                industry: { select: { companyName: true } },
              },
            },
          },
        },
      },
    });

    // Calculate stats
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
    const nextMonth = thisMonth === 11 ? 0 : thisMonth + 1;
    const nextMonthYear = thisMonth === 11 ? thisYear + 1 : thisYear;

    const visitsThisMonth = visits.filter((v) => {
      const vDate = new Date(v.visitDate);
      return vDate.getMonth() === thisMonth && vDate.getFullYear() === thisYear;
    }).length;

    const visitsLastMonth = visits.filter((v) => {
      const vDate = new Date(v.visitDate);
      return vDate.getMonth() === lastMonth && vDate.getFullYear() === lastMonthYear;
    }).length;

    // For scheduled visits, we count future visits
    const scheduledNextMonth = visits.filter((v) => {
      const vDate = new Date(v.visitDate);
      return vDate > now && vDate.getMonth() === nextMonth && vDate.getFullYear() === nextMonthYear;
    }).length;

    // Calculate missed visits (months with active students but no visits)
    let missedVisits = 0;
    const studentsWithActiveInternships = mentorAssignments.filter(
      (a) => a.student.internshipApplications.length > 0 &&
        a.student.internshipApplications[0].status === 'JOINED'
    );

    // Simple heuristic: if a student has been on internship for a month and no visit, it's missed
    for (const assignment of studentsWithActiveInternships) {
      const app = assignment.student.internshipApplications[0];
      const lastVisit = app.facultyVisitLogs?.[0]?.visitDate;
      if (!lastVisit) {
        missedVisits++;
      } else {
        const daysSinceVisit = Math.floor((now.getTime() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceVisit > 30) {
          missedVisits++;
        }
      }
    }

    // Build visit summary for past 6 months
    const visitSummary = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1);
      const monthVisits = visits.filter((v) => {
        const vDate = new Date(v.visitDate);
        return vDate.getMonth() === d.getMonth() && vDate.getFullYear() === d.getFullYear();
      }).length;
      visitSummary.push({
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        monthName: MONTH_NAMES[d.getMonth()],
        visits: monthVisits,
        isPast: d < now,
      });
    }

    // Transform students data
    const students = mentorAssignments.map((a) => {
      const app = a.student.internshipApplications[0];
      const isSelfIdentified = (app as any)?.isSelfIdentified;
      return {
        id: a.student.id,
        applicationId: app?.id || null,
        name: a.student.name,
        rollNumber: a.student.rollNumber,
        batch: a.student.batch?.name || 'N/A',
        department: a.student.branch?.name || 'N/A',
        internshipTitle: app?.internship?.title || null,
        companyName: isSelfIdentified
          ? (app as any)?.companyName
          : app?.internship?.industry?.companyName || null,
        jobProfile: (app as any)?.jobProfile || null,
        stipend: (app as any)?.stipend || null,
        internshipDuration: (app as any)?.internshipDuration || null,
        startDate: (app as any)?.startDate || null,
        endDate: (app as any)?.endDate || null,
        isSelfIdentified: isSelfIdentified || false,
        internshipPhase: (app as any)?.internshipPhase || null,
        totalVisits: app?._count?.facultyVisitLogs || 0,
        lastVisitDate: app?.facultyVisitLogs?.[0]?.visitDate || null,
      };
    });

    // Transform visits data
    const transformedVisits = visits.map((v) => ({
      id: v.id,
      visitDate: v.visitDate,
      visitType: v.visitType,
      visitDuration: v.visitDuration,
      visitLocation: v.visitLocation,
      studentName: v.application.student.name,
      studentRollNumber: v.application.student.rollNumber,
      companyName: v.application.internship?.industry?.companyName || 'Self-identified',
      internshipTitle: v.application.internship?.title || 'N/A',
      studentPerformance: v.studentPerformance,
      workEnvironment: v.workEnvironment,
      industrySupport: v.industrySupport,
      skillsDevelopment: v.skillsDevelopment,
      overallRating: v.studentProgressRating,
      remarks: v.recommendations,
      status: 'COMPLETED',
    }));

    return {
      faculty,
      stats: {
        totalStudents: mentorAssignments.length,
        totalVisits: visits.length,
        visitsLastMonth,
        visitsThisMonth,
        scheduledNextMonth,
        missedVisits,
      },
      students,
      visits: transformedVisits,
      visitSummary,
    };
  }

  /**
   * Get mentor coverage statistics for principal dashboard
   */
  async getMentorCoverage(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;

    // Get mentor coverage stats
    const [
      totalStudents,
      totalStudentsWithInternships,
      studentsWithMentorsData,
      mentors,
      allAssignments,
    ] = await Promise.all([
      // Total active students
      this.prisma.student.count({
        where: { institutionId, isActive: true },
      }),
      // Total active students with ongoing internships
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId, isActive: true },
          isSelfIdentified: true,
          status: ApplicationStatus.JOINED,
          internshipPhase: InternshipPhase.ACTIVE,
        },
      }),
      // Unique active students with active mentor assignments
      this.prisma.mentorAssignment.findMany({
        where: {
          student: {
            institutionId,
            isActive: true,
          },
          isActive: true,
        },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      // Get all mentors (potential mentors)
      this.prisma.user.findMany({
        where: {
          institutionId,
          role: { in: [Role.FACULTY_SUPERVISOR, Role.TEACHER] },
          active: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      }),
      // Get all active mentor assignments to compute unique students per mentor
      this.prisma.mentorAssignment.findMany({
        where: {
          student: { institutionId },
          isActive: true,
        },
        select: {
          mentorId: true,
          studentId: true,
        },
      }),
    ]);

    const studentsWithMentorsCount = studentsWithMentorsData.length;
    const studentsWithoutMentorsCount = Math.max(0, totalStudents - studentsWithMentorsCount);
    const coveragePercentage = totalStudents > 0
      ? Math.round((studentsWithMentorsCount / totalStudents) * 100)
      : 100;

    // Compute unique students per mentor (avoid counting duplicate assignment records)
    const mentorStudentMap = new Map<string, Set<string>>();
    for (const { mentorId, studentId } of allAssignments) {
      if (!mentorStudentMap.has(mentorId)) {
        mentorStudentMap.set(mentorId, new Set());
      }
      mentorStudentMap.get(mentorId)!.add(studentId);
    }

    const mentorLoadDistribution = mentors
      .map(m => ({
        mentorId: m.id,
        mentorName: m.name,
        mentorEmail: m.email,
        assignedStudents: mentorStudentMap.get(m.id)?.size || 0,
      }))
      .sort((a, b) => b.assignedStudents - a.assignedStudents);

    const avgLoadPerMentor = mentors.length > 0
      ? Math.round((studentsWithMentorsCount / mentors.length) * 10) / 10
      : 0;

    return {
      totalStudents,
      totalStudentsWithInternships,
      studentsWithMentors: studentsWithMentorsCount,
      studentsWithoutMentors: studentsWithoutMentorsCount,
      coveragePercentage,
      totalMentors: mentors.length,
      averageLoadPerMentor: avgLoadPerMentor,
      mentorLoadDistribution,
    };
  }

  /**
   * Get compliance metrics for principal dashboard with 6-month trend
   *
   * NEW FORMULA (aligned with state dashboard):
   * Compliance Score = (MentorRate + JoiningLetterRate) / 2
   * - MentorRate = studentsWithActiveMentors / activeStudents * 100
   * - JoiningLetterRate = joiningLettersUploaded / activeStudents * 100
   *
   * Visit and Report compliance are shown as separate informational metrics (not in overall score)
   */
  async getComplianceMetrics(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get current active students count for compliance calculation
    const activeStudents = await this.prisma.student.count({
      where: {
        institutionId,
        isActive: true,
      },
    });

    // Get current compliance metrics (MentorRate + JoiningLetterRate)
    const [studentsWithActiveMentors, joiningLettersUploaded] = await Promise.all([
      // Count students with active mentor assignments
      this.prisma.mentorAssignment.count({
        where: {
          student: { institutionId, isActive: true },
          isActive: true,
        },
      }),
      // Count joining letters uploaded (non-empty joiningLetterUrl)
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId, isActive: true },
          isSelfIdentified: true,
          joiningLetterUrl: { not: null, notIn: [''] },
        },
      }),
    ]);

    // Calculate compliance rates using activeStudents as denominator
    const mentorRate = activeStudents > 0
      ? Math.min((studentsWithActiveMentors / activeStudents) * 100, 100)
      : null;

    const joiningLetterRate = activeStudents > 0
      ? Math.min((joiningLettersUploaded / activeStudents) * 100, 100)
      : null;

    // Overall compliance score = (MentorRate + JoiningLetterRate) / 2
    // Returns null if activeStudents = 0
    const overallComplianceScore = activeStudents > 0
      ? Math.round(((mentorRate || 0) + (joiningLetterRate || 0)) / 2)
      : null;

    // Calculate 6-month trend data for compliance metrics
    const trendData: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1 - i, 1);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);

      // Get historical active students count (approximate using current snapshot)
      // For more accurate historical data, a snapshot table would be needed
      const [
        historicalActiveStudents,
        historicalMentorAssignments,
        historicalJoiningLetters,
        studentsWithInternships,
        facultyVisits,
        reportsSubmitted,
      ] = await Promise.all([
        // Active students (current snapshot)
        this.prisma.student.count({
          where: {
            institutionId,
            isActive: true,
          },
        }),
        // Mentor assignments (current snapshot)
        this.prisma.mentorAssignment.count({
          where: {
            student: { institutionId, isActive: true },
            isActive: true,
          },
        }),
        // Joining letters uploaded
        this.prisma.internshipApplication.count({
          where: {
            student: { institutionId, isActive: true },
            isSelfIdentified: true,
            joiningLetterUrl: { not: null, notIn: [''] },
          },
        }),
        // Students with ongoing internships (for informational visit/report metrics)
        this.prisma.internshipApplication.count({
          where: {
            student: { institutionId },
            isSelfIdentified: true,
            status: ApplicationStatus.JOINED,
            internshipPhase: InternshipPhase.ACTIVE,
            startDate: { lte: endOfMonth },
          },
        }),
        // Faculty visits for informational metrics
        this.prisma.facultyVisitLog.count({
          where: {
            application: {
              student: { institutionId },
              isSelfIdentified: true,
              status: ApplicationStatus.JOINED,
              internshipPhase: InternshipPhase.ACTIVE,
              startDate: { lte: endOfMonth },
            },
            visitDate: { gte: startOfMonth, lte: endOfMonth },
          },
        }),
        // Reports submitted for informational metrics
        this.prisma.monthlyReport.count({
          where: {
            student: { institutionId },
            reportMonth: month,
            reportYear: year,
            status: { in: ['SUBMITTED', 'APPROVED'] },
          },
        }),
      ]);

      // Calculate compliance rates for trend (MentorRate + JoiningLetterRate)
      const trendMentorRate = historicalActiveStudents > 0
        ? Math.min((historicalMentorAssignments / historicalActiveStudents) * 100, 100)
        : null;

      const trendJoiningLetterRate = historicalActiveStudents > 0
        ? Math.min((historicalJoiningLetters / historicalActiveStudents) * 100, 100)
        : null;

      // Overall compliance score for trend
      const trendOverallScore = historicalActiveStudents > 0
        ? Math.round(((trendMentorRate || 0) + (trendJoiningLetterRate || 0)) / 2)
        : null;

      // Informational metrics (not part of compliance score)
      const visitCompliance = studentsWithInternships > 0
        ? Math.round(Math.min((facultyVisits / studentsWithInternships) * 100, 100))
        : null;

      const reportCompliance = studentsWithInternships > 0
        ? Math.round(Math.min((reportsSubmitted / studentsWithInternships) * 100, 100))
        : null;

      trendData.push({
        month,
        year,
        monthName: MONTH_NAMES[month - 1],
        // New compliance metrics
        overallScore: trendOverallScore,
        mentorRate: trendMentorRate !== null ? Math.round(trendMentorRate) : null,
        joiningLetterRate: trendJoiningLetterRate !== null ? Math.round(trendJoiningLetterRate) : null,
        activeStudents: historicalActiveStudents,
        studentsWithActiveMentors: historicalMentorAssignments,
        joiningLettersUploaded: historicalJoiningLetters,
        // Informational metrics (not in compliance score)
        visitCompliance,
        reportCompliance,
        facultyVisits,
        reportsSubmitted,
        studentsWithInternships,
      });
    }

    // Current month stats
    const currentMonthData = trendData[trendData.length - 1];

    return {
      currentMonth: {
        month: currentMonth,
        year: currentYear,
        // Primary compliance metrics
        overallScore: overallComplianceScore,
        mentorRate: mentorRate !== null ? Math.round(mentorRate) : null,
        joiningLetterRate: joiningLetterRate !== null ? Math.round(joiningLetterRate) : null,
        activeStudents,
        studentsWithActiveMentors,
        joiningLettersUploaded,
        // Informational metrics (separate from compliance score)
        visitComplianceRate: currentMonthData.visitCompliance,
        reportComplianceRate: currentMonthData.reportCompliance,
        facultyVisits: currentMonthData.facultyVisits,
        reportsSubmitted: currentMonthData.reportsSubmitted,
        studentsWithInternships: currentMonthData.studentsWithInternships,
      },
      trend: trendData,
      summary: {
        averageCompliance: trendData.filter(m => m.overallScore !== null).length > 0
          ? Math.round(
              trendData.filter(m => m.overallScore !== null).reduce((sum, m) => sum + m.overallScore, 0) /
              trendData.filter(m => m.overallScore !== null).length
            )
          : null,
        bestMonth: trendData.filter(m => m.overallScore !== null).reduce(
          (best, m) => (m.overallScore || 0) > (best?.overallScore || 0) ? m : best,
          trendData.find(m => m.overallScore !== null) || null
        ),
        worstMonth: trendData.filter(m => m.overallScore !== null).reduce(
          (worst, m) => (m.overallScore || 0) < (worst?.overallScore || Infinity) ? m : worst,
          trendData.find(m => m.overallScore !== null) || null
        ),
      },
    };
  }

  /**
   * Get enhanced dashboard alerts for principal
   * Includes urgent grievances, overdue reports, missing visits, and unassigned students
   */
  async getDashboardAlertsEnhanced(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfCurrentMonth = new Date(currentYear, currentMonth - 1, 1);

    // Define where clauses for reuse in both count and findMany
    const urgentGrievancesWhere: Prisma.GrievanceWhereInput = {
      student: { institutionId },
      status: { in: [GrievanceStatus.PENDING, GrievanceStatus.UNDER_REVIEW] },
      submittedDate: { lte: sevenDaysAgo },
    };

    const overdueReportsWhere: Prisma.StudentWhereInput = {
      institutionId,
      isActive: true,
      internshipApplications: {
        some: {
          isSelfIdentified: true,
          status: ApplicationStatus.JOINED,
          internshipPhase: InternshipPhase.ACTIVE,
          startDate: { lt: startOfCurrentMonth },
        },
      },
      monthlyReports: {
        none: {
          reportMonth: currentMonth,
          reportYear: currentYear,
          status: { in: [MonthlyReportStatus.SUBMITTED, MonthlyReportStatus.APPROVED] },
        },
      },
    };

    const missingVisitsWhere: Prisma.StudentWhereInput = {
      institutionId,
      isActive: true,
      internshipApplications: {
        some: {
          isSelfIdentified: true,
          status: ApplicationStatus.JOINED,
          internshipPhase: InternshipPhase.ACTIVE,
          startDate: { lte: thirtyDaysAgo },
          facultyVisitLogs: {
            none: {
              visitDate: { gte: thirtyDaysAgo },
            },
          },
        },
      },
    };

    const unassignedStudentsWhere: Prisma.StudentWhereInput = {
      institutionId,
      isActive: true,
      internshipApplications: {
        some: {
          isSelfIdentified: true,
          status: ApplicationStatus.JOINED,
          internshipPhase: InternshipPhase.ACTIVE,
        },
      },
      mentorAssignments: {
        none: { isActive: true },
      },
    };

    // Run counts and findMany in parallel
    const [
      urgentGrievancesCount,
      overdueReportsCount,
      missingVisitsCount,
      unassignedStudentsCount,
      urgentGrievances,
      overdueReports,
      missingVisits,
      unassignedStudents,
      studentsWithSelfIdentified,
    ] = await Promise.all([
      // Actual counts (not limited)
      this.prisma.grievance.count({ where: urgentGrievancesWhere }),
      this.prisma.student.count({ where: overdueReportsWhere }),
      this.prisma.student.count({ where: missingVisitsWhere }),
      this.prisma.student.count({ where: unassignedStudentsWhere }),

      // Details (limited to 50 for display in modal tables)
      this.prisma.grievance.findMany({
        where: urgentGrievancesWhere,
        include: {
          student: {
            select: { id: true, name: true, rollNumber: true },
          },
        },
        orderBy: { submittedDate: 'asc' },
        take: 50,
      }),

      this.prisma.student.findMany({
        where: overdueReportsWhere,
        select: {
          id: true,
          name: true,
          rollNumber: true,
          mentorAssignments: {
            where: { isActive: true },
            take: 1,
            select: {
              mentor: { select: { id: true, name: true } },
            },
          },
        },
        take: 50,
      }),

      this.prisma.student.findMany({
        where: missingVisitsWhere,
        select: {
          id: true,
          name: true,
          rollNumber: true,
          internshipApplications: {
            where: {
              isSelfIdentified: true,
              status: ApplicationStatus.JOINED,
              internshipPhase: InternshipPhase.ACTIVE
            },
            take: 1,
            select: {
              facultyVisitLogs: {
                orderBy: { visitDate: 'desc' },
                take: 1,
                select: { visitDate: true },
              },
            },
          },
        },
        take: 50,
      }),

      this.prisma.student.findMany({
        where: unassignedStudentsWhere,
        select: {
          id: true,
          name: true,
          rollNumber: true,
          batch: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
        take: 50,
      }),

      // Fetch students with self-identified internships to filter pending joining letters using JavaScript
      // This avoids MongoDB count query issues with null/undefined/empty string handling
      this.prisma.student.findMany({
        where: {
          institutionId,
          isActive: true,
          internshipApplications: {
            some: { isSelfIdentified: true },
          },
        },
        select: {
          id: true,
          name: true,
          rollNumber: true,
          branch: { select: { id: true, name: true } },
          mentorAssignments: {
            where: { isActive: true },
            take: 1,
            select: {
              mentor: { select: { id: true, name: true } },
            },
          },
          internshipApplications: {
            where: { isSelfIdentified: true },
            take: 1,
            select: {
              joiningLetterUrl: true,
              companyName: true,
              startDate: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    // Filter pending joining letters using JavaScript for reliable null/undefined handling
    const pendingJoiningLetters = studentsWithSelfIdentified.filter(s => {
      const app = s.internshipApplications[0];
      return app && (!app.joiningLetterUrl || app.joiningLetterUrl === '');
    }).slice(0, 50); // Limit to 50 for modal display

    const pendingJoiningLettersCount = studentsWithSelfIdentified.filter(s => {
      const app = s.internshipApplications[0];
      return app && (!app.joiningLetterUrl || app.joiningLetterUrl === '');
    }).length;

    return {
      summary: {
        urgentGrievancesCount,
        overdueReportsCount,
        missingVisitsCount,
        unassignedStudentsCount,
        pendingJoiningLettersCount,
        totalAlerts: urgentGrievancesCount + overdueReportsCount + missingVisitsCount + unassignedStudentsCount + pendingJoiningLettersCount,
      },
      alerts: {
        urgentGrievances: urgentGrievances.map(g => ({
          grievanceId: g.id,
          title: g.title,
          status: g.status,
          submittedDate: g.submittedDate,
          studentId: g.student.id,
          studentName: g.student.name,
          rollNumber: g.student.rollNumber,
          daysPending: Math.floor((now.getTime() - new Date(g.submittedDate).getTime()) / (1000 * 60 * 60 * 24)),
          priority: 'urgent',
        })),
        overdueReports: overdueReports.map(s => ({
          studentId: s.id,
          studentName: s.name,
          rollNumber: s.rollNumber,
          mentorName: s.mentorAssignments[0]?.mentor?.name || null,
          daysOverdue: now.getDate() - 5,
          priority: 'high',
        })),
        missingVisits: missingVisits.map(s => ({
          studentId: s.id,
          studentName: s.name,
          rollNumber: s.rollNumber,
          lastVisitDate: s.internshipApplications[0]?.facultyVisitLogs[0]?.visitDate || null,
          daysSinceLastVisit: s.internshipApplications[0]?.facultyVisitLogs[0]?.visitDate
            ? Math.floor((now.getTime() - new Date(s.internshipApplications[0].facultyVisitLogs[0].visitDate).getTime()) / (1000 * 60 * 60 * 24))
            : null,
        })),
        unassignedStudents: unassignedStudents.map(s => ({
          studentId: s.id,
          studentName: s.name,
          rollNumber: s.rollNumber,
          batchName: s.batch?.name || null,
          branchName: s.branch?.name || null,
        })),
        pendingJoiningLetters: pendingJoiningLetters.map(s => ({
          studentId: s.id,
          studentName: s.name,
          rollNumber: s.rollNumber,
          branchName: s.branch?.name || null,
          mentorId: s.mentorAssignments[0]?.mentor?.id || null,
          mentorName: s.mentorAssignments[0]?.mentor?.name || null,
          companyName: s.internshipApplications[0]?.companyName || null,
          startDate: s.internshipApplications[0]?.startDate || null,
        })),
      },
    };
  }

  /**
   * Get joining letter statistics for the institution
   */
  async getJoiningLetterStats(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal?.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    const institutionId = principal.institutionId;
    const cacheKey = `principal:joining-letters:stats:${institutionId}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // Fetch all applications and calculate counts using JavaScript
        // This avoids MongoDB count query issues with null/undefined/empty string handling
        const applications = await this.prisma.internshipApplication.findMany({
          where: { isSelfIdentified: true, student: { institutionId, isActive: true } },
          select: {
            joiningLetterUrl: true,
            reviewedAt: true,
            reviewRemarks: true,
          },
        });

        // Calculate counts using JavaScript for reliable null/undefined handling
        let noLetter = 0;
        let pendingReview = 0;
        let verified = 0;
        let rejected = 0;

        for (const app of applications) {
          const hasNoLetter = !app.joiningLetterUrl || app.joiningLetterUrl === '';
          if (hasNoLetter) {
            noLetter++;
          } else if (app.reviewedAt && !app.reviewRemarks?.toLowerCase().includes('reject')) {
            verified++;
          } else if (app.reviewedAt && app.reviewRemarks?.toLowerCase().includes('reject')) {
            rejected++;
          } else {
            pendingReview++;
          }
        }

        const total = applications.length;
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
        };
      },
      { ttl: 5 * 60 * 1000 }, // 5 minute cache
    );
  }

  /**
   * Get list of joining letters for the institution
   */
  async getJoiningLetters(principalId: string, query: {
    status?: 'all' | 'pending' | 'verified' | 'rejected' | 'noLetter';
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal?.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    const institutionId = principal.institutionId;
    const { status = 'all', page = 1, limit = 20, search } = query;

    // Build where clause
    const where: any = {
      isSelfIdentified: true,
      student: { institutionId },
    };

    // Apply status filter (handle both null and empty string for joiningLetterUrl)
    if (status === 'pending') {
      where.joiningLetterUrl = { not: null, notIn: [''] };
      where.reviewedAt = null;
    } else if (status === 'verified') {
      where.joiningLetterUrl = { not: null, notIn: [''] };
      where.reviewedAt = { not: null };
      where.reviewRemarks = { not: { contains: 'reject', mode: 'insensitive' } };
    } else if (status === 'rejected') {
      where.joiningLetterUrl = { not: null, notIn: [''] };
      where.reviewedAt = { not: null };
      where.reviewRemarks = { contains: 'reject', mode: 'insensitive' };
    } else if (status === 'noLetter') {
      // Use AND to combine with potential search OR clause
      where.AND = [
        {
          OR: [
            { joiningLetterUrl: { isSet: false } }, // Field doesn't exist
            { joiningLetterUrl: null },
            { joiningLetterUrl: '' },
          ],
        },
      ];
    }

    // Apply search filter
    if (search) {
      const searchCondition = {
        OR: [
          { student: { name: { contains: search, mode: 'insensitive' } } },
          { student: { rollNumber: { contains: search, mode: 'insensitive' } } },
          { companyName: { contains: search, mode: 'insensitive' } },
        ],
      };
      if (where.AND) {
        where.AND.push(searchCondition);
      } else {
        where.AND = [searchCondition];
      }
    }

    const [total, applications] = await Promise.all([
      this.prisma.internshipApplication.count({ where }),
      this.prisma.internshipApplication.findMany({
        where,
        select: {
          id: true,
          joiningLetterUrl: true,
          joiningLetterUploadedAt: true,
          joiningDate: true,
          reviewedAt: true,
          reviewRemarks: true,
          companyName: true,
          companyEmail: true,
          jobProfile: true,
          startDate: true,
          student: {
            select: {
              id: true,
              name: true,
              rollNumber: true,
              email: true,
              batch: { select: { name: true } },
              branch: { select: { name: true } },
            },
          },
        },
        orderBy: [
          { joiningLetterUploadedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Determine status for each application
    const joiningLetters = applications.map(app => {
      let letterStatus: 'NO_LETTER' | 'PENDING' | 'VERIFIED' | 'REJECTED';

      if (!app.joiningLetterUrl) {
        letterStatus = 'NO_LETTER';
      } else if (app.reviewedAt && !app.reviewRemarks?.toLowerCase().includes('reject')) {
        letterStatus = 'VERIFIED';
      } else if (app.reviewedAt && app.reviewRemarks?.toLowerCase().includes('reject')) {
        letterStatus = 'REJECTED';
      } else {
        letterStatus = 'PENDING';
      }

      return {
        applicationId: app.id,
        status: letterStatus,
        letterUrl: app.joiningLetterUrl,
        uploadedAt: app.joiningLetterUploadedAt,
        joiningDate: app.joiningDate,
        reviewedAt: app.reviewedAt,
        remarks: app.reviewRemarks,
        companyName: app.companyName,
        companyEmail: app.companyEmail,
        jobProfile: app.jobProfile,
        startDate: app.startDate,
        // Flattened student fields for frontend
        studentId: app.student.id,
        studentName: app.student.name,
        studentRollNumber: app.student.rollNumber,
        studentEmail: app.student.email,
        studentBatch: app.student.batch?.name,
        studentBranch: app.student.branch?.name,
      };
    });

    return {
      data: joiningLetters,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Verify a joining letter
   */
  async verifyJoiningLetter(
    principalId: string,
    applicationId: string,
    data: { joiningDate?: Date; remarks?: string }
  ) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal?.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    // Verify the application belongs to this institution
    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: applicationId,
        isSelfIdentified: true,
        student: { institutionId: principal.institutionId },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found or not from your institution');
    }

    if (!application.joiningLetterUrl) {
      throw new BadRequestException('No joining letter uploaded for this application');
    }

    // Update the application
    const updated = await this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: {
        joiningDate: data.joiningDate || new Date(),
        reviewedAt: new Date(),
        reviewRemarks: data.remarks || 'Verified by Principal',
      },
      include: {
        student: {
          select: { name: true, rollNumber: true },
        },
      },
    });

    // Clear cache
    this.cache.delete(`principal:joining-letters:stats:${principal.institutionId}`);

    return {
      success: true,
      message: 'Joining letter verified successfully',
      data: {
        applicationId: updated.id,
        studentName: updated.student.name,
        rollNumber: updated.student.rollNumber,
        verifiedAt: updated.reviewedAt,
      },
    };
  }

  /**
   * Reject a joining letter
   */
  async rejectJoiningLetter(
    principalId: string,
    applicationId: string,
    data: { remarks: string }
  ) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal?.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    if (!data.remarks) {
      throw new BadRequestException('Rejection remarks are required');
    }

    // Verify the application belongs to this institution
    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: applicationId,
        isSelfIdentified: true,
        student: { institutionId: principal.institutionId },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found or not from your institution');
    }

    if (!application.joiningLetterUrl) {
      throw new BadRequestException('No joining letter uploaded for this application');
    }

    // Update the application (reject by setting reviewedAt with rejection remarks)
    const updated = await this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: {
        reviewedAt: new Date(),
        reviewRemarks: data.remarks,
        // Clear the joining letter so student can re-upload
        joiningLetterUrl: null,
        joiningLetterUploadedAt: null,
      },
      include: {
        student: {
          select: { name: true, rollNumber: true },
        },
      },
    });

    // Clear cache
    this.cache.delete(`principal:joining-letters:stats:${principal.institutionId}`);

    return {
      success: true,
      message: 'Joining letter rejected',
      data: {
        applicationId: updated.id,
        studentName: updated.student.name,
        rollNumber: updated.student.rollNumber,
        rejectedAt: updated.reviewedAt,
        remarks: updated.reviewRemarks,
      },
    };
  }

  /**
   * Get recent joining letter activity
   */
  async getJoiningLetterActivity(principalId: string, limit: number = 10) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal?.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    const institutionId = principal.institutionId;

    const recentActivity = await this.prisma.internshipApplication.findMany({
      where: {
        isSelfIdentified: true,
        student: { institutionId },
        reviewedAt: { not: null },
      },
      select: {
        id: true,
        reviewedAt: true,
        reviewRemarks: true,
        companyName: true,
        student: {
          select: {
            name: true,
            rollNumber: true,
          },
        },
      },
      orderBy: { reviewedAt: 'desc' },
      take: limit,
    });

    return recentActivity.map(a => ({
      applicationId: a.id,
      action: (a.reviewRemarks && a.reviewRemarks.toLowerCase().includes('reject')) ? 'REJECTED' : 'VERIFIED',
      studentName: a.student.name,
      rollNumber: a.student.rollNumber,
      companyName: a.companyName,
      timestamp: a.reviewedAt,
      remarks: a.reviewRemarks,
    }));
  }

  /**
   * Update internship application details (Principal can edit all self-identified internship fields)
   */
  async updateInternship(
    principalId: string,
    applicationId: string,
    data: {
      companyName?: string;
      companyAddress?: string;
      companyContact?: string;
      companyEmail?: string;
      jobProfile?: string;
      stipend?: number;
      internshipDuration?: string;
      startDate?: Date;
      endDate?: Date;
      facultyMentorName?: string;
      facultyMentorContact?: string;
      facultyMentorEmail?: string;
      facultyMentorDesignation?: string;
      status?: string;
    }
  ) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal?.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    // Verify the application belongs to this institution
    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: applicationId,
        isSelfIdentified: true,
        student: { institutionId: principal.institutionId },
      },
      include: {
        student: { select: { id: true, name: true, rollNumber: true } },
      },
    });

    if (!application) {
      throw new NotFoundException('Internship application not found or not from your institution');
    }

    // Build update data
    const updateData: any = {};
    if (data.companyName !== undefined) updateData.companyName = data.companyName;
    if (data.companyAddress !== undefined) updateData.companyAddress = data.companyAddress;
    if (data.companyContact !== undefined) updateData.companyContact = data.companyContact;
    if (data.companyEmail !== undefined) updateData.companyEmail = data.companyEmail;
    if (data.jobProfile !== undefined) updateData.jobProfile = data.jobProfile;
    if (data.stipend !== undefined) updateData.stipend = data.stipend !== null ? String(data.stipend) : null;
    if (data.internshipDuration !== undefined) updateData.internshipDuration = data.internshipDuration;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
    if (data.facultyMentorName !== undefined) updateData.facultyMentorName = data.facultyMentorName;
    if (data.facultyMentorContact !== undefined) updateData.facultyMentorContact = data.facultyMentorContact;
    if (data.facultyMentorEmail !== undefined) updateData.facultyMentorEmail = data.facultyMentorEmail;
    if (data.facultyMentorDesignation !== undefined) updateData.facultyMentorDesignation = data.facultyMentorDesignation;
    if (data.status !== undefined) updateData.status = data.status;

    // Update the application
    const updated = await this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: updateData,
      include: {
        student: {
          select: { id: true, name: true, rollNumber: true },
        },
      },
    });

    // Clear related caches
    await this.cache.invalidateByTags([
      `institution:${principal.institutionId}`,
      'internships',
      `student:${application.student.id}`,
    ]);

    return {
      success: true,
      message: 'Internship updated successfully',
      data: updated,
    };
  }

  /**
   * Bulk update internship statuses
   */
  async bulkUpdateInternshipStatus(
    principalId: string,
    data: { applicationIds: string[]; status: string; remarks?: string }
  ) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal?.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    if (!data.applicationIds || data.applicationIds.length === 0) {
      throw new BadRequestException('applicationIds is required');
    }

    // Verify all applications belong to this institution
    const applications = await this.prisma.internshipApplication.findMany({
      where: {
        id: { in: data.applicationIds },
        isSelfIdentified: true,
        student: { institutionId: principal.institutionId },
      },
      select: { id: true, student: { select: { id: true } } },
    });

    if (applications.length !== data.applicationIds.length) {
      throw new NotFoundException('One or more applications not found or not from your institution');
    }

    // Update all applications
    const result = await this.prisma.internshipApplication.updateMany({
      where: { id: { in: data.applicationIds } },
      data: {
        status: data.status as ApplicationStatus,
        reviewRemarks: data.remarks || `Status updated to ${data.status} by Principal`,
        reviewedAt: new Date(),
      },
    });

    // Clear caches
    await this.cache.invalidateByTags([
      `institution:${principal.institutionId}`,
      'internships',
      ...applications.map(a => `student:${a.student.id}`),
    ]);

    return {
      success: true,
      message: `Updated ${result.count} internship(s)`,
      count: result.count,
    };
  }

  /**
   * Get single internship details for editing
   */
  async getInternshipById(principalId: string, applicationId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal?.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: applicationId,
        isSelfIdentified: true,
        student: { institutionId: principal.institutionId },
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            rollNumber: true,
            email: true,
            contact: true,
            batch: { select: { name: true } },
            branch: { select: { name: true } },
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Internship application not found');
    }

    return application;
  }
}
