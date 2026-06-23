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
- **Cookie-banner:** samtykke lagres i `localStorage` under nøkkel `finnoss_cookie_consent_v1`; sender `finnoss:cookiesAccepted` / `finnoss:cookiesRejected`-events (analyse-verktøy kan kobles på her senere).
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
- `admin/index.html` – admin-panel (oversikt, tilbud, push, brukere). **Passordsjekk er kun frontend** (`ADMIN_PASSWORD`-konstant) – beskytter ikke API-et reelt.

**Backend (Cloudflare Pages Functions, `functions/api/`):**
- `auth/migrate.js` – oppretter D1-tabeller. Kjøres manuelt: `GET /api/auth/migrate?secret=…`. Idempotent.
- `auth/register.js`, `auth/login.js` – auth (SHA-256-hash – **ikke** produksjonssterkt, se under).
- `offers.js` (offentlig GET, filtrerer brukte engangstilbud), `offers/redeem.js` (innløsning), `admin/offers.js`, `admin/offers/[id].js`, `admin/stats.js`, `admin/users.js` – admin beskyttes av header `x-admin-key`.
- `push/vapid-key.js`, `push/subscribe.js`, `admin/push.js` – Web Push (VAPID + RFC 8291 aes128gcm).

**D1-skjema (`migrate.js`):** `users`, `sessions`, `offers` (`once`=engangstilbud), `push_subscriptions`, `redemptions` (unik `(user_id, offer_id)`).

**Viktige forbehold (utestående – krever brukerens godkjenning før lansering):**
- `/admin/` og admin-API er **ikke reelt sikret** (passord/nøkkel ligger i klartekst i klientkoden; `/api/admin/users` eksponerer persondata). Anbefalt: Cloudflare Access foran `/admin/*` + nøkkel som server-side secret.
- Passord-hashing bruker rå SHA-256 med felles salt – bør byttes til bcrypt/PBKDF2/Argon2.
- `/app/` og `/admin/` er satt `noindex` + `Disallow` i robots.txt (skjult fra Google fram til lansering).
- iOS: Web Push virker **kun** når appen er lagt til hjemskjermen (standalone).

## Integrasjoner
- **Brevo (e-post):** påmeldinger lagres i **liste-ID 3** (overstyrbart med env-var `BREVO_LIST_ID`). API-nøkkel som env-var **`BREVO_API_KEY`** i Cloudflare – **aldri hardkod nøkler**. `/api/teller` cacher antallet ~5 min (kantcache) og rapporterer mot mål `goal: 500`.
- **`/api/registrer`:** validerer e-post + norsk mobil (normaliseres til `+47…`/E.164), krever samtykke, har honeypot-felt (`company`). Kun `POST`.
- **Cloudflare D1:** databasen må bindes som **`DB`** på Pages-prosjektet, ellers feiler alle `/api/auth/*` og `/api/admin/*`. Etter binding: kjør migreringen (over). Bindinger/env-vars slår inn **ved neste deploy**.
- **Web Push (VAPID):** env-vars **`VAPID_PUBLIC`**, **`VAPID_PRIVATE`**, **`VAPID_SUBJECT`** (`mailto:…`). Genereres med `npx web-push generate-vapid-keys`.
- **`_redirects`:** `/` → `/heggedal/` (302, midlertidig); `www.finnoss.no` → uten www (301, kanonisk).

## Omfang
- Jobb **kun** i dette repoet (`finnoss-site`). Ikke rør andre repoer eller filer utenfor prosjektet.
