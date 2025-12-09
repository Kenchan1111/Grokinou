# RAPPORT FORENSIQUE - ANALYSE DES RÉGRESSIONS
## Période: 6 décembre 2025 20:54 → 7 décembre 2025 16:00

**État de référence (fonctionnel):** `7fd7edc` - 2025-12-06 20:54:52
**État actuel (régressé):** `5265aa5` - 2025-12-07 08:04:56
**Durée:** ~11 heures

---

## RÉSUMÉ EXÉCUTIF

**RÉGRESSION CRITIQUE IDENTIFIÉE:** Le système a perdu la capacité d'utiliser les outils (tools) correctement.

**SYMPTÔME:** Les modèles LLM (particulièrement GPT-5) **décrivent** l'utilisation des outils au lieu de les **exécuter réellement**.

**CAUSE RACINE:** Commit `49a5147` (7 déc 2025 00:20:54) - Modification de la fonction `restoreFromHistory()` qui omet le champ `tool_calls` des messages assistant quand l'array est vide.

---

## CHRONOLOGIE DES COMMITS

### Période 1: Travail sur l'interface (6 déc 20:07 → 20:54)
**Commits UI légitimes - Aucune régression**

1. **dfee8f6** - 2025-12-06 20:07:30
   `fix(ui): implement Step 1 - numeric widths and proper wrapping`

2. **b4d9cb5** - 2025-12-06 20:12:24
   `fix(ui): revert flexShrink to 0 - keep input box full width`

3. **df01998** - 2025-12-06 20:43:52
   `fix(ui): move InputController inside ConversationView panel`

4. **2cd755b** - 2025-12-06 20:48:04
   `fix(security): add ignored patterns to integrity-watcher chokidar config`

5. **c08204b** - 2025-12-06 20:50:25
   `fix(timeline): add ignorePermissionErrors and depth limit to FileHook`

6. **7fd7edc** - 2025-12-06 20:54:52 ⭐ **DERNIER ÉTAT FONCTIONNEL**
   `fix(timeline): watch only relevant directories to avoid .git scanning`

### Période 2: Travail sur les sessions (6 déc 21:42 → 23:36)
**Commits fonctionnels - Pas de régression détectée**

7. **15a0e9d** - 2025-12-06 21:42:18
   `security(integrity-watcher): add .git critical patterns`

8. **a4a2454** - 2025-12-06 21:49:40
   `fix(session): prevent API key contamination on session switch`

9. **d7a0942** - 2025-12-06 22:03:58
   `feat(cli): add --session flag to launch specific session`

10. **1f1c3e0** - 2025-12-06 23:22:29
    `fix(session): restore chatHistory in restoreFromHistory()`

11. **8b506e0** - 2025-12-06 23:36:45
    `feat(session): import history by default in /new-session`

### Période 3: Nuit - Introduction de la régression (7 déc 00:12 → 00:31)
**⚠️ COMMITS PROBLÉMATIQUES**

12. **f53ebf4** - 2025-12-07 00:12:48
    `fix(session): make session_hash unique with timestamp + random`

13. **49a5147** - 2025-12-07 00:20:54 🔴 **COMMIT SUSPECT #1 - RÉGRESSION CRITIQUE**
    `fix(history): validate tool_calls is array before sending to API`

14. **1eba75d** - 2025-12-07 00:31:14
    `fix(ui): enable native terminal scrolling by disabling alternate screen buffer`

### Période 4: Matin - Commit UI (7 déc 08:04)
**Commit légitime - Pas de lien avec la régression**

15. **5265aa5** - 2025-12-07 08:04:56 ⭐ **ÉTAT ACTUEL (HEAD)**
    `fix(ui): add text wrapping to prevent overflow in split-view mode`

---

## ANALYSE DÉTAILLÉE PAR FICHIER

### 📄 FICHIER 1: `src/agent/grok-agent.ts`
**Impact:** ⚠️ **CRITIQUE - RÉGRESSION MAJEURE**
**Lignes modifiées:** +63 -16 (79 lignes totales)

