import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from './notification.service';
import { FcmService } from './fcm.service';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    private notificationService: NotificationService,
    private fcmService: FcmService,
  ) {}

  /**
   * Daily reminder at 9 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendDailyReminders(): Promise<void> {
    this.logger.log('Sending daily reminders');
    try {
      // Implement your daily reminder logic here
      // Example: Send reminders to users who haven't submitted reports
    } catch (error) {
      this.logger.error('Failed to send daily reminders', error.stack);
    }
  }

  /**
   * Weekly summary every Monday at 10 AM
   */
  @Cron(CronExpression.MONDAY_TO_FRIDAY_AT_10AM)
  async sendWeeklySummary(): Promise<void> {
    this.logger.log('Sending weekly summary');
    try {
      // Implement your weekly summary logic here
    } catch (error) {
      this.logger.error('Failed to send weekly summary', error.stack);
    }
  }

  /**
   * Schedule a notification for a specific user
   */
  async scheduleNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    scheduledAt: Date,
    data?: any,
  ): Promise<void> {
    try {
      const delay = scheduledAt.getTime() - Date.now();

      if (delay > 0) {
        setTimeout(async () => {
          await this.notificationService.create(
            userId,
            type,
            title,
            body,
            data,
          );
          this.logger.log(`Scheduled notification sent to user ${userId}`);
        }, delay);

        this.logger.log(
          `Notification scheduled for user ${userId} at ${scheduledAt}`,
        );
      } else {
        this.logger.warn('Scheduled time is in the past, sending immediately');
        await this.notificationService.create(userId, type, title, body, data);
      }
    } catch (error) {
      this.logger.error('Failed to schedule notification', error.stack);
      throw error;
    }
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
}
