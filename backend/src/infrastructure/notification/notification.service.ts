import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Notification as PrismaNotification, Prisma, NotificationSettings } from '../../generated/prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { WebSocketService } from '../websocket/websocket.service';
import { WebSocketEvent, NotificationPayload } from '../websocket/dto';

interface NotificationOptions {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: string;
}

// Map notification types to settings keys
const TYPE_TO_SETTING_MAP: Record<string, keyof Omit<NotificationSettings, 'id' | 'userId'>> = {
  // Internship related
  'INTERNSHIP_DEADLINE': 'internships',
  'INTERNSHIP_APPLICATION': 'internships',
  'INTERNSHIP_ACCEPTED': 'internships',
  'INTERNSHIP_REJECTED': 'internships',
  'ELIGIBLE_INTERNSHIPS': 'internships',

  // Placement related
  'PLACEMENT_UPDATE': 'placements',
  'PLACEMENT_OFFER': 'placements',

  // Assignment/Report related
  'MONTHLY_REPORT_REMINDER': 'assignments',
  'MONTHLY_REPORT_URGENT': 'assignments',
  'ASSIGNMENT_NEW': 'assignments',
  'ASSIGNMENT_DUE': 'assignments',

  // Attendance related
  'ATTENDANCE_MARKED': 'attendance',
  'ATTENDANCE_WARNING': 'attendance',

  // Exam related
  'EXAM_SCHEDULED': 'examSchedules',
  'EXAM_REMINDER': 'examSchedules',

  // Announcements/General
  'ANNOUNCEMENT': 'announcements',
  'GRIEVANCE_ASSIGNED': 'announcements',
  'GRIEVANCE_UPDATE': 'announcements',
  'GRIEVANCE_STATUS_CHANGED': 'announcements',
  'SUPPORT_TICKET_NEW': 'announcements',
  'WEEKLY_SUMMARY': 'announcements',

  // Fee related
  'FEE_DUE': 'feeReminders',
  'FEE_REMINDER': 'feeReminders',

  // Grades
  'GRADE_PUBLISHED': 'grades',
  'GRADE_UPDATE': 'grades',
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wsService: WebSocketService,
  ) {}

  /**
   * Check if user has enabled notifications for a specific type
   */
  private async isNotificationEnabled(userId: string, type: string): Promise<boolean> {
    try {
      const settingKey = TYPE_TO_SETTING_MAP[type];

      // If notification type is not mapped, allow it (system notifications)
      if (!settingKey) {
        return true;
      }

      const settings = await this.prisma.notificationSettings.findUnique({
        where: { userId },
      });

      // If no settings exist, default to enabled
      if (!settings) {
        return true;
      }

      return settings[settingKey] === true;
    } catch (error) {
      this.logger.warn(`Failed to check notification settings for user ${userId}, defaulting to enabled`);
      return true;
    }
  }

  /**
   * Create a new notification and emit via WebSocket
   * Respects user notification settings
   */
  async create(
    userId: string,
    type: string,
    title: string,
    body: string,
    data?: any,
  ): Promise<PrismaNotification | null> {
    try {
      // Check if user has enabled this notification type
      const isEnabled = await this.isNotificationEnabled(userId, type);
      if (!isEnabled) {
        this.logger.debug(`Notification type ${type} disabled for user ${userId}, skipping`);
        return null;
      }

      const savedNotification = await this.prisma.notification.create({
        data: {
          userId,
          type,
          title,
          body,
          data: (data ?? undefined) as Prisma.InputJsonValue | undefined,
          read: false,
        },
      });
      this.logger.log(`Notification created for user ${userId}`);

      // Emit notification via WebSocket for real-time delivery
      const payload: NotificationPayload = {
        id: savedNotification.id,
        title: savedNotification.title,
        body: savedNotification.body,
        type: savedNotification.type,
        data: savedNotification.data,
        read: savedNotification.read,
        createdAt: savedNotification.createdAt,
      };

      this.wsService.sendNotificationToUser(userId, payload);

      // Also emit updated unread count
      const unreadCount = await this.getUnreadCount(userId);
      this.wsService.sendUnreadCount(userId, unreadCount);

      return savedNotification;
    } catch (error) {
      this.logger.error('Failed to create notification', error.stack);
      throw error;
    }
  }

  /**
   * Create notification bypassing user settings (for critical system notifications)
   */
  async createForced(
    userId: string,
    type: string,
    title: string,
    body: string,
    data?: any,
  ): Promise<PrismaNotification> {
    try {
      const savedNotification = await this.prisma.notification.create({
        data: {
          userId,
          type,
          title,
          body,
          data: (data ?? undefined) as Prisma.InputJsonValue | undefined,
          read: false,
        },
      });
      this.logger.log(`Forced notification created for user ${userId}`);

      // Emit notification via WebSocket for real-time delivery
      const payload: NotificationPayload = {
        id: savedNotification.id,
        title: savedNotification.title,
        body: savedNotification.body,
        type: savedNotification.type,
        data: savedNotification.data,
        read: savedNotification.read,
        createdAt: savedNotification.createdAt,
      };

      this.wsService.sendNotificationToUser(userId, payload);

      const unreadCount = await this.getUnreadCount(userId);
      this.wsService.sendUnreadCount(userId, unreadCount);

      return savedNotification;
    } catch (error) {
      this.logger.error('Failed to create forced notification', error.stack);
      throw error;
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string): Promise<PrismaNotification> {
    try {
      const notification = await this.prisma.notification.findUnique({ where: { id } });

      if (!notification) {
        throw new NotFoundException(`Notification with ID ${id} not found`);
      }

      const updatedNotification = await this.prisma.notification.update({
        where: { id },
        data: { read: true },
      });
      this.logger.log(`Notification ${id} marked as read`);

      return updatedNotification;
    } catch (error) {
      this.logger.error(`Failed to mark notification ${id} as read`, error.stack);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      await this.prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });

      this.logger.log(`All notifications marked as read for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to mark all notifications as read for user ${userId}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get user notifications with pagination and filters
   */
  async getUserNotifications(
    userId: string,
    options: NotificationOptions = {},
  ): Promise<{ notifications: PrismaNotification[]; total: number; page: number; totalPages: number }> {
    try {
      const { page = 1, limit = 20, isRead, type } = options;

      const where: Prisma.NotificationWhereInput = {
        userId,
        ...(isRead !== undefined ? { read: isRead } : {}),
        ...(type ? { type } : {}),
      };

      const [notifications, total] = await Promise.all([
        this.prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.notification.count({ where }),
      ]);

      return {
        notifications,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get notifications for user ${userId}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete a notification (with optional user verification)
   */
  async deleteNotification(id: string, userId?: string): Promise<void> {
    try {
      // If userId provided, verify ownership
      if (userId) {
        const notification = await this.prisma.notification.findFirst({
          where: { id, userId },
        });
        if (!notification) {
          throw new NotFoundException(`Notification with ID ${id} not found or access denied`);
        }
      }

      await this.prisma.notification.delete({ where: { id } });

      this.logger.log(`Notification ${id} deleted`);
    } catch (error) {
      this.logger.error(`Failed to delete notification ${id}`, error.stack);
      throw error;
    }
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await this.prisma.notification.count({
        where: { userId, read: false },
      });

      return count;
    } catch (error) {
      this.logger.error(
        `Failed to get unread count for user ${userId}`,
        error.stack,
      );
      throw error;
    }
  }
}
