import { firstNameOf } from '../src/lib/names';

describe('firstNameOf', () => {
  it.each<[string | null | undefined, string]>([
    ['Asha Rao', 'Asha'],
    ['Asha', 'Asha'],
    ['  Asha   Rao  ', 'Asha'],
    ['Asha\tRao', 'Asha'],
    ['', 'Resident'],
    ['   ', 'Resident'],
    [null, 'Resident'],
    [undefined, 'Resident'],
  ])('%p -> %p', (input, expected) => {
    expect(firstNameOf(input)).toBe(expected);
  });

  it('uses the given fallback', () => {
    expect(firstNameOf(null, 'there')).toBe('there');
  });
});
