#!/usr/bin/env node

/**
 * Simulation d'erreur de fenêtre de contexte
 * 
 * Scénario: 
 * 1. On envoie 100K tokens en entrée (fichiers)
 * 2. On demande max_tokens=32K
 * 3. Le modèle a 128K de contexte max
 * 4. 100K + 32K = 132K > 128K → ERREUR
 */

console.log('🧠 Simulation d\'erreur de fenêtre de contexte\n');

// Capacités des modèles
const MODEL_CONTEXTS = {
  'gpt-4-turbo': 128000,      // 128K
  'gpt-4o': 128000,           // 128K  
  'gpt-3.5-turbo': 16385,     // 16K
  'claude-3-5-sonnet': 200000, // 200K
  'claude-3-opus': 200000,     // 200K
  'grok-2-1212': 131072,      // 128K
  'deepseek-chat': 128000,     // 128K
  'mistral-large': 128000,     // 128K
  'o1-preview': 128000,        // 128K
  'o3-mini': 200000,           // 200K
  'gpt-5': 128000,             // 128K
};

// Scénarios de test
const scenarios = [
  {
    model: 'gpt-4-turbo',
    inputTokens: 100000,
    maxTokens: 32000,
    expectedError: true,
    reason: '100K + 32K = 132K > 128K'
  },
  {
    model: 'gpt-4-turbo',
    inputTokens: 80000,
    maxTokens: 32000,
    expectedError: false,
    reason: '80K + 32K = 112K < 128K'
  },
  {
    model: 'claude-3-5-sonnet',
    inputTokens: 180000,
    maxTokens: 32000,
    expectedError: false,
    reason: '180K + 32K = 212K > 200K (mais Claude peut gérer?)'
  },
  {
    model: 'gpt-3.5-turbo',
    inputTokens: 12000,
    maxTokens: 4000,
    expectedError: false,
    reason: '12K + 4K = 16K = limite'
  },
  {
    model: 'gpt-3.5-turbo',
    inputTokens: 14000,
    maxTokens: 4000,
    expectedError: true,
    reason: '14K + 4K = 18K > 16K'
  }
];

console.log('📊 Scénarios de test:\n');

scenarios.forEach((scenario, i) => {
  const contextLimit = MODEL_CONTEXTS[scenario.model] || 128000;
  const totalTokens = scenario.inputTokens + scenario.maxTokens;
  const willError = totalTokens > contextLimit;
  
  console.log(`🔹 Scénario ${i+1}: ${scenario.model}`);
  console.log(`   Entrée: ${scenario.inputTokens.toLocaleString()} tokens`);
  console.log(`   max_tokens: ${scenario.maxTokens.toLocaleString()} tokens`);
  console.log(`   Total: ${totalTokens.toLocaleString()} tokens`);
  console.log(`   Limite modèle: ${contextLimit.toLocaleString()} tokens`);
  console.log(`   Dépassement: ${totalTokens - contextLimit} tokens`);
  console.log(`   Erreur attendue: ${willError ? '✅ OUI' : '❌ NON'}`);
  console.log(`   Raison: ${scenario.reason}`);
  console.log('');
});

console.log('🔍 Analyse du problème:');
console.log('1. max_tokens limite SEULEMENT la sortie');
console.log('2. Mais entrée + sortie ≤ limite de contexte du modèle');
console.log('3. Si entrée est grande, max_tokens doit être réduit');
console.log('4. Actuellement, max_tokens est fixe (32K, 16K, etc.)');
console.log('5. Résultat: Erreur "context_length_exceeded" quand entrée est grande');

console.log('\n💡 Solution nécessaire:');
console.log('   max_tokens doit être ADAPTATIF:');
console.log('   max_tokens = min(limite_par_defaut, limite_contexte - entrée)');
console.log('   Exemple: Si entrée = 100K, contexte = 128K');
console.log('            max_tokens = min(32K, 128K - 100K) = 28K');