#### Modification A: restoreFromHistory() - LIGNE 374-391
**Commit:** `49a5147` + `1f1c3e0`
**Type:** RÉGRESSION CRITIQUE

**AVANT (État fonctionnel):**
```typescript
if (entry.type === "assistant") {
  this.messages.push({
    role: "assistant",
    content: entry.content,
    tool_calls: entry.toolCalls as any,  // ✅ TOUJOURS INCLUS
  } as any);
}
```

**APRÈS (État régressé):**
```typescript
if (entry.type === "assistant") {
  // ✅ FIX: Ensure tool_calls is array or undefined (not string)
  let toolCalls = entry.toolCalls;
  if (toolCalls && typeof toolCalls === 'string') {
    try {
      toolCalls = JSON.parse(toolCalls);
    } catch {
      toolCalls = undefined;
    }
  }
  // Only include tool_calls if it's a non-empty array
  const message: any = {
    role: "assistant",
    content: entry.content,
  };
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {  // ❌ CONDITION PROBLÉMATIQUE
    message.tool_calls = toolCalls;
  }
  this.messages.push(message);
}
```

**ANALYSE FORENSIQUE:**

1. **Intention déclarée:** "Fixer l'erreur 'msg.tool_calls.map is not a function'"
2. **Changement clé:** Ajout de la condition `toolCalls.length > 0`
3. **Effet secondaire non anticipé:** Les messages avec `tool_calls: []` (array vide) perdent le champ `tool_calls`

**IMPACT SUR LE COMPORTEMENT:**

Dans l'API OpenAI, la présence/absence du champ `tool_calls` a une signification sémantique:

| État | Signification pour le modèle |
|------|------------------------------|
| `tool_calls: [...]` (non-vide) | "Je vais utiliser ces outils" |
| `tool_calls: []` (vide) | "J'ai fini d'utiliser les outils, voici ma réponse" |
| **Pas de champ** `tool_calls` | "Je n'ai jamais utilisé d'outils" ⚠️ |

**CONSÉQUENCE:**
Quand une session est restaurée avec `/new-session` ou `--session`, les anciens messages assistant avec `tool_calls: []` sont restaurés **sans** le champ `tool_calls`. Le modèle perd le contexte qu'il a déjà utilisé des outils et commence à **décrire** leur utilisation au lieu de les **appeler**.

**Exemple de comportement régressé:**
```
⏺ Je vais utiliser les outils maintenant:
    1. get_my_identity pour confirmer mon identité
    2. bash pour analyser le répertoire courant

J'exécute ces outils à présent.
Appel de l'outil d'identification...
```

Au lieu de:
```
[APPELS RÉELS DES TOOLS VIA L'API]
```

#### Modification B: Gestion des API keys - LIGNES 1519-1581
**Commit:** `a4a2454`
**Type:** FIX LÉGITIME - Aucune régression

**Changement:** Utilisation de l'API key du provider cible au lieu de l'API key courante lors des switch de session.

**Code ajouté:**
```typescript
// ✅ FIX: Use API key from target session's provider, not current agent's key
const apiKey = providerConfig.apiKey || this.getApiKey();

if (!apiKey) {
  throw new Error(
    `No API key configured for provider: ${currentSession.default_provider}\n` +
    `Please configure it with: /apikey ${currentSession.default_provider} <your-key>`
  );
}
```

**VERDICT:** Fix correct, empêche la contamination des API keys entre providers.

#### Modification C: Ajout chatHistory dans restoreFromHistory() - LIGNE 367
**Commit:** `1f1c3e0`
**Type:** FIX LÉGITIME - Aucune régression

**Code ajouté:**
```typescript
// ✅ FIX: Add to chatHistory for UI display
this.chatHistory.push(entry);
```

**VERDICT:** Fix correct, permet l'affichage de l'historique dans l'UI.

---

### 📄 FICHIER 2: `src/db/repositories/session-repository.ts`
**Impact:** ✅ AUCUNE RÉGRESSION
**Lignes modifiées:** +5 -1

