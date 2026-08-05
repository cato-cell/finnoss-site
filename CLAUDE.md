# CLAUDE.md – FinnOss

Retningslinjer for Claude Code i dette repoet. Les dette før du gjør endringer.

## 👉 START HER – gjenstående oppgaver (per 2026-08-02)
Alt annet i dette dokumentet beskriver hva som **er gjort**. Dette er hva som **gjenstår**:

**Blokkerer lansering:** ✅ **Ingen.** Org.nr-punktet ble lukket 2026-08-05 – se «Selskap bak FinnOss» under.

**Venter på Cato (ikke blokkerende):**
- **Trafikkfane i admin** – ønsket, men utsatt. Krever et Cloudflare **«Analytics: Read»**-token. Plan: `functions/api/admin/analytics.js` mot Cloudflares GraphQL Analytics API + fane i admin.
- **Slette merga grener i GitHub-UI** (Claude Code får 403 på ref-sletting). Per 2026-08-02 kan **alle** grener unntatt `main` slettes – også `claude/claude-md-docs-2i56cv` og `claude/elegant-goodall-p5h3xn`, som er verifisert utdatert (frakoblet historikk, main ligger foran på alt).
- **Åpningstider for 13 aktører** – se «Åpningstider» under. Trenger faktiske tider; **ikke gjett**.

**Bevisst nedprioritert (ikke ta opp igjen uoppfordret):**
- KIWIs placeholder-telefon og to «Følg på Instagram»-lenker. Ligger i `scripts/helsesjekk-unntak.txt` så helse-agenten ikke maser.
- Pizza-bilde på `heggedal-pizza-bar/` – ønsket byttet til stock-foto, men **egress er blokkert** i Claude Code-miljøet (403 mot Unsplash/Pexels). Krever at Cato laster opp bildet selv.

**Nyttig å vite:** kjør `npm run build:aktorer` etter endringer på aktørsider. Helse-agenten kjører daglig og åpner GitHub-issue ved nye avvik.

## Selskap bak FinnOss
**Asd Media & Production AS**, org.nr **916 585 993**, Heggedal torg 18, 1389 Heggedal. Samme selskap står bak NextNova og NiftyHR. Kontakt: `cato@askergolflounge.no`.

Lagt inn 2026-08-05 på alle steder som trenger det – **ikke legg det inn på nytt andre steder uten grunn**:
- **Bunntekst, alle 41 sider:** `© FinnOss · Asd Media & Production AS · Org.nr 916 585 993`. Fire ulike copyright-varianter ble samtidig normalisert til denne ene, og årstallet fjernet (var hardkodet «2026» på 18 sider).
- **`personvern/` § 1:** foretaksnavn + org.nr + adresse som behandlingsansvarlig (sto tidligere bare «FinnOss.no», som ikke er et rettssubjekt).
- **`vilkar/` § 1:** hvem som leverer tjenesten.
- **`om-oss/`:** avsnittet «Hvem står bak».
- **`Organization`-JSON-LD** på `heggedal/index.html` og `om-oss/index.html`, `@id: https://finnoss.no/#organisasjon`, med `legalName`, `taxID`, `identifier`, `logo` og `address`. Logoen peker bevisst på **PNG**, ikke WebP (crawler-kompatibilitet, samme regel som `og:image`).

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
- `heggedal/<aktør>/` – 28 aktør-/tjeneste-/innholdsmapper (bl.a. `blogg/`, `nextnova/`, `heggedal-pizza-bar/`). Noen har undersider: `bakkal-heggedal/gulars/`, `martas-cafe/vinterkos/`. **Totalt 30 aktører** inkl. rot-unntakene `posten/` og `asker-golf-lounge/`.
- `om-oss/`, `bli-medlem/`, `personvern/`, `vilkar/`, `posten/`, `asker-golf-lounge/` (+ `asker-golf-lounge/golfsimulator/`).
- `styles.css` (all CSS for det offentlige nettstedet), `app.js` (all frontend-JS for nettstedet, se over).
- `functions/api/registrer.js` – påmelding → Brevo.
- `functions/api/teller.js` – henter antall påmeldte fra Brevo (fremdriftslinja).
- `404.html` – feilside. `_redirects`, `_headers`, `robots.txt`, `sitemap.xml`, `images/`.
- `favicon.ico` (repo-rot) – **auto-oppdaget av Google og nettlesere for hele domenet**. Laget fra logoens emblem på navy `#06111d`; kildevarianter `images/finnoss-favicon.png` (512) og `images/finnoss-favicon-180.png` (apple-touch-icon). `<link rel="icon">` ligger i `index.html` + `heggedal/index.html`.
- `.github/workflows/helsesjekk.yml` + `scripts/helsesjekk.sh` – **helse-agent** (daglig cron + manuell): døde interne lenker, wp-rester, hardkodede hemmeligheter, placeholder-CTA-er, noindex-lekkasje, manglende canonical, brutte bilde-referanser, sitemap, bilde-regresjon. Åpner/oppdaterer én GitHub-issue (label `helsesjekk`), lukker den automatisk når grønt. **`scripts/helsesjekk-unntak.txt`** = kjente, aksepterte funn som ikke skal varsles (én linje per funn, `#` = kommentar). Per 2026-08-02 ligger KIWIs placeholder-telefon og to «Følg på Instagram»-lenker der – bevisst nedprioritert, så agenten kun varsler om **nye** problemer. Fjern en linje derfra for å begynne å varsle igjen. `.github/workflows/helse-autofiks.yml` – **PR-basert reparatør** (kun manuell, merger aldri selv); **inert** til Claude GitHub-app + `ANTHROPIC_API_KEY` er lagt inn.
- `SEO-VERIFISERING.md` – statusdokument for JSON-LD/FAQ/åpningstider per aktør (vedlikeholdt fra SEO-hold; se høyrisiko over). `README.md` – minimal.
- **PWA/medlemsapp:** `app/` (frontend) og `functions/api/` (backend) – se egen seksjon under.

