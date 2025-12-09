# Diagnostic des problèmes du Execution Viewer

## Problèmes identifiés

### 1. Flux de données incomplet
- **Symptôme** : Le viewer ne capture pas toutes les informations des outils
- **Cause potentielle** : Certains outils ne génèrent pas de COT entries complètes
- **Fichiers concernés** : `src/agent/grok-agent.ts` (méthode `executeTool`)

### 2. Formatage des résultats
- **Symptôme** : Les résultats sont tronqués ou mal formatés
- **Cause potentielle** : Logique de formatage dans `chat-history.tsx`
- **Fichiers concernés** : `src/ui/components/chat-history.tsx`

### 3. Synchronisation des flux
- **Symptôme** : Décalage entre streaming et affichage
- **Cause potentielle** : Timing des événements dans le flux d'exécution
- **Fichiers concernés** : `src/execution/execution-manager.ts`

## Solutions proposées

### Solution 1 : Améliorer la capture COT
```typescript
// Dans executeTool, ajouter plus de COT entries
case "view_file":
  executionStream.emitCOT('thinking', `Reading file: ${args.path}`);
  executionStream.emitCOT('action', `Opening file for reading`);
  result = await this.textEditor.view(args.path, range);
  executionStream.emitCOT('observation', `Read ${result.output?.length || 0} characters`);
  executionStream.emitCOT('decision', `File content retrieved successfully`);
  break;
```

### Solution 2 : Améliorer l'affichage des résultats
```typescript
// Dans chat-history.tsx, améliorer le formatage
const formatToolContent = (content: string, toolName: string) => {
  // Pour les résultats volumineux, afficher un résumé
  if (content.length > 500) {
    return `${content.substring(0, 200)}... (${content.length} characters total)`;
  }
  return content;
};
```

### Solution 3 : Synchronisation améliorée
```typescript
// Dans execution-manager.ts, garantir la séquence
emitCOT(type: COTType, content: string): void {
  const entry: COTEntry = {
    timestamp: new Date(),
    type,
    content
  };
  
  // Émettre d'abord l'événement COT
  this.emit('cot', entry);
  
  // Puis mettre à jour l'état
  this.state.cot.push(entry);
  
  // Enfin émettre la mise à jour globale
  this.emit('update', this.state);
}
```

## Tests recommandés

1. **Test de base** : Exécuter `view_file` et vérifier que toutes les COT entries apparaissent
2. **Test de volume** : Exécuter des commandes avec sorties volumineuses
3. **Test de timing** : Vérifier la synchronisation entre différents outils
4. **Test d'erreur** : Vérifier le comportement avec des outils qui échouent

## Fichiers à examiner

- `src/agent/grok-agent.ts` - Logique d'exécution des outils
- `src/execution/execution-manager.ts` - Gestionnaire d'exécution
- `src/ui/components/execution-viewer.tsx` - Composant viewer
- `src/ui/components/chat-history.tsx` - Affichage des résultats
- `src/ui/components/chat-interface.tsx` - Interface principale

## Prochaines étapes

1. Exécuter le script de test pour identifier les problèmes spécifiques
2. Implémenter les améliorations COT pour chaque type d'outil
3. Améliorer le formatage des résultats volumineux
4. Optimiser la synchronisation des flux
5. Tester avec différents scénarios d'utilisation