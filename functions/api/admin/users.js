export async function onRequestGet({ request, env }) {
 if (!checkAuth(request)) return json({ error: 'Ikke tillatt' }, 403);
 const { results } = await env.DB.prepare('SELECT id, name, email, consent, registered_at FROM users ORDER BY registered_at DESC').all();
 return json({ users: results });
}
function checkAuth(req) { return req.headers.get('x-admin-key') === 'finnoss-admin-2026'; }
function json(d, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } }); }
