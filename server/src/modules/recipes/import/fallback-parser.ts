import { findElements, getAttribute, htmlToText } from './html.js';
import type { RawRecipe } from './types.js';

/**
 * Dernier repli, purement heuristique : aucune donnée structurée n'est
 * disponible, on devine à partir des classes/ids CSS et des listes.
 *
 * Limites assumées (voir docs/recipe-import.md) :
 * - ne fonctionne que si le balisage nomme ses conteneurs (`class="ingredients"`) ;
 * - ne sait pas distinguer un encart « recettes similaires » d'une vraie liste ;
 * - exige au moins 2 ingrédients pour éviter les faux positifs.
 */

const MIN_INGREDIENTS = 2;
const MAX_ITEMS = 80;
const MIN_STEP_LENGTH = 12;

const INGREDIENT_CONTAINER_RE = /ingredient|ingrédient/i;
const STEP_CONTAINER_RE = /instruction|preparation|préparation|etape|étape|\bsteps?\b|directions|method/i;
const SERVINGS_RE = /(\d+(?:[.,]\d+)?)\s*(?:person(?:ne)?s?|parts?|portions?|couverts?|servings?|people)/i;
const H1_RE = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i;
const TITLE_RE = /<title\b[^>]*>([\s\S]*?)<\/title>/i;

export function parseHeuristicRecipe(html: string): RawRecipe | null {
  const ingredientLines = collectListItems(html, INGREDIENT_CONTAINER_RE, 1);
  if (ingredientLines.length < MIN_INGREDIENTS) return null;

  const instructionBlocks = collectListItems(html, STEP_CONTAINER_RE, MIN_STEP_LENGTH);

  return {
    name: readPageTitle(html),
    servingsRaw: SERVINGS_RE.exec(htmlToText(html))?.[0],
    ingredientLines,
    instructionBlocks,
    extraction: 'heuristic',
  };
}

/**
 * Cherche les conteneurs dont `class`/`id`/`data-*` évoque le concept visé,
 * puis en extrait les éléments de liste (ou les paragraphes à défaut).
 */
function collectListItems(html: string, conceptRe: RegExp, minLength: number): string[] {
  const containers = findElements(html, (tagName, attributes) => {
    if (tagName === 'li' || tagName === 'p' || tagName === 'span') return false;
    const marker = `${getAttribute(attributes, 'class') ?? ''} ${getAttribute(attributes, 'id') ?? ''}`;
    return conceptRe.test(marker);
  });

  const seen = new Set<string>();
  const items: string[] = [];

  for (const container of containers) {
    const children = findElements(container.innerHtml, (tagName) => tagName === 'li');
    const blocks =
      children.length > 0
        ? children
        : findElements(container.innerHtml, (tagName) => tagName === 'p');

    for (const block of blocks) {
      const text = htmlToText(block.innerHtml);
      if (text.length < minLength) continue;

      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(text);

      if (items.length >= MAX_ITEMS) return items;
    }
  }

  return items;
}

function readPageTitle(html: string): string | undefined {
  const ogTitle = findElements(html, (tagName, attributes) => {
    if (tagName !== 'meta') return false;
    const property = getAttribute(attributes, 'property') ?? getAttribute(attributes, 'name');
    return property === 'og:title' || property === 'twitter:title';
  })
    .map((element) => getAttribute(element.attributes, 'content')?.trim())
    .find((content): content is string => Boolean(content));

  if (ogTitle) return ogTitle;

  const heading = H1_RE.exec(html)?.[1];
  if (heading) {
    const text = htmlToText(heading);
    if (text) return text;
  }

  const title = TITLE_RE.exec(html)?.[1];
  if (!title) return undefined;

  // « Lasagnes maison - Recette | MonSite » -> « Lasagnes maison »
  const text = htmlToText(title).split(/\s+[|–—-]\s+/)[0]?.trim();
  return text || undefined;
}
