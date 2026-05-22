import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';

@Injectable()
export class ComplaintGateway {
  constructor(private realtime: RealtimeGateway) {}

  emitComplaintUpdated(
    residentId: string,
    payload: {
      complaintId: string;
      status: string;
      message: string | null;
      updatedAt: string;
    },
  ) {
    this.realtime.emit(`resident:${residentId}`, 'complaint:updated', payload);
  }
}
