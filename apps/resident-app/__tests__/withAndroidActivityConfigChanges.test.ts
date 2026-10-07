/**
 * The config plugin that keeps MainActivity alive across split screen,
 * pop-up view and fold/unfold. Runs at prebuild, so the manifest edit is
 * checked here rather than on a device.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../plugins/withAndroidActivityConfigChanges');

const { mergeConfigChanges } = plugin;

describe('mergeConfigChanges', () => {
  it("adds smallestScreenSize to Expo's template value", () => {
    const expoTemplate = 'keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode';
    const merged: string[] = mergeConfigChanges(expoTemplate).split('|');
    expect(merged).toContain('smallestScreenSize');
    expect(merged).toEqual(expect.arrayContaining(expoTemplate.split('|')));
  });

  it('keeps flags it does not manage and never duplicates', () => {
    const merged: string[] = mergeConfigChanges('density|keyboard|smallestScreenSize').split('|');
    expect(merged).toContain('density');
    expect(merged.filter((f) => f === 'smallestScreenSize')).toHaveLength(1);
    expect(new Set(merged).size).toBe(merged.length);
  });

  it('is idempotent across repeated prebuilds', () => {
    const once = mergeConfigChanges('keyboard');
    expect(mergeConfigChanges(once)).toBe(once);
  });

  it('handles a missing attribute', () => {
    expect(mergeConfigChanges(undefined)).toBe(
      'keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode',
    );
  });

  it('does not take over density or fontScale (Settings changes must rebuild the UI)', () => {
    const merged: string[] = mergeConfigChanges('').split('|');
    expect(merged).not.toContain('density');
    expect(merged).not.toContain('fontScale');
  });
});
