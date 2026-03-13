# Grokinou CLI - Instructions Claude

## Projet
Grokinou est un CLI de développement assisté par IA, similaire à Claude Code. L'objectif est une implémentation complète, production-ready, pas un POC.

## Stack Technique
- TypeScript + Node.js (ESM)
- React + Ink (UI terminal)
- SQLite (better-sqlite3) pour persistence
- Multiple providers LLM (OpenAI, Anthropic, xAI, DeepSeek, Mistral)

## Structure Clé
- `src/agent/` - Agent principal et orchestration
- `src/tools/` - Implémentation des tools LLM
- `src/ui/` - Composants React/Ink
- `src/commands/` - Commandes utilisateur (slash commands)
- `src/db/` - Schéma et migrations SQLite
- `src/grok/` - Client et définitions tools
- `src/hooks/` - Hooks pour input/events

## Conventions de Code
- ESM modules (import/export, jamais require)
- Extension `.js` obligatoire dans les imports relatifs
- Fichiers TypeScript dans `src/`
- Build output dans `dist/`
- Tests avec les patterns existants

## Commandes Build
- `npm run build` - Compiler TypeScript
- `npm run dev` - Mode développement
- `npm test` - Lancer les tests

## Erreurs à Éviter
- Ne pas utiliser `require()` (projet ESM)
- Ne pas oublier `.js` dans les imports relatifs
- Toujours vérifier le build avant commit
- Pas de mocks ou stubs - code production uniquement
- Pas de POC - implémentations complètes

## Git Workflow
- Commits atomiques avec messages descriptifs
- Format: `type(scope): description`
- Types: feat, fix, docs, refactor, test

---

## MCP Servers Recommandés

### Installation des serveurs essentiels
```bash
# GitHub - Gestion PRs, issues, CI/CD
claude mcp add github -s user -- npx @anthropics/claude-mcp-github

# Sequential Thinking - Décomposition tâches complexes
claude mcp add sequential-thinking -s user -- npx @anthropics/claude-mcp-sequential-thinking

# Memory - Persistance contexte entre sessions
claude mcp add memory -s user -- npx @anthropics/claude-mcp-memory

# File System (si besoin accès étendu)
claude mcp add filesystem -s user -- npx -y @modelcontextprotocol/server-filesystem ~/Documents ~/Projects
```

### Commandes MCP utiles
- `claude mcp list` - Lister les serveurs
- `claude mcp remove <name>` - Supprimer un serveur
- `claude mcp get <name>` - Tester un serveur

### Note Performance
Ne pas activer trop de MCPs simultanément - cela réduit le contexte de 200k à ~70k tokens.

---

## Skills Disponibles

### Skills Projet (`.claude/skills/`)
- `/build-and-test` - Compile et lance les tests
- `/update-project-state` - Met à jour PROJECT_STATE.md
- `/tdd-cycle` - Cycle TDD complet (red-green-refactor)
- `/security-scan` - Audit sécurité du code
- `/debug-trace` - Analyse et résolution de bugs

### Skills Recommandés à Installer
Depuis [anthropics/skills](https://github.com/anthropics/skills):
- `skill-creator` - Créer de nouveaux skills
- `pdf` - Manipulation PDF
- `docx` - Génération documents Word

Depuis [wshobson/commands](https://github.com/wshobson/commands):
- `feature-development` - Développement feature end-to-end
- `full-review` - Review multi-perspective
- `smart-fix` - Résolution intelligente de problèmes

---

## Patterns de Développement

### Pour nouvelles features
1. Analyser le code existant avant modification
2. Suivre les patterns établis dans le codebase
3. Implémenter avec tests
4. Vérifier build avant commit

### Pour bug fixes
1. Reproduire le bug
2. Identifier la cause racine
3. Implémenter le fix minimal
4. Ajouter test de régression

### Pour refactoring
1. S'assurer que les tests passent
2. Refactorer par petites étapes
3. Vérifier tests après chaque étape

---

## Bugs Connus
- Aucun bug bloquant connu (Page Up et paste overflow résolus)

## Stabilisation en cours
- Backlog : `docs/GROKINOU_STABILIZATION_BACKLOG.md`
- Smoke test : `docs/SMOKE_TEST_CHECKLIST.md`
- Golden workflows : `docs/GOLDEN_WORKFLOWS.md`
- Tests : `test/startup.test.js` (17 tests), `test/user-commands.test.js`, `test/llm-tools.test.js`

## Fichiers de Référence
- `PROJECT_STATE.md` - État actuel du projet
- `SESSION_LOG.md` - Historique des sessions
- `package.json` - Dépendances et scripts
