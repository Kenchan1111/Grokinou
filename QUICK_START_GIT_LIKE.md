# 🚀 Quick Start : Git-Like Conversations

## ⚡ En 30 Secondes

```bash
# Créer une nouvelle session dans un AUTRE répertoire
/new-session --directory ~/nouveau-projet

# Revenir à un état de conversation précis
/new-session --from-session 5 --date-range 01/11/2025 03/11/2025

# Brancher avec tout l'historique
/new-session --directory ~/branche --import-history
```

---

## 🎯 Ton Cas d'Usage Immédiat

### **Nettoyer WDIMQ / ColPali / TenderWatch**

Tu as une session mixte avec 300 messages ? Voici comment la séparer :

```bash
cd ~/WDIMQ
grokinou-cli

# 1. Extraire ColPali (1-10 nov)
/new-session --directory ~/WDIMQ/ColPali \
             --from-session 1 \
             --date-range 01/11/2025 10/11/2025

# 2. Extraire TenderWatch (10-20 nov)
/new-session --directory ~/TenderWatch \
             --from-session 1 \
             --date-range 10/11/2025 20/11/2025

# 3. WDIMQ pur (avant tout)
/new-session --directory ~/WDIMQ-pure \
             --from-session 1 \
             --to-date 31/10/2025

# 4. Navigation
cd ~/WDIMQ/ColPali && grokinou-cli  # ColPali pur
cd ~/TenderWatch && grokinou-cli    # TenderWatch pur
cd ~/WDIMQ-pure && grokinou-cli     # WDIMQ pur
```

**Résultat : 0 confusion, contextes isolés ! ✅**

---

## 📋 Options Principales

### **--directory <path>**
```bash
# Créer session dans un nouveau répertoire
/new-session --directory ~/nouveau-projet
/new-session --directory ../autre-projet
```

### **--from-session <id>**
```bash
# Importer depuis session spécifique
/new-session --from-session 5
```

### **--date-range <start> <end>**
```bash
# Importer seulement messages entre 2 dates
/new-session --date-range 01/11/2025 03/11/2025
/new-session --from-date 01/11/2025 --to-date 03/11/2025
```

### **--model / --provider**
```bash
# Changer de modèle dans la nouvelle session
/new-session --model deepseek-chat
/new-session --provider claude
```

---

## 🌳 Analogie Git

| Ce que tu fais | Git | Grokinou |
|----------------|-----|----------|
| Créer une branche | `git checkout -b feature` | `/new-session --directory ~/feature` |
| Revenir en arrière | `git reset --hard abc123` | `/new-session --date-range <start> <end>` |
| Lister les branches | `git branch` | `/list_sessions` |
| Basculer de branche | `git checkout main` | `/switch-session <id>` |

---

## 💡 Use Cases Rapides

### **Rewind à un État**
```bash
/new-session --date-range 01/11/2025 03/11/2025
```
→ Conversation comme elle était le 3 novembre

### **Branch vers Nouveau Répertoire**
```bash
/new-session --directory ~/v2 --import-history
```
→ Nouveau répertoire, historique complet

### **Extraction Chirurgicale**
```bash
/new-session --from-session 8 --from-date 15/11/2025
```
→ Session 8, seulement après le 15 nov

### **Combinaison Complète**
```bash
/new-session --directory ~/rewind \
             --from-session 5 \
             --date-range 01/11 03/11 \
             --model deepseek-chat
```
→ Nouveau répertoire + session 5 + 1-3 nov + DeepSeek

---

## 📖 Documentation Complète

- **Guide complet** : `docs/GIT_LIKE_CONVERSATIONS.md` (669 lignes)
- **Ton cas d'usage** : `docs/WDIMQ_CASE_STUDY.md` (644 lignes)
- **Guide /new-session** : `docs/NEW_SESSION_GUIDE.md` (428 lignes)
- **Guide /switch-session** : `docs/SWITCH_SESSION_USE_CASES.md` (464 lignes)

---

## ⚡ Test Rapide

```bash
# 1. Créer session test
cd /tmp/test-git-like
grokinou-cli
User: "Message 1"
User: "Message 2"
User: "Message 3"

# 2. Brancher
/new-session --directory /tmp/branch-test --import-history

# 3. Vérifier
/list_sessions
# → 2 sessions dans 2 répertoires différents

# 4. Switch
/switch-session 1
# → Retour à /tmp/test-git-like

/switch-session 2
# → Va vers /tmp/branch-test
```

---

## 🎉 Résumé

**Tu as maintenant Git pour les conversations ! 🚀**

```bash
/new-session --directory <où> \
             --from-session <quelle session> \
             --date-range <quand>

= Branching + Time Travel + Context Isolation
```

**C'est révolutionnaire. 🔥**

---

**Date:** 2025-11-25  
**Version:** 0.1.0
