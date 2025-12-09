# INVESTIGATION: Commits Fantômes/Cachés

## Découvertes Initiales

### Comptage des commits

**Méthode 1 (branches normales):**
```bash
git log --all --after="2025-11-13" --before="2025-12-08" | wc -l
# Résultat: 331 commits
```

**Méthode 2 (avec reflog):**
```bash
git log --all --reflog --after="2025-11-13" --before="2025-12-08" | wc -l
# Résultat: 358 commits
```

**Différence: 27 commits "fantômes"** (358 - 331 = 27)

Ces 27 commits peuvent être:
- Commits amendés (--amend)
- Commits rebasés
- Commits squashés
- Commits dans des branches supprimées
- Commits orphelins (dangling)

---

## Analyse des Références Git

**Total de références:**
```bash
git for-each-ref --format='%(refname:short)' | wc -l
# Résultat: 28 références
```

**Types de références:**
- Branches locales
- Branches remote
- Tags
- Stash entries
- HEAD detached states dans reflog

---

## Commits Dangling/Orphelins

**Vérification:**
```bash
git fsck --lost-found
# Résultat: 0 commits dangling
```

Aucun commit orphelin trouvé actuellement.

---

## Hypothèses sur les 27 Commits Manquants

### 1. Commits Amendés (--amend)

Quand on fait `git commit --amend`, l'ancien commit reste dans le reflog mais disparaît de l'historique normal.

**Exemple typique:**
- Commit initial: `abc123` - "fix: some issue"
- Amend: `def456` - "fix: some issue (corrected typo)"
- Résultat: `abc123` est dans reflog mais pas dans `git log`

**Probabilité: HAUTE** - Avec 13.8 commits/jour, beaucoup d'amends probables

---

### 2. Commits Rebasés

Pendant un rebase interactif, les anciens commits sont réécrits avec de nouveaux hashes.

**Exemple:**
- Branche feature avant rebase: `aaa111`, `bbb222`, `ccc333`
- Après rebase sur main: `xxx999`, `yyy888`, `zzz777`
- Résultat: 3 commits dans reflog, 3 nouveaux dans l'historique = 6 dans reflog total

**Probabilité: MOYENNE** - Dépend de la stratégie de merge

---

### 3. Commits Squashés

Lors d'un rebase avec squash, plusieurs commits deviennent un seul.

**Exemple:**
- 5 commits WIP squashés en 1 commit final
- Résultat: 5 dans reflog, 1 dans historique

**Probabilité: MOYENNE à HAUTE** - Pratique courante pour nettoyer l'historique

---

### 4. Branches Supprimées

Commits dans des branches expérimentales supprimées.

**Vérifier:**
```bash
git reflog show --all | grep -E "checkout|branch"
```

**Probabilité: FAIBLE** - Git garbage collection aurait nettoyé

---

### 5. Commits d'Intégrité Auto-générés puis Amendés

Vu les nombreux commits d'intégrité (`chore(integrity): ...`), probable que:
- Commit initial généré automatiquement
- Amend pour ajouter TSA receipt
- Amend pour ajouter Sigstore bundle
- = 3 commits dans reflog, 1 dans historique

**Probabilité: TRÈS HAUTE** - Pattern visible dans les commits du 1er décembre

---

## Actions Suggérées

### 1. Extraire la liste complète avec reflog

```bash
git log --all --reflog --pretty=format:"%H|%ai|%an|%s" --after="2025-11-13" > /tmp/all-commits-with-reflog.txt
```

### 2. Comparer les deux listes

```bash
comm -23 <(sort /tmp/all-commits-with-reflog.txt) <(sort /tmp/all-commits-complete.txt)
```

Cela montrera les 27 commits présents dans reflog mais pas dans l'historique normal.

### 3. Analyser les patterns d'amend

```bash
git reflog --all | grep "commit (amend)"
```

### 4. Chercher les rebases

```bash
git reflog --all | grep "rebase"
```

---

## Impact sur l'Analyse Forensique

Les 27 commits "fantômes" sont importants car ils peuvent révéler:

1. **Tentatives de fix ratées** - Commits amendés après échec
2. **Changements expérimentaux** - Rebasés ou squashés
3. **Corrections rapides** - Amendés avant push
4. **Historique d'intégrité** - Commits auto-générés puis amendés

**Recommandation:** Analyser le reflog complet pour comprendre l'historique réel des changements, pas seulement l'historique "propre".

---

## Prochaines Étapes

- [ ] Extraire liste complète avec reflog (358 commits)
- [ ] Identifier les 27 commits manquants
- [ ] Analyser les patterns d'amend/rebase
- [ ] Documenter les vrais chemins de développement
- [ ] Vérifier si des fix critiques ont été amendés sans documentation

---

**Date:** 2025-12-07
**Analysé par:** Claude (Sonnet 4.5)
**Statut:** Investigation en cours
