import { Module } from '@nestjs/common';
import { BulkUserController } from './bulk-user.controller';
import { BulkUserService } from './bulk-user.service';
import { PrismaModule } from '../../core/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BulkUserController],
  providers: [BulkUserService],
  exports: [BulkUserService],
})
export class BulkUserModule {}
