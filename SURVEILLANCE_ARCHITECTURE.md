# 🔍 Architecture de Surveillance des Fichiers - Analyse Complète

Date: 2025-12-06
Auteur: Analyse système

## 📊 Vue d'ensemble des composants

### 1. **FileHook** (`src/timeline/hooks/file-hook.ts`)

**Objectif principal**: Suivi de l'historique des modifications pour la timeline

| Aspect | Configuration actuelle |
|--------|----------------------|
| **Activé par défaut** | ✅ Oui (via `initTimeline()`) |
| **Démarrage** | Automatique au lancement de grokinou |
| **Surveillance** | `src/**`, `scripts/**`, `*.{ts,js,json,md}` (racine) |
| **Ignore** | `.git`, `node_modules`, `.grok`, `dist`, `build` |
| **Fonction** | Log des événements (add/change/unlink) dans la timeline |
| **Hashing** | SHA256 (max 10MB) |
| **Debouncing** | 500ms |
| **Sécurité** | ❌ Aucune (juste tracking) |

**Problème identifié**:
- ❌ Ne surveille PAS `.git` → Trou de sécurité
- ✅ Évite ENOSPC en surveillant seulement des paths spécifiques

---

### 2. **IntegrityWatcher** (`src/security/integrity-watcher.ts`)

**Objectif principal**: Détection de modifications malveillantes en temps réel

| Aspect | Configuration actuelle |
|--------|----------------------|
| **Activé par défaut** | ❌ Non (require `GROK_AUTO_WATCHER=true`) |
| **Démarrage** | Manuel ou via WatcherDaemon |
| **Surveillance** | Patterns critiques (CRITICAL_PATTERNS) |
| **Patterns surveillés** | `src/agent/**`, `src/grok/**`, `dist/**/*.js`, `package.json`, `tsconfig.json` |
| **Ignore** | `.git/**`, `node_modules/**`, `.grok/**`, `dist/**`, `build/**` |
| **Fonction** | Détection heuristique + LLM analysis + baseline comparison |
| **Modes** | heuristic / llm / dual |
| **Actions** | Quarantine, restore, alerts |
| **Sécurité** | ✅✅✅ Maximum |

**Problèmes identifiés**:
- ❌ **CRITIQUE**: Ignore `.git` → Supply chain attack possible
- ❌ Ignore aussi patterns dans `.git/**` que nous avons ajouté
- ⚠️ Cause ENOSPC si activé sans limitation de paths

**Patterns critiques actuels**:
```typescript
[
  'src/agent/grok-agent.ts',
  'src/grok/client.ts',
  'src/grok/tools.ts',
  'src/utils/settings-manager.ts',
  'dist/**/*.js',
  'package.json',
  'tsconfig.json',
  '.git/config',        // ← Ajouté mais ignoré par chokidar
  '.git/HEAD',          // ← Ajouté mais ignoré par chokidar
  '.git/refs/heads/**', // ← Ajouté mais ignoré par chokidar
  '.git/hooks/**',      // ← Ajouté mais ignoré par chokidar
]
```

---

### 3. **WatcherDaemon** (`src/security/watcher-daemon.ts`)

**Objectif principal**: Orchestrateur des systèmes de sécurité

| Aspect | Configuration actuelle |
|--------|----------------------|
| **Activé par défaut** | ❌ Non (require `GROK_AUTO_WATCHER=true`) |
| **Démarrage** | Via `autoStartWatcher()` dans index.ts |
| **Fonction** | Lance IntegrityWatcher + LLMGuard en daemon |
| **Processus** | Survit à l'exit de grokinou |
| **Features** | Baseline backup, auto-restore, PID tracking |
| **Self-integrity** | Continuous monitoring du code de sécurité |

**Configuration**:
- Mode: `dual` (heuristic + LLM)
- LLMGuard: Enabled
- Baseline backup: Yes
- Self-integrity interval: 10s

---

### 4. **LLMGuard** (`src/security/llm-guard.ts`)

**Objectif principal**: Protection contre l'exfiltration de données

| Aspect | Configuration actuelle |
|--------|----------------------|
| **Activé par défaut** | ❌ Non (lancé par WatcherDaemon) |
| **Fonction** | Scan des messages sortants pour secrets/PII |
| **Détection** | Regex patterns pour API keys, tokens, emails, etc. |
| **Actions** | Redact, alert, block |

---

## 🔴 Problèmes critiques identifiés

### 1. **Trou de sécurité: `.git` non surveillé**

**Impact**: 🔴 CRITIQUE
- Modification de `.git/config` → Changement de remote URL
- Modification de `.git/hooks/*` → Injection de code malveillant
- Modification de `.git/refs/heads/*` → Altération de commits
- Modification de `.git/objects/*` → Compromission de l'historique

**Conséquence**: Supply chain attack avant push vers GitHub

---

### 2. **Conflit: FileHook vs IntegrityWatcher**

