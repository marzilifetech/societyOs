import { WhatsAppService } from './whatsapp.service';

describe('WhatsAppService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_WA_FROM;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('sendMessage returns not configured when env vars missing', async () => {
    const service = new WhatsAppService();
    const result = await service.sendMessage('+919999999999', 'Hello society');
    expect(result).toEqual({ sent: false, reason: 'whatsapp_not_configured' });
  });

  it('sendMessage returns sent when configured', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'sid';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_WA_FROM = '+14155238886';
    const service = new WhatsAppService();
    const result = await service.sendMessage('+919999999999', 'Notice body');
    expect(result).toEqual({ sent: true });
  });

  it('broadcastToSociety aggregates sent and failed counts', async () => {
    const service = new WhatsAppService();
    const result = await service.broadcastToSociety(['+911', '+912'], 'Broadcast');
    expect(result).toEqual({ sent: 0, failed: 2 });
  });

  it('broadcastToSociety counts successes when configured', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'sid';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_WA_FROM = '+14155238886';
    const service = new WhatsAppService();
    const result = await service.broadcastToSociety(['+911', '+912'], 'Broadcast');
    expect(result).toEqual({ sent: 2, failed: 0 });
  });

  it('sendMessage catches delivery errors when configured', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'sid';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_WA_FROM = '+14155238886';
    const service = new WhatsAppService();
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {
      throw new Error('network fail');
    });

    const result = await service.sendMessage('+919999999999', 'Notice body');

    expect(result).toEqual({ sent: false, reason: 'network fail' });
  });
});
