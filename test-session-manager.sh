#!/bin/bash
# 🧪 Tests de Diagnostic pour SessionManager

echo "╔══════════════════════════════════════════════════════╗"
echo "║  🧪 TESTS DE DIAGNOSTIC - SessionManager            ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: getCurrentSession() après restart
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Test 1: Session Persistence après Restart"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "${YELLOW}Instructions:${NC}"
echo "1. Lance grokinou-cli dans un nouveau terminal"
echo "2. Envoie un message (ex: 'hello test 1')"
echo "3. Note le nombre de messages affiché dans /status"
echo "4. Quitte avec Ctrl+C"
echo "5. Relance grokinou-cli"
echo "6. Tape /status"
echo ""
echo "${YELLOW}Résultat attendu:${NC}"
echo "  ✅ Le status montre le MÊME nombre de messages"
echo "  ✅ L'historique est restauré"
echo "  ✅ Le model/provider sont corrects"
echo ""
read -p "Appuie sur Enter quand tu as testé..."
echo ""
read -p "✅ Test réussi ? (y/n): " test1
if [ "$test1" = "y" ]; then
    echo "${GREEN}✅ Test 1 PASSED${NC}"
else
    echo "${RED}❌ Test 1 FAILED - Bug identifié !${NC}"
fi
echo ""

# Test 2: Multi-provider persistence
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Test 2: Multi-Provider Persistence"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "${YELLOW}Instructions:${NC}"
echo "1. Lance grokinou-cli (démarre avec le provider par défaut)"
echo "2. Tape /status → note le provider"
echo "3. Change de model: /models gpt-4o-mini (ou autre)"
echo "4. Envoie un message avec le nouveau model"
echo "5. Tape /status → vérifie que provider = openai (ou autre)"
echo "6. Quitte (Ctrl+C)"
echo "7. Relance grokinou-cli"
echo "8. Tape /status"
echo ""
echo "${YELLOW}Résultat attendu:${NC}"
echo "  ✅ Après restart, le provider est toujours 'openai'"
echo "  ✅ Le model est toujours 'gpt-4o-mini'"
echo "  ✅ L'historique est conservé"
echo ""
read -p "Appuie sur Enter quand tu as testé..."
echo ""
read -p "✅ Test réussi ? (y/n): " test2
if [ "$test2" = "y" ]; then
    echo "${GREEN}✅ Test 2 PASSED${NC}"
else
    echo "${RED}❌ Test 2 FAILED - Bug identifié !${NC}"
fi
echo ""

# Test 3: Session Stats en temps réel
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Test 3: Stats en Temps Réel"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "${YELLOW}Instructions:${NC}"
echo "1. Lance grokinou-cli"
echo "2. Tape /status → note 'Messages: N'"
echo "3. Envoie 2 messages"
echo "4. Tape /status → vérifie 'Messages: N+4' (2 user + 2 assistant)"
echo "5. Tape /list_sessions"
echo "6. Vérifie que message_count est correct"
echo ""
echo "${YELLOW}Résultat attendu:${NC}"
echo "  ✅ Le compteur de messages s'incrémente correctement"
echo "  ✅ /list_sessions montre le bon nombre"
echo "  ✅ Les previews sont à jour"
echo ""
read -p "Appuie sur Enter quand tu as testé..."
echo ""
read -p "✅ Test réussi ? (y/n): " test3
if [ "$test3" = "y" ]; then
    echo "${GREEN}✅ Test 3 PASSED${NC}"
else
    echo "${RED}❌ Test 3 FAILED - Bug identifié !${NC}"
fi
echo ""

# Test 4: Debug log
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Test 4: Debug Logs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "${YELLOW}Vérification des logs de debug:${NC}"
if [ -f ~/.grok/debug_session.log ]; then
    echo "${GREEN}✅ Fichier de log existe${NC}"
    echo ""
    echo "Dernières lignes du log:"
    tail -20 ~/.grok/debug_session.log
else
    echo "${RED}❌ Fichier de log n'existe pas${NC}"
fi
echo ""

# Résumé
echo "╔══════════════════════════════════════════════════════╗"
echo "║  📊 RÉSUMÉ DES TESTS                                 ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
if [ "$test1" = "y" ] && [ "$test2" = "y" ] && [ "$test3" = "y" ]; then
    echo "${GREEN}✅ Tous les tests ont réussi !${NC}"
    echo "   SessionManager est robuste pour Phase 3+"
    echo ""
    echo "Prochaine étape: Implémenter /switch"
else
    echo "${YELLOW}⚠️  Certains tests ont échoué${NC}"
    echo "   Bugs à corriger avant de continuer"
    echo ""
    echo "Bugs identifiés:"
    [ "$test1" != "y" ] && echo "  - Session persistence après restart"
    [ "$test2" != "y" ] && echo "  - Multi-provider persistence"
    [ "$test3" != "y" ] && echo "  - Stats en temps réel"
fi
echo ""
