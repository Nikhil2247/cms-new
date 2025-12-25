import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { Role, BackupStatus } from '@prisma/client';
import * as fs from 'fs';

import { MetricsService } from './services/metrics.service';
import { BackupService } from './services/backup.service';
import { UserManagementService } from './services/user-management.service';
import { SessionService } from './services/session.service';

import {
  CreateBackupDto,
  RestoreBackupDto,
  CreateUserDto,
  UpdateUserDto,
  UserQueryDto,
  BulkUserActionDto,
} from './dto';

@Controller('system-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SYSTEM_ADMIN)
export class SystemAdminController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly backupService: BackupService,
    private readonly userManagementService: UserManagementService,
    private readonly sessionService: SessionService,
  ) {}

  // ==========================================
  // HEALTH & METRICS
  // ==========================================

  @Get('health/detailed')
  async getDetailedHealth() {
    return this.metricsService.getDetailedHealth();
  }

  @Get('metrics/realtime')
  async getRealtimeMetrics() {
    return this.metricsService.getRealtimeMetrics();
  }

  // ==========================================
  // BACKUP MANAGEMENT
  // ==========================================

  @Post('backup/create')
  async createBackup(
    @Body() dto: CreateBackupDto,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.backupService.createBackup(dto, user.userId, user.role);
  }

  @Get('backup/list')
  async listBackups(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: BackupStatus,
  ) {
    return this.backupService.listBackups(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      status,
    );
  }

  @Get('backup/download/:id')
  async getBackupDownloadUrl(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.backupService.getBackupDownloadUrl(id);

    // If it's a MinIO signed URL, redirect to it
    if (result.url) {
      return { url: result.url, expiresIn: result.expiresIn };
    }

    // If it's a local file, stream it
    if (result.localPath) {
      const file = fs.createReadStream(result.localPath);
      res.set({
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      });
      return new StreamableFile(file);
    }
  }

  @Post('backup/restore/:id')
  async restoreBackup(
    @Param('id') id: string,
    @Body() dto: RestoreBackupDto,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    if (!dto.confirmRestore) {
      return { error: 'Please confirm the restore operation' };
    }
    return this.backupService.restoreBackup(id, user.userId, user.role);
  }

  @Post('backup/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBackup(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.backupService.uploadBackup(file, user.userId, user.role);
  }

  @Delete('backup/:id')
  async deleteBackup(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.backupService.deleteBackup(id, user.userId, user.role);
  }

  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  @Get('users')
  async getUsers(@Query() query: UserQueryDto) {
    return this.userManagementService.getUsers(query);
  }

  @Get('users/:id')
  async getUserById(@Param('id') id: string) {
    return this.userManagementService.getUserById(id);
  }

  @Post('users')
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.userManagementService.createUser(dto, user.userId, user.role);
  }

  @Put('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.userManagementService.updateUser(id, dto, user.userId, user.role);
  }

  @Delete('users/:id')
  async deleteUser(
    @Param('id') id: string,
    @Query('permanent') permanent: string,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.userManagementService.deleteUser(
      id,
      permanent === 'true',
      user.userId,
      user.role,
    );
  }

  @Post('users/bulk')
  async bulkUserAction(
    @Body() dto: BulkUserActionDto,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.userManagementService.bulkAction(dto, user.userId, user.role);
  }

  @Post('users/:id/reset-password')
  async resetUserPassword(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.userManagementService.resetPassword(id, user.userId, user.role);
  }

  // ==========================================
  // SESSION MANAGEMENT
  // ==========================================

  @Get('sessions')
  async getActiveSessions(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('userId') userId?: string,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.sessionService.getActiveSessions(
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
      userId,
      institutionId,
    );
  }

  @Get('sessions/stats')
  async getSessionStats() {
    return this.sessionService.getSessionStats();
  }

  @Delete('sessions/:id')
  async terminateSession(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.sessionService.terminateSession(id, user.userId, user.role);
  }

  @Post('sessions/terminate-all')
  async terminateAllSessions(
    @Body() options: { exceptCurrent?: boolean; exceptUserId?: string },
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.sessionService.terminateAllSessions(options, user.userId, user.role);
  }

  @Post('sessions/terminate-user/:userId')
  async terminateUserSessions(
    @Param('userId') targetUserId: string,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.sessionService.terminateUserSessions(
      targetUserId,
      user.userId,
      user.role,
    );
  }
}
