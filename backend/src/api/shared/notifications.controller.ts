import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Post,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';

@Controller('shared/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getNotifications(req.user.userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    return this.notificationsService.getUnreadCount(req.user.userId);
  }

  @Get('settings')
  async getNotificationSettings(@Request() req) {
    return this.notificationsService.getNotificationSettings(req.user.userId);
  }

  @Get(':id')
  async getNotificationById(@Param('id') id: string, @Request() req) {
    return this.notificationsService.getNotificationById(req.user.userId, id);
  }

  @Put(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req) {
    return this.notificationsService.markAsRead(req.user.userId, id);
  }

  @Put('read-all')
  async markAllAsRead(@Request() req) {
    return this.notificationsService.markAllAsRead(req.user.userId);
  }

  @Put('mark-read')
  async markMultipleAsRead(@Request() req, @Body() body: { ids: string[] }) {
    return this.notificationsService.markMultipleAsRead(req.user.userId, body.ids);
  }

  @Put('settings')
  async updateNotificationSettings(@Request() req, @Body() settings: any) {
    return this.notificationsService.updateNotificationSettings(
      req.user.userId,
      settings,
    );
  }

  @Delete('clear-all')
  async clearAllNotifications(@Request() req) {
    return this.notificationsService.clearAllNotifications(req.user.userId);
  }

  @Delete('clear-read')
  async clearReadNotifications(@Request() req) {
    return this.notificationsService.clearReadNotifications(req.user.userId);
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: string, @Request() req) {
    return this.notificationsService.deleteNotification(req.user.userId, id);
  }

  @Post('delete-multiple')
  async deleteMultipleNotifications(@Request() req, @Body() body: { ids: string[] }) {
    return this.notificationsService.deleteMultipleNotifications(req.user.userId, body.ids);
  }
}
