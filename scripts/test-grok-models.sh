#!/bin/bash
# Script de test des modèles Grok disponibles
# Teste chaque modèle avec une requête simple pour vérifier s'il fonctionne

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Vérifier la clé API
if [ -z "$XAI_API_KEY" ]; then
    echo -e "${RED}❌ XAI_API_KEY non définie${NC}"
    echo "Définissez-la avec: export XAI_API_KEY=your-key"
    exit 1
fi

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test des Modèles Grok Disponibles${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "API Key: ${GREEN}${XAI_API_KEY:0:10}...${XAI_API_KEY: -4}${NC}"
echo ""

# Liste des modèles à tester (selon la doc X.AI)
MODELS=(
    "grok-4-latest"
    "grok-code-fast-1"
    "grok-3-latest"
    "grok-3-fast"
    "grok-3-mini-fast"
    "grok2-vision-beta"
    "grok-2-latest"
    "grok-2-1212"
    "grok-vision-beta"
    "grok-beta"
)

# Compteurs
VALID=0
INVALID=0
TOTAL=${#MODELS[@]}

# Créer le dossier de logs
mkdir -p logs

# Fichier de résultats
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="logs/grok_models_test_${TIMESTAMP}.txt"
JSON_FILE="logs/grok_models_test_${TIMESTAMP}.json"

echo "{" > "$JSON_FILE"
echo "  \"timestamp\": \"$(date -Iseconds)\"," >> "$JSON_FILE"
echo "  \"results\": [" >> "$JSON_FILE"

# Fonction de test
test_model() {
    local model=$1
    local index=$2

    echo -e "${BLUE}[$index/$TOTAL]${NC} Testing ${YELLOW}$model${NC}..."

    # Requête API avec timeout
    response=$(curl -s -w "\n%{http_code}" --max-time 30 \
        https://api.x.ai/v1/chat/completions \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $XAI_API_KEY" \
        -d "{
            \"messages\": [{\"role\": \"user\", \"content\": \"Say OK\"}],
            \"model\": \"$model\",
            \"max_tokens\": 10,
            \"temperature\": 0.0
        }" 2>&1)

    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')

    # Analyser la réponse
    if [ "$http_code" = "200" ]; then
        # Vérifier si la réponse contient une erreur
        if echo "$body" | grep -q '"error"'; then
            error_msg=$(echo "$body" | jq -r '.error.message // .error' 2>/dev/null || echo "Unknown error")
            echo -e "  ${RED}❌ ERREUR:${NC} $error_msg"
            echo "[$index/$TOTAL] ❌ $model - ERROR: $error_msg" >> "$RESULTS_FILE"

            # JSON
            [ $INVALID -gt 0 ] && echo "," >> "$JSON_FILE"
            echo "    {\"model\": \"$model\", \"valid\": false, \"error\": \"$error_msg\"}" >> "$JSON_FILE"

            INVALID=$((INVALID + 1))
        else
            # Succès - extraire le modèle retourné
            returned_model=$(echo "$body" | jq -r '.model // "unknown"' 2>/dev/null || echo "unknown")
            content=$(echo "$body" | jq -r '.choices[0].message.content // ""' 2>/dev/null | head -c 50)

            echo -e "  ${GREEN}✅ VALIDE${NC}"
            if [ "$returned_model" != "$model" ] && [ "$returned_model" != "unknown" ]; then
                echo -e "  ${BLUE}→ API returned:${NC} $returned_model"
            fi
            echo "[$index/$TOTAL] ✅ $model - VALID (returned: $returned_model)" >> "$RESULTS_FILE"

            # JSON
            [ $VALID -gt 0 ] && echo "," >> "$JSON_FILE"
            echo "    {\"model\": \"$model\", \"valid\": true, \"returned_model\": \"$returned_model\", \"response_preview\": \"$content\"}" >> "$JSON_FILE"

            VALID=$((VALID + 1))
        fi
    elif [ "$http_code" = "404" ]; then
        echo -e "  ${RED}❌ NOT FOUND (404)${NC}"
        echo "[$index/$TOTAL] ❌ $model - NOT FOUND (404)" >> "$RESULTS_FILE"

        # JSON
        [ $INVALID -gt 0 ] && echo "," >> "$JSON_FILE"
        echo "    {\"model\": \"$model\", \"valid\": false, \"error\": \"404 Not Found\"}" >> "$JSON_FILE"

        INVALID=$((INVALID + 1))
    elif [ "$http_code" = "400" ]; then
        error_msg=$(echo "$body" | jq -r '.error.message // .error // "Bad Request"' 2>/dev/null || echo "Bad Request")
        echo -e "  ${RED}❌ BAD REQUEST:${NC} $error_msg"
        echo "[$index/$TOTAL] ❌ $model - BAD REQUEST: $error_msg" >> "$RESULTS_FILE"

        # JSON
        [ $INVALID -gt 0 ] && echo "," >> "$JSON_FILE"
        echo "    {\"model\": \"$model\", \"valid\": false, \"error\": \"400: $error_msg\"}" >> "$JSON_FILE"

        INVALID=$((INVALID + 1))
    else
        echo -e "  ${RED}❌ HTTP $http_code${NC}"
        echo "[$index/$TOTAL] ❌ $model - HTTP $http_code" >> "$RESULTS_FILE"

        # JSON
        [ $INVALID -gt 0 ] && echo "," >> "$JSON_FILE"
        echo "    {\"model\": \"$model\", \"valid\": false, \"error\": \"HTTP $http_code\"}" >> "$JSON_FILE"

        INVALID=$((INVALID + 1))
    fi

    echo ""
    sleep 0.5  # Rate limiting
}

# Tester chaque modèle
index=1
for model in "${MODELS[@]}"; do
    test_model "$model" "$index"
    index=$((index + 1))
done

# Finaliser le JSON
echo "  ]," >> "$JSON_FILE"
echo "  \"summary\": {" >> "$JSON_FILE"
echo "    \"total\": $TOTAL," >> "$JSON_FILE"
echo "    \"valid\": $VALID," >> "$JSON_FILE"
echo "    \"invalid\": $INVALID" >> "$JSON_FILE"
echo "  }" >> "$JSON_FILE"
echo "}" >> "$JSON_FILE"

# Résumé
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}RÉSUMÉ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Total testé:     ${BLUE}$TOTAL${NC}"
echo -e "✅ Valides:      ${GREEN}$VALID${NC}"
echo -e "❌ Invalides:    ${RED}$INVALID${NC}"
echo ""

# Lister les modèles valides
echo -e "${GREEN}✅ MODÈLES GROK VALIDES:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
grep "✅" "$RESULTS_FILE" | sed 's/.*✅ /  • /' | sed 's/ - VALID.*//'
echo ""

echo -e "${BLUE}📁 Résultats sauvegardés:${NC}"
echo "   Text: $RESULTS_FILE"
echo "   JSON: $JSON_FILE"
echo ""

# Code de sortie
if [ $VALID -eq 0 ]; then
    echo -e "${RED}⚠️  Aucun modèle valide trouvé!${NC}"
    exit 1
else
    echo -e "${GREEN}✅ $VALID modèle(s) valide(s) trouvé(s)${NC}"
    exit 0
fi
