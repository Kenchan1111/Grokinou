#!/usr/bin/env node
/**
 * Timeline Rewind Test
 *
 * But:
 *   - Prendre le dernier événement FILE_* de la timeline
 *   - Exécuter un rewind vers ce timestamp dans un répertoire temporaire
 *   - Vérifier que les fichiers matérialisés correspondent à leurs hashes Merkle
 *
 * Usage:
 *   npm run timeline:rewind-test
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  getRewindEngine,
  getQueryEngine,
  EventCategory,
} from '../src/timeline/index.js';

async function main() {
  const lines: string[] = [];
  const log = (msg: string) => {
    lines.push(msg);
  };

  const rewindEngine = getRewindEngine();
  const queryEngine = getQueryEngine();

  // 1. Trouver le dernier événement FILE_* pour avoir un timestamp pertinent
  const fileEvents = queryEngine.query({
    categories: [EventCategory.FILE],
    limit: 1,
    order: 'desc',
  });

  if (fileEvents.events.length === 0) {
    log('⚠️  Aucun événement FILE_* trouvé dans timeline.db');
    log('   → Laisse grokinou tourner un peu avec initTimeline actif, puis relance ce script.');
    await writeLog(lines, 'timeline-rewind-test.log');
    return;
  }

  const lastFileEvent = fileEvents.events[0];
  const targetTimestamp = lastFileEvent.timestamp;

  log('🧪 Timeline Rewind Test');
  log('');
  log('Dernier événement FILE_* :');
  log(`  ID:        ${lastFileEvent.id}`);
  log(`  Type:      ${lastFileEvent.event_type}`);
  log(`  Fichier:   ${lastFileEvent.aggregate_id}`);
  log(`  Timestamp: ${targetTimestamp}`);
  log('');

  // 2. Choisir un répertoire de sortie pour le rewind
  const cwd = process.cwd();
  const outputDir = path.join(cwd, `.rewind_test_${targetTimestamp}`);

  if (fs.existsSync(outputDir)) {
    log(`ℹ️  Répertoire de test déjà présent, suppression: ${outputDir}`);
    await fs.promises.rm(outputDir, { recursive: true, force: true });
  }

  log(`⏪ Rewind vers timestamp = ${targetTimestamp}`);
  log(`   Répertoire de sortie: ${outputDir}`);
  log('');

  // 3. Exécuter le rewind (fichiers uniquement, pas de Git, pas de conversations)
  const result = await rewindEngine.rewindTo({
    targetTimestamp,
    outputDir,
    includeFiles: true,
    includeConversations: false,
    gitMode: 'none',
    createSession: false,
    autoCheckout: false,
    compareWith: undefined,
    onProgress: (msg, progress) => {
      if (progress === 0 || progress === 40 || progress === 80 || progress === 100) {
        log(`  [${progress}%] ${msg}`);
      }
    },
  });

  if (!result.success) {
    log('');
    log('❌ Rewind échoué:');
    log(`   Erreur: ${result.error || 'Unknown error'}`);
    await writeLog(lines, 'timeline-rewind-test.log');
    return;
  }

  log('');
  log('✅ Rewind terminé avec succès');
  log(`   Fichiers restaurés: ${result.filesRestored}`);
  log(`   Événements rejoués: ${result.eventsReplayed}`);
  log(`   Répertoire:         ${result.outputDirectory}`);

  // 4. Vérifier que les fichiers matérialisés correspondent à leur hash Merkle
  const manifestPath = path.join(result.outputDirectory, 'file_manifest.json');

  if (!fs.existsSync(manifestPath)) {
    log('');
    log('❌ file_manifest.json introuvable dans le répertoire de rewind');
    await writeLog(lines, 'timeline-rewind-test.log');
    return;
  }

  const manifestRaw = await fs.promises.readFile(manifestPath, 'utf-8');
  let manifest: Array<[string, any]>;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch (error) {
    log('');
    log('❌ Impossible de parser file_manifest.json:');
    log((error as Error).message);
    await writeLog(lines, 'timeline-rewind-test.log');
    return;
  }

  if (!Array.isArray(manifest) || manifest.length === 0) {
    log('');
    log('⚠️  Manifest vide ou invalide, rien à vérifier.');
    await writeLog(lines, 'timeline-rewind-test.log');
    return;
  }

  log('');
  log('🔍 Vérification des fichiers matérialisés vs hashes Merkle:');

  let totalFiles = 0;
  let filesWithHash = 0;
  let verifiedOk = 0;
  let mismatches = 0;
  let missingOnDisk = 0;

  const filesDir = path.join(result.outputDirectory, 'files');

  for (const [relPath, state] of manifest) {
    const fileState = state as {
      path: string;
      contentHash: string | null;
      exists: boolean;
    };

    if (!fileState.exists) {
      continue;
    }

    totalFiles++;

    if (!fileState.contentHash) {
      continue;
    }

    filesWithHash++;

    const absPath = path.join(filesDir, relPath);
    if (!fs.existsSync(absPath)) {
      missingOnDisk++;
      log(`  ⚠️  Manquant sur disque: ${relPath}`);
      continue;
    }

    try {
      const content = await fs.promises.readFile(absPath);
      const hash = crypto.createHash('sha256').update(content).digest('hex');

      if (hash === fileState.contentHash) {
        verifiedOk++;
      } else {
        mismatches++;
        log(`  ❌ Hash mismatch pour ${relPath}`);
        log(`     Manifest: ${fileState.contentHash}`);
        log(`     Disque:   ${hash}`);
      }
    } catch (error) {
      missingOnDisk++;
      log(`  ⚠️  Impossible de lire ${relPath}: ${(error as Error).message}`);
    }
  }

  log('');
  log('📊 Résumé vérification:');
  log(`  Fichiers existants dans manifest:      ${totalFiles}`);
  log(`  Fichiers avec contentHash non nul:     ${filesWithHash}`);
  log(`  Vérifiés OK (hash identique):          ${verifiedOk}`);
  log(`  Mismatches (hash différent):           ${mismatches}`);
  log(`  Manquants / non lus sur disque:        ${missingOnDisk}`);

  log('');
  log('ℹ️  Le répertoire de test est conservé pour inspection:');
  log(`    ${result.outputDirectory}`);

  await writeLog(lines, 'timeline-rewind-test.log');
}

async function writeLog(lines: string[], fileName: string): Promise<void> {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    await fs.promises.mkdir(logsDir, { recursive: true });
    const fullPath = path.join(logsDir, fileName);
    await fs.promises.writeFile(fullPath, lines.join('\n') + '\n', 'utf-8');
  } catch (error) {
    console.error('❌ Échec d’écriture du log:', error);
  }
}

main().catch((error) => {
  console.error('❌ timeline-rewind-test failed:', error);
  process.exit(1);
});
