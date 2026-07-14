// functions/api/admin/users/[id].js
// PATCH  /api/admin/users/:id  -> oppdater navn/e-post/telefon i D1
// DELETE /api/admin/users/:id  -> slett bruker + kaskade (sessions, redemptions,
//                                 push_subscriptions) + fjern fra Brevo-lista.
// Begge krever header x-admin-key === env.ADMIN_KEY (samme mønster som resten
// av admin-API-et, jf. admin/offers/[id].js).

export async function onRequestPatch({ request, env, params }) {
  if (!checkAuth(request, env)) return json({ error: 'Ikke tillatt' }, 403);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Ugyldig forespørsel' }, 400); }

  const existing = await env.DB.prepare('SELECT id, name, email, phone FROM users WHERE id = ?')
    .bind(params.id).first();
  if (!existing) return json({ error: 'Ukjent bruker' }, 404);

  // Bruk oppgitte verdier der de finnes, ellers behold eksisterende.
  const name = (body.name !== undefined ? String(body.name) : (existing.name || '')).trim();
  const email = (body.email !== undefined ? String(body.email) : (existing.email || '')).trim().toLowerCase();
  const phone = normalizePhone(body.phone !== undefined ? body.phone : existing.phone);

  if (!email || !email.includes('@')) return json({ error: 'Ugyldig e-postadresse.' }, 400);

  try {
    await env.DB.prepare('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?')
      .bind(name, email, phone, params.id).run();
  } catch (e) {
    // E-post har UNIQUE-sperre i skjemaet.
    if (/unique/i.test(e.message || '')) {
      return json({ error: 'E-postadressen er allerede i bruk av en annen konto.' }, 409);
    }
    return json({ error: 'Kunne ikke oppdatere: ' + e.message }, 500);
  }

  return json({ ok: true, user: { id: params.id, name, email, phone } });
}

export async function onRequestDelete({ request, env, params }) {
  if (!checkAuth(request, env)) return json({ error: 'Ikke tillatt' }, 403);

  // Hent e-post FØR sletting – trengs for Brevo-oppryddingen.
  const user = await env.DB.prepare('SELECT id, email FROM users WHERE id = ?')
    .bind(params.id).first();
  if (!user) return json({ error: 'Ukjent bruker' }, 404);

  // Kaskade-slett i D1: barn først, så selve brukeren.
  try {
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(params.id).run();
    await env.DB.prepare('DELETE FROM redemptions WHERE user_id = ?').bind(params.id).run();
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').bind(params.id).run();
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(params.id).run();
  } catch (e) {
    return json({ error: 'Sletting i database feilet: ' + e.message }, 500);
  }

  // Fjern kontakten fra Brevo-lista. Feiler dette, IKKE rull tilbake D1-slettingen –
  // returner en tydelig advarsel så admin ser at Brevo må ryddes manuelt.
  const brevo = await removeFromBrevo(env, user.email);

  return json({ ok: true, deleted: { id: user.id, email: user.email }, brevo });
}

// Fjern e-postadressen fra Brevo-lista (samme secret/liste som registreringsflyten).
async function removeFromBrevo(env, email) {
  if (!email) return { ok: false, skipped: true, reason: 'Ingen e-post på brukeren.' };
  if (!env.BREVO_API_KEY) return { ok: false, skipped: true, reason: 'Mangler BREVO_API_KEY i miljøet.' };
  const listId = parseInt(env.BREVO_LIST_ID || '3', 10);
  try {
    const res = await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api-key': env.BREVO_API_KEY
      },
      body: JSON.stringify({ emails: [email] })
    });
    if (res.ok) return { ok: true, listId, removed: email };
    let detail = '';
    try { detail = await res.text(); } catch (e) {}
    return {
      ok: false, listId, status: res.status,
      warning: `Kontakten ble IKKE fjernet fra Brevo (liste ${listId}) – rydd manuelt. ${detail.slice(0, 200)}`
    };
  } catch (e) {
    return { ok: false, listId, warning: 'Brevo-kall feilet – rydd manuelt: ' + e.message };
  }
}

// Norsk nummer -> +47/E.164 der mulig. Ukjent format beholdes som skrevet.
function normalizePhone(p) {
  if (!p) return null;
  const s = String(p).replace(/[\s\-()]/g, '');
  if (/^\+\d{8,15}$/.test(s)) return s;
  const d = s.replace(/\D/g, '');
  if (d.length === 8) return '+47' + d;
  if (d.startsWith('47') && d.length === 10) return '+' + d;
  if (d.startsWith('0047')) return '+' + d.slice(2);
  return String(p).trim();
}

function checkAuth(req, env) { const k = env && env.ADMIN_KEY; return !!k && req.headers.get('x-admin-key') === k; }
function json(d, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } }); }
