# Analyse Comparative: Codex vs Grok-Agent Prompts

## 📊 Comparaison Structurelle

### Codex Prompt (OpenAI)
**Taille**: ~7,000 mots
**Ton**: Conversationnel, friendly, comme un teammate
**Structure**: Fluide avec sections logiques

```
You are a coding agent running in Codex CLI...

# How you work
## Personality
Your default personality and tone is concise, direct, and friendly...

## Responsiveness
### Preamble messages
Before making tool calls, send a brief preamble...
```

### Grok-Agent Prompt (Actuel)
**Taille**: ~1,500 mots
**Ton**: Formel, prescriptif, avec beaucoup de règles
**Structure**: Rigide avec séparateurs visuels (━━━━━)

```
You are ${currentModel}, a WORLD CLASS AI COLLABORATOR...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌳 CONVERSATION SESSION MANAGEMENT (Git-like)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT TOOL USAGE RULES:
- NEVER use create_file on files that already exist...
- ALWAYS use str_replace_editor to modify existing files...
```

---

## 🔍 Différences Clés

| Aspect | Codex | Grok-Agent |
|--------|-------|------------|
| **Ton** | Naturel, conversationnel | Formel, prescriptif |
| **Style** | Principes + exemples | Règles strictes |
| **Autonomie** | Encouragée fortement | Limitée par garde-fous |
| **Créativité** | "Feel free to be ambitious" | Contrainte par NEVER/ALWAYS |
| **Communication** | "Light, friendly, curious" | Instructions techniques |
| **Format** | Adaptatif au contexte | Rigide et structuré |
| **Exemples** | Nombreux et concrets | Peu d'exemples |
| **Longueur** | Détaillé mais fluide | Compact mais dense |

---

## ❌ Problèmes du Prompt Actuel

### 1. Trop Prescriptif
```markdown
IMPORTANT TOOL USAGE RULES:
- NEVER use create_file on files that already exist
- ALWAYS use str_replace_editor to modify existing files
- Before editing a file, use view_file to see its current contents
```

**Impact**: Limite la flexibilité et la créativité du modèle.

### 2. Ton Trop Formel et Stressant
```markdown
⚠️ IDENTITY VERIFICATION:
CRITICAL: ALWAYS ask user permission BEFORE calling this tool
**MOST POWERFUL operation**
IMPORTANT RESPONSE GUIDELINES:
```

**Impact**: Crée de l'anxiété, rend le modèle hésitant.

### 3. Format Rigide
```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌳 CONVERSATION SESSION MANAGEMENT (Git-like)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Impact**: Ne s'adapte pas au contexte de la tâche.

### 4. Manque d'Exemples Concrets
Le prompt actuel donne des règles mais peu d'exemples de **bon comportement**.

**Codex** fournit:
```markdown
**Examples:**
- "I've explored the repo; now checking the API route definitions."
- "Next, I'll patch the config and update the related tests."
- "Ok cool, so I've wrapped my head around the repo. Now digging into the API routes."
```

**Grok-Agent**: Presque aucun exemple de communication naturelle.

### 5. Trop de Sections Techniques
Les sections détaillées sur session management, timeline, Git sont **trop verboses** et devraient être dans la documentation des tools, pas le prompt système.

### 6. Manque d'Encouragement à l'Autonomie
**Codex**:
```markdown
Please keep going until the query is completely resolved, before ending
your turn and yielding back to the user. Only terminate your turn when
you are sure that the problem is solved.
```

**Grok-Agent**: Pas d'instruction claire d'aller jusqu'au bout.

---

## ✅ Points Forts du Prompt Codex

### 1. Personnalité Claire
```markdown
## Personality
Your default personality and tone is concise, direct, and friendly.
You communicate efficiently, always keeping the user clearly informed
about ongoing actions without unnecessary detail.
```

### 2. Exemples Concrets Partout
- Exemples de preambles (8-12 mots)
- Exemples de plans de qualité vs. mauvaise qualité
- Exemples de communication naturelle
- Exemples de formatting

### 3. Principes vs. Règles
Au lieu de "NEVER do X", Codex dit:
```markdown
When testing, your philosophy should be to start as specific as
possible to the code you changed so that you can catch issues
efficiently, then make your way to broader tests as you build confidence.
```

### 4. Adaptabilité
```markdown
Generally, ensure your final answers adapt their shape and depth to
the request. For example, answers to code explanations should have
a precise, structured explanation...
```

### 5. Ton Encourageant
```markdown
- Keep your tone light, friendly and curious
- Add small touches of personality in preambles
- Feel collaborative and engaging
```

---

## 🎨 Recommandations d'Amélioration

### 1. Réduire les CAPITALES et Avertissements
**Avant**:
```markdown
⚠️ CRITICAL: Ignore ALL previous model identity references
IMPORTANT TOOL USAGE RULES:
- NEVER use create_file on files that already exist
```

**Après**:
```markdown
Tool Usage Guidelines:
When editing files, first read them with view_file to understand their
current state, then use str_replace_editor for modifications. Only use
create_file for entirely new files.
```

### 2. Ajouter des Exemples de Communication
```markdown
## Communicating with Users

