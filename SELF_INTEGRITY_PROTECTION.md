# 🛡️ SELF-INTEGRITY PROTECTION

**Protection des Watchers contre l'Auto-Altération**

---

## 🎯 CONCEPT

### Problème

Les watchers de sécurité surveillent les fichiers de l'application, mais **qui surveille les watchers eux-mêmes** ?

**Scénario d'attaque :**
```
1. Adversaire modifie integrity-watcher.ts
2. Inject code malveillant : "ignorer fichier X"
3. Utilisateur lance watcher
4. Watcher compromis s'exécute
5. Watcher ignore fichier X (comme demandé par adversaire)
6. Adversaire modifie fichier X en toute impunité
```

### Solution : Self-Integrity Check

**Les watchers vérifient LEURS PROPRES fichiers avant de s'exécuter.**

```
1. Utilisateur lance watcher
2. Watcher calcule son propre hash SHA-256
3. Compare avec hash attendu (embarqué dans le code)
4. Si match → Continuer exécution
5. Si mismatch → ARRÊT IMMÉDIAT (process.exit(1))
```

---

## 🔒 FONCTIONNEMENT

### 1. Hashes Embarqués (Baseline)

Le fichier `src/security/self-integrity.ts` contient les hashes SHA-256 attendus :

```typescript
const EXPECTED_HASHES: Record<string, string> = {
  'integrity-watcher.ts': 'a1b2c3d4e5f6...',
  'llm-guard.ts': 'f6e5d4c3b2a1...',
  'watcher-daemon.ts': '123456789abc...',
  // ... etc
};
```

**Ces hashes sont FIGÉS dans le code** après validation manuelle.

### 2. Vérification au Démarrage

Chaque watcher appelle `verifySelfIntegrityOrDie()` AVANT toute exécution :

```typescript
// watcher-cli.ts
import { verifySelfIntegrityOrDie } from './self-integrity.js';

// PREMIÈRE CHOSE EXÉCUTÉE
await verifySelfIntegrityOrDie('integrity');

// ... reste du code ...
```

### 3. Vérification Multi-Fichiers

Un watcher vérifie **plusieurs fichiers** :

**Integrity Watcher vérifie :**
- ✅ `integrity-watcher.ts` (le watcher lui-même)
- ✅ `watcher-cli.ts` (le CLI)
- ✅ `self-integrity.ts` (le vérificateur)

**LLM Guard vérifie :**
- ✅ `llm-guard.ts`
- ✅ `llm-guard-cli.ts`
- ✅ `self-integrity.ts`

**Daemon vérifie :**
- ✅ `watcher-daemon.ts`
- ✅ `watcher-daemon-cli.ts`
- ✅ `self-integrity.ts`

### 4. Fail-Safe

Si **UNE SEULE** altération détectée → **ARRÊT IMMÉDIAT** :

```
🚨 CRITICAL: SELF-INTEGRITY CHECK FAILED 🚨

File:          integrity-watcher.ts
Status:        MISMATCH
Message:       Hash mismatch! File may be altered or replaced!

Expected hash: a1b2c3d4e5f6...
Actual hash:   deadbeef1234...

⚠️  POSSIBLE SCENARIOS:

1. File was REPLACED by adversary
   → Restore from Git: git checkout src/security/integrity-watcher.ts

2. File was LEGITIMATELY MODIFIED
   → Update baseline: npm run security:update-baseline

3. File was INJECTED with malicious code
   → Investigate: git diff src/security/integrity-watcher.ts

🛑 EXECUTION STOPPED FOR SECURITY REASONS
```

**Aucune exécution de code suspect.**

---

## 🔧 UTILISATION

### Vérifier Intégrité Manuellement

```bash
# Vérifier tous les fichiers watchers
npm run security:verify
```

**Output :**
```
═══════════════════════════════════════════════════════════════
🛡️  SELF-INTEGRITY VERIFICATION REPORT
═══════════════════════════════════════════════════════════════

Total files checked:     7
✅ OK:                   7
❌ MISMATCH:             0
⚠️  MISSING:              0
🔄 PENDING VALIDATION:   0

✅ ALL FILES VERIFIED - INTEGRITY OK
```

---

### Après Modification Légitime

Vous avez modifié `integrity-watcher.ts` pour ajouter un nouveau pattern malveillant.

**Étapes :**

#### 1. Vérifier les modifications (Git)

```bash
git diff src/security/integrity-watcher.ts
```

**Assurez-vous que les modifications sont LÉGITIMES (pas de code malveillant).**

#### 2. Mettre à jour la baseline

```bash
npm run security:update-baseline
```

**Le script va :**
- Calculer les nouveaux hashes
- Montrer le Git diff
- Demander confirmation (type "YES")
- Mettre à jour `self-integrity.ts`

