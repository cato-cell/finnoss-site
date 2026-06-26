// functions/api/offers/redeem.js
// POST /api/offers/redeem  body: { offerId }
// Krever Authorization: Bearer <token>. Brukeren utledes fra økten – ikke
// fra forespørselen – slik at ingen kan løse inn på en annens vegne.
// Tillater inntil max_uses innløsninger per bruker.

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return json({ error: 'Kun POST' }, 405);
  }

  // Hent bruker fra session-token (ikke fra body)
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    return json({ error: 'Ikke innlogget' }, 401);
  }
  const session = await env.DB.prepare(
    'SELECT user_id FROM sessions WHERE token = ?'
  ).bind(token).first();
  if (!session || !session.user_id) {
    return json({ error: 'Ugyldig økt. Logg inn på nytt.' }, 401);
  }
  const userId = session.user_id;

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Ugyldig forespørsel' }, 400); }

  const { offerId } = body || {};
  if (!offerId) {
    return json({ error: 'Mangler offerId' }, 400);
  }

  try {
    // Hent tilbudet
    const offer = await env.DB.prepare(
      `SELECT id, once, COALESCE(max_uses, 1) AS max_uses
       FROM offers WHERE id = ? AND active = 1`
    ).bind(offerId).first();

    if (!offer) {
      return json({ error: 'Ukjent tilbud' }, 404);
    }

    const maxUses = offer.max_uses || 1;

    // Tell hvor mange ganger brukeren allerede har brukt dette tilbudet
    const cntRow = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM redemptions WHERE user_id = ? AND offer_id = ?`
    ).bind(userId, offerId).first();
    const used = (cntRow && cntRow.n) ? cntRow.n : 0;

    if (used >= maxUses) {
      return json({ error: 'Tilbudet er allerede brukt opp' }, 409);
    }

    // Registrer innløsningen
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO redemptions (id, user_id, offer_id, redeemed_at) VALUES (?, ?, ?, ?)`
    ).bind(id, userId, offerId, now).run();

    const usesLeft = maxUses - used - 1;
    return json({ ok: true, usesLeft, maxUses });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}
