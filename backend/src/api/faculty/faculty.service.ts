import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { LruCacheService } from '../../core/cache/lru-cache.service';
import { Prisma, ApplicationStatus, MonthlyReportStatus, AuditAction, AuditCategory, AuditSeverity, Role } from '@prisma/client';
import { AuditService } from '../../infrastructure/audit/audit.service';

@Injectable()
export class FacultyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Calculate months between two dates
   * Used to determine expected monthly reports based on internship duration
   */
  private calculateMonthsBetween(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const yearsDiff = end.getFullYear() - start.getFullYear();
    const monthsDiff = end.getMonth() - start.getMonth();

    return Math.max(1, yearsDiff * 12 + monthsDiff + 1); // +1 to include both start and end month
  }

  /**
   * Get faculty profile
   */
  async getProfile(facultyId: string) {
    const faculty = await this.prisma.user.findUnique({
      where: { id: facultyId },
      include: {
        Institution: true,
      },
    });

    if (!faculty) {
      throw new NotFoundException('Faculty not found');
    }

    return faculty;
  }

  /**
   * Get student detail
   */
  async getStudentDetail(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        batch: true,
        branch: true,
        Institution: true,
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
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  /**
   * Get faculty dashboard data with assigned students count and pending reviews
   */
  async getDashboard(facultyId: string) {
    const cacheKey = `faculty:dashboard:${facultyId}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // First, get all student IDs assigned to this faculty
        const assignedStudentIds = await this.prisma.mentorAssignment.findMany({
          where: {
            mentorId: facultyId,
            isActive: true,
          },
          select: { studentId: true },
        });
        const studentIds = assignedStudentIds.map((a) => a.studentId);

        // Only count self-identified internships (not placement-based)
        const [
          assignedStudents,
          activeSelfIdentifiedInternships,
          pendingReports,
          pendingVisits,
          totalVisits,
        ] = await Promise.all([
          // Count assigned students
          Promise.resolve(studentIds.length),
          // Count active self-identified internships for assigned students
          this.prisma.internshipApplication.count({
            where: {
              studentId: { in: studentIds },
              OR: [
                { isSelfIdentified: true },
                { internshipId: null },
              ],
              status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED] },
            },
          }),
          // Count pending monthly reports for assigned students
          // Only count reports for internships that have started
          this.prisma.monthlyReport.count({
            where: {
              application: {
                studentId: { in: studentIds },
                OR: [
                  { isSelfIdentified: true },
                  { internshipId: null },
                ],
                startDate: { lte: new Date() }, // Only count if internship has started
              },
              status: MonthlyReportStatus.SUBMITTED,
            },
          }),
          // Count pending applications (if any) for assigned students
          this.prisma.internshipApplication.count({
            where: {
              studentId: { in: studentIds },
              OR: [
                { isSelfIdentified: true },
                { internshipId: null },
              ],
              status: ApplicationStatus.APPLIED,
            },
          }),
          // Count visit logs - only for internships that have started
          this.prisma.facultyVisitLog.count({
            where: {
              facultyId,
              application: {
                startDate: { lte: new Date() }, // Only count visits for started internships
              },
            },
          }),
        ]);

        // Get recent activities
        const recentVisits = await this.prisma.facultyVisitLog.findMany({
          where: { facultyId },
          take: 5,
          orderBy: { visitDate: 'desc' },
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
        });

        // Only show upcoming visits for internships that have started
        const upcomingVisits = await this.prisma.facultyVisitLog.findMany({
          where: {
            facultyId,
            visitDate: {
              gte: new Date(),
            },
            application: {
              startDate: { lte: new Date() }, // Only show visits for started internships
            },
          },
          take: 5,
          orderBy: { visitDate: 'asc' },
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
        });

        return {
          totalStudents: assignedStudents,
          // Self-identified internships only (no placement-based)
          activeInternships: activeSelfIdentifiedInternships,
          pendingReports,
          pendingApprovals: pendingVisits,
          totalVisits,
          recentActivities: recentVisits,
          upcomingVisits,
        };
      },
      { ttl: 300, tags: ['faculty', `faculty:${facultyId}`] },
    );
  }

  /**
   * Get assigned students list with pagination
   */
  async getAssignedStudents(
    facultyId: string,
    params: { page?: number; limit?: number; search?: string },
  ) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const search = params.search;
    const skip = (page - 1) * limit;

    const where: Prisma.MentorAssignmentWhereInput = {
      mentorId: facultyId,
      isActive: true,
    };

    if (search) {
      where.student = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { rollNumber: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [assignments, total] = await Promise.all([
      this.prisma.mentorAssignment.findMany({
        where,
        skip,
        take: limit,
        include: {
          student: {
            include: {
              batch: true,
              branch: true,
              Institution: {
                select: { id: true, name: true, code: true },
              },
              internshipApplications: {
                where: {
                  OR: [
                    { isSelfIdentified: true },
                    { internshipId: null }, // No linked internship = self-identified
                  ],
                  // Only show active/approved internships for assigned students
                  status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED] },
                },
                include: {
                  internship: {
                    include: {
                      industry: true,
                    },
                  },
                  monthlyReports: {
                    orderBy: { createdAt: 'desc' as const },
                    take: 5,
                  },
                  facultyVisitLogs: {
                    orderBy: { visitDate: 'desc' as const },
                    take: 5,
                  },
                },
                orderBy: { createdAt: 'desc' as const },
              },
              _count: {
                select: {
                  monthlyReports: true,
                },
              },
            },
          },
        },
        orderBy: { assignmentDate: 'desc' },
      }),
      this.prisma.mentorAssignment.count({ where }),
    ]);

    return {
      students: assignments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get student progress details (self-identified internships only)
   */
  async getStudentProgress(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        internshipApplications: {
          where: {
            OR: [
              { isSelfIdentified: true },
              { internshipId: null }, // No linked internship = self-identified
            ],
          },
          include: {
            internship: {
              include: {
                industry: true,
              },
            },
            monthlyReports: {
              orderBy: { reportMonth: 'asc' },
            },
            monthlyFeedbacks: {
              orderBy: { feedbackMonth: 'asc' },
            },
            facultyVisitLogs: {
              orderBy: { visitDate: 'desc' },
            },
            completionFeedback: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Calculate overall progress (self-identified internships only)
    const currentApplication = student.internshipApplications.find(
      app => app.isSelfIdentified && (app.status === ApplicationStatus.JOINED || app.status === ApplicationStatus.APPROVED)
    );

    let overallProgress = 0;
    let completionStatus = 'NOT_STARTED';

    if (currentApplication) {
      // Calculate expected reports dynamically based on months since internship started
      const now = new Date();
      const startDate = currentApplication.startDate;
      const endDate = currentApplication.endDate;

      let totalReportsExpected = 1; // Default to at least 1

      if (startDate) {
        // Calculate months from start date to now (or end date if completed)
        const effectiveEndDate = endDate && new Date(endDate) < now ? new Date(endDate) : now;

        // Only calculate if internship has started
        if (new Date(startDate) <= now) {
          totalReportsExpected = this.calculateMonthsBetween(new Date(startDate), effectiveEndDate);
        }
      } else {
        // Fallback: if no startDate, assume 6 months (legacy behavior)
        totalReportsExpected = 6;
      }

      const submittedReports = currentApplication.monthlyReports.filter(
        r => r.status === MonthlyReportStatus.APPROVED || r.status === MonthlyReportStatus.SUBMITTED
      ).length;

      overallProgress = (submittedReports / totalReportsExpected) * 100;

      if (currentApplication.status === ApplicationStatus.COMPLETED) {
        completionStatus = 'COMPLETED';
      } else if (submittedReports > 0) {
        completionStatus = 'IN_PROGRESS';
      } else {
        completionStatus = 'STARTED';
      }
    }

    return {
      studentId,
      studentName: student.name,
      rollNumber: student.rollNumber,
      overallProgress: Math.round(overallProgress),
      currentInternship: currentApplication,
      monthlyReports: currentApplication?.monthlyReports || [],
      visitLogs: currentApplication?.facultyVisitLogs || [],
      feedback: currentApplication?.monthlyFeedbacks || [],
      completionStatus,
    };
  }

  /**
   * Get visit logs with pagination
   */
  async getVisitLogs(
    facultyId: string,
    params: { page?: number; limit?: number; studentId?: string },
  ) {
    const { studentId } = params;
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.FacultyVisitLogWhereInput = {
      facultyId,
    };

    if (studentId) {
      where.application = {
        studentId,
      };
    }

    const [visitLogs, total] = await Promise.all([
      this.prisma.facultyVisitLog.findMany({
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
            },
          },
        },
        orderBy: { visitDate: 'desc' },
      }),
      this.prisma.facultyVisitLog.count({ where }),
    ]);

    return {
      visitLogs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create visit log (supports quick visit logging)
   * Required fields: applicationId OR studentId, visitType, visitLocation
   * All other fields are optional
   */
  async createVisitLog(facultyId: string, createVisitLogDto: any) {
    const {
      applicationId,
      studentId,
      visitDate,
      visitType,
      visitLocation,
      latitude,
      longitude,
      visitPhotos,
      status,
      ...visitData
    } = createVisitLogDto;

    // Validate required fields
    if (!visitType) {
      throw new BadRequestException('visitType is required');
    }

    if (!visitLocation) {
      throw new BadRequestException('visitLocation is required');
    }

    // Find application - support both applicationId and studentId
    let application;

    if (applicationId) {
      // Direct application ID provided
      application = await this.prisma.internshipApplication.findFirst({
        where: {
          id: applicationId,
          mentorId: facultyId,
        },
      });
    } else if (studentId) {
      // Find active application by student ID
      application = await this.prisma.internshipApplication.findFirst({
        where: {
          studentId,
          mentorId: facultyId,
          status: { in: ['JOINED', 'APPROVED'] },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      throw new BadRequestException('Either applicationId or studentId is required');
    }

    if (!application) {
      throw new NotFoundException('Application not found or you are not the assigned mentor');
    }

    // Validate that visit date is not before internship start date
    const visitDateToUse = visitDate ? new Date(visitDate) : new Date();

    if (application.startDate) {
      const internshipStartDate = new Date(application.startDate);

      if (visitDateToUse < internshipStartDate) {
        throw new BadRequestException(
          `Visit date cannot be before internship start date (${internshipStartDate.toISOString().split('T')[0]})`
        );
      }
    }

    // Count existing visits for this application
    const visitCount = await this.prisma.facultyVisitLog.count({
      where: { applicationId: application.id },
    });

    // Prepare visit data with defaults for quick logging
    const visitLogData: any = {
      applicationId: application.id,
      facultyId,
      internshipId: application.internshipId,
      visitNumber: visitCount + 1,
      visitType,
      visitLocation,
      // Use the already validated visit date
      visitDate: visitDateToUse,
      // Auto-set status to COMPLETED for quick logs if not provided
      status: status || 'COMPLETED',
      // Include GPS coordinates if provided
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
      // Include photo URLs if provided
      ...(visitPhotos && visitPhotos.length > 0 && { visitPhotos }),
      // Include any additional optional fields provided
      ...visitData,
    };

    const visitLog = await this.prisma.facultyVisitLog.create({
      data: visitLogData,
      include: {
        application: {
          include: {
            student: true,
            internship: {
              include: {
                industry: true,
              },
            },
          },
        },
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit visit log creation
    this.auditService.log({
      action: AuditAction.VISIT_LOG_CREATE,
      entityType: 'FacultyVisitLog',
      entityId: visitLog.id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Faculty visit log created: ${visitType} at ${visitLocation}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.LOW,
      institutionId: faculty?.institutionId || undefined,
      newValues: {
        visitLogId: visitLog.id,
        applicationId: application.id,
        studentId: visitLog.application?.student?.id,
        studentName: visitLog.application?.student?.name,
        visitType,
        visitLocation,
        visitDate: visitLog.visitDate,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['visits', `application:${application.id}`, `faculty:${facultyId}`]);

    return visitLog;
  }

  /**
   * Update visit log
   */
  async updateVisitLog(id: string, updateVisitLogDto: any, facultyId?: string) {
    const visitLog = await this.prisma.facultyVisitLog.findUnique({
      where: { id },
      include: { application: { include: { student: true } } },
    });

    if (!visitLog) {
      throw new NotFoundException('Visit log not found');
    }

    const oldValues = {
      visitType: visitLog.visitType,
      visitLocation: visitLog.visitLocation,
      visitDate: visitLog.visitDate,
      status: visitLog.status,
    };

    const updated = await this.prisma.facultyVisitLog.update({
      where: { id },
      data: updateVisitLogDto,
      include: {
        application: {
          include: {
            student: true,
          },
        },
      },
    });

    // Get faculty for audit
    const userId = facultyId || visitLog.facultyId;
    const faculty = await this.prisma.user.findUnique({ where: { id: userId } });

    // Audit visit log update
    this.auditService.log({
      action: AuditAction.VISIT_LOG_UPDATE,
      entityType: 'FacultyVisitLog',
      entityId: id,
      userId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Faculty visit log updated`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.LOW,
      institutionId: faculty?.institutionId || undefined,
      oldValues,
      newValues: updateVisitLogDto,
    }).catch(() => {});

    await this.cache.invalidateByTags(['visits', `visit:${id}`]);

    return updated;
  }

  /**
   * Delete visit log
   */
  async deleteVisitLog(id: string, facultyId?: string) {
    const visitLog = await this.prisma.facultyVisitLog.findUnique({
      where: { id },
      include: { application: { include: { student: true } } },
    });

    if (!visitLog) {
      throw new NotFoundException('Visit log not found');
    }

    const deletedInfo = {
      visitLogId: id,
      applicationId: visitLog.applicationId,
      studentId: visitLog.application?.studentId,
      studentName: visitLog.application?.student?.name,
      visitType: visitLog.visitType,
      visitLocation: visitLog.visitLocation,
      visitDate: visitLog.visitDate,
    };

    await this.prisma.facultyVisitLog.delete({
      where: { id },
    });

    // Get faculty for audit
    const userId = facultyId || visitLog.facultyId;
    const faculty = await this.prisma.user.findUnique({ where: { id: userId } });

    // Audit visit log deletion
    this.auditService.log({
      action: AuditAction.VISIT_LOG_DELETE,
      entityType: 'FacultyVisitLog',
      entityId: id,
      userId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Faculty visit log deleted`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: faculty?.institutionId || undefined,
      oldValues: deletedInfo,
    }).catch(() => {});

    await this.cache.invalidateByTags(['visits', `visit:${id}`]);

    return {
      success: true,
      message: 'Visit log deleted successfully',
    };
  }

  /**
   * Get monthly reports for review
   */
  async getMonthlyReports(
    facultyId: string,
    params: { page?: number; limit?: number; status?: string },
  ) {
    const { status } = params;
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.MonthlyReportWhereInput = {
      application: {
        mentorId: facultyId,
      },
    };

    if (status) {
      where.status = status as MonthlyReportStatus;
    }

    const [reports, total] = await Promise.all([
      this.prisma.monthlyReport.findMany({
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
              internship: {
                include: {
                  industry: {
                    select: {
                      id: true,
                      companyName: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.monthlyReport.count({ where }),
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
   * Review monthly report
   */
  async reviewMonthlyReport(id: string, reviewDto: {
    facultyId: string;
    reviewComments?: string;
    isApproved: boolean;
  }) {
    const report = await this.prisma.monthlyReport.findUnique({
      where: { id },
      include: {
        application: true,
      },
    });

    if (!report) {
      throw new NotFoundException('Monthly report not found');
    }

    // Verify faculty is the mentor
    if (report.application.mentorId !== reviewDto.facultyId) {
      throw new BadRequestException('You are not authorized to review this report');
    }

    const oldStatus = report.status;

    const updated = await this.prisma.monthlyReport.update({
      where: { id },
      data: {
        reviewedBy: reviewDto.facultyId,
        reviewedAt: new Date(),
        reviewComments: reviewDto.reviewComments,
        isApproved: reviewDto.isApproved,
        status: reviewDto.isApproved
          ? MonthlyReportStatus.APPROVED
          : MonthlyReportStatus.REJECTED,
      },
      include: {
        application: {
          include: {
            student: true,
          },
        },
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: reviewDto.facultyId } });

    // Audit report review
    this.auditService.log({
      action: reviewDto.isApproved ? AuditAction.MONTHLY_REPORT_APPROVE : AuditAction.MONTHLY_REPORT_REJECT,
      entityType: 'MonthlyReport',
      entityId: id,
      userId: reviewDto.facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Monthly report ${reviewDto.isApproved ? 'approved' : 'rejected'}: ${report.monthName} ${report.reportYear}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: faculty?.institutionId || undefined,
      oldValues: { status: oldStatus },
      newValues: {
        status: updated.status,
        isApproved: reviewDto.isApproved,
        reviewComments: reviewDto.reviewComments,
        studentId: updated.application?.studentId,
        studentName: updated.application?.student?.name,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['reports', `report:${id}`]);

    return updated;
  }

  /**
   * Get self-identified internship approvals pending review
   */
  async getSelfIdentifiedApprovals(
    facultyId: string,
    params: { page?: number; limit?: number; status?: string },
  ) {
    const { status } = params;
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.InternshipApplicationWhereInput = {
      mentorId: facultyId,
      isSelfIdentified: true,
    };

    if (status) {
      where.status = status as ApplicationStatus;
    } else {
      // Self-identified internships are auto-approved, so default to APPROVED
      where.status = ApplicationStatus.APPROVED;
    }

    const [approvals, total] = await Promise.all([
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
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.internshipApplication.count({ where }),
    ]);

    return {
      approvals,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update self-identified internship approval status
   */
  async updateSelfIdentifiedApproval(id: string, approvalDto: {
    facultyId: string;
    status: 'APPROVED' | 'REJECTED';
    reviewRemarks?: string;
  }) {
    const application = await this.prisma.internshipApplication.findUnique({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (!application.isSelfIdentified) {
      throw new BadRequestException('This is not a self-identified internship');
    }

    // Verify faculty is the mentor
    if (application.mentorId !== approvalDto.facultyId) {
      throw new BadRequestException('You are not authorized to approve this application');
    }

    const oldStatus = application.status;
    const newStatus = approvalDto.status === 'APPROVED'
      ? ApplicationStatus.APPROVED
      : ApplicationStatus.REJECTED;

    const updated = await this.prisma.internshipApplication.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedBy: approvalDto.facultyId,
        reviewedAt: new Date(),
        reviewRemarks: approvalDto.reviewRemarks,
        ...(approvalDto.status === 'REJECTED' && {
          rejectionReason: approvalDto.reviewRemarks,
        }),
      },
      include: {
        student: true,
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: approvalDto.facultyId } });

    // Audit self-identified internship approval/rejection
    this.auditService.log({
      action: approvalDto.status === 'APPROVED' ? AuditAction.APPLICATION_APPROVE : AuditAction.APPLICATION_REJECT,
      entityType: 'InternshipApplication',
      entityId: id,
      userId: approvalDto.facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Self-identified internship ${approvalDto.status.toLowerCase()}: ${updated.student?.name} at ${application.companyName}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: faculty?.institutionId || undefined,
      oldValues: { status: oldStatus },
      newValues: {
        status: newStatus,
        studentId: updated.studentId,
        studentName: updated.student?.name,
        companyName: application.companyName,
        reviewRemarks: approvalDto.reviewRemarks,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `application:${id}`]);

    return updated;
  }

  /**
   * Submit monthly feedback for student (from faculty perspective)
   */
  async submitMonthlyFeedback(facultyId: string, feedbackDto: any) {
    const { applicationId, ...feedbackData } = feedbackDto;

    // Verify application and mentor relationship
    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: applicationId,
        mentorId: facultyId,
      },
      include: { student: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found or you are not the assigned mentor');
    }

    // Note: Monthly feedback is typically submitted by industry, but faculty can add observations
    // This could be an internal note or observation

    const feedback = await this.prisma.monthlyFeedback.create({
      data: {
        applicationId,
        studentId: application.studentId,
        internshipId: application.internshipId,
        submittedBy: facultyId,
        ...feedbackData,
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit feedback submission
    this.auditService.log({
      action: AuditAction.MONTHLY_FEEDBACK_SUBMIT,
      entityType: 'MonthlyFeedback',
      entityId: feedback.id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Monthly feedback submitted for student: ${application.student?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.LOW,
      institutionId: faculty?.institutionId || undefined,
      newValues: {
        feedbackId: feedback.id,
        applicationId,
        studentId: application.studentId,
        studentName: application.student?.name,
        feedbackMonth: feedbackData.feedbackMonth,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['feedback', `application:${applicationId}`]);

    return feedback;
  }

  /**
   * Get feedback history
   */
  async getFeedbackHistory(
    facultyId: string,
    params: { page?: number; limit?: number; studentId?: string },
  ) {
    const { studentId } = params;
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.MonthlyFeedbackWhereInput = {
      application: {
        mentorId: facultyId,
      },
    };

    if (studentId) {
      where.studentId = studentId;
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
              internship: {
                include: {
                  industry: {
                    select: {
                      id: true,
                      companyName: true,
                    },
                  },
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

  // ==================== Internship Management ====================

  /**
   * Get student internships
   */
  async getStudentInternships(studentId: string) {
    const internships = await this.prisma.internshipApplication.findMany({
      where: { studentId },
      include: {
        internship: {
          include: {
            industry: {
              select: {
                id: true,
                companyName: true,
                address: true,
              },
            },
          },
        },
        mentor: {
          select: {
            id: true,
            name: true,
            designation: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { internships };
  }

  /**
   * Update internship application
   */
  async updateInternship(id: string, updateDto: any, facultyId: string) {
    const application = await this.prisma.internshipApplication.findUnique({
      where: { id },
      include: {
        student: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Internship application not found');
    }

    // Verify faculty is the mentor
    if (application.mentorId && application.mentorId !== facultyId) {
      throw new BadRequestException('You are not authorized to update this application');
    }

    const oldValues = {
      status: application.status,
      hasJoined: application.hasJoined,
      isSelected: application.isSelected,
    };

    const updated = await this.prisma.internshipApplication.update({
      where: { id },
      data: {
        status: updateDto.status,
        hasJoined: updateDto.hasJoined,
        isSelected: updateDto.isSelected,
        reviewRemarks: updateDto.remarks,
        joiningDate: updateDto.joiningDate ? new Date(updateDto.joiningDate) : undefined,
        reviewedAt: new Date(),
        reviewedBy: facultyId,
      },
      include: {
        student: true,
        internship: {
          include: {
            industry: true,
          },
        },
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit internship update
    this.auditService.log({
      action: AuditAction.APPLICATION_UPDATE,
      entityType: 'InternshipApplication',
      entityId: id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Internship application updated for student: ${application.student?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: faculty?.institutionId || undefined,
      oldValues,
      newValues: updateDto,
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `application:${id}`]);

    return {
      success: true,
      message: 'Internship updated successfully',
      data: updated,
    };
  }

  /**
   * Delete internship application
   */
  async deleteInternship(id: string, facultyId: string) {
    const application = await this.prisma.internshipApplication.findUnique({
      where: { id },
      include: { student: true },
    });

    if (!application) {
      throw new NotFoundException('Internship application not found');
    }

    // Verify faculty is the mentor
    if (application.mentorId && application.mentorId !== facultyId) {
      throw new BadRequestException('You are not authorized to delete this application');
    }

    const deletedInfo = {
      applicationId: id,
      studentId: application.studentId,
      studentName: application.student?.name,
      companyName: application.companyName,
      status: application.status,
    };

    await this.prisma.internshipApplication.delete({
      where: { id },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit internship deletion
    this.auditService.log({
      action: AuditAction.APPLICATION_WITHDRAW,
      entityType: 'InternshipApplication',
      entityId: id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Internship application deleted for student: ${application.student?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.HIGH,
      institutionId: faculty?.institutionId || undefined,
      oldValues: deletedInfo,
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `application:${id}`]);

    return {
      success: true,
      message: 'Internship application deleted successfully',
    };
  }

  // ==================== Monthly Report Actions ====================

  /**
   * Approve monthly report
   */
  async approveMonthlyReport(id: string, remarks: string, facultyId: string) {
    const report = await this.prisma.monthlyReport.findUnique({
      where: { id },
      include: {
        application: { include: { student: true } },
      },
    });

    if (!report) {
      throw new NotFoundException('Monthly report not found');
    }

    // Verify faculty is the mentor
    if (report.application?.mentorId && report.application.mentorId !== facultyId) {
      throw new BadRequestException('You are not authorized to approve this report');
    }

    const oldStatus = report.status;

    const updated = await this.prisma.monthlyReport.update({
      where: { id },
      data: {
        status: 'APPROVED',
        isApproved: true,
        approvedAt: new Date(),
        approvedBy: facultyId,
        reviewedAt: new Date(),
        reviewedBy: facultyId,
        reviewComments: remarks,
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit report approval
    this.auditService.log({
      action: AuditAction.MONTHLY_REPORT_APPROVE,
      entityType: 'MonthlyReport',
      entityId: id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Monthly report approved: ${report.monthName} ${report.reportYear} for ${report.application?.student?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: faculty?.institutionId || undefined,
      oldValues: { status: oldStatus },
      newValues: {
        status: 'APPROVED',
        remarks,
        studentId: report.studentId,
        studentName: report.application?.student?.name,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['reports', `report:${id}`]);

    return {
      success: true,
      message: 'Monthly report approved successfully',
      data: updated,
    };
  }

  /**
   * Reject monthly report
   */
  async rejectMonthlyReport(id: string, reason: string, facultyId: string) {
    const report = await this.prisma.monthlyReport.findUnique({
      where: { id },
      include: {
        application: { include: { student: true } },
      },
    });

    if (!report) {
      throw new NotFoundException('Monthly report not found');
    }

    // Verify faculty is the mentor
    if (report.application?.mentorId && report.application.mentorId !== facultyId) {
      throw new BadRequestException('You are not authorized to reject this report');
    }

    const oldStatus = report.status;

    const updated = await this.prisma.monthlyReport.update({
      where: { id },
      data: {
        status: 'REJECTED',
        isApproved: false,
        reviewedAt: new Date(),
        reviewedBy: facultyId,
        reviewComments: reason,
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit report rejection
    this.auditService.log({
      action: AuditAction.MONTHLY_REPORT_REJECT,
      entityType: 'MonthlyReport',
      entityId: id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Monthly report rejected: ${report.monthName} ${report.reportYear} for ${report.application?.student?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: faculty?.institutionId || undefined,
      oldValues: { status: oldStatus },
      newValues: {
        status: 'REJECTED',
        reason,
        studentId: report.studentId,
        studentName: report.application?.student?.name,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['reports', `report:${id}`]);

    return {
      success: true,
      message: 'Monthly report rejected',
      data: updated,
    };
  }

  /**
   * Delete monthly report
   */
  async deleteMonthlyReport(id: string, facultyId: string) {
    const report = await this.prisma.monthlyReport.findUnique({
      where: { id },
      include: {
        application: { include: { student: true } },
      },
    });

    if (!report) {
      throw new NotFoundException('Monthly report not found');
    }

    // Verify faculty is the mentor
    if (report.application?.mentorId && report.application.mentorId !== facultyId) {
      throw new BadRequestException('You are not authorized to delete this report');
    }

    const deletedInfo = {
      reportId: id,
      reportMonth: report.reportMonth,
      reportYear: report.reportYear,
      monthName: report.monthName,
      studentId: report.studentId,
      studentName: report.application?.student?.name,
      status: report.status,
    };

    await this.prisma.monthlyReport.delete({
      where: { id },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit report deletion
    this.auditService.log({
      action: AuditAction.MONTHLY_REPORT_DELETE,
      entityType: 'MonthlyReport',
      entityId: id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Monthly report deleted: ${report.monthName} ${report.reportYear} for ${report.application?.student?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.HIGH,
      institutionId: faculty?.institutionId || undefined,
      oldValues: deletedInfo,
    }).catch(() => {});

    await this.cache.invalidateByTags(['reports', `report:${id}`]);

    return {
      success: true,
      message: 'Monthly report deleted successfully',
    };
  }

  // ==================== Joining Letter Management ====================

  /**
   * Get joining letters for review
   */
  async getJoiningLetters(
    facultyId: string,
    params: { page?: number; limit?: number; status?: string },
  ) {
    const { status } = params;
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.InternshipApplicationWhereInput = {
      mentorId: facultyId,
      joiningLetterUrl: { not: null },
    };

    if (status) {
      where.status = status as any;
    }

    const [letters, total] = await Promise.all([
      this.prisma.internshipApplication.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          joiningLetterUrl: true,
          joiningLetterUploadedAt: true,
          status: true,
          reviewedAt: true,
          reviewedBy: true,
          reviewRemarks: true,
          student: {
            select: {
              id: true,
              name: true,
              rollNumber: true,
              email: true,
            },
          },
          internship: {
            include: {
              industry: {
                select: {
                  id: true,
                  companyName: true,
                },
              },
            },
          },
        },
        orderBy: { joiningLetterUploadedAt: 'desc' },
      }),
      this.prisma.internshipApplication.count({ where }),
    ]);

    return {
      letters,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Verify joining letter
   */
  async verifyJoiningLetter(id: string, remarks: string, facultyId: string) {
    const application = await this.prisma.internshipApplication.findUnique({
      where: { id },
      include: { student: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Verify faculty is the mentor
    if (application.mentorId && application.mentorId !== facultyId) {
      throw new BadRequestException('You are not authorized to verify this joining letter');
    }

    const updated = await this.prisma.internshipApplication.update({
      where: { id },
      data: {
        reviewedBy: facultyId,
        reviewedAt: new Date(),
        reviewRemarks: remarks,
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit joining letter verification
    this.auditService.log({
      action: AuditAction.JOINING_LETTER_VERIFY,
      entityType: 'InternshipApplication',
      entityId: id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Joining letter verified for student: ${application.student?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: faculty?.institutionId || undefined,
      newValues: {
        applicationId: id,
        studentId: application.studentId,
        studentName: application.student?.name,
        remarks,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `application:${id}`]);

    return {
      success: true,
      message: 'Joining letter verified successfully',
      data: updated,
    };
  }

  /**
   * Reject joining letter
   */
  async rejectJoiningLetter(id: string, reason: string, facultyId: string) {
    const application = await this.prisma.internshipApplication.findUnique({
      where: { id },
      include: { student: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Verify faculty is the mentor
    if (application.mentorId && application.mentorId !== facultyId) {
      throw new BadRequestException('You are not authorized to reject this joining letter');
    }

    const updated = await this.prisma.internshipApplication.update({
      where: { id },
      data: {
        reviewedBy: facultyId,
        reviewedAt: new Date(),
        reviewRemarks: reason,
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit joining letter rejection
    this.auditService.log({
      action: AuditAction.JOINING_LETTER_REJECT,
      entityType: 'InternshipApplication',
      entityId: id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Joining letter rejected for student: ${application.student?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: faculty?.institutionId || undefined,
      newValues: {
        applicationId: id,
        studentId: application.studentId,
        studentName: application.student?.name,
        reason,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `application:${id}`]);

    return {
      success: true,
      message: 'Joining letter rejected',
      data: updated,
    };
  }

  /**
   * Delete joining letter
   */
  async deleteJoiningLetter(id: string, facultyId: string) {
    const application = await this.prisma.internshipApplication.findUnique({
      where: { id },
      include: { student: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Verify faculty is the mentor
    if (application.mentorId && application.mentorId !== facultyId) {
      throw new BadRequestException('You are not authorized to delete this joining letter');
    }

    const deletedInfo = {
      applicationId: id,
      studentId: application.studentId,
      studentName: application.student?.name,
      joiningLetterUrl: application.joiningLetterUrl,
    };

    const updated = await this.prisma.internshipApplication.update({
      where: { id },
      data: {
        joiningLetterUrl: null,
        joiningLetterUploadedAt: null,
        reviewedBy: null,
        reviewedAt: null,
        reviewRemarks: null,
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit joining letter deletion
    this.auditService.log({
      action: AuditAction.JOINING_LETTER_DELETE,
      entityType: 'InternshipApplication',
      entityId: id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Joining letter deleted for student: ${application.student?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.HIGH,
      institutionId: faculty?.institutionId || undefined,
      oldValues: deletedInfo,
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `application:${id}`]);

    return {
      success: true,
      message: 'Joining letter deleted successfully',
      data: updated,
    };
  }

  /**
   * Upload joining letter for a student
   */
  async uploadJoiningLetter(applicationId: string, joiningLetterUrl: string, facultyId: string) {
    // Verify application exists and faculty is the mentor
    const application = await this.prisma.internshipApplication.findUnique({
      where: { id: applicationId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            rollNumber: true,
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Verify faculty is the mentor
    if (application.mentorId && application.mentorId !== facultyId) {
      throw new BadRequestException('You are not authorized to upload a joining letter for this application');
    }

    // Update the application with joining letter URL and clear previous review data
    const updated = await this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: {
        joiningLetterUrl,
        joiningLetterUploadedAt: new Date(),
        reviewedBy: null,
        reviewedAt: null,
        reviewRemarks: null,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            rollNumber: true,
          },
        },
        internship: {
          include: {
            industry: {
              select: {
                id: true,
                companyName: true,
              },
            },
          },
        },
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit joining letter upload
    this.auditService.log({
      action: AuditAction.JOINING_LETTER_UPLOAD,
      entityType: 'InternshipApplication',
      entityId: applicationId,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Joining letter uploaded for student: ${application.student?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.LOW,
      institutionId: faculty?.institutionId || undefined,
      newValues: {
        applicationId,
        studentId: application.student?.id,
        studentName: application.student?.name,
        joiningLetterUrl,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `application:${applicationId}`]);

    return {
      success: true,
      message: 'Joining letter uploaded successfully',
      data: updated,
    };
  }
}
