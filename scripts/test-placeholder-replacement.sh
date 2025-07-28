#!/bin/bash

# 🧪 Test rapide du remplacement des placeholders ACR

echo "🧪 Test du remplacement des placeholders ACR..."

# Variables de test
TEST_ACR="ibisxprodacr6630"
TEST_FILE="/tmp/test-placeholder.yaml"

# Créer un fichier de test avec placeholders
cat > "$TEST_FILE" << EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: test-job
spec:
  template:
    spec:
      containers:
      - name: test
        image: PLACEHOLDER_ACR.azurecr.io/test-app:latest
        env:
        - name: REGISTRY
          value: "PLACEHOLDER_ACR.azurecr.io"
EOF

echo "📄 Contenu AVANT remplacement :"
cat "$TEST_FILE"
echo ""

# Test du remplacement
echo "🔧 Remplacement PLACEHOLDER_ACR → $TEST_ACR..."
sed -i "s|PLACEHOLDER_ACR|$TEST_ACR|g" "$TEST_FILE"

echo "📄 Contenu APRÈS remplacement :"
cat "$TEST_FILE"
echo ""

# Vérification
if grep -q "$TEST_ACR" "$TEST_FILE"; then
    echo "✅ TEST RÉUSSI - Le remplacement fonctionne !"
    if ! grep -q "PLACEHOLDER_ACR" "$TEST_FILE"; then
        echo "✅ PARFAIT - Aucun placeholder restant !"
    else
        echo "⚠️ ATTENTION - Il reste des placeholders !"
    fi
else
    echo "❌ TEST ÉCHOUÉ - Le remplacement ne fonctionne pas !"
fi

# Nettoyage
rm -f "$TEST_FILE"
echo "🧹 Test terminé" 