import { parseCsv, rowToRecord, toCsvRow } from './csv.util';

describe('csv.util', () => {
  it('parseCsv handles quoted fields with commas', () => {
    const { headers, rows } = parseCsv('name,note\n"Alice","Hello, world"');
    expect(headers).toEqual(['name', 'note']);
    expect(rows[0]).toEqual(['Alice', 'Hello, world']);
  });

  it('rowToRecord maps headers to values', () => {
    const record = rowToRecord(['name', 'phone'], ['Bob', '123']);
    expect(record).toEqual({ name: 'Bob', phone: '123' });
  });

  it('toCsvRow escapes commas and quotes', () => {
    expect(toCsvRow(['a', 'b,c', 'd"e'])).toBe('a,"b,c","d""e"');
  });
});
