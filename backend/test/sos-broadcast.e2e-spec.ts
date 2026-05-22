/**
 * Integration: SOS broadcast — fan-out via socket gateway (mocked).
 */
describe('SOS broadcast', () => {
  const sockets = {
    server: {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    },
  };

  beforeEach(() => {
    sockets.server.to.mockClear();
    sockets.server.emit.mockClear();
  });

  it('emits sos.alert to society room and admin room', () => {
    const broadcast = (alert: { id: string; societyId: string; type: string }) => {
      sockets.server.to(`society:${alert.societyId}`).emit('sos.alert', alert);
      sockets.server.to(`admin:${alert.societyId}`).emit('sos.alert', alert);
    };
    broadcast({ id: 'a1', societyId: 'soc1', type: 'MEDICAL' });
    expect(sockets.server.to).toHaveBeenCalledWith('society:soc1');
    expect(sockets.server.to).toHaveBeenCalledWith('admin:soc1');
    expect(sockets.server.emit).toHaveBeenCalledTimes(2);
    expect(sockets.server.emit).toHaveBeenCalledWith('sos.alert', expect.objectContaining({ id: 'a1' }));
  });

  it('does not emit cross-society', () => {
    const broadcast = (alert: any) => sockets.server.to(`society:${alert.societyId}`).emit('sos.alert', alert);
    broadcast({ id: 'a1', societyId: 'socA' });
    expect(sockets.server.to).not.toHaveBeenCalledWith('society:socB');
  });
});
