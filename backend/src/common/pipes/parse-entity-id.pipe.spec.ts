/**
 * The schema mixes `@default(uuid())` and `@default(cuid())` primary keys.
 * Guarding a cuid route with `ParseUUIDPipe` rejected every real id with
 * `400 Validation failed (uuid is expected)`, which is what made Pest Control
 * "Mark Complete"/"Cancel", vendor edit/delete, package collection and
 * subscription pause/cancel look broken from the dashboard.
 */
import { BadRequestException } from '@nestjs/common';
import { ParseEntityIdPipe, isEntityId } from './parse-entity-id.pipe';

describe('ParseEntityIdPipe', () => {
  const pipe = new ParseEntityIdPipe();

  it.each([
    ['uuid v4', '3f2504e0-4f89-41d3-9a0c-0305e82c3301'],
    ['uuid uppercase', '3F2504E0-4F89-41D3-9A0C-0305E82C3301'],
    ['cuid v1', 'clh3k1x9r0000qzrmn831i7rn'],
    ['cuid2', 'tz4a98xxat96iws9zmbrgj3a'],
  ])('accepts a %s', (_label, id) => {
    expect(pipe.transform(id)).toBe(id);
    expect(isEntityId(id)).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['path traversal', '../../etc/passwd'],
    ['sql-ish', "1' OR '1'='1"],
    ['spaces', 'not an id'],
    ['slash', 'abc/def'],
  ])('rejects %s', (_label, id) => {
    expect(() => pipe.transform(id)).toThrow(BadRequestException);
  });

  it('rejects a non-string', () => {
    expect(isEntityId(undefined)).toBe(false);
    expect(isEntityId(42)).toBe(false);
  });
});
