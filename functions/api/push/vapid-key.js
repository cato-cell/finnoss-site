// Returnerer offentlig VAPID-nøkkel til frontend

export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({ key: env.VAPID_PUBLIC }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
