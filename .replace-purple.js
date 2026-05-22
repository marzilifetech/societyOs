#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = '/Users/kandarp/startups/marzi-redesign';
const dirs = [
  path.join(root, 'apps/resident-app/app'),
  path.join(root, 'apps/resident-app/src'),
];
const skip = new Set([
  path.join(root, 'apps/resident-app/app/_layout.tsx'),
  path.join(root, 'apps/resident-app/src/theme/tokens.ts'),
]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const allFiles = [];
dirs.forEach(d => walk(d, allFiles));

let modified = [];
const counts = {
  '#6C63FF': 0,
  '#7B74FF': 0,
  '#8B5CF6': 0,
  '#9D8BFF': 0,
  '#3B3FBF': 0,
  'rgba(108,99,255,': 0,
  'rgba(123,116,255,': 0,
  'Inter_400Regular': 0,
  'Inter_500Medium': 0,
  'Inter_600SemiBold': 0,
  'Inter_700Bold': 0,
};

for (const file of allFiles) {
  if (skip.has(file)) continue;
  const orig = fs.readFileSync(file, 'utf8');
  let next = orig;

  next = next.replace(/#6C63FF/gi, () => { counts['#6C63FF']++; return '#821A52'; });
  next = next.replace(/#7B74FF/gi, () => { counts['#7B74FF']++; return '#821A52'; });
  next = next.replace(/#8B5CF6/gi, () => { counts['#8B5CF6']++; return '#49CDAD'; });
  next = next.replace(/#9D8BFF/gi, () => { counts['#9D8BFF']++; return '#49CDAD'; });
  next = next.replace(/#3B3FBF/gi, () => { counts['#3B3FBF']++; return '#821A52'; });
  next = next.replace(/rgba\(108,\s*99,\s*255,/g, () => { counts['rgba(108,99,255,']++; return 'rgba(130,26,82,'; });
  next = next.replace(/rgba\(123,\s*116,\s*255,/g, () => { counts['rgba(123,116,255,']++; return 'rgba(130,26,82,'; });
  next = next.replace(/Inter_400Regular/g, () => { counts['Inter_400Regular']++; return 'Lato_400Regular'; });
  next = next.replace(/Inter_500Medium/g, () => { counts['Inter_500Medium']++; return 'Lato_400Regular'; });
  next = next.replace(/Inter_600SemiBold/g, () => { counts['Inter_600SemiBold']++; return 'Montserrat_600SemiBold'; });
  next = next.replace(/Inter_700Bold/g, () => { counts['Inter_700Bold']++; return 'Montserrat_700Bold'; });

  if (next !== orig) {
    fs.writeFileSync(file, next);
    modified.push(file);
  }
}

console.log('MODIFIED FILES:', modified.length);
modified.forEach(f => console.log(' ', f));
console.log('\nCOUNTS:');
for (const [k, v] of Object.entries(counts)) console.log(' ', k, '=', v);
