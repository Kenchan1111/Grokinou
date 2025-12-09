# 🎯 Plan de Résolution Révisé - Identity Bugs

## 🔑 Principe Fondamental (Clarification Utilisateur)

> **L'identity check renvoyé par le serveur est INDISPENSABLE**
> - Source de vérité : API metadata (pas ce que le LLM pense)
> - Ancre pour l'utilisateur : certitude absolue du LLM actif
> - Crucial pour futur système multi-LLM conversationnel
> - Le LLM peut être confus par l'historique, mais le user SAIT avec qui il parle

---

## 🐛 Bug #1 : Identity Check qui Échoue

### ❌ Ancienne Approche (Incorrecte)
- Désactiver identity check pour certains providers
- Le rendre optionnel

### ✅ Nouvelle Approche (Correcte)
- **GARDER l'identity check pour TOUS les providers**
- **FIXER les erreurs pour qu'il fonctionne toujours**
- **Rendre le résultat visible et fiable**

---

## 🎯 Plan de Résolution Révisé

### Phase 1 : Fixer Identity Check pour Claude (CRITIQUE)

#### Problème Actuel
```
⚠️  Identity check skipped (Grok API error: 404 model: claude-sonnet-4-5-20250514)
```

**Cause** : Le nom du modèle n'est pas reconnu par l'API Anthropic.

---

#### Solution 1.1 : Mapper les Noms de Modèles par Provider

**Objectif** : Utiliser les noms officiels de chaque API.

**Implémentation** :

```typescript
/**
 * Get the official API model name for a provider
 * CRITICAL: This is used for identity verification
 */
private getOfficialModelName(model: string, provider: string): string {
  // Normalize model name to lowercase for comparison
  const m = model.toLowerCase();

  switch (provider) {
    case 'claude':
      // Claude/Anthropic official model names
      if (m.includes('sonnet') && (m.includes('4-5') || m.includes('4.5'))) {
        return 'claude-3-5-sonnet-20241022'; // Latest Sonnet 3.5
      }
      if (m.includes('sonnet') && m.includes('4')) {
        return 'claude-3-5-sonnet-20241022'; // Sonnet 4 → 3.5
      }
      if (m.includes('opus')) {
        return 'claude-3-opus-20240229';
      }
      if (m.includes('sonnet')) {
        return 'claude-3-sonnet-20240229';
      }
      if (m.includes('haiku')) {
        return 'claude-3-haiku-20240307';
      }
      // If already in correct format, return as-is
      if (m.startsWith('claude-3-')) {
        return model;
      }
      // Default to Sonnet 3.5 if unclear
      return 'claude-3-5-sonnet-20241022';

    case 'openai':
      // OpenAI models are usually correct as-is
      // But normalize some common variations
      if (m === 'gpt-5' || m === 'gpt5') {
        return 'gpt-5-preview'; // or whatever the official name is
      }
      if (m === 'gpt-4' || m === 'gpt4') {
        return 'gpt-4-turbo-preview';
      }
      if (m.includes('o1-preview')) {
        return 'o1-preview';
      }
      if (m.includes('o3-mini')) {
        return 'o3-mini';
      }
      return model; // OpenAI names are usually correct

    case 'deepseek':
      // DeepSeek official names
      if (m.includes('chat')) {
        return 'deepseek-chat';
      }
      if (m.includes('coder')) {
        return 'deepseek-coder';
      }
      return model;

    case 'mistral':
      // Mistral official names
      if (m.includes('large')) {
        return 'mistral-large-latest';
      }
      if (m.includes('medium')) {
        return 'mistral-medium-latest';
      }
      return model;

    case 'grok':
      // Grok official names
      if (m.includes('beta')) {
        return 'grok-beta';
      }
      if (m.includes('vision')) {
        return 'grok-vision-beta';
      }
      return model;

    default:
      return model;
  }
}
```

**Utilisation dans `switchToModel()`** :
```typescript
async switchToModel(model: string, apiKey: string, baseURL: string): Promise<string> {
  // ...existing code...

  // Get official model name for this provider
  const provider = providerManager.detectProvider(model) || 'grok';
  const officialModel = this.getOfficialModelName(model, provider);

  debugLog.log(`🔍 Original model: ${model}`);
  debugLog.log(`📝 Official API model: ${officialModel}`);

  // Use official model name for identity check
  const identityPromise = this.grokClient.chat(
    [{ role: "user", content: "In one short sentence, what is your exact model name and provider?" }],
    [], // No tools
    officialModel, // ✅ Use official name
    undefined  // No search
  );

  // ...rest of identity check...
}
```

