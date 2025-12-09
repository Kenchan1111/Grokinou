# Mise à jour des Limites de Tokens par Défaut

## Contexte
Les limites de tokens par défaut dans Grok CLI ont été augmentées pour mieux correspondre aux capacités réelles des modèles modernes. Cette mise à jour améliore la qualité des réponses sans nécessiter de configuration manuelle.

## Nouvelles Limites par Défaut

### Modèles de Raisonnement (Illimités)
- **o1**, **o3**, **GPT-5** : 0 (illimité) - L'API utilise son maximum naturel (64K+)
  - **Note importante** : GPT-5 est un modèle de raisonnement, il utilise `max_completion_tokens`

### Modèles Haute Capacité (Très Longues Réponses)
- **GPT-4**, **Claude Opus** : 32768 tokens (32K) - Pour analyses complexes
- **Claude Sonnet** : 32768 tokens (32K) - 200K de contexte mérite de longues réponses

### Modèles pour Analyse de Code
- **Tous les modèles Grok** : 16384 tokens (16K) - Optimisé pour l'analyse de code

### Autres Modèles Modernes
- **DeepSeek**, **Mistral** : 16384 tokens (16K) - Modèles modernes avec bonne capacité
- **Par défaut** : 16384 tokens (16K) - Minimum pour projets complexes

## Comparaison avec l'Ancien Système

| Modèle | Ancienne Limite | Nouvelle Limite | Amélioration |
|--------|----------------|----------------|--------------|
| GPT-5 | 16384 (16K) | 0 (illimité) | Modèle de raisonnement |
| GPT-4/Claude | 8192 (8K) | 32768 (32K) | 4x plus |
| Grok Fast | 4096 (4K) | 16384 (16K) | 4x plus |
| Par défaut | 4096 (4K) | 16384 (16K) | 4x plus |

## Comment Personnaliser

### Variable d'Environnement
```bash
# Illimité (utilise le maximum de l'API)
export GROK_MAX_TOKENS=unlimited

# Limite spécifique
export GROK_MAX_TOKENS=4096  # 4K tokens
export GROK_MAX_TOKENS=8192  # 8K tokens
export GROK_MAX_TOKENS=16384 # 16K tokens
```

### Valeurs Spéciales
- `unlimited` ou `-1` : 0 (illimité)
- Nombre positif : limite spécifique
- Non défini : utilise les limites par défaut ci-dessus

## Impact sur les Performances

### Avantages
1. **Réponses plus complètes** : Les modèles peuvent produire des réponses plus détaillées
2. **Meilleure qualité** : Pas de troncature prématurée des réponses
3. **Adaptation automatique** : Chaque modèle obtient une limite appropriée

### Considérations
1. **Coût** : Des réponses plus longues peuvent coûter plus cher
2. **Latence** : Les réponses peuvent prendre légèrement plus de temps
3. **Compatibilité** : Tous les modèles supportent ces limites

## Vérification

Pour vérifier la limite actuelle :
```bash
# Démarrez grokinou avec un modèle spécifique
grokinou --model gpt-5

# Le log affichera :
# ✅ GrokClient initialized: model=gpt-5, baseURL=..., max_tokens=16384 tokens
```

## Recommandations

1. **Pour l'usage quotidien** : Gardez les limites par défaut (optimisées)
2. **Pour les tâches complexes** : Utilisez `GROK_MAX_TOKENS=unlimited`
3. **Pour économiser** : Utilisez `GROK_MAX_TOKENS=4096` pour les modèles rapides

Cette mise à jour améliore significativement l'expérience utilisateur sans configuration supplémentaire.