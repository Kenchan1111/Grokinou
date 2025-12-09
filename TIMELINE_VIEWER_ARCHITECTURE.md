# 🏗️ Architecture : Timeline Viewer & Navigation System

## ✅ Confirmation : Tout Est Persisté dans timeline.db

**Réponse à ta question** : OUI, tout ce qui passe par le viewer est déjà persisté dans timeline.db !

### Ce Qui Est Loggé

**1. Messages Utilisateur** (`LLM_MESSAGE_USER`)
- **Fichier** : `src/timeline/hooks/llm-hook.ts:84-110`
- **Appelé depuis** : `src/agent/grok-agent.ts:609` (dans `sendMessage()`)
- **Payload** :
  ```typescript
  {
    role: 'user',
    content: "Question de l'utilisateur",
    session_id: 1,
    model: 'grok-2-1212',
    provider: 'xai'
  }
  ```

**2. Réponses LLM** (`LLM_MESSAGE_ASSISTANT`)
- **Fichier** : `src/timeline/hooks/llm-hook.ts:123-149`
- **Appelé depuis** : `src/agent/grok-agent.ts` (après streaming)
- **Payload** :
  ```typescript
  {
    role: 'assistant',
    content: "Réponse complète du LLM",
    session_id: 1,
    model: 'grok-2-1212',
    provider: 'xai',
    token_count: 1234
  }
  ```

**3. Exécutions de Tools** (`TOOL_CALL_STARTED`, `TOOL_CALL_SUCCESS`, `TOOL_CALL_FAILED`)
- **Fichier** : `src/timeline/hooks/tool-hook.ts`
- **Appelé depuis** : `src/agent/grok-agent.ts` (dans `executeTool()`)
- **Payload** :
  ```typescript
  {
    tool_name: 'bash',
    arguments: { command: 'ls -la' },
    result: "Output du tool",
    duration_ms: 123,
    session_id: 1
  }
  ```

**4. Détails des Commands** (COT, output, etc.)
- **Fichier** : `src/execution/execution-manager.ts:337-346`
- **Note importante** : Le commentaire dit :
  ```typescript
  // NOTE: Timeline.db persistence is handled by ToolHook in grok-agent.ts
  // to avoid duplication. ExecutionManager focuses on real-time UI updates.
  ```
- **Conclusion** : Les COT entries et command outputs sont loggés via ToolHook

---

## 🔗 Architecture de Corrélation

### Structure des Events dans timeline.db

**Table `events`** : `src/timeline/schema.ts:4-23`

Chaque event a :
```typescript
{
  id: string,                  // UUID de l'event
  timestamp: number,           // Unix microseconds
  sequence_number: number,     // Ordre strict
  event_type: EventType,       // LLM_MESSAGE_USER, TOOL_CALL_STARTED, etc.
  actor: string,               // 'user' | 'llm:grok-2' | 'tool:bash' | 'system'
  aggregate_id: string,        // session_id (ex: "1")
  aggregate_type: string,      // 'session'
  payload: any,                // Données de l'event
  correlation_id: string,      // 🔑 ID de transaction (lie tous les events d'une requête)
  causation_id: string,        // 🔑 ID de l'event parent (chaîne de causalité)
  metadata: any,
  checksum: string
}
```

### Chaîne de Causalité (Comment Tout Est Lié)

**Exemple de flux complet** :

```
1. USER MESSAGE (id: evt-001, correlation_id: corr-A, causation_id: null)
   └─> Question: "Peux-tu lire package.json ?"

2. LLM_STREAMING_START (id: evt-002, correlation_id: corr-A, causation_id: evt-001)
   └─> LLM commence à traiter

3. TOOL_CALL_STARTED (id: evt-003, correlation_id: corr-A, causation_id: evt-002)
   └─> Tool: bash, Command: cat package.json

4. TOOL_CALL_SUCCESS (id: evt-004, correlation_id: corr-A, causation_id: evt-003)
   └─> Result: { output: "..." }

5. LLM_MESSAGE_ASSISTANT (id: evt-005, correlation_id: corr-A, causation_id: evt-002)
   └─> Réponse: "Voici le contenu de package.json..."
```