**Fichiers** :
- `src/agent/grok-agent.ts` : Ajouter méthode `getOfficialModelName()`
- `src/agent/grok-agent.ts:1879` : Utiliser nom officiel dans identity check

---

#### Solution 1.2 : Améliorer le Fallback

**Objectif** : Si identity check échoue, essayer avec le nom de modèle original.

**Implémentation** :

```typescript
// ✅ Identity check with fallback
try {
  debugLog.log(`🔍 Sending identity check to model...`);

  const provider = providerManager.detectProvider(model) || 'grok';
  const officialModel = this.getOfficialModelName(model, provider);

  // Try with official model name first
  let identityResponse: any;
  try {
    identityResponse = await Promise.race([
      this.grokClient.chat(
        [{ role: "user", content: "In one short sentence, what is your exact model name and provider?" }],
        [],
        officialModel, // ✅ Official name
        undefined
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Identity check timeout after 10s')), 10000)
      )
    ]);
  } catch (firstError: any) {
    // If official name fails, try with original model name
    if (officialModel !== model) {
      debugLog.log(`⚠️  Official model name failed, trying original: ${model}`);
      identityResponse = await Promise.race([
        this.grokClient.chat(
          [{ role: "user", content: "In one short sentence, what is your exact model name and provider?" }],
          [],
          model, // ✅ Original name as fallback
          undefined
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Identity check timeout after 10s')), 10000)
        )
      ]);
    } else {
      throw firstError;
    }
  }

  const aiSays = identityResponse.choices[0]?.message?.content || "No response";
  const apiReturned = identityResponse.model || model;

  debugLog.log(`✅ AI says: "${aiSays}"`);
  debugLog.log(`📝 API returned: ${apiReturned}`);

  // ✅ Return API metadata as source of truth
  return `✅ Connected to: ${apiReturned}\n🤖 AI confirms: "${aiSays}"`;

} catch (error: any) {
  // ❌ Identity check failed - this is a REAL problem
  debugLog.error(`❌ Identity check FAILED: ${error.message}`);
  debugLog.error(`   Model: ${model}`);
  debugLog.error(`   Provider: ${provider}`);
  debugLog.error(`   BaseURL: ${baseURL}`);

  // Return error but allow connection (user decision to continue)
  return `⚠️  Identity verification failed: ${error.message}\nConnection established but model identity uncertain.`;
}
```

**Fichiers** : `src/agent/grok-agent.ts:1874-1904`

---

#### Solution 1.3 : Afficher l'Identity Check de Manière Claire

**Objectif** : Montrer l'identity check à l'utilisateur de façon visible.

**Format de sortie** :
```
✅ Model Switch Successful
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 API Metadata: claude-3-5-sonnet-20241022
🤖 Model confirms: "I am Claude 3.5 Sonnet by Anthropic"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**En cas d'erreur** :
```
⚠️  Identity Verification Failed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Error: 404 model not found
📝 Attempted: claude-sonnet-4-5-20250514
⚠️  Connection established but identity uncertain
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Implémentation** :
```typescript
// Format identity check result for display
private formatIdentityResult(success: boolean, apiModel: string, aiResponse: string, error?: string): string {
  if (success) {
    return `✅ Model Switch Successful
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 API Metadata: ${apiModel}
🤖 Model confirms: "${aiResponse}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  } else {
    return `⚠️  Identity Verification Failed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Error: ${error}
⚠️  Connection established but identity uncertain
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }
}
```

**Fichiers** : `src/agent/grok-agent.ts` (nouvelle méthode)

---

#### Solution 1.4 : Identity Check au Démarrage (Optionnel mais Recommandé)

**Objectif** : Vérifier l'identité au premier lancement, pas seulement au switch.

**Implémentation** :
```typescript
// In constructor or initialization
async initialize(): Promise<void> {
  // Run initial identity check
  const provider = this.grokClient.getProvider();
  const model = this.grokClient.getCurrentModel();

  debugLog.log(`🚀 Initializing with model: ${model}`);

  const identityResult = await this.verifyCurrentModel();
  console.log(identityResult); // Show to user

  debugLog.log(`✅ Initialization complete`);
}

// Extract identity check to separate method
private async verifyCurrentModel(): Promise<string> {
  const provider = this.grokClient.getProvider();
  const model = this.grokClient.getCurrentModel();

  // ... same identity check logic as switchToModel
  // ... returns formatted result
}
```

