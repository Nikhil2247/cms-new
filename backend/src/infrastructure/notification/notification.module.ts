import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { FcmService } from './fcm.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { PrismaModule } from '../../core/database/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [NotificationService, FcmService, NotificationSchedulerService],
  exports: [NotificationService, FcmService, NotificationSchedulerService],
})
export class NotificationModule {}
