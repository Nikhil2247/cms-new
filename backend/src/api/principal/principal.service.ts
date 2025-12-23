import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { LruCacheService } from '../../core/cache/lru-cache.service';
import { Prisma, ApplicationStatus, Role } from '@prisma/client';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { AssignMentorDto } from './dto/assign-mentor.dto';
import { UserService } from '../../domain/user/user.service';
import * as bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';

// Static month names array - toLocaleString is unreliable in Node.js
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Injectable()
export class PrincipalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly userService: UserService,
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
        // Only count self-identified internships (not placement-based)
        const [
          totalStudents,
          activeStudents,
          totalStaff,
          activeStaff,
          totalSelfIdentifiedInternships,
          approvedSelfIdentifiedInternships,
          pendingApprovals,
          totalBatches,
          pendingMonthlyReports,
          pendingGrievances,
        ] = await Promise.all([
          this.prisma.student.count({ where: { institutionId } }),
          this.prisma.student.count({ where: { institutionId, isActive: true } }),
          this.prisma.user.count({ where: { institutionId, role: { not: Role.STUDENT } } }),
          this.prisma.user.count({
            where: { institutionId, role: { not: Role.STUDENT }, active: true }
          }),
          // Count self-identified internships only
          this.prisma.internshipApplication.count({
            where: { student: { institutionId }, isSelfIdentified: true }
          }),
          this.prisma.internshipApplication.count({
            where: {
              student: { institutionId },
              isSelfIdentified: true,
              status: ApplicationStatus.APPROVED,
            }
          }),
          // Pending approvals - self-identified with APPLIED status (should be 0 with auto-approval)
          this.prisma.internshipApplication.count({
            where: {
              student: { institutionId },
              isSelfIdentified: true,
              status: ApplicationStatus.APPLIED,
            }
          }),
          this.prisma.batch.count({ where: { institutionId, isActive: true } }),
          this.prisma.monthlyReport.count({
            where: {
              student: { institutionId },
              status: 'SUBMITTED',
            }
          }),
          this.prisma.grievance.count({
            where: {
              student: { institutionId },
              status: { in: ['PENDING', 'UNDER_REVIEW'] },
            }
          }),
        ]);

        // Approval rate for self-identified internships
        const approvalRate = totalSelfIdentifiedInternships > 0
          ? Number(((approvedSelfIdentifiedInternships / totalSelfIdentifiedInternships) * 100).toFixed(2))
          : 0;

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
          // Self-identified internships only (no placement-based)
          internships: {
            totalApplications: totalSelfIdentifiedInternships,
            approvedApplications: approvedSelfIdentifiedInternships,
            approvalRate,
          },
          pending: {
            selfIdentifiedApprovals: pendingApprovals,
            monthlyReports: pendingMonthlyReports,
            grievances: pendingGrievances,
          },
          batches: totalBatches,
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
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              joiningDate: true,
              completionDate: true,
              hasJoined: true,
              // Joining letter fields
              joiningLetterUrl: true,
              joiningLetterUploadedAt: true,
              // Self-identified internship fields
              isSelfIdentified: true,
              companyName: true,
              companyAddress: true,
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

    // Transform data for frontend
    const progressData = students.map((student) => {
      const application = student.internshipApplications[0];
      const mentor = student.mentorAssignments[0]?.mentor;
      const reports = application?.monthlyReports || [];

      // Calculate expected reports based on internship duration
      let totalExpectedReports = 6; // Default
      if (application?.internship) {
        const duration = application.internship.duration || '';
        const monthsMatch = duration.match(/(\d+)\s*month/i);
        if (monthsMatch) {
          totalExpectedReports = parseInt(monthsMatch[1], 10);
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

      // Determine internship status
      let internshipStatus = 'Not Started';
      if (application) {
        switch (application.status) {
          case 'COMPLETED':
            internshipStatus = 'Completed';
            break;
          case 'JOINED':
            // Check if delayed based on reports
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();
            const expectedSubmitted = reports.filter((r) => {
              const reportDate = new Date(r.reportYear, r.reportMonth - 1);
              return reportDate <= new Date();
            }).length;
            internshipStatus = submittedReports < expectedSubmitted ? 'Delayed' : 'In Progress';
            break;
          case 'SELECTED':
            internshipStatus = 'In Progress';
            break;
          case 'APPLIED':
          case 'UNDER_REVIEW':
          case 'SHORTLISTED':
            internshipStatus = 'Pending';
            break;
          case 'REJECTED':
          case 'WITHDRAWN':
            internshipStatus = 'Not Started';
            break;
          default:
            internshipStatus = 'Not Started';
        }
      }

      // Build timeline
      const timeline: { children: string; color: string }[] = [];
      if (application) {
        if (application.hasJoined && application.joiningDate) {
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
        completionPercentage,
        mentor: mentor?.name || null,
        mentorId: mentor?.id || null,
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
            isSelfIdentified: true,
          } : null,
          // Internship details
          workLocation: application.internship?.workLocation,
          stipendAmount: application.internship?.stipendAmount,
          duration: application.internship?.duration,
          startDate: application.internship?.startDate,
          endDate: application.internship?.endDate,
          isSelfIdentified: (application as any).isSelfIdentified,
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
        filteredData = filteredData.filter(
          (s) => s.application && !s.application.hasJoiningLetter && s.application.status === 'JOINED'
        );
      }
    }

    // Get list of mentors for filter dropdown
    const mentors = await this.prisma.user.findMany({
      where: {
        institutionId: principal.institutionId,
        role: { in: ['FACULTY_SUPERVISOR', 'TEACHER'] },
        active: true,
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            mentorAssignments: { where: { isActive: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      students: filteredData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      mentors: mentors.map((m) => ({
        id: m.id,
        name: m.name,
        assignedCount: m._count.mentorAssignments,
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
    isActive?: boolean;
    hasMentor?: string; // 'true', 'false', or undefined for all
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
    const { search, batchId, branchId, isActive, hasMentor } = query;
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

    if (isActive !== undefined) {
      where.isActive = isActive;
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

    return {
      data: students,
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

    // Delegate to domain UserService for student creation
    const result = await this.userService.createStudent(principal.institutionId, {
      name: createStudentDto.name,
      email: createStudentDto.email,
      phone: createStudentDto.phone,
      enrollmentNumber: createStudentDto.enrollmentNumber,
      batchId: createStudentDto.batchId,
      dateOfBirth: createStudentDto.dateOfBirth,
      gender: createStudentDto.gender,
      address: createStudentDto.address,
    });

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
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data: updateStudentDto,
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

    // Soft delete - deactivate both student profile and user account
    await this.prisma.$transaction([
      this.prisma.student.update({
        where: { id: studentId },
        data: { isActive: false },
      }),
      this.prisma.user.update({
        where: { id: student.userId },
        data: { active: false },
      }),
    ]);

    await this.cache.invalidateByTags(['students', `student:${studentId}`]);

    return { success: true, message: 'Student deleted successfully' };
  }

  /**
   * Parse Excel/CSV file buffer to JSON
   */
  private parseExcelFile(file: Express.Multer.File): any[] {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json(worksheet);
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
    const studentsData = this.parseExcelFile(file);

    if (studentsData.length === 0) {
      throw new BadRequestException('No valid data found in file');
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    for (const studentData of studentsData) {
      try {
        await this.createStudent(principalId, studentData);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          data: studentData,
          error: error.message,
        });
      }
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
    const staffData = this.parseExcelFile(file);

    if (staffData.length === 0) {
      throw new BadRequestException('No valid data found in file');
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    for (const staffMember of staffData) {
      try {
        await this.createStaff(principalId, staffMember);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          data: staffMember,
          error: error.message,
        });
      }
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
    const { search, role } = query;
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
          active: true,
          createdAt: true,
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

    const staffRole: Role =
      createStaffDto.role === 'FACULTY'
        ? Role.TEACHER
        : createStaffDto.role === 'MENTOR'
          ? Role.FACULTY_SUPERVISOR
          : Role.PRINCIPAL;

    // Generate and hash secure temporary password using domain service
    const temporaryPassword = this.userService.generateSecurePassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const staff = await this.prisma.user.create({
      data: {
        name: createStaffDto.name,
        email: createStaffDto.email,
        password: hashedPassword,
        role: staffRole,
        active: true,
        phoneNo: createStaffDto.phone,
        designation: createStaffDto.designation,
        Institution: { connect: { id: principal.institutionId } },
      },
    });
    // TODO: Send email with temporary password to staff

    await this.cache.invalidateByTags(['staff', `institution:${principal.institutionId}`]);

    return staff;
  }

  /**
   * Update staff member
   */
  async updateStaff(principalId: string, staffId: string, updateData: Prisma.UserUpdateInput) {
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

    const updated = await this.prisma.user.update({
      where: { id: staffId },
      data: updateData,
    });

    await this.cache.invalidateByTags(['staff', `user:${staffId}`]);

    return updated;
  }

  /**
   * Delete staff member (soft delete)
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

    const deleted = await this.prisma.user.update({
      where: { id: staffId },
      data: { active: false },
    });

    await this.cache.invalidateByTags(['staff', `user:${staffId}`]);

    return deleted;
  }

  /**
   * Get faculty mentors
   */
  async getMentors(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const mentors = await this.prisma.user.findMany({
      where: {
        institutionId: principal.institutionId,
        role: Role.FACULTY_SUPERVISOR,
        active: true,
      },
      include: {
        _count: {
          select: {
            mentorAssignments: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    return mentors;
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
          },
        },
      },
      orderBy: { assignmentDate: 'desc' },
    });

    return assignments;
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

    // Verify mentor belongs to institution
    const mentor = await this.prisma.user.findFirst({
      where: {
        id: assignMentorDto.mentorId,
        institutionId: principal.institutionId,
        role: Role.FACULTY_SUPERVISOR,
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

        // Calculate expected duration
        let expectedMonths = 6;
        if (application.internship?.duration) {
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
      // Total students count
      this.prisma.student.count({
        where: { institutionId },
      }),

      // Batches with student counts
      this.prisma.batch.findMany({
        where: { institutionId },
        select: {
          name: true,
          _count: { select: { students: true } },
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
        by: ['status'],
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
        completedInternships = count;
      }
    });

    const completionRate = totalApplications > 0
      ? Math.round((completedInternships / totalApplications) * 100)
      : 0;

    const placementRate = totalStudents > 0
      ? Math.round((completedInternships / totalStudents) * 100)
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
      placementRate,
      studentsByBatch,
      internshipStatus,
      monthlyProgress,
    };
  }

  private formatMonthlyProgress(reportCounts: { status: string; _count: { status: number } }[]) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();

    // Generate last 6 months with sample data distribution
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthName = monthNames[date.getMonth()];

      // Distribute counts across months (simplified)
      const totalApproved = reportCounts.find(r => r.status === 'APPROVED')?._count.status || 0;
      const totalPending = reportCounts.find(r => r.status === 'PENDING' || r.status === 'SUBMITTED')?._count.status || 0;

      result.push({
        month: monthName,
        completed: Math.round(totalApproved / 6),
        inProgress: Math.round(totalPending / 6),
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
          student: { institutionId },
          isSelfIdentified: true,
        },
        _count: { status: true },
      }),
      // Active internships with company details - limited to prevent memory issues
      this.prisma.internshipApplication.findMany({
        where: {
          student: { institutionId },
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
      activeRate: total > 0 ? Math.round(((counts.selected + counts.joined) / total) * 100) : 0,
      completionRate: total > 0 ? Math.round((counts.completed / total) * 100) : 0,
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

    // Run queries in parallel (self-identified internships only)
    const [totalStudents, completedApplications] = await Promise.all([
      this.prisma.student.count({
        where: { institutionId },
      }),
      this.prisma.internshipApplication.findMany({
        where: {
          student: { institutionId },
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
      // Count all faculty supervisors
      this.prisma.user.count({
        where: {
          institutionId,
          role: Role.FACULTY_SUPERVISOR,
          active: true,
        },
      }),
      // Get all active assignments to compute mentor with assignments
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
      // Total students
      this.prisma.student.count({
        where: { institutionId, isActive: true },
      }),
    ]);

    // Compute unique mentors with assignments
    const mentorsWithAssignments = new Set(allAssignments.map(a => a.mentorId));
    const assignedMentors = mentorsWithAssignments.size;
    const unassignedMentors = totalMentors - assignedMentors;

    // Compute students with/without mentors
    const studentsWithMentors = new Set(allAssignments.map(a => a.studentId)).size;
    const studentsWithoutMentors = totalStudents - studentsWithMentors;

    // Get mentor distribution for load balancing display
    const mentorLoad: Record<string, number> = {};
    allAssignments.forEach(a => {
      mentorLoad[a.mentorId] = (mentorLoad[a.mentorId] || 0) + 1;
    });

    const avgStudentsPerMentor = assignedMentors > 0
      ? Math.round((studentsWithMentors / assignedMentors) * 10) / 10
      : 0;

    return {
      mentors: {
        total: totalMentors,
        assigned: assignedMentors,
        unassigned: unassignedMentors,
      },
      students: {
        total: totalStudents,
        withMentor: studentsWithMentors,
        withoutMentor: studentsWithoutMentors,
      },
      avgStudentsPerMentor,
      mentorLoadDistribution: Object.entries(mentorLoad)
        .map(([mentorId, count]) => ({ mentorId, studentCount: count }))
        .sort((a, b) => b.studentCount - a.studentCount),
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

    // Get all mentors with their current assignment counts
    const mentors = await this.prisma.user.findMany({
      where: {
        institutionId,
        role: Role.FACULTY_SUPERVISOR,
        active: true,
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            mentorAssignments: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (mentors.length === 0) {
      throw new BadRequestException('No mentors available for assignment');
    }

    // Get all students without active mentor assignments
    const studentsWithMentors = await this.prisma.mentorAssignment.findMany({
      where: {
        student: { institutionId },
        isActive: true,
      },
      select: { studentId: true },
    });

    const assignedStudentIds = new Set(studentsWithMentors.map(a => a.studentId));

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
    const mentorLoads = mentors.map(m => ({
      id: m.id,
      name: m.name,
      count: m._count.mentorAssignments,
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

    const faculty = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phoneNo: true,
        _count: {
          select: {
            mentorAssignments: { where: { isActive: true } },
            facultyVisitLogs: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      faculty: faculty.map((f) => ({
        id: f.id,
        name: f.name,
        email: f.email,
        phone: f.phoneNo,
        employeeId: null,
        assignedCount: f._count.mentorAssignments,
        totalVisits: f._count.facultyVisitLogs,
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

    // Get faculty details
    const faculty = await this.prisma.user.findFirst({
      where: {
        id: facultyId,
        institutionId: principal.institutionId,
        role: { in: ['FACULTY_SUPERVISOR', 'TEACHER'] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNo: true,
      },
    });

    if (!faculty) {
      throw new NotFoundException('Faculty not found');
    }

    // Get assigned students with their internship details
    const mentorAssignments = await this.prisma.mentorAssignment.findMany({
      where: {
        mentorId: facultyId,
        isActive: true,
      },
      include: {
        student: {
          include: {
            batch: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
            internshipApplications: {
              where: {
                status: { in: ['JOINED', 'COMPLETED', 'SELECTED'] },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
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
      return {
        id: a.student.id,
        name: a.student.name,
        rollNumber: a.student.rollNumber,
        batch: a.student.batch?.name || 'N/A',
        department: a.student.branch?.name || 'N/A',
        internshipTitle: app?.internship?.title || null,
        companyName: app?.internship?.industry?.companyName || null,
        internshipStatus: app?.status === 'JOINED' ? 'In Progress' :
          app?.status === 'COMPLETED' ? 'Completed' :
          app?.status === 'SELECTED' ? 'Pending' : 'Not Started',
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
      totalStudentsWithInternships,
      studentsWithMentors,
      mentors,
    ] = await Promise.all([
      // Total students with ongoing internships
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId },
          isSelfIdentified: true,
          internshipStatus: 'ONGOING',
        },
      }),
      // Students with active mentor assignments
      this.prisma.mentorAssignment.count({
        where: {
          student: { institutionId },
          isActive: true,
        },
      }),
      // Get all mentors with their assignment counts
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
          _count: {
            select: {
              mentorAssignments: { where: { isActive: true } },
            },
          },
        },
      }),
    ]);

    const studentsWithMentorsCount = studentsWithMentors;
    const studentsWithoutMentorsCount = Math.max(0, totalStudentsWithInternships - studentsWithMentorsCount);
    const coveragePercentage = totalStudentsWithInternships > 0
      ? Math.round((studentsWithMentorsCount / totalStudentsWithInternships) * 100)
      : 100;

    const mentorLoadDistribution = mentors
      .map(m => ({
        mentorId: m.id,
        mentorName: m.name,
        mentorEmail: m.email,
        assignedStudents: m._count.mentorAssignments,
      }))
      .sort((a, b) => b.assignedStudents - a.assignedStudents);

    const avgLoadPerMentor = mentors.length > 0
      ? Math.round((studentsWithMentorsCount / mentors.length) * 10) / 10
      : 0;

    return {
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

    // Calculate 6-month trend data
    const trendData: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1 - i, 1);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);

      const [studentsWithInternships, facultyVisits, reportsSubmitted] = await Promise.all([
        this.prisma.internshipApplication.count({
          where: {
            student: { institutionId },
            isSelfIdentified: true,
            internshipStatus: 'ONGOING',
            createdAt: { lte: endOfMonth },
          },
        }),
        this.prisma.facultyVisitLog.count({
          where: {
            application: { student: { institutionId } },
            visitDate: { gte: startOfMonth, lte: endOfMonth },
          },
        }),
        this.prisma.monthlyReport.count({
          where: {
            student: { institutionId },
            reportMonth: month,
            reportYear: year,
            status: { in: ['SUBMITTED', 'APPROVED'] },
          },
        }),
      ]);

      const visitCompliance = studentsWithInternships > 0
        ? Math.round(Math.min((facultyVisits / studentsWithInternships) * 100, 100))
        : 100;

      const reportCompliance = studentsWithInternships > 0
        ? Math.round((reportsSubmitted / studentsWithInternships) * 100)
        : 100;

      const overallScore = Math.round((visitCompliance + reportCompliance) / 2);

      trendData.push({
        month,
        year,
        monthName: MONTH_NAMES[month - 1],
        overallScore,
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
        overallScore: currentMonthData.overallScore,
        visitComplianceRate: currentMonthData.visitCompliance,
        reportComplianceRate: currentMonthData.reportCompliance,
        facultyVisits: currentMonthData.facultyVisits,
        reportsSubmitted: currentMonthData.reportsSubmitted,
        studentsWithInternships: currentMonthData.studentsWithInternships,
      },
      trend: trendData,
      summary: {
        averageCompliance: Math.round(trendData.reduce((sum, m) => sum + m.overallScore, 0) / trendData.length),
        bestMonth: trendData.reduce((best, m) => m.overallScore > best.overallScore ? m : best, trendData[0]),
        worstMonth: trendData.reduce((worst, m) => m.overallScore < worst.overallScore ? m : worst, trendData[0]),
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

    const [urgentGrievances, overdueReports, missingVisits, unassignedStudents] = await Promise.all([
      // Urgent grievances (pending for > 7 days)
      this.prisma.grievance.findMany({
        where: {
          student: { institutionId },
          status: { in: ['PENDING', 'UNDER_REVIEW'] },
          submittedDate: { lte: sevenDaysAgo },
        },
        select: {
          id: true,
          title: true,
          status: true,
          submittedDate: true,
          student: {
            select: { id: true, name: true, rollNumber: true },
          },
        },
        orderBy: { submittedDate: 'asc' },
        take: 10,
      }),

      // Overdue reports (current month, overdue by > 5 days)
      now.getDate() > 5 ? this.prisma.student.findMany({
        where: {
          institutionId,
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
          mentorAssignments: {
            where: { isActive: true },
            take: 1,
            select: {
              mentor: { select: { id: true, name: true } },
            },
          },
        },
        take: 10,
      }) : [],

      // Missing faculty visits (students with no visit in > 30 days)
      this.prisma.student.findMany({
        where: {
          institutionId,
          isActive: true,
          internshipApplications: {
            some: {
              isSelfIdentified: true,
              internshipStatus: 'ONGOING',
              facultyVisitLogs: {
                none: {
                  visitDate: { gte: thirtyDaysAgo },
                },
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
          rollNumber: true,
          internshipApplications: {
            where: { isSelfIdentified: true, internshipStatus: 'ONGOING' },
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
        take: 10,
      }),

      // Unassigned students (with internships but no mentor)
      this.prisma.student.findMany({
        where: {
          institutionId,
          isActive: true,
          internshipApplications: {
            some: {
              isSelfIdentified: true,
              internshipStatus: 'ONGOING',
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
          batch: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
        take: 10,
      }),
    ]);

    return {
      summary: {
        urgentGrievancesCount: urgentGrievances.length,
        overdueReportsCount: overdueReports.length,
        missingVisitsCount: missingVisits.length,
        unassignedStudentsCount: unassignedStudents.length,
        totalAlerts: urgentGrievances.length + overdueReports.length + missingVisits.length + unassignedStudents.length,
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
          where: { isSelfIdentified: true, student: { institutionId } },
          select: {
            joiningLetterUrl: true,
            hasJoined: true,
            reviewedBy: true,
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
          } else if (app.hasJoined) {
            verified++;
          } else if (app.reviewedBy) {
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
      where.hasJoined = false;
      where.reviewedBy = null;
    } else if (status === 'verified') {
      where.joiningLetterUrl = { not: null, notIn: [''] };
      where.hasJoined = true;
    } else if (status === 'rejected') {
      where.joiningLetterUrl = { not: null, notIn: [''] };
      where.hasJoined = false;
      where.reviewedBy = { not: null };
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
          hasJoined: true,
          joiningDate: true,
          reviewedBy: true,
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
      } else if (app.hasJoined) {
        letterStatus = 'VERIFIED';
      } else if (app.reviewedBy) {
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
        reviewedBy: app.reviewedBy,
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
        hasJoined: true,
        joiningDate: data.joiningDate || new Date(),
        reviewedBy: principalId,
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

    // Update the application (reject by setting reviewedBy but not hasJoined)
    const updated = await this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: {
        hasJoined: false,
        reviewedBy: principalId,
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
        hasJoined: true,
        reviewedAt: true,
        reviewedBy: true,
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
      action: a.hasJoined ? 'VERIFIED' : 'REJECTED',
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
    if (data.stipend !== undefined) updateData.stipend = data.stipend;
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
        reviewedBy: principalId,
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
