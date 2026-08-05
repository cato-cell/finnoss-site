// functions/api/admin/epost-diagnose.js
// POST /api/admin/epost-diagnose   header: x-admin-key
// Body (valgfritt): { email: "…" }  – hvilken adresse testen skal sjekke/sende til.
//
// Diagnoseverktøy for «glemt passord»-flyten. Den flyten svarer alltid likt
// utad (for å hindre e-postopplisting), så feil blir usynlige. Dette
// endepunktet – beskyttet av admin-nøkkelen – viser hva som faktisk skjer:
//   1. Er BREVO_API_KEY satt?
//   2. Hvilken avsender brukes, og er den godkjent av Brevo?
//   3. Finnes det en brukerkonto med denne e-posten?
//   4. Finnes tabellen password_resets?
//   5. Rå respons fra Brevo på en faktisk testsending.
//
// Sender ingen passord-lenke – kun en nøytral test-e-post.

export async function onRequestPost({ request, env }) {
  if (request.headers.get('x-admin-key') !== env.ADMIN_KEY) {
    return json({ error: 'Ugyldig admin-nøkkel' }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  const sender = env.BREVO_SENDER_EMAIL || 'cato@askergolflounge.no';

  const rapport = {
    avsender: sender,
    avsenderKilde: env.BREVO_SENDER_EMAIL ? 'env.BREVO_SENDER_EMAIL' : 'fallback i koden',
    brevoNokkelSatt: !!env.BREVO_API_KEY,
    brukerFinnes: null,
    tabellPasswordResets: null,
    testsending: null,
  };

  // 1. Finnes brukerkontoen?
  if (email) {
    try {
      const u = await env.DB.prepare('SELECT id, email FROM users WHERE email = ?').bind(email).first();
      rapport.brukerFinnes = !!u;
    } catch (e) {
      rapport.brukerFinnes = 'feil: ' + e.message;
    }
  }

  // 2. Finnes tabellen for tilbakestilling?
  try {
    const t = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='password_resets'"
    ).first();
    rapport.tabellPasswordResets = !!t;
  } catch (e) {
    rapport.tabellPasswordResets = 'feil: ' + e.message;
  }

  // 3. Prøv en faktisk sending og returner Brevos eksakte svar.
  if (!env.BREVO_API_KEY) {
    rapport.testsending = { ok: false, grunn: 'BREVO_API_KEY mangler i miljøet' };
  } else if (!email) {
    rapport.testsending = { ok: false, grunn: 'Ingen e-postadresse oppgitt' };
  } else {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'api-key': env.BREVO_API_KEY },
        body: JSON.stringify({
          sender: { name: 'FinnOss', email: sender },
          to: [{ email }],
          subject: 'FinnOss – test av e-postoppsett',
          htmlContent: '<p>Dette er en teknisk test fra FinnOss-administrasjonen. Kommer denne fram, fungerer e-postutsending – og «glemt passord» vil også virke.</p>'
        })
      });
      let svar = '';
      try { svar = await res.text(); } catch (e) {}
      rapport.testsending = { ok: res.ok, status: res.status, svar: svar.slice(0, 500) };
    } catch (e) {
      rapport.testsending = { ok: false, grunn: 'unntak: ' + e.message };
    }
  }

  // Kort tolkning så svaret er til å forstå uten å kjenne Brevo.
  rapport.konklusjon = tolk(rapport);
  return json(rapport);
}

function tolk(r) {
  if (!r.brevoNokkelSatt) return 'BREVO_API_KEY er ikke satt i Cloudflare. Ingen e-post kan sendes.';
  if (r.testsending && r.testsending.ok) {
    if (r.brukerFinnes === false) return 'E-post fungerer, MEN det finnes ingen brukerkonto med denne adressen – derfor sender «glemt passord» ingenting. Registrer deg i appen først.';
    return 'E-postoppsettet fungerer. Sjekk innboks (og søppelpost) for testmeldingen.';
  }
  if (r.testsending && r.testsending.status === 400) return 'Brevo avviste sendingen (400) – nesten alltid fordi avsenderadressen ikke er verifisert i Brevo. Verifiser den under Senders, eller sett env BREVO_SENDER_EMAIL til en verifisert adresse.';
  if (r.testsending && r.testsending.status === 401) return 'Brevo avviste nøkkelen (401). BREVO_API_KEY er feil eller utløpt.';
  return 'Sendingen feilet – se feltet «testsending» for Brevos eksakte svar.';
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}
