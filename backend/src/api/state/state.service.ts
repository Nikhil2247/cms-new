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
        const now = Date.now();
        const lastWeek = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const lastMonth = new Date(now - 30 * 24 * 60 * 60 * 1000);

        // Use parallel queries for efficiency
        const [
          totalInstitutions,
          activeInstitutions,
          totalStudents,
          activeStudents,
          totalFaculty,
          activeFaculty,
          totalInternships,
          activeInternships,
          totalApplications,
          acceptedApplications,
          totalIndustries,
          approvedIndustries,
          totalFacultyVisits,
          pendingReports,
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
          this.prisma.internship.count(),
          this.prisma.internship.count({
            where: {
              status: InternshipStatus.ACTIVE,
              isActive: true,
            },
          }),
          this.prisma.internshipApplication.count(),
          this.prisma.internshipApplication.count({
            where: { status: ApplicationStatus.SELECTED },
          }),
          this.prisma.industry.count(),
          this.prisma.industry.count({
            where: { isApproved: true, isVerified: true },
          }),
          this.prisma.facultyVisitLog.count(),
          this.prisma.monthlyReport.count({ where: { status: 'SUBMITTED' } }),
          this.prisma.internshipApplication.count({
            where: { createdAt: { gte: lastWeek } },
          }),
          this.prisma.industry.count({
            where: { createdAt: { gte: lastMonth } },
          }),
        ]);

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
          // Backwards-compatible flat fields
          totalFaculty,
          activeFaculty,
          internships: {
            total: totalInternships,
            active: activeInternships,
          },
          applications: {
            total: totalApplications,
            accepted: acceptedApplications,
            placementRate: totalApplications > 0
              ? ((acceptedApplications / totalApplications) * 100).toFixed(2)
              : 0,
          },
          industries: {
            total: totalIndustries,
            approved: approvedIndustries,
          },
          compliance: {
            totalVisits: totalFacultyVisits,
            pendingReports,
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
   * Get institution overview with detailed statistics
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
      },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${id} not found`);
    }

    // Get current month/year for time-based queries
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0);

    // Use Promise.all for parallel queries
    const [
      totalStudents,
      assignedStudents,
      internshipsAdded,
      internshipsActive,
      joiningReportsSubmitted,
      joiningReportsPending,
      joiningReportsApproved,
      monthlyReportsSubmitted,
      monthlyReportsPending,
      monthlyReportsReviewed,
      facultyVisitsPending,
      facultyVisitsCompleted,
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

      // Joining reports submitted (applications with joining letter)
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id },
          joiningLetterUrl: { not: null },
        },
      }),

      // Joining reports pending (selected applications without joining letter)
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id },
          status: ApplicationStatus.SELECTED,
          joiningLetterUrl: null,
        },
      }),

      // Joining reports approved (applications with status SELECTED and joining letter)
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id },
          status: ApplicationStatus.SELECTED,
          joiningLetterUrl: { not: null },
        },
      }),

      // Monthly reports submitted for current month
      this.prisma.monthlyReport.count({
        where: {
          student: { institutionId: id },
          reportMonth: currentMonth,
          reportYear: currentYear,
          status: { in: ['SUBMITTED', 'APPROVED'] },
        },
      }),

      // Monthly reports pending for current month
      this.prisma.monthlyReport.count({
        where: {
          student: { institutionId: id },
          reportMonth: currentMonth,
          reportYear: currentYear,
          status: 'DRAFT',
        },
      }),

      // Monthly reports reviewed (approved or rejected)
      this.prisma.monthlyReport.count({
        where: {
          student: { institutionId: id },
          reportMonth: currentMonth,
          reportYear: currentYear,
          status: { in: ['APPROVED', 'REJECTED'] },
        },
      }),

      // Faculty visits pending this month
      this.prisma.facultyVisitLog.count({
        where: {
          application: { student: { institutionId: id } },
          visitDate: {
            gte: startOfMonth > new Date() ? startOfMonth : new Date(),
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
            lte: endOfMonth < new Date() ? endOfMonth : new Date(),
          },
        },
      }),
    ]);

    const unassignedStudents = totalStudents - assignedStudents;
    const totalJoiningReports = joiningReportsSubmitted + joiningReportsPending;
    const totalFacultyVisits = facultyVisitsPending + facultyVisitsCompleted;

    // Calculate current month pending monthly reports
    const currentMonthPending = monthlyReportsPending;

    return {
      institution,
      totalStudents,
      assignedStudents,
      unassignedStudents,
      internshipsAdded,
      internshipsActive,
      joiningReportStatus: {
        submitted: joiningReportsSubmitted,
        pending: joiningReportsPending,
        approved: joiningReportsApproved,
        total: totalJoiningReports,
      },
      monthlyReportStatus: {
        submitted: monthlyReportsSubmitted,
        pending: monthlyReportsPending,
        reviewed: monthlyReportsReviewed,
        currentMonthPending,
      },
      facultyVisits: {
        pendingThisMonth: facultyVisitsPending,
        completedThisMonth: facultyVisitsCompleted,
        totalThisMonth: totalFacultyVisits,
      },
    };
  }

  /**
   * Get institution students with cursor pagination
   */
  async getInstitutionStudents(
    id: string,
    params: {
      cursor?: string;
      limit: number;
      search?: string;
      filter: 'assigned' | 'unassigned' | 'all';
    },
  ) {
    const { cursor, limit, search, filter } = params;

    // Verify institution exists
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${id} not found`);
    }

    // Build where clause
    const where: Prisma.StudentWhereInput = { institutionId: id };

    // Apply search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { rollNumber: { contains: search, mode: 'insensitive' } },
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

    // Build query
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
          where: { status: ApplicationStatus.SELECTED },
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
                  },
                },
              },
            },
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
    const [students, total] = await Promise.all([
      this.prisma.student.findMany(query),
      this.prisma.student.count({ where }),
    ]);

    // Calculate next cursor
    const hasMore = students.length === limit;
    const nextCursor = hasMore ? students[students.length - 1].id : null;

    return {
      students,
      nextCursor,
      total,
      hasMore,
    };
  }

  /**
   * Get institution companies with student counts
   */
  async getInstitutionCompanies(id: string, params: { limit: number }) {
    const { limit } = params;

    // Verify institution exists
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${id} not found`);
    }

    // Get industries linked to the institution through internships
    const industries = await this.prisma.industry.findMany({
      where: {
        internships: {
          some: { institutionId: id },
        },
      },
      take: limit,
      select: {
        id: true,
        companyName: true,
        industryType: true,
        city: true,
        state: true,
        isApproved: true,
        isVerified: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // For each industry, count students doing internships there
    const companiesWithCounts = await Promise.all(
      industries.map(async (industry) => {
        const studentCount = await this.prisma.student.count({
          where: {
            institutionId: id,
            internshipApplications: {
              some: {
                status: ApplicationStatus.SELECTED,
                internship: {
                  industryId: industry.id,
                },
              },
            },
          },
        });

        return {
          ...industry,
          studentCount,
        };
      }),
    );

    // Sort by student count
    companiesWithCounts.sort((a, b) => b.studentCount - a.studentCount);

    return {
      companies: companiesWithCounts,
      total: companiesWithCounts.length,
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

    const principal = await this.prisma.user.create({
      data: {
        ...data,
        role: 'PRINCIPAL',
        active: true,
      },
      include: { Institution: true },
    });

    await this.cache.invalidateByTags(['state', 'principals']);
    return principal;
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

  /**
   * Get all users for credentials management
   */
  async getUsers(params: {
    role?: string;
    institutionId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { role, institutionId, search, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (role) {
      where.role = role as Role;
    }

    if (institutionId) {
      where.institutionId = institutionId;
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

    const dateFilter: Prisma.InternshipApplicationWhereInput = {
      student: { institutionId },
    };

    if (fromDate || toDate) {
      dateFilter.createdAt = {};
      if (fromDate) dateFilter.createdAt.gte = fromDate;
      if (toDate) dateFilter.createdAt.lte = toDate;
    }

    const [
      totalStudents,
      totalApplications,
      selectedApplications,
      completedApplications,
      totalInternships,
      facultyVisits,
      monthlyReports,
    ] = await Promise.all([
      this.prisma.student.count({ where: { institutionId, isActive: true } }),
      this.prisma.internshipApplication.count({ where: dateFilter }),
      this.prisma.internshipApplication.count({
        where: { ...dateFilter, status: ApplicationStatus.SELECTED },
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

    const placementRate = totalApplications > 0
      ? ((selectedApplications / totalApplications) * 100).toFixed(2)
      : 0;

    const completionRate = selectedApplications > 0
      ? ((completedApplications / selectedApplications) * 100).toFixed(2)
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
        selectedApplications,
        completedApplications,
        totalInternships,
        placementRate: Number(placementRate),
        completionRate: Number(completionRate),
      },
      compliance: {
        facultyVisits,
        monthlyReports,
        averageVisitsPerApplication: selectedApplications > 0
          ? (facultyVisits / selectedApplications).toFixed(2)
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

    // Use domain service for base performance data
    const institutionPerformance = await this.stateReportService.getInstitutionPerformance();

    // Get placement rates for each institution
    const performanceWithPlacements = await Promise.all(
      institutionPerformance.slice(0, limit * 2).map(async (inst: any) => {
        const dateFilter: any = {};
        if (month && year) {
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0);
          dateFilter.createdAt = { gte: startDate, lte: endDate };
        }

        const [totalApplications, selectedApplications] = await Promise.all([
          this.prisma.internshipApplication.count({
            where: { student: { institutionId: inst.institutionId }, ...dateFilter },
          }),
          this.prisma.internshipApplication.count({
            where: {
              student: { institutionId: inst.institutionId },
              status: ApplicationStatus.SELECTED,
              ...dateFilter,
            },
          }),
        ]);

        const placementRate = totalApplications > 0
          ? (selectedApplications / totalApplications) * 100
          : 0;

        return {
          id: inst.institutionId,
          name: inst.institutionName,
          studentsCount: inst.totalStudents,
          internshipsCount: inst.activeInternships,
          totalApplications,
          selectedApplications,
          placementRate: Number(placementRate.toFixed(2)),
          performanceScore: inst.performanceScore,
        };
      }),
    );

    const sorted = performanceWithPlacements.sort((a, b) => b.placementRate - a.placementRate);

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

    const [
      newStudents,
      newApplications,
      selectedApplications,
      newInternships,
      newIndustries,
      facultyVisits,
      monthlyReports,
    ] = await Promise.all([
      this.prisma.student.count({ where: dateFilter }),
      this.prisma.internshipApplication.count({ where: dateFilter }),
      this.prisma.internshipApplication.count({
        where: { ...dateFilter, status: ApplicationStatus.SELECTED },
      }),
      this.prisma.internship.count({ where: dateFilter }),
      this.prisma.industry.count({ where: dateFilter }),
      this.prisma.facultyVisitLog.count({
        where: { visitDate: { gte: startDate, lte: endDate } },
      }),
      this.prisma.monthlyReport.count({
        where: { reportMonth: targetMonth, reportYear: targetYear },
      }),
    ]);

    // Get trend data (last 6 months)
    const trendData = [];
    for (let i = 5; i >= 0; i--) {
      const trendMonth = new Date(targetYear, targetMonth - 1 - i, 1);
      const trendEndDate = new Date(trendMonth.getFullYear(), trendMonth.getMonth() + 1, 0);

      const [applications, placements] = await Promise.all([
        this.prisma.internshipApplication.count({
          where: { createdAt: { gte: trendMonth, lte: trendEndDate } },
        }),
        this.prisma.internshipApplication.count({
          where: {
            createdAt: { gte: trendMonth, lte: trendEndDate },
            status: ApplicationStatus.SELECTED,
          },
        }),
      ]);

      trendData.push({
        month: trendMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        applications,
        placements,
      });
    }

    return {
      month: targetMonth,
      year: targetYear,
      metrics: {
        newStudents,
        newApplications,
        selectedApplications,
        newInternships,
        newIndustries,
        facultyVisits,
        monthlyReports,
        placementRate: newApplications > 0
          ? ((selectedApplications / newApplications) * 100).toFixed(2)
          : 0,
      },
      trend: trendData,
    };
  }
}
