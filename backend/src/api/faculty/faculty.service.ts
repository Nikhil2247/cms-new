import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { LruCacheService } from '../../core/cache/lru-cache.service';
import { Prisma, ApplicationStatus, MonthlyReportStatus } from '@prisma/client';

@Injectable()
export class FacultyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
  ) {}

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
        const [
          assignedStudents,
          activeInternships,
          pendingReports,
          pendingVisits,
          totalVisits,
        ] = await Promise.all([
          this.prisma.mentorAssignment.count({
            where: {
              mentorId: facultyId,
              isActive: true,
            },
          }),
          this.prisma.internshipApplication.count({
            where: {
              mentorId: facultyId,
              status: { in: [ApplicationStatus.SELECTED, ApplicationStatus.JOINED] },
            },
          }),
          this.prisma.monthlyReport.count({
            where: {
              application: {
                mentorId: facultyId,
              },
              status: MonthlyReportStatus.SUBMITTED,
            },
          }),
          this.prisma.internshipApplication.count({
            where: {
              mentorId: facultyId,
              isSelfIdentified: true,
              status: ApplicationStatus.APPLIED,
            },
          }),
          this.prisma.facultyVisitLog.count({
            where: {
              facultyId,
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

        const upcomingVisits = await this.prisma.facultyVisitLog.findMany({
          where: {
            facultyId,
            visitDate: {
              gte: new Date(),
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
          activeInternships,
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
              internshipApplications: {
                where: {
                  mentorId: facultyId,
                },
                include: {
                  internship: {
                    include: {
                      industry: true,
                    },
                  },
                },
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
   * Get student progress details
   */
  async getStudentProgress(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        internshipApplications: {
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

    // Calculate overall progress
    const currentApplication = student.internshipApplications.find(
      app => app.status === ApplicationStatus.JOINED || app.status === ApplicationStatus.SELECTED
    );

    let overallProgress = 0;
    let completionStatus = 'NOT_STARTED';

    if (currentApplication) {
      const totalReportsExpected = 6; // Assuming 6 months internship
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
   * Create visit log
   */
  async createVisitLog(facultyId: string, createVisitLogDto: any) {
    const { applicationId, ...visitData } = createVisitLogDto;

    // Verify application exists and faculty is the mentor
    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: applicationId,
        mentorId: facultyId,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found or you are not the assigned mentor');
    }

    // Count existing visits for this application
    const visitCount = await this.prisma.facultyVisitLog.count({
      where: { applicationId },
    });

    const visitLog = await this.prisma.facultyVisitLog.create({
      data: {
        applicationId,
        facultyId,
        internshipId: application.internshipId,
        visitNumber: visitCount + 1,
        ...visitData,
      },
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

    await this.cache.invalidateByTags(['visits', `application:${applicationId}`]);

    return visitLog;
  }

  /**
   * Update visit log
   */
  async updateVisitLog(id: string, updateVisitLogDto: any) {
    const visitLog = await this.prisma.facultyVisitLog.findUnique({
      where: { id },
    });

    if (!visitLog) {
      throw new NotFoundException('Visit log not found');
    }

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

    await this.cache.invalidateByTags(['visits', `visit:${id}`]);

    return updated;
  }

  /**
   * Delete visit log
   */
  async deleteVisitLog(id: string) {
    const visitLog = await this.prisma.facultyVisitLog.findUnique({
      where: { id },
    });

    if (!visitLog) {
      throw new NotFoundException('Visit log not found');
    }

    await this.prisma.facultyVisitLog.delete({
      where: { id },
    });

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
      where.status = ApplicationStatus.APPLIED; // Default to pending
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
}
