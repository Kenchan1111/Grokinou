// Test exact de ce que fait /models dans l'application
import { getSettingsManager } from './dist/utils/settings-manager.js';
import { loadModelConfig } from './dist/utils/model-config.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

console.log('\n=== TEST 1: Via settings-manager.getAvailableModels() ===');
const manager = getSettingsManager();
const models1 = manager.getAvailableModels();
console.log('Count:', models1.length);
console.log('First 5:', models1.slice(0, 5));
console.log('Last 5:', models1.slice(-5));

console.log('\n=== TEST 2: Via loadModelConfig() (ce que use-input-handler utilise) ===');
const models2 = loadModelConfig();
console.log('Count:', models2.length);
console.log('First 5:', models2.slice(0, 5).map(m => m.model));
console.log('Last 5:', models2.slice(-5).map(m => m.model));

console.log('\n=== TEST 3: Vérifier user-settings.json ===');
const settingsPath = path.join(os.homedir(), '.grok', 'user-settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
console.log('user-settings.json models count:', settings.models?.length || 0);
console.log('First 5:', settings.models?.slice(0, 5));
console.log('Last 5:', settings.models?.slice(-5));

console.log('\n=== RÉSUMÉ ===');
console.log('Settings Manager:', models1.length, 'modèles');
console.log('Model Config:', models2.length, 'modèles');
console.log('User Settings File:', settings.models?.length || 0, 'modèles');
console.log('\nTous égaux?', models1.length === models2.length && models1.length === settings.models?.length);
