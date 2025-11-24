#!/bin/bash

echo "🧪 Test: System Message Purge & Switch"
echo "======================================"
echo ""
echo "Objectif: Vérifier que seul le NOUVEAU system message est conservé"
echo ""

# Clear debug log
> ~/.grok/debug.log

echo "📋 Instructions:"
echo "1. Lance: grokinou-cli"
echo "2. Observe le premier system message (modèle initial)"
echo "3. Fais: /model deepseek-chat"
echo "4. Fais: /apikey deepseek <ta-key>"
echo "5. Fais: /model mistral-large-latest"
echo "6. Fais: /apikey mistral <ta-key>"
echo "7. Ferme l'app (Ctrl+C)"
echo ""
echo "📊 Analyse des logs:"
echo ""

tail -f ~/.grok/debug.log | grep -E "(BEFORE purge|AFTER purge|System message added|switchToModel)" &
TAIL_PID=$!

echo "Logs en temps réel (Ctrl+C pour arrêter)..."
echo ""

# Wait for Ctrl+C
trap "kill $TAIL_PID 2>/dev/null; exit" INT TERM

wait
