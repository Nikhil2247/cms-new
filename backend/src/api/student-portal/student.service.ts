import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { LruCacheService } from '../../core/cache/lru-cache.service';
import { Prisma, ApplicationStatus, InternshipStatus, MonthlyReportStatus, DocumentType } from '@prisma/client';

@Injectable()
export class StudentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
  ) {}

  /**
   * Get student dashboard - internship status, report status
   */
  async getDashboard(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const cacheKey = `student:dashboard:${studentId}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // Get current internship
        const currentInternship = await this.prisma.internshipApplication.findFirst({
          where: {
            studentId,
            status: { in: [ApplicationStatus.SELECTED, ApplicationStatus.JOINED] },
          },
          include: {
            internship: {
              include: {
                industry: true,
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

        // Get total applications count
        const totalApplications = await this.prisma.internshipApplication.count({
          where: { studentId },
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

        // Get recent activities
        const recentActivities = await this.prisma.internshipApplication.findMany({
          where: { studentId },
          take: 5,
          orderBy: { updatedAt: 'desc' },
          include: {
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
  async getProfile(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phoneNo: true,
            active: true,
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
   */
  async updateProfile(studentId: string, updateProfileDto: Prisma.StudentUpdateInput) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data: updateProfileDto,
      include: {
        user: true,
        batch: true,
        branch: true,
      },
    });

    await this.cache.invalidateByTags(['student', `student:${studentId}`]);

    return updated;
  }

  /**
   * Upload profile image
   */
  async uploadProfileImage(studentId: string, imageUrl: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data: {
        profileImage: imageUrl,
      },
    });

    await this.cache.invalidateByTags(['student', `student:${studentId}`]);

    return {
      success: true,
      imageUrl,
      message: 'Profile image uploaded successfully',
    };
  }

  /**
   * Get available internships for student
   */
  async getAvailableInternships(studentId: string, params: {
    page?: number;
    limit?: number;
    search?: string;
    industryType?: string;
    location?: string;
  }) {
    const { page = 1, limit = 10, search, industryType, location } = params;
    const skip = (page - 1) * limit;

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
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
        studentId,
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
  async applyToInternship(studentId: string, internshipId: string, applicationDto: {
    coverLetter?: string;
    resume?: string;
    additionalInfo?: string;
  }) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

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

    await this.cache.invalidateByTags(['applications', `student:${studentId}`]);

    return application;
  }

  /**
   * Get student applications
   */
  async getApplications(
    studentId: string,
    params: { page?: number; limit?: number; status?: string },
  ) {
    const { page = 1, limit = 10, status } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.InternshipApplicationWhereInput = {
      studentId,
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
  async getInternshipDetails(studentId: string, internshipId: string) {
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
        studentId,
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
   * Get application details by ID
   */
  async getApplicationDetails(id: string) {
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

    return application;
  }

  /**
   * Submit self-identified internship
   */
  async submitSelfIdentified(studentId: string, selfIdentifiedDto: {
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
      where: { id: studentId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

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

    const application = await this.prisma.internshipApplication.create({
      data: {
        studentId,
        isSelfIdentified: true,
        status: ApplicationStatus.APPLIED,
        ...selfIdentifiedDto,
      },
    });

    await this.cache.invalidateByTags(['applications', `student:${studentId}`]);

    return application;
  }

  /**
   * Get self-identified internship applications
   */
  async getSelfIdentified(studentId: string, params: { page?: number; limit?: number }) {
    const { page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.InternshipApplicationWhereInput = {
      studentId,
      isSelfIdentified: true,
    };

    const [applications, total] = await Promise.all([
      this.prisma.internshipApplication.findMany({
        where,
        skip,
        take: limit,
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
   * Submit monthly report
   */
  async submitMonthlyReport(studentId: string, reportDto: {
    applicationId: string;
    reportMonth: number;
    reportYear: number;
    reportFileUrl?: string;
    monthName?: string;
  }) {
    // Verify application belongs to student
    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: reportDto.applicationId,
        studentId,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Check if report for this month already exists
    const existingReport = await this.prisma.monthlyReport.findFirst({
      where: {
        applicationId: reportDto.applicationId,
        reportMonth: reportDto.reportMonth,
        reportYear: reportDto.reportYear,
      },
    });

    if (existingReport) {
      throw new BadRequestException('Report for this month already exists');
    }

    const report = await this.prisma.monthlyReport.create({
      data: {
        applicationId: reportDto.applicationId,
        studentId,
        reportMonth: reportDto.reportMonth,
        reportYear: reportDto.reportYear,
        reportFileUrl: reportDto.reportFileUrl,
        monthName: reportDto.monthName,
        status: MonthlyReportStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    await this.cache.invalidateByTags(['reports', `student:${studentId}`]);

    return report;
  }

  /**
   * Update a monthly report (student-owned)
   */
  async updateMonthlyReport(studentId: string, id: string, reportDto: {
    reportFileUrl?: string;
    monthName?: string;
    status?: MonthlyReportStatus;
    reviewComments?: string;
  }) {
    const existing = await this.prisma.monthlyReport.findFirst({
      where: { id, studentId },
    });

    if (!existing) {
      throw new NotFoundException('Monthly report not found');
    }

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

    await this.cache.invalidateByTags(['reports', `student:${studentId}`]);
    return updated;
  }

  /**
   * Get student documents
   */
  async getDocuments(studentId: string, params: { page?: number; limit?: number; type?: string }) {
    const { page = 1, limit = 10, type } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.DocumentWhereInput = {
      studentId,
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
  async uploadDocument(studentId: string, file: any, documentDto: { type: string }) {
    const fileUrl = (file as any)?.path || (file as any)?.location || (file as any)?.url || '';
    const fileName = (file as any)?.originalname || (file as any)?.filename || 'document';

    const created = await this.prisma.document.create({
      data: {
        studentId,
        type: documentDto.type as DocumentType,
        fileName,
        fileUrl,
      },
    });

    await this.cache.invalidateByTags(['documents', `student:${studentId}`]);
    return created;
  }

  /**
   * Delete a document
   */
  async deleteDocument(id: string) {
    return this.prisma.document.delete({ where: { id } });
  }

  /**
   * Get monthly reports
   */
  async getMonthlyReports(studentId: string, params: { page?: number; limit?: number }) {
    const { page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      this.prisma.monthlyReport.findMany({
        where: { studentId },
        skip,
        take: limit,
        include: {
          application: {
            include: {
              internship: {
                include: {
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
      this.prisma.monthlyReport.count({ where: { studentId } }),
    ]);

    return {
      reports,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Submit grievance
   */
  async submitGrievance(studentId: string, grievanceDto: {
    title: string;
    category: string;
    description: string;
    severity?: string;
    internshipId?: string;
    industryId?: string;
    actionRequested?: string;
    preferredContactMethod?: string;
    attachments?: string[];
  }) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

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
        status: 'PENDING',
      },
    });

    await this.cache.invalidateByTags(['grievances', `student:${studentId}`]);

    return grievance;
  }

  /**
   * Get grievances
   */
  async getGrievances(
    studentId: string,
    params: { page?: number; limit?: number; status?: string },
  ) {
    const { page = 1, limit = 10, status } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.GrievanceWhereInput = {
      studentId,
    };

    if (status) {
      where.status = status as any;
    }

    const [grievances, total] = await Promise.all([
      this.prisma.grievance.findMany({
        where,
        skip,
        take: limit,
        include: {
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
  async submitTechnicalQuery(studentId: string, queryDto: {
    title?: string;
    description?: string;
    priority?: string;
    attachments?: string[];
  }) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
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

    return query;
  }
}
