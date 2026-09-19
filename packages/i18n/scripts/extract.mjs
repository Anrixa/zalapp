#!/usr/bin/env node
/**
 * Regenerate the locale tables from the design hand-off pack.
 *
 *   pnpm --filter @zal/i18n extract
 *
 * The pack at `design/screens/{en,hy,ru}` holds the same nineteen screens in
 * three languages, exported from the same source, so the text nodes line up
 * positionally. This walks them in parallel and pairs each English string with
 * its Armenian and Russian counterpart.
 *
 * It refuses to write anything if the three versions of a screen disagree on
 * how many strings they contain — that misalignment would silently pair the
 * wrong sentences, and a loud failure is much cheaper than a mistranslated
 * price label.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const packDir = join(repoRoot, 'design/screens');
const outDir = join(here, '../src/locales');

/** Venue names, host names and the brand never change script. */
const PROPER_NOUNS = [
  'Dvin Hall',
  'Zvartnots',
  'Ararat Terrace',
  'Nairi',
  'Sevan Pearl',
  'Vernissage',
  'Marine K.',
  'Lilit H.',
  'Zal',
  'ani@email.com',
  'Banquet halls · Yerevan',
];

function textNodes(file) {
  let html = readFileSync(file, 'utf8');
  html = html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const found = [];
  for (const match of html.matchAll(/placeholder="([^"]+)"|>([^<>]+)</g)) {
    const text = decode((match[1] ?? match[2] ?? '').trim());
    if (text && !text.startsWith('&')) found.push(text);
  }
  return found;
}

function decode(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&middot;/g, '·')
    .replace(/&hellip;/g, '…')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&minus;/g, '−')
    .replace(/&bull;/g, '•')
    .replace(/&euro;/g, '€')
    .replace(/&sup2;/g, '²');
}

function translatable(text) {
  if (/^[\d\s.,:·–—/+\-−%]*$/.test(text)) return false;
  if (text.length <= 1) return false;
  if (/^[A-Z]{1,2}$/.test(text)) return false;
  if (text.startsWith('Zal — ')) return false;
  if (/^[\d,]+ AMD$|^\+?[\d ]{6,}$|^ZAL[–-]/.test(text)) return false;
  if (PROPER_NOUNS.some((noun) => text.includes(noun))) return false;
  return true;
}

const screens = readdirSync(join(packDir, 'en')).filter((name) => name.endsWith('.html')).sort();
const hy = {};
const ru = {};
const problems = [];

for (const screen of screens) {
  const en = textNodes(join(packDir, 'en', screen));
  const hyText = textNodes(join(packDir, 'hy', screen));
  const ruText = textNodes(join(packDir, 'ru', screen));

  if (en.length !== hyText.length || en.length !== ruText.length) {
    problems.push(`${screen}: en=${en.length} hy=${hyText.length} ru=${ruText.length}`);
    continue;
  }

  for (let index = 0; index < en.length; index += 1) {
    const key = en[index];
    if (!translatable(key)) continue;
    if (hyText[index] !== key && !(key in hy)) hy[key] = hyText[index];
    if (ruText[index] !== key && !(key in ru)) ru[key] = ruText[index];
  }
}

if (problems.length > 0) {
  console.error('Screens are out of alignment across locales; refusing to write:');
  for (const problem of problems) console.error(`  • ${problem}`);
  process.exit(1);
}

// Only keys present in both tables ship, so a locale cannot go half-translated.
const shared = Object.keys(hy).filter((key) => key in ru);
const pick = (table) =>
  Object.fromEntries(shared.sort().map((key) => [key, table[key]]));

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'hy.json'), `${JSON.stringify(pick(hy), null, 2)}\n`);
writeFileSync(join(outDir, 'ru.json'), `${JSON.stringify(pick(ru), null, 2)}\n`);

console.log(`Extracted ${shared.length} strings from ${screens.length} screens × 3 locales.`);
