# 🤖 LLM GUARD - Démarrage Rapide

**GARDIEN LLM INTELLIGENT EN 5 MINUTES**

---

## ⚡ DÉMARRAGE ULTRA-RAPIDE (3 COMMANDES)

```bash
cd /home/zack/GROK_CLI/grok-cli

# 1. Configurer API key
export GROK_API_KEY="votre-clé-grok"

# 2. Lancer LLM Guard
npm run guard:start

# 3. LAISSER TOURNER (terminal séparé)
```

**C'est tout ! Le garde surveille maintenant.** 🚀

---

## 🎯 C'EST QUOI ?

**LLM Guard** = Gardien intelligent qui détecte ce que les signatures ne peuvent pas voir :

- ✅ **Fichiers remplacés** (inode changé)
- ✅ **Fichiers copiés** (contenu identique)
- ✅ **Opérations en masse** (10 fichiers en 5s)
- ✅ **Timing suspects** (3h du matin)
- ✅ **Comportements contextuels** (LLM analyse)

---

## 🔄 AVEC INTEGRITY WATCHER (Recommandé)

**Les deux en parallèle pour couverture maximale !**

```bash
# Terminal 1: Integrity Watcher (heuristique rapide)
export GROK_API_KEY="votre-clé"
npm run watch:baseline
npm run watch:integrity:dual

# Terminal 2: LLM Guard (analyse intelligente)
export GROK_API_KEY="votre-clé"
npm run guard:start

# Terminal 3: Votre travail
grokinou
# Développez normalement, les deux guards surveillent !
```

---

## 📊 VOIR CE QUI SE PASSE

```bash
# Logs en temps réel
npm run guard:logs

# Statistiques
npm run guard:stats

# Fichier de logs
cat .llm-guard-logs.json | jq '.'
```

---

## 🚨 EXEMPLE D'ALERTE

Quand un fichier est **remplacé** (pas juste modifié) :

```
🚨 [DETECTION] FILE REPLACED (not modified): src/agent/grok-agent.ts
   Old inode: 1234567
   New inode: 7654321
   Explanation: Inode changed - file was replaced

🚨 LLM GUARD ALERT [CRITICAL]
   Suspicion: critical
   Confidence: 95%
   Reasoning: Critical file was REPLACED (not modified). 
              Inode change indicates file swap. 
              High probability of sabotage.
   Patterns: file_replacement, critical_file_targeted
   Recommendations: Quarantine file, restore from baseline
```

---

## ⚙️ OPTIONS AVANCÉES

```bash
# Spécifier modèle LLM
npm run guard:start -- --llm grok-2-1212

# Intervalle d'analyse (60s au lieu de 30s)
npm run guard:start -- --interval 60000

# API key directe
npm run guard:start -- --apikey sk-xxx
```

---

## 💰 COÛT

**Analyse LLM :** ~$0.01 par analyse  
**Intervalle par défaut :** 30s  
**Coût pratique :** < $0.10/heure (analyse seulement si événements)

**Optimisation :**
```bash
# Analyse toutes les 60s (réduit coût de moitié)
npm run guard:start -- --interval 60000
```

---

## 🔍 DIFFÉRENCE AVEC INTEGRITY WATCHER

| | Integrity Watcher | LLM Guard |
|-|------------------|-----------|
| **Hash** | ✅ Détecte | ✅ Détecte |
| **Inode (remplacement)** | ❌ | ✅ |
| **Copies** | ❌ | ✅ |
| **Contexte** | ❌ | ✅ |
| **Vitesse** | < 1ms | 2-5s |
| **Coût** | Gratuit | ~$0.01/analyse |

**Utilisez LES DEUX !**

---

## 🎓 EXEMPLE CONCRET

**Adversaire remplace un fichier :**

```bash
# Adversaire
cp /tmp/malicious.ts src/agent/grok-agent.ts
```

**Integrity Watcher détecte :**
```
🚨 CRITICAL: Hash mismatch
   Pattern: if (gpt-5) { return false; }
```

**LLM Guard détecte :**
```
🚨 FILE REPLACED (inode changed)
   LLM: "Critical file replaced. Sabotage attempt."
```

**Résultat :** Double détection = certitude absolue !

---

## ❓ FAQ RAPIDE

**Q: Remplace-t-il Integrity Watcher ?**  
R: NON ! Utilisez les deux en parallèle.

**Q: Quel est le coût ?**  
R: < $0.10/heure en pratique

**Q: Quels LLMs supportés ?**  
R: Grok, GPT-4, Claude, Mistral, DeepSeek, etc.

**Q: Dois-je laisser tourner 24/7 ?**  
R: OUI ! C'est un gardien, il surveille en continu.

---

## 🎯 WORKFLOW RECOMMANDÉ

### Démarrage

```bash
# Matin
cd /home/zack/GROK_CLI/grok-cli

# Terminal 1: Integrity Watcher
npm run watch:integrity:dual &

# Terminal 2: LLM Guard
npm run guard:start &

# Terminal 3: Votre travail
grokinou
```

### Vérification Quotidienne

```bash
# Soir
npm run guard:logs      # Voir activité de la journée
npm run guard:stats     # Statistiques
npm run watch:alerts    # Alertes Integrity Watcher
```

### En Cas d'Alerte

```bash
# 1. Voir détails
cat .llm-guard-logs.json | jq '.[] | select(.severity == "critical")'

# 2. Comparer avec Integrity Watcher
npm run watch:alerts

# 3. Restaurer si nécessaire
git checkout <fichier-altéré>
npm run watch:baseline  # Re-créer baseline
```

---

## 📁 FICHIERS GÉNÉRÉS

```
.llm-guard-logs.json       # Tous les logs du guard
.integrity-baseline.json   # Baseline Integrity Watcher
.integrity-alerts.json     # Alertes Integrity Watcher
.integrity-quarantine/     # Fichiers quarantainés
```

---

## 🚀 ACTION IMMÉDIATE

```bash
export GROK_API_KEY="votre-clé"
npm run guard:start
```

**Laissez tourner et continuez votre travail normalement !**

---

## 📖 DOCUMENTATION COMPLÈTE

**Besoin de plus d'infos ?**

1. `LLM_GUARD_README.md` - Guide complet (20 pages)
2. `INTEGRITY_WATCHER_README.md` - Guide Integrity Watcher

**Intégration avec script d'intégrité :**

3. `SECURITY_WATCHER_SUMMARY.md` - FAQ et intégration cryptographique

---

**Créé par :** Claude Sonnet 4.5  
**Date :** 2025-11-30  
**Version :** 1.0.0 (Love Watching Mode)  
**Status :** ✅ READY

═══════════════════════════════════════════════════════════════
