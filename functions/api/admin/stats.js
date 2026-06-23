export async function onRequestGet({ request, env }) {
 if (!checkAuth(request)) return json({ error: 'Ikke tillatt' }, 403);
 const users = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first();
 const consent = await env.DB.prepare('SELECT COUNT(*) as c FROM users WHERE consent = 1').first();
 const offers = await env.DB.prepare('SELECT COUNT(*) as c FROM offers WHERE active = 1').first();
 const push = await env.DB.prepare('SELECT COUNT(*) as c FROM push_subscriptions').first();
 return json({ users: users?.c ?? 0, consent: consent?.c ?? 0, offers: offers?.c ?? 0, push: push?.c ?? 0 });
}
function checkAuth(req) { return req.headers.get('x-admin-key') === 'finnoss-admin-2026'; }
function json(d, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } }); }