| Composant | Objectif | Surveillance | Problème |
|-----------|----------|-------------|----------|
| FileHook | Timeline tracking | `src/**`, `scripts/**`, racine | ❌ Ignore `.git` |
| IntegrityWatcher | Sécurité | Patterns critiques | ❌ Ignore `.git` aussi |

**Résultat**: `.git` n'est surveillé par **PERSONNE**

---

### 3. **ENOSPC: Limitation système**

**Cause**: Trop de watchers créés par chokidar
**Solution actuelle FileHook**: Surveiller seulement paths spécifiques ✅
**Solution actuelle IntegrityWatcher**: Ignore `.git` ❌ (contourne le problème mais crée un trou de sécurité)

---

### 4. **Redondance inutile**

| Fichier | FileHook | IntegrityWatcher | Redondant? |
|---------|----------|------------------|------------|
| `src/agent/grok-agent.ts` | ✅ Surveillé | ✅ Surveillé | ⚠️ Oui |
| `package.json` | ✅ Surveillé | ✅ Surveillé | ⚠️ Oui |
| `.git/config` | ❌ Ignoré | ❌ Ignoré | 🔴 TROU |
| `node_modules/*` | ❌ Ignoré | ❌ Ignoré | ✅ OK |

---

## 🎯 Architecture proposée (solution)

### Principe: **Séparation des responsabilités**

#### **FileHook** → Timeline & Development
- **Objectif**: Tracking pour timeline, pas de sécurité
- **Surveillance**: Fichiers de développement actifs
- **Paths**: `src/**`, `scripts/**`, `*.{ts,js,json,md}` (racine)
- **Ignore**: `.git`, `node_modules`, `dist`, `build`
- **Justification**: Évite ENOSPC, focus sur le code actif

#### **IntegrityWatcher** → Sécurité critique
- **Objectif**: Détection de malware/tampering
- **Surveillance**: Fichiers critiques + `.git` (sélection précise)
- **Paths critiques**:
  ```typescript
  [
    // Code critique
    'src/agent/grok-agent.ts',
    'src/grok/client.ts',
    'src/grok/tools.ts',
    'src/security/**/*.ts',
    'dist/**/*.js',

    // Config critique
    'package.json',
    'tsconfig.json',

    // Git integrity (NOUVEAU)
    '.git/config',
    '.git/HEAD',
    '.git/refs/heads/*',  // Pas **, juste 1 niveau
    '.git/hooks/*',       // Pas **, juste 1 niveau
  ]
  ```
- **Ignore**: `.git/objects/**`, `.git/logs/**`, `node_modules/**`
- **Justification**:
  - Surveille `.git` critique sans scanner objets
  - Évite ENOSPC en limitant à refs/hooks (pas objects)
  - Détecte supply chain attacks

---

## 📋 Plan d'implémentation

### Phase 1: Sécuriser `.git` (PRIORITÉ HAUTE)

1. ✅ **IntegrityWatcher**: Ajouter `.git` critique aux patterns
2. ✅ **IntegrityWatcher**: Retirer `.git/**` des ignored
3. ✅ **IntegrityWatcher**: Ajouter ignores précis:
   - `.git/objects/**`
   - `.git/logs/**`
   - `.git/index.lock`
4. ✅ Tester que ENOSPC ne revient pas
5. ✅ Vérifier que modifications de `.git/config` sont détectées

### Phase 2: Optimiser FileHook

1. ✅ Garder paths spécifiques actuels
2. ✅ Documenter pourquoi `.git` n'est pas surveillé ici

### Phase 3: Documentation

1. ✅ Créer `SURVEILLANCE_ARCHITECTURE.md` (ce fichier)
2. ✅ Ajouter commentaires dans le code
3. ✅ README de sécurité

---

## ⚖️ Trade-offs acceptés

| Trade-off | Justification |
|-----------|--------------|
| FileHook ignore `.git` | Timeline n'a pas besoin de commits git, évite ENOSPC |
| IntegrityWatcher ignore `.git/objects/**` | Trop de fichiers (ENOSPC), intégrité vérifiée par git lui-même |
| IntegrityWatcher désactivé par défaut | Performance, nécessite API key |
| Redondance src/* dans les deux | FileHook = timeline, IntegrityWatcher = sécurité (objectifs différents) |

---

## 🚀 Bénéfices de l'architecture proposée

1. ✅ **Sécurité**: `.git` critique surveillé (refs, hooks, config)
2. ✅ **Performance**: Pas d'ENOSPC (paths limités intelligemment)
3. ✅ **Développement fluide**: FileHook ne bloque pas
4. ✅ **Clarté**: Chaque composant a un rôle bien défini
5. ✅ **Supply chain protection**: Détection de commit tampering

---

## 🔧 Actions immédiates recommandées

1. [ ] Implémenter Phase 1 (sécuriser `.git`)
2. [ ] Tester avec `GROK_AUTO_WATCHER=true`
3. [ ] Vérifier pas d'ENOSPC
4. [ ] Tester détection de modification de `.git/config`
5. [ ] Documenter dans README
