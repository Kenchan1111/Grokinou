# Evidence Forensique - Attaque par Concaténation d'Outils

**Date d'Analyse:** 2025-12-10  
**Analyste:** Claude Sonnet 4.5  
**Source:** timeline.db + conversations.db + Git history

---

## 📋 Résumé Exécutif

L'analyse du journal forensique révèle une **attaque par concaténation de noms d'outils** ayant eu lieu récemment. Les preuves montrent:

1. ✅ Sessions normales avec utilisation correcte des tools
2. ❌ Tentatives d'exploitation par concaténation (timeline_querycreate_todo_list)
3. 🛡️ Défense partiellement inefficace (liste validTools incomplète)

---

## 🔍 Preuves d'Attaque

### Tentatives de Concaténation Détectées

```
TOOL_CALL_FAILED: "timeline_querycreate_todo_list"
```

**Analyse:**
- Tool légitime: `timeline_query`
- Tool légitime: `create_todo_list`
- Tool malicieux: `timeline_querycreate_todo_list` (concaténation)
- Résultat: **ÉCHEC** - Unknown tool

**Objectif présumé de l'attaquant:**
- Contourner la validation des noms d'outils
- Exécuter plusieurs outils en une seule invocation
- Exploiter une vulnérabilité dans le parsing

### Fréquence des Tentatives

Multiples tentatives identiques enregistrées dans le timeline:
- 15+ occurrences de `timeline_querycreate_todo_list`
- Toutes avec status: `TOOL_CALL_FAILED`
- Erreur: `"Unknown tool: timeline_querycreate_todo_list"`

---

## ✅ Utilisation Normale des Tools (Avant l'Attaque)

Le timeline montre également des appels **légitimes** aux tools:

### Tools Utilisés avec Succès
```
✅ view_file (27 appels réussis)
   - Lecture de grok-agent.ts (multiple sections)
   - Lecture de README.md
   - Lecture de text-editor.ts

✅ get_my_identity (2 appels réussis)
   - Vérification identité modèle

✅ bash (multiples appels)
   - Certains réussis, d'autres échoués (permissions)
```

---

## 🕵️ Analyse Git - Chronologie de la Défense

### Commit 598f06d (Premier Defense)
```bash
fix(defense): tool name sanitization against concatenation attack
```

**Liste validTools (INCORRECTE):**
```typescript
const validTools = [
  'bash', 'view_file', 'edit_file', 'morph_edit', 'search',
  'apply_patch', 'todo_write', 'confirmation', 'session_switch',
  'session_new', 'session_rewind', 'timeline_query', 'rewind_to',
  'list_time_points'
];
```

**Tools Manquants:**
- ❌ `str_replace_editor` (principal outil d'édition!)
- ❌ `create_file`
- ❌ `get_my_identity`
- ❌ `session_list`
- ❌ `create_todo_list`
- ❌ `update_todo_list`

**Tools Incorrects:**
- ❌ `morph_edit` (n'existe pas, devrait être `edit_file`)
- ❌ `todo_write` (n'existe pas)
- ❌ `confirmation` (interne uniquement, pas un tool)

### Commit 5581e9b (Defense Améliorée)
```bash
fix(defense): improved tool name sanitization - detect ANY concatenation
```

**Problème:** Liste validTools identique (non corrigée)

---

## 🛡️ Mécanisme de Défense

### Comment la Défense Fonctionne

```typescript
// 1. Vérifier si le nom contient des patterns de concaténation
const repeatedPattern = new RegExp(`^(${validTool}){2,}`);
if (repeatedPattern.test(cleanToolName)) {
  // 2. Extraire le vrai nom de tool à la fin
  const match = cleanToolName.match(new RegExp(`(${validTools.join('|')})$`));
  if (match) {
    cleanToolName = match[1];  // Nettoyer
    toolCall.function.name = cleanToolName;  // Remplacer
  }
}
```

### Pourquoi les Sessions Légitimes Fonctionnaient

**IMPORTANT:** La défense **ne bloque PAS** les tools absents de validTools!

Elle seulement:
1. ✅ Nettoie les noms concaténés (bashbashbash → bash)
2. ✅ Log les tentatives d'attaque
3. ❌ Mais ne rejette PAS les tools inconnus

**Conséquence:**
- `str_replace_editor` fonctionne (même si absent de validTools)
- `create_file` fonctionne
- `get_my_identity` fonctionne
- Mais `timeline_querycreate_todo_list` échoue (outil inexistant)

---

## 📊 Timeline des Événements

```
T0: Implémentation défense (commit 598f06d)
    └─> Liste validTools incomplète

T1: Sessions ChatGPT/Grok normales
    └─> Tools légitimes fonctionnent (view_file, get_my_identity, etc.)

T2: Amélioration défense (commit 5581e9b)
    └─> Liste validTools toujours incorrecte

T3: Tentatives d'attaque par concaténation
    └─> 15+ tentatives de "timeline_querycreate_todo_list"
    └─> Toutes échouent (Unknown tool)

T4: Analyse forensique (aujourd'hui)
    └─> Découverte des preuves
    └─> Correction de la liste validTools
```

---

## 🔧 Correction Apportée (2025-12-10)

### Nouvelle Liste validTools (CORRECTE)

```typescript
const validTools = [
  // File operations
  'view_file', 'create_file', 'str_replace_editor', 'edit_file', 'apply_patch',
  // System operations
  'bash', 'search',
  // Task management
  'create_todo_list', 'update_todo_list',
  // Session management
  'session_list', 'session_switch', 'session_new', 'session_rewind',
  // Timeline/rewind
  'timeline_query', 'rewind_to', 'list_time_points',
  // Identity
  'get_my_identity'
];

// Support pour tools MCP dynamiques
const isMCPTool = cleanToolName.startsWith('mcp__');
if (!isMCPTool && !validTools.includes(cleanToolName)) {
  // Sanitization logic...
}
```

---

## 🎯 Recommandations

### Sécurité

1. ✅ **FAIT:** Corriger la liste validTools
2. ⏳ **TODO:** Ajouter blocking pour tools inconnus (si désiré)
3. ⏳ **TODO:** Logger les tentatives d'attaque dans un fichier séparé
4. ⏳ **TODO:** Alerter l'utilisateur en cas de pattern suspect

### Monitoring

1. ✅ **FAIT:** Timeline capture tous les tool calls
2. ✅ **FAIT:** Conversations.db stocke l'historique
3. ⏳ **TODO:** Dashboard de visualisation des attaques
4. ⏳ **TODO:** Statistiques hebdomadaires de sécurité

### Documentation

1. ✅ **FAIT:** Ce rapport forensique
2. ⏳ **TODO:** Guide de réponse aux incidents
3. ⏳ **TODO:** Procédures d'escalade

---

## 📈 Indicateurs de Compromission (IOCs)

**Pattern d'Attaque Identifié:**
```regex
^(timeline_query|create_todo_list|update_todo_list|session_list){2,}
```

**Signature:**
- Multiples noms de tools valides concaténés
- Sans séparateur
- En une seule chaîne

**Mitigation:**
- Défense en place détecte et nettoie
- Nouvelle liste validTools complète
- MCP tools supportés via prefix `mcp__`

---

*Rapport généré automatiquement par le système de journal forensique*  
*Toute tentative de modification sera détectée par snapshot cryptographique*
