import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { LruCacheService } from '../../core/cache/lru-cache.service';
import { Prisma, ApplicationStatus, InternshipStatus, Role, AuditAction, AuditCategory, AuditSeverity } from '../../generated/prisma/client';
import { AuditService } from '../../infrastructure/audit/audit.service';

@Injectable()
export class IndustryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get Industry Dashboard - active postings, applicant count
   */
  async getDashboard(userId: string) {
    const industry = await this.prisma.industry.findUnique({
      where: { userId },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    const cacheKey = `industry:dashboard:${industry.id}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const [
          activeInternships,
          totalInternships,
          pendingApplications,
          totalApplications,
          selectedStudents,
          activeStudents,
        ] = await Promise.all([
          this.prisma.internship.count({
            where: {
              industryId: industry.id,
              status: InternshipStatus.ACTIVE,
              isActive: true,
            },
          }),
          this.prisma.internship.count({
            where: { industryId: industry.id },
          }),
          this.prisma.internshipApplication.count({
            where: {
              internship: { industryId: industry.id },
              status: ApplicationStatus.APPLIED,
            },
          }),
          this.prisma.internshipApplication.count({
            where: {
              internship: { industryId: industry.id },
            },
          }),
          this.prisma.internshipApplication.count({
            where: {
              internship: { industryId: industry.id },
              status: ApplicationStatus.SELECTED,
            },
          }),
          this.prisma.internshipApplication.count({
            where: {
              internship: { industryId: industry.id },
              status: ApplicationStatus.JOINED,
            },
          }),
        ]);

        // Get upcoming deadlines
        const upcomingDeadlines = await this.prisma.internship.findMany({
          where: {
            industryId: industry.id,
            applicationDeadline: {
              gte: new Date(),
              lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Next 2 weeks
            },
            isActive: true,
          },
          take: 5,
          orderBy: { applicationDeadline: 'asc' },
        });

        return {
          activeInternships,
          totalInternships,
          pendingApplications,
          totalApplications,
          selectedStudents,
          activeStudents,
          activeSupervisors: 0, // Can be implemented based on supervisor model
          upcomingDeadlines,
        };
      },
      { ttl: 300, tags: ['industry', `industry:${industry.id}`] },
    );
  }

  /**
   * Get industry profile
   */
  async getProfile(userId: string) {
    const industry = await this.prisma.industry.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            active: true,
          },
        },
        _count: {
          select: {
            internships: true,
            monthlyFeedbacks: true,
            completionFeedbacks: true,
          },
        },
      },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    return industry;
  }

  /**
   * Update industry profile
   */
  async updateProfile(userId: string, updateData: Prisma.IndustryUpdateInput) {
    const industry = await this.prisma.industry.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    const oldValues = {
      companyName: industry.companyName,
      address: industry.address,
      contactPersonName: industry.contactPersonName,
    };

    const updated = await this.prisma.industry.update({
      where: { id: industry.id },
      data: updateData,
    });

    // Audit profile update
    this.auditService.log({
      action: AuditAction.INDUSTRY_PROFILE_UPDATE,
      entityType: 'Industry',
      entityId: industry.id,
      userId,
      userName: industry.user?.name,
      userRole: industry.user?.role || Role.INDUSTRY,
      description: `Industry profile updated: ${industry.companyName}`,
      category: AuditCategory.PROFILE_MANAGEMENT,
      severity: AuditSeverity.MEDIUM,
      institutionId: industry.institutionId || undefined,
      oldValues,
      newValues: updateData as any,
    }).catch(() => {});

    await this.cache.invalidateByTags(['industry', `industry:${industry.id}`]);

    return updated;
  }

  /**
   * Get all internship postings
   */
  async getPostings(userId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const { page = 1, limit = 10, status } = params;
    const skip = (page - 1) * limit;

    const industry = await this.prisma.industry.findUnique({
      where: { userId },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    const where: Prisma.InternshipWhereInput = {
      industryId: industry.id,
    };

    if (status) {
      where.status = status as InternshipStatus;
    }

    const [internships, total] = await Promise.all([
      this.prisma.internship.findMany({
        where,
        skip,
        take: limit,
        include: {
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

    return {
      data: internships,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create new internship posting
   */
  async createInternshipPosting(userId: string, internshipData: {
    title: string;
    description: string;
    detailedDescription?: string;
    fieldOfWork: string;
    numberOfPositions: number;
    duration: string;
    startDate?: Date;
    endDate?: Date;
    applicationDeadline: Date;
    workLocation: string;
    isRemoteAllowed?: boolean;
    eligibleBranches: string[];
    minimumPercentage?: number;
    eligibleSemesters: string[];
    isStipendProvided?: boolean;
    stipendAmount?: number;
    stipendDetails?: string;
    requiredSkills: string[];
    preferredSkills?: string[];
    totalFacultyVisits?: number;
    institutionId?: string;
  }) {
    const industry = await this.prisma.industry.findUnique({
      where: { userId },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    if (!industry.isApproved || !industry.isVerified) {
      throw new BadRequestException('Your industry profile must be approved to post internships');
    }

    const internship = await this.prisma.internship.create({
      data: {
        ...internshipData,
        industryId: industry.id,
        status: InternshipStatus.ACTIVE,
        isActive: true,
        institutionId: internshipData.institutionId || industry.institutionId,
      },
    });

    // Get user for audit
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Audit internship creation
    this.auditService.log({
      action: AuditAction.INTERNSHIP_CREATE,
      entityType: 'Internship',
      entityId: internship.id,
      userId,
      userName: user?.name,
      userRole: user?.role || Role.INDUSTRY,
      description: `Internship posting created: ${internship.title}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: internship.institutionId || undefined,
      newValues: {
        internshipId: internship.id,
        title: internship.title,
        positions: internship.numberOfPositions,
        fieldOfWork: internship.fieldOfWork,
        companyName: industry.companyName,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['industry', `industry:${industry.id}`, 'internships']);

    return internship;
  }

  /**
   * Update internship posting
   */
  async updateInternshipPosting(userId: string, internshipId: string, updateData: Prisma.InternshipUpdateInput) {
    const industry = await this.prisma.industry.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    const internship = await this.prisma.internship.findFirst({
      where: {
        id: internshipId,
        industryId: industry.id,
      },
    });

    if (!internship) {
      throw new NotFoundException('Internship not found');
    }

    const oldValues = {
      title: internship.title,
      status: internship.status,
      numberOfPositions: internship.numberOfPositions,
    };

    const updated = await this.prisma.internship.update({
      where: { id: internshipId },
      data: updateData,
    });

    // Audit internship update
    this.auditService.log({
      action: AuditAction.INTERNSHIP_UPDATE,
      entityType: 'Internship',
      entityId: internshipId,
      userId,
      userName: industry.user?.name,
      userRole: industry.user?.role || Role.INDUSTRY,
      description: `Internship posting updated: ${internship.title}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: internship.institutionId || undefined,
      oldValues,
      newValues: updateData as any,
    }).catch(() => {});

    await this.cache.invalidateByTags(['industry', `internship:${internshipId}`]);

    return updated;
  }

  /**
   * Delete/Deactivate internship posting
   */
  async deleteInternshipPosting(userId: string, internshipId: string) {
    const industry = await this.prisma.industry.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    const internship = await this.prisma.internship.findFirst({
      where: {
        id: internshipId,
        industryId: industry.id,
      },
    });

    if (!internship) {
      throw new NotFoundException('Internship not found');
    }

    // Check if there are active applications
    const activeApplicationsCount = await this.prisma.internshipApplication.count({
      where: {
        internshipId,
        status: { in: [ApplicationStatus.JOINED, ApplicationStatus.SELECTED] },
      },
    });

    if (activeApplicationsCount > 0) {
      throw new BadRequestException(
        `Cannot delete internship with ${activeApplicationsCount} active students`
      );
    }

    const deleted = await this.prisma.internship.update({
      where: { id: internshipId },
      data: {
        isActive: false,
        status: InternshipStatus.INACTIVE,
      },
    });

    // Audit internship deactivation
    this.auditService.log({
      action: AuditAction.INTERNSHIP_DELETE,
      entityType: 'Internship',
      entityId: internshipId,
      userId,
      userName: industry.user?.name,
      userRole: industry.user?.role || Role.INDUSTRY,
      description: `Internship posting deactivated: ${internship.title}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.HIGH,
      institutionId: internship.institutionId || undefined,
      oldValues: {
        internshipId,
        title: internship.title,
        status: internship.status,
        isActive: internship.isActive,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['industry', `internship:${internshipId}`]);

    return deleted;
  }

  /**
   * Get applications for industry's internships
   */
  async getApplications(userId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
    internshipId?: string;
  }) {
    const { page = 1, limit = 10, status, internshipId } = params;
    const skip = (page - 1) * limit;

    const industry = await this.prisma.industry.findUnique({
      where: { userId },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    const where: Prisma.InternshipApplicationWhereInput = {
      internship: {
        industryId: industry.id,
      },
    };

    if (status) {
      where.status = status as ApplicationStatus;
    }

    if (internshipId) {
      where.internshipId = internshipId;
    }

    const [applications, total] = await Promise.all([
      this.prisma.internshipApplication.findMany({
        where,
        skip,
        take: limit,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              rollNumber: true,
              email: true,
              contact: true,
              branchName: true,
              currentYear: true,
              currentSemester: true,
              profileImage: true,
            },
          },
          internship: {
            select: {
              id: true,
              title: true,
              duration: true,
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
   * Get a single application by id (scoped to the industry's internships)
   */
  async getApplicationById(userId: string, applicationId: string) {
    const industry = await this.prisma.industry.findUnique({
      where: { userId },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: applicationId,
        internship: {
          industryId: industry.id,
        },
      },
      include: {
        student: true,
        internship: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  /**
   * Update application status (wrapper around accept/reject + join)
   */
  async updateApplicationStatus(userId: string, applicationId: string, statusData: any) {
    const nextStatus = statusData?.status as ApplicationStatus | undefined;
    if (!nextStatus) {
      throw new BadRequestException('status is required');
    }

    if (nextStatus === ApplicationStatus.SELECTED) {
      return this.acceptApplication(userId, applicationId, {
        selectionDate: statusData?.selectionDate ? new Date(statusData.selectionDate) : undefined,
        joiningDate: statusData?.joiningDate ? new Date(statusData.joiningDate) : undefined,
        notes: statusData?.notes,
      });
    }

    if (nextStatus === ApplicationStatus.REJECTED) {
      return this.rejectApplication(userId, applicationId, statusData?.rejectionReason ?? statusData?.reason);
    }

    if (nextStatus === ApplicationStatus.JOINED) {
      const industry = await this.prisma.industry.findUnique({
        where: { userId },
      });

      if (!industry) {
        throw new NotFoundException('Industry profile not found');
      }

      const application = await this.prisma.internshipApplication.findFirst({
        where: {
          id: applicationId,
          internship: {
            industryId: industry.id,
          },
        },
      });

      if (!application) {
        throw new NotFoundException('Application not found');
      }

      const updated = await this.prisma.internshipApplication.update({
        where: { id: applicationId },
        data: {
          status: ApplicationStatus.JOINED,
          joiningDate: statusData?.joiningDate ? new Date(statusData.joiningDate) : application.joiningDate,
        },
        include: {
          student: true,
          internship: true,
        },
      });

      await this.cache.invalidateByTags(['applications', `application:${applicationId}`]);
      return updated;
    }

    throw new BadRequestException('Unsupported status update');
  }

  /**
   * List industry supervisors (User role = INDUSTRY_SUPERVISOR)
   */
  async getSupervisors(userId: string) {
    const industry = await this.prisma.industry.findUnique({
      where: { userId },
      select: { id: true, institutionId: true },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    if (!industry.institutionId) {
      return [];
    }

    return this.prisma.user.findMany({
      where: {
        institutionId: industry.institutionId,
        role: Role.INDUSTRY_SUPERVISOR,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNo: true,
        active: true,
        designation: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create supervisor by promoting an existing user to INDUSTRY_SUPERVISOR
   */
  async createSupervisor(userId: string, supervisorData: any) {
    const targetUserId = supervisorData?.userId as string | undefined;
    if (!targetUserId) {
      throw new BadRequestException('userId is required');
    }

    const industry = await this.prisma.industry.findUnique({
      where: { userId },
      select: { institutionId: true },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (industry.institutionId && user.institutionId && user.institutionId !== industry.institutionId) {
      throw new BadRequestException('User belongs to a different institution');
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        role: Role.INDUSTRY_SUPERVISOR,
        institutionId: user.institutionId ?? industry.institutionId,
        active: supervisorData?.active ?? user.active,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNo: true,
        active: true,
        role: true,
        institutionId: true,
      },
    });
  }

  /**
   * Update supervisor basic profile fields
   */
  async updateSupervisor(userId: string, supervisorId: string, updateData: any) {
    const industry = await this.prisma.industry.findUnique({
      where: { userId },
      select: { institutionId: true },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    const supervisor = await this.prisma.user.findUnique({
      where: { id: supervisorId },
    });

    if (!supervisor) {
      throw new NotFoundException('Supervisor not found');
    }

    if (supervisor.role !== Role.INDUSTRY_SUPERVISOR) {
      throw new BadRequestException('User is not an industry supervisor');
    }

    if (industry.institutionId && supervisor.institutionId && supervisor.institutionId !== industry.institutionId) {
      throw new BadRequestException('Supervisor belongs to a different institution');
    }

    return this.prisma.user.update({
      where: { id: supervisorId },
      data: {
        name: updateData?.name,
        email: updateData?.email,
        phoneNo: updateData?.phoneNo,
        designation: updateData?.designation,
        active: updateData?.active,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNo: true,
        active: true,
        designation: true,
        role: true,
      },
    });
  }

  /**
   * Accept/Select application
   */
  async acceptApplication(userId: string, applicationId: string, selectionData?: {
    selectionDate?: Date;
    joiningDate?: Date;
    notes?: string;
  }) {
    const industry = await this.prisma.industry.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: applicationId,
        internship: {
          industryId: industry.id,
        },
      },
      include: {
        internship: true,
        student: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status !== ApplicationStatus.APPLIED) {
      throw new BadRequestException('Application is not in applied status');
    }

    // Check if internship has available positions
    const selectedCount = await this.prisma.internshipApplication.count({
      where: {
        internshipId: application.internshipId,
        status: { in: [ApplicationStatus.SELECTED, ApplicationStatus.JOINED] },
      },
    });

    if (selectedCount >= application.internship.numberOfPositions) {
      throw new BadRequestException('All positions for this internship are filled');
    }

    const oldStatus = application.status;

    const updated = await this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.SELECTED,
        isSelected: true,
        selectionDate: selectionData?.selectionDate || new Date(),
        joiningDate: selectionData?.joiningDate,
        notes: selectionData?.notes,
      },
      include: {
        student: true,
        internship: true,
      },
    });

    // Audit application acceptance
    this.auditService.log({
      action: AuditAction.APPLICATION_APPROVE,
      entityType: 'InternshipApplication',
      entityId: applicationId,
      userId,
      userName: industry.user?.name,
      userRole: industry.user?.role || Role.INDUSTRY,
      description: `Application accepted: ${application.student?.name} for ${application.internship?.title}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: application.internship?.institutionId || undefined,
      oldValues: { status: oldStatus },
      newValues: {
        status: ApplicationStatus.SELECTED,
        studentId: application.studentId,
        studentName: application.student?.name,
        internshipTitle: application.internship?.title,
        selectionDate: selectionData?.selectionDate,
        joiningDate: selectionData?.joiningDate,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `application:${applicationId}`]);

    return updated;
  }

  /**
   * Reject application
   */
  async rejectApplication(userId: string, applicationId: string, rejectionReason?: string) {
    const industry = await this.prisma.industry.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: applicationId,
        internship: {
          industryId: industry.id,
        },
      },
      include: { student: true, internship: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status !== ApplicationStatus.APPLIED) {
      throw new BadRequestException('Application is not in applied status');
    }

    const oldStatus = application.status;

    const updated = await this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.REJECTED,
        isSelected: false,
        rejectionReason,
      },
      include: {
        student: true,
      },
    });

    // Audit application rejection
    this.auditService.log({
      action: AuditAction.APPLICATION_REJECT,
      entityType: 'InternshipApplication',
      entityId: applicationId,
      userId,
      userName: industry.user?.name,
      userRole: industry.user?.role || Role.INDUSTRY,
      description: `Application rejected: ${application.student?.name} for ${application.internship?.title}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: application.internship?.institutionId || undefined,
      oldValues: { status: oldStatus },
      newValues: {
        status: ApplicationStatus.REJECTED,
        studentId: application.studentId,
        studentName: application.student?.name,
        internshipTitle: application.internship?.title,
        rejectionReason,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `application:${applicationId}`]);

    return updated;
  }

  /**
   * Submit monthly feedback for student
   */
  async submitMonthlyFeedback(userId: string, feedbackData: {
    applicationId: string;
    feedbackMonth: Date;
    attendanceRating?: number;
    performanceRating?: number;
    punctualityRating?: number;
    technicalSkillsRating?: number;
    strengths?: string;
    areasForImprovement?: string;
    tasksAssigned?: string;
    tasksCompleted?: string;
    overallComments?: string;
    overallRating?: number;
  }) {
    const industry = await this.prisma.industry.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    // Verify application belongs to this industry
    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: feedbackData.applicationId,
        internship: {
          industryId: industry.id,
        },
      },
      include: { student: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status !== ApplicationStatus.JOINED && application.status !== ApplicationStatus.SELECTED) {
      throw new BadRequestException('Can only submit feedback for active internships');
    }

    // Check if feedback for this month already exists
    const existingFeedback = await this.prisma.monthlyFeedback.findFirst({
      where: {
        applicationId: feedbackData.applicationId,
        feedbackMonth: feedbackData.feedbackMonth,
      },
    });

    if (existingFeedback) {
      throw new BadRequestException('Feedback for this month already exists');
    }

    const feedback = await this.prisma.monthlyFeedback.create({
      data: {
        applicationId: feedbackData.applicationId,
        industryId: industry.id,
        studentId: application.studentId,
        internshipId: application.internshipId,
        submittedBy: userId,
        ...feedbackData,
      },
    });

    // Audit monthly feedback submission
    this.auditService.log({
      action: AuditAction.MONTHLY_FEEDBACK_SUBMIT,
      entityType: 'MonthlyFeedback',
      entityId: feedback.id,
      userId,
      userName: industry.user?.name,
      userRole: industry.user?.role || Role.INDUSTRY,
      description: `Monthly feedback submitted for student: ${application.student?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.LOW,
      institutionId: industry.institutionId || undefined,
      newValues: {
        feedbackId: feedback.id,
        applicationId: feedbackData.applicationId,
        studentId: application.studentId,
        studentName: application.student?.name,
        feedbackMonth: feedbackData.feedbackMonth,
        overallRating: feedbackData.overallRating,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['feedback', `application:${feedbackData.applicationId}`]);

    return feedback;
  }

  /**
   * Submit completion feedback
   */
  async submitCompletionFeedback(userId: string, completionData: {
    applicationId: string;
    industryFeedback: string;
    industryRating?: number;
    finalPerformance?: string;
    recommendForHire?: boolean;
    completionCertificate?: string;
  }) {
    const industry = await this.prisma.industry.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    // Verify application belongs to this industry
    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: completionData.applicationId,
        internship: {
          industryId: industry.id,
        },
      },
      include: { student: true, internship: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Check if completion feedback already exists
    const existingFeedback = await this.prisma.completionFeedback.findUnique({
      where: { applicationId: completionData.applicationId },
    });

    if (existingFeedback?.industrySubmittedAt) {
      throw new BadRequestException('Completion feedback already submitted');
    }

    let feedback;
    if (existingFeedback) {
      // Update existing feedback
      feedback = await this.prisma.completionFeedback.update({
        where: { applicationId: completionData.applicationId },
        data: {
          industryFeedback: completionData.industryFeedback,
          industryRating: completionData.industryRating,
          finalPerformance: completionData.finalPerformance,
          recommendForHire: completionData.recommendForHire,
          completionCertificate: completionData.completionCertificate,
          industrySubmittedAt: new Date(),
          industryId: industry.id,
          isCompleted: true,
        },
      });
    } else {
      // Create new feedback
      feedback = await this.prisma.completionFeedback.create({
        data: {
          applicationId: completionData.applicationId,
          industryFeedback: completionData.industryFeedback,
          industryRating: completionData.industryRating,
          finalPerformance: completionData.finalPerformance,
          recommendForHire: completionData.recommendForHire,
          completionCertificate: completionData.completionCertificate,
          industrySubmittedAt: new Date(),
          industryId: industry.id,
          isCompleted: true,
        },
      });
    }

    // Update application status to completed
    await this.prisma.internshipApplication.update({
      where: { id: completionData.applicationId },
      data: {
        status: ApplicationStatus.COMPLETED,
        completionDate: new Date(),
      },
    });

    // Audit completion feedback submission
    this.auditService.log({
      action: AuditAction.COMPLETION_FEEDBACK_SUBMIT,
      entityType: 'CompletionFeedback',
      entityId: feedback.id,
      userId,
      userName: industry.user?.name,
      userRole: industry.user?.role || Role.INDUSTRY,
      description: `Completion feedback submitted for student: ${application.student?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: industry.institutionId || undefined,
      newValues: {
        feedbackId: feedback.id,
        applicationId: completionData.applicationId,
        studentId: application.studentId,
        studentName: application.student?.name,
        internshipTitle: application.internship?.title,
        industryRating: completionData.industryRating,
        recommendForHire: completionData.recommendForHire,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['feedback', `application:${completionData.applicationId}`]);

    return feedback;
  }

  /**
   * Get feedback history
   */
  async getFeedbackHistory(userId: string, params: {
    page?: number;
    limit?: number;
    applicationId?: string;
  }) {
    const { page = 1, limit = 10, applicationId } = params;
    const skip = (page - 1) * limit;

    const industry = await this.prisma.industry.findUnique({
      where: { userId },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    const where: Prisma.MonthlyFeedbackWhereInput = {
      industryId: industry.id,
    };

    if (applicationId) {
      where.applicationId = applicationId;
    }

    const [feedback, total] = await Promise.all([
      this.prisma.monthlyFeedback.findMany({
        where,
        skip,
        take: limit,
        include: {
          application: {
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                  rollNumber: true,
                },
              },
            },
          },
        },
        orderBy: { feedbackMonth: 'desc' },
      }),
      this.prisma.monthlyFeedback.count({ where }),
    ]);

    return {
      feedback,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create industry request (for partnerships, etc.)
   */
  async createRequest(userId: string, requestData: {
    requestType: string;
    title: string;
    description: string;
    requirements?: string;
    expectedOutcome?: string;
    institutionId?: string;
    priority?: string;
  }) {
    const industry = await this.prisma.industry.findUnique({
      where: { userId },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    const request = await this.prisma.industryRequest.create({
      data: {
        industryId: industry.id,
        requestedBy: userId,
        institutionId: requestData.institutionId || industry.institutionId!,
        requestType: requestData.requestType as any,
        title: requestData.title,
        description: requestData.description,
        requirements: requestData.requirements,
        expectedOutcome: requestData.expectedOutcome,
        priority: (requestData.priority as any) || 'MEDIUM',
        status: 'SENT',
      },
    });

    return request;
  }

  /**
   * Get industry requests
   */
  async getRequests(userId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const { page = 1, limit = 10, status } = params;
    const skip = (page - 1) * limit;

    const industry = await this.prisma.industry.findUnique({
      where: { userId },
    });

    if (!industry) {
      throw new NotFoundException('Industry profile not found');
    }

    const where: Prisma.IndustryRequestWhereInput = {
      industryId: industry.id,
    };

    if (status) {
      where.status = status as any;
    }

    const [requests, total] = await Promise.all([
      this.prisma.industryRequest.findMany({
        where,
        skip,
        take: limit,
        include: {
          institution: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.industryRequest.count({ where }),
    ]);

    return {
      requests,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
