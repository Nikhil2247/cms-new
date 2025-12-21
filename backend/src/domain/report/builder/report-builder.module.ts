import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReportBuilderController } from './report-builder.controller';
import { ReportBuilderService } from './report-builder.service';
import { ReportGeneratorService } from './report-generator.service';
import { ExcelService } from './export/excel.service';
import { PdfService } from './export/pdf.service';
import { CsvService } from './export/csv.service';
import { ReportProcessor } from './report.processor';
import { PrismaModule } from '../../../core/database/prisma.module';
import { CloudinaryModule } from '../../../infrastructure/cloudinary/cloudinary.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'report-generation',
    }),
    PrismaModule,
    CloudinaryModule,
  ],
  controllers: [ReportBuilderController],
  providers: [
    ReportBuilderService,
    ReportGeneratorService,
    ExcelService,
    PdfService,
    CsvService,
    ReportProcessor,
  ],
  exports: [ReportBuilderService],
})
export class ReportBuilderModule {}
