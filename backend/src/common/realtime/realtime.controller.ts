import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../decorators/current-user.decorator';
import { EventsGateway } from './events.gateway';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Realtime resync: clients pass `since=<isoTimestamp>` to fetch recent socket
 * events captured in an in-memory ring buffer (per process). For durable replay,
 * add a persistent event log later.
 */
@ApiTags('realtime')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('realtime')
export class RealtimeController {
  constructor(
    private events: EventsGateway,
    private realtime: RealtimeGateway,
  ) {}

  @Get('connected')
  connected() {
    return { count: this.events.getConnectedCount() };
  }

  @Get('events')
  resync(@Query('since') since: string, @CurrentUser() user: JwtPayload) {
    const events = this.realtime.getBufferedEvents(since, user.societyId);
    return { since: since || null, events };
  }
}
