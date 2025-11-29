# 🤖 Guide de Clarification Proactive pour LLM Tools

## 📋 **Vue d'Ensemble**

Ce document explique l'approche de **clarification proactive** utilisée dans `grokinou-cli` pour éviter les erreurs d'utilisation des outils par les LLMs.

---

## 🎯 **Principe Fondamental**

Quand **deux outils similaires mais distincts** peuvent répondre à une requête utilisateur, le LLM doit:

1. ✅ **Détecter l'ambiguïté** dans la requête utilisateur
2. ✅ **Expliquer les deux options** avec leurs différences
3. ✅ **Demander confirmation** à l'utilisateur
4. ✅ **Choisir l'outil approprié** en fonction de la réponse

---

## 🔍 **Cas d'Usage: `session_new` vs `rewind_to`**

### **Problème Identifié**

L'utilisateur peut demander:
> "Crée une nouvelle session avec le code d'hier"

**Ambiguïté:**
- Veut-il **cloner l'état actuel** dans une nouvelle session? → `session_new`
- Veut-il **remonter au code exact d'hier** via event sourcing? → `rewind_to`

### **Solution: Descriptions Enrichies**

Les deux outils ont maintenant des descriptions qui:

#### **1. Se Référencent Mutuellement**

```typescript
// Dans session_new:
┌───────────────────────────────────────────┐
│ 📁 session_new (THIS TOOL)                │
│ BEST FOR: Current state operations        │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│ ⏰ rewind_to (ALTERNATIVE)                │
│ BEST FOR: Past state recovery             │
└───────────────────────────────────────────┘
```

#### **2. Demandent Explicitement Confirmation**

```
🔴 MANDATORY: ASK USER BEFORE PROCEEDING:

"I can help you create a new session. There are TWO approaches:

1️⃣ **Simple Session** (session_new):
   ✓ Current state only
   ✓ Simple Git clone
   ✗ No time travel

2️⃣ **Time Machine** (rewind_to):
   ✓ Past state recovery
   ✓ Event sourcing
   ✗ Requires timestamp

Which approach do you need?"
```

#### **3. Incluent des Templates de Questions**

Le LLM sait exactement quoi demander:
- Type d'opération (current vs past)
- Options spécifiques (gitMode, autoCheckout, etc.)
- Confirmation de permission

---

## 📊 **Workflow de Décision**

```mermaid
graph TD
    A[User Request: "Create session"] --> B{LLM Reads Tool Descriptions}
    B --> C{Ambiguous Intent?}
    C -->|Yes| D[LLM Asks Clarification]
    C -->|Clear| E[LLM Proceeds]
    D --> F[User Clarifies]
    F --> G{Current or Past State?}
    G -->|Current| H[Use session_new]
    G -->|Past| I[Use rewind_to]
    H --> J[Execute with Params]
    I --> K[Get Timestamp + Options]
    K --> J
```

---

## ✅ **Avantages de cette Approche**

### **1. Évite les Erreurs**
- ❌ Avant: LLM devine et utilise le mauvais outil
- ✅ Après: LLM demande et choisit le bon outil

### **2. Éduque l'Utilisateur**
L'utilisateur découvre:
- Les deux outils disponibles
- Leurs capacités et limitations
- Quand utiliser chacun

### **3. Améliore la Précision**
- L'utilisateur comprend ce qui va se passer
- Il peut ajuster sa demande si nécessaire
- Moins de tentatives inutiles

### **4. Garantit le Consentement**
- Pour les opérations puissantes (`rewind_to`), permission explicite
- Audit trail clair (user a confirmé X avec options Y)

---

## 🛠️ **Implémentation: Anatomie d'une Description**

### **Structure Recommandée**

```typescript
{
  name: "tool_name",
  description: `
⚠️ CRITICAL: Before using, ASK USER to clarify!

═══════════════════════════════════════════
TWO TOOLS AVAILABLE - Ask user to choose:
═══════════════════════════════════════════

┌─────────────────────────────────────────┐
│ 🔧 THIS TOOL - Primary Use Case         │
│ BEST FOR: [use cases]                   │
│ FEATURES: [key features]                │
│ LIMITATIONS: [what it cannot do]        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🔨 ALTERNATIVE TOOL                     │
│ BEST FOR: [different use cases]         │
│ FEATURES: [different features]          │
│ LIMITATIONS: [different limitations]    │
└─────────────────────────────────────────┘

