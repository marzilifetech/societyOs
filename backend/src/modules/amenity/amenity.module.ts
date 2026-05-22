import { Module } from '@nestjs/common';
import { AmenityController, AdminAmenityController } from './amenity.controller';
import { AmenityService } from './amenity.service';

@Module({
  controllers: [AmenityController, AdminAmenityController],
  providers: [AmenityService],
})
export class AmenityModule {}