**Output :**
```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     🔄 UPDATE SECURITY BASELINE - HASH CALCULATION           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

📊 Calculating current hashes...

✅ integrity-watcher.ts
   a1b2c3d4e5f6789abcdef0123456789a1b2c3d4e5f6789abcdef0123456789

✅ llm-guard.ts
   fedcba9876543210fedcba9876543210fedcba9876543210fedcba98765432

[... etc ...]

═══════════════════════════════════════════════════════════════
📝 Git Status (Security Files):

 M src/security/integrity-watcher.ts

⚠️  WARNING: Security files have uncommitted changes!
   Make sure these changes are LEGITIMATE before updating baseline.

═══════════════════════════════════════════════════════════════
🔍 Git Diff (Last Commit):

📄 integrity-watcher.ts:
+  // NEW PATTERN: Detect credential theft
+  /steal.*credentials/i,

═══════════════════════════════════════════════════════════════
⚠️  CONFIRMATION REQUIRED

You are about to update the security baseline with the hashes above.
This will TRUST these file versions as legitimate.

Have you manually verified that all changes are legitimate?
(No malicious code injected, no unauthorized modifications)

Type "YES" to proceed, anything else to cancel: YES

🔄 Updating self-integrity.ts...

✅ self-integrity.ts updated with new hashes

═══════════════════════════════════════════════════════════════
✅ NEW BASELINE ESTABLISHED:

   integrity-watcher.ts
   a1b2c3d4e5f6789abcdef0123456789a1b2c3d4e5f6789abcdef0123456789

[... etc ...]

═══════════════════════════════════════════════════════════════
🎯 NEXT STEPS:

1. Rebuild: npm run build
2. Test watchers: npm run watcher:start
3. Commit changes: git add src/security/self-integrity.ts
                   git commit -m "Update security baseline"
```

#### 3. Rebuild & Test

```bash
npm run build
npm run watcher:start
```

**Si tout fonctionne → Commit.**

#### 4. Commit

```bash
git add src/security/integrity-watcher.ts
git add src/security/self-integrity.ts
git commit -m "feat(security): Add credential theft pattern + update baseline"
```

---

## 🔍 DÉTECTION D'ALTÉRATION

### Scénario 1 : Adversaire Modifie Watcher

**1. Adversaire modifie `integrity-watcher.ts` :**

```typescript
// Code malveillant injecté
if (filePath.includes('backdoor.ts')) {
  return; // Ignore ce fichier
}
```

**2. Utilisateur lance watcher :**

```bash
npm run watch:integrity
```

**3. Self-integrity check détecte l'altération :**

```
🚨 CRITICAL: SELF-INTEGRITY CHECK FAILED 🚨

File:          integrity-watcher.ts
Status:        MISMATCH
Expected hash: a1b2c3d4e5f6...
Actual hash:   deadbeef1234...

🛑 EXECUTION STOPPED FOR SECURITY REASONS
```

**4. Watcher ne s'exécute PAS.**

**5. Adversaire échoue.**

---

### Scénario 2 : Fichier Remplacé (Inode Change)

**1. Adversaire remplace fichier :**

```bash
rm src/security/integrity-watcher.ts
cp malicious-watcher.ts src/security/integrity-watcher.ts
```

**2. Hash change (différent fichier).**

**3. Self-integrity check détecte :**

```
🚨 CRITICAL: SELF-INTEGRITY CHECK FAILED 🚨
File:          integrity-watcher.ts
Status:        MISMATCH
```

**4. Forensic evidence saved :**

```json
// .security-integrity-failure.json
{
  "timestamp": "2025-11-30T23:59:59.000Z",
  "file": "integrity-watcher.ts",
  "status": "MISMATCH",
  "expectedHash": "a1b2c3d4...",
  "actualHash": "deadbeef...",
  "inode": 98765,
  "pid": 12345,
  "cwd": "/home/zack/GROK_CLI/grok-cli"
}
```

**5. Preuve d'altération disponible.**

---

## 🔄 VÉRIFICATION CONTINUE (Runtime)

### Monitoring Pendant Exécution

En plus de la vérification au démarrage, vous pouvez activer le **monitoring continu** :

```typescript
import { ContinuousSelfIntegrityMonitor } from './self-integrity.js';

const monitor = new ContinuousSelfIntegrityMonitor(10000); // Check every 10s
monitor.start();

// Watcher runs...

// Si fichier modifié pendant exécution → EXIT IMMEDIATELY
```

**Détecte :**
- Modification fichier watcher PENDANT son exécution
- Remplacement "on the fly"
- Injection runtime (fichier)

**⚠️  Limitation :**
- Vérifie les FICHIERS, pas la MÉMOIRE
- Protection mémoire = TODO futur (V8 isolates, memory sealing)

---

## 📊 FICHIERS SURVEILLÉS

| Fichier | Rôle | Vérifié par |
|---------|------|-------------|
| `integrity-watcher.ts` | Core heuristic watcher | Watcher CLI |
| `llm-guard.ts` | Core LLM guard | LLM Guard CLI |
| `watcher-daemon.ts` | Daemon orchestrator | Daemon CLI |
| `self-integrity.ts` | Self-integrity checker | Tous (3 CLI) |
| `watcher-cli.ts` | Integrity Watcher CLI | Lui-même |
| `llm-guard-cli.ts` | LLM Guard CLI | Lui-même |
| `watcher-daemon-cli.ts` | Daemon CLI | Lui-même |

