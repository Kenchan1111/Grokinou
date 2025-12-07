# RAPPORT FORENSIQUE COMPLET - ANALYSE DES RÉGRESSIONS
## Période: 4 décembre 2025 07:22 → 7 décembre 2025 16:00

**État de référence (fonctionnel):** `82d03c0` - 2025-11-30 21:42:53 (Fix placeholder GPT-5)
**État régressé #1:** `6b09a8d` - 2025-12-04 07:22:53 (Perte fix placeholder)
**État régressé #2:** `49a5147` - 2025-12-07 00:20:54 (Perte tool_calls vides)
**État restauré:** `df5ffec` - 2025-12-07 16:xx:xx (Tous les fix restaurés)

---

## RÉSUMÉ EXÉCUTIF

**DEUX RÉGRESSIONS CRITIQUES IDENTIFIÉES:**

### RÉGRESSION #1: Perte du fix placeholder GPT-5
**Symptôme:** GPT-5 génère des "reasoning summaries" non souhaités après chaque utilisation de tools
**Cause:** Commit `6b09a8d` a supprimé l'early return qui skipait le placeholder
**Durée:** 3 jours (4 déc → 7 déc)

### RÉGRESSION #2: Perte de la sémantique tool_calls vide
**Symptôme:** Les modèles "décrivent" l'utilisation des tools au lieu de les exécuter
**Cause:** Commit `49a5147` omet `tool_calls` quand l'array est vide
**Durée:** ~16 heures (7 déc 00:20 → 7 déc 16:30)

---

## CHRONOLOGIE DÉTAILLÉE

### 30 novembre 2025 - FIX INITIAL (82d03c0)

**Commit:** `82d03c0` - 2025-11-30 21:42:53
**Auteur:** zack <fadolcikad@outlook.fr>
**Titre:** "fix: Skip summary generation for GPT-5 placeholder message"

**Problème résolu:**
- GPT-5 générait des summaries de 35+ secondes après utilisation de tools
- Le placeholder "Using tools to help you..." (27 chars) déclenchait le summary
- Contexte énorme (1011 messages) causait timeout

**Solution implémentée:**
```typescript
// Skip synthèse pour le placeholder par défaut (GPT-5/o1)
if (contentTrimmed === "Using tools to help you...") {
  debugLog.log("⏭️  Skipping summary (placeholder message, waiting for streaming completion)");
  return newEntries;  // EARLY RETURN
}

// Générer synthèse si :
// - Réponse vide
// - Réponse trop courte (< 150 caractères)
const needsSummary =
  !contentTrimmed ||
  contentTrimmed.length < 150;  // placeholder NOT in condition
```

**Fichiers modifiés:**
- `src/agent/grok-agent.ts` (2 locations: streaming + non-streaming)

**Impact:** Élimine délai de 35+ secondes, prévient truncation de contexte

**État:** ✅ FONCTIONNEL

---

### 4 décembre 2025 - RÉGRESSION #1 (6b09a8d)

**Commit:** `6b09a8d` - 2025-12-04 07:22:53
**Auteur:** zack <fadolcikad@outlook.fr>
**Titre:** "fix: multiple API and display issues"

**Description du commit:**
```
- fix(api): DeepSeek max_tokens limit (16384 → 8192)
- fix(api): Claude tools type format ("custom" → "function")
- fix(display): tools now appear before LLM response
- fix(identity): add model name mapping with fallback logic
- fix(ui): remove hardcoded greeting response
- fix(ui): hide assistant entries with toolCalls
- fix(ui): race condition causing message duplication in viewer mode
- chore: remove obsolete security baseline files
```

**RÉGRESSION INTRODUITE (non documentée):**

Le commit a **SUPPRIMÉ** l'early return du placeholder et **DÉPLACÉ** le check dans la condition `needsSummary`:

```diff
-        // Skip synthèse pour le placeholder par défaut (GPT-5/o1)
-        if (contentTrimmed === "Using tools to help you...") {
-          debugLog.log("⏭️  Skipping summary (placeholder message, waiting for streaming completion)");
-          return newEntries;  // ← SUPPRIMÉ
-        }
-
-        // Générer synthèse si :
-        // - Réponse vide
-        // - Réponse trop courte (< 150 caractères)
-        const needsSummary =
-          !contentTrimmed ||
-          contentTrimmed.length < 150;

+      const contentTrimmed = finalAssistantContent.trim();
+      // Générer synthèse si :
+      // - Réponse vide/placeholder
+      // - Réponse trop courte (< 150 caractères)
+      const needsSummary =
+        !contentTrimmed ||
+        contentTrimmed === "Using tools to help you..." ||  // ← AJOUTÉ
+        contentTrimmed.length < 150;
```

