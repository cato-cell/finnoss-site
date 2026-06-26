# CLAUDE.md – FinnOss

Retningslinjer for Claude Code i dette repoet. Les dette før du gjør endringer.

## Om prosjektet
- **FinnOss (finnoss.no):** lokal hub for butikker, tjenester og opplevelser. Hovedområde: **Heggedal**.
- **Statisk nettsted** (portert fra WordPress). Ren HTML/CSS/JS, ingen build-prosess.
- **Repo:** `cato-cell/finnoss-site`. **Hosting:** Cloudflare Pages (prosjekt `finnoss-site`).

## Språk
- Svar, commit-meldinger og kode-kommentarer på **norsk**.

## Deploy / arbeidsflyt
- Utvikling på egen gren. **Produksjon = `main`** (push til `main` → Cloudflare deployer automatisk til finnoss.no).
- Andre grener → **preview**-deploy på egen hash-adresse (`…hash….finnoss-site.pages.dev`).
- **Go-live-policy:** når brukeren sier «kjør / ja / legg ut», **merg rett til `main` og push** (gå live). Ikke krev en preview-runde med mindre brukeren ber om det.
- **Alltid `git fetch origin main` før merge** – `main` får av og til pushet SEO-arbeid fra annet hold. Ved divergens: **rebase grenen oppå origin/main** (ikke overskriv andres arbeid).
- Merg helst som fast-forward: `git checkout main && git merge --ff-only <gren> && git push origin main`.
- **Ikke lag pull request** med mindre brukeren ber om det.
- **Ikke skriv om andres commits** (web-opplastinger med `noreply@github.com` er normale og skal stå).

## Verifisering & cache
- Claude-miljøet kan **ikke** laste finnoss.no direkte (egress blokkert). Be brukeren verifisere – gjerne med skjermbilde.
- **Test alltid i privat fane** (mobil-cache).
- `styles.css` lenkes med `?v=…` (cache-buster), og `_headers` gjør at `styles.css`/`app.js` revalideres. Ved større CSS-endringer: vurder å bumpe `?v=`-nummeret i alle HTML-filer.

## Krever ALLTID eksplisitt godkjenning (høy risiko)
- **DNS / e-post:** MX/TXT og andre records mot `webhuset.no`. Aldri rør mail- eller domene-ruting.
- **Juridisk / pris / tilbud:** vilkår, personvern, samtykketekster, medlemsfordeler, priser.
- **SEO / strukturert data (JSON-LD) / FAQ:** vedlikeholdes fra annet hold – avklar før endring, ikke overskriv deres arbeid.
- Cloudflare-/domenekonfigurasjon generelt.

## Design
- Uttrykk: **premium og eksklusivt** – polert, gull-aksenter, ro og luft.
- All CSS i `styles.css`. Design-tokens i `:root`: `--fo-ink` (tekst), `--fo-gold1`/`--fo-gold2` (gull), `--fo-bg0/1/2` (mørk bakgrunn), `--fo-accent`, `--fo-radius`.
- **Karusell:** kort er `a.fo-shop` (bilde-først, klikkbart). Mekanikk (piler + gull scroll-indikator) i `app.js`, aktiveres av `.fo-carousel-wrap > .fo-carousel`.
- **Logo:** bruk beskåret `images/finnoss-logo-3-trim.png` (uten gjennomsiktig luft) for presis justering. Toppfeltet linjeres med `.fo-wrap`.
- **Mobil-brekkpunkt:** `640px` (`MOBILE_BP` i `app.js`).

## app.js – hva som ligger der
Vanilla JS, ingen rammeverk. Tre IIFE-er som init-er ved `DOMContentLoaded`:
- **Hovedmodul:** karusellpiler, mobilmeny (`.fo-menu-toggle` / `#fo-mobile-menu`), medlems-modal på forsiden (`#fo-member-modal`), sticky CTA på aktørsider (`#stickyCTA`), tilbuds-rails med horisontalt mushjul (`.offer-rail`), og link-fikser på aktørsider.
- **Cookie-banner:** samtykke lagres i `localStorage` under nøkkel `finnoss_cookie_consent_v1`. Banneret **bygges dynamisk** (`buildBanner()`) på alle sider som ikke har det statisk, så det vises på hele nettstedet. **Analyse er samtykke-styrt:** sett `const ANALYTICS_ID = "G-…"` øverst i cookie-IIFE-en → da laster `loadAnalytics()` Google Analytics **kun** etter «Godta alle» (og automatisk ved retur hvis tidligere samtykket). Tom `ANALYTICS_ID` = ingen sporing. Sender fortsatt `finnoss:cookiesAccepted` / `finnoss:cookiesRejected`-events.
- **Registrerings-popup:** bygges dynamisk og fanges på alle `a[href="/bli-medlem/"]`-lenker; poster til `/api/registrer`. Faller tilbake til `/bli-medlem/`-siden hvis JS er av.
- **Fremdriftslinje:** gull scroll-indikator (`.fo-car-track`/`.fo-car-thumb`) legges additivt på hver karusell.
- NB: dette gjelder det **offentlige** nettstedet. PWA-en (`/app/`, `/admin/`) har egen inline-JS – se PWA-seksjonen.

