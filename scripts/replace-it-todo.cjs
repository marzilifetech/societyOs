/** one-off / re-runnable: rewrite `it.todo('…');` as `it.skip('…', () => {});` in mobile e2e specs. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dirs = [
  path.join(root, 'apps/resident-app/__tests__/e2e'),
  path.join(root, 'apps/staff-app/__tests__/e2e'),
];

const re = /it\.todo\(\s*((['"])((?:\\.|(?!\2).)*)\2)\s*\)\s*;/g;

for (const d of dirs) {
  for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.spec.ts'))) {
    const fp = path.join(d, f);
    let s = fs.readFileSync(fp, 'utf8');
    const m = [...s.matchAll(re)];
    s = s.replace(re, 'it.skip($1, () => {});');
    fs.writeFileSync(fp, s);
    console.log(path.relative(root, fp), m.length);
  }
}
