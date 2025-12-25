import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';

import { PrismaModule } from '../../core/database/prisma.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { FileStorageModule } from '../../infrastructure/file-storage/file-storage.module';
import { CacheModule } from '../../core/cache/cache.module';

import { SystemAdminController } from './system-admin.controller';
import {
  MetricsService,
  BackupService,
  UserManagementService,
  SessionService,
} from './services';
import { MetricsGateway } from './gateways/metrics.gateway';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    FileStorageModule,
    CacheModule,
    MulterModule.register({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max for backup files
      },
    }),
  ],
  controllers: [SystemAdminController],
  providers: [
    MetricsService,
    BackupService,
    UserManagementService,
    SessionService,
    MetricsGateway,
  ],
  exports: [MetricsService, MetricsGateway],
})
export class SystemAdminModule {}
