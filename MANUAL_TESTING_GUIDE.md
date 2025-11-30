# 🧪 Guide de Tests Manuels - Grokinou CLI

**Version:** 1.0.0  
**Date:** 2025-11-29  
**Répertoire:** `/home/zack/GROK_CLI/grok-cli`

---

## ✅ **SYNCHRONISATION VÉRIFIÉE**

```
✅ Répertoire de travail: /home/zack/GROK_CLI/grok-cli
✅ Git local: propre (aucune modification non commitée)
✅ Git remote: synchronisé (origin/main === HEAD)
✅ Derniers commits:
   - d0f1aa7: docs(test): add comprehensive test suite documentation
   - f6dafe4: test: add comprehensive test suite
   - 8ca356d: feat(llm-tools): complete documentation
✅ Intégrité: Sigstore #731436897, TSA, OTS pending
✅ Tests automatisés: 68 tests (29 user + 39 LLM) - 100% PASS
```

---

## 📋 **TESTS MANUELS À EFFECTUER**

### **Phase 1: Tests des Commandes Utilisateur (CLI Interactive)**

#### **1.1 Test `/list_sessions`**

```bash
# Démarrer grokinou
cd /home/zack/GROK_CLI/grok-cli
npm run dev

# Dans le CLI, taper:
/list_sessions
```

**Vérifications:**
- ✅ Liste toutes les sessions avec métadonnées
- ✅ Groupe par répertoire (📍 marque le répertoire actuel)
- ✅ Affiche création date et last activity
- ✅ Compte les messages correctement

---

#### **1.2 Test `/new-session` - Mode Empty (défaut)**

```bash
# Dans le CLI:
/new-session ~/test-session-empty
```

**Vérifications:**
- ✅ Crée le répertoire `~/test-session-empty`
- ✅ Répertoire vide (aucun fichier)
- ✅ Session créée dans la DB
- ✅ Process.cwd() change vers nouveau répertoire
- ✅ Message de confirmation affiché

**Nettoyage:**
```bash
rm -rf ~/test-session-empty
```

---

#### **1.3 Test `/new-session --clone-git`**

```bash
# Dans le CLI:
/new-session ~/test-session-git --clone-git
```

**Vérifications:**
- ✅ Clone le repo Git actuel
- ✅ `.git/` directory présent
- ✅ Fichiers du projet copiés
- ✅ Git log identique à l'original
- ✅ Message "Git repository cloned"

**Vérification manuelle:**
```bash
cd ~/test-session-git
git log --oneline -5
# Devrait afficher les mêmes commits que grok-cli
```

**Nettoyage:**
```bash
rm -rf ~/test-session-git
```

---

#### **1.4 Test `/new-session --copy-files`**

```bash
# Dans le CLI:
/new-session ~/test-session-copy --copy-files
```

**Vérifications:**
- ✅ Fichiers copiés depuis répertoire actuel
- ✅ `.git/` **absent** (exclu)
- ✅ `node_modules/` **absent** (exclu)
- ✅ Fichiers cachés **absents** (exclu)
- ✅ Message "Files copied"

**Vérification manuelle:**
```bash
cd ~/test-session-copy
ls -la
# Devrait voir les fichiers mais PAS .git ni node_modules
```

**Nettoyage:**
```bash
rm -rf ~/test-session-copy
```

---

#### **1.5 Test `/new-session --import-history`**

```bash
# Prérequis: Avoir une session existante avec des messages
# Lister les sessions pour trouver un ID:
/list_sessions

# Importer l'historique:
/new-session ~/test-session-history --import-history --from-session-id 1
```

**Vérifications:**
- ✅ Session créée
- ✅ Messages importés (vérifier compte dans /list_sessions)
- ✅ Message de confirmation avec nombre de messages

**Nettoyage:**
```bash
rm -rf ~/test-session-history
```

---

#### **1.6 Test `/new-session` avec date range**

```bash
# Importer seulement les messages entre deux dates:
/new-session ~/test-session-filtered --import-history --date-range-start 2025-11-01 --date-range-end 2025-11-07
```

**Vérifications:**
- ✅ Session créée
- ✅ Messages filtrés par date
- ✅ Message affiche la plage de dates
- ✅ Avertissement si aucun message dans la plage

**Nettoyage:**
```bash
rm -rf ~/test-session-filtered
```

---

#### **1.7 Test `/timeline`**

```bash
# Dans le CLI:
/timeline
```

**Vérifications:**
- ✅ Liste les événements récents
- ✅ Affiche timestamp, category, description
- ✅ Groupé par type (FILE_MODIFIED, GIT_COMMIT, etc.)

