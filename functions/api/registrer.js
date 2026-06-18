/* ============================================================
   FinnOss – registrering -> Brevo
   Cloudflare Pages Function. Kjører på server (api-nøkkel skjult).
   Kalles av skjemaet på /bli-medlem/ via POST /api/registrer

   Krever miljøvariabel i Cloudflare Pages:
     BREVO_API_KEY = din Brevo API-nøkkel
   (valgfritt) BREVO_LIST_ID = liste-ID (standard 3 = samtykke-lista)
   ============================================================ */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

// Gjør norsk nummer om til +47-format (E.164). Tomt = ugyldig.
function normalizePhone(raw) {
  if (!raw) return "";
  let p = String(raw).trim().replace(/[\s\-()]/g, "");
  if (/^\+\d{8,15}$/.test(p)) return p;          // allerede internasjonalt
  const d = p.replace(/\D/g, "");
  if (d.length === 8) return "+47" + d;          // 8 siffer = norsk mobil
  if (d.startsWith("47") && d.length === 10) return "+" + d;
  if (d.startsWith("0047")) return "+" + d.slice(2);
  return "";                                      // ukjent format
}

function isEmail(e) {
  return typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.BREVO_API_KEY) {
    return json({ ok: false, error: "Server mangler oppsett (API-nøkkel)." }, 500);
  }

  // Les inn data (JSON fra skjemaet)
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: "Ugyldig forespørsel." }, 400);
  }

  const email = (body.email || "").trim().toLowerCase();
  const phone = normalizePhone(body.phone);
  const consent = body.consent === true || body.consent === "yes";
  const honeypot = (body.company || "").trim();

  // Bot-felle: skjult felt skal være tomt
  if (honeypot) return json({ ok: true }); // lat som det gikk bra, lagre ingenting

  // Validering
  if (!isEmail(email)) return json({ ok: false, error: "Ugyldig e-post." }, 400);
  if (!phone) return json({ ok: false, error: "Sjekk telefonnummeret – bruk norsk mobilnummer." }, 400);
  if (!consent) return json({ ok: false, error: "Samtykke kreves for å bli med." }, 400);

  const listId = parseInt(env.BREVO_LIST_ID || "3", 10);
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Opprett/oppdater kontakt i Brevo
  const payload = {
    email: email,
    attributes: {
      SMS: phone,
      OPT_IN: "yes",
      REGISTRATION: today,
    },
    listIds: [listId],
    updateEnabled: true, // finnes kontakten fra før: oppdater i stedet for å feile
  };

  let res;
  try {
    res = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "api-key": env.BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return json({ ok: false, error: "Fikk ikke kontakt med Brevo. Prøv igjen om litt." }, 502);
  }

  // 201 = opprettet, 204 = oppdatert. Begge er suksess for oss.
  if (res.status === 201 || res.status === 204) {
    return json({ ok: true });
  }

  // Hvis kontakten finnes fra før uten updateEnabled-effekt – behandle som ok
  let detail = {};
  try { detail = await res.json(); } catch (e) {}
  if (detail && detail.code === "duplicate_parameter") {
    return json({ ok: true });
  }

  return json({ ok: false, error: "Kunne ikke registrere akkurat nå. Prøv igjen om litt." }, 502);
}

// Andre metoder enn POST -> enkel beskjed
export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ ok: false, error: "Bruk POST." }, 405);
  }
  return onRequestPost(context);
}
