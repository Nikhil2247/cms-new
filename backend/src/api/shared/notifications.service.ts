import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

interface PaginationParams {
  page?: number;
  limit?: number;
}

interface NotificationSettingsDto {
  assignments?: boolean;
  attendance?: boolean;
  examSchedules?: boolean;
  announcements?: boolean;
  grades?: boolean;
  internships?: boolean;
  placements?: boolean;
  feeReminders?: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get notifications for a user with pagination
   */
  async getNotifications(userId: string, pagination?: PaginationParams) {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const skip = (page - 1) * limit;

      const [notifications, total, unreadCount] = await Promise.all([
        this.prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            title: true,
            body: true,
            type: true,
            data: true,
            read: true,
            createdAt: true,
          },
        }),
        this.prisma.notification.count({
          where: { userId },
        }),
        this.prisma.notification.count({
          where: { userId, read: false },
        }),
      ]);

      return {
        data: notifications,
        unreadCount,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get notifications for user ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(userId: string, notificationId: string) {
    try {
      // Verify the notification belongs to the user
      const notification = await this.prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId,
        },
      });

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      // Mark as read
      const updated = await this.prisma.notification.update({
        where: { id: notificationId },
        data: { read: true },
      });

      this.logger.log(`Notification ${notificationId} marked as read`);

      return {
        success: true,
        message: 'Notification marked as read',
        notification: {
          id: updated.id,
          read: updated.read,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to mark notification ${notificationId} as read`, error.stack);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    try {
      const result = await this.prisma.notification.updateMany({
        where: {
          userId,
          read: false,
        },
        data: {
          read: true,
        },
      });

      this.logger.log(`Marked ${result.count} notifications as read for user ${userId}`);

      return {
        success: true,
        message: 'All notifications marked as read',
        count: result.count,
      };
    } catch (error) {
      this.logger.error(`Failed to mark all notifications as read for user ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(userId: string, notificationId: string) {
    try {
      // Verify the notification belongs to the user
      const notification = await this.prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId,
        },
      });

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      // Delete the notification
      await this.prisma.notification.delete({
        where: { id: notificationId },
      });

      this.logger.log(`Notification ${notificationId} deleted`);

      return {
        success: true,
        message: 'Notification deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete notification ${notificationId}`, error.stack);
      throw error;
    }
  }

  /**
   * Get a notification by ID
   */
  async getNotificationById(userId: string, notificationId: string) {
    try {
      const notification = await this.prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId,
        },
        select: {
          id: true,
          title: true,
          body: true,
          type: true,
          data: true,
          read: true,
          createdAt: true,
        },
      });

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      return notification;
    } catch (error) {
      this.logger.error(`Failed to get notification ${notificationId}`, error.stack);
      throw error;
    }
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(userId: string, notificationIds: string[]) {
    try {
      const result = await this.prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId,
          read: false,
        },
        data: {
          read: true,
        },
      });

      this.logger.log(`Marked ${result.count} notifications as read for user ${userId}`);

      return {
        success: true,
        message: `${result.count} notifications marked as read`,
        count: result.count,
      };
    } catch (error) {
      this.logger.error(`Failed to mark multiple notifications as read for user ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Clear all notifications for a user
   */
  async clearAllNotifications(userId: string) {
    try {
      const result = await this.prisma.notification.deleteMany({
        where: { userId },
      });

      this.logger.log(`Cleared ${result.count} notifications for user ${userId}`);

      return {
        success: true,
        message: `${result.count} notifications cleared`,
        count: result.count,
      };
    } catch (error) {
      this.logger.error(`Failed to clear all notifications for user ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Clear all read notifications for a user
   */
  async clearReadNotifications(userId: string) {
    try {
      const result = await this.prisma.notification.deleteMany({
        where: {
          userId,
          read: true,
        },
      });

      this.logger.log(`Cleared ${result.count} read notifications for user ${userId}`);

      return {
        success: true,
        message: `${result.count} read notifications cleared`,
        count: result.count,
      };
    } catch (error) {
      this.logger.error(`Failed to clear read notifications for user ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete multiple notifications
   */
  async deleteMultipleNotifications(userId: string, notificationIds: string[]) {
    try {
      const result = await this.prisma.notification.deleteMany({
        where: {
          id: { in: notificationIds },
          userId,
        },
      });

      this.logger.log(`Deleted ${result.count} notifications for user ${userId}`);

      return {
        success: true,
        message: `${result.count} notifications deleted`,
        count: result.count,
      };
    } catch (error) {
      this.logger.error(`Failed to delete multiple notifications for user ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string) {
    try {
      const count = await this.prisma.notification.count({
        where: {
          userId,
          read: false,
        },
      });

      return {
        unreadCount: count,
      };
    } catch (error) {
      this.logger.error(`Failed to get unread count for user ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Get notification settings for a user
   */
  async getNotificationSettings(userId: string) {
    try {
      let settings = await this.prisma.notificationSettings.findUnique({
        where: { userId },
        select: {
          id: true,
          assignments: true,
          attendance: true,
          examSchedules: true,
          announcements: true,
          grades: true,
          internships: true,
          placements: true,
          feeReminders: true,
        },
      });

      // Create default settings if none exist
      if (!settings) {
        settings = await this.prisma.notificationSettings.create({
          data: {
            userId,
            assignments: true,
            attendance: true,
            examSchedules: true,
            announcements: true,
            grades: true,
            internships: true,
            placements: true,
            feeReminders: true,
          },
        });
      }

      return settings;
    } catch (error) {
      this.logger.error(`Failed to get notification settings for user ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Update notification settings for a user
   */
  async updateNotificationSettings(userId: string, settingsDto: NotificationSettingsDto) {
    try {
      // Check if settings exist
      const existingSettings = await this.prisma.notificationSettings.findUnique({
        where: { userId },
      });

      let settings;
      if (existingSettings) {
        // Update existing settings
        settings = await this.prisma.notificationSettings.update({
          where: { userId },
          data: settingsDto,
        });
      } else {
        // Create new settings
        settings = await this.prisma.notificationSettings.create({
          data: {
            userId,
            ...settingsDto,
          },
        });
      }

      this.logger.log(`Notification settings updated for user ${userId}`);

      return {
        success: true,
        message: 'Notification settings updated successfully',
        settings: {
          assignments: settings.assignments,
          attendance: settings.attendance,
          examSchedules: settings.examSchedules,
          announcements: settings.announcements,
          grades: settings.grades,
          internships: settings.internships,
          placements: settings.placements,
          feeReminders: settings.feeReminders,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to update notification settings for user ${userId}`, error.stack);
      throw error;
    }
  }
}