**Avec filtres:**
```bash
/timeline --limit 50
/timeline --stats-only
```

---

#### **1.8 Test `/snapshots`**

```bash
# Dans le CLI:
/snapshots
```

**Vérifications:**
- ✅ Liste les snapshots disponibles
- ✅ Affiche timestamp, file_count, size
- ✅ Message si aucun snapshot

---

#### **1.9 Test `/rewind-history`**

```bash
# Prérequis: Avoir effectué au moins un rewind
# Dans le CLI:
/rewind-history
```

**Vérifications:**
- ✅ Liste les opérations de rewind passées
- ✅ Affiche status (success/fail)
- ✅ Affiche timestamp, duration
- ✅ Affiche options utilisées (gitMode, createSession, etc.)

---

### **Phase 2: Tests de Rewind (Time Machine)**

⚠️ **IMPORTANT**: Ces tests modifient l'état du système. Sauvegarder avant !

#### **2.1 Test `/rewind` basic**

```bash
# Trouver un timestamp disponible:
/timeline --limit 100

# Rewind à un timestamp (exemple):
/rewind 2025-11-29T08:00:00Z
```

**Vérifications:**
- ✅ Crée répertoire `~/grokinou_rewind_TIMESTAMP`
- ✅ Fichiers reconstruits depuis Merkle DAG
- ✅ `git_state.json` créé (si gitMode=metadata)
- ✅ Message de succès avec statistiques
- ✅ `/rewind-history` montre cette opération

---

#### **2.2 Test `/rewind --git-mode full`**

```bash
/rewind 2025-11-29T08:00:00Z --git-mode full
```

**Vérifications:**
- ✅ Répertoire créé
- ✅ `.git/` directory complet
- ✅ `git log` fonctionne
- ✅ Checkout au bon commit

**Vérification manuelle:**
```bash
cd ~/grokinou_rewind_*
git log --oneline -5
git status
```

---

#### **2.3 Test `/rewind --create-session`**

```bash
/rewind 2025-11-29T08:00:00Z --create-session
```

**Vérifications:**
- ✅ Répertoire créé
- ✅ Session créée automatiquement
- ✅ `/list_sessions` montre la nouvelle session
- ✅ Message confirme création session

---

#### **2.4 Test `/rewind --auto-checkout`**

```bash
# Avant:
pwd
# Devrait être /home/zack/GROK_CLI/grok-cli

/rewind 2025-11-29T08:00:00Z --auto-checkout

# Après (vérifier dans le CLI):
pwd
# Devrait être ~/grokinou_rewind_TIMESTAMP
```

**Vérifications:**
- ✅ `process.cwd()` a changé
- ✅ Message affiche ancien et nouveau répertoire
- ✅ Avertissement affiché sur changement de répertoire

---

#### **2.5 Test `/rewind --compare-with`**

```bash
/rewind 2025-11-29T08:00:00Z --compare-with ~/GROK_CLI/grok-cli
```

**Vérifications:**
- ✅ Rapport de comparaison généré
- ✅ Affiche fichiers ajoutés
- ✅ Affiche fichiers supprimés
- ✅ Affiche fichiers modifiés
- ✅ Affiche hashes SHA256

---

#### **2.6 Test `/rewind` - Toutes options combinées**

```bash
/rewind 2025-11-29T08:00:00Z \
  --git-mode full \
  --create-session \
  --auto-checkout \
  --compare-with ~/GROK_CLI/grok-cli
```

**Vérifications:**
- ✅ Toutes les fonctionnalités ci-dessus fonctionnent ensemble
- ✅ Pas de conflits entre options
- ✅ Ordre d'exécution correct

---

### **Phase 3: Tests des Outils LLM (pour le développement)**

Ces tests nécessitent d'appeler les outils depuis le code.

#### **3.1 Test `session_new` tool (init_mode='clone-git')**

```typescript
// Dans un script Node.js ou directement via l'agent LLM:
import { executeSessionNew } from './dist/tools/session-tools.js';

const result = await executeSessionNew({
  directory: '~/test-llm-session',
  init_mode: 'clone-git'
});

console.log(result);
```

**Vérifications:**
- ✅ `result.success === true`
- ✅ Répertoire créé avec Git clone
- ✅ Session dans DB

---

#### **3.2 Test `rewind_to` tool (avec toutes options)**

