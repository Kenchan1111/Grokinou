#!/usr/bin/env node
/**
 * Timeline / Merkle DAG consistency check
 *
 * - Vérifie que les événements FILE_* ont bien un blob dans file_blobs
 * - Vérifie, pour quelques fichiers encore présents sur disque, que le hash Merkle
 *   correspond au contenu actuel du fichier
 *
 * Usage:
 *   npm run timeline:check
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { TimelineDatabase } from '../src/timeline/database.js';
import { MerkleDAG } from '../src/timeline/storage/merkle-dag.js';
import { EventType } from '../src/timeline/event-types.js';

async function main() {
  const lines: string[] = [];
  const log = (msg: string) => {
    lines.push(msg);
  };

  const db = TimelineDatabase.getInstance();
  const merkle = MerkleDAG.getInstance();

  const conn = db.getConnection();

  // Stats globales
  const totalEventsRow = conn
    .prepare('SELECT COUNT(*) as count FROM events')
    .get() as { count: number };

  const fileEventsRows = conn
    .prepare(
      `SELECT COUNT(*) as count 
       FROM events 
       WHERE event_type IN (?, ?)`
    )
    .get(EventType.FILE_CREATED, EventType.FILE_MODIFIED) as { count: number };

  log('🔍 Timeline / Merkle DAG consistency check');
  log('');
  log(`Total events:        ${totalEventsRow.count}`);
  log(`FILE_* events:       ${fileEventsRows.count}`);

  if (fileEventsRows.count === 0) {
    log('');
    log('⚠️  Aucun événement FILE_* trouvé dans timeline.db');
    log('   Laisse grokinou tourner un peu avec initTimeline actif, puis relance ce script.');
    await writeLog(lines, 'timeline-merkle-check.log');
    return;
  }

  // Derniers événements FILE_* avec hash
  const rows = conn
    .prepare(
      `SELECT id, event_type, aggregate_id, payload, timestamp
       FROM events
       WHERE event_type IN (?, ?)
       ORDER BY timestamp DESC
       LIMIT 100`
    )
    .all(EventType.FILE_CREATED, EventType.FILE_MODIFIED) as any[];

  let withHash = 0;
  let blobsFound = 0;

  const samplesForFsCheck: {
    path: string;
    hash: string;
  }[] = [];

  for (const row of rows) {
    let payload: any;
    try {
      payload = JSON.parse(row.payload);
    } catch {
      continue;
    }

    const hash: string | undefined = payload.new_hash || payload.content_hash;
    if (!hash || typeof hash !== 'string' || hash.length !== 64) {
      continue;
    }

    withHash++;

    const info = merkle.getBlobInfo(hash);
    if (info) {
      blobsFound++;

      // On garde quelques exemples pour vérifier le contenu sur disque
      if (samplesForFsCheck.length < 5 && typeof payload.path === 'string') {
        samplesForFsCheck.push({
          path: payload.path,
          hash,
        });
      }
    }
  }

  log('');
  log(`FILE_* events analysés (avec hash): ${withHash}`);
  log(`Blobs présents dans file_blobs:     ${blobsFound}`);

  if (withHash === 0) {
    log('');
    log('⚠️  Aucun FILE_* récent avec new_hash détecté.');
    log('   Vérifie que FileHook est bien actif (initTimeline.enableFileHook=true).');
    await writeLog(lines, 'timeline-merkle-check.log');
    return;
  }

  if (blobsFound === 0) {
    log('');
    log('❌ Aucun blob correspondant trouvé dans file_blobs.');
    log('   → Le Merkle DAG ne reçoit pas les contenus comme prévu.');
    await writeLog(lines, 'timeline-merkle-check.log');
    return;
  }

  // Vérification sur disque pour quelques fichiers récents
  log('');
  log('🧪 Vérification contenu disque vs Merkle pour quelques fichiers:');

  const cwd = process.cwd();
  let fsChecks = 0;
  let fsMatches = 0;

  for (const sample of samplesForFsCheck) {
    const absPath = path.resolve(cwd, sample.path);
    if (!fs.existsSync(absPath)) {
      continue;
    }

    try {
      const content = await fs.promises.readFile(absPath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        fsChecks++;

        const merkleInfo = merkle.getBlobInfo(sample.hash);
        if (!merkleInfo) {
          log(`  ⚠️  ${sample.path}: blob ${sample.hash} introuvable dans file_blobs`);
          continue;
        }

        if (hash === sample.hash) {
          fsMatches++;
          log(`  ✅ ${sample.path}`);
        } else {
          log(`  ❌ ${sample.path}`);
          log(`     Disque:  ${hash}`);
          log(`     Merkle:  ${sample.hash}`);
        }
    } catch (error) {
      log(`  ⚠️  Impossible de lire ${sample.path}: ${(error as Error).message}`);
    }
  }

  if (fsChecks === 0) {
    log('');
    log('⚠️  Aucun des fichiers récents n’existe encore sur disque ou n’a pu être lu.');
  } else {
    log('');
    log(`Fichiers vérifiés sur disque: ${fsChecks}`);
    log(`Hashes identiques (disque vs Merkle): ${fsMatches}`);
  }

  log('');
  log('✅ Vérification terminée.');

  await writeLog(lines, 'timeline-merkle-check.log');
}

async function writeLog(lines: string[], fileName: string): Promise<void> {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    await fs.promises.mkdir(logsDir, { recursive: true });
    const fullPath = path.join(logsDir, fileName);
    await fs.promises.writeFile(fullPath, lines.join('\n') + '\n', 'utf-8');
  } catch (error) {
    // En dernier recours, on loggue l’erreur sur stderr
    console.error('❌ Échec d’écriture du log:', error);
  }
}

main().catch((error) => {
  // On loggue uniquement les erreurs critiques sur stderr
  console.error('❌ timeline-merkle-check failed:', error);
  process.exit(1);
});
