import { Global, Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { MarziMediaSigner } from './marzi-media-signer.service';

@Global()
@Module({
  providers: [S3Service, MarziMediaSigner],
  exports: [S3Service, MarziMediaSigner],
})
export class StorageModule {}