```typescript
import { executeRewindTo } from './dist/tools/rewind-to-tool.js';

const result = await executeRewindTo({
  targetTimestamp: '2025-11-29T08:00:00Z',
  gitMode: 'full',
  createSession: true,
  autoCheckout: true,
  compareWith: process.cwd(),
  reason: 'Test LLM tool'
});

console.log(result);
```

**Vérifications:**
- ✅ `result.success === true`
- ✅ `result.comparisonReport` existe
- ✅ `result.sessionCreated` existe
- ✅ `result.autoCheckedOut === true`

---

### **Phase 4: Tests de Régression**

#### **4.1 Vérifier que les anciennes fonctionnalités marchent encore**

```bash
# Test ancien /switch-session (ne devrait pas être cassé)
/list_sessions
/switch-session <session_id>

# Test ancien chat (ne devrait pas être cassé)
Bonjour, teste-moi
```

**Vérifications:**
- ✅ Aucune régression
- ✅ Toutes les fonctionnalités existantes fonctionnent

---

## 📊 **Checklist de Tests**

### **Commandes Utilisateur**
- [ ] `/list_sessions` - Liste et groupe correctement
- [ ] `/new-session` (empty) - Crée répertoire vide
- [ ] `/new-session --clone-git` - Clone Git
- [ ] `/new-session --copy-files` - Copie fichiers (exclut .git)
- [ ] `/new-session --import-history` - Importe conversations
- [ ] `/new-session` avec date range - Filtre par dates
- [ ] `/timeline` - Liste événements
- [ ] `/snapshots` - Liste snapshots
- [ ] `/rewind-history` - Liste rewinds passés
- [ ] `/rewind` basic - Rewind simple
- [ ] `/rewind --git-mode none` - Pas de Git
- [ ] `/rewind --git-mode metadata` - git_state.json
- [ ] `/rewind --git-mode full` - Repo complet
- [ ] `/rewind --create-session` - Session auto
- [ ] `/rewind --auto-checkout` - Change cwd
- [ ] `/rewind --compare-with` - Génère diff
- [ ] `/rewind` toutes options - Combiné

### **Outils LLM**
- [ ] `session_new` (empty)
- [ ] `session_new` (clone-git)
- [ ] `session_new` (copy-files)
- [ ] `session_new` (from-rewind)
- [ ] `session_list`
- [ ] `session_switch`
- [ ] `rewind_to` (basic)
- [ ] `rewind_to` (toutes options)
- [ ] `timeline_query`
- [ ] `list_time_points`

### **Régression**
- [ ] Anciennes commandes fonctionnent
- [ ] Chat fonctionne
- [ ] Session switching fonctionne
- [ ] Aucun crash

---

## 🐛 **Rapport de Bugs**

Si vous trouvez un bug, documentez:

1. **Commande exécutée**: Exacte commande tapée
2. **Résultat attendu**: Ce qui devrait se passer
3. **Résultat obtenu**: Ce qui s'est passé
4. **Erreur**: Message d'erreur complet
5. **Logs**: Fichiers logs pertinents
6. **Context**: État du système avant le test

**Template:**
```
BUG: [Titre court]

COMMANDE:
/new-session ~/test --clone-git

ATTENDU:
Repo cloné avec succès

OBTENU:
Erreur: "git: command not found"

ERREUR:
[Copier l'erreur complète]

CONTEXT:
- Git installé: oui/non
- Session active: #1
- Répertoire actuel: /home/zack/GROK_CLI/grok-cli
```

---

## ✅ **Validation Finale**

Après tous les tests:

```bash
# 1. Vérifier que rien n'est cassé
cd /home/zack/GROK_CLI/grok-cli
git status
# Devrait être propre

# 2. Lancer les tests automatisés
npm test
# Devrait être 100% PASS

# 3. Nettoyer les répertoires de test
rm -rf ~/test-session-*
rm -rf ~/grokinou_rewind_*

# 4. Vérifier les logs
tail -100 ~/.grok/logs/*.log
```

---

## 📚 **Documentation Associée**

- **Options LLM Tools**: `LLM_TOOLS_OPTIONS_REFERENCE.md`
- **Guide Clarification**: `LLM_TOOL_CLARIFICATION_GUIDE.md`
- **Rewind Features**: `REWIND_FEATURES.md`
- **New Session Features**: `NEW_SESSION_FEATURES.md`
- **Tests Automatisés**: `test/README_COMPREHENSIVE_TESTS.md`

---

**Bonne chance avec les tests ! 🚀**

**N'oubliez pas:**
- Sauvegarder avant les tests de rewind
- Nettoyer les répertoires de test après
- Reporter les bugs trouvés
- Mettre à jour cette checklist au fur et à mesure
