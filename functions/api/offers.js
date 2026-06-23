export async function onRequestGet({ env }) {
 try {
   const { results } = await env.DB.prepare('SELECT * FROM offers WHERE active = 1 ORDER BY created_at DESC').all();
   return new Response(JSON.stringify({ offers: results }), { status: 200, headers: { 'Content-Type': 'application/json' } });
 } catch {
   return new Response(JSON.stringify({ offers: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
 }
}
