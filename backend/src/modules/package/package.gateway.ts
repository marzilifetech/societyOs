import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';

@Injectable()
export class PackageGateway {
  constructor(private realtime: RealtimeGateway) {}

  emitPackageArrived(
    residentId: string,
    payload: {
      packageId: string;
      courierName: string;
      trackingNumber: string | null;
      arrivedAt: string;
    },
  ) {
    this.realtime.emit(`resident:${residentId}`, 'package:arrived', payload);
  }
}
