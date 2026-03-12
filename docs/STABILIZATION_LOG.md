# Grokinou Stabilization Log

Suivi chronologique détaillé de la stabilisation. Chaque session documente : ce qui a été fait, les problèmes rencontrés, comment ils ont été résolus, et l'état à la sortie.

---

## Session 2026-03-12 — Phase 1 completion + Stabilization kickoff

**Durée** : ~3h
**Commits** : `d99d556` → `1343347` (5 commits)
**Backlog version** : v1 → v2

---

### 1. Context Compactor Integration (B3.7 partiel)

**Horodatage** : 2026-03-12 ~14:00
**Commit** : `f366146`
**Fichiers modifiés** : `src/agent/grok-agent.ts`, `src/grok/client.ts`

**Objectif** : Câbler le ContextCompactor (créé en Phase 1 mais non intégré) dans la boucle agent.

**Ce qui a été fait** :
- Ajout de `getContextWindowSize()` public sur `GrokClient` (l'ancienne `getModelContextWindow()` était private)
- Ajout de `contextCompactor: ContextCompactor` comme propriété de `GrokAgent`, initialisé dans le constructeur
- Création de `maybeCompactContext()` — méthode appelée avant chaque `this.grokClient.chat()` :
  - Avant le premier appel (ligne ~635)
  - Avant chaque appel suivant dans la boucle tool (ligne ~745)
- Le summarizer utilise `this.grokClient.chat()` avec un message unique et sans tools

**Difficulté rencontrée** : Aucune difficulté technique. L'intégration était directe car le ContextCompactor avait été conçu avec une interface propre (messages in → messages out + stats).

**Point d'attention** : Le compactor modifie `this.messages` en place (remplacement du tableau). Cela fonctionne car JavaScript passe les tableaux par référence et le remplacement complet est atomique.

---

### 2. Tool Display Normalization (B1.3 + B1.6)

**Horodatage** : 2026-03-12 ~14:30
**Commit** : `f366146` (même commit que ci-dessus)
**Fichier modifié** : `src/ui/components/chat-history.tsx`

**Objectif** : Les 5 nouveaux atomic tools (read_file, write_file, edit_file_replace, glob_files, grep_search) affichaient "Tool" comme label générique dans le chat. Normaliser l'affichage pour tous les 22+ tools.

**Ce qui a été fait** :

#### a) `getToolActionName()` — Labels par tool (lignes 207-260)
- **Avant** : 7 cases (view_file, str_replace_editor, create_file, bash, search, create_todo_list, update_todo_list), tout le reste → "Tool"
- **Après** : 22+ cases couvrant tous les tools connus
- Atomic tools : `read_file` → "Read", `edit_file_replace` → "Edit", `write_file` → "Write", `glob_files` → "Glob", `grep_search` → "Grep"
- Session tools : `session_list` → "Sessions", `session_switch` → "Switch Session", etc.
- Timeline tools : `timeline_query` → "Timeline", `rewind_to` → "Rewind", etc.
- Autres : `delegate_to_specialist` → "Delegate", `apply_patch` → "Patch", `edit_file` → "Morph Edit"

**Difficulté** : Le `str_replace_editor` avait le label "Update" dans l'ancien code. Changé en "Edit" pour cohérence avec `edit_file_replace`. C'est un changement visible mais plus précis (c'est bien une édition, pas une mise à jour).

#### b) `shouldShowDiff` — Détection du diff pour preview (ligne ~307)
- **Avant** : uniquement `str_replace_editor` + condition `content.includes("Updated")`
- **Après** : `str_replace_editor` OU `edit_file_replace`, condition "Updated" retirée (car `edit_file_replace` retourne "Edited" pas "Updated"), remplacée par détection `---`/`+++` seule

**Difficulté** : La condition `content.includes("Updated")` était trop spécifique au legacy tool. L'atomic tool retourne `"Edited /path/to/file — replaced 1 occurrence"`. La détection par `---`/`+++` suffit pour identifier un diff.

#### c) `shouldShowFileContent` — Détection du contenu fichier (ligne ~313)
- **Avant** : `view_file` ou `create_file`
- **Après** : ajout `read_file` et `write_file`

#### d) `createCompactSummary()` — Résumés compacts (lignes 329-360)
- **Avant** : view_file/create_file → "✓ X lines", search → "✓ X matches", bash → truncation
- **Après** : ajout `grep_search` → "✓ X results", `glob_files` → "✓ X files found", `edit_file_replace`/`str_replace_editor` → première ligne du contenu (le résumé)

#### e) `getFilePath()` — Extraction du path/pattern pour affichage (lignes 267-283)
- **Avant** : seul `search` extrayait `args.query`
- **Après** : `search` + `search_advanced` + conversation searches → `args.query`, `grep_search` → `args.pattern`, `glob_files` → `args.pattern`

**Principe de non-régression** : Tous les changements sont des **extensions** des switch/if existants. Aucun case existant n'a été supprimé. Le seul changement fonctionnel est "Update" → "Edit" pour `str_replace_editor`.

---

### 3. Stabilization Backlog v2 (B0.x)

**Horodatage** : 2026-03-12 ~15:00
**Commit** : `f366146`
**Fichier** : `docs/GROKINOU_STABILIZATION_BACKLOG.md`

**Objectif** : Mettre à jour le backlog pour refléter les travaux effectués et réordonner les priorités.

**Ce qui a été fait** :
- Ajout section "Changelog v1 → v2"
- 7 tâches passées à `done` : B0.1, B0.2, B1.1, B1.2, B2.2, B2.5, F1
- 3 tâches passées à `in_progress` : B0.3, B2.1, B3.1
- 3 nouvelles tâches créées :
  - **B1.6** — Validate atomic tool display
  - **B2.6** — Define atomic vs legacy tool migration
  - **B3.7** — Validate context compactor in tool loops
- Top 10 réordonné pour prioriser la validation de ce qui vient d'être construit

**Choix de réordonnancement** : L'ancien top 10 de ChatGPT commençait par les tâches de cadrage (B0.1, B0.3, B1.1...) qui sont maintenant faites. Le nouveau top 10 commence par la validation des atomic tools et du compactor — logique "stabiliser ce qu'on vient de construire avant d'aller plus loin".

---

### 4. Atomic vs Legacy Tool Migration (B2.6)

**Horodatage** : 2026-03-12 ~16:00
**Commit** : `c6c4610`
**Fichiers modifiés** : `src/prompts/system-prompt.md`, `src/grok/tools.ts`

**Objectif** : Guider le LLM vers les atomic tools plutôt que les legacy, sans casser la rétrocompatibilité.

**Ce qui a été fait** :

#### a) System prompt (`src/prompts/system-prompt.md`)
- Section "Available Tools" restructurée en deux blocs :
  - **Primary Tools (prefer these)** : les 5 atomic + bash + task mgmt + session + delegation + identity
  - **Legacy Tools** : view_file → prefer read_file, str_replace_editor → prefer edit_file_replace, etc.
- "File Editing Guidelines" : workflow mis à jour (read_file → edit_file_replace → write_file)
- "Searching & Exploration" : grep_search + glob_files en premier, avec exemples concrets
- Référence `view_file` → `read_file` dans "Read before you write"
- Ajout de `delegate_to_specialist` (manquait totalement du system prompt)

#### b) Tool descriptions (`src/grok/tools.ts`)
- `view_file` : ajout `"Note: prefer read_file for new workflows."`
- `create_file` : ajout `"Note: prefer write_file for new workflows."`
- `str_replace_editor` : ajout `"Note: prefer edit_file_replace for new workflows."`
- `search` : description simplifiée + ajout `"for simple searches, prefer grep_search or glob_files"`

**Choix de design** : On aurait pu supprimer les legacy tools, mais cela briserait les sessions existantes et les workflows qui les référencent. La stratégie "soft deprecation" via les descriptions laisse le LLM choisir naturellement les atomic tools tout en gardant les legacy fonctionnels.

**Difficulté** : La description originale de `search` était très longue (3 lignes avec best practices). Simplifiée pour réduire le token overhead et diriger vers grep_search/glob_files.

---

### 5. Context Compactor Hardening (B3.7)

**Horodatage** : 2026-03-12 ~16:30
**Commit** : `1343347`
**Fichier modifié** : `src/agent/grok-agent.ts`

**Objectif** : Valider la robustesse du compactor dans la boucle agent.

**Analyse effectuée** :
1. **Préservation des paires tool_call/tool_result** : `adjustSplitForToolPairs()` vérifié — deux cas couverts (split tombe sur un tool result, ou le dernier message compacté est un assistant+tool_calls). Les deux cas avancent le split après tous les tool results liés.
2. **keepRecentMessages=10** : protège les messages récents. Même dans un round intense avec 5 tools en séquence, les 10 derniers messages (incluant les tool results) sont préservés intacts.
3. **Compaction mid-loop** : quand `maybeCompactContext()` est appelé dans la boucle tool (ligne ~745), les messages ajoutés dans le round courant sont récents et ne seront pas compactés (car `keepRecentMessages=10` et un round typique ajoute 2-6 messages).

**Problèmes identifiés et corrigés** :

#### a) Pas de try/catch — crash potentiel
- **Problème** : Si le summarizer échoue (timeout réseau, erreur API, rate limit), l'exception propagée crashait la boucle agent entière
- **Fix** : Enveloppé tout `maybeCompactContext()` dans un try/catch. En cas d'erreur, log warning et continue normalement

#### b) Pas de feedback utilisateur
- **Problème** : La compaction se faisait silencieusement — l'utilisateur ne savait pas pourquoi la réponse prenait plus de temps
- **Fix** : Ajout de `emitCOT("action", ...)` quand la compaction se déclenche, et `emitCOT("observation", ...)` avec les stats après succès. Visible dans l'Execution Viewer.

#### c) Erreur de méthode `addCOT` → `emitCOT`
- **Problème** : Build failure — `ExecutionStream` n'a pas de méthode `addCOT`, la bonne méthode est `emitCOT`
- **Fix** : Renommé les appels. Découvert via `npm run build`.

---

### 6. GitHub App Configuration

**Horodatage** : 2026-03-12 ~17:00
**Commits** : `4da7ddc`, `d509fc2`, `ab67998` (provenant du remote via `/install-github-app`)

**Ce qui a été installé** :
- `.github/workflows/claude.yml` — PR Assistant (`@claude` dans issues/PRs)
- `.github/workflows/claude-code-review.yml` — Auto code review sur chaque PR

**Analyse sécurité effectuée** :
- Permissions actuelles : lecture seule (contents, pull-requests, issues)
- Risques identifiés : injection via `@claude` dans commentaires publics, PAT en clair dans `.Gozen_grokinou` et git remote URL, supply chain via plugin marketplace
- **Action prise** : restriction de l'app GitHub à un seul repo (Grokinou) via Settings → Installations

**Difficulté** : Le `git push` a échoué car les commits GitHub App étaient sur le remote mais pas en local. Résolu par `git pull --rebase origin main` avant le push.

---

### État à la sortie de session

**Tâches du backlog complétées** :
- [x] B1.3 — Normalize tool result display
- [x] B1.6 — Validate atomic tool display
- [x] B2.6 — Define atomic vs legacy tool migration
- [x] B3.7 — Validate context compactor in tool loops

**Prochaines tâches (top 6 restant)** :
1. B1.4 — Validate session-switch UI consistency
2. B3.2 — Audit wrong-first-tool patterns
3. B3.3 — Improve search routing heuristics
4. B1.5 — Add interface smoke test list
5. B4.1 — Define golden workflows
6. B4.2 — Add startup tests

**Build status** : ✅ Clean
**Git status** : Pushed to origin/main, working tree clean (untracked files: Memory_Experiments/, chatgpt-context-files/, grokinou-daisy/)

---

### Commits de la session

| Hash | Message | Fichiers |
|------|---------|----------|
| `f366146` | feat(stabilization): context compactor integration + tool display normalization | grok-agent.ts, client.ts, chat-history.tsx, BACKLOG.md |
| `c6c4610` | feat(prompts): atomic tools migration — system prompt + tool descriptions | system-prompt.md, tools.ts |
| `1343347` | fix(agent): harden context compactor — try/catch + COT events | grok-agent.ts |
