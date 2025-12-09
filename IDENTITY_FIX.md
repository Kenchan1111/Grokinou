# 🎯 Fix d'Identité : Tool `get_my_identity` + Hard Reset

**Date** : 24 novembre 2025  
**Problème** : Le LLM se trompe sur son identité en se basant sur l'historique de conversation  
**Solution** : Tool `get_my_identity` + Message hard reset au switch

---

## 🔍 Problème Identifié

Quand on switch de modèle (ex: deepseek → mistral), le nouveau modèle voit l'historique de conversation qui contient des messages de l'ancien modèle :

```
[Système] You are mistral-large-latest...
[User] Qui es-tu ?
[Assistant (deepseek)] Je suis deepseek-chat...  ← ANCIEN
[User] /model mistral-large-latest
[Système] You are mistral-large-latest...       ← NOUVEAU (purgé)
[User] Qui es-tu maintenant ?
[Assistant (mistral)] Je vois "deepseek" dans l'historique... 
                      donc je suis deepseek ? ← CONFUSION
```

**Cause** : L'historique de conversation **supersède** le message système dans l'esprit du LLM.

---

## ✅ Solution Implémentée : Option A + B

### 1️⃣ Nouveau Tool : `get_my_identity`

**Nom** : `get_my_identity` (pas `get_current_identity`)
- **Philosophie** : Chaque modèle a SA propre identité intrinsèque qui ne change pas
- **Usage** : Le LLM peut appeler ce tool pour obtenir une confirmation factuelle de son identité

**Fichiers créés** :
- `src/tools/get-my-identity.ts` (nouvelle implémentation)

**Intégré dans** :
- `src/grok/tools.ts` (définition du tool)
- `src/agent/grok-agent.ts` (exécution du tool, case dans executeTool)

**Output du tool** :
```
╔═══════════════════════════════════════════════════════════════╗
║                    MY IDENTITY                                ║
╚═══════════════════════════════════════════════════════════════╝

🤖 Model:        mistral-large-latest
🏢 Provider:     Mistral
🔗 Endpoint:     https://api.mistral.ai/v1
🔑 API Key:      sk-proj-abc...xyz
📂 Working Dir:  /home/user/project
💾 Session ID:   42
⏰ Timestamp:    2025-11-24T23:00:00.000Z

This is FACTUAL information about your current runtime configuration.
Use this to verify your identity, not conversation history.
```

---

### 2️⃣ Message Système Modifié

**Ajout dans `updateSystemMessage()`** (ligne 148-152) :

```typescript
⚠️ IDENTITY VERIFICATION:
If you ever have any doubt about your model identity or which provider you are,
use the 'get_my_identity' tool. This will give you FACTUAL information about
who you actually are, based on your current runtime configuration,
NOT based on conversation history. This is especially important if you notice
inconsistencies in the conversation or after a model switch.
```

**Objectif** : Donner au LLM un "réflexe" pour se vérifier en cas de doute.

---

### 3️⃣ Message "Hard Reset" au Switch

**Injection dans `switchToModel()`** (ligne 956-971) :

```typescript
this.messages.push({
  role: "user",
  content: `[SYSTEM NOTIFICATION - MODEL SWITCHED]

You are now: ${model}
Provider: ${providerConfig?.name || provider}
Endpoint: ${providerConfig?.baseURL || 'unknown'}

⚠️ CRITICAL: Ignore ALL previous model identity references in the conversation history.
Any messages where you identified as a different model are now OBSOLETE and INCORRECT.

Your CURRENT and ONLY identity is: ${model}

If you need confirmation, use the 'get_my_identity' tool.`
});
```

**Objectif** : Donner une instruction EXPLICITE au LLM d'ignorer l'historique.

---

## 🎯 Pourquoi `get_my_identity` et pas `get_current_identity` ?

| Nom | Signification | Problème |
|-----|---------------|----------|
| ❌ `get_current_identity` | "Identité actuelle" | Implique que l'identité peut changer (confus) |
| ✅ `get_my_identity` | "Mon identité" | Identité intrinsèque, immuable (clair) |

**Philosophie** : Chaque modèle a **SA** propre identité qui ne change pas. Ce n'est pas l'identité qui change, c'est le modèle lui-même qui est différent.

---

## 🧪 Test du Fix

### Scénario de Test

