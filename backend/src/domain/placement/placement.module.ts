import { Module } from '@nestjs/common';
import { PlacementService } from './placement.service';

@Module({
  providers: [
    PlacementService,
  ],
  exports: [
    PlacementService,
  ],
})
export class PlacementModule {}
