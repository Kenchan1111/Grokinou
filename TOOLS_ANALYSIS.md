# 📋 TABLEAU DES TOOLS GROKINOU PAR CATÉGORIES

## 🛠️ TOOLS ACTUELS

### 📁 Gestion de Fichiers & Édition

| Tool | Description | Paramètres Clés | Use Case |
|------|-------------|-----------------|----------|
| `view_file` | Lire fichiers/répertoires | `path`, `start_line`, `end_line` | Lecture, navigation |
| `create_file` | Créer nouveau fichier | `path`, `content` | Création de fichiers |
| `str_replace_editor` | Rechercher/remplacer texte | `path`, `old_str`, `new_str`, `replace_all` | Éditions simples |
| `edit_file` ⚡ | Édition rapide Morph AI | `target_file`, `instructions`, `code_edit` | Éditions complexes (si MORPH_API_KEY) |
| `apply_patch` | Appliquer patch git | `patch`, `dry_run` | Éditions multi-fichiers |

### 🔍 Recherche & Navigation

| Tool | Description | Paramètres Clés | Use Case |
|------|-------------|-----------------|----------|
| `search` | Recherche unifiée texte/fichiers | `query`, `search_type`, `regex`, `file_types` | Recherche puissante dans le code |

### 💻 Exécution & Shell

| Tool | Description | Paramètres Clés | Use Case |
|------|-------------|-----------------|----------|
| `bash` | Exécuter commandes shell | `command` | npm, git, build, tests, etc. |

### 📋 Gestion de Projet

| Tool | Description | Paramètres Clés | Use Case |
|------|-------------|-----------------|----------|
| `create_todo_list` | Créer liste de tâches | `todos[]` (id, content, status, priority) | Planification |
| `update_todo_list` | Mettre à jour todos | `updates[]` (id, status, content, priority) | Tracking |

### 🔌 Extensibilité

| Tool | Description | Paramètres Clés | Use Case |
|------|-------------|-----------------|----------|
| MCP Tools | Tools dynamiques via MCP | Variable selon serveur | Extensions personnalisées |

---

## ❌ TOOLS MANQUANTS CRITIQUES

### 🗂️ Gestion de Fichiers Avancée

| Tool Manquant | Description | Importance | Justification |
|---------------|-------------|------------|---------------|
| `delete_file` | Supprimer fichier/répertoire | 🔴 HAUTE | Impossible de nettoyer, supprimer tests, fichiers obsolètes |
| `rename_file` | Renommer/déplacer fichier | 🔴 HAUTE | Refactoring, réorganisation de projet |
| `copy_file` | Copier fichier/répertoire | 🟡 MOYENNE | Dupliquer templates, backups |
| `list_directory` | Lister contenu d'un répertoire avec métadonnées | 🟡 MOYENNE | Actuellement via `view_file`, mais pas structuré |

**Impact :** Actuellement, pour supprimer/renommer, il faut utiliser `bash rm/mv`, ce qui est moins sûr et moins contrôlable.

---

### 🔍 Analyse de Code

| Tool Manquant | Description | Importance | Justification |
|---------------|-------------|------------|---------------|
| `get_definition` | Trouver définition d'un symbole | 🔴 HAUTE | Navigation code, comprendre structure |
| `get_references` | Trouver toutes les références | 🔴 HAUTE | Refactoring sûr, impact analysis |
| `get_symbols` | Lister symboles (classes, fonctions) | 🟡 MOYENNE | Vue d'ensemble du fichier |
| `get_diagnostics` | Récupérer erreurs TypeScript/ESLint | 🔴 HAUTE | Détection bugs avant exécution |
| `semantic_search` | Recherche sémantique (au-delà du texte) | 🟢 BASSE | Nice-to-have, améliore compréhension |

**Impact :** Sans ces tools, l'AI ne peut pas "voir" les erreurs de compilation ou naviguer intelligemment dans le code (comme Cursor/Copilot).

---

### 🧪 Tests & Validation

| Tool Manquant | Description | Importance | Justification |
|---------------|-------------|------------|---------------|
| `run_tests` | Exécuter tests (Jest, Vitest, pytest) | 🔴 HAUTE | Validation automatique des changements |
| `lint_file` | Linter un fichier spécifique | 🟡 MOYENNE | Qualité code |
| `format_file` | Formater avec Prettier/Black | 🟡 MOYENNE | Cohérence style |
| `type_check` | Vérifier types TypeScript | 🟡 MOYENNE | Sécurité types |

