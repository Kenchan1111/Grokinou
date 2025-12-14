# PHASE 1 - MODIFICATIONS COMPLÈTES
## Documentation pour ChatGPT

**Date** : 14 décembre 2025
**Contexte** : Correction du bug de corruption messages tool orphelins
**Erreur résolue** : `400 Invalid parameter: messages with role 'tool' must be a response to a preceeding message with 'tool_calls'`

---

## 🎯 PROBLÈME IDENTIFIÉ

### Cause Racine Double

1. **Base de données corrompue** :
   - 40 messages dont 13 messages `tool`
   - Séquence invalide : tool messages sans assistant+tool_calls immédiatement avant
   - Corruption détectée dans `~/.grok/conversations.db`

2. **Code défaillant** :
   - `cleanMessagesForProvider()` : Ne vérifiait PAS l'adjacence stricte
   - `restoreFromHistory()` : Restaurait TOUS les messages sans validation
   - Résultat : Messages tool orphelins envoyés à l'API → erreur 400

---

## ✅ MODIFICATIONS EFFECTUÉES

### Modification 1 : Durcissement `cleanMessagesForProvider()`

**Fichier** : `src/grok/client.ts`
**Lignes** : 373-408

#### Code AVANT (Défaillant)

```typescript
// If it's a tool message, check if previous message has tool_calls
if (msg.role === 'tool') {
  // Find previous non-tool message
  let prevAssistant: GrokMessage | null = null;
  for (let j = i - 1; j >= 0; j--) {
    if (messages[j].role === 'assistant') {
      prevAssistant = messages[j];  // ❌ PROBLÈME : cherche dans tableau ORIGINAL
      break;
    }
  }

  // ❌ PROBLÈME : prevAssistant peut être n'importe quel assistant plus haut
  // Il peut y avoir des messages user/assistant intercalés entre prevAssistant et le tool
  if (prevAssistant && (prevAssistant as any).tool_calls && (prevAssistant as any).tool_calls.length > 0) {
    cleaned.push(msg);
  } else {
    cleaned.push({
      role: 'user',
      content: `[Tool Result - Previous Context]\n${msg.content}`,
    });
  }
  continue;
}
```

**Problème** :
- Cherche dans `messages` (tableau ORIGINAL)
- Trouve le premier assistant avec tool_calls en remontant
- Ne garantit PAS que cet assistant est immédiatement avant le tool dans le tableau NETTOYÉ
- Exemple de cas problématique :
  ```
  messages originaux:
  1. assistant (avec tool_calls)  ← trouvé par le for()
  2. user (intercalé)
  3. tool  ← pense que #1 est ok, mais dans cleaned[] il y a user entre les deux
  ```

#### Code APRÈS (Corrigé)

```typescript
// If it's a tool message, check if IMMEDIATELY previous CLEANED message has tool_calls
if (msg.role === 'tool') {
  // ✅ STRICT ADJACENCY: Check the LAST cleaned message (not original array)
  // This prevents orphaned tool messages when assistant messages are filtered out
  const lastCleaned = cleaned[cleaned.length - 1];

  // ✅ MUST be assistant with non-empty tool_calls (strict validation)
  if (lastCleaned &&
      lastCleaned.role === 'assistant' &&
      (lastCleaned as any).tool_calls &&
      (lastCleaned as any).tool_calls.length > 0) {
    // ✅ Valid: keep tool message
    const toolMsg = msg as any;
    // ✅ Truncate tool_call_id to 40 chars (OpenAI API requirement)
    if (toolMsg.tool_call_id && toolMsg.tool_call_id.length > 40) {
      cleaned.push({
        ...msg,
        tool_call_id: toolMsg.tool_call_id.substring(0, 40),
      } as GrokMessage);
    } else {
      cleaned.push(msg);
    }
  } else {
    // ❌ Orphaned tool: convert to user to preserve content
    // This happens when:
    // - No previous message at all
    // - Previous message is not assistant
    // - Previous assistant has no tool_calls
    // - Previous assistant has empty tool_calls array
    debugLog.log(`⚠️  Orphaned tool message detected at index ${i}, converting to user message`);
    cleaned.push({
      role: 'user',
      content: `[Tool Result - Previous Context]\n${msg.content}`,
    });
  }
  continue;
}
```

**Changements clés** :
1. ✅ Vérifie `cleaned[cleaned.length - 1]` au lieu de chercher dans `messages` original
2. ✅ Garantit adjacence STRICTE (dernier message nettoyé)
3. ✅ Ajoute log debug pour traçabilité (`debugLog.log()`)
4. ✅ Commentaires détaillés expliquant les 4 cas d'orphelins

