# 📚 Cas d'Usage Réel : WDIMQ + ColPali + TenderWatch

## 🎯 Contexte Historique

### **Le Problème Rencontré**

Tu as développé plusieurs projets interconnectés :
- **WDIMQ** : Projet principal
- **ColPali** : Sous-projet (recherche visuelle)
- **TenderWatch** : Projet séparé (scraping)
- **QWEN** : Intégration modèle

**Symptômes :**
```
❌ "Le LLM ne sait plus dans quel répertoire il travaille"
❌ Session unique avec 300+ messages mélangés
❌ Contexte pollué entre projets
❌ Impossible de travailler proprement sur ColPali seul
❌ Confusion constante entre WDIMQ / ColPali / TenderWatch
```

---

## ✅ Solution Implémentée : Git-Like Session Branching

### **Phase 1 : Diagnostic**

```bash
cd ~/WDIMQ
grokinou-cli
/list_sessions

# Résultat :
# Session #1 - 300 messages
#   Oct 25: WDIMQ principal
#   Nov 1-10: ColPali
#   Nov 10-20: TenderWatch
#   Nov 20-25: Retour WDIMQ
#   → TOUT MÉLANGÉ
```

### **Phase 2 : Extraction Chirurgicale**

#### **Étape 1 : Isoler ColPali**

```bash
cd ~/WDIMQ
grokinou-cli

/new-session --directory ~/WDIMQ/ColPali \
             --from-session 1 \
             --from-date 01/11/2025 \
             --to-date 10/11/2025

# Résultat : Session #2
✅ New Session Created #2

📂 Working Directory: /home/zack/WDIMQ/ColPali
   (Created in new directory)
🤖 Provider: openai
📱 Model: gpt-4o
💬 Messages: 40 (imported)

📋 **History Imported**
   Source: Session #1
   Date Range: 01/11/2025 → 10/11/2025
   Messages: 40 imported

# Maintenant :
# - Répertoire ~/WDIMQ/ColPali créé
# - Session avec SEULEMENT les discussions ColPali
# - Pas de messages WDIMQ ni TenderWatch
```

#### **Étape 2 : Isoler TenderWatch**

```bash
/new-session --directory ~/TenderWatch \
             --from-session 1 \
             --from-date 10/11/2025 \
             --to-date 20/11/2025

# Résultat : Session #3
✅ New Session Created #3

📂 Working Directory: /home/zack/TenderWatch
   (Created in new directory)
🤖 Provider: openai
📱 Model: gpt-4o
💬 Messages: 50 (imported)

📋 **History Imported**
   Source: Session #1
   Date Range: 10/11/2025 → 20/11/2025
   Messages: 50 imported

# Maintenant :
# - Répertoire ~/TenderWatch créé
# - Session avec SEULEMENT les discussions TenderWatch
# - Pas de messages WDIMQ ni ColPali
```

#### **Étape 3 : WDIMQ Pur (Sans Sous-Projets)**

```bash
/new-session --directory ~/WDIMQ-pure \
             --from-session 1 \
             --to-date 31/10/2025

# Résultat : Session #4
✅ New Session Created #4

📂 Working Directory: /home/zack/WDIMQ-pure
   (Created in new directory)
🤖 Provider: openai
📱 Model: gpt-4o
💬 Messages: 150 (imported)

📋 **History Imported**
   Source: Session #1
   Date Range: (début) → 31/10/2025
   Messages: 150 imported

# Maintenant :
# - Répertoire ~/WDIMQ-pure créé
# - Session avec SEULEMENT WDIMQ avant les sous-projets
# - État "pur" du projet principal
```

---

### **Phase 3 : Navigation Propre**

```bash
# Travailler sur ColPali
cd ~/WDIMQ/ColPali
grokinou-cli
# → Session #2 (40 messages ColPali)
# → Le LLM connaît SEULEMENT ColPali
# → Paths relatifs corrects

User: "Optimise la vectorisation des images"
Assistant: [Contexte 100% ColPali, pas de confusion]

# Travailler sur TenderWatch
cd ~/TenderWatch
grokinou-cli
# → Session #3 (50 messages TenderWatch)
# → Le LLM connaît SEULEMENT TenderWatch
# → process.cwd() = ~/TenderWatch

User: "Ajoute le parsing des PDF"
Assistant: [Contexte 100% TenderWatch]

# Travailler sur WDIMQ pur
cd ~/WDIMQ-pure
grokinou-cli
# → Session #4 (150 messages WDIMQ)
# → Le LLM connaît SEULEMENT WDIMQ principal
# → Pas de pollution ColPali/TenderWatch

User: "Continue le système de recherche principal"
Assistant: [Contexte 100% WDIMQ, focus principal]

# Session originale toujours disponible
cd ~/WDIMQ
grokinou-cli
# → Session #1 (300 messages complets)
# → Historique complet intact
```