**Impact :** L'AI ne peut pas vérifier si ses modifications cassent des tests ou introduisent des erreurs de lint.

---

### 📦 Gestion de Dépendances

| Tool Manquant | Description | Importance | Justification |
|---------------|-------------|------------|---------------|
| `install_package` | Installer npm/pip/cargo package | 🟡 MOYENNE | Actuellement via `bash npm install` |
| `update_package` | Mettre à jour dépendances | 🟢 BASSE | Gestion sécurisée des versions |
| `list_packages` | Lister dépendances installées | 🟢 BASSE | Audit de dépendances |

**Impact :** Fonctionne via `bash`, mais pas de validation de version ou résolution de conflits.

---

### 🌐 Git Avancé

| Tool Manquant | Description | Importance | Justification |
|---------------|-------------|------------|---------------|
| `git_diff` | Voir diff staged/unstaged | 🔴 HAUTE | Actuellement via `bash git diff` non structuré |
| `git_log` | Historique commits structuré | 🟡 MOYENNE | Comprendre évolution code |
| `git_blame` | Voir qui a modifié quoi | 🟢 BASSE | Contexte historique |
| `git_checkout` | Changer de branche/commit | 🟡 MOYENNE | Navigation historique |
| `git_stash` | Sauvegarder changements temporaires | 🟢 BASSE | Workflow Git avancé |

**Impact :** Git fonctionne via `bash`, mais les résultats ne sont pas structurés (format JSON/objet) pour l'AI.

---

### 🔧 Refactoring Avancé

| Tool Manquant | Description | Importance | Justification |
|---------------|-------------|------------|---------------|
| `extract_function` | Extraire code en fonction | 🟡 MOYENNE | Refactoring propre |
| `inline_variable` | Inline une variable | 🟢 BASSE | Simplification code |
| `rename_symbol` | Renommer symbole partout | 🔴 HAUTE | Refactoring sûr (pas juste find/replace) |
| `move_symbol` | Déplacer classe/fonction vers autre fichier | 🟡 MOYENNE | Réorganisation architecture |

**Impact :** Ces opérations nécessitent analyse AST (Abstract Syntax Tree), impossible avec `str_replace_editor`.

---

### 📊 Monitoring & Introspection

| Tool Manquant | Description | Importance | Justification |
|---------------|-------------|------------|---------------|
| `get_memory_usage` | RAM/CPU du projet | 🟢 BASSE | Optimisation performance |
| `get_file_size` | Taille fichier/répertoire | 🟢 BASSE | Audit espace disque |
| `get_git_status` | Status Git structuré | 🟡 MOYENNE | Actuellement via `bash git status` |
| `get_env_vars` | Variables d'environnement | 🟢 BASSE | Debug configuration |

---

### 🗄️ Base de Données (Nouveau)

| Tool Manquant | Description | Importance | Justification |
|---------------|-------------|------------|---------------|
| `query_database` | Requête SQL directe | 🟡 MOYENNE | Grokinou utilise SQLite ! |
| `inspect_schema` | Voir structure BDD | 🟡 MOYENNE | Debug BDD |
| `migrate_database` | Appliquer migrations | 🟢 BASSE | Géré manuellement pour l'instant |

**Impact :** Actuellement, pour débugger SQLite, il faut passer par `bash sqlite3`, ce qui est verbeux.

---

### 🎨 UI/UX Développement

| Tool Manquant | Description | Importance | Justification |
|---------------|-------------|------------|---------------|
| `screenshot` | Capturer terminal/app | 🟢 BASSE | Debug UI |
| `open_browser` | Ouvrir URL dans navigateur | 🟢 BASSE | Tester web apps |

---

## 🎯 PRIORITÉS RECOMMANDÉES

### 🔴 PRIORITÉ 1 (Critique pour développement souple)

1. **`delete_file` / `rename_file`**  
   → Impossible de nettoyer/réorganiser sans passer par `bash`

2. **`get_diagnostics`**  
   → L'AI ne peut pas voir les erreurs TypeScript/ESLint en temps réel

3. **`git_diff` structuré**  
   → Essentiel pour comprendre les changements avant commit

4. **`run_tests`**  
   → Validation automatique des modifications

5. **`rename_symbol`**  
   → Refactoring sûr (analyse AST)

