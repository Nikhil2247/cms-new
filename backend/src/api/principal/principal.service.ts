import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { LruCacheService } from '../../core/cache/lru-cache.service';
import { Prisma, ApplicationStatus, Role } from '@prisma/client';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { AssignMentorDto } from './dto/assign-mentor.dto';
import * as bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';

// Helper function to generate secure temporary password
function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

@Injectable()
export class PrincipalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
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
        const [
          totalStudents,
          activeStudents,
          totalStaff,
          activeStaff,
          totalApplications,
          selectedApplications,
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
          this.prisma.internshipApplication.count({
            where: { student: { institutionId } }
          }),
          this.prisma.internshipApplication.count({
            where: {
              student: { institutionId },
              status: ApplicationStatus.SELECTED,
            }
          }),
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

        const placementRate = totalApplications > 0
          ? Number(((selectedApplications / totalApplications) * 100).toFixed(2))
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
          internships: {
            totalApplications,
            selectedApplications,
            placementRate,
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
  }) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const { search, batchId, branchId, status } = query;
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
            include: {
              internship: {
                select: {
                  id: true,
                  title: true,
                  startDate: true,
                  endDate: true,
                  duration: true,
                },
              },
              monthlyReports: {
                select: {
                  id: true,
                  reportMonth: true,
                  reportYear: true,
                  status: true,
                  submittedAt: true,
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
        } : null,
      };
    });

    // Filter by status if provided
    let filteredData = progressData;
    if (status && status !== 'all') {
      filteredData = progressData.filter((s) => s.internshipStatus === status);
    }

    return {
      students: filteredData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
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
   * Create a new student
   */
  async createStudent(principalId: string, createStudentDto: CreateStudentDto) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Check if email already exists
    if (createStudentDto.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: createStudentDto.email },
      });

      if (existingUser) {
        throw new BadRequestException(`User with email ${createStudentDto.email} already exists`);
      }
    }

    // Check if admission/enrollment number already exists (maps to Student.admissionNumber)
    if (createStudentDto.enrollmentNumber) {
      const existingStudent = await this.prisma.student.findFirst({
        where: { admissionNumber: createStudentDto.enrollmentNumber },
      });

      if (existingStudent) {
        throw new BadRequestException(
          `Student with enrollment number ${createStudentDto.enrollmentNumber} already exists`,
        );
      }
    }

    const batch = await this.prisma.batch.findUnique({
      where: { id: createStudentDto.batchId },
      select: { id: true, institutionId: true },
    });

    if (!batch || batch.institutionId !== principal.institutionId) {
      throw new BadRequestException('Invalid batchId for this institution');
    }

    // Generate and hash secure temporary password
    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // Create user first
    const user = await this.prisma.user.create({
      data: {
        name: createStudentDto.name,
        email: createStudentDto.email,
        password: hashedPassword,
        role: Role.STUDENT,
        Institution: { connect: { id: principal.institutionId } },
        phoneNo: createStudentDto.phone,
        dob: createStudentDto.dateOfBirth,
      },
    });
    // TODO: Send email with temporary password to student

    // Create student profile
    const student = await this.prisma.student.create({
      data: {
        user: { connect: { id: user.id } },
        name: createStudentDto.name,
        email: createStudentDto.email,
        admissionNumber: createStudentDto.enrollmentNumber,
        contact: createStudentDto.phone,
        address: createStudentDto.address,
        dob: createStudentDto.dateOfBirth,
        gender: createStudentDto.gender,
        batch: { connect: { id: createStudentDto.batchId } },
        Institution: { connect: { id: principal.institutionId } },
        isActive: true,
      },
      include: {
        user: true,
        batch: true,
        branch: true,
      },
    });

    await this.cache.invalidateByTags(['students', `institution:${principal.institutionId}`]);

    return student;
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

    // Generate and hash secure temporary password
    const temporaryPassword = generateTemporaryPassword();
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

    // Get all students with active internships (JOINED status)
    const studentsWithInternships = await this.prisma.student.findMany({
      where: {
        ...studentWhere,
        internshipApplications: {
          some: {
            status: { in: ['JOINED', 'SELECTED'] },
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
            status: { in: ['JOINED', 'SELECTED'] },
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

      // Application status counts using groupBy
      this.prisma.internshipApplication.groupBy({
        by: ['status'],
        where: {
          student: { institutionId },
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

    // Single query with groupBy instead of multiple count queries
    const statusCounts = await this.prisma.internshipApplication.groupBy({
      by: ['status'],
      where: {
        student: { institutionId },
      },
      _count: { status: true },
    });

    // Process counts
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

    return {
      total,
      ...counts,
      activeRate: total > 0 ? Math.round(((counts.selected + counts.joined) / total) * 100) : 0,
      completionRate: total > 0 ? Math.round((counts.completed / total) * 100) : 0,
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

    // Run queries in parallel
    const [totalStudents, completedApplications] = await Promise.all([
      this.prisma.student.count({
        where: { institutionId },
      }),
      this.prisma.internshipApplication.findMany({
        where: {
          student: { institutionId },
          status: 'COMPLETED',
        },
        select: {
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
}
