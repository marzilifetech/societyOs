import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';

@Injectable()
export class VisitorGateway {
  constructor(private realtime: RealtimeGateway) {}

  emitVisitorArrived(
    residentId: string,
    payload: {
      visitorName: string;
      photo: string | null;
      vehicleNumber: string | null;
      time: string;
    },
  ) {
    this.realtime.emit(`resident:${residentId}`, 'visitor:arrived', payload);
  }
}
