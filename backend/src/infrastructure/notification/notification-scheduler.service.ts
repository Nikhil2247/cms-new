import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from './notification.service';
import { PrismaService } from '../../core/database/prisma.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { ApplicationStatus } from '../../generated/prisma/client';

@Injectable()
export class NotificationSchedulerService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationSchedulerService.name);
  private readonly appUrl: string;

  // Track scheduled timeouts for cleanup
  private scheduledTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private notificationService: NotificationService,
    private prisma: PrismaService,
    private mailService: MailService,
    private configService: ConfigService,
  ) {
    this.appUrl = this.configService.get('FRONTEND_URL') || this.configService.get('APP_URL', 'http://localhost:5173');
  }

  /**
   * Cleanup all scheduled timeouts on module destroy
   */
  onModuleDestroy(): void {
    this.logger.log(`Cleaning up ${this.scheduledTimeouts.size} scheduled notifications`);
    for (const [id, timeout] of this.scheduledTimeouts) {
      clearTimeout(timeout);
      this.logger.debug(`Cleared scheduled notification: ${id}`);
    }
    this.scheduledTimeouts.clear();
  }

  // ============ FACULTY VISIT REMINDERS ============
  /**
   * Remind faculty 7 days before visit is due
   * Runs every day at 9 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendFacultyVisitReminders(): Promise<void> {
    this.logger.log('Checking for pending faculty visits...');
    try {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      // Find faculty supervisors with mentor assignments
      const facultyWithAssignments = await this.prisma.mentorAssignment.findMany({
        where: {
          isActive: true,
          mentor: {
            active: true,
            role: 'TEACHER',
          },
        },
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

      // Group by mentor
      const mentorMap = new Map<string, { mentor: { id: string; name: string; email: string }; studentCount: number }>();

      for (const assignment of facultyWithAssignments) {
        // Check if student has active application without recent visit
        const hasActiveApplication = await this.prisma.internshipApplication.findFirst({
          where: {
            studentId: assignment.studentId,
            status: { in: [ApplicationStatus.JOINED, ApplicationStatus.SELECTED, ApplicationStatus.APPROVED] },
            facultyVisitLogs: {
              none: {
                visitDate: { gte: oneMonthAgo },
              },
            },
          },
        });

        if (hasActiveApplication && assignment.mentor) {
          const existing = mentorMap.get(assignment.mentorId);
          if (existing) {
            existing.studentCount++;
          } else {
            mentorMap.set(assignment.mentorId, {
              mentor: assignment.mentor,
              studentCount: 1,
            });
          }
        }
      }

      // Send notifications to faculty
      for (const [, data] of mentorMap) {
        await this.notificationService.create(
          data.mentor.id,
          'FACULTY_VISIT_REMINDER',
          'Pending Faculty Visits',
          `You have ${data.studentCount} student(s) pending faculty visits. Please schedule visits soon.`,
          { studentCount: data.studentCount },
        );

        await this.mailService.queueMail({
          to: data.mentor.email,
          subject: 'Reminder: Pending Faculty Visits',
          template: 'faculty-visit-reminder',
          context: {
            name: data.mentor.name,
            studentCount: data.studentCount,
            dashboardUrl: `${this.appUrl}/faculty/visits`,
          },
        });
      }

      this.logger.log(`Faculty visit reminders sent to ${mentorMap.size} faculty members`);
    } catch (error) {
      this.logger.error('Failed to send faculty visit reminders', error.stack);
    }
  }

  // ============ STUDENT MONTHLY REPORT REMINDERS ============
  /**
   * Weekly reminder on Mondays for pending monthly reports
   * Runs every Monday at 9 AM
   */
  @Cron('0 9 * * 1') // Monday 9 AM
  async sendMonthlyReportReminder(): Promise<void> {
    this.logger.log('Sending weekly monthly report reminders...');
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Find students with active applications
      const studentsWithActiveApplications = await this.prisma.internshipApplication.findMany({
        where: {
          status: { in: [ApplicationStatus.JOINED, ApplicationStatus.SELECTED, ApplicationStatus.APPROVED] },
        },
        include: {
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  active: true,
                },
              },
            },
          },
        },
      });

      for (const app of studentsWithActiveApplications) {
        if (!app.student?.user?.active) continue;

        // Check if report already submitted
        const existingReport = await this.prisma.monthlyReport.findFirst({
          where: {
            studentId: app.studentId,
            reportMonth: currentMonth,
            reportYear: currentYear,
            status: { in: ['SUBMITTED', 'APPROVED'] },
          },
        });

        if (!existingReport) {
          const userId = app.student.user.id;
          const userEmail = app.student.user.email ;
          const userName = app.student.user.name ;

          await this.notificationService.create(
            userId,
            'MONTHLY_REPORT_REMINDER',
            'Monthly Report Reminder',
            `Please submit your monthly internship report for ${this.getMonthName(currentMonth)} ${currentYear}.`,
            { month: currentMonth, year: currentYear },
          );

          if (userEmail) {
            await this.mailService.queueMail({
              to: userEmail,
              subject: 'Reminder: Submit Your Monthly Internship Report',
              template: 'monthly-report-reminder',
              context: {
                name: userName,
                month: this.getMonthName(currentMonth),
                year: currentYear,
                reportUrl: `${this.appUrl}/student/reports`,
              },
            });
          }
        }
      }

      this.logger.log('Monthly report reminders sent successfully');
    } catch (error) {
      this.logger.error('Failed to send monthly report reminders', error.stack);
    }
  }

  /**
   * Final reminder on 25th of each month for pending reports
   * Runs on 25th of every month at 9 AM
   */
  @Cron('0 9 25 * *') // 25th at 9 AM
  async sendMonthlyReportFinalReminder(): Promise<void> {
    this.logger.log('Sending final monthly report reminders...');
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Find students with active applications
      const studentsWithActiveApplications = await this.prisma.internshipApplication.findMany({
        where: {
          status: { in: [ApplicationStatus.JOINED, ApplicationStatus.SELECTED, ApplicationStatus.APPROVED] },
        },
        include: {
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  active: true,
                },
              },
            },
          },
        },
      });

      for (const app of studentsWithActiveApplications) {
        if (!app.student?.user?.active) continue;

        // Check if report already submitted
        const existingReport = await this.prisma.monthlyReport.findFirst({
          where: {
            studentId: app.studentId,
            reportMonth: currentMonth,
            reportYear: currentYear,
            status: { in: ['SUBMITTED', 'APPROVED'] },
          },
        });

        if (!existingReport) {
          const userId = app.student.user.id;
          const userEmail = app.student.user.email ;
          const userName = app.student.user.name;

          await this.notificationService.create(
            userId,
            'MONTHLY_REPORT_URGENT',
            'URGENT: Monthly Report Due Soon!',
            `Your monthly report for ${this.getMonthName(currentMonth)} ${currentYear} is due by end of month. Submit now!`,
            { month: currentMonth, year: currentYear, urgent: true },
          );

          if (userEmail) {
            await this.mailService.queueMail({
              to: userEmail,
              subject: 'URGENT: Monthly Report Deadline Approaching!',
              template: 'monthly-report-urgent',
              context: {
                name: userName,
                month: this.getMonthName(currentMonth),
                year: currentYear,
                daysLeft: 30 - 25,
                reportUrl: `${this.appUrl}/student/reports`,
              },
            });
          }
        }
      }

      this.logger.log('Urgent report reminders sent successfully');
    } catch (error) {
      this.logger.error('Failed to send urgent report reminders', error.stack);
    }
  }

  // ============ WEEKLY SUMMARY ============
  /**
   * Weekly summary every Monday at 10 AM (in-app only)
   */
  @Cron('0 10 * * 1') // Monday 10 AM
  async sendWeeklySummary(): Promise<void> {
    this.logger.log('Generating weekly summary...');
    try {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      // Get stats for the week
      const [totalApplications, totalReports, newPlacements] = await Promise.all([
        this.prisma.internshipApplication.count({
          where: { createdAt: { gte: lastWeek } },
        }),
        this.prisma.monthlyReport.count({
          where: { submittedAt: { gte: lastWeek } },
        }),
        this.prisma.internshipApplication.count({
          where: {
            status: { in: [ApplicationStatus.JOINED, ApplicationStatus.SELECTED] },
            updatedAt: { gte: lastWeek },
          },
        }),
      ]);

      // Send to principals
      const principals = await this.prisma.user.findMany({
        where: { role: 'PRINCIPAL', active: true },
        select: { id: true, institutionId: true },
      });

      for (const principal of principals) {
        // Get institution-specific stats
        const instApplications = await this.prisma.internshipApplication.count({
          where: {
            createdAt: { gte: lastWeek },
            student: { institutionId: principal.institutionId },
          },
        });

        const instReports = await this.prisma.monthlyReport.count({
          where: {
            submittedAt: { gte: lastWeek },
            student: { institutionId: principal.institutionId },
          },
        });

        await this.notificationService.create(
          principal.id,
          'WEEKLY_SUMMARY',
          'Weekly Institution Summary',
          `This week: ${instApplications} new applications, ${instReports} reports submitted.`,
          {
            newApplications: instApplications,
            submittedReports: instReports,
            weekEnding: new Date().toISOString(),
          },
        );
      }

      // Send state-level summary to STATE_DIRECTORATE users
      const stateUsers = await this.prisma.user.findMany({
        where: { role: 'STATE_DIRECTORATE', active: true },
        select: { id: true },
      });

      for (const user of stateUsers) {
        await this.notificationService.create(
          user.id,
          'WEEKLY_SUMMARY',
          'State-Level Weekly Summary',
          `This week across all institutions: ${totalApplications} applications, ${totalReports} reports, ${newPlacements} new placements.`,
          {
            totalApplications,
            totalReports,
            newPlacements,
            weekEnding: new Date().toISOString(),
          },
        );
      }

      this.logger.log('Weekly summaries sent successfully');
    } catch (error) {
      this.logger.error('Failed to send weekly summary', error.stack);
    }
  }

  // ============ NOTIFICATION CLEANUP ============
  /**
   * Cleanup old read notifications (older than 30 days)
   * Runs every day at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldNotifications(): Promise<void> {
    this.logger.log('Running notification cleanup...');
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Delete read notifications older than 30 days
      const readResult = await this.prisma.notification.deleteMany({
        where: {
          read: true,
          createdAt: { lt: thirtyDaysAgo },
        },
      });

      // Delete unread notifications older than 90 days (even if not read)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const unreadResult = await this.prisma.notification.deleteMany({
        where: {
          read: false,
          createdAt: { lt: ninetyDaysAgo },
        },
      });

      this.logger.log(
        `Notification cleanup complete: ${readResult.count} read (30+ days), ${unreadResult.count} unread (90+ days) deleted`
      );
    } catch (error) {
      this.logger.error('Failed to cleanup old notifications', error.stack);
    }
  }

  // ============ UTILITY METHODS ============
  /**
   * Schedule a notification for a specific user
   * Returns the schedule ID for cancellation if needed
   */
  async scheduleNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    scheduledAt: Date,
    data?: any,
  ): Promise<string | null> {
    try {
      const delay = scheduledAt.getTime() - Date.now();

      if (delay > 0) {
        // Generate unique ID for this scheduled notification
        const scheduleId = `${userId}-${type}-${Date.now()}`;

        const timeout = setTimeout(async () => {
          try {
            await this.notificationService.create(userId, type, title, body, data);
            this.logger.log(`Scheduled notification sent to user ${userId}`);
          } catch (error) {
            this.logger.error(`Failed to send scheduled notification to user ${userId}`, error.stack);
          } finally {
            // Remove from tracking after execution
            this.scheduledTimeouts.delete(scheduleId);
          }
        }, delay);

        // Track the timeout for cleanup
        this.scheduledTimeouts.set(scheduleId, timeout);
        this.logger.log(`Notification scheduled for user ${userId} at ${scheduledAt} (ID: ${scheduleId})`);

        return scheduleId;
      } else {
        this.logger.warn('Scheduled time is in the past, sending immediately');
        await this.notificationService.create(userId, type, title, body, data);
        return null;
      }
    } catch (error) {
      this.logger.error('Failed to schedule notification', error.stack);
      throw error;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  cancelScheduledNotification(scheduleId: string): boolean {
    const timeout = this.scheduledTimeouts.get(scheduleId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledTimeouts.delete(scheduleId);
      this.logger.log(`Cancelled scheduled notification: ${scheduleId}`);
      return true;
    }
    return false;
  }

  /**
   * Get count of pending scheduled notifications
   */
  getPendingScheduledCount(): number {
    return this.scheduledTimeouts.size;
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(
    userIds: string[],
    type: string,
    title: string,
    body: string,
    data?: any,
  ): Promise<void> {
    try {
      const promises = userIds.map((userId) =>
        this.notificationService.create(userId, type, title, body, data),
      );

      await Promise.all(promises);
      this.logger.log(`Bulk notifications sent to ${userIds.length} users`);
    } catch (error) {
      this.logger.error('Failed to send bulk notifications', error.stack);
      throw error;
    }
  }

  /**
   * Get month name from month number
   */
  private getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || 'Unknown';
  }
}
