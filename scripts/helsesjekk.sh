#!/usr/bin/env bash
# FinnOss helsesjekk – deterministiske sjekker mot repoet.
# Skriver funn til $REPORT (markdown). Avslutter med kode 1 hvis avvik finnes,
# 0 hvis alt er grønt. Kjøres av .github/workflows/helsesjekk.yml (planlagt),
# men kan også kjøres lokalt: bash scripts/helsesjekk.sh
set -uo pipefail
cd "$(dirname "$0")/.."
REPORT="${REPORT:-helsesjekk-rapport.md}"

issues=()
add(){ issues+=("$1"); }

# Kjente, aksepterte funn (se scripts/helsesjekk-unntak.txt). Filtrerer bort
# linjer som matcher et unntak, slik at agenten kun varsler om NYE problemer.
UNNTAK_FIL="scripts/helsesjekk-unntak.txt"
filtrer_unntak(){
  if [ -s "$UNNTAK_FIL" ]; then
    grep -vFf <(grep -vE '^\s*#|^\s*$' "$UNNTAK_FIL") || true
  else
    cat
  fi
}

# Offentlige HTML-filer (app/ og admin/ er bevisst noindex og holdes utenfor)
mapfile -t PUB < <(find . -name '*.html' -not -path './app/*' -not -path './admin/*' -not -path './node_modules/*' | sort)

# 1) Døde interne lenker: href="/x/" der målfilen ikke finnes
dead=""
for f in $(git ls-files '*.html' | grep -vE '^app/|^admin/'); do
  for p in $(grep -oE 'href="/[a-zA-Z0-9/_-]+/"' "$f" | sed 's/href="//;s/"//'); do
    [ -f ".${p}index.html" ] || dead+=$'\n'"  - \`$f\` → \`$p\`"
  done
done
[ -n "$dead" ] && add "**Døde interne lenker:**$dead"

# 2) WordPress-rester (wp-content) i offentlige sider
wp=$(grep -rl 'wp-content' --include=*.html . | grep -vE '^\./app/|^\./admin/' || true)
[ -n "$wp" ] && add "**WordPress-rester (wp-content):**"$'\n'"$(echo "$wp" | sed 's/^/  - /')"

# 3) Mulige hardkodede hemmeligheter
sec=$(grep -rniE "(api[_-]?key|secret|password|bearer)[\"' ]*[:=][\"' ]*[A-Za-z0-9_/-]{16,}" \
      --include=*.js --include=*.html . \
      | grep -viE "localStorage|sessionStorage|getItem|setItem|env\.|x-admin-key|Authorization|applicationServerKey|placeholder" || true)
[ -n "$sec" ] && add "**Mulige hardkodede hemmeligheter:**"$'\n'"$(echo "$sec" | sed 's/^/  - /' | head -20)"

# 4) Placeholder-/tomme lenker (tel:+0000..., href="#") – ødelagte CTA-er
ph=$(grep -rnoE 'href="tel:\+?0{4,}"|href="#"' --include=*.html . | sed 's|^\./||' | grep -vE '^app/|^admin/' | filtrer_unntak || true)
[ -n "$ph" ] && add "**Placeholder-/tomme lenker (ødelagte CTA-er):**"$'\n'"$(echo "$ph" | sed 's/^/  - /')"

# 5) noindex som lekker inn i offentlige sider (404 er OK)
ni=$(grep -rl 'noindex' --include=*.html . | grep -vE '^\./app/|^\./admin/|404\.html' || true)
[ -n "$ni" ] && add "**noindex i offentlige sider:**"$'\n'"$(echo "$ni" | sed 's/^/  - /')"

# 6) Manglende canonical (offentlige sider, unntatt 404)
mc=""
for f in "${PUB[@]}"; do
  case "$f" in *404.html) continue;; esac
  grep -qiE 'rel="canonical"' "$f" || mc+=$'\n'"  - \`$f\`"
done
[ -n "$mc" ] && add "**Mangler canonical:**$mc"

# 7) Brutte lokale bilde-referanser (/images/... som ikke finnes på disk)
bi=""
for f in $(git ls-files '*.html' | grep -vE '^app/|^admin/'); do
  for img in $(grep -oE '(src|content)="/images/[^"]+"' "$f" | sed 's/.*="//;s/"//'); do
    [ -f ".${img}" ] || bi+=$'\n'"  - \`$f\` → \`$img\`"
  done
done
[ -n "$bi" ] && add "**Brutte bilde-referanser:**$bi"

# 8) sitemap.xml velformet
if command -v xmllint >/dev/null 2>&1; then
  xmllint --noout sitemap.xml 2>/dev/null || add "**\`sitemap.xml\` er ikke velformet XML.**"
fi

# 9) Bilde-regresjon: filer over 1,5 MB (etter optimalisering skal ingen være det)
big=$(find images -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) -size +1500k -printf '  - `%p` (%k KB)\n' 2>/dev/null || true)
[ -n "$big" ] && add "**Bilder over 1,5 MB (bør reoptimaliseres):**"$'\n'"$big"

# --- Rapport ---
if [ ${#issues[@]} -eq 0 ]; then
  echo "✅ Helsesjekk: ingen avvik funnet." | tee "$REPORT"
  exit 0
fi

{
  echo "## 🩺 FinnOss helsesjekk – avvik funnet (${#issues[@]} kategori(er))"
  echo
  echo "Kjørt automatisk mot \`main\`. Rett opp punktene under, så lukkes denne saken av seg selv ved neste grønne kjøring."
  echo
  for i in "${issues[@]}"; do echo "$i"; echo; done
  echo "---"
  echo "_Generert av helse-agenten (\`.github/workflows/helsesjekk.yml\`)._"
} > "$REPORT"
cat "$REPORT"
exit 1
