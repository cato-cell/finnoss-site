export async function onRequestPatch({ request, env, params }) {
 if (!checkAuth(request, env)) return json({ error: 'Ikke tillatt' }, 403);

 let body;
 try { body = await request.json(); }
 catch { return json({ error: 'Ugyldig forespørsel' }, 400); }

 // Enkel active-toggle (bakoverkompatibelt: kun { active } sendt inn).
 if (body && body.active !== undefined && body.actor === undefined && body.title === undefined
     && body.description === undefined && body.badge === undefined
     && body.once === undefined && body.maxUses === undefined) {
   await env.DB.prepare('UPDATE offers SET active = ? WHERE id = ?')
     .bind(body.active ? 1 : 0, params.id).run();
   return json({ ok: true });
 }

 // Full redigering: oppdater oppgitte felt, behold resten.
 const existing = await env.DB.prepare(
   `SELECT id, title, description, actor, badge, active, once, COALESCE(max_uses,1) AS max_uses
    FROM offers WHERE id = ?`
 ).bind(params.id).first();
 if (!existing) return json({ error: 'Ukjent tilbud' }, 404);

 const actor = (body.actor !== undefined ? String(body.actor) : existing.actor || '').trim();
 const title = (body.title !== undefined ? String(body.title) : existing.title || '').trim();
 const description = body.description !== undefined ? String(body.description) : (existing.description || '');
 const badge = (body.badge !== undefined ? String(body.badge) : existing.badge || '').trim();
 const active = body.active !== undefined ? (body.active ? 1 : 0) : existing.active;
 const once = body.once !== undefined ? (body.once ? 1 : 0) : existing.once;
 let maxUses = body.maxUses !== undefined ? parseInt(body.maxUses, 10) : existing.max_uses;
 if (!Number.isFinite(maxUses) || maxUses < 1) maxUses = 1;
 if (once === 1) maxUses = 1; // engangstilbud overstyrer

 if (!actor || !title) return json({ error: 'Aktør og tittel er påkrevd.' }, 400);

 await env.DB.prepare(
   `UPDATE offers SET actor = ?, title = ?, description = ?, badge = ?, active = ?, once = ?, max_uses = ?
    WHERE id = ?`
 ).bind(actor, title, description, badge || 'Tilbud', active, once, maxUses, params.id).run();

 return json({ ok: true });
}
export async function onRequestDelete({ request, env, params }) {
 if (!checkAuth(request, env)) return json({ error: 'Ikke tillatt' }, 403);
 await env.DB.prepare('DELETE FROM offers WHERE id = ?').bind(params.id).run();
 return json({ ok: true });
}
function checkAuth(req, env) { const k = env && env.ADMIN_KEY; return !!k && req.headers.get('x-admin-key') === k; }
function json(d, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } }); }
