import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { ReportsController } from './reports.controller';
import { DocumentsController } from './documents.controller';
import { LookupController } from './lookup.controller';
import { NotificationsService } from './notifications.service';
import { ReportsService } from './reports.service';
import { DocumentsService } from './documents.service';
import { LookupService } from './lookup.service';
import { PrismaModule } from '../../core/database/prisma.module';
import { CloudinaryModule } from '../../infrastructure/cloudinary/cloudinary.module';
import { ReportBuilderModule } from '../../domain/report/builder/report-builder.module';

@Module({
  imports: [
    PrismaModule,
    CloudinaryModule,
    ReportBuilderModule,
  ],
  controllers: [
    NotificationsController,
    ReportsController,
    DocumentsController,
    LookupController,
  ],
  providers: [
    NotificationsService,
    ReportsService,
    DocumentsService,
    LookupService,
  ],
  exports: [
    NotificationsService,
    ReportsService,
    DocumentsService,
    LookupService,
  ],
})
export class SharedModule {}
