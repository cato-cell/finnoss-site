export async function onRequestPost({ request, env }) {
 if (!checkAuth(request)) return json({ error: 'Ikke tillatt' }, 403);
 const { actor, title, description, badge } = await request.json();
 if (!actor || !title) return json({ error: 'Mangler felt' }, 400);
 const id = crypto.randomUUID();
 await env.DB.prepare('INSERT INTO offers (id, title, description, actor, badge, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)').bind(id, title, description || '', actor, badge || 'Tilbud', new Date().toISOString()).run();
 return json({ ok: true, id });
}
export async function onRequestGet({ request, env }) {
 if (!checkAuth(request)) return json({ error: 'Ikke tillatt' }, 403);
 const { results } = await env.DB.prepare('SELECT * FROM offers ORDER BY created_at DESC').all();
 return json({ offers: results });
}
function checkAuth(req) { return req.headers.get('x-admin-key') === 'finnoss-admin-2026'; }
function json(d, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } }); }
