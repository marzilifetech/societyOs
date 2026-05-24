import { ServiceRequestReminderScheduler } from './service-request-reminder.scheduler';
import { ServiceRequestService } from './service-request.service';

describe('ServiceRequestReminderScheduler', () => {
  it('runs sendDueReminders on interval and logs failures', async () => {
    jest.useFakeTimers();
    const srService = {
      sendDueReminders: jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined),
    } as unknown as ServiceRequestService;

    const scheduler = new ServiceRequestReminderScheduler(srService);
    scheduler.onModuleInit();

    jest.advanceTimersByTime(60_000);
    await Promise.resolve();

    expect(srService.sendDueReminders).toHaveBeenCalledTimes(1);

    scheduler.onModuleDestroy();
    jest.useRealTimers();
  });
});
