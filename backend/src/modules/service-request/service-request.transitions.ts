import { ServiceRequestStatus } from '@prisma/client';

/** Allowed status targets from each current status (production workflow). */
export const SERVICE_REQUEST_TRANSITIONS: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  [ServiceRequestStatus.PENDING]: [
    ServiceRequestStatus.ASSIGNED,
    ServiceRequestStatus.REJECTED,
    ServiceRequestStatus.CLOSED,
  ],
  [ServiceRequestStatus.ASSIGNED]: [
    ServiceRequestStatus.IN_PROGRESS,
    ServiceRequestStatus.PENDING,
    ServiceRequestStatus.REJECTED,
    ServiceRequestStatus.CLOSED,
  ],
  [ServiceRequestStatus.IN_PROGRESS]: [
    ServiceRequestStatus.COMPLETED,
    ServiceRequestStatus.PENDING,
    ServiceRequestStatus.REJECTED,
    ServiceRequestStatus.CLOSED,
  ],
  [ServiceRequestStatus.COMPLETED]: [ServiceRequestStatus.CLOSED, ServiceRequestStatus.IN_PROGRESS],
  [ServiceRequestStatus.REJECTED]: [ServiceRequestStatus.PENDING],
  [ServiceRequestStatus.CLOSED]: [],
};
