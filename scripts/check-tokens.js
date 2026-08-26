#!/usr/bin/env node
/**
 * Hlídá překlepy v design tokenech.
 *
 * Colors.card místo Colors.c1 projde TypeScriptem jen tam, kde není typová
 * kontrola, a v běhu se z toho stane `undefined` – prvek se vykreslí bez
 * pozadí a vypadá to jako by chyběl. Přesně tohle bylo v supervisor/requests.
 *
 * Spuštění: node scripts/check-tokens.js   (nenulový exit = nález)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC_DIRS = ['app', 'components', 'hooks', 'store', 'utils', 'services'];

// Klíče čteme přímo z constants/colors.ts – bez transpilace, jen textově.
function keysOfBlock(src, header) {
  const start = src.indexOf(header);
  if (start === -1) return [];
  let depth = 0;
  let i = src.indexOf('{', start);
  const from = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  const body = src.slice(from + 1, i);
  // jen klíče na první úrovni
  const firstLevel = body.replace(/\{[^{}]*\}/g, '');
  return [...firstLevel.matchAll(/(^|\n)\s*([a-zA-Z0-9_]+)\s*:/g)].map(m => m[2]);
}

const src = fs.readFileSync(path.join(ROOT, 'constants/colors.ts'), 'utf8');
const COLORS = keysOfBlock(src, 'export const Colors');
const RADIUS = keysOfBlock(src, 'export const Radius');
const SIZES = keysOfBlock(src.slice(src.indexOf('export const Fonts')), 'sizes:');

if (!COLORS.length || !RADIUS.length || !SIZES.length) {
  console.error('check-tokens: nepodařilo se přečíst constants/colors.ts – kontrola přeskočena');
  process.exit(0);
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const CHECKS = [
  [/Colors\.([a-zA-Z0-9_]+)/g, COLORS, 'Colors'],
  [/Radius\.([a-zA-Z0-9_]+)/g, RADIUS, 'Radius'],
  [/Fonts\.sizes\.([a-zA-Z0-9_]+)/g, SIZES, 'Fonts.sizes'],
];

const bad = [];
for (const dir of SRC_DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const rel = path.relative(ROOT, file);
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, idx) => {
      for (const [re, known, label] of CHECKS) {
        for (const m of line.matchAll(re)) {
          if (label === 'Colors' && m[0].startsWith('Colors.sizes')) continue;
          if (!known.includes(m[1])) bad.push(`${rel}:${idx + 1}  ${label}.${m[1]}`);
        }
      }
    });
  }
}

if (bad.length) {
  console.log(bad.join('\n'));
  console.log(`\n${bad.length} neznámých tokenů`);
  process.exit(1);
}
console.log(`OK – Colors(${COLORS.length}) Radius(${RADIUS.length}) Fonts.sizes(${SIZES.length})`);
