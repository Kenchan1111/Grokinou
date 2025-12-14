# PLAN SÉCURISATION conversations.db
## Signature par Message + Ancrage timeline.db

**Date** : 14 décembre 2025
**Objectif** : Garantir intégrité de conversations.db avec détection immédiate de corruption

---

## 🎯 APPROCHE FINALE (Fusion Claude + ChatGPT)

### Principe : Chaîne de Signatures par Message

**Avantages vs signature rotative** :
- ✅ Détection **immédiate** du message corrompu (pas de dichotomie)
- ✅ **Ancrage externe** dans timeline.db (doublement sécurisé)
- ✅ Coût **O(1)** par message (hash incrémental)
- ✅ **Granularité maximale** (par message, pas par lot)

**Coût en ressources** :
- CPU : 1 SHA256 + 1 INSERT par message = **< 1ms** (négligeable)
- Stockage : ~100 bytes par message = **100 KB pour 1000 messages** (négligeable)

---

## 📋 MODIFICATIONS SCHÉMA

### 1. Table `messages` - Ajouter Checksum Individuel

```sql
ALTER TABLE messages ADD COLUMN checksum TEXT;
CREATE INDEX idx_messages_checksum ON messages(checksum);
```

**Calcul** :
```typescript
msg_checksum = SHA256(JSON.stringify({
  id: message.id,
  type: message.type,
  role: message.role,
  content: message.content,
  timestamp: message.timestamp,
  tool_calls: message.tool_calls,
  tool_call_id: message.tool_call_id
}))
```

### 2. Table `sessions` - Ajouter Rolling Checksum

```sql
ALTER TABLE sessions ADD COLUMN rolling_checksum TEXT;      -- SHA256 cumulatif
ALTER TABLE sessions ADD COLUMN last_verified_at INTEGER;   -- Timestamp dernière vérification
ALTER TABLE sessions ADD COLUMN corrupted_at INTEGER;       -- Timestamp détection corruption (NULL = sain)
```

**Calcul** :
```typescript
new_session_checksum = SHA256(prev_session_checksum + msg_checksum)
```

### 3. Nouvelle Table `session_signatures` - Chaîne de Preuves

```sql
CREATE TABLE session_signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  checksum TEXT NOT NULL,              -- SHA256 cumulatif à ce message
  timestamp INTEGER NOT NULL,          -- Microsecondes
  prev_signature_checksum TEXT,        -- Checksum signature précédente (blockchain-like)

  CHECK (length(checksum) = 64),
  CHECK (prev_signature_checksum IS NULL OR length(prev_signature_checksum) = 64),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX idx_signatures_session ON session_signatures(session_id);
CREATE INDEX idx_signatures_message ON session_signatures(message_id);
CREATE INDEX idx_signatures_timestamp ON session_signatures(timestamp DESC);
```

---

## 🔧 IMPLÉMENTATION

### Étape 1 : Calcul Checksum à l'Écriture

**Fichier** : `src/utils/session-manager-sqlite.ts`

```typescript
/**
 * Calculer checksum d'un message
 */
private calculateMessageChecksum(message: {
  id: number;
  type: string;
  role: string;
  content: string;
  timestamp: number | Date;
  tool_calls?: string | null;
  tool_call_id?: string | null;
}): string {
  const normalized = {
    id: message.id,
    type: message.type,
    role: message.role,
    content: message.content,
    timestamp: typeof message.timestamp === 'number'
      ? message.timestamp
      : message.timestamp.getTime(),
    tool_calls: message.tool_calls || null,
    tool_call_id: message.tool_call_id || null,
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');
}

/**
 * Calculer rolling checksum de session
 */
private calculateRollingChecksum(
  prevChecksum: string | null,
  messageChecksum: string
): string {
  const base = prevChecksum || '';
  return crypto
    .createHash('sha256')
    .update(base + messageChecksum)
    .digest('hex');
}

/**
 * Ajouter message avec signature automatique
 */
async addMessage(sessionId: number, message: MessageData): Promise<number> {
  // 1. Insérer le message (sans checksum d'abord)
  const messageId = this.insertMessageRaw(sessionId, message);

  // 2. Calculer checksum du message
  const msgChecksum = this.calculateMessageChecksum({
    id: messageId,
    ...message,
    timestamp: Date.now(),
  });

  // 3. Mettre à jour checksum du message
  this.db.prepare('UPDATE messages SET checksum = ? WHERE id = ?')
    .run(msgChecksum, messageId);

  // 4. Récupérer rolling_checksum précédent de la session
  const session = this.db.prepare(
    'SELECT rolling_checksum FROM sessions WHERE id = ?'
  ).get(sessionId) as any;

  const prevRollingChecksum = session?.rolling_checksum || null;

  // 5. Calculer nouveau rolling_checksum
  const newRollingChecksum = this.calculateRollingChecksum(
    prevRollingChecksum,
    msgChecksum
  );

  // 6. Mettre à jour session
  this.db.prepare(`
    UPDATE sessions
    SET rolling_checksum = ?,
        message_count = message_count + 1,
        last_activity = ?
    WHERE id = ?
  `).run(newRollingChecksum, Date.now(), sessionId);

  // 7. Créer signature dans session_signatures
  const lastSignature = this.db.prepare(`
    SELECT checksum FROM session_signatures
    WHERE session_id = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `).get(sessionId) as any;

  this.db.prepare(`
    INSERT INTO session_signatures (
      session_id,
      message_id,
      checksum,
      timestamp,
      prev_signature_checksum
    ) VALUES (?, ?, ?, ?, ?)
  `).run(
    sessionId,
    messageId,
    newRollingChecksum,
    Date.now() * 1000, // microsecondes
    lastSignature?.checksum || null
  );

  // 8. Ancrer dans timeline.db (tous les N messages OU message critique)
  await this.anchorInTimeline(sessionId, messageId, newRollingChecksum);

  return messageId;
}
```