**Commit:** `f53ebf4`
**Changement:** Ajout de timestamp et random dans le hash de session

**AVANT:**
```typescript
return crypto
  .createHash('sha256')
  .update(`${workdir}:${provider}`)
  .digest('hex')
  .substring(0, 16);
```

**APRÈS:**
```typescript
const timestamp = Date.now();
const random = Math.random().toString(36).substring(2, 8);
return crypto
  .createHash('sha256')
  .update(`${workdir}:${provider}:${timestamp}:${random}`)
  .digest('hex')
  .substring(0, 16);
```

**VERDICT:** Fix correct, permet de créer plusieurs sessions dans le même répertoire.

---

### 📄 FICHIER 3: `src/hooks/use-input-handler.ts`
**Impact:** ✅ AUCUNE RÉGRESSION
**Lignes modifiées:** +20 -6

#### Changement A: API key contamination fix
**Commit:** `a4a2454`
**Lignes:** 804-814

**Code ajouté:**
```typescript
// ✅ FIX: Use the API key from the target session's provider
const apiKey = providerConfig.apiKey || agent.getApiKey();

if (!apiKey) {
  throw new Error(
    `No API key configured for provider: ${session.default_provider}\n` +
    `Please configure it with: /apikey ${session.default_provider} <your-key>`
  );
}
```

**VERDICT:** Fix correct.

#### Changement B: Import history par défaut
**Commit:** `8b506e0`
**Lignes:** 1666, 1683-1684

**AVANT:**
```typescript
let importHistory = false;
// ...
if (arg === '--import-history') {
  importHistory = true;
}
```

**APRÈS:**
```typescript
let importHistory = true;  // ✅ CHANGED: Default to true
// ...
if (arg === '--import-history') {
  importHistory = true;
} else if (arg === '--no-import-history') {
  importHistory = false;
}
```

**VERDICT:** Changement de comportement légitime selon l'intention déclarée. **Mais c'est ce changement qui révèle la régression du commit `49a5147`** car maintenant les sessions sont restaurées avec historique par défaut.

---

### 📄 FICHIER 4: `src/index.ts`
**Impact:** ✅ AUCUNE RÉGRESSION
**Lignes modifiées:** +76 -7

**Commit:** `d7a0942` + `1eba75d`

#### Changement A: Support du flag --session
**Lignes:** 152-201

Ajout de la logique pour lancer directement une session spécifique avec `grokinou --session <id>`.

**VERDICT:** Feature légitime, bien implémentée.

#### Changement B: Disable alternate screen buffer
**Ligne:** 682

```typescript
// Disable alternate screen buffer for native terminal scrolling
process.stdout.write('\x1b[?1049l');
```

**VERDICT:** Fix UI légitime pour permettre le scroll natif.

---

### 📄 FICHIER 5: `src/utils/session-manager-sqlite.ts`
**Impact:** ✅ AUCUNE RÉGRESSION
**Lignes modifiées:** +3 -1

**Commit:** `8b506e0`

**Changement:**
```typescript
// AVANT:
const importHistory = options?.importHistory || false;

// APRÈS:
const importHistory = options?.importHistory !== false;
```

**VERDICT:** Changement cohérent avec le changement dans `use-input-handler.ts`.

---

### 📄 FICHIER 6: `src/ui/components/chat-history.tsx`
**Impact:** ✅ AUCUNE RÉGRESSION
**Lignes modifiées:** +8 -8

**Commit:** `5265aa5`

**Changement:** Ajout de `wrap="wrap"` à tous les composants `<Text>` pour éviter le débordement horizontal en split-view.

**Exemple:**
```typescript
// AVANT:
<Text color="gray">{displayContent}</Text>

// APRÈS:
<Text color="gray" wrap="wrap">{displayContent}</Text>
```

**VERDICT:** Fix UI correct, aucun lien avec la régression des tools.

---

### 📄 FICHIER 7: `src/ui/utils/markdown-renderer.tsx`
**Impact:** ✅ AUCUNE RÉGRESSION
**Lignes modifiées:** +1 -1

