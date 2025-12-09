# ANALYSE DES FICHIERS - Nettoyage Requis

## Fichiers Ajoutés par ChatGPT (Légitimes)

### Tests de régression ✅
- `tests/regression/tool_calls_restore.test.js` - Test régression tool_calls
- `tests/regression/placeholder_skip.test.js` - Test régression placeholder (ajouté par Claude)

### Tests d'intégrité ✅
- `tests/static/source_hash_integrity.test.js` - Vérification hashes SHA-256
- `tests/static/source-hashes.json` - Baseline des hashes

### Tests d'intégration ✅
- `tests/integration/tool_usage_monitor.js` - Moniteur usage tools

### Tests de performance ✅
- `tests/performance/measure_startup.sh` - Mesure temps de démarrage

### Scripts d'intégrité ✅
- `scripts/integrity/update-source-hashes.sh` - Mise à jour baseline

### Scripts changelog ✅
- `scripts/changelog/gen-auto-changelog.sh` - Génération changelog auto

### Documentation ✅
- `DOCS_FOR_CLAUDE.md` - Documentation pour Claude

---

## Fichiers Préexistants (À Conserver)

Ces fichiers existaient AVANT l'ajout des tests ChatGPT:

### Scripts de test existants
- `scripts/test-models.py` - Tests modèles existants
- `scripts/test-gpt5-response.ts` - Test GPT-5 existant
- `scripts/test-timeline-init.ts` - Test timeline existant

### Scripts système existants
- `scripts/timeline-merkle-check.ts` - Vérification Merkle
- `scripts/timeline-rewind-test.ts` - Test rewind
- `scripts/audit-security-system.sh` - Audit sécurité
- `scripts/update-security-baseline.ts` - Mise à jour baseline sécurité
- `scripts/checkpoint-databases.mjs` - Checkpoint DB
- `scripts/diagnose-duplication.sh` - Diagnostic duplication

---

## Fichiers à Vérifier/Nettoyer

### 1. DOCS_FOR_CLAUDE.md ⚠️

**Emplacement actuel:** `/home/zack/GROK_CLI/grok-cli/DOCS_FOR_CLAUDE.md`

**Analyse:**
- Fichier temporaire créé par ChatGPT pour documenter ses ajouts
- Contenu utile pour comprendre les tests
- Peut être renommé ou déplacé

**Recommandation:**
- Option 1: Déplacer dans `tests/README.md`
- Option 2: Renommer en `TESTING_GUIDE.md`
- Option 3: Supprimer après avoir intégré contenu dans README principal

---

### 2. Scripts dans scripts/ racine ❓

**Fichiers concernés:**
- `scripts/test-*.{ts,py}` (3 fichiers)
- `scripts/*.{sh,mjs,ts}` (6 fichiers)

**Problème:** Mélange de scripts de test et scripts utilitaires

**Recommandation:** Réorganiser:
```
scripts/
├── integrity/          # ✅ Déjà organisé
│   └── update-source-hashes.sh
├── changelog/          # ✅ Déjà organisé
│   └── gen-auto-changelog.sh
├── dev/                # 🆕 À créer
│   ├── test-models.py
│   ├── test-gpt5-response.ts
│   └── test-timeline-init.ts
├── security/           # 🆕 À créer
│   ├── audit-security-system.sh
│   └── update-security-baseline.ts
└── database/           # 🆕 À créer
    ├── checkpoint-databases.mjs
    ├── timeline-merkle-check.ts
    └── timeline-rewind-test.ts
```

---

## Fichiers à la Racine du Repo

### Fichiers forensiques (À conserver) ✅
- `FORENSIC_COMPLETE_ALL_COMMITS.md`
- `FORENSIC_REPORT_2025-12-07_UPDATED.md`
- `FORENSIC_TIMELINE_COMPLETE.md`
- `PHANTOM_COMMITS_ANALYSIS.md`
- `INVESTIGATION_PHANTOM_COMMITS.md`
- `CLAUDE_TEST_REVIEW.md`