---

## 📊 Résultat : Arborescence Clarifiée

### **Structure des Répertoires**

```
~/WDIMQ/
├── Session #1 (300 messages - TOUT)
├── Session originale intacte
└── ColPali/
    └── Session #2 (40 messages - ColPali only)

~/WDIMQ-pure/
└── Session #4 (150 messages - WDIMQ avant sous-projets)

~/TenderWatch/
└── Session #3 (50 messages - TenderWatch only)
```

### **Mapping Logique**

| Répertoire | Session | Messages | Contexte |
|-----------|---------|----------|----------|
| `~/WDIMQ` | #1 | 300 | Tout mélangé (historique) |
| `~/WDIMQ/ColPali` | #2 | 40 | ColPali pur (1-10 nov) |
| `~/TenderWatch` | #3 | 50 | TenderWatch pur (10-20 nov) |
| `~/WDIMQ-pure` | #4 | 150 | WDIMQ avant sous-projets |

---

## 🎯 Problèmes Résolus

### **Avant : Confusion Totale**

```
❌ cd ~/WDIMQ
❌ grokinou-cli
❌ User: "Continue ColPali"
❌ LLM: [Confus, mélange avec WDIMQ et TenderWatch]
❌ LLM: "Je cherche src/api.ts" (mais dans quel projet?)
❌ Paths incorrects, contexte pollué
```

### **Après : Clarté Absolue**

```
✅ cd ~/WDIMQ/ColPali
✅ grokinou-cli
✅ User: "Continue ColPali"
✅ LLM: [Contexte 100% ColPali, 0 confusion]
✅ LLM: "Je cherche src/colpali/api.ts" (clair!)
✅ Paths corrects, contexte pur
```

---

## 🔮 Future : Git Rewind Integration

### **Vision Complète**

```bash
# Rewind complet : Conversation + Code
/new-session --directory ~/rewind-03-nov \
             --from-session 1 \
             --date-range 01/11 03/11 \
             --git-rewind  # FUTUR FLAG

# Ce que ça fera :
# 1. ✅ Créer session avec messages du 01-03 nov
# 2. 🔜 git log --since="01/11/2025" --until="03/11/2025"
# 3. 🔜 git diff <commit-01-nov> <commit-03-nov>
# 4. 🔜 Copier les fichiers modifiés
# 5. 🔜 État COMPLET (conversation + code) du 3 nov

# Résultat :
# ~/rewind-03-nov/
# ├── Messages de la conversation (01-03 nov)
# └── Code dans l'état du 3 nov
#     → Synchronisation parfaite
```

### **Cas d'Usage Git Rewind**

```bash
# WDIMQ au 15 octobre (avant ColPali)
/new-session --directory ~/WDIMQ-oct-15 \
             --from-session 1 \
             --to-date 15/10/2025 \
             --git-rewind

# Résultat :
# ~/WDIMQ-oct-15/
# ├── Conversation : Messages jusqu'au 15 oct
# └── Code : État du 15 octobre (avant modifications ColPali)
#     → Peut retravailler depuis cet état "checkpoint"
#     → Aucune modification du repo GitHub principal
```

---

## 🎓 Workflow Recommandé

### **Pour WDIMQ / ColPali / TenderWatch**

**1. Nettoyer l'Historique Actuel**
```bash
cd ~/WDIMQ
grokinou-cli
/list_sessions
# Identifier la session "mixte" (ex: Session #1)
```

**2. Créer Sessions Isolées**
```bash
# ColPali
/new-session --directory ~/WDIMQ/ColPali \
             --from-session 1 \
             --date-range 01/11/2025 10/11/2025

# TenderWatch
/new-session --directory ~/TenderWatch \
             --from-session 1 \
             --date-range 10/11/2025 20/11/2025

# WDIMQ pur
/new-session --directory ~/WDIMQ-pure \
             --from-session 1 \
             --to-date 31/10/2025
```

**3. Développement Séparé**
```bash
# Focus ColPali
cd ~/WDIMQ/ColPali
grokinou-cli --model deepseek-chat
# → Contexte ColPali pur

# Focus TenderWatch  
cd ~/TenderWatch
grokinou-cli --model gpt-4o
# → Contexte TenderWatch pur

# Focus WDIMQ
cd ~/WDIMQ-pure
grokinou-cli --model claude-3-5-sonnet-20241022
# → Contexte WDIMQ pur
```

**4. Garder l'Original comme Référence**
```bash
cd ~/WDIMQ
grokinou-cli
# → Session #1 complète (300 messages)
# → Historique complet comme documentation
```

