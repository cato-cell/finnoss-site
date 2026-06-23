export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  if (secret !== 'finnoss-setup-2026') {
    return new Response('Ikke tillatt', { status: 403 });
  }
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, phone TEXT, password_hash TEXT NOT NULL, consent INTEGER DEFAULT 0, registered_at TEXT, source TEXT DEFAULT 'pwa')`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS offers (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, actor TEXT, badge TEXT, active INTEGER DEFAULT 1, created_at TEXT)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY, user_id TEXT, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT)`).run();
  return new Response('Tabeller opprettet OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
}
