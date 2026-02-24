/**
 * SkillRegistry - Charge et indexe les skills depuis les fichiers MD
 *
 * Priorité (décroissante):
 * 1. Projet: .grokinou/skills/*.md
 * 2. User global: ~/.config/grokinou/skills/*.md
 * 3. Built-in: src/skills/builtins/*.md (livrés avec le CLI)
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { parseFrontmatter } from './frontmatter.js';
import { debugLog } from '../utils/debug-logger.js';

export interface SkillDefinition {
  name: string;
  description: string;
  model?: string;
  provider?: string;
  tools?: string[];
  parallel?: boolean;
  prompt: string;
  source: 'project' | 'user' | 'builtin';
  filePath: string;
}

export class SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map();

  constructor() {
    this.loadAll();
  }

  /**
   * Charge les skills depuis les 3 répertoires
   * Les skills de priorité haute écrasent ceux de priorité basse
   */
  loadAll(): void {
    this.skills.clear();

    // 3. Built-in (priorité la plus basse → chargé en premier)
    const builtinDir = this.getBuiltinDir();
    this.loadFromDirectory(builtinDir, 'builtin');

    // 2. User global
    const userDir = join(homedir(), '.config', 'grokinou', 'skills');
    this.loadFromDirectory(userDir, 'user');

    // 1. Projet (priorité la plus haute → chargé en dernier, écrase)
    const projectDir = join(process.cwd(), '.grokinou', 'skills');
    this.loadFromDirectory(projectDir, 'project');

    debugLog.log(`📚 SkillRegistry: ${this.skills.size} skill(s) loaded`);
  }

  /**
   * Récupère le répertoire builtins relatif au fichier compilé
   */
  private getBuiltinDir(): string {
    // En dev: src/skills/builtins/
    // En prod: dist/skills/builtins/
    const devPath = join(process.cwd(), 'src', 'skills', 'builtins');
    if (existsSync(devPath)) return devPath;

    // Fallback: chemin relatif au module courant
    const distPath = new URL('../skills/builtins', import.meta.url);
    try {
      const resolvedPath = distPath.pathname;
      if (existsSync(resolvedPath)) return resolvedPath;
    } catch {}

    return devPath; // retourner le chemin dev par défaut
  }

  /**
   * Charge les skills depuis un répertoire donné
   */
  private loadFromDirectory(dir: string, source: SkillDefinition['source']): void {
    if (!existsSync(dir)) return;

    let files: string[];
    try {
      files = readdirSync(dir).filter(f => f.endsWith('.md'));
    } catch {
      return;
    }

    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const raw = readFileSync(filePath, 'utf-8');
        const skill = this.parseSkillFile(raw, file, source, filePath);
        if (skill) {
          this.skills.set(skill.name, skill);
        }
      } catch (err) {
        debugLog.log(`⚠️ SkillRegistry: Failed to load ${filePath}: ${err}`);
      }
    }
  }

  /**
   * Parse un fichier skill MD en SkillDefinition
   */
  private parseSkillFile(
    raw: string,
    filename: string,
    source: SkillDefinition['source'],
    filePath: string
  ): SkillDefinition | null {
    const { data, content } = parseFrontmatter(raw);

    if (!content.trim()) {
      debugLog.log(`⚠️ SkillRegistry: Empty prompt in ${filename}, skipping`);
      return null;
    }

    // Nom: frontmatter 'name' ou nom du fichier sans extension
    const name = typeof data.name === 'string'
      ? data.name
      : basename(filename, '.md');

    const description = typeof data.description === 'string'
      ? data.description
      : `Skill: ${name}`;

    return {
      name,
      description,
      model: typeof data.model === 'string' ? data.model : undefined,
      provider: typeof data.provider === 'string' ? data.provider : undefined,
      tools: Array.isArray(data.tools) ? data.tools : undefined,
      parallel: typeof data.parallel === 'boolean' ? data.parallel : false,
      prompt: content,
      source,
      filePath,
    };
  }

  /**
   * Récupère un skill par nom
   */
  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  /**
   * Liste tous les skills chargés
   */
  list(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * Hot-reload: recharge tous les skills
   */
  reload(): void {
    this.loadAll();
  }
}

// Singleton
let registryInstance: SkillRegistry | null = null;

export function getSkillRegistry(): SkillRegistry {
  if (!registryInstance) {
    registryInstance = new SkillRegistry();
  }
  return registryInstance;
}