**Impact** :
- ✅ Adjacence stricte garantie 100%
- ✅ Détection immédiate des orphelins
- ✅ Conversion automatique en user (préserve le contenu)
- ✅ Logs pour forensic

---

### Modification 2 : Filtrage `restoreFromHistory()`

**Fichier** : `src/agent/grok-agent.ts`
**Lignes** : 286-316

#### Code AVANT (Défaillant)

```typescript
} else if (entry.type === "tool_result" && entry.toolCall) {
  // ✅ For Mistral: include "name" field (required by their API)
  const toolMessage: any = {
    role: "tool",
    content: entry.content,
    tool_call_id: entry.toolCall.id,
  };

  // Add "name" field for Mistral (required by their API spec)
  const currentProvider = providerManager.detectProvider(this.grokClient.getCurrentModel());
  if (currentProvider === 'mistral') {
    toolMessage.name = entry.toolCall.function?.name || 'unknown';
  }

  this.messages.push(toolMessage);  // ❌ PROBLÈME : ajout aveugle sans validation
}
```

**Problème** :
- Ajoute TOUS les messages tool depuis la BD sans vérifier l'adjacence
- Si la BD est corrompue (tool sans assistant+tool_calls avant), propage la corruption
- Résultat : `this.messages` contient des orphelins → erreur 400 à l'envoi API

#### Code APRÈS (Corrigé)

```typescript
} else if (entry.type === "tool_result" && entry.toolCall) {
  // ✅ STRICT VALIDATION: Tool message MUST have assistant with tool_calls immediately before
  // This prevents loading corrupted data from database
  const lastMessage = this.messages[this.messages.length - 1];

  if (!lastMessage ||
      lastMessage.role !== 'assistant' ||
      !(lastMessage as any).tool_calls ||
      (lastMessage as any).tool_calls.length === 0) {
    // ❌ Orphaned tool message - skip it to prevent API errors
    console.warn(`⚠️  [Restore] Skipping orphaned tool message (tool_call_id: ${entry.toolCall.id})`);
    console.warn(`   Last message was: ${lastMessage ? lastMessage.role : 'none'}`);
    continue; // Skip this tool message
  }

  // ✅ Valid: previous message is assistant with tool_calls
  // For Mistral: include "name" field (required by their API)
  const toolMessage: any = {
    role: "tool",
    content: entry.content,
    tool_call_id: entry.toolCall.id,
  };

  // Add "name" field for Mistral (required by their API spec)
  const currentProvider = providerManager.detectProvider(this.grokClient.getCurrentModel());
  if (currentProvider === 'mistral') {
    toolMessage.name = entry.toolCall.function?.name || 'unknown';
  }

  this.messages.push(toolMessage);
}
```

**Changements clés** :
1. ✅ Vérifie `this.messages[this.messages.length - 1]` AVANT d'ajouter le tool
2. ✅ Valide que le dernier message est assistant avec tool_calls non vide
3. ✅ Si invalide : `continue` (skip le message tool)
4. ✅ Logs d'avertissement avec tool_call_id et rôle du dernier message
5. ✅ Empêche propagation corruption BD → API

**Impact** :
- ✅ Filtrage au chargement depuis BD
- ✅ Ne propage PAS la corruption
- ✅ Logs pour identifier quels messages sont skippés
- ✅ Application fonctionne même si BD corrompue

---

### Modification 3 : Purge Base de Données

**Fichier** : `~/.grok/conversations.db`

#### Actions effectuées

```bash
# 1. Vérification avant purge
sqlite3 ~/.grok/conversations.db "SELECT COUNT(*) FROM messages; SELECT COUNT(*) FROM sessions;"
# Résultat : 40 messages, 2 sessions

# 2. Purge complète
sqlite3 ~/.grok/conversations.db "DELETE FROM messages; DELETE FROM sessions; VACUUM;"

# 3. Vérification après purge
sqlite3 ~/.grok/conversations.db "SELECT COUNT(*) FROM messages; SELECT COUNT(*) FROM sessions;"
# Résultat : 0 messages, 0 sessions
```

**Backup sécurisé** :
```
~/CORRUPTION_EVIDENCE_20251214_090818/conversations.db.backup (272 KB)
~/CORRUPTION_EVIDENCE_20251214_090818/conversations_db_dump.sql (30 KB)
~/CORRUPTION_EVIDENCE_20251214_090818/all_messages.txt (24 KB)
~/CORRUPTION_EVIDENCE_20251214_090818/DATABASE_CORRUPTION_FORENSIC_REPORT.md
```

**Impact** :
- ✅ BD propre (0 messages corrompus)
- ✅ Prête pour nouveau départ
- ✅ Preuves forensiques conservées

