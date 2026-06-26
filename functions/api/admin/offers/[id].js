export async function onRequestPatch({ request, env, params }) {
 if (!checkAuth(request, env)) return json({ error: 'Ikke tillatt' }, 403);
 const { active } = await request.json();
 await env.DB.prepare('UPDATE offers SET active = ? WHERE id = ?').bind(active, params.id).run();
 return json({ ok: true });
}
export async function onRequestDelete({ request, env, params }) {
 if (!checkAuth(request, env)) return json({ error: 'Ikke tillatt' }, 403);
 await env.DB.prepare('DELETE FROM offers WHERE id = ?').bind(params.id).run();
 return json({ ok: true });
}
function checkAuth(req, env) { const k = env && env.ADMIN_KEY; return !!k && req.headers.get('x-admin-key') === k; }
function json(d, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } }); }