## PWA / medlemsapp (`/app/` + `/admin/`)
Egen progressiv web-app for innloggede medlemmer, bygget oppå Cloudflare Pages Functions + D1. **Står utenom det statiske nettstedet** – egen, enklere inline-CSS (ikke `styles.css`), men samme fargepalett (`#06111d` bunn, `#d8a64c` gull).

**Frontend (`app/`):**
- `app/index.html` – install-/landingsside (PWA-prompt, iOS-instruks). `app/manifest.json`, `app/sw.js` (service worker: cache + push).
- **Service worker (2026-08-02):** `sw.js` **registreres nå fra alle app-sider** (`navigator.serviceWorker.register('/app/sw.js')` rett før `</body>`) – tidligere lå fila der uten å bli aktivert, så offline-buffer og push virket kun i installert PWA. Strategi: **network-first** med runtime-cache som reserve. **Bump `CACHE_NAME` i `sw.js` ved app-endringer** (nå `finnoss-v4`) – `activate` sletter alle cacher med annet navn, så gammelt innhold tømmes og oppdateringer slår gjennom.
- `app/login/`, `app/register/` – auth-skjemaer. Token + bruker lagres i `localStorage` (`fo_token`, `fo_user`).
- `app/home/` – innlogget hjem: tilbud fra `/api/offers` (med hardkodet fallback), engangstilbud med innløsnings-overlay, push-banner.
- `app/utforsk/` **(2026-08-02):** in-app aktørutforsker. Kategorifilter-chips (styrt av `?kategori=mat-drikke|butikker|helse-velvaere|tjenester`), klientside-søk på navn/beskrivelse, aktørkort med «Har medlemstilbud»-badge (matcher `/api/offers` sitt `actor`-navn), og bottom-sheet-detalj med maps-/tel-lenke, «Bruk tilbud» (samme innløsning som Hjem) og dempet lenke til full profil på `/heggedal/<slug>/`. Home-paletten (`--navy:#06121f`/`--gold:#e0ad52`), egne app-klasser (ikke `fo-`). Kategoriknappene på `app/home/` peker nå hit. Offline-tolerant via samme network-first-SW som resten av appen (ingen SW-endring).
- **Datakilde `app/data/aktorer.json`** genereres av **`scripts/build-aktorer.mjs`** (`npm run build:aktorer`, se `package.json`). Skriptet leser aktørsidene (JSON-LD + fallback til `<title>`/`<h1>`/meta), henter kategori fra hub-karusellene i `heggedal/index.html` (+ overstyringer `niftyhr`/`posten`/`asker-golf-lounge` → tjenester), ekskluderer undersider, sorterer alfabetisk og logger manglende strukturert data / ukategoriserte. **Åpningstider** hentes fra `openingHoursSpecification` og normaliseres til `apningstider: { man:[["09:00","17:00"]], … , son:[] }` – flere intervaller per dag støttes (f.eks. Posten 08–10 + 15–18), tom liste = stengt, `null` = **ikke oppgitt** (≠ stengt). Appen regner ut «Åpent nå / Stengt · åpner …» klientside. **16 av 30 aktører har tider i JSON-LD** per 2026-08-02; resten vises som «ikke oppgitt» til tidene legges inn på aktørsiden. **Kjør skriptet på nytt når aktører legges til/endres.**
- **Desktop-layout (2026-07-26):** `app/index.html`, `app/home/` og `app/register/` har responsivt desktop-oppsett bak **`@media (min-width:900px)`** i sitt eget inline-`<style>` (bredere container 980/1080px via per-seksjon `max-width`, tilbud i 2-kol grid, register i to-kolonne bilde/skjema, subtil Heggedal-husrekke-silhuett i sidefeltene). **Mobil (<900px) er uendret.** PWA-brekkpunkt = **900px** – hold nye app-sider konsistente (NB: forskjellig fra det offentlige nettstedets 640px).
- `admin/index.html` – admin-panel (oversikt, tilbud, push, medlemmer). **Innlogging: admin-nøkkelen skrives inn og valideres mot serveren** (ekte API-kall mot `/api/admin/stats`); nøkkelen lagres kun i `sessionStorage`/`localStorage` (`fo_admin_key`). Ingen hemmelighet i klientkoden lenger.
  - **Medlemssøk (2026-08-02):** søkefelt øverst i Medlemmer-fanen filtrerer på navn/e-post/telefon **klientside** (`ALLE_BRUKERE` holdes i minnet, `renderUsers()` filtrerer). Viser «Viser X av Y medlemmer». Søket overlever redigering/sletting fordi `renderUsers()` leser søkefeltet på nytt ved hver visning.
  - **E-postdiagnose (2026-08-02):** boks nederst i **Oversikt**-fanen → `POST /api/admin/epost-diagnose`. Rapporterer om `BREVO_API_KEY` er satt, hvilken avsender som brukes, om brukerkontoen finnes, om `password_resets` finnes, og Brevos eksakte svar på en testsending – med kort tolkning på norsk. Bygget fordi «glemt passord» alltid svarer likt utad (anti-opplisting), så feil ellers blir usynlige. Sender **kun** én test-e-post til oppgitt adresse.