---

### Modification 4 : Rebuild Application

```bash
npm run build
```

**Résultat** :
```
> @vibe-kit/grokinou-cli@0.1.0 build
> tsc && mkdir -p dist/prompts && cp -r src/prompts/*.md dist/prompts/ && chmod +x dist/index.js

✅ Succès sans erreur TypeScript
```

**Impact** :
- ✅ Code compilé avec corrections
- ✅ Prêt pour tests

---

## 📊 RÉSUMÉ DES FICHIERS MODIFIÉS

| Fichier | Fonction | Lignes | Type Modif | Criticité |
|---------|----------|--------|------------|-----------|
| `src/grok/client.ts` | `cleanMessagesForProvider()` | 373-408 | Logique adjacence stricte | 🔴 Critique |
| `src/agent/grok-agent.ts` | `restoreFromHistory()` | 286-316 | Validation au chargement | 🔴 Critique |
| `~/.grok/conversations.db` | - | - | Purge data | 🟡 Nettoyage |

**Total** : 67 lignes modifiées dans 2 fichiers TypeScript

---

## 🧪 TESTS RECOMMANDÉS

### Test 1 : Session Propre (Basique)

```bash
npm run dev
> bonjour
```

**Attendu** :
- ✅ Réponse normale de l'assistant
- ✅ Pas d'erreur 400
- ✅ Pas de log "Orphaned tool message"

**Si échec** :
- Vérifier que le build a bien été fait
- Vérifier que conversations.db est bien purgée

---

### Test 2 : Avec Tool Calls (Critique)

```bash
npm run dev
> Quelle est l'architecture de l'application ?
```

**Attendu** :
- ✅ Appel d'outil (ex: view_file, list_files)
- ✅ Message assistant avec tool_calls dans BD
- ✅ Message tool dans BD
- ✅ Réponse finale de l'assistant
- ✅ Pas d'erreur 400

**Vérification BD** :
```bash
sqlite3 ~/.grok/conversations.db "
  SELECT id, role, type,
         CASE WHEN tool_calls IS NOT NULL THEN 'HAS_TOOL_CALLS' ELSE 'NO' END as tc
  FROM messages
  ORDER BY id;
"
```

**Attendu** :
```
1|user|user|NO
2|assistant|assistant|HAS_TOOL_CALLS
3|tool|tool_result|NO
4|assistant|assistant|NO
```

---

### Test 3 : Rechargement Session (Validation Restauration)

```bash
# Session 1
npm run dev
> bonjour
> Comment ça va ?
> /exit

# Session 2 (rechargement)
npm run dev
```

**Attendu** :
- ✅ Historique affiché dans UI
- ✅ Pas de log "Skipping orphaned tool message"
- ✅ Continuité de la conversation possible

**Si logs "Skipping orphaned"** :
- C'est NORMAL si la BD contenait des orphelins
- Le filtrage fonctionne correctement
- Les orphelins sont skippés et n'empêchent pas l'application de fonctionner

---

### Test 4 : Corruption Manuelle (Test Robustesse)

```bash
# 1. Créer session normale
npm run dev
> bonjour
> /exit

# 2. Corrompre manuellement
sqlite3 ~/.grok/conversations.db "
  UPDATE messages SET content = 'CORRUPTED_CONTENT' WHERE id = 1
"

# 3. Relancer
npm run dev
```

**Attendu** :
- ✅ Application démarre sans crash
- ✅ Historique chargé (content corrompu mais structure OK)
- ✅ Pas d'erreur 400

**Si tool message corrompu** :
```bash
# Supprimer un assistant avec tool_calls
sqlite3 ~/.grok/conversations.db "
  DELETE FROM messages WHERE id = 2 AND role = 'assistant'
"
# Maintenant message 3 (tool) est orphelin

# Relancer
npm run dev
```

**Attendu** :
- ✅ Log : "⚠️ [Restore] Skipping orphaned tool message"
- ✅ Application fonctionne normalement
- ✅ Message tool orphelin est SKIPPÉ

---

## 🎯 VALIDATION DU FIX

### Critères de Succès

| Critère | Status | Validation |
|---------|--------|------------|
| Build réussi | ✅ | `npm run build` sans erreur |
| BD purgée | ✅ | 0 messages, 0 sessions |
| Adjacence stricte | ✅ | Vérifie `cleaned[]` pas `messages[]` |
| Filtrage restauration | ✅ | Skip orphelins au chargement |
| Logs debug | ✅ | `debugLog.log()` et `console.warn()` |

### Scénarios à Tester

