# Solution 2 : Limite Généreuse par Modèle

## Concept

Donner à chaque modèle une limite proche de sa capacité maximale réelle.

## Limites Réelles des Modèles (2025)

| Modèle | Contexte Total | Output Max Réel | Actuel (16K) | Optimal Recommandé |
|--------|----------------|-----------------|--------------|-------------------|
| **GPT-5** | 128K | **64K** | 16K | **32K** |
| **o1-preview** | 128K | 32K | 16K | **32K** |
| **o3** | 200K | 100K | 16K | **64K** |
| **GPT-4 Turbo** | 128K | 4K | 8K | **8K** ✅ |
| **Claude Opus** | 200K | 4K | 8K | **8K** ✅ |
| **Claude Sonnet 4** | 200K | 8K | 8K | **8K** ✅ |
| **Grok Beta** | 128K | 32K | 4K | **16K** |
| **DeepSeek V3** | 64K | 8K | 4K | **8K** |
| **Mistral Large** | 128K | 8K | 4K | **8K** |

## Pourquoi Proche de la Fenêtre de Contexte ?

### Contexte Total = Input + Output

```
GPT-5 : 128K tokens total
├─ Input (contexte) : Variable (2K-100K)
└─ Output (réponse) : Max 64K

Exemple avec question complexe :
├─ System message : 2K tokens
├─ Historique : 5K tokens
├─ Tools results : 10K tokens
├─ User question : 0.5K tokens
└─ TOTAL INPUT : 17.5K tokens

Budget restant pour output : 128K - 17.5K = 110.5K tokens
→ On peut mettre max_completion_tokens = 64K sans risque
```

### Limites API Réelles (OpenAI)

D'après la documentation OpenAI :

```
gpt-5-turbo:
  max_tokens: deprecated (ancien système)
  max_completion_tokens: 64000 (maximum réel)

o1-preview:
  max_completion_tokens: 32768

o3:
  max_completion_tokens: 100000
```

## Configuration Optimale

### Code Actuel (16K)

```typescript
// Reasoning models (o1, o3, gpt-5)
if (m.startsWith('o1') || m.startsWith('o3') || m.includes('gpt-5')) {
  return 16384;  // ⚠️ Conservateur
}
```

### Configuration Recommandée (32K-64K)

```typescript
private getModelDefaultMaxTokens(model?: string): number {
  const m = (model || this.currentModel).toLowerCase();

  // o3: Highest capacity
  if (m.startsWith('o3')) {
    return 65536;  // 64K tokens
  }

  // GPT-5: Very high capacity
  if (m.includes('gpt-5')) {
    return 32768;  // 32K tokens (safe default)
  }

  // o1: High capacity
  if (m.startsWith('o1')) {
    return 32768;  // 32K tokens
  }

  // High-end models: GPT-4, Claude
  if (m.includes('gpt-4') || m.includes('opus') || m.includes('sonnet')) {
    return 8192;  // 8K tokens
  }

  // Grok: Good capacity
  if (m.includes('grok')) {
    if (m.includes('code-fast')) {
      return 4096;  // Fast variant
    }
    return 16384;  // 16K for regular Grok
  }

  // DeepSeek, Mistral: Modern models
  if (m.includes('deepseek') || m.includes('mistral')) {
    return 8192;
  }

  // Default: conservative
  return 4096;
}
```

## Avantages

✅ **Simplicité** : Aucune logique complexe
✅ **Fiabilité** : Le modèle a toujours assez de place
✅ **Performance** : Pas d'overhead (pas de tool supplémentaire)
✅ **UX** : Transparent pour l'utilisateur
✅ **Coût raisonnable** : On paie seulement ce qu'on utilise

## Inconvénients

⚠️ **Coût légèrement plus élevé** : Si le modèle génère beaucoup
⚠️ **Pas de contrôle fin** : L'utilisateur ne peut pas "budgéter"

## Analyse du Coût

### GPT-5 avec 32K max_completion_tokens

**Cas 1 : Question simple**
```
Input: 500 tokens
Output généré: 300 tokens (le modèle s'arrête naturellement)
Coût output: 300 × $10/1M = $0.003

Le fait d'avoir 32K disponible ne change rien !
On paie seulement les tokens générés.
```

**Cas 2 : Question complexe**
```
Input: 15K tokens
Output généré: 5000 tokens (réponse détaillée)
Coût output: 5000 × $10/1M = $0.05

Avec 1536 max:
  Output: 0 tokens → $0.00 (mais pas de réponse ❌)

Avec 32K max:
  Output: 5000 tokens → $0.05 (réponse complète ✅)

Différence: 5 centimes pour avoir une réponse
```

**Cas 3 : Réponse maximale**
```
Input: 10K tokens
Output généré: 32000 tokens (utilise tout le budget)
Coût output: 32000 × $10/1M = $0.32

C'est le PIRE cas, et ça coûte 32 centimes.
Pour une analyse massive de codebase, c'est raisonnable.
```

## Variable d'Environnement Override

Pour les cas où l'utilisateur veut contrôler :

```bash
# Illimité (utilise le max du modèle)
export GROK_MAX_TOKENS=unlimited

# Limite custom
export GROK_MAX_TOKENS=8192

# Économie (questions simples seulement)
export GROK_MAX_TOKENS=2048
```

## Recommandation Finale

**Pour GPT-5 et o1/o3 :**
```typescript
gpt-5 → 32768 tokens (32K)
o1 → 32768 tokens (32K)
o3 → 65536 tokens (64K)
```

**Rationale :**
- Couvre 99% des cas d'usage
- Coût marginal acceptable (< 50 centimes par requête max)
- Aucune friction UX
- Pas de complexité de code

**Situations où ça pourrait coûter cher :**
- Génération de très longs documents (> 10K tokens)
- Analyse de très grandes codebases avec réponses massives

**Solution pour économiser si nécessaire :**
- Variable d'env : `GROK_MAX_TOKENS=4096` pour usage économique
- Le modèle s'adapte et génère des réponses plus concises

## Conclusion

**La Solution 2 est largement supérieure :**
- Simple à implémenter (déjà fait)
- Fiable (toujours fonctionne)
- Coût prévisible et raisonnable
- Aucune friction utilisateur
- Pas de risque d'échec silencieux

**La Solution 1 est trop complexe pour le gain :**
- Nécessite nouveau tool + logique
- Estimation imprécise
- Friction utilisateur (doit intervenir)
- Le LLM peut oublier d'estimer