### Étape 2 : Ancrage dans timeline.db

**Fichier** : `src/utils/session-manager-sqlite.ts`

```typescript
import { EventBus } from '../timeline/event-bus.js';

/**
 * Ancrer signature dans timeline.db (immuable)
 *
 * Fréquence : Tous les 5 messages OU messages critiques (tool_calls)
 */
private async anchorInTimeline(
  sessionId: number,
  messageId: number,
  checksum: string
): Promise<void> {
  const session = this.getSession(sessionId);
  const messageCount = session.message_count;

  // Ancrer tous les 5 messages OU si c'est un tool message
  const message = this.getMessage(messageId);
  const shouldAnchor =
    messageCount % 5 === 0 ||
    message.type === 'tool_result' ||
    message.role === 'tool';

  if (!shouldAnchor) return;

  const eventBus = EventBus.getInstance();

  await eventBus.emit({
    actor: 'session-manager',
    event_type: 'SESSION_SIGNATURE',
    aggregate_id: String(sessionId),
    aggregate_type: 'session',
    payload: {
      session_id: sessionId,
      message_id: messageId,
      message_count: messageCount,
      checksum: checksum,
      timestamp: Date.now(),
    },
    correlation_id: `session-${sessionId}`,
    causation_id: null,
    metadata: {
      working_dir: session.working_dir,
      model: session.default_model,
    },
  });
}
```

### Étape 3 : Détection Immédiate de Corruption

**Fichier** : `src/utils/session-manager-sqlite.ts`

