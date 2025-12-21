import { Module } from '@nestjs/common';
import { GrievanceService } from './grievance/grievance.service';
import { GrievanceController } from './grievance/grievance.controller';
import { TechnicalQueryService } from './technical-query/technical-query.service';
import { NoticeService } from './notice/notice.service';
import { CalendarService } from './calendar/calendar.service';

@Module({
  controllers: [GrievanceController],
  providers: [
    GrievanceService,
    TechnicalQueryService,
    NoticeService,
    CalendarService,
  ],
  exports: [
    GrievanceService,
    TechnicalQueryService,
    NoticeService,
    CalendarService,
  ],
})
export class SupportModule {}
