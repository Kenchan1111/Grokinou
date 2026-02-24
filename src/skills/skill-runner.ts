/**
 * SkillRunner - Orchestration d'exécution des skills
 *
 * Supporte:
 * - Exécution séquentielle (un skill)
 * - Exécution parallèle (plusieurs skills)
 * - Multi-provider (même skill sur plusieurs providers)
 */

import { SubAgent, SubAgentResult } from './sub-agent.js';
import { getSkillRegistry, SkillDefinition } from './skill-registry.js';
import { providerManager } from '../utils/provider-manager.js';
import { debugLog } from '../utils/debug-logger.js';

export class SkillRunner {
  /**
   * Exécution séquentielle d'un skill
   */
  async run(skillName: string, context: string): Promise<SubAgentResult> {
    const registry = getSkillRegistry();
    const skill = registry.get(skillName);

    if (!skill) {
      throw new Error(
        `Skill "${skillName}" not found. ` +
        `Available: ${registry.list().map(s => s.name).join(', ') || 'none'}`
      );
    }

    debugLog.log(`🚀 SkillRunner: executing "${skillName}"`);

    const agent = new SubAgent(skill);
    return agent.execute(context);
  }

  /**
   * Exécution parallèle de plusieurs skills
   * Utilise Promise.allSettled pour que l'échec d'un agent ne bloque pas les autres
   */
  async runParallel(
    requests: Array<{ skillName: string; context: string }>
  ): Promise<SubAgentResult[]> {
    const registry = getSkillRegistry();

    const promises = requests.map(async (req) => {
      const skill = registry.get(req.skillName);
      if (!skill) {
        throw new Error(`Skill "${req.skillName}" not found`);
      }

      const agent = new SubAgent(skill);
      return agent.execute(req.context);
    });

    debugLog.log(
      `🚀 SkillRunner: parallel execution of ${requests.length} skill(s): ` +
      requests.map(r => r.skillName).join(', ')
    );

    const settled = await Promise.allSettled(promises);

    return settled.map((result, i) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      // Créer un résultat d'erreur pour les skills qui ont échoué
      return {
        skillName: requests[i].skillName,
        model: 'unknown',
        provider: 'unknown',
        content: `Error: ${result.reason?.message || result.reason || 'Unknown error'}`,
        duration: 0,
      };
    });
  }

  /**
   * Exécution parallèle du même skill sur plusieurs providers
   * Utile pour comparer les réponses de différents LLMs
   */
  async runMultiProvider(
    skillName: string,
    context: string,
    providers: string[]
  ): Promise<SubAgentResult[]> {
    const registry = getSkillRegistry();
    const baseSkill = registry.get(skillName);

    if (!baseSkill) {
      throw new Error(
        `Skill "${skillName}" not found. ` +
        `Available: ${registry.list().map(s => s.name).join(', ') || 'none'}`
      );
    }

    debugLog.log(
      `🚀 SkillRunner: multi-provider "${skillName}" on [${providers.join(', ')}]`
    );

    const promises = providers.map(async (providerName) => {
      const providerConfig = providerManager.getProvider(providerName);
      if (!providerConfig) {
        throw new Error(`Provider "${providerName}" not configured`);
      }

      if (!providerConfig.apiKey) {
        throw new Error(
          `No API key for provider "${providerName}". Configure with /apikey ${providerName} <key>`
        );
      }

      // Créer un skill override avec le provider spécifié
      const overriddenSkill: SkillDefinition = {
        ...baseSkill,
        provider: providerName,
        // Utiliser le premier modèle du provider si le skill n'en spécifie pas
        model: baseSkill.model || providerConfig.models[0],
      };

      const agent = new SubAgent(overriddenSkill);
      return agent.execute(context);
    });

    const settled = await Promise.allSettled(promises);

    return settled.map((result, i) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      return {
        skillName,
        model: 'unknown',
        provider: providers[i],
        content: `Error: ${result.reason?.message || result.reason || 'Unknown error'}`,
        duration: 0,
      };
    });
  }
}

// Singleton
let runnerInstance: SkillRunner | null = null;

export function getSkillRunner(): SkillRunner {
  if (!runnerInstance) {
    runnerInstance = new SkillRunner();
  }
  return runnerInstance;
}
