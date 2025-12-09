# 🔄 `/switch-session` - Guide d'Utilisation & Cas d'Usage

## 🎯 Qu'est-ce que `/switch-session` ?

La commande `/switch-session <id>` permet de **basculer instantanément entre différentes conversations** dans le même répertoire, tout en **préservant l'intégralité du contexte et de l'historique** de chaque session.

---

## 🤔 Pourquoi "switch-session" et pas juste "switch" ?

**Clarté et Non-Ambiguïté :**
- ❌ `/switch` → Switch quoi ? Le modèle ? Le provider ? Le projet ?
- ✅ `/switch-session` → **Explicite et clair** : on change de session/conversation

**Cohérence avec les autres commandes :**
- `/list_sessions` - Liste les sessions
- `/switch-session` - Change de session
- `/new-session` - Crée une session (à venir)

---

## 💡 Cas d'Usage Concrets

### **1. Travail Multi-Tâches sur le Même Projet**

**Scénario :** Tu travailles sur plusieurs features en parallèle

```bash
cd ~/mon-projet

# Session 1 : Feature A (Authentification OAuth)
grokinou-cli
User: "Implémente l'authentification OAuth avec Google"
Assistant: [Discussion approfondie, 50 messages sur l'auth...]

# Nouveau contexte : Feature B (API REST)
/new-session
User: "Crée une API REST pour gérer les utilisateurs"
Assistant: [Discussion sur l'API, 30 messages...]

# Tu veux revenir à l'auth OAuth
/list_sessions
# Session #1 - Nov 25, 10:00 AM - "Implémente l'authentification OAuth..."
# Session #2 - Nov 25, 11:30 AM - "Crée une API REST pour gérer..."

/switch-session 1
# → Tout le contexte de l'auth est restauré
# → Le LLM se souvient de tous les détails techniques discutés
```

**Avantages :**
- ✅ Contexte **100% préservé** pour chaque feature
- ✅ Pas de confusion entre les deux sujets
- ✅ Historique complet accessible instantanément

---

### **2. Débogage vs Développement**

**Scénario :** Session séparée pour debug urgent

```bash
cd ~/mon-app

# Session principale : Développement normal
grokinou-cli
User: "Ajoute un système de notifications push"
Assistant: [Discussion sur les notifications...]

# BUG URGENT : Problème de performance en production
/new-session
User: "Bug urgent : timeout sur les requêtes SQL"
Assistant: "Analysons les logs... [Debug intense]"

# Une fois le bug fixé, retour au dev
/switch-session 1
# → Reprends exactement où tu t'étais arrêté sur les notifications
```

**Avantages :**
- ✅ Session de debug **isolée** (pas de pollution du contexte principal)
- ✅ Historique du debug **conservé** pour post-mortem
- ✅ Retour instantané au développement en cours

---

### **3. Expérimentation vs Code Stable**

**Scénario :** Tester une idée radicale sans risquer le code principal

```bash
cd ~/projet-stable

# Session "production" : Code stable, testé
grokinou-cli --model gpt-4o
User: "Optimise les performances du parser"
Assistant: [Optimisations incrémentales...]

# Session "expériment" : Refonte complète avec un autre modèle
/new-session --model deepseek-chat
User: "Réécris le parser en utilisant un AST complet"
Assistant: [Expérimentation radicale avec DeepSeek...]

# Comparaison des deux approches
/switch-session 1  # Voir l'approche incrémentale
/switch-session 2  # Voir l'approche radicale

# Choisis la meilleure et continue
```

**Avantages :**
- ✅ Expérimentation **sans risque**
- ✅ Comparaison facile des approches
- ✅ Modèles différents pour chaque session (GPT-4 vs DeepSeek)

---

### **4. Collaboration Asynchrone**

**Scénario :** Travail d'équipe sur un projet partagé

```bash
# Alice crée une session pour documenter son travail
cd ~/projet-equipe
grokinou-cli
User (Alice): "Documente l'architecture du système de cache"
Assistant: [Génération de docs complète...]
# Alice crée 40 messages d'historique technique

# Bob arrive le lendemain
cd ~/projet-equipe
grokinou-cli
/list_sessions
# Session #5 - Nov 25 by Alice - "Documente l'architecture..."

/switch-session 5
# → Bob accède à TOUTE la conversation d'Alice
# → Contexte complet pour continuer le travail
User (Bob): "Ajoute des exemples de code pour le cache Redis"
```

**Avantages :**
- ✅ **Continuité parfaite** du travail entre collègues
- ✅ Pas besoin de réexpliquer le contexte
- ✅ Historique complet = documentation vivante

---

### **5. Revenir sur une Discussion Passée**

**Scénario :** Tu as besoin de retrouver une décision technique prise il y a 2 semaines

