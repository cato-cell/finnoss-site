// functions/api/auth/forgot.js
// POST /api/auth/forgot  { email }
//
// Starter «glemt passord»-flyten: lager et engangs-token, lagrer KUN hashen av
// det i D1, og sender en lenke på e-post via Brevo.
//
// Sikkerhet:
//  - Svarer alltid likt (200 ok) uansett om e-posten finnes. Ellers kunne
//    endepunktet brukes til å kartlegge hvilke e-poster som er registrert.
//  - Selve tokenet finnes bare i e-posten; databasen har kun SHA-256-hashen.
//  - Kort levetid (60 min) og engangsbruk (settes used=1 ved innløsning).
//  - Rate-limiting per IP (gjenbruker login_attempts, feiler «åpent»).
//
// Krever env: BREVO_API_KEY. Avsender styres av env.BREVO_SENDER_EMAIL
// (må være verifisert avsender i Brevo), med fallback til kontaktadressen.

const TTL_MIN = 60;        // hvor lenge lenken er gyldig
const WINDOW_MIN = 15;     // rate-limit-vindu
const MAX_REQUESTS = 5;    // maks forespørsler per IP i vinduet

export async function onRequestPost({ request, env }) {
  // Generisk svar – brukes i alle utfall så vi ikke røper hvem som er registrert.
  const ok = () => json({ ok: true, message: 'Hvis e-postadressen er registrert, har vi sendt en lenke for å velge nytt passord.' });

  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const nowMs = Date.now();
    const cutoff = new Date(nowMs - WINDOW_MIN * 60 * 1000).toISOString();

    if (await tooManyRequests(env, ip, cutoff)) {
      return json({ error: 'For mange forsøk. Vent noen minutter og prøv igjen.' }, 429);
    }
    await recordRequest(env, ip, new Date(nowMs).toISOString());

    const body = await request.json().catch(() => ({}));
    const email = (body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return json({ error: 'Ugyldig e-postadresse.' }, 400);

    const user = await env.DB.prepare('SELECT id, name, email FROM users WHERE email = ?')
      .bind(email).first();

    // Ukjent e-post: svar som om alt gikk bra, men gjør ingenting.
    // Logges (kun server-side) så feilsøking er mulig – klienten får aldri vite det.
    if (!user) {
      console.log('Glemt passord: ingen bruker med e-post ' + email + ' – ingen e-post sendt.');
      return ok();
    }

    // Lag token (vises kun i e-posten) og lagre hashen.
    const token = randomToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(nowMs + TTL_MIN * 60 * 1000).toISOString();

    // Ugyldiggjør tidligere ubrukte lenker for denne brukeren.
    try {
      await env.DB.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0')
        .bind(user.id).run();
    } catch (e) { /* tabellen kan mangle – migreringen oppretter den */ }

    // Lagre tokenet. Hvis tabellen ikke finnes ennå (migreringen ikke kjørt),
    // opprettes den her og innsettingen forsøkes på nytt – ellers ville hele
    // flyten stoppet stille og brukeren fått «lenke sendt» uten e-post.
    const lagreToken = () => env.DB.prepare(
      'INSERT INTO password_resets (id, user_id, token_hash, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)'
    ).bind(crypto.randomUUID(), user.id, tokenHash, expiresAt, new Date(nowMs).toISOString()).run();

    try {
      await lagreToken();
    } catch (e) {
      console.error('INSERT i password_resets feilet – prøver å opprette tabellen:', e);
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS password_resets(
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT
      )`).run();
      await env.DB.prepare(
        'CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash)'
      ).run();
      await lagreToken();
    }

    const origin = new URL(request.url).origin;
    const lenke = `${origin}/app/nytt-passord/?token=${encodeURIComponent(token)}`;
    await sendResetEmail(env, user, lenke);

    // Rydd opp gamle/brukte rader opportunistisk.
    try {
      await env.DB.prepare('DELETE FROM password_resets WHERE expires_at < ? OR used = 1')
        .bind(new Date(nowMs - 24 * 60 * 60 * 1000).toISOString()).run();
    } catch (e) {}

    return ok();
  } catch (err) {
    console.error('Forgot-password error:', err);
    // Fortsatt generisk svar utad.
    return json({ ok: true, message: 'Hvis e-postadressen er registrert, har vi sendt en lenke for å velge nytt passord.' });
  }
}

// === E-post via Brevo (transaksjonell) ===
async function sendResetEmail(env, user, lenke) {
  if (!env.BREVO_API_KEY) {
    console.error('Mangler BREVO_API_KEY – kunne ikke sende tilbakestillings-e-post.');
    return;
  }
  const sender = env.BREVO_SENDER_EMAIL || 'cato@askergolflounge.no';
  const fornavn = (user.name || '').trim().split(' ')[0] || 'der';

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#06111d;padding:32px 16px;color:#f0ece4">
    <div style="max-width:480px;margin:0 auto;background:#0d1f30;border:1px solid rgba(216,166,76,.2);border-radius:16px;padding:32px">
      <div style="font-size:13px;letter-spacing:.15em;text-transform:uppercase;color:#d8a64c;font-weight:700">FinnOss</div>
      <h1 style="font-size:22px;margin:16px 0 8px;color:#f0ece4">Velg nytt passord</h1>
      <p style="font-size:15px;line-height:1.6;color:#8a9bb0;margin:0 0 24px">
        Hei ${escapeHtml(fornavn)}! Vi fikk en forespørsel om å tilbakestille passordet ditt.
        Trykk på knappen under for å velge et nytt. Lenken er gyldig i ${TTL_MIN} minutter og kan kun brukes én gang.
      </p>
      <a href="${lenke}" style="display:inline-block;background:#d8a64c;color:#06111d;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:10px;font-size:15px">Velg nytt passord</a>
      <p style="font-size:13px;line-height:1.6;color:#4a5a6a;margin:24px 0 0">
        Har du ikke bedt om dette, kan du se bort fra e-posten – passordet ditt endres ikke.
      </p>
      <p style="font-size:12px;color:#4a5a6a;margin:16px 0 0;word-break:break-all">
        Virker ikke knappen? Lim inn denne lenken i nettleseren:<br>${lenke}
      </p>
    </div>
  </div>`;

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'api-key': env.BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: 'FinnOss', email: sender },
        to: [{ email: user.email, name: user.name || undefined }],
        subject: 'Velg nytt passord – FinnOss',
        htmlContent: html
      })
    });
    if (!res.ok) {
      let detail = ''; try { detail = await res.text(); } catch (e) {}
      console.error('Brevo e-post feilet (' + res.status + ') avsender=' + sender + ': ' + detail);
    } else {
      console.log('Glemt passord: e-post sendt til ' + user.email + ' fra ' + sender);
    }
  } catch (e) {
    console.error('Brevo e-post unntak:', e);
  }
}

// === Rate-limiting (gjenbruker login_attempts; feiler «åpent») ===
async function tooManyRequests(env, ip, cutoff) {
  try {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND email = 'reset' AND ts > ?"
    ).bind(ip, cutoff).first();
    return (row?.n || 0) >= MAX_REQUESTS;
  } catch (e) { return false; }
}
async function recordRequest(env, ip, ts) {
  try {
    await env.DB.prepare("INSERT INTO login_attempts (id, ip, email, ts) VALUES (?, ?, 'reset', ?)")
      .bind(crypto.randomUUID(), ip, ts).run();
  } catch (e) {}
}

// === Hjelpere ===
function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sha256Hex(str) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
