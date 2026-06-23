export async function onRequestPost({ request, env }) {
  try {
    const { offerId, userId } = await request.json();
    if (!offerId || !userId) return json({ error: 'Mangler informasjon.' }, 400);
    const offer = await env.DB.prepare('SELECT * FROM offers WHERE id = ?').bind(offerId).first();
    if (!offer) return json({ error: 'Tilbudet finnes ikke.' }, 404);
    if (!offer.once) return json({ error: 'Dette er ikke et engangstilbud.' }, 400);
    const existing = await env.DB.prepare('SELECT id FROM redemptions WHERE user_id = ? AND offer_id = ?').bind(userId, offerId).first();
    if (existing) return json({ error: 'Allerede brukt.' }, 409);
    await env.DB.prepare('INSERT INTO redemptions (id, user_id, offer_id, redeemed_at) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), userId, offerId, new Date().toISOString()).run();
    return json({ ok: true });
  } catch (e) {
    console.error('Redeem-feil:', e);
    return json({ error: 'Intern feil.' }, 500);
  }
}
function json(d, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } }); }
