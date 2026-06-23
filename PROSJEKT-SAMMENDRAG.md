# FinnOss – prosjektsammendrag (overlevering)

Kort kontekst for å fortsette arbeidet i en ny tråd / Claude Project.

## Hva er dette
- **Nettsted:** finnoss.no – en lokal «hub» for butikker, tjenester og opplevelser, med Heggedal som hovedområde.
- **Repo:** `cato-cell/finnoss-site` (GitHub).
- **Utviklingsgren:** `claude/vibrant-wright-cne7jk`. **Produksjon:** `main`.
- **Hosting:** Cloudflare Pages (prosjekt `finnoss-site`).
  - Push til **`main`** → deploy til **produksjon** (`finnoss.no` / `finnoss-site.pages.dev`).
  - Push til andre grener → **preview** på egen hash-adresse (`…hash….finnoss-site.pages.dev`).
- **Teknologi:** Statisk side (portert fra WordPress). Ren HTML/CSS/JS, ingen build.

## Filstruktur (viktigste)
- `index.html` – forsiden (omdirigerer til /heggedal).
- `heggedal/index.html` – hovedhub (hero, «Bli med gratis», kategorier, aktørkaruseller, blogg-karusell, kontakt).
- `heggedal/<aktør>/index.html` – ~30 aktør-/tjenestesider.
- `om-oss/`, `bli-medlem/`, `personvern/`, `vilkar/`, `posten/`, `asker-golf-lounge/`.
- `styles.css` – global CSS (alt design ligger her).
- `app.js` – karusell-logikk (piler) + scroll-fremdriftsindikator.
- `functions/api/registrer.js` – påmelding → Brevo (Cloudflare Pages Function).
- `functions/api/teller.js` – henter antall påmeldte fra Brevo (for fremdriftslinja).
- `_redirects`, `_headers` – Cloudflare-ruting og cache.
- `images/` – bildefiler.

## Integrasjoner / drift
- **Brevo (e-post):** påmeldinger lagres i **liste-ID 3**. API-nøkkel ligger som miljøvariabel **`BREVO_API_KEY`** i Cloudflare Pages. `/api/teller` cacher antallet ~5 min.
- **Cache:** `styles.css` lenkes med `?v=20260619` (cache-buster). `_headers` gjør at `styles.css`/`app.js` revalideres (så CSS-endringer vises raskt). Ved større CSS-endringer: vurder å bumpe versjonsnummeret.
- **Omdirigeringer (`_redirects`):**
  - `/` → `/heggedal/` (302, midlertidig – «per nå» lander forsiden på Heggedal).
  - `https://www.finnoss.no/*` → `https://finnoss.no/:splat` (301, kanonisk uten www).
- **DNS (Cloudflare):** apex `finnoss.no` og `www` peker nå på Pages. **MX/TXT (e-post) mot `webhuset.no` skal IKKE røres.** Wildcard `*.finnoss.no` peker fortsatt på gammel WordPress (`46.226.10.77`).

## Arbeidsflyt for endringer
1. Jobb på `claude/vibrant-wright-cne7jk`, commit.
2. Preview: `git push` grenen → sjekk hash-adressen i Cloudflare → Deployments.
3. Live: `git checkout main && git merge --ff-only <gren> && git push origin main`.
4. **NB – cache:** test alltid i privat fane på mobil.
5. **NB – samtidige endringer:** `main` får av og til pushet SEO-arbeid fra annet hold. `git fetch origin main` før merge; rebase grenen ved divergens (gjort før uten konflikt).

## Gjort i denne sesjonen (alt live på `main`)
1. **Kategori-titler:** var uleselig blå (arvet standard lenkefarge) → satt lesbar `--fo-ink` + hover-løft.
2. **«Bli med gratis»-seksjon løftet:** gull-highlight på «gratis», fordels-chips, ryddet finstilt tekst, premium «gavekort»-visuelt.
3. **Fremdriftslinje mot 500 påmeldte** + **selvoppdaterende teller** som henter ekte tall fra Brevo (`/api/teller`).
4. **Kort-v2-karusell** (designer-levering, flettet inn): klikkbare bilde-først shop-kort, «Medlemstilbud»-markør, gull scroll-indikator. Samme design også på **blogg-karusellen**.
5. **Forsiden → /heggedal** (302) og **www → finnoss.no** (301).
6. **Cache-fiks:** versjonert `styles.css` + `_headers`.
7. **Logo-justering:** beskåret logo (`images/finnoss-logo-3-trim.png`, uten luft) + toppfelt linjert med seksjonene – på både mobil (≤640px) og iPad/desktop (>640px).
8. **Hero fyller hele mobilskjermen** (100svh) – ingen «peek» av neste seksjon.
9. **Gavekort-glitch** (hvit «chip»-boks) fjernet.

## Åpne / mulige neste steg
- **Dato på blogg-kort:** fjernet for å matche kort-designet – kan legges tilbake stilig om ønskelig.
- **Teller/fremdriftsbar på `/bli-medlem/`-siden** (nå kun på Heggedal-forsiden).
- **Wildcard `*.finnoss.no`** peker fortsatt på gammel WordPress – rydd opp ved behov.
- **Forsiden:** omdirigeringen til /heggedal er midlertidig (302) – fjern `_redirects`-regelen når forsiden skal lande på seg selv igjen.

## Nyttig å vite
- Claude-miljøet kan **ikke** laste `finnoss.no` direkte (egress-blokkering), så live-verifisering må gjøres av deg (skjermbilde funker).
- Design-tokens i `styles.css :root`: `--fo-ink` (tekst), `--fo-gold1/2` (gull), `--fo-bg0/1/2`, `--fo-accent`.
