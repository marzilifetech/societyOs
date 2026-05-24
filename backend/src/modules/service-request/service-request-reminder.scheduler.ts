import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ServiceRequestService } from './service-request.service';

@Injectable()
export class ServiceRequestReminderScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServiceRequestReminderScheduler.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private srService: ServiceRequestService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.srService.sendDueReminders().catch((err) => {
        this.logger.warn(`Reminder sweep failed: ${err}`);
      });
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
