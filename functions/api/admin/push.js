export async function onRequestPost({ request, env }) {
 if (!checkAuth(request)) return json({ error: 'Ikke tillatt' }, 403);
 const { title, body, url } = await request.json();
 if (!title || !body) return json({ error: 'Tittel og melding er påkrevd.' }, 400);
 const { results } = await env.DB.prepare('SELECT * FROM push_subscriptions').all();
 if (!results.length) return json({ sent: 0, message: 'Ingen push-abonnenter ennå.' });
 let sent = 0;
 for (const sub of results) {
   try {
     await sendPush(sub, { title, body, url }, env);
     sent++;
   } catch (e) {
     console.error('Push feil:', e);
   }
 }
 return json({ sent });
}

async function sendPush(sub, payload, env) {
 const endpoint = sub.endpoint;
 const body = JSON.stringify(payload);
 await fetch(endpoint, {
   method: 'POST',
   headers: {
     'Content-Type': 'application/octet-stream',
     'TTL': '86400'
   },
   body
 });
}

function checkAuth(req) { return req.headers.get('x-admin-key') === 'finnoss-admin-2026'; }
function json(d, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } }); }
