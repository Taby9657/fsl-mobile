#!/usr/bin/env bash
# FSL – kontroly před buildem. Samostatně: bash scripts/preflight.sh
# Vrací nenulový kód, když něco neprojde. Volá se z release-ios.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

FAIL=0
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✔\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m✘\033[0m %s\n' "$1"; FAIL=1; }

step "1/5 TypeScript"
if npx tsc --noEmit; then
  ok "tsc --noEmit je čistý"
else
  bad "tsc hlásí chyby (nahoře) – oprav je před buildem"
fi

step "2/5 Pressable style jako funkce"
# NativeWind (jsxImportSource: 'nativewind') zahodí style prop zapsaný jako
# funkce ({ pressed }) => ... Komponenta pak zůstane úplně bez stylu.
# Tohle shodilo obrazovku výběru role v 1.0 – hlídáme, ať se to nevrátí.
HITS=$(grep -rnF 'style={({' app components 2>/dev/null || true)
if [ -z "$HITS" ]; then
  ok "žádný style={({ pressed }) => ...}"
else
  echo "$HITS"
  bad "style jako funkce – přepiš na onPressIn/onPressOut + pole stylů"
fi

step "3/5 Neexistující tokeny v Colors / Fonts / Radius"
if TOKENS_OUT=$(node scripts/check-tokens.js 2>&1); then
  ok "všechny Colors/Fonts/Radius tokeny existují"
else
  echo "$TOKENS_OUT"
  bad "nedefinovaný token → undefined barva, prvek se vykreslí bez pozadí"
fi

step "4/5 Velikost build archivu"
TRACKED_NM=$(git ls-files node_modules 2>/dev/null | head -1 || true)
if [ -f .easignore ]; then
  ok ".easignore existuje – node_modules se do archivu nenahrávají"
elif [ -n "$TRACKED_NM" ]; then
  warn "node_modules jsou verzované v gitu a chybí .easignore → archiv ~187 MB"
  warn "EAS si závislosti instaluje sám; přidej .easignore s řádkem node_modules/"
else
  ok "node_modules nejsou v gitu"
fi

step "5/5 Verze a git"
VERSION=$(node -p "require('./app.json').expo.version")
BRANCH=$(git rev-parse --abbrev-ref HEAD)
ok "app.json verze: $VERSION   (build number řeší EAS – appVersionSource: remote)"
[ "$BRANCH" = "main" ] && ok "větev main" || bad "jsi na větvi '$BRANCH', ne na main"
if git diff --quiet && git diff --cached --quiet; then
  ok "pracovní strom je čistý"
else
  git status --short
  bad "necommitnuté změny – build by je nevzal"
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  printf '\033[32mPreflight OK\033[0m\n'
else
  printf '\033[31mPreflight NEPROŠEL\033[0m\n'
fi
exit "$FAIL"