**Propriétés clés** :
- ✅ **correlation_id** : Tous les events d'une requête utilisateur partagent le même `correlation_id`
- ✅ **causation_id** : Chaque event pointe vers son event parent
- ✅ **aggregate_id** : Tous les events d'une session ont le même `session_id`

---

## 🎯 Vision : Système de Navigation

### Ce Que Tu Veux Implémenter

**Flow souhaité** :
1. Utilisateur active le viewer (Ctrl+E) SANS envoyer de prompt
2. Viewer affiche la liste des anciennes questions (historique)
3. Navigation avec ↑↓ pour parcourir les questions
4. Appui sur Enter pour voir :
   - Question complète de l'utilisateur
   - Réponse du LLM (reasoning, sans le flow d'exécution)
   - Exécutions associées (dans le viewer : COT, commands, outputs)

### Architecture Proposée

#### Option A : Query timeline.db Directement (Recommandé)

**Avantages** :
- ✅ Pas de duplication des données
- ✅ Source de vérité unique (timeline.db)
- ✅ Tout est déjà corrélé via `correlation_id`
- ✅ Requêtes SQL simples et performantes

**Implémentation** :

**1. Récupérer la liste des questions** :
```sql
SELECT
  id,
  timestamp,
  payload->>'content' as question,
  correlation_id
FROM events
WHERE
  event_type = 'LLM_MESSAGE_USER'
  AND aggregate_id = ?  -- session_id
ORDER BY timestamp DESC
LIMIT 50;
```

**2. Pour une question sélectionnée, récupérer tout le contexte** :
```sql
-- Tous les events liés à cette requête
SELECT *
FROM events
WHERE correlation_id = ?  -- correlation_id de la question
ORDER BY sequence_number ASC;
```

**3. Parser les résultats** :
```typescript
interface QuestionContext {
  question: {
    content: string;
    timestamp: Date;
  };
  llmResponse: {
    content: string;
    timestamp: Date;
  };
  toolExecutions: Array<{
    toolName: string;
    arguments: any;
    result: any;
    duration: number;
    status: 'success' | 'failed';
  }>;
}
```

**4. Nouveau composant : `HistoryNavigator`**
```typescript
// src/ui/components/history-navigator.tsx

export const HistoryNavigator: React.FC = () => {
  const [questions, setQuestions] = useState<QuestionEntry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [detailsMode, setDetailsMode] = useState(false);

  useEffect(() => {
    // Charger les questions depuis timeline.db
    const history = await queryQuestionHistory();
    setQuestions(history);
  }, []);

  useInput((input, key) => {
    // ↑↓ : Naviguer entre les questions
    if (key.upArrow) setSelectedIndex(i => Math.max(0, i - 1));
    if (key.downArrow) setSelectedIndex(i => Math.min(questions.length - 1, i + 1));

    // Enter : Afficher les détails
    if (key.return) {
      setDetailsMode(true);
    }

    // Esc : Retour à la liste
    if (key.escape) {
      setDetailsMode(false);
    }
  });

  if (detailsMode) {
    const context = await getQuestionContext(questions[selectedIndex].correlation_id);
    return <QuestionDetailsView context={context} />;
  }

  return (
    <Box flexDirection="column">
      <Text bold>📜 Question History</Text>
      {questions.map((q, i) => (
        <Box key={q.id} backgroundColor={i === selectedIndex ? 'blue' : undefined}>
          <Text>{formatTimestamp(q.timestamp)} - {truncate(q.content, 80)}</Text>
        </Box>
      ))}
    </Box>
  );
};
```

**5. Intégration avec ExecutionViewer**
```typescript
// Quand mode = 'history', afficher HistoryNavigator au lieu de ExecutionViewer
{mode === 'history' && <HistoryNavigator />}
{mode === 'split' && <ExecutionViewer />}
```

---

#### Option B : Stocker Redundament dans ExecutionManager (Non Recommandé)

**Inconvénients** :
- ❌ Duplication des données
- ❌ Synchronisation complexe
- ❌ Perte de données en cas de crash (ExecutionManager est en mémoire)

---

## 🚀 Plan d'Implémentation

### Phase 1 : Query API pour timeline.db

**Fichier** : `src/timeline/timeline-query-api.ts` (nouveau)

```typescript
import { TimelineDb } from './database.js';
import { EventType } from './event-types.js';

export interface QuestionEntry {
  id: string;
  content: string;
  timestamp: Date;
  correlation_id: string;
}

export interface QuestionContext {
  question: QuestionEntry;
  llmResponse: {
    content: string;
    timestamp: Date;
  };
  toolExecutions: ToolExecution[];
}

export async function queryQuestionHistory(sessionId: number, limit = 50): Promise<QuestionEntry[]> {
  const db = TimelineDb.getInstance();
  const rows = await db.execute(`
    SELECT
      id,
      timestamp,
      payload,
      correlation_id
    FROM events
    WHERE
      event_type = ?
      AND aggregate_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `, [EventType.LLM_MESSAGE_USER, sessionId.toString(), limit]);

  return rows.map(row => ({
    id: row.id,
    content: JSON.parse(row.payload).content,
    timestamp: new Date(row.timestamp / 1000), // microseconds to ms
    correlation_id: row.correlation_id
  }));
}

export async function getQuestionContext(correlationId: string): Promise<QuestionContext> {
  const db = TimelineDb.getInstance();
  const events = await db.execute(`
    SELECT *
    FROM events
    WHERE correlation_id = ?
    ORDER BY sequence_number ASC
  `, [correlationId]);

  // Parser les events
  const question = events.find(e => e.event_type === EventType.LLM_MESSAGE_USER);
  const llmResponse = events.find(e => e.event_type === EventType.LLM_MESSAGE_ASSISTANT);
  const toolCalls = events.filter(e => e.event_type === EventType.TOOL_CALL_SUCCESS || e.event_type === EventType.TOOL_CALL_FAILED);

  return {
    question: {
      id: question.id,
      content: JSON.parse(question.payload).content,
      timestamp: new Date(question.timestamp / 1000),
      correlation_id: question.correlation_id
    },
    llmResponse: {
      content: JSON.parse(llmResponse.payload).content,
      timestamp: new Date(llmResponse.timestamp / 1000)
    },
    toolExecutions: toolCalls.map(tc => parseToolExecution(tc))
  };
}
```

---

### Phase 2 : UI Components

**1. HistoryNavigator** : Liste des questions (navigation ↑↓)
**2. QuestionDetailsView** : Affichage d'une question + réponse + executions
**3. Intégration dans LayoutManager** : Nouveau mode 'history'

---

### Phase 3 : Keyboard Shortcuts

**Nouveau raccourci** : `Ctrl+H` pour activer le mode history

```typescript
// Dans layout-manager.tsx
if (key.ctrl && input === 'h') {
  changeMode('history');
}
```

---

## 📊 Résumé

### ✅ Ce Qui Existe Déjà

1. **Toutes les données sont dans timeline.db** :
   - Questions utilisateur (`LLM_MESSAGE_USER`)
   - Réponses LLM (`LLM_MESSAGE_ASSISTANT`)
   - Tool executions (`TOOL_CALL_*`)

2. **Corrélation complète** :
   - `correlation_id` : Lie tous les events d'une requête
   - `causation_id` : Chaîne de causalité parent → enfant
   - `aggregate_id` : Filtre par session

3. **Infrastructure prête** :
   - EventBus pour émettre les events
   - Hooks (LLMHook, ToolHook) pour capturer automatiquement
   - Timeline.db avec schema complet

### 🚧 Ce Qu'Il Faut Créer

1. **Query API** (`timeline-query-api.ts`) :
   - `queryQuestionHistory()` : Liste des questions
   - `getQuestionContext()` : Contexte complet d'une question

2. **UI Components** :
   - `HistoryNavigator` : Liste navigable
   - `QuestionDetailsView` : Vue détaillée

3. **Intégration** :
   - Nouveau mode 'history' dans LayoutManager
   - Raccourci Ctrl+H pour activer

---

## 🎉 Conclusion

**Ta vision est totalement réalisable !** Toute l'architecture event-sourcing est déjà en place. Il suffit de :

1. ✅ Créer l'API de query (simple SQL sur timeline.db)
2. ✅ Créer les composants UI de navigation
3. ✅ Intégrer dans le LayoutManager

**Avantage majeur** : Pas de duplication, pas de synchronisation. Timeline.db est la source de vérité unique.

**Next step** : Veux-tu que j'implémente Phase 1 (Query API) en premier ?
