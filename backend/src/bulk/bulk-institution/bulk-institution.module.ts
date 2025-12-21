import { Module } from '@nestjs/common';
import { BulkInstitutionController } from './bulk-institution.controller';
import { BulkInstitutionService } from './bulk-institution.service';
import { PrismaModule } from '../../core/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BulkInstitutionController],
  providers: [BulkInstitutionService],
  exports: [BulkInstitutionService],
})
export class BulkInstitutionModule {}
