// functions/api/resync-brevo.js
// GET /api/resync-brevo?secret=finnoss-setup-2026
//
// Sender alle samtykke-brukere (consent=1) fra D1 til Brevo (liste 3) via
// bulk-import. Idempotent: updateExistingContacts=true, så eksisterende
// kontakter bare oppdateres. Fanger opp brukere som registrerte seg før
// Brevo-koblingen var på plass, eller der synkingen feilet stille.
//
// Bulk-import = ett subrequest per bit (ikke ett per bruker), så vi unngår
// Cloudflare sin subrequest-grense selv med mange brukere.

const LIST_ID = 3;
const CHUNK = 500; // maks kontakter per import-kall

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.searchParams.get('secret') !== 'finnoss-setup-2026') {
    return json({ ok: false, error: 'Ugyldig secret' }, 403);
  }
  if (!env.BREVO_API_KEY) {
    return json({ ok: false, error: 'Mangler BREVO_API_KEY i miljøet' }, 500);
  }

  // Hent alle samtykke-brukere fra databasen
  let users;
  try {
    const res = await env.DB.prepare(
      'SELECT name, email, phone FROM users WHERE consent = 1'
    ).all();
    users = res.results || [];
  } catch (e) {
    return json({ ok: false, error: 'DB-feil: ' + e.message }, 500);
  }

  // Bygg kontaktliste: hopp over ugyldige e-poster, guard SMS (kun gyldig E.164)
  const contacts = [];
  let skipped = 0;
  for (const u of users) {
    const email = (u.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) { skipped++; continue; }
    const parts = (u.name || '').trim().split(' ');
    const attributes = { FIRSTNAME: parts[0] || '', LASTNAME: parts.slice(1).join(' ') || '' };
    if (u.phone && /^\+\d{8,15}$/.test(u.phone)) attributes.SMS = u.phone;
    contacts.push({ email, attributes });
  }

  if (contacts.length === 0) {
    return json({ ok: true, total: users.length, valid: 0, skipped, batches: [],
      note: 'Ingen gyldige samtykke-brukere å sende.' });
  }

  // Send i biter à CHUNK (hver bit = ett bulk-import-kall)
  const batches = [];
  for (let i = 0; i < contacts.length; i += CHUNK) {
    const chunk = contacts.slice(i, i + CHUNK);
    try {
      const res = await fetch('https://api.brevo.com/v3/contacts/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'api-key': env.BREVO_API_KEY
        },
        body: JSON.stringify({
          listIds: [LIST_ID],
          updateExistingContacts: true,
          jsonBody: chunk
        })
      });
      const bodyText = await res.text().catch(() => '');
      batches.push({ from: i, count: chunk.length, status: res.status, ok: res.ok, body: bodyText.slice(0, 300) });
    } catch (e) {
      batches.push({ from: i, count: chunk.length, ok: false, error: e.message });
    }
  }

  const sent = batches.filter(b => b.ok).reduce((n, b) => n + b.count, 0);
  return json({
    ok: true,
    total: users.length,   // antall samtykke-brukere i databasen
    valid: contacts.length,// hadde gyldig e-post
    sent,                  // sendt i vellykkede import-kall
    skipped,               // hoppet over (ugyldig e-post)
    note: 'Brevo behandler import asynkront (status 202 = mottatt). Sjekk liste 3 i Brevo om et par minutter.',
    batches
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}