**Commit:** `5265aa5`

**Changement:**
```typescript
// AVANT:
return <Text>{rendered}</Text>;

// APRÈS:
return <Text wrap="wrap">{rendered}</Text>;
```

**VERDICT:** Fix UI correct.

---

### 📄 FICHIER 8: `src/security/integrity-watcher.ts`
**Impact:** ✅ AUCUNE RÉGRESSION
**Lignes modifiées:** +5 -0

**Commit:** `15a0e9d`

**Changement:** Ajout de patterns critiques pour `.git/`

```typescript
// Git integrity (prevent commit tampering before push)
'.git/config',
'.git/HEAD',
'.git/refs/heads/**',
'.git/hooks/**',
```

**VERDICT:** Amélioration de sécurité légitime.

---

## CONCLUSION FORENSIQUE

### RÉGRESSION IDENTIFIÉE

**Commit responsable:** `49a5147` - 2025-12-07 00:20:54
**Auteur:** zack <fadolcikad@outlook.fr>
**Titre:** `fix(history): validate tool_calls is array before sending to API`

**Fichier:** `src/agent/grok-agent.ts`
**Fonction:** `restoreFromHistory()`
**Lignes:** 374-391

### MÉCANISME DE LA RÉGRESSION

1. **Intention:** Fixer une erreur `msg.tool_calls.map is not a function`
2. **Solution implémentée:** Ajouter validation + parser JSON si string
3. **Effet secondaire:** Condition `if (Array.isArray(toolCalls) && toolCalls.length > 0)`
4. **Conséquence:** Les messages avec `tool_calls: []` perdent le champ
5. **Impact:** Le modèle ne comprend plus qu'il a déjà utilisé des outils
6. **Symptôme:** Le modèle décrit l'utilisation des outils au lieu de les appeler

### FACTEUR AGGRAVANT

**Commit:** `8b506e0` - 2025-12-06 23:36:45
**Changement:** Import history par défaut dans `/new-session`

Ce commit change le comportement par défaut pour importer l'historique. Avant, il fallait utiliser `--import-history` explicitement. Maintenant c'est par défaut.

**Résultat:** La régression du commit `49a5147` se manifeste **systématiquement** dès qu'une session est créée, car l'historique est maintenant restauré par défaut avec le bug de `tool_calls` omis.

### CHRONOLOGIE CAUSALE

```
20:54 → État fonctionnel (7fd7edc)
   ↓
23:36 → Import history par défaut (8b506e0) [FACTEUR AGGRAVANT]
   ↓
00:20 → Validation tool_calls (49a5147) [RÉGRESSION CRITIQUE]
   ↓
RÉSULTAT: Perte de la capacité à utiliser les tools correctement
```

### FIX RECOMMANDÉ

**Fichier:** `src/agent/grok-agent.ts`
**Ligne:** 388

```typescript
// ACTUEL (BUGUÉ):
if (Array.isArray(toolCalls) && toolCalls.length > 0) {
  message.tool_calls = toolCalls;
}

// FIX:
if (Array.isArray(toolCalls)) {  // Inclure même si vide
  message.tool_calls = toolCalls;
}
```

**Justification:** Dans l'API OpenAI, `tool_calls: []` (array vide) a une signification sémantique importante: "J'ai fini d'utiliser les outils, voici ma réponse finale". L'omettre fait perdre ce contexte au modèle.

---

## AUTRES COMMITS

Tous les autres commits (15a0e9d, a4a2454, d7a0942, 1f1c3e0, f53ebf4, 1eba75d, 5265aa5, 2cd755b, c08204b) sont **LÉGITIMES** et n'introduisent **AUCUNE RÉGRESSION**.

Les fonctionnalités de session (/new-session, /switch-session, --session) fonctionnent correctement à l'exception de la régression causée par le commit `49a5147`.

---

**Rapport généré le:** 2025-12-07 16:30:00
**Analyste:** Claude (Sonnet 4.5)
**Base de code:** grok-cli (grokinou)
**Branche:** main
**Commit HEAD:** 5265aa5