## Filstruktur
- `index.html` – forside (omdirigerer til `/heggedal/` via `_redirects`).
- `heggedal/index.html` – hovedhub (hero, «Bli med gratis», kategorier, aktør- og blogg-karusell, kontakt).
- `heggedal/<aktør>/` – 27 aktør-/tjeneste-/innholdsmapper (bl.a. `blogg/`). Noen har undersider: `bakkal-heggedal/gulars/`, `martas-cafe/vinterkos/`.
- `om-oss/`, `bli-medlem/`, `personvern/`, `vilkar/`, `posten/`, `asker-golf-lounge/` (+ `asker-golf-lounge/golfsimulator/`).
- `styles.css` (all CSS for det offentlige nettstedet), `app.js` (all frontend-JS for nettstedet, se over).
- `functions/api/registrer.js` – påmelding → Brevo.
- `functions/api/teller.js` – henter antall påmeldte fra Brevo (fremdriftslinja).
- `404.html` – feilside. `_redirects`, `_headers`, `robots.txt`, `sitemap.xml`, `images/`.
- `SEO-VERIFISERING.md` – statusdokument for JSON-LD/FAQ/åpningstider per aktør (vedlikeholdt fra SEO-hold; se høyrisiko over). `README.md` – minimal.
- **PWA/medlemsapp:** `app/` (frontend) og `functions/api/` (backend) – se egen seksjon under.

## PWA / medlemsapp (`/app/` + `/admin/`)
Egen progressiv web-app for innloggede medlemmer, bygget oppå Cloudflare Pages Functions + D1. **Står utenom det statiske nettstedet** – egen, enklere inline-CSS (ikke `styles.css`), men samme fargepalett (`#06111d` bunn, `#d8a64c` gull).

**Frontend (`app/`):**
- `app/index.html` – install-/landingsside (PWA-prompt, iOS-instruks). `app/manifest.json`, `app/sw.js` (service worker: cache + push).
- `app/login/`, `app/register/` – auth-skjemaer. Token + bruker lagres i `localStorage` (`fo_token`, `fo_user`).
- `app/home/` – innlogget hjem: tilbud fra `/api/offers` (med hardkodet fallback), engangstilbud med innløsnings-overlay, push-banner.
- `admin/index.html` – admin-panel (oversikt, tilbud, push, brukere). **Innlogging: admin-nøkkelen skrives inn og valideres mot serveren** (ekte API-kall mot `/api/admin/stats`); nøkkelen lagres kun i `sessionStorage` (`fo_admin_key`). Ingen hemmelighet i klientkoden lenger.

**Backend (Cloudflare Pages Functions, `functions/api/`):**
- `auth/migrate.js` – oppretter D1-tabeller. Kjøres manuelt: `GET /api/auth/migrate?secret=…`. Idempotent.
- `auth/_hash.js` – **delt** passord-modul: **PBKDF2-HMAC-SHA-256** (per-bruker salt, 100k iterasjoner), format `pbkdf2$<iter>$<salt>$<hash>`. `verifyPassword()` godtar også gammelt SHA-256-format og flagger `needsUpgrade`. `_`-prefiks = ikke en rute. Importeres av login/register.
- `auth/register.js`, `auth/login.js` – auth via `_hash.js`. **Login oppgraderer gamle passord til PBKDF2** transparent ved vellykket innlogging, og har **rate-limiting** (maks 10 feilforsøk per IP per 15 min via tabellen `login_attempts`; feiler «åpent» hvis tabellen mangler).
- `offers.js` (offentlig GET, filtrerer brukte engangstilbud), `offers/redeem.js` (innløsning – **utleder bruker fra `Authorization: Bearer <token>` via `sessions`, ikke fra body**), `admin/offers.js`, `admin/offers/[id].js`, `admin/stats.js`, `admin/users.js` – admin beskyttes av header `x-admin-key` som valideres mot **`env.ADMIN_KEY`** (server-side secret).
- `push/vapid-key.js`, `push/subscribe.js`, `admin/push.js` – Web Push (VAPID + RFC 8291 aes128gcm).

