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
      const nameParts = name.trim().split(' ');
      await fetch('https://api.brevo.com/v3/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY }, body: JSON.stringify({ email, attributes: { FIRSTNAME: nameParts[0] || '', LASTNAME: nameParts.slice(1).join(' ') || '', SMS: normalizedPhone || '' }, listIds: [3], updateEnabled: true }) }).catch(console.error);
    }
    const token = await generateToken(userId);
    return json({ token, user: { id: userId, name, email: email.toLowerCase() } }, 201);
  } catch (err) {
    console.error('Register error:', err);
    return json({ error: 'Intern feil. Prøv igjen.' }, 500);
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
