import { Global, Module } from '@nestjs/common';
import { RealtimeGateway } from '../common/realtime/realtime.gateway';

// Lambda-side realtime registration.
//
// Feature services across the codebase inject `RealtimeGateway` directly
// (StaffService, SosService, NoticeService, etc.). In the container, the
// full `RealtimeModule` wires it to Socket.io via `setServer()`. In Lambda,
// we register the same class with no server attached — `emit*` calls fall
// through to a debug log (graceful stub behavior built into the class).
//
// FOLLOW-UP (plan §3): replace this stub with an SNS-publishing subclass
// that publishes to the `marzi-realtime-events` topic. The container's
// `realtime-bridge` Lambda then re-emits to connected Socket.io clients.
// Until that wire is in place, Lambda-originated events simply don't reach
// connected sockets — non-breaking because clients reconnect/refetch.
@Global()
@Module({
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class LambdaRealtimeModule {}
