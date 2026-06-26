import { verifyPassword, hashPassword } from './_hash.js';

const WINDOW_MIN = 15;   // tidsvindu for telling av feilforsøk
const MAX_ATTEMPTS = 10; // maks feilforsøk per IP i vinduet

export async function onRequestPost({ request, env }) {
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const nowMs = Date.now();
    const cutoff = new Date(nowMs - WINDOW_MIN * 60 * 1000).toISOString();

    // Rate-limit: for mange feilforsøk fra denne IP-en?
    if (await tooManyAttempts(env, ip, cutoff)) {
      return json({ error: 'For mange forsøk. Vent noen minutter og prøv igjen.' }, 429);
    }

    const { email, password } = await request.json();
    if (!email || !password) return json({ error: 'E-post og passord er påkrevd.' }, 400);

    const emailLc = email.toLowerCase();
    const user = await env.DB.prepare(
      'SELECT id, name, email, phone, password_hash FROM users WHERE email = ?'
    ).bind(emailLc).first();

    let verified = false, needsUpgrade = false;
    if (user) {
      const r = await verifyPassword(password, user.password_hash);
      verified = r.ok; needsUpgrade = r.needsUpgrade;
    }

    if (!user || !verified) {
      await recordFailure(env, ip, emailLc, new Date(nowMs).toISOString());
      return json({ error: 'Feil e-post eller passord.' }, 401);
    }

    // Vellykket innlogging: oppgrader gammel hash til PBKDF2 ved behov.
    if (needsUpgrade) {
      try {
        const newHash = await hashPassword(password);
        await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
          .bind(newHash, user.id).run();
      } catch (e) { console.error('Hash-oppgradering feilet:', e); }
    }

    await clearAttempts(env, ip);

    const token = await generateToken(user.id);
    await env.DB.prepare('INSERT OR REPLACE INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
      .bind(token, user.id, new Date(nowMs).toISOString()).run();

    // Returner aldri password_hash til klienten.
    return json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone } });
  } catch (err) {
    console.error('Login error:', err);
    return json({ error: 'Intern feil. Prøv igjen.' }, 500);
  }
}

// === Rate-limiting (D1-tabell login_attempts) ===
// Alle feiler "åpent": hvis tabellen mangler, blokkeres ingen innlogging.

async function tooManyAttempts(env, ip, cutoff) {
  try {
    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND ts > ?'
    ).bind(ip, cutoff).first();
    return (row?.n || 0) >= MAX_ATTEMPTS;
  } catch (e) { return false; }
}

async function recordFailure(env, ip, email, ts) {
  try {
    await env.DB.prepare('INSERT INTO login_attempts (id, ip, email, ts) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), ip, email, ts).run();
    // Rydd gamle rader opportunistisk (eldre enn 1 time).
    const old = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await env.DB.prepare('DELETE FROM login_attempts WHERE ts < ?').bind(old).run();
  } catch (e) {}
}

async function clearAttempts(env, ip) {
  try {
    await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
  } catch (e) {}
}

async function generateToken(id) {
  const d = new TextEncoder().encode(id + ':' + Date.now());
  const h = await crypto.subtle.digest('SHA-256', d);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