**Backend (Cloudflare Pages Functions, `functions/api/`):**
- `auth/migrate.js` – oppretter D1-tabeller. Kjøres manuelt: `GET /api/auth/migrate?secret=…` der secret valideres mot **`env.MIGRATE_SECRET`** (Cloudflare-secret, **ikke** hardkodet; fail-closed uten konfigurert verdi). Idempotent.
- `auth/_hash.js` – **delt** passord-modul: **PBKDF2-HMAC-SHA-256** (per-bruker salt, 100k iterasjoner), format `pbkdf2$<iter>$<salt>$<hash>`. `verifyPassword()` godtar også gammelt SHA-256-format og flagger `needsUpgrade`. `_`-prefiks = ikke en rute. Importeres av login/register.
- `auth/forgot.js` + `auth/reset.js` – **glemt passord (2026-08-02)**. `POST /api/auth/forgot {email}` lager engangs-token, lagrer **kun SHA-256-hashen** i `password_resets` og sender lenke via **Brevo transaksjonell e-post** (`/v3/smtp/email`). Svarer alltid likt uansett om e-posten finnes (ingen e-postopplisting), 60 min levetid, rate-limit 5/15 min per IP. `POST /api/auth/reset {token,password}` validerer token (ubrukt + ikke utløpt), setter nytt PBKDF2-passord, brenner tokenet og **sletter alle økter** for brukeren. Frontend: `app/glemt-passord/` og `app/nytt-passord/` (leser `?token=`), lenket fra `app/login/`. **Avsender styres av env `BREVO_SENDER_EMAIL`** (må være verifisert avsender i Brevo; fallback `cato@askergolflounge.no`).
- `auth/register.js`, `auth/login.js` – auth via `_hash.js`. **Login oppgraderer gamle passord til PBKDF2** transparent ved vellykket innlogging, og har **rate-limiting** (maks 10 feilforsøk per IP per 15 min via tabellen `login_attempts`; feiler «åpent» hvis tabellen mangler).
- `offers.js` (offentlig GET, filtrerer brukte engangstilbud), `offers/redeem.js` (innløsning – **utleder bruker fra `Authorization: Bearer <token>` via `sessions`, ikke fra body**), `admin/offers.js`, `admin/offers/[id].js`, `admin/stats.js`, `admin/users.js` – admin beskyttes av header `x-admin-key` som valideres mot **`env.ADMIN_KEY`** (server-side secret).
- `push/vapid-key.js`, `push/subscribe.js`, `admin/push.js` – Web Push (VAPID + RFC 8291 aes128gcm).