```bash
cd ~/mon-projet

/list_sessions
# Session #3 - Nov 10 - "Choix de la base de données..."
# Session #8 - Nov 22 - "Optimisation des requêtes..."
# Session #12 - Nov 25 - "Nouveau système de cache..."

# Tu veux revoir pourquoi tu as choisi PostgreSQL
/switch-session 3

# Toute la discussion sur le choix de BDD est restaurée
# → Relire les arguments
# → Continuer la discussion avec de nouvelles questions
User: "Avec le recul, aurions-nous dû choisir MongoDB ?"
```

**Avantages :**
- ✅ **Mémoire institutionnelle** du projet
- ✅ Décisions techniques **justifiées et documentées**
- ✅ Apprentissage des erreurs passées

---

### **6. Sessions Thématiques**

**Scénario :** Organisation par domaine technique

```bash
cd ~/mon-app

# Session "Frontend"
grokinou-cli
User: "Crée un design system avec Tailwind"
[...historique frontend...]

# Session "Backend"
/new-session
User: "Architecture microservices avec Node.js"
[...historique backend...]

# Session "DevOps"
/new-session
User: "Configuration Docker + Kubernetes"
[...historique devops...]

# Navigation facile entre domaines
/list_sessions
/switch-session <id-frontend>  # Focus UI
/switch-session <id-backend>   # Focus API
/switch-session <id-devops>    # Focus infra
```

**Avantages :**
- ✅ **Séparation claire** des préoccupations
- ✅ Contexte **spécialisé** par domaine
- ✅ Évite les confusions entre frontend/backend/infra

---

## ⚠️ Fonctionnalité Critique : Changement Automatique de Répertoire

### **Pourquoi c'est Important**

Quand tu fais `/switch-session <id>`, le CLI change **AUTOMATIQUEMENT** le répertoire de travail (CWD) du process Node pour correspondre au `working_dir` de la session cible.

**Pourquoi c'est CRITIQUE :**

```bash
# Scénario problématique SANS changement de répertoire :
cd ~/WDIMQ
grokinou-cli
# Session 1 créée dans ~/WDIMQ

cd ~/TenderWatch
grokinou-cli
# Session 2 créée dans ~/TenderWatch

cd ~/WDIMQ
grokinou-cli
/switch-session 2  # Session de TenderWatch

# 💥 PROBLÈME :
# - LLM pense être dans ~/TenderWatch (contexte de la session)
# - MAIS Node est dans ~/WDIMQ (CWD réel)
# - Tous les paths relatifs sont FAUX
# - bash, file editor travaillent dans le MAUVAIS répertoire
```

**Avec changement automatique de répertoire :**

```bash
cd ~/WDIMQ
grokinou-cli
/switch-session 2  # Session de TenderWatch

# ✅ RÉSULTAT :
# 1. Node fait automatiquement `process.chdir('~/TenderWatch')`
# 2. Le CWD devient ~/TenderWatch
# 3. LLM ET Node sont synchronisés
# 4. Tous les paths relatifs sont corrects
```

### **Message de Confirmation**

Quand tu switch vers une session dans un **autre répertoire**, tu vois :

```
✅ Switched to Session #2

📝 Name: API REST TenderWatch
🤖 Provider: openai
📱 Model: gpt-4o
💬 Messages: 45
📁 Working Directory: /home/user/TenderWatch
🕐 Last Activity: 1 hour ago

📂 **Directory Changed:**
   From: /home/user/WDIMQ
   To:   /home/user/TenderWatch

⚠️  All relative paths now resolve to the new directory.

Conversation history loaded! Continue chatting...
```

### **Gestion d'Erreurs**

Si le répertoire de la session n'existe plus (supprimé, renommé, etc.), tu vois :

```
❌ Failed to switch session: Session's working directory does not exist: /home/user/OldProject
The directory may have been moved or deleted.
```

---

## 🚀 Comment Utiliser `/switch-session`

### **1. Lister les Sessions Disponibles**

```bash
/list_sessions
```

**Sortie :**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Sessions in /home/user/mon-projet
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🟢 Session #1 - Nov 25, 10:00 AM
   Provider: openai (gpt-4o)
   Preview: "Implémente l'authentification OAuth..."
   Messages: 50 | Last activity: 2h ago

⚪ Session #2 - Nov 25, 11:30 AM
   Provider: deepseek (deepseek-chat)
   Preview: "Crée une API REST pour gérer les..."
   Messages: 30 | Last activity: 30m ago

💡 To switch to a session, use: /switch-session <id>
```

### **2. Basculer vers une Session**

```bash
/switch-session 2
```

**Sortie :**
```
✅ Switched to Session #2
📋 Provider: deepseek (deepseek-chat)
💬 Loaded 30 messages
🕒 Last activity: 30 minutes ago