---

## 📊 Comparaison : Avant / Après

### **Avant (Situation Problématique)**

```
~/WDIMQ/
├── .grok/
│   └── Session #1 (300 messages)
│       - Oct : WDIMQ
│       - Nov 1-10 : ColPali
│       - Nov 10-20 : TenderWatch
│       - Nov 20+ : Retour WDIMQ
│       → CONTEXTE POLLUÉ

└── ColPali/ (sous-répertoire)
    └── Pas de session séparée
        → LLM confus sur le contexte
```

**Problèmes :**
- ❌ Impossible de travailler uniquement sur ColPali
- ❌ LLM mélange les 3 projets
- ❌ Paths incorrects (~/WDIMQ vs ~/TenderWatch)
- ❌ "Le LLM ne sait plus où il travaille"

### **Après (Solution Git-Like)**

```
~/WDIMQ/
├── .grok/
│   └── Session #1 (300 messages - INTACTE, référence)
│
├── ColPali/
│   └── .grok/
│       └── Session #2 (40 messages - SEULEMENT ColPali)
│           ✅ Contexte pur
│           ✅ Dates : 01-10 nov
│
~/WDIMQ-pure/
└── .grok/
    └── Session #4 (150 messages - WDIMQ avant sous-projets)
        ✅ État "pur" du projet
        ✅ Dates : avant 31 oct

~/TenderWatch/
└── .grok/
    └── Session #3 (50 messages - SEULEMENT TenderWatch)
        ✅ Contexte pur
        ✅ Dates : 10-20 nov
```

**Avantages :**
- ✅ Chaque projet dans son répertoire
- ✅ Contexte isolé et pur
- ✅ Paths toujours corrects
- ✅ LLM sait EXACTEMENT où il travaille
- ✅ Navigation claire entre projets

---

## 🚀 Commandes Exactes pour Ton Cas

### **Étape 1 : Identifier la Session Source**

```bash
cd ~/WDIMQ
grokinou-cli
/list_sessions

# Output exemple :
# Session #1 - "Implémente WDIMQ..." 
#   Working Directory: /home/zack/WDIMQ
#   Messages: 300
#   Created: Oct 25, 2025
```

### **Étape 2 : Extraire ColPali (1-10 Nov)**

```bash
/new-session --directory ~/WDIMQ/ColPali \
             --from-session 1 \
             --from-date 01/11/2025 \
             --to-date 10/11/2025

# ✅ Session #2 créée
# ✅ Répertoire ~/WDIMQ/ColPali créé
# ✅ 40 messages ColPali importés
# ✅ Contexte pur
```

### **Étape 3 : Extraire TenderWatch (10-20 Nov)**

```bash
/new-session --directory ~/TenderWatch \
             --from-session 1 \
             --from-date 10/11/2025 \
             --to-date 20/11/2025

# ✅ Session #3 créée
# ✅ Répertoire ~/TenderWatch créé
# ✅ 50 messages TenderWatch importés
# ✅ Contexte pur
```

### **Étape 4 : WDIMQ Pur (Avant Sous-Projets)**

```bash
/new-session --directory ~/WDIMQ-pure \
             --from-session 1 \
             --to-date 31/10/2025

# ✅ Session #4 créée
# ✅ Répertoire ~/WDIMQ-pure créé
# ✅ 150 messages WDIMQ importés
# ✅ État avant ColPali/TenderWatch
```

### **Étape 5 : Vérification**

```bash
/list_sessions

# Output :
# Session #1 - WDIMQ (300 messages) - /home/zack/WDIMQ
# Session #2 - ColPali (40 messages) - /home/zack/WDIMQ/ColPali
# Session #3 - TenderWatch (50 messages) - /home/zack/TenderWatch
# Session #4 - WDIMQ-pure (150 messages) - /home/zack/WDIMQ-pure
```

---

## 🔄 Workflow de Développement

### **Jour J : Travailler sur ColPali**

```bash
cd ~/WDIMQ/ColPali
grokinou-cli

# Démarre Session #2 (40 messages ColPali)
User: "Optimise la vectorisation des images"
Assistant: [Focus 100% ColPali, 0 confusion]

User: "Ajoute support pour CLIP"
Assistant: [Contexte ColPali pur]

# Tous les paths relatifs corrects
# process.cwd() = ~/WDIMQ/ColPali
# Le LLM sait qu'il est dans ColPali
```

### **Jour J+1 : Travailler sur TenderWatch**

```bash
cd ~/TenderWatch
grokinou-cli

# Démarre Session #3 (50 messages TenderWatch)
User: "Ajoute le parsing des PDF"
Assistant: [Focus 100% TenderWatch]

User: "Intègre l'API BOAMP"
Assistant: [Contexte TenderWatch pur]

# process.cwd() = ~/TenderWatch
# Le LLM sait qu'il est dans TenderWatch
```

