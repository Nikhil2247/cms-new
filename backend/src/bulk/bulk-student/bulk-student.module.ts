import { Module } from '@nestjs/common';
import { BulkStudentController } from './bulk-student.controller';
import { BulkStudentService } from './bulk-student.service';
import { PrismaModule } from '../../core/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BulkStudentController],
  providers: [BulkStudentService],
  exports: [BulkStudentService],
})
export class BulkStudentModule {}
