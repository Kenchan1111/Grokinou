# 🤖 LLM GUARD - Surveillance Intelligente

**GARDIEN LLM QUI SURVEILLE VOTRE SYSTÈME 24/7**

---

## 📋 TABLE DES MATIÈRES

1. [Concept](#concept)
2. [Différences avec Integrity Watcher](#différences-avec-integrity-watcher)
3. [Installation & Setup](#installation--setup)
4. [Usage](#usage)
5. [Détections Avancées](#détections-avancées)
6. [Modes de Fonctionnement](#modes-de-fonctionnement)
7. [Architecture](#architecture)
8. [FAQ](#faq)

---

## 🎯 CONCEPT

### Qu'est-ce que le LLM Guard ?

Le **LLM Guard** est un **"gardien intelligent"** qui surveille votre système comme un agent de sécurité qui fait sa ronde. Il utilise un **LLM (Large Language Model)** pour détecter des comportements suspects que les signatures cryptographiques ne peuvent pas identifier.

### Pourquoi un LLM ?

**Integrity Watcher (Heuristique)** détecte :
- ✅ Modifications de contenu (hash SHA-256 différent)
- ✅ Patterns malveillants connus (regex)

**LLM Guard (Intelligent)** détecte :
- ✅ **Fichiers remplacés** (inode changé, pas juste modifié)
- ✅ **Fichiers copiés** (contenu identique à un autre fichier)
- ✅ **Opérations en masse** (10 fichiers modifiés en 5s)
- ✅ **Timing suspects** (modifications à 3h du matin)
- ✅ **Comportements contextuels** (fichier supprimé puis recréé ailleurs)
- ✅ **Intentions cachées** (analyse sémantique du comportement global)

---

## 🔄 DIFFÉRENCES AVEC INTEGRITY WATCHER

| Feature | Integrity Watcher | LLM Guard |
|---------|------------------|-----------|
| **Détection** | Hash SHA-256 | Inode + Comportement |
| **Patterns** | Regex fixes | Analyse sémantique LLM |
| **Vitesse** | < 1ms | 2-5s (analyse LLM) |
| **Coût** | Gratuit | API calls (~$0.01/analyse) |
| **Fichiers remplacés** | ❌ | ✅ |
| **Fichiers copiés** | ❌ | ✅ |
| **Analyse contextuelle** | ❌ | ✅ |
| **Nouveaux patterns** | ❌ | ✅ |

### Complémentarité

**LLM Guard NE REMPLACE PAS Integrity Watcher !**

Les deux systèmes **travaillent ensemble** :

1. **Integrity Watcher** : Détection rapide (< 1ms) de modifications de contenu
2. **LLM Guard** : Détection intelligente (2-5s) de comportements suspects

**Exemple :**

```bash
# Adversaire remplace src/agent/grok-agent.ts par une copie modifiée

→ Integrity Watcher : ✅ Détecte hash différent (pattern malveillant)
→ LLM Guard : ✅ Détecte inode changé (fichier remplacé, pas modifié)
                 + Analyse : "Fichier critique remplacé pendant build"
```

**Utilisation recommandée :** Les deux en parallèle !

---

## 🚀 INSTALLATION & SETUP

### Prérequis

- ✅ Integrity Watcher installé (voir `INTEGRITY_WATCHER_README.md`)
- ✅ API key LLM (Grok, OpenAI, Claude, etc.)
- ✅ Build fonctionnel (`npm run build`)

### Installation

Déjà installé si vous avez installé Integrity Watcher !

```bash
cd /home/zack/GROK_CLI/grok-cli
npm run build
```

### Configuration API Key

```bash
# Option 1: Variable d'environnement
export GROK_API_KEY="your-api-key"

# Option 2: Variable spécifique LLM Guard
export LLM_GUARD_API_KEY="your-api-key"

# Option 3: CLI argument
npm run guard:start -- --apikey your-api-key
```

---

## 📖 USAGE

### Démarrage Rapide

```bash
# 1. Lancer Integrity Watcher (terminal 1)
export GROK_API_KEY="your-key"
npm run watch:integrity:dual

# 2. Lancer LLM Guard (terminal 2)
export GROK_API_KEY="your-key"
npm run guard:start
```

**Laissez les deux tourner en parallèle 24/7 !**

### Commandes Disponibles

```bash
# Lancer le garde
npm run guard:start

# Lancer avec options
npm run guard:start -- --llm grok-2-1212 --interval 60000

# Voir les logs
npm run guard:logs

# Voir les statistiques
npm run guard:stats
```

### Options CLI

| Option | Description | Exemple |
|--------|-------------|---------|
| `--apikey` | API key LLM | `--apikey sk-xxx` |
| `--llm` | Modèle LLM | `--llm grok-2-1212` |
| `--interval` | Intervalle d'analyse (ms) | `--interval 60000` (60s) |
| `--logs` | Afficher logs | `npm run guard:logs` |
| `--stats` | Afficher statistiques | `npm run guard:stats` |

---

## 🔍 DÉTECTIONS AVANCÉES

### 1️⃣ Fichier Remplacé (vs Modifié)

**Problème :** Les signatures SHA-256 ne distinguent pas :
- Fichier **modifié** in-place (éditeur de texte)
- Fichier **remplacé** (copie d'un autre fichier)

**Solution LLM Guard :**

```bash
# Adversaire copie un fichier malveillant sur un fichier légitime
cp malicious.ts src/agent/grok-agent.ts

→ Integrity Watcher : Hash différent ✅
→ LLM Guard : Inode changé 🚨 (fichier REMPLACÉ, pas modifié)
```

**Détection :**
- Inode change = fichier remplacé
- Inode same = fichier modifié in-place

### 2️⃣ Fichiers Copiés (Identiques)

**Problème :** Un adversaire peut copier un fichier et le modifier ailleurs.

**Solution LLM Guard :**

```bash
# Adversaire copie un fichier
cp src/agent/grok-agent.ts backup/grok-agent-copy.ts

→ LLM Guard : Hash identique 🚨
                "File copy detected: backup/grok-agent-copy.ts 
                 is identical to src/agent/grok-agent.ts"
```

### 3️⃣ Opérations en Masse

**Problème :** 10 fichiers modifiés en 5 secondes = suspect !

**Solution LLM Guard :**

```bash
# Adversaire modifie plusieurs fichiers rapidement
for f in src/**/*.ts; do echo "malicious" >> $f; done

→ LLM Guard : LLM analyse 🚨
                "SUSPICION_LEVEL: high
                 REASONING: Mass operation detected - 15 files 
                 modified in 3 seconds. Typical sabotage pattern."
```

### 4️⃣ Timing Suspects

**Problème :** Modifications à 3h du matin = suspect !

**Solution LLM Guard :**

```bash
# Adversaire modifie un fichier à 3h du matin
(à 03:15) touch src/agent/grok-agent.ts

→ LLM Guard : LLM analyse 🚨
                "SUSPICION_LEVEL: medium
                 REASONING: File modified at unusual hour (03:15). 
                 No recent user activity detected."
```

### 5️⃣ Comportements Contextuels

**Problème :** Fichier supprimé puis recréé ailleurs = relocation cachée

**Solution LLM Guard :**

```bash
# Adversaire déplace un fichier de manière cachée
rm src/tools/bash.ts
cp malicious.ts src/utils/bash-tool.ts

→ LLM Guard : LLM analyse 🚨
                "SUSPICION_LEVEL: high
                 DETECTED_PATTERNS: file_relocation
                 REASONING: src/tools/bash.ts removed, 
                 identical file created at src/utils/bash-tool.ts. 
                 Possible attempt to hide malicious code."
```

---

## 🎛️ MODES DE FONCTIONNEMENT

### Mode "Love Watching" (Actuel)

**Comportement :**
- ✅ Observation passive
- ✅ Logging exhaustif
- ✅ Analyse LLM périodique
- ✅ Alertes affichées
- ❌ Pas d'intervention automatique

**Utilisation :**
```bash
npm run guard:start  # Mode love-watching par défaut
```

**Sortie exemple :**
```
ℹ️  [OBSERVATION] File added: src/test.ts
🚨 [DETECTION] FILE REPLACED: src/agent/grok-agent.ts
⚠️  [ANALYSIS] LLM Analysis: SUSPICION_LEVEL: high
```

### Mode "Active Reviewer" (Futur)

**Comportement :**
- ✅ Observation active
- ✅ Logging exhaustif
- ✅ Analyse LLM périodique
- ✅ Alertes affichées
- ✅ **Intervention automatique** (quarantaine, restauration)

**Utilisation :**
```bash
npm run guard:start -- --active-reviewer  # (pas encore implémenté)
```

**Différence :** En mode active-reviewer, le LLM Guard pourra :
- Quarantainer des fichiers suspects
- Restaurer depuis baseline
- Bloquer des opérations en cours

**Pour l'instant :** Seul le mode love-watching est implémenté.

---

## 🏗️ ARCHITECTURE

### Composants

```
┌─────────────────────────────────────────────────────────────┐
│                      LLM GUARD                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐ │
│  │  Chokidar     │  │  Inode/Hash   │  │   Event        │ │
│  │  Filesystem   │──│   Tracking    │──│   Buffer       │ │
│  │  Watcher      │  │               │  │                │ │
│  └───────────────┘  └───────────────┘  └────────────────┘ │
│                                             │               │
│                                    ┌────────▼────────┐      │
│                                    │  LLM Analysis   │      │
│                                    │  (Periodic)     │      │
│                                    │  Grok/GPT/etc   │      │
│                                    └────────────────┘      │
│                                             │               │
│                            ┌────────────────┴──────────┐    │
│                            │                           │    │
│                   ┌────────▼───────┐  ┌────────────────▼──┐│
│                   │  Advanced      │  │  Integrity        ││
│                   │  Detection     │  │  Watcher Alerts   ││
│                   │  (Inode, etc)  │  │  (Integration)    ││
│                   └────────────────┘  └───────────────────┘│
│                            │                           │    │
│                            └──────────────────┬────────┘    │
│                                               │             │
│                                      ┌────────▼────────┐    │
│                                      │  Logging +      │    │
│                                      │  Statistics     │    │
│                                      └─────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Filesystem Event** → Chokidar détecte modification
2. **Inode/Hash Tracking** → Vérifie si inode/hash a changé
3. **Advanced Detection** → Détecte remplacements, copies
4. **Event Buffer** → Accumule événements
5. **Periodic LLM Analysis** → Analyse événements par LLM (30s)
6. **Integrity Watcher Alerts** → Lit alertes du watcher heuristique
7. **LLM Reasoning** → LLM analyse contexte global
8. **Logging** → Enregistre tout dans `.llm-guard-logs.json`

---

## ❓ FAQ

### Q1: LLM Guard remplace-t-il Integrity Watcher ?

**Non !** Les deux sont **complémentaires** :

- **Integrity Watcher** : Détection rapide (< 1ms) de modifications
- **LLM Guard** : Détection intelligente (2-5s) de comportements

**Utilisez les deux en parallèle !**

### Q2: Quel est le coût des API calls ?

**Coût approximatif :**
- Analyse LLM : ~$0.01 par analyse
- Intervalle par défaut : 30s
- Coût horaire : ~$1.20/heure (si événements constants)

**En pratique :** Le LLM n'analyse que si événements détectés → Coût réel < $0.10/heure

**Optimisation :**
- Augmentez `--interval` (60s, 120s) pour réduire coût
- Mode love-watching est déjà passif

### Q3: Quels LLMs sont supportés ?

**Tous les LLMs compatibles OpenAI API :**
- ✅ Grok (`grok-2-1212`, `grok-fast-1`)
- ✅ OpenAI (`gpt-4`, `gpt-3.5-turbo`)
- ✅ Claude (via API compatible)
- ✅ Mistral
- ✅ DeepSeek
- ✅ Autres (si API OpenAI-compatible)

**Configuration :**
```bash
npm run guard:start -- --llm gpt-4 --apikey sk-xxx
```

### Q4: Comment voir ce qui se passe ?

**Logs en temps réel :**
```bash
# Terminal 1: LLM Guard (affiche logs en temps réel)
npm run guard:start

# Terminal 2: Voir tous les logs
npm run guard:logs

# Terminal 3: Voir statistiques
npm run guard:stats
```

**Fichiers générés :**
- `.llm-guard-logs.json` - Tous les logs

### Q5: Puis-je utiliser LLM Guard sans Integrity Watcher ?

**Oui**, mais **pas recommandé !**

LLM Guard peut fonctionner seul, mais :
- ✅ LLM Guard : Détections avancées (inode, copies, comportements)
- ❌ LLM Guard seul : Pas de détection heuristique rapide

**Recommandation :** Les deux en parallèle pour couverture maximale.

### Q6: Quelle est la différence entre inode et hash ?

**Hash SHA-256 :**
- Empreinte du **contenu** du fichier
- Change si contenu modifié
- Ne change PAS si fichier remplacé par contenu identique

**Inode :**
- Identifiant **filesystem** du fichier
- Change si fichier **remplacé** (même contenu)
- Ne change PAS si contenu modifié in-place

**Exemple :**
```bash
# Modification in-place (éditeur)
vim file.ts  # Inode same, hash different

# Remplacement (copie)
cp other.ts file.ts  # Inode different, hash different
```

**LLM Guard détecte les deux !**

### Q7: Que signifie "Love Watching" ?

**Concept :** Le LLM Guard **observe** sans intervenir (pour l'instant).

**Analogie :** Un gardien de musée qui :
- ✅ Surveille les visiteurs
- ✅ Note les comportements suspects
- ✅ Alerte le personnel
- ❌ N'arrête pas les visiteurs (pas encore)

**Mode futur "Active Reviewer" :** Le gardien pourra intervenir directement.

### Q8: Comment intégrer avec le workflow existant ?

**Workflow recommandé :**

```bash
# Terminal 1: Integrity Watcher (heuristique)
cd /home/zack/GROK_CLI/grok-cli
export GROK_API_KEY="..."
npm run watch:integrity:dual

# Terminal 2: LLM Guard (intelligent)
export GROK_API_KEY="..."
npm run guard:start

# Terminal 3: Votre travail de dev
grokinou
# Développez normalement, les deux guards surveillent !
```

**Vérification quotidienne :**
```bash
# Voir alertes Integrity Watcher
npm run watch:alerts

# Voir logs LLM Guard
npm run guard:logs

# Voir stats LLM Guard
npm run guard:stats
```

---

## 🎓 EXEMPLES DE SCÉNARIOS

### Scénario 1 : Détection de Fichier Remplacé

**Adversaire :**
```bash
# Remplace src/agent/grok-agent.ts par version malveillante
cp /tmp/malicious-agent.ts src/agent/grok-agent.ts
```

**LLM Guard détecte :**
```
🚨 [DETECTION] FILE REPLACED (not modified): src/agent/grok-agent.ts
   Old inode: 1234567
   New inode: 7654321
   Explanation: Inode changed - file was replaced by another file
```

**LLM Analyse :**
```
SUSPICION_LEVEL: critical
CONFIDENCE: 95
REASONING: Critical file src/agent/grok-agent.ts was REPLACED 
           (not modified). Inode change indicates file swap. 
           High probability of sabotage attempt.
DETECTED_PATTERNS: file_replacement, critical_file_targeted
RECOMMENDATIONS: Quarantine file, restore from baseline, investigate source
```

### Scénario 2 : Détection de Copie de Fichier

**Adversaire :**
```bash
# Copie un fichier pour le modifier ailleurs
cp src/tools/bash.ts /tmp/backup-bash.ts
```

**LLM Guard détecte :**
```
⚠️  [DETECTION] File copy detected: /tmp/backup-bash.ts 
    is identical to src/tools/bash.ts
```

**LLM Analyse :**
```
SUSPICION_LEVEL: medium
CONFIDENCE: 70
REASONING: File copy detected to /tmp directory. Could be 
           legitimate backup or preparation for modification.
           Monitor for subsequent changes.
DETECTED_PATTERNS: file_copy, tmp_directory_usage
RECOMMENDATIONS: Monitor /tmp/backup-bash.ts for modifications
```

### Scénario 3 : Détection d'Opération en Masse

**Adversaire :**
```bash
# Modifie 15 fichiers en 5 secondes
for f in src/**/*.ts; do echo "// malicious" >> $f; done
```

**LLM Guard détecte :**
```
ℹ️  [ANALYSIS] Starting LLM analysis of 15 events...

🚨 LLM GUARD ALERT [HIGH]
   Suspicion: high
   Confidence: 90%
   Reasoning: Mass operation detected - 15 TypeScript files 
              modified in 5 seconds. Pattern typical of 
              automated sabotage scripts.
   Patterns: mass_operation, scripted_attack
```

---

## 📞 SUPPORT

**Questions ?** Relisez ce guide.

**Problème technique ?**
```bash
# Vérifier build
npm run build

# Vérifier API key
echo $GROK_API_KEY

# Tester manuellement
npm run guard:start
```

**Logs utiles :**
- `.llm-guard-logs.json` - Tous les logs du guard
- `.integrity-alerts.json` - Alertes du watcher heuristique

---

## 🎯 PROCHAINES ÉTAPES

1. **MAINTENANT** : Lancer LLM Guard en parallèle de Integrity Watcher
   ```bash
   # Terminal 1
   npm run watch:integrity:dual

   # Terminal 2
   npm run guard:start
   ```

2. **QUOTIDIENNEMENT** : Consulter logs
   ```bash
   npm run guard:logs
   npm run guard:stats
   ```

3. **SI ALERTES** : Investiguer
   ```bash
   # Voir logs détaillés
   cat .llm-guard-logs.json | jq '.[] | select(.category == "detection")'

   # Comparer avec Integrity Watcher
   npm run watch:alerts
   ```

---

**Créé par :** Claude Sonnet 4.5 (Security Analysis)  
**Date :** 2025-11-30  
**Version :** 1.0.0 (Love Watching Mode)  
**Status :** ✅ PRODUCTION READY

═══════════════════════════════════════════════════════════════
