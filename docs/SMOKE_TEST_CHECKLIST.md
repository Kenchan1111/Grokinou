# Grokinou Smoke Test Checklist

Checklist manuelle avant merge/release. Chaque item doit passer. Si un item fail, ouvrir un bug avant de merger.

**Temps estimé** : 5-10 minutes

---

## 1. Startup

- [ ] `npm run build` compile sans erreur
- [ ] `node dist/index.js` démarre sans crash
- [ ] Le logo et la version s'affichent
- [ ] Le prompt utilisateur apparaît (ready to type)
- [ ] Le modèle courant est affiché dans le status bar

## 2. Normal Chat

- [ ] Envoyer un message simple ("hello") → réponse reçue
- [ ] Le timestamp et le label model s'affichent sur la réponse
- [ ] Le contenu markdown est rendu correctement (bold, code blocks)
- [ ] Le cursor revient au prompt après la réponse

## 3. Tool Execution Display

- [ ] Demander une action tool (ex: "lis le fichier package.json") → tool s'exécute
- [ ] Le label du tool est correct (ex: "Read", "Edit", "Bash", "Grep", "Glob")
- [ ] Le path/pattern s'affiche à côté du label
- [ ] Le résumé compact s'affiche (ex: "23 lines (1.2KB)")
- [ ] L'Execution Viewer (Ctrl+E) affiche le COT et le command output
- [ ] Aucun raw output géant ne flood le chat principal

## 4. Atomic Tools

- [ ] `read_file` : affiche "Read(path)" + résumé lines/KB
- [ ] `edit_file_replace` : affiche "Edit(path)" + diff preview
- [ ] `write_file` : affiche "Write(path)" + résumé
- [ ] `glob_files` : affiche "Glob(pattern)" + "X files found"
- [ ] `grep_search` : affiche "Grep(pattern)" + "X results"

## 5. Split View & Keyboard

- [ ] Ctrl+E toggle le split view (conversation + execution viewer)
- [ ] Tab switch le focus entre conversation et viewer (indicateur visible)
- [ ] Page Up/Down scrolle uniquement le panel focused (pas les deux)
- [ ] Arrow keys dans le viewer naviguent les executions/commands
- [ ] Ctrl+D toggle le mode détaillé dans le viewer

## 6. Paste Handling

- [ ] Coller du texte simple → inséré correctement dans l'input
- [ ] Coller du texte avec tabs → pas de switch de focus en split view
- [ ] Coller du texte avec newlines → pas de submit prématuré
- [ ] Coller un bloc de code multi-ligne → tout apparaît dans l'input

## 7. Search Routing

- [ ] Demander "find all .tsx files" → utilise `glob_files` (pas search/bash)
- [ ] Demander "search for handleSubmit" → utilise `grep_search` (pas search)
- [ ] Demander "where is the auth logic" → peut utiliser `search_advanced` (vague intent)

## 8. Session Management

- [ ] `/list_sessions` affiche les sessions avec modèle, directory, timestamps
- [ ] `/switch-session <id>` change la session, l'historique se recharge
- [ ] Après switch : le modèle affiché correspond à la session cible
- [ ] Après switch : le working directory (cwd) correspond à la session cible

## 9. Confirmation System

- [ ] Une opération d'écriture (edit/write) demande confirmation avant exécution
- [ ] Rejeter la confirmation → l'opération ne s'exécute pas
- [ ] Accepter → l'opération s'exécute et le résultat s'affiche

## 10. Context Compactor

- [ ] En session longue (20+ messages) : pas de crash
- [ ] Si la compaction se déclenche : COT event visible dans l'Execution Viewer
- [ ] Après compaction : la conversation continue normalement

## 11. Error Handling

- [ ] Envoyer un message avec API key invalide → message d'erreur clair (pas de crash)
- [ ] Interrompre une exécution (Ctrl+C ou Escape) → retour au prompt proprement
- [ ] Tool qui échoue → message d'erreur dans le chat, pas de boucle infinie

---

## Quick Regression Check (2 min)

Pour les patches mineurs, vérifier au minimum :

1. [ ] Build passe
2. [ ] Startup + un message simple
3. [ ] Un tool s'exécute correctement
4. [ ] Split view fonctionne (Ctrl+E + Tab + Page Up/Down)
5. [ ] Paste multi-ligne ne casse rien

---

## Notes

- Cette checklist couvre les fixes de : Page Up bug, paste overflow, atomic tools, session switch sync, search routing
- Mise à jour : 2026-03-12 (backlog v2, B1.5)
- Prochaine évolution : automatiser en B4.x (golden workflow tests)