Ces fichiers documentent l'investigation et doivent être gardés.

### Fichiers temporaires (À gérer) ⚠️
- `DOCS_FOR_CLAUDE.md` - Voir section ci-dessus

---

## Fichiers Probablement Indésirables

### À vérifier dans la racine

Vérifions s'il y a d'autres fichiers suspects:
```bash
ls -la | grep -v "^d" | grep -v node_modules | grep -v ".git"
```

Fichiers potentiellement indésirables:
- `.integrity-baseline.json` - Devrait être dans `.gitignore`?
- Fichiers de backup/test temporaires

---

## Plan de Nettoyage Recommandé

### Phase 1: Vérification (5 min)

```bash
# Lister tous les fichiers non-git
git ls-files --others --exclude-standard

# Vérifier taille du repo
du -sh .
```

### Phase 2: Nettoyage (15 min)

1. **Réorganiser scripts/**
   ```bash
   mkdir -p scripts/{dev,security,database}
   mv scripts/test-*.{ts,py} scripts/dev/
   mv scripts/{audit,update}-security*.{sh,ts} scripts/security/
   mv scripts/{checkpoint,timeline}*.{mjs,ts} scripts/database/
   ```

2. **Gérer DOCS_FOR_CLAUDE.md**
   ```bash
   # Option: Intégrer dans README
   cat DOCS_FOR_CLAUDE.md >> tests/README.md
   git rm DOCS_FOR_CLAUDE.md
   ```

3. **Nettoyer fichiers temporaires**
   ```bash
   # Vérifier .gitignore
   cat .gitignore | grep -E "(baseline|*.log|*.md)"
   ```

### Phase 3: Validation (10 min)

```bash
# Vérifier que les tests fonctionnent toujours
npm run test:regression
npm run test:integration

# Vérifier git status
git status --porcelain
```

---

## .gitignore Recommandé

Ajouter ces patterns:

```gitignore
# Tests et logs
logs/
*.log
/tests/static/source-hashes.json  # Baseline générée

# Fichiers forensiques (optionnel - à décider)
FORENSIC_*.md
PHANTOM_*.md
INVESTIGATION_*.md

# Documentation temporaire
DOCS_FOR_*.md
CLAUDE_*.md

# Backups d'intégrité
.integrity-backups/
.integrity-baseline.json

# Scripts de test temporaires
scripts/test-*.{ts,py,js}
```

**⚠️ ATTENTION:** Les fichiers forensiques contiennent des informations importantes.
Décider s'ils doivent être:
- Versionnés (pour historique)
- Ignorés (si trop volumineux)
- Déplacés dans un dossier `docs/forensics/`

---

## Résumé

### Fichiers Légitimes (À garder)
- ✅ `tests/` (nouveau) - 6 fichiers de tests
- ✅ `scripts/integrity/` (nouveau) - 1 script
- ✅ `scripts/changelog/` (nouveau) - 1 script
- ✅ `scripts/*.{ts,py,sh,mjs}` (existants) - 9 scripts utilitaires

### Fichiers à Réorganiser
- ⚠️ `DOCS_FOR_CLAUDE.md` - Intégrer ou supprimer
- ⚠️ Scripts dans `scripts/` racine - Créer sous-dossiers

### Fichiers à Vérifier
- ❓ Fichiers `.integrity-*` - Vérifier .gitignore
- ❓ Fichiers `FORENSIC_*.md` - Décider versioning

### Action Immédiate Recommandée

**Option 1: Minimal (5 min)**
- Créer tests/README.md avec contenu de DOCS_FOR_CLAUDE.md
- Supprimer DOCS_FOR_CLAUDE.md
- Commit les tests

**Option 2: Complète (30 min)**
- Réorganiser scripts/ en sous-dossiers
- Nettoyer .gitignore
- Créer docs/forensics/ pour rapports
- Commit tout proprement

**Option 3: Reporter**
- Commit tests tels quels
- Réorganisation plus tard

---

**Créé le:** 2025-12-07 20:30
**Auteur:** Claude
