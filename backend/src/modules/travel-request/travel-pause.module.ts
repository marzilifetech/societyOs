import { Module } from '@nestjs/common';
import { TravelPauseController, AdminTravelPauseController } from './travel-pause.controller';
import { TravelPauseService } from './travel-pause.service';

@Module({
  controllers: [TravelPauseController, AdminTravelPauseController],
  providers: [TravelPauseService],
})
export class TravelPauseModule {}
