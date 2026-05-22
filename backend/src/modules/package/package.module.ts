import { Module } from '@nestjs/common';
import { PackageController } from './package.controller';
import { PackageService } from './package.service';
import { PackageGateway } from './package.gateway';

@Module({
  controllers: [PackageController],
  providers: [PackageService, PackageGateway],
})
export class PackageModule {}
