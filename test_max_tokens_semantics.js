#!/usr/bin/env node

/**
 * Test pour comprendre la sémantique de max_tokens
 * Est-ce que max_tokens est :
 * 1. Limite de sortie seulement ?
 * 2. Limite combinée entrée+sortie ?
 * 3. Limite de sortie mais avec contrainte de contexte total ?
 */

import { GrokClient } from './dist/grok/client.js';

// Créer un client de test (sans initialiser réellement)
console.log('Simulation seulement - pas d\'appel API réel\n');

// Simuler différents scénarios
console.log('🧪 Test de sémantique de max_tokens\n');

// Scénario 1: Petit contexte, petite limite
console.log('📊 Scénario 1: Petit contexte (1000 tokens), max_tokens=100');
console.log('   - Entrée: ~1000 tokens');
console.log('   - max_tokens: 100');
console.log('   - Question: Le modèle peut-il répondre ?');

// Scénario 2: Grand contexte, petite limite  
console.log('\n📊 Scénario 2: Grand contexte (8000 tokens), max_tokens=100');
console.log('   - Entrée: ~8000 tokens');
console.log('   - max_tokens: 100');
console.log('   - Question: Le modèle peut-il répondre ?');

// Scénario 3: Grand contexte, grande limite
console.log('\n📊 Scénario 3: Grand contexte (8000 tokens), max_tokens=8000');
console.log('   - Entrée: ~8000 tokens');
console.log('   - max_tokens: 8000');
console.log('   - Question: Le modèle peut-il répondre ?');

// Scénario 4: Très grand contexte, limite raisonnable
console.log('\n📊 Scénario 4: Très grand contexte (15000 tokens), max_tokens=2000');
console.log('   - Entrée: ~15000 tokens');
console.log('   - max_tokens: 2000');
console.log('   - Question: Le modèle peut-il répondre ?');

// Vérifier la documentation des APIs
console.log('\n📚 Documentation des APIs:');
console.log('   - OpenAI: max_tokens = "The maximum number of tokens to generate in the chat completion."');
console.log('   - Anthropic: max_tokens = "The maximum number of tokens to generate before stopping."');
console.log('   - Mistral: max_tokens = "The maximum number of tokens to generate."');

console.log('\n🔍 Conclusion probable:');
console.log('   max_tokens limite SEULEMENT la sortie (tokens générés).');
console.log('   MAIS: La fenêtre de contexte totale (entrée+sortie) est limitée par le modèle.');
console.log('   Exemple: GPT-4 a 128K de contexte max.');
console.log('   Si entrée = 120K tokens, max_tokens ne peut pas dépasser 8K (128K - 120K).');

console.log('\n⚠️  Problème identifié:');
console.log('   Si on envoie beaucoup de fichiers (ex: 100K tokens)');
console.log('   Et qu\'on met max_tokens=32K');
console.log('   L\'API va refuser car 100K + 32K > 128K (limite du modèle)');
console.log('   Le modèle NE PEUT PAS répondre car pas assez d\'espace dans le contexte.');