export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const { results } = await env.DB.prepare('SELECT id, title, description, actor, badge, once FROM offers WHERE active = 1 ORDER BY created_at DESC').all();
    let usedIds = [];
    if (userId) {
      const used = await env.DB.prepare('SELECT offer_id FROM redemptions WHERE user_id = ?').bind(userId).all();
      usedIds = (used.results || []).map(r => r.offer_id);
    }
    const offers = results.filter(o => !(o.once && usedIds.includes(o.id)));
    return json({ offers });
  } catch {
    return json({ offers: [] });
  }
}
function json(d, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } }); }
