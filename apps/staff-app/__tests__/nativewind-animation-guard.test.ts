import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Guards the NativeWind + animation constraint that has bitten this app three
 * separate ways.
 *
 * On the pinned stack (NativeWind 4.1.x / react-native-css-interop 0.1.22 /
 * Reanimated 3.x / old architecture) the className interop and animation
 * cannot be applied to the same element:
 *
 *  • `className="animate-pulse"` makes React Native throw
 *    "Looks like you're passing an animation style to a function component
 *    `View`" — the root ErrorBoundary swallows it and the ENTIRE screen becomes
 *    "Something went wrong". Because skeletons render while data loads, this
 *    took down Home and the notification inbox on essentially every cold start.
 *  • Reanimated components throw "Cannot find host instance for this component"
 *    with the same fatal outcome.
 *
 * Neither shows up in TypeScript, in review, or in a snapshot test — only on a
 * real device, in the loading state. So they are checked here instead.
 *
 * If you need a pulse/fade, use src/components/ui/Skeleton.tsx: a plain
 * `Animated.View` with a plain `style` and no className.
 */
const ROOT = join(__dirname, '..');
const SCAN_DIRS = ['app', 'src'];
const EXTENSIONS = ['.tsx', '.ts'];

/** Files legitimately allowed to mention these names (docs + the fix itself). */
const ALLOWLIST = [
  join('src', 'components', 'ui', 'Skeleton.tsx'),
  join('src', 'components', 'attendance', 'SkeletonCard.tsx'),
  join('src', 'components', 'task', 'PhotoViewer.tsx'),
  join('src', 'components', 'ui', 'Tappable.tsx'),
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

/** Strip block and line comments so documentation never trips the guard. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function offenders(pattern: RegExp): string[] {
  return files
    .filter((f) => !ALLOWLIST.some((a) => f.endsWith(a)))
    .filter((f) => pattern.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => f.slice(ROOT.length + 1));
}

describe('NativeWind animation interop guard', () => {
  it('has no Tailwind animation classes (they crash the screen)', () => {
    // `animate-pulse`, `animate-spin`, `animate-bounce`, …
    expect(offenders(/className=(?:"|'|\{`)[^"'`]*\banimate-[a-z]+/)).toEqual([]);
  });

  it('has no react-native-reanimated imports outside the allowlist', () => {
    expect(offenders(/from\s+['"]react-native-reanimated['"]/)).toEqual([]);
  });

  it('has no function-form Pressable style props (silently dropped)', () => {
    // `style={({ pressed }) => ...}` renders with NO style at all under the
    // interop. Use <Tappable style={...} pressedStyle={...} /> instead.
    expect(offenders(/style=\{\(\s*\{\s*pressed/)).toEqual([]);
  });
});