### **Jour J+2 : Retour WDIMQ Principal**

```bash
cd ~/WDIMQ-pure
grokinou-cli

# Démarre Session #4 (150 messages WDIMQ pur)
User: "Continue le système de recherche principal"
Assistant: [Focus 100% WDIMQ, sans ColPali/TenderWatch]

# process.cwd() = ~/WDIMQ-pure
# Contexte WDIMQ principal uniquement
```

---

## 🎯 Commandes de Navigation

```bash
# Liste complète
/list_sessions

# Basculer vers ColPali
/switch-session 2
# → Change automatiquement vers ~/WDIMQ/ColPali
# → Charge les 40 messages ColPali
# → Contexte ColPali restauré

# Basculer vers TenderWatch
/switch-session 3
# → Change automatiquement vers ~/TenderWatch
# → Charge les 50 messages TenderWatch
# → Contexte TenderWatch restauré

# Basculer vers WDIMQ pur
/switch-session 4
# → Change automatiquement vers ~/WDIMQ-pure
# → Charge les 150 messages WDIMQ
# → Contexte WDIMQ restauré
```

---

## 📈 Avant / Après en Chiffres

| Métrique | **AVANT** | **APRÈS** |
|----------|----------|----------|
| **Sessions par projet** | 1 (mixte) | 4 (isolées) |
| **Confusion contexte** | ❌ Élevée | ✅ Zéro |
| **Messages ColPali** | 40 (noyés dans 300) | 40 (isolés) |
| **Messages TenderWatch** | 50 (noyés dans 300) | 50 (isolés) |
| **Messages WDIMQ pur** | 150 (mélangés) | 150 (isolés) |
| **Paths corrects** | ❌ Souvent faux | ✅ Toujours corrects |
| **Navigation** | ❌ Impossible | ✅ Fluide |
| **Clarté pour le LLM** | ❌ Confus | ✅ Cristallin |

---

## 🔮 Future : Git Rewind (Phase 4.3)

### **Objectif**

Combiner le rewind de conversation avec le rewind Git des fichiers.

### **Exemple Concret : ColPali au 5 Novembre**

```bash
# Je veux ColPali exactement comme il était le 5 nov
# Conversation + Code

/new-session --directory ~/ColPali-05-nov \
             --from-session 1 \
             --to-date 05/11/2025 \
             --git-rewind  # FUTUR

# Ce que ça fera :
# 1. Créer ~/ColPali-05-nov/
# 2. Importer messages jusqu'au 5 nov (disons 25 messages)
# 3. git log --until="05/11/2025" → Trouver commit du 5 nov
# 4. git diff <commit-initial> <commit-05-nov>
# 5. Copier TOUS les fichiers dans l'état du 5 nov
# 6. Créer .git-rewind-info.json avec infos

# Résultat :
# ~/ColPali-05-nov/
# ├── .grok/
# │   └── Session avec 25 messages (jusqu'au 5 nov)
# ├── src/ (état du 5 nov)
# ├── package.json (état du 5 nov)
# └── .git-rewind-info.json
#     {
#       "rewind_date": "2025-11-05",
#       "source_session": 1,
#       "git_commit": "abc123",
#       "files_copied": 45
#     }
```

**Avantages Git Rewind :**
- ✅ Conversation ET code synchronisés à la date T
- ✅ État complet reproductible
- ✅ Pas de modification du repo GitHub principal
- ✅ Checkpoint parfait pour itération

---

## 🎉 Conclusion

**Le problème "Le LLM ne sait plus dans quel répertoire il travaille" est maintenant 100% RÉSOLU.**

**Avant :**
- ❌ 1 session mixte
- ❌ 300 messages mélangés
- ❌ Confusion constante
- ❌ Paths incorrects

**Après :**
- ✅ 4 sessions isolées
- ✅ Contextes purs par projet
- ✅ Clarté absolue
- ✅ Paths toujours corrects
- ✅ Navigation fluide

**En Une Commande :**
```bash
/new-session --directory ~/WDIMQ/ColPali \
             --from-session 1 \
             --date-range 01/11/2025 10/11/2025
```

**Tu obtiens :**
- ✅ Nouveau répertoire
- ✅ Contexte ColPali pur (40 messages)
- ✅ Zero confusion
- ✅ Prêt à développer

---

**Cette fonctionnalité Git-like transforme Grokinou en un véritable système de version control pour les conversations. 🚀**

---

**Date:** 2025-11-25  
**Version:** 0.1.0  
**Commits:** 0fd499d, 553ec4c  
**Phase:** 4.2 Complete