```typescript
/**
 * Vérifier intégrité d'une session
 *
 * @returns Résultat de vérification avec message corrompu si détecté
 */
verifySessionIntegrity(sessionId: number): {
  valid: boolean;
  currentChecksum: string | null;
  expectedChecksum: string;
  corruptedMessageId?: number;
  corruptedAt?: Date;
} {
  const session = this.db.prepare('SELECT rolling_checksum FROM sessions WHERE id = ?')
    .get(sessionId) as any;

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Recalculer rolling checksum depuis le début
  const messages = this.db.prepare(`
    SELECT id, type, role, content, timestamp, tool_calls, tool_call_id, checksum
    FROM messages
    WHERE session_id = ?
    ORDER BY id ASC
  `).all(sessionId) as any[];

  let rollingChecksum: string | null = null;

  for (const msg of messages) {
    const expectedMsgChecksum = this.calculateMessageChecksum(msg);

    // Vérifier checksum du message individuel
    if (msg.checksum !== expectedMsgChecksum) {
      console.error(`⚠️  CORRUPTION DÉTECTÉE - Message ${msg.id} corrompu`);
      return {
        valid: false,
        currentChecksum: msg.checksum,
        expectedChecksum: expectedMsgChecksum,
        corruptedMessageId: msg.id,
        corruptedAt: new Date(msg.timestamp),
      };
    }

    // Calculer rolling checksum
    rollingChecksum = this.calculateRollingChecksum(rollingChecksum, msg.checksum);
  }

  // Vérifier rolling checksum final
  if (session.rolling_checksum !== rollingChecksum) {
    console.error(`⚠️  CORRUPTION DÉTECTÉE - Rolling checksum mismatch`);
    return {
      valid: false,
      currentChecksum: session.rolling_checksum,
      expectedChecksum: rollingChecksum || '',
    };
  }

  return {
    valid: true,
    currentChecksum: session.rolling_checksum,
    expectedChecksum: rollingChecksum || '',
  };
}

/**
 * Vérifier intégrité au chargement de session
 */
async loadSession(sessionId: number): Promise<void> {
  // Charger session normalement
  this.currentSession = this.getSession(sessionId);

  // Vérifier intégrité
  const integrity = this.verifySessionIntegrity(sessionId);

  if (!integrity.valid) {
    // Marquer session comme corrompue
    this.db.prepare('UPDATE sessions SET corrupted_at = ? WHERE id = ?')
      .run(Date.now() * 1000, sessionId);

    // Logger event dans timeline.db
    const eventBus = EventBus.getInstance();
    await eventBus.emit({
      actor: 'session-manager',
      event_type: 'CORRUPTION_DETECTED',
      aggregate_id: String(sessionId),
      aggregate_type: 'session',
      payload: {
        session_id: sessionId,
        corrupted_message_id: integrity.corruptedMessageId,
        corrupted_at: integrity.corruptedAt?.toISOString(),
        current_checksum: integrity.currentChecksum,
        expected_checksum: integrity.expectedChecksum,
      },
      correlation_id: `session-${sessionId}`,
      causation_id: null,
      metadata: {
        severity: 'CRITICAL',
        forensic_evidence: 'CORRUPTION_DETECTED',
      },
    });

    // Alerter utilisateur
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('⚠️  CORRUPTION DÉTECTÉE dans conversations.db');
    console.error(`Session: ${sessionId}`);
    console.error(`Message corrompu: ${integrity.corruptedMessageId || 'Unknown'}`);
    console.error(`Horodatage: ${integrity.corruptedAt?.toISOString() || 'Unknown'}`);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    throw new Error(`Session ${sessionId} is corrupted - refusing to load`);
  }
}
```

### Étape 4 : Commande Vérification Manuelle

**Fichier** : `src/commands/verify-conversation.ts` (nouveau)

```typescript
/**
 * Commande /verify-conversation
 *
 * Vérifie l'intégrité de la session actuelle ou toutes les sessions
 */
export async function verifyConversationCommand(
  args?: { all?: boolean }
): Promise<void> {
  const sessionManager = SessionManager.getInstance();

  if (args?.all) {
    // Vérifier toutes les sessions
    const sessions = sessionManager.getAllSessions();

    console.log(`🔍 Vérification de ${sessions.length} sessions...\n`);

    let valid = 0;
    let corrupted = 0;

    for (const session of sessions) {
      const result = sessionManager.verifySessionIntegrity(session.id);

      if (result.valid) {
        valid++;
        console.log(`✅ Session ${session.id} (${session.session_name || 'Unnamed'}) - OK`);
      } else {
        corrupted++;
        console.error(`❌ Session ${session.id} (${session.session_name || 'Unnamed'}) - CORROMPUE`);
        console.error(`   Message corrompu: ${result.corruptedMessageId}`);
        console.error(`   Horodatage: ${result.corruptedAt?.toISOString()}`);
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Valides: ${valid}`);
    console.log(`❌ Corrompues: ${corrupted}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  } else {
    // Vérifier session actuelle
    const currentSession = sessionManager.getCurrentSession();

    if (!currentSession) {
      console.error('❌ Aucune session active');
      return;
    }

    console.log(`🔍 Vérification session ${currentSession.id}...\n`);

    const result = sessionManager.verifySessionIntegrity(currentSession.id);

    if (result.valid) {
      console.log(`✅ Session intègre`);
      console.log(`   Checksum: ${result.currentChecksum}`);
    } else {
      console.error(`❌ Session CORROMPUE`);
      console.error(`   Message corrompu: ${result.corruptedMessageId}`);
      console.error(`   Horodatage: ${result.corruptedAt?.toISOString()}`);
      console.error(`   Checksum actuel: ${result.currentChecksum}`);
      console.error(`   Checksum attendu: ${result.expectedChecksum}`);
    }
  }
}
```

**Enregistrer la commande** : `src/commands/index.ts`

```typescript
export const commands = {
  // ... autres commandes
  'verify-conversation': {
    description: 'Vérifier intégrité de la session actuelle',
    handler: verifyConversationCommand,
  },
};
```

---

## 📊 MIGRATION BASE DE DONNÉES

**Script** : `scripts/migrate-conversations-signatures.ts`

```typescript
import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';

const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
const dbPath = path.join(homeDir, '.grok', 'conversations.db');

console.log(`📦 Migration conversations.db - Ajout signatures`);
console.log(`   Database: ${dbPath}\n`);

const db = new Database(dbPath);

// 1. Ajouter colonnes à messages
console.log('1️⃣  Ajout colonne checksum à messages...');
db.exec(`ALTER TABLE messages ADD COLUMN checksum TEXT`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_checksum ON messages(checksum)`);

