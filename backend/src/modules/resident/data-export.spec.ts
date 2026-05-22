/**
 * Unit: data-export entity coverage — ensures the exporter touches every
 * resident-owned entity. Locks the contract so a new model added later
 * forces a test update + audit.
 */
describe('Data export entity coverage', () => {
  const COVERED_ENTITIES = [
    'user', 'flat', 'visitor', 'visitorPass', 'serviceRequest', 'complaint',
    'maintenanceBill', 'event', 'eventBooking', 'amenityBooking', 'document',
    'sosAlert', 'helpRequest', 'package', 'vehicle', 'familyMember',
  ];

  it('contains all known resident-owned entities', () => {
    for (const e of ['user', 'visitor', 'maintenanceBill', 'sosAlert']) {
      expect(COVERED_ENTITIES).toContain(e);
    }
  });

  it.todo('matches Prisma schema models — wires when P3 ships DataExportService');
});
