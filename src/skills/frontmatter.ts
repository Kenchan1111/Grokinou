/**
 * Parseur minimaliste YAML frontmatter (0 dépendance)
 *
 * Supporte: strings, booleans, arrays simples (inline [a, b, c])
 * Format attendu:
 * ---
 * key: value
 * array: [a, b, c]
 * ---
 * Body content here
 */

export interface FrontmatterResult {
  data: Record<string, string | boolean | string[]>;
  content: string; // Body après le frontmatter
}

/**
 * Parse un fichier MD avec YAML frontmatter
 */
export function parseFrontmatter(raw: string): FrontmatterResult {
  const trimmed = raw.trimStart();

  // Pas de frontmatter → tout est du contenu
  if (!trimmed.startsWith('---')) {
    return { data: {}, content: raw };
  }

  // Trouver la fermeture ---
  const endIndex = trimmed.indexOf('---', 3);
  if (endIndex === -1) {
    return { data: {}, content: raw };
  }

  const yamlBlock = trimmed.substring(3, endIndex).trim();
  const content = trimmed.substring(endIndex + 3).trim();
  const data: Record<string, string | boolean | string[]> = {};

  for (const line of yamlBlock.split('\n')) {
    const trimLine = line.trim();
    if (!trimLine || trimLine.startsWith('#')) continue;

    const colonIndex = trimLine.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimLine.substring(0, colonIndex).trim();
    let value = trimLine.substring(colonIndex + 1).trim();

    // Booléen
    if (value === 'true') {
      data[key] = true;
    } else if (value === 'false') {
      data[key] = false;
    }
    // Array inline: [a, b, c]
    else if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1);
      data[key] = inner
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }
    // String (retirer les quotes si présentes)
    else {
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      data[key] = value;
    }
  }

  return { data, content };
}
