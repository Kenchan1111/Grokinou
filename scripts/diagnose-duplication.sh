#!/bin/bash
# Script de diagnostic pour la duplication visuelle

echo "=== Diagnostic de duplication visuelle ==="
echo ""
echo "Instructions:"
echo "1. Lancez 'npm start' dans un autre terminal"
echo "2. Reproduisez la duplication"
echo "3. Revenez ici et appuyez sur Entrée"
echo ""
read -p "Appuyez sur Entrée quand la duplication est visible..."

echo ""
echo "=== État du système ==="
echo "Instances running:"
ps aux | grep "node dist/index.js" | grep -v grep

echo ""
echo "=== Vérifications du code ==="
echo "1. ConversationView instances:"
grep -n "ConversationView key=" src/ui/components/ChatLayoutSwitcher.tsx

echo ""
echo "2. LayoutManager panel structure:"
grep -A 3 "ALWAYS MOUNTED" src/ui/components/layout-manager.tsx | head -20

echo ""
echo "3. Static component usage:"
grep -B 2 -A 2 "<Static" src/ui/components/ConversationView.tsx

echo ""
echo "=== Questions de diagnostic ==="
echo ""
echo "Pour m'aider à résoudre, répondez à ces questions:"
echo "A) La duplication apparaît QUAND exactement?"
echo "   1) Au démarrage"
echo "   2) Quand une exécution démarre (viewer s'affiche)"
echo "   3) Quand une exécution se termine"
echo "   4) Quand vous appuyez sur Ctrl+C (copy)"
echo "   5) Quand vous basculez le viewer avec Ctrl+E"
echo ""
echo "B) QUOI est dupliqué?"
echo "   1) Tout l'historique de conversation"
echo "   2) Seulement le dernier message"
echo "   3) Le contenu du viewer (commands, COT)"
echo "   4) Autre chose"
echo ""
echo "C) OÙ apparaît la duplication?"
echo "   1) Au-dessus du layout actuel"
echo "   2) En dessous du layout"
echo "   3) Côte à côte avec le layout"
echo "   4) Remplace le layout"