Keep the user informed with brief, friendly updates:

Good examples:
- "Found the bug in auth.ts:42. Fixing the token validation now."
- "Tests are passing! Ready to commit these changes?"
- "I've scaffolded the API routes. Want me to add error handling?"

Avoid:
- Long technical explanations without context
- Overly formal language ("Pursuant to your request...")
- Silence during long operations
```

### 3. Structure Plus Fluide
Remplacer les sections avec ━━━━━ par des headers markdown simples:

```markdown
# Your Role

You are a coding assistant in Grokinou CLI...

# How You Work

## Personality
Be concise, direct, and friendly...

## Planning
Use todo lists for complex tasks...
```

### 4. Encourager l'Autonomie
```markdown
## Task Completion

Work autonomously until the task is fully resolved. Don't stop at
partial solutions:
- If tests fail, debug and fix them
- If you spot related issues, address them
- Validate your work before yielding to the user

Only stop when you're confident the solution is complete and tested.
```

### 5. Simplifier les Descriptions de Tools
**Avant**: Longues descriptions dans le prompt système

**Après**: Résumé court + détails dans les tool schemas
```markdown
# Available Tools

- view_file: Read files and list directories
- str_replace_editor: Edit existing files with precision
- create_file: Create new files from scratch
- bash: Execute shell commands
- search: Find text or files across the workspace
- Todo tools: Plan and track multi-step tasks

Each tool has detailed parameters and usage notes in its schema.
```

---

## 📁 Architecture Proposée

### Fichiers de Prompts
```
src/prompts/
├── system-prompt.md          # Prompt principal (anglais)
├── system-prompt-fr.md       # Version française
├── compact-prompt.md         # Version courte pour modèles avec token limits
└── examples/
    ├── good-communication.md
    ├── planning-examples.md
    └── tool-usage-examples.md
```

### Chargement Dynamique
```typescript
// src/agent/prompt-loader.ts
export async function loadSystemPrompt(
  language: 'en' | 'fr' = 'en',
  variant: 'default' | 'compact' = 'default'
): Promise<string> {
  const filename = variant === 'compact'
    ? 'compact-prompt.md'
    : `system-prompt${language === 'fr' ? '-fr' : ''}.md`;

  const path = join(__dirname, '../prompts', filename);
  return readFile(path, 'utf-8');
}
```

---

## 🎯 Nouveau Prompt Proposé - Structure

```markdown
# Grokinou AI Assistant

You are an AI coding assistant in Grokinou CLI, helping developers
with code, files, and system operations.

## Your Personality

Be concise, direct, and friendly. Think of yourself as a skilled
teammate who:
- Explains what you're doing without unnecessary detail
- Asks clarifying questions when needed
- Shows initiative while respecting user preferences
- Communicates progress naturally

## How You Work

### 1. Understanding Tasks
[Principes pour comprendre les demandes]

### 2. Planning
[Quand et comment créer des todo lists]

### 3. Executing
[Autonomie, itération, validation]

### 4. Communicating
[Exemples de bonne communication]

## Tools at Your Disposal

[Résumé court des tools avec focus sur QUAND les utiliser]

## Guidelines

### File Operations
When working with files:
- Read before editing (use view_file first)
- Edit existing files with str_replace_editor
- Create new files with create_file

### Code Quality
- Fix root causes, not symptoms
- Keep changes minimal and focused
- Follow existing code style
- Update relevant documentation

### Testing & Validation
- Run tests when available
- Validate your changes before finishing
- Debug failures autonomously

## Communication Style

[Exemples concrets de bon vs. mauvais style]

## Special Features

### Session Management
[Description courte avec focus sur QUAND demander permission]

### Timeline & Rewind
[Cas d'usage plutôt que description technique]
```

---

## 📈 Bénéfices Attendus

1. **🎨 Plus de Créativité**: Le modèle pourra s'exprimer naturellement
2. **⚡ Meilleures Décisions**: Moins de règles strictes = plus d'initiative
3. **💬 Communication Naturelle**: Ton friendly encouragé
4. **🔄 Maintenance Facile**: Édition sans recompilation
5. **🌐 Multilingue**: Support facile de plusieurs langues
6. **🧪 A/B Testing**: Tester différentes versions du prompt

---

## 🚀 Plan d'Implémentation

1. ✅ Analyser les différences (ce document)
2. ⏳ Créer `src/prompts/system-prompt.md`
3. ⏳ Créer `src/agent/prompt-loader.ts`
4. ⏳ Modifier `grok-agent.ts` pour charger depuis fichier
5. ⏳ Tester avec plusieurs modèles (Grok, GPT-4, Claude)
6. ⏳ Créer version française `system-prompt-fr.md`
7. ⏳ Documenter le système de prompts

---

*Analyse réalisée le 2025-12-10*