🔴 MANDATORY: ASK USER BEFORE PROCEEDING:

"[Template question explaining both options]

Which approach do you need?
• Option A → tool_name
• Option B → alternative_tool

Please confirm your choice."

PROCEED ONLY AFTER USER CONFIRMS.
  `,
  parameters: { ... }
}
```

---

## 📈 **Évolution Future**

### **Autres Paires d'Outils à Clarifier**

1. **`session_switch` vs `session_new`**
   - Switch: Change de session existante
   - New: Crée nouvelle session
   - Ambiguïté: "Je veux travailler dans un autre dossier"

2. **`timeline_query` vs `list_time_points`**
   - Query: Recherche détaillée d'événements
   - List: Liste simple de snapshots disponibles
   - Ambiguïté: "Montre-moi l'historique"

3. **`rewind_to` vs `session_rewind`**
   - rewind_to: Event sourcing complet (timeline.db)
   - session_rewind: Git rewind simple (conversations.db + Git)
   - Ambiguïté: "Reviens à hier"

### **Pattern Général**

Pour toute **paire d'outils avec overlap fonctionnel**:

1. Identifier les **cas d'usage distincts**
2. Créer des **descriptions croisées**
3. Ajouter des **templates de questions**
4. Définir des **conditions de proceed**

---

## 🎓 **Lessons Learned**

### **Ce qui Fonctionne**

✅ **Symboles visuels**: Les emojis et tableaux attirent l'attention du LLM

✅ **Instructions explicites**: `MANDATORY`, `CRITICAL`, `PROCEED ONLY AFTER`

✅ **Templates de questions**: Le LLM sait exactement quoi dire

✅ **Comparaisons côte-à-côte**: Facilite la compréhension des différences

### **Ce qui Ne Marche Pas**

❌ **Descriptions vagues**: "Use this for general purpose session management"

❌ **Absence de contexte**: Ne pas mentionner l'outil alternatif

❌ **Pas de guidance**: Laisser le LLM deviner quand utiliser quoi

❌ **Trop de texte**: LLM peut manquer les instructions critiques

---

## 🔐 **Sécurité et Audit**

### **Traçabilité**

Quand un LLM demande confirmation:

1. **Log de la question**: Stocké dans timeline.db comme événement `LLM_CLARIFICATION`
2. **Log de la réponse**: Réponse user avec choix confirmé
3. **Log de l'exécution**: Outil utilisé + paramètres

### **Chain of Custody**

```
Event 1: USER_MESSAGE: "Crée session avec code d'hier"
Event 2: LLM_CLARIFICATION: "Two approaches: session_new vs rewind_to"
Event 3: USER_RESPONSE: "Je veux rewind_to, hier 15h"
Event 4: TOOL_CALL: rewind_to(targetTimestamp="2025-11-12T15:00:00Z")
Event 5: REWIND_COMPLETED: Success, outputDir="/path/to/rewinded"
```

Permet de **prouver** que:
- Le LLM a demandé confirmation ✅
- L'utilisateur a explicitement choisi ✅
- L'opération était intentionnelle ✅

---

## 📚 **Références**

- **Tool Definitions**: `/home/zack/GROK_CLI/grok-cli/src/grok/tools.ts`
- **Rewind Features**: `/home/zack/GROK_CLI/grok-cli/REWIND_FEATURES.md`
- **New Session Features**: `/home/zack/GROK_CLI/grok-cli/NEW_SESSION_FEATURES.md`
- **Timeline Architecture**: `/home/zack/GROK_CLI/grok-cli/src/timeline/README.md`

---

## 🎯 **Conclusion**

L'approche de **clarification proactive** transforme les LLM tools de:

```
❌ "Je devine ce que tu veux et j'espère avoir raison"
```

En:

```
✅ "Voici deux options. Laquelle correspond à ton besoin?"
```

**Résultat:**
- ✅ Moins d'erreurs
- ✅ Meilleure expérience utilisateur
- ✅ Opérations plus sûres
- ✅ Audit trail complet

---

**Version:** 1.0.0  
**Date:** 2025-11-13  
**Auteur:** Zack (avec Claude Sonnet 4.5)