**D1-skjema (`migrate.js`):** `users`, `sessions`, `offers` (`once`=engangstilbud, `max_uses`=antall tillatte bruk per bruker for flergangstilbud), `push_subscriptions`, `redemptions` (unik på `id` – **ikke** lenger `UNIQUE(user_id, offer_id)`, så flergangstilbud er mulig; antall styres i koden via `count < max_uses`), `login_attempts` (rate-limiting: `id, ip, email, ts`).

**Status sikkerhet (utført – live på `main`):**
- ✅ Admin-API sikret: nøkkel som server-side secret `env.ADMIN_KEY` (ikke i klientkoden). `/api/admin/users` krever nå gyldig nøkkel.
- ✅ Passord-hashing byttet til PBKDF2 (per-bruker salt) med transparent oppgradering av gamle passord.
- ✅ Rate-limiting på innlogging.
- ✅ Eierskaps-sjekk på tilbud-innløsning (token-basert).

**Gjenstår / valgfritt:**
- Cloudflare Access foran `/admin/*` som ekstra lås (API-et er allerede sikret) – valgfritt.
- Rydde evt. test-data i D1 (via admin-panelet).
- `/app/` og `/admin/` er satt `noindex` + `Disallow` i robots.txt.
- iOS: Web Push virker **kun** når appen er lagt til hjemskjermen (standalone).

## Integrasjoner
- **Brevo (e-post):** påmeldinger lagres i **liste-ID 3** (overstyrbart med env-var `BREVO_LIST_ID`). API-nøkkel som env-var **`BREVO_API_KEY`** i Cloudflare – **aldri hardkod nøkler**. `/api/teller` cacher antallet ~5 min (kantcache) og rapporterer mot mål `goal: 500`.
- **`/api/registrer`:** validerer e-post + norsk mobil (normaliseres til `+47…`/E.164), krever samtykke, har honeypot-felt (`company`). Kun `POST`.
- **Cloudflare D1:** databasen må bindes som **`DB`** på Pages-prosjektet, ellers feiler alle `/api/auth/*` og `/api/admin/*`. Etter binding: kjør migreringen (over). Bindinger/env-vars slår inn **ved neste deploy**.
- **Admin-API:** nøkkel som env-var **`ADMIN_KEY`** (secret) i Cloudflare. Brukes som `x-admin-key` mot `/api/admin/*` og som admin-innlogging. Slår inn ved neste deploy. **Aldri hardkod.**
- **Web Push (VAPID):** env-vars **`VAPID_PUBLIC`**, **`VAPID_PRIVATE`**, **`VAPID_SUBJECT`** (`mailto:…`). Genereres med `npx web-push generate-vapid-keys`.
- **`_redirects`:** `/` → `/heggedal/` (302, midlertidig); `www.finnoss.no` → uten www (301, kanonisk).

## Status & utestående (per juni 2026)
- **⚠️ Kjør D1-migreringen** for at rate-limiting-tabellen skal opprettes: `GET /api/auth/migrate?secret=…` (samme secret som ligger i `migrate.js`). Idempotent. Sjekk om dette er gjort.
- **Juridisk (live):** `personvern/` dekker nå medlemsappen (konto, passord-hash, innløsninger, push, nyhetsbrev), navngir databehandlere (Cloudflare, Brevo), rettslig grunnlag, lagringstid, EØS/SCC. Kontakt-e-post overalt: **cato@askergolflounge.no**. Endring av juridisk tekst krever fortsatt godkjenning.
- **SEO (live):** selvrefererende `<link rel="canonical">` på alle 38 offentlige sider (uten www). `sitemap.xml` oppdatert (38 URL-er). Fundament fra før: unike titler/meta, Open Graph, én H1/side. Ikke rørt (SEO-hold): JSON-LD mangler på 12 sider; forsiden `/`→`/heggedal/` er bevisst **302** (kan bli 301 – avklar først).
- **Google Search Console:** siden er indeksert (~46 sider, ytelsesdata finnes). Verifisert eiendom er **`https://www.finnoss.no/` (med www)**; en uten-www-eiendom finnes men er ubekreftet. **Anbefalt opprydding:** ett **domeneområde** `finnoss.no` (dekker www + uten-www, matcher sitemap) – krever TXT-post hos Webhuset (Cato gjør det selv; rør ikke DNS). Sitemap sendes inn med stien `sitemap.xml`, ikke full URL.

## Omfang
- Jobb **kun** i dette repoet (`finnoss-site`). Ikke rør andre repoer eller filer utenfor prosjektet.