**D1-skjema (`migrate.js`):** `users`, `sessions`, `offers` (`once`=engangstilbud, `max_uses`=antall tillatte bruk per bruker for flergangstilbud), `push_subscriptions`, `redemptions` (unik på `id` – **ikke** lenger `UNIQUE(user_id, offer_id)`, så flergangstilbud er mulig; antall styres i koden via `count < max_uses`), `login_attempts` (rate-limiting: `id, ip, email, ts`; rader med `email='reset'` teller «glemt passord»-forespørsler), `password_resets` (`id, user_id, token_hash, expires_at, used, created_at` – kun hash av tokenet lagres). **NB: kjør migreringen på nytt** etter deploy så `password_resets` opprettes.

**Status sikkerhet (utført – live på `main`):**
- ✅ Admin-API sikret: nøkkel som server-side secret `env.ADMIN_KEY` (ikke i klientkoden). `/api/admin/users` krever nå gyldig nøkkel.
- ✅ Passord-hashing byttet til PBKDF2 (per-bruker salt) med transparent oppgradering av gamle passord.
- ✅ Rate-limiting på innlogging.
- ✅ Eierskaps-sjekk på tilbud-innløsning (token-basert).
- ✅ **Migreringssecret** flyttet fra hardkodet streng til Cloudflare-secret `env.MIGRATE_SECRET` (fail-closed). Ikke lenger synlig i kildekoden (2026-07-26).
- ✅ **`ADMIN_KEY` og `VAPID_PRIVATE`** lagret som Cloudflare **Secrets** (kryptert), ikke Plaintext (2026-07-26).

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
- **Web Push (VAPID):** env-vars **`VAPID_PUBLIC`**, **`VAPID_PRIVATE`**, **`VAPID_SUBJECT`** (`mailto:…`). Genereres med `npx web-push generate-vapid-keys`. `VAPID_PRIVATE` skal være **Secret** (kryptert). NB: bytt aldri selve verdien uten å oppdatere `VAPID_PUBLIC` – det invaliderer eksisterende push-abonnenter.
- **`_redirects`:** `/` → `/heggedal/` (302, midlertidig); `www.finnoss.no` → uten www (301, kanonisk).

