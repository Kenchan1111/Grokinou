# Limites de Tokens par Modèle

## Contexte Max (Input) vs Output Max

| Modèle | Contexte Max | Output Max Recommandé | Output Actuel | Status |
|--------|--------------|----------------------|---------------|--------|
| **GPT-5** | 128K | **16K** | 1536 | ❌ 10x trop bas |
| **GPT-4 Turbo** | 128K | 4K-8K | 1536 | ❌ 3x trop bas |
| **Claude Sonnet 4** | 200K | 8K | 1536 | ❌ 5x trop bas |
| **Claude Opus** | 200K | 4K | 1536 | ❌ 3x trop bas |
| **Grok Beta** | 128K | 4K | 1536 | ❌ 3x trop bas |
| **Grok Code Fast** | 32K | 2K | 1536 | ⚠️ OK mais limite |
| **o1 / o3** | 128K | **32K** | 1536 | ❌ 20x trop bas |
| **DeepSeek** | 64K | 4K | 1536 | ❌ 3x trop bas |
| **Mistral Large** | 128K | 4K | 1536 | ❌ 3x trop bas |

## Coût vs Utilité

### Pourquoi 1536 Est Stupide

**Argument "Économie" :**
```
GPT-5 Input: $2.50 / 1M tokens
GPT-5 Output: $10.00 / 1M tokens

Avec 1536 tokens output: $0.01536 par requête
Avec 8192 tokens output: $0.08192 par requête

Différence: $0.06656 (~7 centimes)
```

**Problème :**
- Vous payez **0** si la réponse est vide !
- Économiser 7 centimes pour avoir **ZÉRO réponse** = idiot
- GPT-5 sans réponse = **argent jeté par les fenêtres**

### Le Vrai Calcul

```
Requête avec contexte lourd (question complexe + tools) :
- Input tokens: ~2000 tokens × $2.50/1M = $0.005
- Output tokens: 0 (car bloqué) × $10/1M = $0.00
TOTAL: $0.005 pour RIEN

Requête avec max_completion_tokens: 8192 :
- Input tokens: ~2000 × $2.50/1M = $0.005
- Output tokens: ~3000 (réponse complète) × $10/1M = $0.03
TOTAL: $0.035 pour une RÉPONSE UTILE

Conclusion: 7× plus cher, mais au moins ça MARCHE !
```

## Limites Recommandées

### Par Type de Modèle

```typescript
// Reasoning models (o1, o3, gpt-5)
max_completion_tokens: 16384  // Besoin de place pour "penser"

// High-end models (Claude Opus, GPT-4 Turbo)
max_tokens: 8192  // Réponses détaillées

// Standard models (Claude Sonnet, Grok Beta)
max_tokens: 4096  // Réponses normales

// Fast models (Grok Code Fast, DeepSeek)
max_tokens: 2048  // Réponses rapides
```

### Configuration Adaptative

```typescript
getDefaultMaxTokens(model: string): number {
  const m = model.toLowerCase();

  // Reasoning models
  if (m.includes('o1') || m.includes('o3') || m.includes('gpt-5')) {
    return 16384;
  }

  // High-end models
  if (m.includes('opus') || m.includes('gpt-4')) {
    return 8192;
  }

  // Claude Sonnet
  if (m.includes('sonnet')) {
    return 8192;
  }

  // Grok
  if (m.includes('grok')) {
    return m.includes('code-fast') ? 2048 : 4096;
  }

  // DeepSeek, Mistral
  if (m.includes('deepseek') || m.includes('mistral')) {
    return 4096;
  }

  // Default
  return 4096;
}
```

## Pourquoi L'Ancienne Valeur (4000) Était Meilleure

```typescript
// AVANT (Sept 2025) - BIEN
max_tokens: 4000
✅ Suffisant pour la plupart des cas
✅ Adaptée aux modèles de l'époque

// APRÈS (Commit 7a7f197) - MAL
defaultMaxTokens: 1536
❌ Trop bas pour tous les modèles modernes
❌ Cause des échecs silencieux (finish_reason: length)
❌ Économie ridicule (~5 centimes) vs perte d'utilité (100%)
```

## Conclusion

**La limite de 1536 tokens est une erreur de conception** qui :
1. Empêche GPT-5 et reasoning models de fonctionner
2. Limite inutilement tous les autres modèles
3. N'économise presque rien en coûts
4. Cause des bugs mystérieux (réponses vides)

**Solution actuelle (8192 pour reasoning models) :**
- ✅ GPT-5 peut enfin répondre
- ✅ Encore économique (< 10 centimes par requête)
- ✅ Permet des réponses complètes

**Solution idéale (16384 pour reasoning models) :**
- ✅ Aucune limite pratique
- ✅ ~15 centimes par requête (acceptable)
- ✅ Utilisation optimale du modèle
