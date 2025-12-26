import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { MonthlyReportStatus, AuditAction, AuditCategory, AuditSeverity } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';

export interface SubmitReportDto {
  applicationId: string;
  reportMonth: number;
  reportYear: number;
  reportFileUrl?: string;
}

export interface ReviewReportDto {
  status: MonthlyReportStatus;
  reviewComments?: string;
}

@Injectable()
export class MonthlyReportService {
  private readonly logger = new Logger(MonthlyReportService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly auditService: AuditService,
  ) {}

  async submitReport(studentId: string, data: SubmitReportDto) {
    try {
      this.logger.log(`Submitting monthly report for student ${studentId}`);

      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
      });

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      const application = await this.prisma.internshipApplication.findFirst({
        where: {
          id: data.applicationId,
          studentId,
        },
        select: { id: true },
      });

      if (!application) {
        throw new NotFoundException('Internship application not found');
      }

      // Check for duplicate report
      const existingReport = await this.prisma.monthlyReport.findFirst({
        where: {
          applicationId: data.applicationId,
          reportMonth: data.reportMonth,
          reportYear: data.reportYear,
        },
      });

      if (existingReport) {
        throw new BadRequestException('Report for this month already exists');
      }

      const report = await this.prisma.monthlyReport.create({
        data: {
          studentId,
          applicationId: data.applicationId,
          reportMonth: data.reportMonth,
          reportYear: data.reportYear,
          monthName: new Date(data.reportYear, data.reportMonth - 1, 1).toLocaleString(
            'en-US',
            { month: 'long' },
          ),
          reportFileUrl: data.reportFileUrl,
          status: MonthlyReportStatus.SUBMITTED,
          submittedAt: new Date(),
        },
        include: {
          student: {
            select: { id: true, name: true, rollNumber: true },
          },
          application: { select: { id: true } },
        },
      });

      // Invalidate cache
      await this.cache.del(`reports:student:${studentId}`);

      // Audit: Monthly report submitted
      this.auditService.log({
        action: AuditAction.MONTHLY_REPORT_SUBMIT,
        entityType: 'MonthlyReport',
        entityId: report.id,
        userId: student.userId,
        institutionId: student.institutionId,
        category: AuditCategory.INTERNSHIP_WORKFLOW,
        severity: AuditSeverity.LOW,
        description: `Monthly report submitted for ${data.reportMonth}/${data.reportYear}`,
        newValues: {
          reportMonth: data.reportMonth,
          reportYear: data.reportYear,
          applicationId: data.applicationId,
          studentId,
        },
      }).catch(() => {});

      return report;
    } catch (error) {
      this.logger.error(`Failed to submit monthly report: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getReportsByStudent(studentId: string) {
    try {
      const cacheKey = `reports:student:${studentId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.monthlyReport.findMany({
            where: { studentId },
            include: {
              application: {
                include: {
                  internship: {
                    include: {
                      industry: { select: { companyName: true } },
                    },
                  },
                },
              },
            },
            orderBy: [
              { reportYear: 'desc' },
              { reportMonth: 'desc' },
            ],
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get reports for student ${studentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getReportsByMentor(mentorId: string) {
    try {
      const cacheKey = `reports:mentor:${mentorId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.monthlyReport.findMany({
            where: {
              application: { mentorId },
            },
            include: {
              student: {
                select: { id: true, name: true, rollNumber: true },
              },
              application: {
                include: {
                  internship: {
                    include: {
                      industry: { select: { companyName: true } },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get reports for mentor ${mentorId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async reviewReport(
    id: string,
    mentorId: string,
    status: ReviewReportDto['status'],
    reviewComments?: string,
  ) {
    try {
      this.logger.log(`Reviewing report ${id} by mentor ${mentorId}`);

      const report = await this.prisma.monthlyReport.findUnique({
        where: { id },
        include: {
          student: true,
        },
      });

      if (!report) {
        throw new NotFoundException('Report not found');
      }

      const reviewed = await this.prisma.monthlyReport.update({
        where: { id },
        data: {
          status,
          reviewComments,
          reviewedBy: mentorId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          student: { select: { id: true, name: true, rollNumber: true } },
          application: { select: { id: true } },
        },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`reports:student:${report.studentId}`),
        this.cache.del(`reports:mentor:${mentorId}`),
      ]);

      // Audit: Monthly report reviewed
      const auditAction = status === MonthlyReportStatus.APPROVED
        ? AuditAction.MONTHLY_REPORT_APPROVE
        : status === MonthlyReportStatus.REJECTED
          ? AuditAction.MONTHLY_REPORT_REJECT
          : AuditAction.MONTHLY_REPORT_UPDATE;

      this.auditService.log({
        action: auditAction,
        entityType: 'MonthlyReport',
        entityId: id,
        userId: mentorId,
        institutionId: report.student.institutionId,
        category: AuditCategory.INTERNSHIP_WORKFLOW,
        severity: status === MonthlyReportStatus.REJECTED ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
        description: `Monthly report ${status.toLowerCase()}: ${report.monthName} ${report.reportYear}`,
        oldValues: { status: report.status },
        newValues: { status, reviewComments, reviewedBy: mentorId },
      }).catch(() => {});

      return reviewed;
    } catch (error) {
      this.logger.error(`Failed to review report: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getReportStatistics(institutionId: string) {
    try {
      const cacheKey = `report-stats:institution:${institutionId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          // Use groupBy to get all status counts in a single query
          const statusCounts = await this.prisma.monthlyReport.groupBy({
            by: ['status'],
            where: {
              student: {
                institutionId,
              },
            },
            _count: { status: true },
          });

          const countsByStatus = statusCounts.reduce((acc, item) => {
            acc[item.status] = item._count.status;
            return acc;
          }, {} as Record<string, number>);

          const total = statusCounts.reduce((sum, item) => sum + item._count.status, 0);
          const pending = countsByStatus[MonthlyReportStatus.SUBMITTED] ?? 0;
          const approved = countsByStatus[MonthlyReportStatus.APPROVED] ?? 0;
          const rejected = countsByStatus[MonthlyReportStatus.REJECTED] ?? 0;
          const needsRevision = countsByStatus[MonthlyReportStatus.REVISION_REQUIRED] ?? 0;

          return {
            total,
            pending,
            approved,
            rejected,
            needsRevision,
            submissionRate: total > 0 ? Math.round((approved / total) * 100) : 0,
          };
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get report statistics: ${error.message}`, error.stack);
      throw error;
    }
  }
}
