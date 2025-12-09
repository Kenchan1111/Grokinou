# 📋 TODO - Améliorations Grokinou

## 🎯 Priorité Haute

### 1. Tests Interactifs en Environnement Non-TTY

**Problème** :
- Grokinou ne peut pas tester les applications CLI interactives (Ink-based)
- Erreur: `Raw mode is not supported on the current process.stdin`
- Impossibilité de tester les interactions utilisateur (Ctrl+E, input, etc.)

**Solutions Possibles** :

#### Option A : Mode Headless pour Tests
```typescript
// Ajouter un flag --headless pour les tests automatisés
if (process.env.HEADLESS || process.argv.includes('--headless')) {
  // Simuler stdin/stdout
  // Accepter des commandes via fichier ou pipe
  // Retourner les résultats sans UI Ink
}
```

#### Option B : Mock Terminal (pty)
```bash
# Utiliser node-pty pour simuler un vrai terminal
npm install node-pty
# Créer un pseudo-terminal pour les tests
```

#### Option C : Tests Snapshot
```typescript
// Tester le rendu JSX sans interaction
import { render } from 'ink-testing-library';
// Capturer les snapshots de l'UI
```

#### Option D : Environnement de Test Dédié
```typescript
// Créer un mode "test" avec stdin/stdout mockés
// Permettre à Grokinou de piloter l'app via API
class TestHarness {
  async sendInput(text: string): Promise<void>
  async pressKey(key: string): Promise<void>
  async getOutput(): Promise<string>
}
```

**Bénéfices** :
- ✅ Tests automatisés complets
- ✅ Vérification des transitions UI
- ✅ Détection des glitches/regressions
- ✅ CI/CD possible

**Effort Estimé** : 2-3 jours

---

## 🎯 Priorité Moyenne

### 2. Intégration Complète de StreamingDisplay

**Status** : Actuellement stub dans ConversationView

**À Faire** :
- Exporter StreamingDisplay depuis chat-interface.tsx
- Ou créer un composant séparé
- Remplacer le stub dans ConversationView.tsx

**Fichier** : `src/ui/components/ConversationView.tsx:102-106`

---

### 3. Tests des Transitions de Layout

**À Tester Manuellement** :
- [ ] Mode normal → Mode split (Ctrl+E)
- [ ] Mode split → Mode normal (Ctrl+E)
- [ ] Mode split → Mode fullscreen (Ctrl+F)
- [ ] Envoyer prompts en mode split
- [ ] Vérifier absence de glitch à la fin des exécutions
- [ ] Mode search (si applicable)

---

## 🎯 Priorité Basse

### 4. Documentation Architecture

**À Documenter** :
- Architecture ChatContext / ConversationView
- Principe de séparation view/data
- Comment ajouter de nouveaux layouts
- Best practices pour éviter JSX reuse

---

## 📅 Historique

**2025-12-04** : Ajout de la fonctionnalité de test interactif après refactoring view/data separation

