import { Module } from '@nestjs/common';
import { DevController, DevPublicController } from './dev.controller';

@Module({
  controllers: [DevController, DevPublicController],
})
export class DevModule {}
