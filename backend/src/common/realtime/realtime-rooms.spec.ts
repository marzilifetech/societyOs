import { RealtimeGateway, viewerCanSeeRoom } from './realtime.gateway';
import { EventsGateway } from './events.gateway';

describe('viewerCanSeeRoom', () => {
  const resident = { sub: 'u1', societyId: 's1', role: 'RESIDENT' };
  const admin = { sub: 'a1', societyId: 's1', role: 'BUILDING_ADMIN' };

  it('allows the society-wide room and the viewer\'s own rooms', () => {
    expect(viewerCanSeeRoom(resident, 'society:s1')).toBe(true);
    expect(viewerCanSeeRoom(resident, 'society:s1:resident:u1')).toBe(true);
  });

  it('refuses other societies, other users, the admin room and unprefixed rooms', () => {
    expect(viewerCanSeeRoom(resident, 'society:s2')).toBe(false);
    expect(viewerCanSeeRoom(resident, 'society:s1:resident:u2')).toBe(false);
    expect(viewerCanSeeRoom(resident, 'society:s1:admin')).toBe(false);
    expect(viewerCanSeeRoom(resident, 'resident:r1')).toBe(false);
    expect(viewerCanSeeRoom(resident, 'staff:msg:g1')).toBe(false);
    expect(viewerCanSeeRoom(admin, 'society:s1:admin')).toBe(true);
  });

  it('keeps the SOS responders room (names, flats, locations) away from residents', () => {
    expect(viewerCanSeeRoom(resident, 'society:s1:responders')).toBe(false);
    expect(viewerCanSeeRoom(admin, 'society:s1:responders')).toBe(true);
    expect(viewerCanSeeRoom({ sub: 'g1', societyId: 's1', role: 'STAFF' }, 'society:s1:responders')).toBe(true);
  });

  it('sends new SOS alerts to responders, not the society room', () => {
    const gw = new RealtimeGateway();
    const to = jest.fn(() => ({ emit: jest.fn() }));
    gw.setServer({ to });
    gw.emitSosAlert('s1', { id: 'sos-1', lat: 1, lng: 2 });
    expect(to).toHaveBeenCalledWith('society:s1:responders');
    expect(to).not.toHaveBeenCalledWith('society:s1');
  });
});

describe('RealtimeGateway resync buffer', () => {
  it('never replays another society\'s or an unprefixed room\'s events', () => {
    const rt = new RealtimeGateway();
    rt.emit('staff:msg:g1', 'staff:msg', { body: 'private chat' });
    rt.emit('society:s2', 'visitor:arrived', { name: 'other society' });
    rt.emit('society:s1', 'notice', { title: 'mine' });
    const events = rt.getBufferedEvents(null, { sub: 'u1', societyId: 's1', role: 'RESIDENT' });
    expect(events.map((e) => e.event)).toEqual(['notice']);
    expect((events[0] as any).room).toBeUndefined();
  });
});

describe('EventsGateway.roomsFor', () => {
  function gateway(user: object | null, groups: { id: string }[] = []) {
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      staffMessageGroup: { findMany: jest.fn().mockResolvedValue(groups) },
    };
    return new EventsGateway({} as any, {} as any, {} as any, prisma);
  }

  it('joins a guard to their staff and chat rooms — the rooms services emit to', async () => {
    const g = gateway(
      {
        status: 'ACTIVE',
        role: 'STAFF',
        societyId: 's1',
        society: { status: 'ACTIVE' },
        resident: null,
        staffMember: { id: 'sm1', deletedAt: null },
      },
      [{ id: 'g1' }],
    );
    await expect(g.roomsFor('u1')).resolves.toEqual({
      societyId: 's1',
      role: 'STAFF',
      rooms: ['society:s1', 'society:s1:responders', 'society:s1:staff:u1', 'staff:sm1', 'staff:msg:g1'],
    });
  });

  it('joins a resident to their resident room', async () => {
    const g = gateway({
      status: 'ACTIVE',
      role: 'RESIDENT',
      societyId: 's1',
      society: { status: 'ACTIVE' },
      resident: { id: 'r1', deletedAt: null },
      staffMember: null,
    });
    const out = await g.roomsFor('u1');
    expect(out?.rooms).toEqual(['society:s1', 'society:s1:resident:u1', 'resident:r1']);
  });

  it.each([
    [null],
    [{ status: 'INACTIVE', role: 'STAFF', societyId: 's1', society: { status: 'ACTIVE' } }],
    [{ status: 'ACTIVE', role: 'STAFF', societyId: 's1', society: { status: 'SUSPENDED' } }],
  ])('refuses a connection for %j', async (user) => {
    await expect(gateway(user).roomsFor('u1')).resolves.toBeNull();
  });
});
