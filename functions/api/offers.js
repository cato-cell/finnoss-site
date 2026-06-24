// functions/api/offers.js
// GET /api/offers?userId=<id>
// Returnerer aktive tilbud. For flergangstilbud beregnes hvor mange bruk
// brukeren har igjen (usesLeft). Tilbud skjules når usesLeft <= 0.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId') || '';

  try {
    // Hent alle aktive tilbud
    const offersRes = await env.DB.prepare(
      `SELECT id, title, description, actor, badge, once,
              COALESCE(max_uses, 1) AS max_uses
       FROM offers WHERE active = 1
       ORDER BY created_at DESC`
    ).all();
    const offers = offersRes.results || [];

    // Tell brukerens innløsninger per tilbud (kun hvis vi har userId)
    let usedCount = {};
    if (userId) {
      const redRes = await env.DB.prepare(
        `SELECT offer_id, COUNT(*) AS n
         FROM redemptions WHERE user_id = ?
         GROUP BY offer_id`
      ).bind(userId).all();
      (redRes.results || []).forEach(r => { usedCount[r.offer_id] = r.n; });
    }

    // Bygg svar: beregn usesLeft, skjul oppbrukte
    const out = [];
    for (const o of offers) {
      const maxUses = o.max_uses || 1;
      const used = usedCount[o.id] || 0;
      const usesLeft = maxUses - used;

      // Skjul tilbud brukeren har brukt opp
      if (usesLeft <= 0) continue;

      out.push({
        id: o.id,
        title: o.title,
        description: o.description,
        actor: o.actor,
        badge: o.badge,
        once: o.once,            // 0/1 (engangstilbud)
        maxUses: maxUses,        // f.eks. 5 for Marta's
        usesLeft: usesLeft,      // gjenstående bruk for denne brukeren
        multi: maxUses > 1       // praktisk flagg for frontend
      });
    }

    return new Response(JSON.stringify({ offers: out }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ offers: [], error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
