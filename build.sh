#!/bin/bash
# FSL Mobile – EAS Build (iOS only)
# Použití: ./build.sh [preview|production]

PROFILE=${1:-preview}

echo "🏒 FSL iOS Build – profil: $PROFILE"
echo ""

cd "$(dirname "$0")"

# Ověř přihlášení k Expo
if ! eas whoami &>/dev/null; then
  echo "⚠️  Nejsi přihlášen. Spouštím eas login..."
  eas login
fi

# iOS build (interaktivní – nutné pro správu certifikátů)
eas build \
  --platform ios \
  --profile "$PROFILE"

echo ""
echo "✅ Build odeslán. Sleduj průběh na https://expo.dev"