// 2. Ajouter colonnes à sessions
console.log('2️⃣  Ajout colonnes à sessions...');
db.exec(`ALTER TABLE sessions ADD COLUMN rolling_checksum TEXT`);
db.exec(`ALTER TABLE sessions ADD COLUMN last_verified_at INTEGER`);
db.exec(`ALTER TABLE sessions ADD COLUMN corrupted_at INTEGER`);

// 3. Créer table session_signatures
console.log('3️⃣  Création table session_signatures...');
db.exec(`
  CREATE TABLE IF NOT EXISTS session_signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    prev_signature_checksum TEXT,

    CHECK (length(checksum) = 64),
    CHECK (prev_signature_checksum IS NULL OR length(prev_signature_checksum) = 64),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_signatures_session ON session_signatures(session_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_signatures_message ON session_signatures(message_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_signatures_timestamp ON session_signatures(timestamp DESC)`);

// 4. Calculer checksums pour messages existants
console.log('4️⃣  Calcul checksums messages existants...');

const sessions = db.prepare('SELECT id FROM sessions').all() as any[];

for (const session of sessions) {
  const messages = db.prepare(`
    SELECT id, type, role, content, timestamp, tool_calls, tool_call_id
    FROM messages
    WHERE session_id = ?
    ORDER BY id ASC
  `).all(session.id) as any[];

  let rollingChecksum: string | null = null;

  for (const msg of messages) {
    // Calculer checksum du message
    const msgChecksum = crypto.createHash('sha256')
      .update(JSON.stringify({
        id: msg.id,
        type: msg.type,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        tool_calls: msg.tool_calls || null,
        tool_call_id: msg.tool_call_id || null,
      }))
      .digest('hex');

    // Mettre à jour message
    db.prepare('UPDATE messages SET checksum = ? WHERE id = ?')
      .run(msgChecksum, msg.id);

    // Calculer rolling checksum
    const base = rollingChecksum || '';
    rollingChecksum = crypto.createHash('sha256')
      .update(base + msgChecksum)
      .digest('hex');

    // Insérer signature
    const lastSignature = db.prepare(`
      SELECT checksum FROM session_signatures
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(session.id) as any;

    db.prepare(`
      INSERT INTO session_signatures (
        session_id,
        message_id,
        checksum,
        timestamp,
        prev_signature_checksum
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      session.id,
      msg.id,
      rollingChecksum,
      Date.now() * 1000,
      lastSignature?.checksum || null
    );
  }

  // Mettre à jour rolling_checksum de la session
  db.prepare('UPDATE sessions SET rolling_checksum = ? WHERE id = ?')
    .run(rollingChecksum, session.id);

  console.log(`   ✅ Session ${session.id}: ${messages.length} messages, checksum: ${rollingChecksum?.slice(0, 16)}...`);
}

db.close();

console.log('\n✅ Migration terminée !');
```

**Exécution** :
```bash
npx tsx scripts/migrate-conversations-signatures.ts
```

---

## 🔄 ORDRE D'IMPLÉMENTATION

### **Phase 1 : Corrections Urgentes** (Aujourd'hui)

1. ✅ Durcir `cleanMessagesForProvider()` - adjacence stricte
2. ✅ Filtrer `restoreFromHistory()` - drop orphelins
3. ✅ Purger BD corrompue (backup + DELETE)
4. ✅ Tests avec session propre

### **Phase 2 : Signatures par Message** (Après stabilisation)

5. ✅ Migration schéma (script `migrate-conversations-signatures.ts`)
6. ✅ Implémenter `calculateMessageChecksum()`
7. ✅ Implémenter `calculateRollingChecksum()`
8. ✅ Modifier `addMessage()` pour calcul automatique
9. ✅ Implémenter `anchorInTimeline()` (event SESSION_SIGNATURE)
10. ✅ Implémenter `verifySessionIntegrity()`
11. ✅ Implémenter détection au chargement (alerte + event CORRUPTION_DETECTED)
12. ✅ Ajouter commande `/verify-conversation`
13. ✅ Tests unitaires

### **Phase 3 : UX** (Après sécurisation)

14. ✅ Formatter timestamps UI `[JJ/MM HH:MM]`
15. ✅ Afficher début de session avec horodatage complet
16. ✅ Commande `/sessions` avec statut intégrité

---

## 🎯 EXEMPLE DE FLUX COMPLET

### Écriture d'un Message

```
1. User tape: "bonjour"
2. addMessage(sessionId, {role: 'user', content: 'bonjour', ...})
   ├─ INSERT INTO messages (session_id, role, content, timestamp, ...)
   ├─ msg_checksum = SHA256({id:1, role:'user', content:'bonjour', ...})
   ├─ UPDATE messages SET checksum = msg_checksum WHERE id = 1
   ├─ rolling_checksum = SHA256('' + msg_checksum)  # Premier message
   ├─ UPDATE sessions SET rolling_checksum = rolling_checksum
   └─ INSERT INTO session_signatures (session_id, message_id, checksum, ...)

3. API répond: "Bonjour !"
4. addMessage(sessionId, {role: 'assistant', content: 'Bonjour !', ...})
   ├─ INSERT INTO messages (session_id, role, content, timestamp, ...)
   ├─ msg_checksum = SHA256({id:2, role:'assistant', content:'Bonjour !', ...})
   ├─ UPDATE messages SET checksum = msg_checksum WHERE id = 2
   ├─ rolling_checksum = SHA256(prev_rolling + msg_checksum)
   ├─ UPDATE sessions SET rolling_checksum = rolling_checksum
   └─ INSERT INTO session_signatures (session_id, message_id, checksum, ...)

5. Tous les 5 messages OU si tool message:
   └─ EventBus.emit(SESSION_SIGNATURE) → timeline.db (ancrage immuable)
```

### Détection de Corruption

```
1. loadSession(sessionId)
   └─ verifySessionIntegrity(sessionId)
      ├─ Recalculer rolling_checksum depuis début
      ├─ Comparer avec sessions.rolling_checksum
      └─ Si mismatch:
         ├─ console.error("⚠️ CORRUPTION DÉTECTÉE")
         ├─ UPDATE sessions SET corrupted_at = NOW()
         ├─ EventBus.emit(CORRUPTION_DETECTED) → timeline.db
         └─ throw Error("Session corrompue")
```

### Vérification Manuelle

```bash
# Dans Grokinou
> /verify-conversation
🔍 Vérification session 1...
✅ Session intègre
   Checksum: 82c3563f952d7841c0823732be411aa768d010f8e48ed48ee1e2b27f6ae23952

> /verify-conversation --all
🔍 Vérification de 3 sessions...
✅ Session 1 (Debug corruption) - OK
✅ Session 2 (Architecture review) - OK
❌ Session 3 (Test sabotage) - CORROMPUE
   Message corrompu: 42
   Horodatage: 2025-12-14T09:08:15.000Z

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Valides: 2
❌ Corrompues: 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 📊 COÛT FINAL EN RESSOURCES

### Stockage
- 1 message = 1 checksum (64 bytes) + 1 signature (~100 bytes) = **164 bytes**
- 1000 messages = **164 KB** (négligeable)

### CPU
- **Par message** : 2 SHA256 (message + rolling) + 2 INSERT = **< 2ms**
- **Ancrage timeline** : Tous les 5 messages = **+0.4ms par message en moyenne**
- **Total** : **~2.4ms par message** (imperceptible)

### Vérification
- **Au chargement** : O(n) recalcul rolling checksum
- **1000 messages** : ~100ms (acceptable)
- **Optimisation** : Vérifier uniquement depuis dernière signature valide

---

## ✅ VALIDATION FINALE

**Critères de réussite** :
- ✅ Corruption détectée **immédiatement** au chargement
- ✅ Message corrompu identifié **précisément** (id + timestamp)
- ✅ Event CORRUPTION_DETECTED ancré dans **timeline.db** (immuable)
- ✅ Coût < 5ms par message
- ✅ Aucune perte de fonctionnalité

**Test de validation** :
```bash
# 1. Session normale
npm run dev
> bonjour
✅ OK

# 2. Corruption manuelle
sqlite3 ~/.grok/conversations.db "UPDATE messages SET content = 'CORRUPTED' WHERE id = 5"

# 3. Relancer
npm run dev
❌ ⚠️ CORRUPTION DÉTECTÉE
   Session: 1
   Message corrompu: 5

# 4. Vérifier timeline.db
sqlite3 ~/.grok/timeline.db "SELECT * FROM events WHERE event_type = 'CORRUPTION_DETECTED'"
✅ Event présent avec horodatage exact
```

---

**FIN DU PLAN** 🎯

Prêt pour Phase 1 (corrections urgentes) ?
