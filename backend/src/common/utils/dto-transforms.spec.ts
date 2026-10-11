import { plainToInstance } from 'class-transformer';
import { EnumLabel, toEnumKey } from './dto-transforms';

class Probe {
  @EnumLabel({ SECURITY: 'OTHER' })
  role!: string;
}

describe('toEnumKey', () => {
  it.each([
    ['Deep Clean', 'DEEP_CLEAN'],
    ['  regular ', 'REGULAR'],
    ['DEEP_CLEAN', 'DEEP_CLEAN'],
    ['Possession Letter', 'POSSESSION_LETTER'],
    ['Wash & Dry', 'WASH_DRY'],
  ])('%s → %s', (input, out) => expect(toEnumKey(input)).toBe(out));

  it('leaves non-strings alone', () => expect(toEnumKey(3)).toBe(3));
});

describe('EnumLabel', () => {
  it('normalises and applies aliases', () => {
    expect(plainToInstance(Probe, { role: 'Cook' }).role).toBe('COOK');
    expect(plainToInstance(Probe, { role: 'Security' }).role).toBe('OTHER');
  });
});