## Status & utestående (oppdatert 2026-08-02)
- **D1-migreringen er kjørt (verifisert live 2026-07-26):** alle tabeller finnes (`users`, `sessions`, `offers`, `redemptions`, `push_subscriptions` med riktig `endpoint`/`p256dh`/`auth`-skjema, `login_attempts`). Secret for endepunktet ligger nå i `env.MIGRATE_SECRET` (ikke i koden). Kjøres ved behov: `GET /api/auth/migrate?secret=…`. Idempotent.
- **Juridisk (live):** `personvern/` dekker nå medlemsappen (konto, passord-hash, innløsninger, push, nyhetsbrev), navngir databehandlere (Cloudflare, Brevo), rettslig grunnlag, lagringstid, EØS/SCC. Kontakt-e-post overalt: **cato@askergolflounge.no**. Endring av juridisk tekst krever fortsatt godkjenning.
- **Aktører (live):** **NextNova** (nettsider + praktisk AI-hjelp, `nextnova.no`) lagt til under kategorien **Tjenester**, adresse **Heggedal Torg 18**. Live på `/heggedal/nextnova/`, lenket i Tjenester-karusellen og i `sitemap.xml` (2026-07-26). **Heggedal Pizza & Bar** (Heggedal Torg 20, tlf. 93 93 09 30) lagt til under **Mat & drikke** (2026-08-02): `Restaurant`-JSON-LD med `openingHoursSpecification` (alle dager 14:00–22:00), `hasMenu`, `servesCuisine`; full meny på siden i kategorifiltrert priskort-grid (`id="meny"`, egne `fo-meny-*`-klasser i sidens `<style>`).
- **SEO (live):** selvrefererende `<link rel="canonical">` på alle offentlige sider (uten www). `sitemap.xml` oppdatert. Fundament fra før: unike titler/meta, Open Graph, én H1/side. **JSON-LD (oppdatert 2026-07-26):** lagt til additivt på 4 tidligere manglende innholdssider (`heggedal/blogg/` → `Blog`; `asker-golf-lounge/golfsimulator/`, `heggedal/bakkal-heggedal/gulars/`, `heggedal/martas-cafe/vinterkos/` → `Article` med `about`-referanse til foreldre-bedriften). Dekning nå **33/40**; de resterende 7 er bevisste unntak (feilside, redirect-forside, hub, `om-oss/`, `bli-medlem/`, `personvern/`, `vilkar/`). Forsiden `/`→`/heggedal/` er bevisst **302** (kan bli 301 – avklar først).
- **Nettsted-fikser (2026-07-26):** rettet 3 døde interne lenker (`golfsimulator/` «tilbake»-lenke → `/asker-golf-lounge/`; `personvern/` + `vilkar/` meny «Om FinnOss» → `/om-oss/`); la til `og:image` på hub-en (`heggedal/index.html`, `heggedal-hero.jpg`). **Bildeoptimalisering:** 13 tunge bilder rekomprimert in-place (JPEG q85 progressiv, maks langside 2400px, PNG lossless) → `images/` **15 MB → 8,9 MB**, samme filnavn/format (ingen referanse-endringer).
- **WebP (live 2026-08-02):** 30 bilder konvertert til WebP (q82, alpha-bilder q85). **`<img>`- og CSS-referanser peker på `.webp`** → besøkende laster **8,4 MB → 4,9 MB (−42 %)**. **`og:image` og JSON-LD `image` peker bevisst fortsatt på JPEG/PNG-originalene**, fordi LinkedIn/Facebook har ustabil WebP-støtte for delingsbilder – originalene beholdes derfor for de 20 bildene som brukes av crawlere (de 10 øvrige er slettet). Ikoner (`favicon*`, `pwa-icon*`) og logo-kildene (`finnoss-logo*`) er bevisst ikke konvertert. **Ved nye bilder: legg inn WebP for `<img>`, og behold en JPEG/PNG hvis bildet skal brukes som `og:image`.**
- **Sikkerhetsheadere (live 2026-08-02):** `_headers` setter `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff` og `Referrer-Policy: strict-origin-when-cross-origin` på `/*`. **CSP er bevisst utelatt** – den kan brekke Google Analytics og inline-JS, og krever egen testrunde.
- **Åpne avvik (fra helse-agenten / audit):** **org.nr mangler på alle sider** (blokkerende punkt i sjekklisten – krever selskapsinfo fra Cato) · KIWI har `tel:+00000000` (placeholder, 2 steder) · «Følg på Instagram» er `href="#"` på `lille-haveli/` og `heggedal-service/`. (WebP-punktet som lå her er utført – se linjen over.)
- **Google Search Console (ryddet 2026-08-05):** domeneområdet **`finnoss.no` er verifisert og i bruk** – dekker www + uten-www, matcher sitemap og canonical. **Ingen DNS-endring trengs** (TXT-posten lå der fra før; den tidligere notatteksten om «ubekreftet» var feil). Jobb alltid i denne eiendommen, ikke i den gamle `https://www.finnoss.no/`-eiendommen, som tømmes av seg selv etter hvert som www-URL-ene faller ut (7 indekserte igjen per 05.08). **Nettkart:** `https://finnoss.no/sitemap.xml` – Fullført, 40 sider. I et domeneområde må **full URL** sendes inn, ikke bare stien. Død `sitemap_index.xml` (WordPress-rest) fjernet.
- **Sideindeksering per 05.08.2026:** 42 indekserte / 112 ikke indekserte. Av de ikke-indekserte er ~38 forventet støy (kanoniske www-alternativer, viderekoblinger, `noindex` på `/app/` + `/admin/`). **Gjenstår å se på:** «Gjennomsøkt – ikke indeksert» (14 sider – ekte sider Google har valgt bort, trolig tynt/likt innhold), «Viderekoblingsfeil» (1) og «Blokkert av annet 4xx-problem» (1).
- **301-regler for WordPress-arven (live 2026-08-05):** Search Console viste 58 sider som «Ikke funnet (404)» – nesten alle gamle WP-adresser der aktørsidene lå under `/heggedal/aktorer/<slug>/`. `_redirects` har nå 22 regler som fanger 46 av dem: én wildcard fjerner `/aktorer/`-mellomleddet for de 26 aktørene med uendret slug, pluss egne regler for slug-endringer (`cut-frisor`→`cut`, `kime-catering-og-kafe`→`kime`, `utvendig-drift`→`utvendigdrift`, `pizza`→`heggedal-pizza-bar`), `posten/` (ligger i repo-roten), uportede undersider, nedlagte aktører (Alegria, Handover → huben) og løse rot-adresser (`/gulars/`, `/om-finnoss/`, `/booking-asker-golf-lounge/`, `/uncategorized/*`). **NB: i `_redirects` vinner første treff – spesifikke regler må stå før wildcard-regelen.** De 12 resterende (`/demo/`, `/demo2/`, `/demo3/`, `/webinar/`, `/login/`, `/category/uncategorized/`, `/wp-content/*`) er **bevisst latt som 404** – en 301 til forsiden ville blitt lest som soft 404. Regn med 2–4 uker før tallet faller i rapporten.

