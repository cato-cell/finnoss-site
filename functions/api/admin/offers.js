// functions/api/admin/offers.js
// GET  /api/admin/offers      -> liste alle tilbud (krever x-admin-key)
// POST /api/admin/offers      -> opprett tilbud (krever x-admin-key)
//   body: { actor, title, description, badge, once, maxUses }

export async function onRequest(context) {
  const { request, env } = context;

  // Admin-autorisering: nøkkel ligger som server-side secret (env.ADMIN_KEY)
  const key = request.headers.get('x-admin-key');
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    return json({ error: 'Ikke autorisert' }, 401);
  }

  if (request.method === 'GET') {
    try {
      const res = await env.DB.prepare(
        `SELECT id, title, description, actor, badge, active, once,
                COALESCE(max_uses, 1) AS max_uses, created_at
         FROM offers ORDER BY created_at DESC`
      ).all();
      return json({ offers: res.results || [] });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'Ugyldig forespørsel' }, 400); }

    const { actor, title, description, badge, once, maxUses } = body || {};

    if (!actor || !title) {
      return json({ error: 'actor og title er påkrevd' }, 400);
    }

    // once = engangstilbud (1) eller ikke (0)
    const onceVal = once ? 1 : 0;
    // max_uses: hvor mange ganger hver bruker kan bruke tilbudet.
    // Engangstilbud => 1. Ellers det admin oppgir (minst 1).
    let maxUsesVal = parseInt(maxUses, 10);
    if (!Number.isFinite(maxUsesVal) || maxUsesVal < 1) maxUsesVal = 1;
    if (onceVal === 1) maxUsesVal = 1; // engangstilbud overstyrer

    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await env.DB.prepare(
        `INSERT INTO offers (id, title, description, actor, badge, active, once, max_uses, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
      ).bind(
        id, title, description || '', actor,
        badge || 'Tilbud', onceVal, maxUsesVal, now
      ).run();

      return json({ ok: true, id });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  return json({ error: 'Metode ikke støttet' }, 405);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}
