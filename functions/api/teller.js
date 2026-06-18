/* ============================================================
   FinnOss – teller: antall påmeldte i Brevo-lista.
   Cloudflare Pages Function. GET /api/teller

   Svarer med: { ok: true, count: <antall>, goal: 500 }
   Brukes av fremdriftslinja på /heggedal/ for å vise live tall.

   Krever miljøvariabel i Cloudflare Pages:
     BREVO_API_KEY = din Brevo API-nøkkel
   (valgfritt) BREVO_LIST_ID = liste-ID (standard 3 = samtykke-lista)

   Svaret caches i ~5 min for å skåne Brevo-API-et.
   ============================================================ */

const GOAL = 500;
const CACHE_SECONDS = 300;

const json = (obj, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.BREVO_API_KEY) {
    return json({ ok: false, error: "Server mangler oppsett (API-nøkkel)." }, 500);
  }

  // Prøv cache først (kantnoden), så vi ikke spør Brevo på hvert sidelast
  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/teller", request.url).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const listId = parseInt(env.BREVO_LIST_ID || "3", 10);

  let res;
  try {
    res = await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}`, {
      headers: {
        "Accept": "application/json",
        "api-key": env.BREVO_API_KEY,
      },
    });
  } catch (e) {
    return json({ ok: false, error: "Fikk ikke kontakt med Brevo." }, 502);
  }

  if (!res.ok) {
    return json({ ok: false, error: "Kunne ikke hente antall." }, 502);
  }

  let data = {};
  try { data = await res.json(); } catch (e) {}

  // Brevo returnerer bl.a. totalSubscribers / uniqueSubscribers for lista
  const count = Number(data.totalSubscribers ?? data.uniqueSubscribers ?? 0) || 0;

  const out = json(
    { ok: true, count, goal: GOAL },
    200,
    { "Cache-Control": `public, max-age=${CACHE_SECONDS}` }
  );

  // Lagre i cache (klon – body kan bare leses én gang)
  context.waitUntil(cache.put(cacheKey, out.clone()));
  return out;
}

// Andre metoder enn GET -> enkel beskjed
export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return json({ ok: false, error: "Bruk GET." }, 405);
  }
  return onRequestGet(context);
}
