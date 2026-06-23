export async function onRequestPost({ request, env }) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return json({ error: 'E-post og passord er påkrevd.' }, 400);
    const passwordHash = await hashPassword(password);
    const user = await env.DB.prepare('SELECT id, name, email, phone FROM users WHERE email = ? AND password_hash = ?').bind(email.toLowerCase(), passwordHash).first();
    if (!user) return json({ error: 'Feil e-post eller passord.' }, 401);
    const token = await generateToken(user.id);
    await env.DB.prepare('INSERT OR REPLACE INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').bind(token, user.id, new Date().toISOString()).run();
    return json({ token, user });
  } catch (err) {
    console.error('Login error:', err);
    return json({ error: 'Intern feil. Prøv igjen.' }, 500);
  }
}

async function hashPassword(p) {
  const d = new TextEncoder().encode(p + 'finnoss-salt-2026');
  const h = await crypto.subtle.digest('SHA-256', d);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function generateToken(id) {
  const d = new TextEncoder().encode(id + ':' + Date.now());
  const h = await crypto.subtle.digest('SHA-256', d);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
