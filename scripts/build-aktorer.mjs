// scripts/build-aktorer.mjs
//
// Bygger app/data/aktorer.json fra de statiske aktørsidene. Kjør:
//   npm run build:aktorer
//
// Datakilde per aktør: JSON-LD (name, address, telephone, url, sameAs) med
// fallback til <title>/<h1> og <meta name="description">. Kategori hentes fra
// hub-karusellene i heggedal/index.html (eneste sted kategori er markert) pluss
// manuelle overstyringer for aktører som ikke ligger i hub-en.
//
// Prinsipp: likebehandling. Ingen vekting, ingen rangering, ingen «utvalgt».
// Sorteres alfabetisk på navn. Aktører som ikke kan mappes til kategori får
// tom kategori i JSON-en og logges som «ukategorisert» i konsollen – ikke gjett.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HUB = join(ROOT, 'heggedal', 'index.html');
const OUT = join(ROOT, 'app', 'data', 'aktorer.json');

// Hub-id -> kanonisk kategori-slug
const CAT_FROM_HUB = { mat: 'mat-drikke', butikk: 'butikker', helse: 'helse-velvaere', tjenester: 'tjenester' };
// Menneskelesbare navn
const KATEGORIER = {
  'mat-drikke': 'Mat & drikke',
  'butikker': 'Butikker',
  'helse-velvaere': 'Helse & velvære',
  'tjenester': 'Tjenester',
};
// Manuelle overstyringer for aktører som ikke ligger i hub-karusellene.
const OVERRIDES = {
  'niftyhr': 'tjenester',
  'posten': 'tjenester',
  'asker-golf-lounge': 'tjenester',
};
// Rot-unntak (aktører utenfor /heggedal/)
const ROOT_AKTORER = ['posten', 'asker-golf-lounge'];

const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
const decode = (s) => s
  .replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
const grab = (re, s) => { const m = s.match(re); return m ? decode(m[1]) : ''; };

// --- Kategori fra hub-karusellene (slug -> kategori-slug) ---
function hubCategories() {
  const html = read(HUB);
  const map = {};
  const marks = [...html.matchAll(/<div id="(mat|butikk|helse|tjenester)"/g)].map(m => ({ id: m[1], i: m.index }));
  marks.push({ id: 'END', i: html.length });
  for (let k = 0; k < marks.length - 1; k++) {
    const seg = html.slice(marks[k].i, marks[k + 1].i);
    const cat = CAT_FROM_HUB[marks[k].id];
    // [^"\/]+ fanger kun ett-segments slugs -> undersider (gulars/vinterkos) ekskluderes
    for (const m of seg.matchAll(/<a class="fo-shop" href="\/heggedal\/([^"\/]+)\/"/g)) {
      if (!map[m[1]]) map[m[1]] = cat;
    }
  }
  return map;
}

// --- JSON-LD-uttrekk ---
function jsonLd(html) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { out.push(JSON.parse(m[1])); } catch { /* hopp over ugyldig */ }
  }
  return out;
}
// Velg forretnings-objektet (ikke FAQ/Blog/Article)
function pickBusiness(lds) {
  const skip = new Set(['FAQPage', 'Blog', 'Article', 'BlogPosting', 'WebPage']);
  return lds.find(d => d && typeof d['@type'] === 'string' && !skip.has(d['@type'])) || null;
}
function buildAddress(a) {
  if (!a || typeof a !== 'object') return '';
  const line2 = [a.postalCode, a.addressLocality].filter(Boolean).join(' ').trim();
  return [a.streetAddress, line2].filter(Boolean).join(', ').trim();
}
function pickWebsite(ld) {
  if (!ld) return '';
  // ekstern url (ikke intern finnoss.no)
  if (ld.url && !/finnoss\.no/i.test(ld.url)) return ld.url;
  // sameAs: første som ikke er en sosial profil
  const same = Array.isArray(ld.sameAs) ? ld.sameAs : (ld.sameAs ? [ld.sameAs] : []);
  const site = same.find(u => !/instagram\.com|facebook\.com|tiktok\.com|linkedin\.com/i.test(u));
  return site || '';
}

// --- Samle aktør-mapper ---
function aktorMapper() {
  const list = [];
  const heggedal = join(ROOT, 'heggedal');
  for (const name of readdirSync(heggedal)) {
    const dir = join(heggedal, name);
    if (name === 'blogg') continue;                          // ikke en aktør
    if (!existsSync(join(dir, 'index.html'))) continue;
    if (!statSync(dir).isDirectory()) continue;
    list.push({ slug: name, file: join(dir, 'index.html'), url: `/heggedal/${name}/` });
  }
  for (const name of ROOT_AKTORER) {
    const f = join(ROOT, name, 'index.html');
    if (existsSync(f)) list.push({ slug: name, file: f, url: `/${name}/` });
  }
  return list;
}

// --- Kjør ---
const hubCat = hubCategories();
const mangler = [];        // aktører uten strukturert data (JSON-LD)
const ukategorisert = [];  // aktører uten kategori
const aktorer = [];

for (const a of aktorMapper()) {
  const html = read(a.file);
  const lds = jsonLd(html);
  const ld = pickBusiness(lds);

  const navnFallback = grab(/<h1[^>]*>([^<]+)<\/h1>/i, html) || grab(/<title>([^<]+)<\/title>/i, html);
  const navn = (ld && ld.name) ? decode(String(ld.name)) : navnFallback;
  if (!ld) mangler.push(a.slug);

  let kortBeskrivelse = grab(/<meta name="description" content="([^"]*)"/i, html);
  if (kortBeskrivelse.length > 160) kortBeskrivelse = kortBeskrivelse.slice(0, 157).trimEnd() + '…';

  const kategori = OVERRIDES[a.slug] || hubCat[a.slug] || '';
  if (!kategori) ukategorisert.push(a.slug);

  aktorer.push({
    slug: a.slug,
    navn,
    kategori,                                   // tom hvis ukategorisert
    kortBeskrivelse,
    adresse: ld ? buildAddress(ld.address) : '',
    telefon: (ld && ld.telephone) ? String(ld.telephone) : '',
    nettside: pickWebsite(ld),
    url: a.url,                                 // intern sti (fra mappenavn, ikke JSON-LD.url)
  });
}

// Sorter alfabetisk på navn (nb) – gjelder også innenfor hver kategori
aktorer.sort((x, y) => x.navn.localeCompare(y.navn, 'nb'));

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ kategorier: KATEGORIER, aktorer }, null, 2) + '\n', 'utf8');

// --- Konsoll-rapport ---
const perKat = {};
for (const k of Object.keys(KATEGORIER)) perKat[k] = aktorer.filter(a => a.kategori === k).length;
console.log(`\n✓ Skrev ${aktorer.length} aktører til ${OUT.replace(ROOT + '/', '')}`);
console.log('  Per kategori:');
for (const [k, label] of Object.entries(KATEGORIER)) console.log(`    ${label.padEnd(16)} ${perKat[k]}`);
console.log(`  Ukategorisert (tom kategori i JSON): ${ukategorisert.length ? ukategorisert.join(', ') : 'ingen'}`);
console.log(`  Mangler strukturert data (JSON-LD):  ${mangler.length ? mangler.join(', ') : 'ingen'}`);
