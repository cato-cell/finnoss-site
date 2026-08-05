// functions/api/auth/reset.js
// POST /api/auth/reset  { token, password }
//
// Fullfører «glemt passord»-flyten: slår opp tokenet (via hashen), sjekker at
// det er gyldig, ubrukt og ikke utløpt, og setter nytt PBKDF2-passord.
//
// Sikkerhet:
//  - Tokenet slås opp på SHA-256-hash; klartekst-tokenet lagres aldri.
//  - Engangsbruk: markeres used=1 i samme flyt.
//  - Alle aktive økter for brukeren slettes, slik at en angriper som allerede
//    var innlogget mister tilgangen når passordet byttes.

import { hashPassword } from './_hash.js';

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = (body.token || '').trim();
    const password = body.password || '';

    if (!token) return json({ error: 'Lenken mangler eller er ufullstendig.' }, 400);
    if (password.length < 8) return json({ error: 'Passordet må være minst 8 tegn.' }, 400);

    const tokenHash = await sha256Hex(token);
    const row = await env.DB.prepare(
      'SELECT id, user_id, expires_at, used FROM password_resets WHERE token_hash = ?'
    ).bind(tokenHash).first();

    const utløpt = row && new Date(row.expires_at).getTime() < Date.now();
    if (!row || row.used === 1 || utløpt) {
      return json({ error: 'Lenken er ugyldig eller utløpt. Be om en ny.' }, 400);
    }

    // Sett nytt passord (PBKDF2, samme modul som register/login).
    const nyHash = await hashPassword(password);
    await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .bind(nyHash, row.user_id).run();

    // Brenn tokenet.
    await env.DB.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').bind(row.id).run();

    // Logg ut alle eksisterende økter for brukeren.
    try {
      await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.user_id).run();
    } catch (e) { console.error('Kunne ikke slette økter:', e); }

    return json({ ok: true, message: 'Passordet er endret. Du kan nå logge inn.' });
  } catch (err) {
    console.error('Reset-password error:', err);
    return json({ error: 'Intern feil. Prøv igjen.' }, 500);
  }
}

async function sha256Hex(str) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
