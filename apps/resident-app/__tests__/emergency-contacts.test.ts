import { pickSecurityContact, readEmergencyContacts } from '../src/utils/emergency-contacts';

describe('emergency contacts', () => {
  const response = {
    config: {
      emergencyContacts: [
        { label: 'Manager', phone: '98100 00001' },
        { label: 'Main Gate', phone: ' 98100 00002 ' },
        { label: 'Blank', phone: '' },
      ],
    },
  };

  it('drops rows without a number and trims', () => {
    expect(readEmergencyContacts(response)).toEqual([
      { label: 'Manager', phone: '98100 00001' },
      { label: 'Main Gate', phone: '98100 00002' },
    ]);
  });

  it('prefers the security / gate number', () => {
    expect(pickSecurityContact(response)).toEqual({ label: 'Main Gate', phone: '98100 00002' });
  });

  it('copes with a missing or malformed response', () => {
    expect(readEmergencyContacts(undefined)).toEqual([]);
    expect(pickSecurityContact({ config: { emergencyContacts: 'x' } })).toBeNull();
  });
});
