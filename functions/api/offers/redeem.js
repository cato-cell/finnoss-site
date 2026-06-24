// functions/api/offers/redeem.js
// POST /api/offers/redeem  body: { offerId, userId }
// Løser inn ett tilbud. Tillater inntil max_uses innløsninger per bruker.

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return json({ error: 'Kun POST' }, 405);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Ugyldig forespørsel' }, 400); }

  const { offerId, userId } = body || {};
  if (!offerId || !userId) {
    return json({ error: 'Mangler offerId eller userId' }, 400);
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
