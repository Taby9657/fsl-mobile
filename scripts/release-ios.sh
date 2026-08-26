#!/usr/bin/env bash
#
# FSL – kompletní vydání iOS buildu do App Store Connect.
#
#   bash scripts/release-ios.sh 1.0.1        # zvedne verzi, build + odeslání
#   bash scripts/release-ios.sh              # ponechá verzi z app.json
#   bash scripts/release-ios.sh 1.0.1 --no-submit   # jen build, bez odeslání
#
# Co dělá:
#   1. preflight (tsc, hlídač stylů, tokeny, čistý git na main)
#   2. volitelně přepíše expo.version v app.json a commitne to
#   3. push na origin/main
#   4. eas build --profile production --auto-submit  → TestFlight / ASC
#
# Build number se nezvedá ručně – eas.json má appVersionSource: "remote"
# a v production profilu autoIncrement: true, takže si ho hlídá EAS.
#
set -euo pipefail
cd "$(dirname "$0")/.."

NEW_VERSION=""
SUBMIT=1
for arg in "$@"; do
  case "$arg" in
    --no-submit) SUBMIT=0 ;;
    -h|--help)   sed -n '2,16p' "$0"; exit 0 ;;
    *)           NEW_VERSION="$arg" ;;
  esac
done

hr()   { printf '\n\033[1m── %s ─────────────────────────────\033[0m\n' "$1"; }
die()  { printf '\n\033[31m✘ %s\033[0m\n' "$1"; exit 1; }

hr "Nástroje"
command -v eas >/dev/null 2>&1 || die "eas-cli chybí. Nainstaluj: npm i -g eas-cli"
eas whoami >/dev/null 2>&1 || { echo "Nejsi přihlášen k Expo, spouštím login…"; eas login; }
echo "Expo účet: $(eas whoami)"

hr "Verze"
CURRENT=$(node -p "require('./app.json').expo.version")
if [ -n "$NEW_VERSION" ]; then
  echo "$NEW_VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' \
    || die "Verze musí být ve tvaru X.Y.Z, dostal jsem '$NEW_VERSION'"
  if [ "$NEW_VERSION" = "$CURRENT" ]; then
    echo "Verze už je $CURRENT, nechávám být."
  else
    node -e '
      const fs = require("fs");
      const j = JSON.parse(fs.readFileSync("app.json", "utf8"));
      j.expo.version = process.argv[1];
      fs.writeFileSync("app.json", JSON.stringify(j, null, 2) + "\n");
    ' "$NEW_VERSION"
    git add app.json
    git commit -m "chore: verze $NEW_VERSION"
    echo "app.json: $CURRENT → $NEW_VERSION (commitnuto)"
  fi
else
  echo "Verze zůstává $CURRENT"
  echo "Pozor: App Store nepřijme dvakrát stejnou verzi jako už schválenou."
fi

hr "Preflight"
bash scripts/preflight.sh || die "Preflight neprošel – build nespouštím."

hr "Push"
git push origin main

hr "EAS build"
VERSION=$(node -p "require('./app.json').expo.version")
if [ "$SUBMIT" -eq 1 ]; then
  echo "Verze $VERSION → build + automatické odeslání do App Store Connect."
  echo "Sleduj: https://expo.dev/accounts/tabyman9657/projects/fsl-liga/builds"
  echo ""
  eas build --platform ios --profile production --auto-submit
else
  echo "Verze $VERSION → jen build, bez odeslání."
  echo ""
  eas build --platform ios --profile production
fi

hr "Hotovo"
cat <<'NEXT'
Build je v EAS a (pokud jsi nezadal --no-submit) putuje do App Store Connect.
Zpracování buildu v ASC trvá 5–30 minut, pak přijde mail.

Než zmáčkneš "Submit for Review" v App Store Connect:
  • v Resolution Center si přečti zprávy k předchozím zamítnutím
  • demo účet pro recenzenta: hráč s licStatus = PENDING a zároveň vedoucí
    týmu s nadcházejícím domácím zápasem – jinak platební obrazovku neuvidí
  • ověř, že https://fslleague.cz/payment-success existuje a vrací zpět do appky
  • zkontroluj "Co je nového v této verzi"

Odeslat později ručně už hotový build:  bash scripts/submit-ios.sh
NEXT
