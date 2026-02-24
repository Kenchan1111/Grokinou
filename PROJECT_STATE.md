# Grokinou - État du Projet

## Version Actuelle
- Version: 0.1.0
- Branche: main
- Package: @vibe-kit/grokinou-cli

## Environnement
- Node.js: 18+
- TypeScript: 5.x
- SQLite: better-sqlite3

## Services/Dépendances Externes
- OpenAI API
- Anthropic API
- xAI API (Grok)
- DeepSeek API
- Mistral API
- Morph API (Fast Apply)

## Configuration Claude Code

### Skills Installés
| Skill | Description |
|-------|-------------|
| `/build-and-test` | Compile TypeScript et lance les tests |
| `/tdd-cycle` | Cycle TDD complet (Red-Green-Refactor) |
| `/security-scan` | Audit sécurité du code |
| `/debug-trace` | Analyse et résolution de bugs |
| `/feature-dev` | Développement feature end-to-end |
| `/code-review` | Review multi-perspective |

### MCP Servers Recommandés
- GitHub - Gestion PRs, issues
- Sequential Thinking - Tâches complexes
- Memory - Persistance contexte

### Fichiers de Configuration
- `CLAUDE.md` - Instructions projet
- `PROJECT_STATE.md` - État actuel (ce fichier)
- `SESSION_LOG.md` - Historique sessions
- `.claude/skills/` - Skills personnalisés

## Bugs Connus
- [ ] Page Up keyboard bug en split view (scroll les deux panels au lieu du panel focus)

## Dernières Modifications
- 2026-01-30: Configuration environnement développement complet
  - Création CLAUDE.md avec skills et MCP
  - Création 6 skills production-ready
  - Mise en place PROJECT_STATE.md et SESSION_LOG.md
