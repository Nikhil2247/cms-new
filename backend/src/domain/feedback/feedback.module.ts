import { Module } from '@nestjs/common';
import { MonthlyFeedbackService } from './monthly/monthly-feedback.service';
import { CompletionFeedbackService } from './completion/completion-feedback.service';

@Module({
  providers: [
    MonthlyFeedbackService,
    CompletionFeedbackService,
  ],
  exports: [
    MonthlyFeedbackService,
    CompletionFeedbackService,
  ],
})
export class FeedbackModule {}
