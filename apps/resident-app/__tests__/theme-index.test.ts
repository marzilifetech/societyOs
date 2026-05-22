/**
 * Barrel coverage for src/theme/index.ts
 */

import * as themeBarrel from '../src/theme/index';
import { defaultTokens, seniorTokens } from '../src/theme/tokens';

describe('theme/index barrel', () => {
  it('exports defaultTokens', () => {
    expect(themeBarrel.defaultTokens).toBe(defaultTokens);
  });

  it('exports seniorTokens', () => {
    expect(themeBarrel.seniorTokens).toBe(seniorTokens);
  });

  it('defaultTokens has expected token keys', () => {
    expect(typeof themeBarrel.defaultTokens.fontBase).toBe('number');
    expect(typeof themeBarrel.defaultTokens.accentPrimary).toBe('string');
  });
});
