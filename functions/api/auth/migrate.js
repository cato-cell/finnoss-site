// functions/api/auth/migrate.js
// Kjøres ved å besøke /api/auth/migrate?secret=finnoss-setup-2026
// Idempotent: trygt å kjøre flere ganger.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');

  if (secret !== 'finnoss-setup-2026') {
    return new Response(JSON.stringify({ ok: false, error: 'Ugyldig secret' }), {
      status: 403, headers: { 'Content-Type': 'application/json' }
    });
  }

  const log = [];
  const tryRun = async (label, sql) => {
    try { await env.DB.prepare(sql).run(); log.push('OK: ' + label); }
    catch (e) { log.push('HOPPET OVER (' + label + '): ' + e.message); }
  };

  // === users ===
  await tryRun('users', `CREATE TABLE IF NOT EXISTS users(
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    consent INTEGER DEFAULT 0,
    created_at TEXT
  )`);

  // === sessions ===
  await tryRun('sessions', `CREATE TABLE IF NOT EXISTS sessions(
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT
  )`);

  // === offers ===
  await tryRun('offers', `CREATE TABLE IF NOT EXISTS offers(
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    actor TEXT,
    badge TEXT,
    active INTEGER DEFAULT 1,
    once INTEGER DEFAULT 0,
    max_uses INTEGER DEFAULT 1,
    created_at TEXT
  )`);

  // Backfill-kolonner på eksisterende offers-tabell (idempotent)
  await tryRun('offers.once', `ALTER TABLE offers ADD COLUMN once INTEGER DEFAULT 0`);
  await tryRun('offers.max_uses', `ALTER TABLE offers ADD COLUMN max_uses INTEGER DEFAULT 1`);

  // Sørg for at gamle rader har fornuftig max_uses:
  //  - engangstilbud (once=1)  -> max_uses=1
  //  - vanlige tilbud (once=0) -> max_uses=1 (kan endres i admin)
  await tryRun('offers.max_uses backfill', `UPDATE offers SET max_uses=1 WHERE max_uses IS NULL`);

  // === push_subscriptions ===
  await tryRun('push_subscriptions', `CREATE TABLE IF NOT EXISTS push_subscriptions(
    id TEXT PRIMARY KEY,
    user_id TEXT,
    subscription TEXT NOT NULL,
    created_at TEXT
  )`);

  // === redemptions ===
  // VIKTIG: Den gamle tabellen hadde UNIQUE(user_id, offer_id), som hindrer
  // flergangstilbud (f.eks. Marta's 5 kaffekopper). Vi bygger tabellen om til
  // UNIQUE(id) slik at samme bruker kan ha flere innløsninger av samme tilbud.
  // Antall styres nå i koden (count < max_uses), ikke av databasesperren.
  await tryRun('redemptions (ny)', `CREATE TABLE IF NOT EXISTS redemptions(
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    offer_id TEXT NOT NULL,
    redeemed_at TEXT
  )`);

  // Sjekk om gammel UNIQUE-sperre finnes – hvis ja, bygg om uten å miste data.
  try {
    const row = await env.DB.prepare(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='redemptions'`
    ).first();
    const ddl = (row && row.sql) ? row.sql.replace(/\s+/g, ' ') : '';
    const hasOldUnique = /UNIQUE\s*\(\s*user_id\s*,\s*offer_id\s*\)/i.test(ddl);

    if (hasOldUnique) {
      // Trygg ombygging: kopier data til ny tabell uten sperren.
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS redemptions_new(
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        offer_id TEXT NOT NULL,
        redeemed_at TEXT
      )`).run();
      await env.DB.prepare(
        `INSERT OR IGNORE INTO redemptions_new(id,user_id,offer_id,redeemed_at)
         SELECT id,user_id,offer_id,redeemed_at FROM redemptions`
      ).run();
      await env.DB.prepare(`DROP TABLE redemptions`).run();
      await env.DB.prepare(`ALTER TABLE redemptions_new RENAME TO redemptions`).run();
      log.push('OK: redemptions bygget om (fjernet UNIQUE(user_id,offer_id))');
    } else {
      log.push('OK: redemptions hadde allerede riktig struktur');
    }
  } catch (e) {
    log.push('ADVARSEL redemptions-ombygging: ' + e.message);
  }

  return new Response(JSON.stringify({ ok: true, log }, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}
