import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Guards the two ways adopting @RequirePermission can go wrong silently.
 *
 * Both failure modes are invisible in review, in TypeScript, and in unit
 * tests of the handlers themselves — they only surface as a 403 in someone's
 * face, or as a check that was never running. So they are asserted here, over
 * the source of every controller.
 *
 * Adoption is INCREMENTAL by design: a route with no @RequirePermission is
 * fine and stays on @Roles. Nothing here demands coverage — only that what IS
 * annotated is annotated correctly.
 */
const SRC = join(__dirname, '..', '..');

const ADMIN_ROLES = new Set(['ADMIN', 'BUILDING_ADMIN', 'SUPER_ADMIN']);
const HTTP_DECORATOR = /^\s*@(Get|Post|Patch|Put|Delete|All)\(/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.controller.ts')) out.push(full);
  }
  return out;
}

const controllers = walk(SRC);

/** Roles named inside a decorator call, e.g. `@Roles(UserRole.ADMIN, ...)`. */
function rolesIn(text: string): string[] {
  const m = text.match(/@Roles\(([^)]*)\)/);
  if (!m) return [];
  return [...m[1].matchAll(/UserRole\.(\w+)/g)].map((x) => x[1]);
}

interface Route {
  file: string;
  line: number;
  signature: string;
  roles: string[];
  requires: string[];
}

/**
 * Split a controller into route blocks. A block runs from one HTTP-method
 * decorator to the next, so any @Roles / @RequirePermission inside it belongs
 * to that route. Everything above the first block is class-level.
 */
function parse(file: string): { classRoles: string[]; usesGuard: boolean; routes: Route[] } {
  const lines = readFileSync(file, 'utf8').split('\n');
  const firstRoute = lines.findIndex((l) => HTTP_DECORATOR.test(l));
  const head = lines.slice(0, firstRoute === -1 ? lines.length : firstRoute).join('\n');

  const classRoles = rolesIn(head);
  const usesGuard = /@UseGuards\([^)]*PermissionsGuard/.test(head.replace(/\s+/g, ' '));

  const routes: Route[] = [];
  if (firstRoute === -1) return { classRoles, usesGuard, routes };

  const starts: number[] = [];
  lines.forEach((l, i) => {
    if (HTTP_DECORATOR.test(l)) starts.push(i);
  });

  starts.forEach((start, idx) => {
    const end = idx + 1 < starts.length ? starts[idx + 1] : lines.length;
    const block = lines.slice(start, end).join('\n');
    const own = rolesIn(block);
    const requires = [...block.matchAll(/PERMISSIONS\.(\w+)/g)].map((x) => x[1]);
    routes.push({
      file,
      line: start + 1,
      signature: lines[start].trim(),
      // A route-level @Roles overrides the class-level one (Reflector
      // getAllAndOverride takes the handler first).
      roles: own.length ? own : classRoles,
      requires: /@RequirePermission\(/.test(block) ? requires : [],
    });
  });

  return { classRoles, usesGuard, routes };
}

const parsed = controllers.map((f) => ({ file: f, ...parse(f) }));
const rel = (f: string) => f.slice(SRC.length + 1);

describe('@RequirePermission adoption', () => {
  it('is never applied to a route reachable by staff or residents', () => {
    /*
     * A STAFF or RESIDENT user has no SocietyAdmin grant, so resolve()
     * returns zero permissions and PermissionsGuard rejects them. Annotating a
     * route those users legitimately call therefore does not tighten it — it
     * breaks it outright, for everyone, on the first request.
     *
     * This is the single reason adoption started with admin.controller.ts:
     * it is uniformly @Roles(ADMIN, SUPER_ADMIN), so there is no such traffic.
     */
    const broken = parsed
      .flatMap((p) => p.routes)
      .filter((r) => r.requires.length > 0)
      .filter((r) => r.roles.length > 0 && !r.roles.every((role) => ADMIN_ROLES.has(role)))
      .map((r) => `${rel(r.file)}:${r.line} ${r.signature} — roles: ${r.roles.join(', ')}`);

    expect(broken).toEqual([]);
  });

  it('is never applied without PermissionsGuard also being wired up', () => {
    /*
     * The worse failure: @RequirePermission with no PermissionsGuard in
     * @UseGuards sets metadata nothing reads. The route looks protected in
     * source and in review, and enforces nothing at runtime.
     */
    const unenforced = parsed
      .filter((p) => !p.usesGuard)
      .filter((p) => p.routes.some((r) => r.requires.length > 0))
      .map((p) => rel(p.file));

    expect(unenforced).toEqual([]);
  });

  it('only references permissions that exist in the catalogue', () => {
    // A typo'd constant is a TS error, but a stale one that was renamed in the
    // catalogue and left behind here would not be. Cheap to assert.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PERMISSIONS } = require('./permissions');
    const known = new Set(Object.keys(PERMISSIONS));

    const unknown = parsed
      .flatMap((p) => p.routes)
      .flatMap((r) => r.requires.map((c) => ({ r, c })))
      .filter(({ c }) => !known.has(c))
      .map(({ r, c }) => `${rel(r.file)}:${r.line} PERMISSIONS.${c}`);

    expect(unknown).toEqual([]);
  });
});
