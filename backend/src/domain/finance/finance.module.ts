import { Module } from '@nestjs/common';
import { FeeService } from './fee/fee.service';
import { FeeStructureService } from './fee-structure/fee-structure.service';
import { ScholarshipService } from './scholarship/scholarship.service';

@Module({
  providers: [
    FeeService,
    FeeStructureService,
    ScholarshipService,
  ],
  exports: [
    FeeService,
    FeeStructureService,
    ScholarshipService,
  ],
})
export class FinanceModule {}
