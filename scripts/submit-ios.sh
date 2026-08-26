#!/usr/bin/env bash
#
# FSL – odeslání už hotového iOS buildu do App Store Connect.
# Použij, když build v EAS existuje (spadlo odeslání, nebo jsi buildil
# s --no-submit) a nechceš stavět znovu.
#
#   bash scripts/submit-ios.sh                  # poslední production build
#   bash scripts/submit-ios.sh <BUILD_ID>       # konkrétní build z expo.dev
#   bash scripts/submit-ios.sh --path ./app.ipa # lokální .ipa
#
# Přihlašovací údaje bere eas submit z eas.json → submit.production.ios
# (appleId, ascAppId, appleTeamId). Apple si vyžádá heslo a 2FA kód.
# Bez interakce (CI) použij App Store Connect API klíč:
#   EXPO_ASC_API_KEY_PATH=./AuthKey_XXXX.p8 EXPO_ASC_KEY_ID=... EXPO_ASC_ISSUER_ID=...
#
set -euo pipefail
cd "$(dirname "$0")/.."

command -v eas >/dev/null 2>&1 || { echo "eas-cli chybí: npm i -g eas-cli"; exit 1; }
eas whoami >/dev/null 2>&1 || eas login

ARGS=(submit --platform ios --profile production)

case "${1:-}" in
  "")        ARGS+=(--latest) ;;
  --path)    [ -n "${2:-}" ] || { echo "--path bez souboru"; exit 1; }
             ARGS+=(--path "$2") ;;
  -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
  *)         ARGS+=(--id "$1") ;;
esac

echo "eas ${ARGS[*]}"
echo ""
eas "${ARGS[@]}"

cat <<'NEXT'

Odesláno. V App Store Connect se build objeví za 5–30 minut (stav "Processing").
Pak ho přiřaď k verzi a pošli na review.
NEXT
