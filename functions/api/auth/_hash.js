// functions/api/auth/_hash.js
// Passord-hashing: PBKDF2-HMAC-SHA-256 med per-bruker tilfeldig salt.
// Lagret format i password_hash: "pbkdf2$<iter>$<saltB64url>$<hashB64url>".
// Gamle passord (rå SHA-256 hex med felles salt) gjenkjennes og verifiseres
// fortsatt, og oppgraderes til PBKDF2 ved neste vellykkede innlogging.

const ITERATIONS = 100000;
const LEGACY_SALT = 'finnoss-salt-2026';

// Lag en ny PBKDF2-hash for et passord.
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, ITERATIONS, 32);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

// Verifiser passord mot lagret hash.
// Returnerer { ok, needsUpgrade } – needsUpgrade=true betyr at hashen bør
// skrives om til PBKDF2 (gammelt format eller for få iterasjoner).
export async function verifyPassword(password, stored) {
  if (!stored) return { ok: false, needsUpgrade: false };

  if (stored.startsWith('pbkdf2$')) {
    const [, iterStr, saltB64, hashB64] = stored.split('$');
    const iter = parseInt(iterStr, 10) || ITERATIONS;
    const salt = unb64(saltB64);
    const expected = unb64(hashB64);
    const actual = await pbkdf2(password, salt, iter, expected.length);
    return { ok: timingSafeEqual(actual, expected), needsUpgrade: iter < ITERATIONS };
  }

  // Eldre format: rå SHA-256(passord + felles salt), hex-streng.
  const legacy = await legacyHash(password);
  return { ok: timingSafeEqual(strToU8(legacy), strToU8(stored)), needsUpgrade: true };
}

async function pbkdf2(password, salt, iterations, lenBytes) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, lenBytes * 8
  );
  return new Uint8Array(bits);
}

async function legacyHash(p) {
  const d = new TextEncoder().encode(p + LEGACY_SALT);
  const h = await crypto.subtle.digest('SHA-256', d);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Konstant-tid sammenligning (unngår timing-lekkasje).
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function strToU8(s) { return new TextEncoder().encode(s); }
function b64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
