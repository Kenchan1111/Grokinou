#!/bin/bash
# Test de diagnostic pour le paste

echo "=== Test Paste Diagnostic ==="
echo ""
echo "1. Vérification du build..."
ls -lh dist/hooks/use-input-handler.js | awk '{print "   Build:", $6, $7, $8}'
echo ""

echo "2. Vérification du code compilé..."
if grep -Eq "inputChar\\s*&&\\s*inputChar\\.length\\s*>\\s*50" dist/hooks/use-input-handler.js \
   || grep -q "\\[PASTE\\] Large chunk" dist/hooks/use-input-handler.js; then
    echo "   ✅ Fallback paste detection (>50 chars) présent"
else
    echo "   ❌ Fallback paste detection MANQUANT (probable motif grep obsolète)"
fi

# Vérifier la détection basée sur le timing (<10ms)
if grep -q "Rapid inputs (< 10ms apart)" dist/hooks/use-input-handler.js; then
    echo "   ✅ Détection timing-based présente"
else
    echo "   ⚠️  Détection timing-based non trouvée dans les commentaires (le code peut tout de même être présent)"
fi

if grep -q "pendingPastes.*attachedImages" dist/ui/components/chat-input.js; then
    echo "   ✅ Dependencies useMemo présentes"
else
    echo "   ❌ Dependencies useMemo MANQUANTES"
fi
echo ""

echo "3. Test direct du paste manager..."
node -e "
import('./dist/utils/paste-manager.js').then(m => {
  const content = 'Test paste de plus de 100 caractères pour vérifier que le placeholder est bien créé automatiquement par le système';
  const result = m.pasteManager.processPaste(content);
  console.log('   Content length:', content.length);
  console.log('   Result:', result.textToInsert);
  console.log('   ✅ Paste manager fonctionne:', result.textToInsert.includes('[Pasted'));
});
"
echo ""

echo "4. Logs récents..."
if [ -f ~/.grok/debug.log ]; then
    echo "   Derniers logs paste:"
    grep -i paste ~/.grok/debug.log | tail -3
else
    echo "   ⚠️  Pas de debug.log trouvé"
fi
echo ""

echo "=== FIN DU TEST ==="