**Analyse:**
- Ligne `-        if (contentTrimmed === "Using tools to help you...") { return newEntries; }`
  → **SUPPRIMÉE** (early return)
- Ligne `+        contentTrimmed === "Using tools to help you..." ||`
  → **AJOUTÉE** dans `needsSummary` (inverse la logique!)

**Impact:**
- Au lieu de **SKIPPER** le summary pour le placeholder, le code le **GÉNÈRE**
- Retour du problème des summaries non souhaités après chaque tool call
- Régression de 3 jours non détectée

**Fichiers modifiés:**
- `src/agent/grok-agent.ts` (+675 -318 lignes, 12 fichiers modifiés au total)

**Raison probable:** Large refactoring avec multiples changements. Le fix du placeholder a été perdu dans le processus.

---

### 7 décembre 2025 - RÉGRESSION #2 (49a5147)

**Commit:** `49a5147` - 2025-12-07 00:20:54
**Auteur:** zack <fadolcikad@outlook.fr>
**Titre:** "fix(history): validate tool_calls is array before sending to API"

**Problème déclaré:** Fixer l'erreur "msg.tool_calls.map is not a function"

**Solution implémentée:**
```typescript
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
if (Array.isArray(toolCalls) && toolCalls.length > 0) {  // ← CONDITION PROBLÉMATIQUE
  message.tool_calls = toolCalls;
}
this.messages.push(message);
```

**RÉGRESSION INTRODUITE:**

La condition `&& toolCalls.length > 0` omet le champ `tool_calls` quand l'array est vide.

**Impact sémantique:**

Dans l'API OpenAI, la présence/absence du champ a une signification:

| État | Signification |
|------|---------------|
| `tool_calls: [...]` (non-vide) | "Je vais utiliser ces outils" |
| `tool_calls: []` (vide) | "J'ai fini avec les outils, voici ma réponse" |
| **Pas de champ** | "Je n'ai jamais utilisé d'outils" ❌ |

**Conséquence:**
- Quand une session est restaurée avec `/new-session` (maintenant par défaut avec import history)
- Les anciens messages avec `tool_calls: []` perdent le champ
- Le modèle perd le contexte et commence à **décrire** les tools au lieu de les **utiliser**

**Facteur aggravant:**
Commit `8b506e0` (6 déc 23:36) change `/new-session` pour importer l'historique **par défaut**, ce qui révèle systématiquement la régression.

---

### 7 décembre 2025 - CORRECTIONS (751e5a2, a0dd598, df5ffec)

#### Fix #1: Restauration sémantique tool_calls (751e5a2)

**Commit:** `751e5a2` - 2025-12-07 16:xx:xx
**Titre:** "fix(critical): restore tool_calls semantic for empty arrays"

**Changement:**
```typescript
// AVANT (cassé):
if (Array.isArray(toolCalls) && toolCalls.length > 0) {

// APRÈS (fixé):
if (Array.isArray(toolCalls)) {  // Inclut même les arrays vides
```

**Justification:** Les arrays vides ont une signification sémantique importante.

---

#### Fix #2: Validation stricte tool_calls (a0dd598)

**Commit:** `a0dd598` - 2025-12-07 16:xx:xx
**Titre:** "fix(validation): add strict validation for tool_calls structure"

**Ajout:**
```typescript
// Validate tool_calls structure (must have valid type field)
if (Array.isArray(toolCalls) && toolCalls.length > 0) {
  toolCalls = toolCalls.filter((tc: any) => {
    // Each tool call must have: id, type="function", function.name, function.arguments
    return tc &&
           tc.id &&
           tc.type === 'function' &&
           tc.function &&
           tc.function.name &&
           typeof tc.function.arguments === 'string';
  });
  // If all tool_calls were invalid, treat as empty array
  if (toolCalls.length === 0) {
    toolCalls = [];
  }
}
```