[...historique complet de la session 2 affiché...]
```

### **3. Continuer la Conversation**

Après le switch, tu peux **immédiatement continuer** la conversation :

```bash
User: "Maintenant ajoute la validation des requêtes"
Assistant: [Reprend exactement où la conversation s'était arrêtée]
```

---

## 📊 Comparaison : Avec vs Sans `/switch-session`

| Situation | **SANS `/switch-session`** | **AVEC `/switch-session`** |
|-----------|---------------------------|---------------------------|
| **2 features en parallèle** | Contexte mélangé, confusion | Contexte isolé, clarté totale |
| **Revenir à une discussion** | Relire des centaines de messages | Switch instantané, contexte restauré |
| **Expérimentation** | Risque de polluer le contexte | Isolation complète, comparaison facile |
| **Collaboration** | Réexpliquer tout à l'équipe | Accès direct au contexte complet |
| **Organisation** | Historique monolithique | Sessions thématiques claires |

---

## 🎯 Bonnes Pratiques

### ✅ **DO**
- Crée une nouvelle session pour chaque **feature majeure**
- Utilise des sessions séparées pour **debug urgent**
- Nomme tes sessions clairement (futur : `/rename`)
- Switch entre sessions **fréquemment** selon le contexte

### ❌ **DON'T**
- Ne mélange pas frontend/backend dans une même session
- N'utilise pas une seule session pour tout (historique ingérable)
- Ne crée pas 50 sessions pour des micro-tâches

---

## 🔮 Futures Améliorations

- **`/rename-session <id> <name>`** - Renommer les sessions
- **`/fork-session <id>`** - Dupliquer une session pour bifurquer
- **`/merge-sessions <id1> <id2>`** - Fusionner deux sessions
- **`/archive-session <id>`** - Archiver sans supprimer
- **`/search-sessions <query>`** - Recherche cross-session

---

## 💬 Exemple Complet de Workflow Multi-Projets

### **Scénario : WDIMQ, ColPali, et TenderWatch**

Ce cas d'usage résout **exactement** le problème que tu as rencontré :

```bash
# Jour 1 : Développement WDIMQ principal
cd ~/WDIMQ
grokinou-cli
User: "Implémente le système de recherche principal"
[...50 messages sur WDIMQ...]
# Session #1 créée dans ~/WDIMQ

# Jour 2 : Sous-projet ColPali (dans WDIMQ)
cd ~/WDIMQ/ColPali
grokinou-cli
User: "Intègre ColPali pour la recherche visuelle"
[...40 messages sur ColPali...]
# Session #2 créée dans ~/WDIMQ/ColPali

# Jour 3 : Nouveau projet TenderWatch (hors WDIMQ)
cd ~/TenderWatch
grokinou-cli
User: "Scrape les appels d'offres publics"
[...30 messages sur TenderWatch...]
# Session #3 créée dans ~/TenderWatch

# Jour 4 : Retour sur WDIMQ principal
cd ~/WDIMQ
grokinou-cli
/list_sessions
# Session #1 - WDIMQ - ~/WDIMQ
# Session #2 - ColPali - ~/WDIMQ/ColPali
# Session #3 - TenderWatch - ~/TenderWatch

/switch-session 1
# ✅ CWD = ~/WDIMQ
# ✅ Le LLM sait qu'il travaille sur WDIMQ principal
# ✅ Tous les paths relatifs corrects

User: "Continue le système de recherche"
# Travail dans ~/WDIMQ

# Switch vers ColPali
/switch-session 2
# ✅ CWD change automatiquement vers ~/WDIMQ/ColPali
# ✅ Le LLM sait qu'il travaille sur ColPali
# ✅ Paths relatifs vers les fichiers ColPali

User: "Optimise la vectorisation des images"
# Travail dans ~/WDIMQ/ColPali

# Switch vers TenderWatch
/switch-session 3
# ✅ CWD change automatiquement vers ~/TenderWatch
# ✅ Le LLM sait qu'il est dans un AUTRE projet
# ✅ Paths relatifs vers TenderWatch

User: "Ajoute le parsing des PDF"
# Travail dans ~/TenderWatch

# Retour à WDIMQ
/switch-session 1
# ✅ CWD retourne vers ~/WDIMQ
# ✅ Contexte WDIMQ restauré
```

**Avant cette fonctionnalité (BUGUÉ) :**
```
❌ LLM confus : "Je ne sais plus dans quel répertoire je travaille"
❌ Paths incorrects : "Impossible de trouver src/api/tender.ts"
❌ Pollution : "Les fichiers de TenderWatch interfèrent avec WDIMQ"
```

**Après cette fonctionnalité (RÉSOLU) :**
```
✅ LLM toujours synchronisé avec le bon répertoire
✅ Paths toujours corrects
✅ Isolation parfaite entre projets
```

---

## 🎓 Résumé

**`/switch-session`** transforme Grokinou en un véritable **gestionnaire de contextes multiples**, permettant :
- 🧠 **Contexte préservé** à 100%
- 🔀 **Navigation fluide** entre sujets
- 👥 **Collaboration simplifiée**
- 📚 **Mémoire institutionnelle** du projet
- 🎯 **Organisation claire** par thème/feature

C'est l'équivalent de **branches Git pour les conversations avec l'IA** ! 🚀

---

**Date:** 2025-11-25  
**Version:** 0.1.0
