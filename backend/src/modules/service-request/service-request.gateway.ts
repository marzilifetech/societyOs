import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';

@Injectable()
export class ServiceRequestGateway {
  constructor(private realtime: RealtimeGateway) {}

  emitTaskAssigned(
    staffId: string,
    payload: {
      taskId: string;
      title: string;
      address: string;
      urgency: string | null;
      assignedAt: string;
    },
  ) {
    this.realtime.emit(`staff:${staffId}`, 'task:assigned', payload);
  }
}