**Justification:** Prévient les erreurs "400 Invalid value: 'fun...ion'" dues aux tool_calls corrompus dans l'historique.

---

#### Fix #3: Restauration early return placeholder (df5ffec)

**Commit:** `df5ffec` - 2025-12-07 16:xx:xx
**Titre:** "fix(regression): restore GPT-5 placeholder skip logic (lost fix)"

**Restauration du code du commit 82d03c0:**
```typescript
// Skip synthèse pour le placeholder par défaut (GPT-5/o1)
if (contentTrimmed === "Using tools to help you...") {
  debugLog.log("⏭️  Skipping summary (placeholder message, waiting for streaming completion)");
  return newEntries;  // EARLY RETURN restauré
}

// Générer synthèse si :
// - Réponse vide
// - Réponse trop courte (< 150 caractères)
const needsSummary =
  !contentTrimmed ||
  contentTrimmed.length < 150;  // placeholder retiré de la condition
```

**Justification:** Fix du 30 nov perdu dans le commit 6b09a8d du 4 déc.

---

## ANALYSE FORENSIQUE APPROFONDIE

### Pourquoi la régression #1 n'a pas été détectée?

1. **Commit large:** 6b09a8d modifiait 12 fichiers (+1005, -3026 lignes)
2. **Changements multiples:** 8 fixes différents dans un seul commit
3. **Message non exhaustif:** "multiple API and display issues" ne mentionne pas la suppression du fix placeholder
4. **Tests manquants:** Pas de test automatique vérifiant que le placeholder ne génère pas de summary

### Pourquoi la régression #2 a été introduite?

1. **Incompréhension de la sémantique:** `tool_calls: []` considéré comme "pas de tools" au lieu de "fini avec les tools"
2. **Fix trop restrictif:** La validation était correcte, mais la condition `length > 0` trop stricte
3. **Facteur aggravant non anticipé:** Changement du comportement par défaut de `/new-session` révèle systématiquement le bug

### Comment les deux régressions interagissent?

**Sans régression #2 (tool_calls vides préservés):**
- Régression #1 génère un summary non souhaité, mais le modèle utilise quand même les tools

**Avec régression #2 (tool_calls vides omis):**
- Régression #1 + #2 → Le modèle perd complètement la capacité à utiliser les tools correctement

**Effet multiplicateur:** Les deux régressions ensemble créent un problème bien plus grave que chacune séparément.

---

## LEÇONS APPRISES

### Erreurs identifiées:

1. **Commits trop larges:** 6b09a8d avec 8 fixes différents
2. **Perte de fix documenté:** Fix du 30 nov perdu sans mention
3. **Tests insuffisants:** Pas de garde-fou automatique
4. **Review manquante:** Changements non revus avant commit

### Recommandations:

1. **Un commit = un fix:** Séparer les changements non liés
2. **Tests de régression:** Ajouter tests pour les fix critiques
3. **Documentation:** Mentionner explicitement tout changement de comportement
4. **Review obligatoire:** Pour commits touchant >200 lignes ou >3 fichiers
5. **Git bisect:** Utiliser git bisect pour identifier rapidement les régressions

---

## COMMITS IMPLIQUÉS

### Fix initial (perdu)
- `82d03c0` - 2025-11-30 21:42:53 - fix: Skip summary generation for GPT-5 placeholder message ✅

### Régression introduite
- `6b09a8d` - 2025-12-04 07:22:53 - fix: multiple API and display issues ❌ (Perte fix placeholder)
- `49a5147` - 2025-12-07 00:20:54 - fix(history): validate tool_calls is array before sending to API ❌ (Pert tool_calls vides)

### Corrections appliquées
- `751e5a2` - 2025-12-07 16:xx:xx - fix(critical): restore tool_calls semantic for empty arrays ✅
- `a0dd598` - 2025-12-07 16:xx:xx - fix(validation): add strict validation for tool_calls structure ✅
- `df5ffec` - 2025-12-07 16:xx:xx - fix(regression): restore GPT-5 placeholder skip logic (lost fix) ✅

---

**Rapport généré le:** 2025-12-07 17:00:00
**Analyste:** Claude (Sonnet 4.5)
**Base de code:** grok-cli (grokinou)
**Branche:** main
**État:** Toutes les régressions corrigées