```bash
# 1. Démarrer avec un modèle
grokinou-cli
/model deepseek-chat
Who are you?
> Je suis deepseek-chat...

# 2. Switch vers un autre modèle
/model mistral-large-latest

# Le LLM reçoit automatiquement :
# - Système: You are mistral-large-latest (purgé)
# - User: [SYSTEM NOTIFICATION - MODEL SWITCHED] (hard reset)
# - Mention du tool get_my_identity dans le système

# 3. Vérifier l'identité
Who are you now?

# 4. Le LLM peut aussi appeler le tool
use get_my_identity
```

### Résultat Attendu

Le LLM doit :
- ✅ S'identifier comme `mistral-large-latest`
- ✅ Ne PAS dire "j'étais deepseek avant"
- ✅ Pouvoir appeler `get_my_identity` si besoin

---

## 📊 Architecture

```
User: /model mistral-large-latest
    ↓
switchToModel(mistral-large-latest)
    ↓
1. updateSystemMessage()
   → Purge ancien système
   → Nouveau système: "You are mistral-large-latest..."
   → Mentionne get_my_identity
    ↓
2. Inject hard reset message
   → [SYSTEM NOTIFICATION - MODEL SWITCHED]
   → "Ignore previous identity references"
    ↓
3. Update session manager
    ↓
LLM voit:
  [Système] You are mistral-large-latest... (+ mention get_my_identity)
  [User] previous conversation...
  [Assistant] (deepseek messages) ← ANCIEN
  [User] [SYSTEM NOTIFICATION] You are now mistral... ← HARD RESET
  [User] Who are you?
    ↓
LLM répond:
  "Je suis mistral-large-latest" ✅
  
Ou si doute:
  LLM appelle get_my_identity
    ↓
  Reçoit confirmation factuelle
    ↓
  "Je suis mistral-large-latest (confirmé par get_my_identity)" ✅
```

---

## 🚀 Fichiers Modifiés

1. **`src/tools/get-my-identity.ts`** (NOUVEAU)
   - Implémentation du tool
   - Retourne info factuelle (model, provider, endpoint, etc.)

2. **`src/grok/tools.ts`**
   - Ajout de la définition du tool `get_my_identity`
   - Ligne 266-277

3. **`src/agent/grok-agent.ts`**
   - Ajout du case `get_my_identity` dans `executeTool()` (ligne 837-839)
   - Modification de `updateSystemMessage()` : mention du tool (ligne 143, 148-152)
   - Modification de `switchToModel()` : hard reset message (ligne 956-971)

---

## 🎓 Leçons Apprises

### 1. L'Historique > Message Système

Le LLM accorde plus de poids à l'historique récent qu'au message système, surtout s'il voit des références explicites à son identité dans l'historique.

**Solution** : Injecter un message user EXPLICITE qui dit "ignore l'historique".

### 2. Les Tools comme Source de Vérité

Donner au LLM un outil pour se vérifier lui-même est plus efficace que de simplement dire "tu es X" dans le système.

**Pourquoi** : Le LLM peut **appeler** le tool et voir un résultat "factuel" (JSON structuré), ce qui est plus convaincant que du texte.

### 3. Nommer les Concepts Correctement

`get_my_identity` vs `get_current_identity` : Le nom du tool influence la compréhension du LLM.

**Leçon** : Choisir des noms qui reflètent la **sémantique correcte** du concept.

---

## 🔮 Améliorations Futures (Optionnelles)

### Option C : Proposer de Clear l'Historique

```typescript
// Dans use-input-handler.ts
if (trimmedInput.startsWith("/model ")) {
  const newModel = trimmedInput.substring(7).trim();
  
  setChatHistory(prev => [...prev, {
    type: "assistant",
    content: `⚠️ Switching to ${newModel}.
    
Options:
1. Keep conversation history (may cause identity confusion)
2. Clear history and start fresh (recommended)

Type 'keep' or 'clear':`,
    timestamp: new Date()
  }]);
}
```

**Avantage** : Donne le contrôle à l'utilisateur.

---

## ✅ Status

- [x] Tool `get_my_identity` créé
- [x] Intégré dans l'agent
- [x] Message système modifié
- [x] Hard reset au switch
- [x] Build réussi
- [ ] Testé en conditions réelles
- [ ] Documentation mise à jour

---

**Auteur** : Zack + Claude  
**Date** : 24 novembre 2025  
**Statut** : ✅ IMPLÉMENTÉ, à tester
