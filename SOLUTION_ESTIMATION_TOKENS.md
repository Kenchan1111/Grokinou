# Solution 1 : Estimation Intelligente des Tokens Nécessaires

## Concept

Le LLM estime le nombre de tokens nécessaires pour sa réponse AVANT d'exécuter les outils, et demande plus de budget si insuffisant.

## Flux Proposé

```
1. User pose question complexe
2. LLM analyse la question
3. LLM liste les fichiers qu'il va consulter
4. LLM estime les tokens nécessaires :
   - wc -l fichier1.ts → 500 lignes × 1.3 tokens/ligne = 650 tokens
   - wc -l fichier2.ts → 800 lignes × 1.3 tokens/ligne = 1040 tokens
   - Réponse estimée : 2000 tokens
   - TOTAL : 650 + 1040 + 2000 = 3690 tokens
5. LLM compare avec budget (1536 tokens)
6. Si insuffisant → "⚠️ Budget insuffisant. J'ai besoin de ~3700 tokens, vous n'en avez que 1536. Augmentez avec GROK_MAX_TOKENS=4000"
7. Si suffisant → Procède normalement
```

## Implémentation Requise

### 1. Nouveau Tool : `estimate_token_budget`

```typescript
{
  name: "estimate_token_budget",
  description: "Estimate if current token budget is sufficient for planned operations",
  parameters: {
    planned_operations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { enum: ["view_file", "search", "bash", "response"] },
          details: { type: "string" },
          estimated_tokens: { type: "number" }
        }
      }
    }
  }
}
```

### 2. Modification du System Prompt

```markdown
BEFORE using tools for complex questions:
1. Use estimate_token_budget to check if you have enough room
2. List all files you plan to read
3. Estimate tokens needed for your response
4. If insufficient, STOP and ask user to increase budget
5. Only proceed if budget is sufficient
```

### 3. Logique d'Estimation

```typescript
async estimateTokenBudget(operations: Operation[]): Promise<{
  sufficient: boolean;
  needed: number;
  available: number;
  message?: string;
}> {
  let totalNeeded = 0;

  for (const op of operations) {
    if (op.type === 'view_file') {
      // Estimate file size
      const lines = await getFileLineCount(op.details);
      totalNeeded += lines * 1.3; // ~1.3 tokens per line
    } else if (op.type === 'response') {
      totalNeeded += op.estimated_tokens;
    }
  }

  const available = this.defaultMaxTokens;

  if (totalNeeded > available) {
    return {
      sufficient: false,
      needed: totalNeeded,
      available,
      message: `⚠️ Insufficient token budget. Need ~${totalNeeded}, have ${available}. Set GROK_MAX_TOKENS=${Math.ceil(totalNeeded * 1.2)}`
    };
  }

  return { sufficient: true, needed: totalNeeded, available };
}
```

## Avantages

✅ Le LLM peut prévenir l'utilisateur AVANT d'échouer
✅ Estimation transparente des besoins
✅ Utilisateur peut ajuster dynamiquement
✅ Évite les échecs silencieux

## Inconvénients

❌ Complexité : Nouveau tool + logique d'estimation
❌ Imprécision : Estimation peut être fausse
❌ Overhead : Tool call supplémentaire avant chaque opération
❌ UX : L'utilisateur doit intervenir manuellement
❌ Le LLM doit "penser à estimer" (pas garanti)

## Exemple d'Utilisation

```
User: "Analyse le code du viewer et explique comment l'améliorer"

GPT-5: [Appelle estimate_token_budget]
  - view_file: src/ui/components/execution-viewer.tsx (300 lignes) → 400 tokens
  - view_file: src/execution/execution-manager.ts (350 lignes) → 450 tokens
  - search: "ExecutionStream" → 200 tokens
  - response: Analyse détaillée → 2500 tokens
  TOTAL: 3550 tokens

GPT-5: [Compare avec budget: 1536 tokens]

GPT-5: ⚠️ Je ne peux pas répondre complètement avec le budget actuel.

J'ai besoin d'environ 3550 tokens pour :
- Lire 2 fichiers (~850 tokens)
- Faire 1 recherche (~200 tokens)
- Générer une analyse détaillée (~2500 tokens)

Votre budget actuel : 1536 tokens

Pour obtenir une réponse complète, augmentez la limite :
  export GROK_MAX_TOKENS=4000

Ou posez une question plus précise qui nécessite moins d'analyse.
```

## Conclusion

**Cette solution est élégante MAIS :**
- Trop complexe pour le gain
- Nécessite que le LLM soit "discipliné" (pas garanti)
- Estimation peut être imprécise (facteur 2× possible)
- L'utilisateur doit intervenir à chaque fois

**Meilleure approche :** Solution 2 (limite généreuse)
