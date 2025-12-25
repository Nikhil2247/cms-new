import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { NotificationSenderService } from './notification-sender.service';
import { PrismaModule } from '../../core/database/prisma.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [ConfigModule, PrismaModule, MailModule],
  providers: [
    NotificationService,
    NotificationSchedulerService,
    NotificationSenderService,
  ],
  exports: [
    NotificationService,
    NotificationSchedulerService,
    NotificationSenderService,
  ],
})
export class NotificationModule {}
