// Test d'initialisation de timeline.db
import { TimelineDatabase } from '../src/timeline/database.js';

console.log("🔍 Test d'initialisation de timeline.db...\n");

try {
  const db = TimelineDatabase.getInstance();
  console.log("✅ Timeline database initialisée avec succès!");
  
  const stats = db.getStats();
  console.log("\n📊 Statistiques:");
  console.log(`   Événements: ${stats.total_events}`);
  console.log(`   Snapshots: ${stats.total_snapshots}`);
  console.log(`   Blobs: ${stats.total_blobs}`);
  console.log(`   Taille: ${stats.db_size_mb} MB`);
  
  const schemaVersion = db.getMetadata('schema_version');
  console.log(`\n🔖 Version du schéma: ${schemaVersion}`);
  
  // Vérifier que les tables existent
  const conn = db.getConnection();
  const tables = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log(`\n📋 Tables créées (${tables.length}):`);
  tables.forEach((t: any) => console.log(`   • ${t.name}`));
  
  // Vérifier la structure de snapshots
  const snapshotsCols = conn.prepare("PRAGMA table_info(snapshots)").all();
  console.log(`\n🔍 Colonnes de 'snapshots' (${snapshotsCols.length}):`);
  snapshotsCols.forEach((c: any) => console.log(`   • ${c.name} (${c.type})`));
  
  const hasCreatedAt = snapshotsCols.some((c: any) => c.name === 'created_at');
  if (hasCreatedAt) {
    console.log("\n✅ La colonne 'created_at' existe bien dans 'snapshots'!");
  } else {
    console.log("\n❌ ERREUR: La colonne 'created_at' n'existe pas!");
    process.exit(1);
  }
  
  db.close();
  console.log("\n✅ Test réussi! L'application devrait démarrer correctement.");
  process.exit(0);
  
} catch (error) {
  console.error("\n❌ Erreur lors de l'initialisation:", error);
  process.exit(1);
}
