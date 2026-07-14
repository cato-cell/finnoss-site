import { hashPassword } from './_hash.js';

export async function onRequestPost({ request, env }) {
  try {
    const { name, email, phone, password, consent } = await request.json();
    if (!name || !email || !password) return json({ error: 'Navn, e-post og passord er påkrevd.' }, 400);
    if (password.length < 8) return json({ error: 'Passordet må være minst 8 tegn.' }, 400);
    if (!email.includes('@')) return json({ error: 'Ugyldig e-postadresse.' }, 400);
    const passwordHash = await hashPassword(password);
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first();
    if (existing) return json({ error: 'E-postadressen er allerede registrert.' }, 409);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const normalizedPhone = normalizePhone(phone);
    await env.DB.prepare(`INSERT INTO users (id, name, email, phone, password_hash, consent, registered_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(userId, name, email.toLowerCase(), normalizedPhone, passwordHash, consent ? 1 : 0, now, 'pwa').run();
    if (consent && env.BREVO_API_KEY) {
      await syncToBrevo(env, name, email.toLowerCase(), normalizedPhone);
    }
    const token = await generateToken(userId);
    return json({ token, user: { id: userId, name, email: email.toLowerCase() } }, 201);
  } catch (err) {
    console.error('Register error:', err);
    return json({ error: 'Intern feil. Prøv igjen.' }, 500);
  }
}

// Synk kontakt til Brevo (liste 3). Feiler ALDRI registreringen – logger kun.
async function syncToBrevo(env, name, email, phone) {
  try {
    const parts = (name || '').trim().split(' ');
    const attributes = {
      FIRSTNAME: parts[0] || '',
      LASTNAME: parts.slice(1).join(' ') || ''
    };
    // Kun send SMS hvis nummeret er gyldig E.164 (+47…). Et ugyldig SMS-felt
    // får Brevo til å avvise HELE kontakten – da utelater vi det (e-post holder).
    if (phone && /^\+\d{8,15}$/.test(phone)) attributes.SMS = phone;

    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'api-key': env.BREVO_API_KEY },
      body: JSON.stringify({ email, attributes, listIds: [3], updateEnabled: true })
    });
    // 201 = opprettet, 204 = oppdatert (begge res.ok). Alt annet logges med detaljer.
    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch (e) {}
      console.error('Brevo-synk feilet (' + res.status + ') for ' + email + ': ' + detail);
    }
  } catch (e) {
    console.error('Brevo-synk unntak for ' + email + ':', e);
  }
}

async function generateToken(id) {
  const d = new TextEncoder().encode(id + ':' + Date.now());
  const h = await crypto.subtle.digest('SHA-256', d);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function normalizePhone(p) {
  if (!p) return null;
  const d = p.replace(/\D/g, '');
  if (d.length === 8) return '+47' + d;
  if (d.startsWith('47') && d.length === 10) return '+' + d;
  return p;
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