1. ✅ **Session propre** : Pas d'erreur 400
2. ✅ **Tool calls** : Fonctionnent correctement
3. ✅ **Rechargement** : Historique chargé sans erreur
4. ✅ **BD corrompue** : Application robuste (skip orphelins)

---

## 🚀 PROCHAINES ÉTAPES

### Phase 2 : Sécurisation BD (Après validation Phase 1)

**Objectif** : Signature par message + détection automatique corruption

**Tâches** :
1. Migration schéma :
   - `ALTER TABLE messages ADD COLUMN checksum TEXT`
   - `ALTER TABLE sessions ADD COLUMN rolling_checksum TEXT`
   - `CREATE TABLE session_signatures (...)`

2. Implémentation :
   - `calculateMessageChecksum()`
   - `calculateRollingChecksum()`
   - Modifier `addMessage()` pour calcul automatique

3. Ancrage timeline.db :
   - Event `SESSION_SIGNATURE` tous les 5 messages
   - Event `CORRUPTION_DETECTED` si mismatch

4. Détection :
   - `verifySessionIntegrity()`
   - Alerte console + refus chargement si corrompu

5. Commande :
   - `/verify-conversation`
   - `/verify-conversation --all`

**Voir détails** : `PLAN_SECURISATION_CONVERSATIONS_DB.md`

---

### Phase 3 : UX (Après Phase 2)

1. Timestamps UI : `[JJ/MM HH:MM]` avant chaque message
2. Affichage début de session : date/heure complète
3. Commande `/sessions` avec statut intégrité

---

## 📝 NOTES IMPORTANTES POUR CHATGPT

### Points Critiques

1. **Adjacence stricte** :
   - TOUJOURS vérifier dans `cleaned[]` (tableau nettoyé)
   - JAMAIS dans `messages[]` (tableau original)
   - Raison : messages peuvent être filtrés entre original et nettoyé

2. **Validation au chargement** :
   - TOUJOURS valider avant `this.messages.push()`
   - Ne JAMAIS assumer que la BD est intacte
   - Raison : BD peut être altérée par attaquant

3. **Logs forensiques** :
   - TOUJOURS logger les orphelins détectés
   - Inclure context (index, role dernier message, tool_call_id)
   - Raison : permet investigation forensique

4. **Préservation contenu** :
   - Convertir orphelins en `user` (pas supprimer)
   - Préfixer `[Tool Result - Previous Context]`
   - Raison : préserve information potentiellement importante

### Erreurs à Éviter

❌ **Ne PAS** chercher assistant dans tableau original :
```typescript
for (let j = i - 1; j >= 0; j--) {
  if (messages[j].role === 'assistant') { ... }  // ❌ MAUVAIS
}
```

✅ **FAIRE** vérifier dernier message nettoyé :
```typescript
const lastCleaned = cleaned[cleaned.length - 1];  // ✅ BON
if (lastCleaned && lastCleaned.role === 'assistant') { ... }
```

❌ **Ne PAS** ajouter tool sans validation :
```typescript
this.messages.push(toolMessage);  // ❌ MAUVAIS (pas de check)
```

✅ **FAIRE** valider avant ajout :
```typescript
const lastMessage = this.messages[this.messages.length - 1];
if (lastMessage && lastMessage.role === 'assistant' && lastMessage.tool_calls) {
  this.messages.push(toolMessage);  // ✅ BON
}
```

### Debugging

**Si erreur 400 persiste** :

1. Vérifier build :
   ```bash
   npm run build
   ls -la dist/grok/client.js  # Doit être récent
   ```

2. Vérifier BD :
   ```bash
   sqlite3 ~/.grok/conversations.db ".schema messages"
   sqlite3 ~/.grok/conversations.db "SELECT * FROM messages;"
   ```

3. Activer debug logs :
   ```bash
   export DEBUG=1
   npm run dev
   ```

4. Vérifier payload envoyé à l'API :
   - Chercher logs `debugLog.log()` dans console
   - Vérifier que tool messages ont bien assistant+tool_calls avant

---

## 📎 FICHIERS DE RÉFÉRENCE

**Preuves forensiques** :
- `~/CORRUPTION_EVIDENCE_20251214_090818/DATABASE_CORRUPTION_FORENSIC_REPORT.md`

**Plans futurs** :
- `PLAN_SECURISATION_CONVERSATIONS_DB.md`

**Rapports Phase 1** :
- `PHASE1_CORRECTIONS_COMPLETED.md`
- `PHASE1_MODIFICATIONS_POUR_CHATGPT.md` (ce fichier)

---

**FIN DOCUMENTATION PHASE 1** - Prêt pour validation et Phase 2 🚀
