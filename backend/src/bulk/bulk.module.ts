import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BulkUserModule } from './bulk-user/bulk-user.module';
import { BulkStudentModule } from './bulk-student/bulk-student.module';
import { BulkInstitutionModule } from './bulk-institution/bulk-institution.module';
import { TemplateController } from './templates/template.controller';
import { BulkValidationService } from './shared/bulk-validation.service';
import { BulkProcessor } from './shared/bulk.processor';
import { PrismaModule } from '../core/database/prisma.module';
import { BulkUserService } from './bulk-user/bulk-user.service';
import { BulkStudentService } from './bulk-student/bulk-student.service';
import { BulkInstitutionService } from './bulk-institution/bulk-institution.service';

@Module({
  imports: [
    PrismaModule,
    BulkUserModule,
    BulkStudentModule,
    BulkInstitutionModule,
    BullModule.registerQueue({
      name: 'bulk-operations',
    }),
  ],
  controllers: [TemplateController],
  providers: [
    BulkValidationService,
    BulkProcessor,
    BulkUserService,
    BulkStudentService,
    BulkInstitutionService,
  ],
  exports: [
    BulkUserModule,
    BulkStudentModule,
    BulkInstitutionModule,
    BulkValidationService,
  ],
})
export class BulkModule {}
