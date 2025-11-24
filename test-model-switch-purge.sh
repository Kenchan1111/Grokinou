#!/bin/bash

# Test script to verify system message purge when switching models

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   TEST: System Message Purge on Model Switch                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Clear debug log
rm ~/.grok/debug.log 2>/dev/null
echo "✅ Debug log cleared"
echo ""

# Create test directory
TEST_DIR="/tmp/test-model-switch-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"
echo "✅ Test directory: $TEST_DIR"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 INSTRUCTIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Le CLI va démarrer avec le modèle par défaut"
echo "2. Tape: /model deepseek-chat"
echo "3. Tape: Hello (pour un message)"
echo "4. Tape: /model mistral-large-latest"
echo "5. Tape: Who are you? (pour vérifier l'identité)"
echo "6. Tape: /exit"
echo ""
echo "Ensuite, on analysera debug.log pour vérifier la purge"
echo ""
read -p "Appuie sur ENTRÉE pour lancer le CLI..."

# Start grokinou-cli
grokinou-cli

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 ANALYSE DES LOGS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1️⃣  Logs de purge :"
grep "BEFORE purge\|AFTER purge" ~/.grok/debug.log
echo ""

echo "2️⃣  Logs de mise à jour du message système :"
grep "System message updated\|System message added" ~/.grok/debug.log
echo ""

echo "3️⃣  Logs de changement de modèle :"
grep "switchToModel" ~/.grok/debug.log
echo ""

echo "4️⃣  Nombre de messages système dans CHAQUE payload :"
grep -A 2 '"role": "system"' ~/.grok/debug.log | grep '"content":' | head -10
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Résultat attendu :"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "- AVANT le switch: 'BEFORE purge: 1 system message(s)'"
echo "- APRÈS le switch: 'AFTER purge: X messages remaining (no system)'"
echo "- Nouveau système: 'System message added: model=\"mistral-large-latest\"'"
echo ""
echo "Si tu vois 2+ system messages dans un payload → BUG !"
echo ""

read -p "Appuie sur ENTRÉE pour voir le debug.log complet..."
cat ~/.grok/debug.log
