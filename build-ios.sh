#!/bin/bash
# FSL – iOS Ad Hoc build (preview profil)
# Spusť: bash build-ios.sh

set -e
cd "$(dirname "$0")"

echo ""
echo "📱 FSL iOS BUILD"
echo "════════════════════════════════"

# Zkontroluj, zda jsou nějaké uncommitted změny
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "⚠️  Máš necommittované změny:"
  git status --short
  echo ""
  read -p "Commitnout je teď? (ano/ne): " ANSWER
  if [ "$ANSWER" = "ano" ]; then
    read -p "Commit message: " MSG
    git add -A
    git commit -m "${MSG:-build: update before iOS build}"
  fi
fi

# Push
echo ""
echo "📤 Pushuju na GitHub..."
git push origin main

# EAS build
echo ""
echo "🔨 Spouštím EAS build (iOS preview)..."
echo "   Sleduj průběh na: https://expo.dev/accounts/tabyman9657/projects/fsl-liga/builds"
echo ""
eas build --platform ios --profile preview
