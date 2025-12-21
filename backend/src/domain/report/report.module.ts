import { Module } from '@nestjs/common';
import { MonthlyReportService } from './monthly/monthly-report.service';
import { FacultyVisitService } from './faculty-visit/faculty-visit.service';
import { StateReportService } from './state/state-report.service';

@Module({
  providers: [
    MonthlyReportService,
    FacultyVisitService,
    StateReportService,
  ],
  exports: [
    MonthlyReportService,
    FacultyVisitService,
    StateReportService,
  ],
})
export class ReportModule {}