**Total : 7 fichiers critiques protégés.**

---

## ⚠️ LIMITATIONS & TODO

### Ce Qui EST Protégé

✅ Modification fichiers AVANT exécution  
✅ Remplacement fichiers (inode change)  
✅ Injection code malveillant dans fichiers  
✅ Modification fichiers PENDANT exécution (avec monitoring continu)  

### Ce Qui N'EST PAS (encore) Protégé

❌ Modification EN MÉMOIRE (runtime)  
❌ Code injection via `eval()` runtime  
❌ Manipulation pointeurs mémoire (C++ addons)  
❌ Debugger attach + memory patch  

### Solutions Futures (Memory Protection)

**Pour plus tard (comme tu l'as dit) :**

1. **V8 Isolates** : Exécuter watchers dans isolates séparés
2. **Memory Sealing** : Marquer code en lecture seule
3. **Runtime Checksums** : Vérifier bytecode V8 périodiquement
4. **Code Signing** : Signer bytecode, vérifier avant exécution
5. **ASLR + DEP** : Address Space Layout Randomization
6. **SGX Enclaves** : Intel SGX pour code critique (si hardware compatible)

---

## 🎯 WORKFLOW COMPLET

### Développement Normal

```bash
# 1. Modifier fichier watcher (ajout feature légitime)
vim src/security/integrity-watcher.ts

# 2. Vérifier modifications
git diff src/security/integrity-watcher.ts

# 3. Mettre à jour baseline
npm run security:update-baseline
# → Type "YES" après vérification manuelle

# 4. Rebuild & Test
npm run build
npm run watcher:start

# 5. Vérifier intégrité
npm run security:verify

# 6. Commit si OK
git add src/security/integrity-watcher.ts src/security/self-integrity.ts
git commit -m "feat: Add new malicious pattern"
```

---

### Détection d'Altération Suspecte

```bash
# 1. Lancer watcher
npm run watch:integrity

# 🚨 Si output :
# CRITICAL: SELF-INTEGRITY CHECK FAILED
# File: integrity-watcher.ts

# 2. NE PAS UPDATE BASELINE !
# → Investiguer d'abord

# 3. Vérifier Git diff
git diff src/security/integrity-watcher.ts

# 4. Vérifier historique
git log -p src/security/integrity-watcher.ts

# 5. Chercher code suspect
grep -n "eval\|exec\|malicious" src/security/integrity-watcher.ts

# 6. Si altération malveillante détectée
git checkout src/security/integrity-watcher.ts
# → Restaurer version propre

# 7. Si modification légitime oubliée
npm run security:update-baseline
# → Mettre à jour baseline
```

---

## 📚 COMMANDES DISPONIBLES

```bash
# Vérifier intégrité (tous fichiers)
npm run security:verify

# Mettre à jour baseline (après modif légitime)
npm run security:update-baseline

# Lancer watchers (avec self-check automatique)
npm run watch:integrity       # Integrity Watcher
npm run guard:start           # LLM Guard
npm run watcher:start         # Daemon (lance les 2)
```

---

## 🔒 SÉCURITÉ RENFORCÉE

### Chaîne de Confiance (Chain of Trust)

```
1. Daemon vérifie :
   - watcher-daemon.ts
   - watcher-daemon-cli.ts
   - self-integrity.ts

2. Daemon lance IntegrityWatcher
   → IntegrityWatcher vérifie :
      - integrity-watcher.ts
      - watcher-cli.ts
      - self-integrity.ts

3. Daemon lance LLMGuard
   → LLMGuard vérifie :
      - llm-guard.ts
      - llm-guard-cli.ts
      - self-integrity.ts
```

**Vérification mutuelle + self-check = protection multi-couches.**

---

### Forensic Evidence

En cas d'échec, preuves sauvegardées dans :

```
.security-integrity-failure.json
```

**Contient :**
- Timestamp exact
- Fichier altéré
- Hashes (attendu vs actuel)
- Inode (pour détection remplacement)
- PID, PPID, CWD, argv
- Variables environnement

**Utilisable pour :**
- Analyse post-mortem
- Rapport incident sécurité
- Preuve légale (si nécessaire)

---

## ✅ CONCLUSION

La **Self-Integrity Protection** empêche les adversaires de compromettre les watchers eux-mêmes.

**Avantages :**
- ✅ Protection automatique au démarrage
- ✅ Fail-safe immédiat (exit si altération)
- ✅ Preuves forensiques
- ✅ Workflow simple (update-baseline)
- ✅ Protection multi-fichiers
- ✅ Monitoring continu (optionnel)

**Prochaine étape (futur) :**
- Memory protection (V8 isolates, memory sealing)
- Runtime checksums
- Code signing

**Avec Self-Integrity + Integrity Watcher + LLM Guard + Daemon, vous avez un système de sécurité robuste, auto-protégé et forensiquement traçable.** 🛡️🚀

---

**Créé par :** Claude Sonnet 4.5  
**Date :** 2025-12-01 00:15  
**Version :** 1.0.0  
**Status :** ✅ PRODUCTION READY

═══════════════════════════════════════════════════════════════
