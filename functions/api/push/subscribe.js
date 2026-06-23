// Lagrer en push-abonnement fra en bruker

export async function onRequestPost({ request, env }) {
  try {
    const { subscription, userId } = await request.json();
    if (!subscription || !subscription.endpoint) {
      return json({ error: 'Mangler abonnement' }, 400);
    }
    const id = crypto.randomUUID();
    const { endpoint, keys } = subscription;

    // Unngå duplikater
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();

    await env.DB.prepare(
      'INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, userId || null, endpoint, keys.p256dh, keys.auth, new Date().toISOString()).run();

    return json({ ok: true });
  } catch (e) {
    console.error('Subscribe-feil:', e);
    return json({ error: 'Intern feil' }, 500);
  }
}
function json(d, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });
}
