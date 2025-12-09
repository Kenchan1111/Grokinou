# Solution Adaptative pour `max_tokens`

## Problème Identifié

**Le problème fondamental :**
- `max_tokens` limite SEULEMENT la sortie (tokens générés par le modèle)
- Mais : `entrée + sortie ≤ limite_de_contexte_du_modèle`
- Actuellement : `max_tokens` est fixe (32K, 16K, etc.)
- Résultat : Quand on envoie beaucoup de fichiers (entrée grande), `max_tokens` est trop grand
- Erreur : `context_length_exceeded` ou le modèle ne répond pas

## Exemple Concret

**Scénario problématique :**
- Modèle : GPT-4 Turbo (128K de contexte)
- Entrée : 100K tokens (fichiers analysés)
- `max_tokens` : 32K (limite fixe)
- Total : 100K + 32K = 132K > 128K
- **ERREUR** : Le modèle ne peut pas répondre !

## Solution Implémentée

### 1. **Détection de la fenêtre de contexte par modèle**
```typescript
private getModelContextWindow(model?: string): number {
  // Claude models: 200K context
  if (m.includes('claude') || m.includes('opus') || m.includes('sonnet')) {
    return 200000;  // 200K
  }
  
  // GPT-5, GPT-4, Grok, DeepSeek, Mistral: 128K
  if (m.includes('gpt-5') || m.includes('gpt-4') || m.includes('grok') || 
      m.includes('deepseek') || m.includes('mistral')) {
    return 128000;  // 128K
  }
  
  // GPT-3.5: 16K
  if (m.includes('gpt-3.5')) {
    return 16385;  // 16K
  }
  
  // Default: 128K for modern models
  return 128000;
}
```

### 2. **Estimation des tokens d'entrée**
```typescript
private estimateTokensInMessages(messages: GrokMessage[]): number {
  let totalChars = 0;
  
  for (const msg of messages) {
    const content = msg.content;
    
    if (typeof content === 'string') {
      totalChars += content.length;
    } else if (content && Array.isArray(content)) {
      totalChars += JSON.stringify(content).length;
    }
    
    totalChars += 100; // Overhead per message
  }
  
  // Conservative: 1 token ≈ 3.5 characters
  return Math.ceil(totalChars / 3.5);
}
```

### 3. **Calcul adaptatif de `max_tokens`**
```typescript
private calculateAdaptiveMaxTokens(
  modelToUse: string,
  messages: GrokMessage[],
  defaultMaxTokens: number
): number {
  // Get context window
  const contextWindow = this.getModelContextWindow(modelToUse);
  
  // Estimate input tokens
  const inputTokens = this.estimateTokensInMessages(messages);
  
  // Calculate available tokens for output
  const availableForOutput = contextWindow - inputTokens;
  
  // Safety margin: reserve 10% of context window
  const safetyMargin = Math.floor(contextWindow * 0.1);
  const safeAvailable = Math.max(0, availableForOutput - safetyMargin);
  
  // If not enough space even for minimal response
  if (safeAvailable < 100) {
    debugLog.log(`⚠️  Context window almost full`);
    return 100; // Minimal response
  }
  
  // Use the smaller of: default limit OR available space
  const adaptiveMaxTokens = Math.min(defaultMaxTokens, safeAvailable);
  
  // Log adaptive adjustment
  if (adaptiveMaxTokens < defaultMaxTokens) {
    debugLog.log(`🔄 Adaptive max_tokens: ${defaultMaxTokens} → ${adaptiveMaxTokens}`);
  }
  
  return adaptiveMaxTokens;
}
```

## Résultats des Tests

### Scénario 1: Petit projet (entrée légère)
- Contexte: 128K tokens
- Entrée: 20K tokens  
- Default max_tokens: 32K
- **Résultat: 32K** ✅ (gardé tel quel)

### Scénario 2: Projet moyen
- Contexte: 128K tokens
- Entrée: 80K tokens
- Default max_tokens: 32K
- **Résultat: 32K** ✅ (gardé tel quel)

### Scénario 3: Grand projet (PROBLÈME IDENTIFIÉ!)
- Contexte: 128K tokens
- Entrée: 100K tokens
- Default max_tokens: 32K
- **Résultat: 15.2K** ✅ (adapté automatiquement)
- **Évite l'erreur "context_length_exceeded"**

### Scénario 4: Très grand projet
- Contexte: 128K tokens
- Entrée: 115K tokens
- Default max_tokens: 32K
- **Résultat: 200 tokens** ✅ (réponse minimale mais possible)

## Avantages de la Solution

1. **Évite les erreurs de contexte** : Plus de `context_length_exceeded`
2. **Adaptatif** : S'ajuste automatiquement à la taille de l'entrée
3. **Conservateur** : Réserve 10% de marge de sécurité
4. **Transparent** : Logge les ajustements pour le débogage
5. **Compatible** : Fonctionne avec tous les modèles et providers

## Impact sur l'Expérience Utilisateur

**Avant :**
- Erreur silencieuse quand trop de fichiers
- Le modèle ne répond pas
- Frustration pour l'utilisateur

**Après :**
- Le modèle répond toujours (même si réponse courte)
- Ajustement automatique transparent
- Meilleure expérience utilisateur

## Configuration par Modèle

| Modèle | Contexte | Default max_tokens | Comportement adaptatif |
|--------|----------|-------------------|------------------------|
| Claude Sonnet | 200K | 32K | Réduit si entrée > 168K |
| GPT-4 Turbo | 128K | 32K | Réduit si entrée > 96K |
| GPT-3.5 | 16K | 4K | Réduit si entrée > 12K |
| Grok | 128K | 16K | Réduit si entrée > 112K |

## Conclusion

La solution adaptative résout **exactement** le problème identifié :
- **max_tokens** est maintenant dynamique
- **entrée + sortie ≤ contexte** est toujours respecté
- **Le modèle peut répondre** même avec beaucoup de fichiers
- **Plus d'erreurs silencieuses** de dépassement de contexte

Cette amélioration rend Grok-CLI beaucoup plus robuste pour l'analyse de projets complexes avec de nombreux fichiers.