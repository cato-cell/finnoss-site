// FinnOss – Send Web Push til alle abonnenter (ekte VAPID-signering)

export async function onRequestPost({ request, env }) {
  if (request.headers.get('x-admin-key') !== 'finnoss-admin-2026') {
    return json({ error: 'Ikke tillatt' }, 403);
  }
  const { title, body, url } = await request.json();
  if (!title || !body) return json({ error: 'Tittel og melding er påkrevd.' }, 400);

  const { results } = await env.DB.prepare('SELECT * FROM push_subscriptions').all();
  if (!results || !results.length) return json({ sent: 0, message: 'Ingen abonnenter ennå.' });

  const payload = JSON.stringify({ title, body, url: url || '/app/home/' });
  let sent = 0, failed = 0;

  for (const sub of results) {
    try {
      const ok = await sendWebPush(sub, payload, env);
      if (ok) sent++; else failed++;
    } catch (e) {
      failed++;
      console.error('Push-feil:', e);
    }
  }
  return json({ sent, failed });
}

// === Web Push-implementasjon (VAPID + aes128gcm) ===

async function sendWebPush(sub, payload, env) {
  const endpoint = sub.endpoint;
  const p256dh = b64urlToU8(sub.p256dh);
  const auth = b64urlToU8(sub.auth);

  const vapidHeaders = await buildVapidHeaders(endpoint, env);
  const encrypted = await encryptPayload(payload, p256dh, auth);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'TTL': '86400',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'Authorization': vapidHeaders.authorization
    },
    body: encrypted
  });

  // 404/410 = abonnement utløpt, slett det
  if (res.status === 404 || res.status === 410) {
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
    return false;
  }
  return res.ok || res.status === 201;
}

// Bygg VAPID JWT-header
async function buildVapidHeaders(endpoint, env) {
  const url = new URL(endpoint);
  const aud = url.origin;
  const header = { typ: 'JWT', alg: 'ES256' };
  const claims = {
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT
  };
  const enc = s => b64url(new TextEncoder().encode(JSON.stringify(s)));
  const unsigned = `${enc(header)}.${enc(claims)}`;

  const privKey = await importVapidPrivateKey(env.VAPID_PRIVATE, env.VAPID_PUBLIC);
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privKey,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${b64urlBuf(new Uint8Array(sig))}`;
  return { authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC}` };
}

// Importer VAPID privat nøkkel til CryptoKey
async function importVapidPrivateKey(privB64, pubB64) {
  const priv = b64urlToU8(privB64);
  const pub = b64urlToU8(pubB64);
  const x = pub.slice(1, 33);
  const y = pub.slice(33, 65);
  const jwk = {
    kty: 'EC', crv: 'P-256',
    d: b64urlBuf(priv),
    x: b64urlBuf(x),
    y: b64urlBuf(y),
    ext: true
  };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

// Krypter payload (RFC 8291 aes128gcm)
async function encryptPayload(payload, clientPub, authSecret) {
  const plaintext = new TextEncoder().encode(payload);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Server ephemeral nøkkelpar
  const serverKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey));

  // Importer klientens offentlige nøkkel
  const clientKey = await crypto.subtle.importKey('raw', clientPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

  // ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, serverKeys.privateKey, 256);
  const sharedSecret = new Uint8Array(sharedBits);

  // PRK via HKDF med auth secret
  const authInfo = concat(new TextEncoder().encode('WebPush: info\0'), clientPub, serverPubRaw);
  const ikm = await hkdf(authSecret, sharedSecret, authInfo, 32);

  // Avled CEK og nonce
  const cekInfo = concat(new TextEncoder().encode('Content-Encoding: aes128gcm\0'));
  const nonceInfo = concat(new TextEncoder().encode('Content-Encoding: nonce\0'));
  const cek = (await hkdf(salt, ikm, cekInfo, 16));
  const nonce = (await hkdf(salt, ikm, nonceInfo, 12));

  // Krypter
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const padded = concat(plaintext, new Uint8Array([2, 0])); // delimiter + ingen padding
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded));

  // Bygg header: salt(16) + rs(4) + idlen(1) + serverpub(65)
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  const idlen = new Uint8Array([serverPubRaw.length]);
  return concat(salt, rs, idlen, serverPubRaw, ciphertext);
}

// HKDF SHA-256
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

// Hjelpere
function concat(...arrays) {
  let len = 0;
  for (const a of arrays) len += a.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}
function b64url(u8) { return b64urlBuf(u8); }
function b64urlBuf(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToU8(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function json(d, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });
}
