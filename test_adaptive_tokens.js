#!/usr/bin/env node

/**
 * Test de la logique adaptative des tokens
 */

console.log('🧪 Test de la logique adaptative des tokens\n');

// Simulation de la fonction calculateAdaptiveMaxTokens
function calculateAdaptiveMaxTokens(contextWindow, inputTokens, defaultMaxTokens) {
  // If unlimited (0), keep unlimited
  if (defaultMaxTokens === 0) {
    return 0;
  }
  
  // Calculate available tokens for output
  const availableForOutput = contextWindow - inputTokens;
  
  // Safety margin: reserve 10% of context window for model overhead
  const safetyMargin = Math.floor(contextWindow * 0.1);
  const safeAvailable = Math.max(0, availableForOutput - safetyMargin);
  
  // If not enough space even for minimal response
  if (safeAvailable < 100) {
    console.log(`⚠️  Context window almost full: input=${inputTokens.toLocaleString()}, context=${contextWindow.toLocaleString()}, available=${safeAvailable}`);
    return 100; // Minimal response
  }
  
  // Use the smaller of: default limit OR available space
  const adaptiveMaxTokens = Math.min(defaultMaxTokens, safeAvailable);
  
  // Log adaptive adjustment
  if (adaptiveMaxTokens < defaultMaxTokens) {
    console.log(`🔄 Adaptive max_tokens: ${defaultMaxTokens.toLocaleString()} → ${adaptiveMaxTokens.toLocaleString()} (input: ${inputTokens.toLocaleString()} tokens)`);
  }
  
  return adaptiveMaxTokens;
}

// Scénarios de test
const scenarios = [
  {
    name: "Petit projet (entrée légère)",
    contextWindow: 128000, // GPT-4
    inputTokens: 20000,    // 20K tokens
    defaultMaxTokens: 32768, // 32K par défaut
    expected: 32768,       // Garde 32K
  },
  {
    name: "Projet moyen",
    contextWindow: 128000,
    inputTokens: 80000,    // 80K tokens
    defaultMaxTokens: 32768,
    expected: 32768,       // Garde 32K (128K - 80K - 12.8K = 35.2K > 32K)
  },
  {
    name: "Grand projet (problème identifié!)",
    contextWindow: 128000,
    inputTokens: 100000,   // 100K tokens
    defaultMaxTokens: 32768,
    expected: 15200,       // Adapte à 15.2K (128K - 100K - 12.8K = 15.2K)
  },
  {
    name: "Très grand projet",
    contextWindow: 128000,
    inputTokens: 115000,   // 115K tokens
    defaultMaxTokens: 32768,
    expected: 200,         // Très peu d'espace
  },
  {
    name: "Claude Sonnet (200K)",
    contextWindow: 200000,
    inputTokens: 180000,   // 180K tokens
    defaultMaxTokens: 32768,
    expected: 100,         // Très peu d'espace (200K - 180K - 20K = 0)
  },
  {
    name: "GPT-3.5 (16K)",
    contextWindow: 16385,
    inputTokens: 12000,    // 12K tokens
    defaultMaxTokens: 4096,
    expected: 2747,        // Adapte à 2.7K (16.4K - 12K - 1.6K = 2.8K)
  },
  {
    name: "GPT-3.5 plein",
    contextWindow: 16385,
    inputTokens: 14000,    // 14K tokens
    defaultMaxTokens: 4096,
    expected: 747,         // Peu d'espace (16.4K - 14K - 1.6K = 0.8K)
  },
];

console.log('📊 Résultats des scénarios:\n');

scenarios.forEach((scenario, i) => {
  const result = calculateAdaptiveMaxTokens(
    scenario.contextWindow,
    scenario.inputTokens,
    scenario.defaultMaxTokens
  );
  
  const passed = result === scenario.expected;
  
  console.log(`🔹 ${scenario.name}`);
  console.log(`   Contexte: ${scenario.contextWindow.toLocaleString()} tokens`);
  console.log(`   Entrée: ${scenario.inputTokens.toLocaleString()} tokens`);
  console.log(`   Default max_tokens: ${scenario.defaultMaxTokens.toLocaleString()}`);
  console.log(`   Résultat: ${result.toLocaleString()} tokens`);
  console.log(`   Attendu: ${scenario.expected.toLocaleString()} tokens`);
  console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
});

console.log('🎯 Conclusion:');
console.log('La logique adaptative résout le problème identifié:');
console.log('1. Quand entrée est grande (ex: 100K tokens)');
console.log('2. max_tokens est réduit automatiquement (32K → 15.2K)');
console.log('3. Évite l\'erreur "context_length_exceeded"');
console.log('4. Le modèle peut répondre même avec beaucoup de fichiers');