6. **`get_definition` / `get_references`**  
   → Navigation intelligente dans le code

---

### 🟡 PRIORITÉ 2 (Améliore productivité)

7. `lint_file` / `format_file`  
8. `query_database` (pour Grokinou spécifiquement)  
9. `git_log` structuré  
10. `extract_function` / `move_symbol`

---

### 🟢 PRIORITÉ 3 (Nice-to-have)

11. Outils de monitoring (`get_memory_usage`, etc.)  
12. `copy_file`  
13. `semantic_search`

---

## 💡 COMPARAISON AVEC CONCURRENTS

| Feature | Grokinou | Cursor | Aider | Continue |
|---------|----------|---------|-------|----------|
| **Édition fichiers** | ✅ Excellent | ✅ | ✅ | ✅ |
| **Delete/Rename** | ❌ Manquant | ✅ | ✅ | ✅ |
| **Diagnostics (LSP)** | ❌ Manquant | ✅ | ⚠️ Partiel | ✅ |
| **Run Tests** | ⚠️ Via bash | ✅ | ✅ | ✅ |
| **Git structuré** | ⚠️ Via bash | ✅ | ✅ | ✅ |
| **Refactoring AST** | ❌ Manquant | ✅ | ❌ | ⚠️ |
| **MCP Support** | ✅ | ❌ | ❌ | ⚠️ |
| **Multi-Provider** | ✅ | ⚠️ | ⚠️ | ✅ |

---

## 🚀 RECOMMANDATIONS FINALES

Pour avoir un **développement souple et fluide**, Grokinou devrait ajouter **en priorité** :

1. **`delete_file` / `rename_file`** → Opérations de base manquantes
2. **`get_diagnostics`** → Intégration LSP (Language Server Protocol) pour TypeScript/ESLint
3. **`git_diff` structuré** → Retour JSON au lieu de texte brut
4. **`run_tests`** → Validation automatique
5. **`rename_symbol`** → Refactoring intelligent (analyse AST)

Ces 5 tools combleraient **80% de l'écart** avec Cursor/Copilot tout en gardant l'avantage de Grokinou (multi-provider, MCP, session management). 🎯

---

## 📊 STATISTIQUES ACTUELLES

- **Tools natifs de base** : 8
- **Tools conditionnels** : 1 (Morph Fast Apply)
- **Tools MCP** : Variable (extensible)
- **Total tools de base** : 9

### Catégories couvertes
- ✅ Édition de fichiers : Excellent (5 tools)
- ✅ Recherche : Bon (1 tool puissant)
- ✅ Exécution : Basique (bash)
- ✅ Gestion de projet : Bon (todos)
- ❌ Gestion fichiers avancée : Manquant
- ❌ Analyse de code : Manquant
- ❌ Tests : Manquant
- ❌ Git structuré : Manquant
- ❌ Refactoring AST : Manquant

---

## 🔧 IMPLÉMENTATION SUGGÉRÉE

### Architecture recommandée

```typescript
// src/tools/file-operations.ts
export class FileOperationsTool {
  delete_file(path: string, recursive?: boolean)
  rename_file(oldPath: string, newPath: string)
  copy_file(source: string, destination: string)
  list_directory(path: string, includeHidden?: boolean)
}

// src/tools/lsp-client.ts
export class LSPTool {
  get_diagnostics(file: string)
  get_definition(file: string, line: number, column: number)
  get_references(file: string, line: number, column: number)
  get_symbols(file: string)
  rename_symbol(file: string, line: number, column: number, newName: string)
}

// src/tools/git-tool.ts
export class GitTool {
  git_diff(staged?: boolean, format?: 'json' | 'text')
  git_log(limit?: number, format?: 'json')
  git_status(format?: 'json')
  git_blame(file: string, line?: number)
}

// src/tools/test-runner.ts
export class TestRunnerTool {
  run_tests(pattern?: string, watch?: boolean)
  get_test_coverage()
}

// src/tools/database-tool.ts
export class DatabaseTool {
  query_database(query: string, database?: string)
  inspect_schema(database?: string)
}
```

---

## 📚 RESSOURCES

- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) (pour analyse AST)
- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [MCP Protocol](https://modelcontextprotocol.io/)

---

**Document créé le :** 2025-11-23  
**Version Grokinou :** 0.0.33  
**Auteur :** Claude Sonnet 4.5
