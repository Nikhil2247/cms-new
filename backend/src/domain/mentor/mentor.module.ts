import { Module } from '@nestjs/common';
import { MentorService } from './mentor.service';

@Module({
  providers: [
    MentorService,
  ],
  exports: [
    MentorService,
  ],
})
export class MentorModule {}