## Løste funn (historikk – alle punktene under er FERDIG)
- **Push-skjema (løst 2026-07-26):** `functions/api/auth/migrate.js` bygger nå push-tabellen med de tre kolonnene `endpoint`/`p256dh`/`auth` (og bygger om en evt. gammel `subscription`-blob-tabell uten datatap). Verifisert live: skjemaet er riktig og tabellen har reelle abonnenter.
- **`vilkar/index.html` wp-content (løst 2026-07-26):** hero-bildet (`og:image` + `<img>`) pekte på en død `www.finnoss.no/wp-content/…`-URL; byttet til lokal `/images/finnoss-vilkar-hero.jpg`. **Siste WordPress-rest er dermed borte** – ingen `wp-content` igjen i repoet.
- **Asker Golf Lounge JSON-LD (løst 2026-07-26):** hovedsiden har `SportsActivityLocation`-JSON-LD, og undersiden `golfsimulator/` har fått `Article`-JSON-LD. Ikke lenger et hull.
- **`Finnoss logo.jpg` i repo-rot (ryddet):** ikke lenger til stede (ingen løse bildefiler i repo-rot per 2026-07-26).
- **Git-hygiene (verifisert 2026-08-02):** alle grener utenom `main` kan slettes. De 8 arbeidsgrenene er fullstendig merget. `claude/claude-md-docs-2i56cv` (48 commits) og `claude/elegant-goodall-p5h3xn` (38 commits) har **frakoblet historikk** (egne rot-commits fra en eldre repo-versjon) og er verifisert utdatert: main har 77 filer de mangler, 17 vs 14 sider med åpningstider, lik FAQ-dekning. Ingen tapt verdi. Sletting må gjøres i GitHub-UI (403 fra Claude Code).
- **Glemt passord (løst 2026-08-02):** verifisert live av Cato. Årsaken til at det først «ikke virket» var at test-e-posten ikke hadde brukerkonto i `users` – flyten svarte korrekt (generisk svar, ingen e-post). Brevo-avsender `cato@askergolflounge.no` er **verifisert med DKIM + DMARC**. `forgot.js` oppretter `password_resets` ved behov, så manuell migrering er ikke påkrevd.

## Omfang
- Jobb **kun** i dette repoet (`finnoss-site`). Ikke rør andre repoer eller filer utenfor prosjektet.