**Fichiers** :
- `src/agent/grok-agent.ts` : Ajouter méthode `verifyCurrentModel()`
- `src/index.ts` : Appeler `agent.initialize()` au démarrage

---

### Phase 2 : Fixer Premier Message Hardcodé (Bug #2)

#### Objectif
Supprimer le court-circuit hardcodé pour les salutations.

#### Solution 2.1 : Supprimer le Hardcoded Response

**Code à supprimer** : `src/agent/grok-agent.ts:895-940`

```typescript
// ❌ SUPPRIMER TOUT CE BLOC
const isSimpleGreetingOrIdentity =
  (normalized === "bonjour" ||
    normalized.startsWith("bonjour") ||
    normalized.startsWith("salut") ||
    ...);

if (isSimpleGreetingOrIdentity) {
  const identityText = `Bonjour ! Vous échangez avec ${modelName}...`;
  // ... hardcoded response
  yield { type: "content", content: "\n\n" + identityText };
  yield { type: "done" };
  return;
}
```

**Raison** :
- Le LLM peut répondre naturellement aux salutations
- Plus de contexte et de personnalité
- Pas de confusion avec des messages plus complexes

---

#### Solution 2.2 : Garder le Tool `get_my_identity`

**Objectif** : Le LLM peut utiliser ce tool s'il a vraiment besoin de vérifier son identité.

**Vérification** : Le tool existe déjà (ligne 1500-1506), il fonctionne.

**Documenter dans system prompt** :
```typescript
"If you are unsure of your identity, use the 'get_my_identity' tool to verify."
```

**Ne PAS** :
- Forcer l'utilisation du tool
- Court-circuiter les salutations
- Hardcoder des réponses

---

## 📊 Ordre d'Implémentation Révisé

### 🥇 **Étape 1** : Fixer Identity Check pour Claude (1h)
1. Ajouter méthode `getOfficialModelName()`
2. Ajouter fallback (essayer nom original si nom officiel échoue)
3. Améliorer format de sortie
4. Tester avec Claude

**Critique** : Sans ça, impossible d'utiliser Claude de manière fiable.

---

### 🥈 **Étape 2** : Identity Check au Démarrage (30 min) [Optionnel]
1. Extraire logique d'identity check dans méthode `verifyCurrentModel()`
2. Appeler au démarrage dans `initialize()`
3. Afficher résultat à l'utilisateur

**Bénéfice** : L'utilisateur sait immédiatement avec quel LLM il parle.

---

### 🥉 **Étape 3** : Supprimer Hardcoded Response (15 min)
1. Supprimer bloc de code (lignes 895-940)
2. Tester avec "Bonjour", "Salut", etc.
3. Vérifier que le LLM répond naturellement

**Simple** : Juste supprimer du code existant.

---

## ✅ Critères de Succès Révisés

### Bug #1 : Identity Check
- ✅ Identity check fonctionne pour Claude (pas de 404)
- ✅ Identity check fonctionne pour tous les providers
- ✅ Résultat clairement affiché à l'utilisateur
- ✅ API metadata est la source de vérité (pas ce que le LLM dit)
- ✅ En cas d'erreur, message clair mais connection continue

### Bug #2 : Premier Message
- ✅ "Bonjour" reçoit réponse naturelle du LLM
- ✅ "Salut + question" traite la question sans hardcoded greeting
- ✅ Le LLM peut utiliser `get_my_identity` tool si nécessaire

---

## 🔧 Résumé des Changements

| Fichier | Action | Priorité |
|---------|--------|----------|
| `src/agent/grok-agent.ts` | Ajouter `getOfficialModelName()` | 🔴 Critique |
| `src/agent/grok-agent.ts` | Améliorer identity check (1874-1904) | 🔴 Critique |
| `src/agent/grok-agent.ts` | Ajouter `formatIdentityResult()` | 🟡 Important |
| `src/agent/grok-agent.ts` | Supprimer hardcoded response (895-940) | 🟢 Simple |
| `src/agent/grok-agent.ts` | Ajouter `verifyCurrentModel()` | 🔵 Optionnel |
| `src/index.ts` | Appeler `initialize()` | 🔵 Optionnel |

---

## 🎯 Conclusion Révisée

**Principe clé** : L'identity check est **CRITIQUE** pour la certitude de l'utilisateur.

**Priorité** :
1. Fixer identity check pour Claude (critique)
2. Améliorer affichage du résultat (important)
3. Supprimer hardcoded response (simple)
4. Identity check au démarrage (bonus)

Prêt à implémenter l'Étape 1 (fixer identity check pour Claude) ? 🚀
