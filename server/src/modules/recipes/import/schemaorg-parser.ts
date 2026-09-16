import { findElements, getAttribute, htmlToText } from './html.js';
import { extractJsonLdNodes } from './html.js';
import type { RawRecipe } from './types.js';

const RECIPE_TYPE = 'recipe';
const MAX_INSTRUCTION_DEPTH = 6;

/** Propriétés Schema.org (et alias historiques) portant la liste d'ingrédients. */
const INGREDIENT_PROPS = ['recipeIngredient', 'ingredients', 'ingredient'] as const;
const INSTRUCTION_PROPS = ['recipeInstructions', 'recipeInstruction', 'instructions'] as const;
const YIELD_PROPS = ['recipeYield', 'yield'] as const;

/**
 * Chemin principal : données structurées JSON-LD de type `Recipe`.
 * Gère les formes rencontrées en production : noeud unique, tableau de noeuds,
 * `@graph`, et types multiples (`["Recipe", "NewsArticle"]`).
 */
export function parseJsonLdRecipe(html: string): RawRecipe | null {
  for (const node of extractJsonLdNodes(html)) {
    const recipe = findRecipeNode(node, 0);
    if (recipe) return toRawRecipe(recipe, 'json-ld');
  }
  return null;
}

/**
 * Premier repli : microdata Schema.org (`itemprop="recipeIngredient"`, …).
 * Ne remonte une recette que si la page déclare explicitement ces propriétés.
 */
export function parseMicrodataRecipe(html: string): RawRecipe | null {
  const ingredientLines = collectItemPropTexts(html, INGREDIENT_PROPS);
  const instructionBlocks = collectItemPropTexts(html, INSTRUCTION_PROPS);

  if (ingredientLines.length === 0 && instructionBlocks.length === 0) return null;

  const name = collectItemPropTexts(html, ['name'])[0];
  const servingsRaw = collectItemPropTexts(html, YIELD_PROPS)[0];

  return {
    name,
    servingsRaw,
    ingredientLines,
    instructionBlocks,
    extraction: 'microdata',
  };
}

function collectItemPropTexts(html: string, props: readonly string[]): string[] {
  const wanted = new Set(props.map((p) => p.toLowerCase()));

  return findElements(html, (_tagName, attributes) => {
    const itemprop = getAttribute(attributes, 'itemprop');
    if (!itemprop) return false;
    return itemprop
      .split(/\s+/)
      .some((value) => wanted.has(value.replace(/^https?:\/\/schema\.org\//i, '').toLowerCase()));
  })
    .map((element) => {
      // `<meta itemprop="recipeYield" content="4">` porte la valeur en attribut.
      const content = getAttribute(element.attributes, 'content');
      return (content ?? htmlToText(element.innerHtml)).trim();
    })
    .filter((text) => text.length > 0);
}

// ---------------------------------------------------------------------------
// JSON-LD : recherche du noeud Recipe
// ---------------------------------------------------------------------------

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findRecipeNode(node: unknown, depth: number): JsonObject | null {
  if (depth > MAX_INSTRUCTION_DEPTH) return null;

  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findRecipeNode(child, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (!isJsonObject(node)) return null;
  if (hasRecipeType(node['@type'])) return node;

  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement']) {
    const found = node[key] === undefined ? null : findRecipeNode(node[key], depth + 1);
    if (found) return found;
  }

  return null;
}

function hasRecipeType(type: unknown): boolean {
  if (typeof type === 'string') {
    return type.replace(/^https?:\/\/schema\.org\//i, '').toLowerCase() === RECIPE_TYPE;
  }
  if (Array.isArray(type)) return type.some(hasRecipeType);
  return false;
}

function toRawRecipe(node: JsonObject, extraction: 'json-ld'): RawRecipe {
  const instructionBlocks: string[] = [];
  for (const prop of INSTRUCTION_PROPS) {
    if (node[prop] !== undefined) {
      flattenInstructions(node[prop], instructionBlocks, 0);
    }
  }

  const ingredientLines: string[] = [];
  for (const prop of INGREDIENT_PROPS) {
    for (const line of toStringArray(node[prop])) {
      ingredientLines.push(line);
    }
    if (ingredientLines.length > 0) break;
  }

  return {
    name: readString(node['name']) ?? readString(node['headline']),
    servingsRaw: firstDefined(node, YIELD_PROPS),
    ingredientLines,
    instructionBlocks,
    extraction,
  };
}

function firstDefined(node: JsonObject, props: readonly string[]): unknown {
  for (const prop of props) {
    if (node[prop] !== undefined && node[prop] !== null) return node[prop];
  }
  return undefined;
}

function readString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const text = htmlToText(value);
    return text.length > 0 ? text : undefined;
  }
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = readString(item);
      if (text) return text;
    }
    return undefined;
  }
  if (isJsonObject(value)) return readString(value['name'] ?? value['@value'] ?? value['text']);
  return undefined;
}

function toStringArray(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(toStringArray);
  if (isJsonObject(value)) {
    const text = readString(value);
    return text ? [text] : [];
  }
  return [];
}

/**
 * Aplatit `recipeInstructions` : chaîne unique, tableau de chaînes, `HowToStep`,
 * ou `HowToSection` contenant un `itemListElement`. Les titres de section sont
 * ignorés, seules les étapes exécutables sont conservées.
 */
function flattenInstructions(value: unknown, out: string[], depth: number): void {
  if (depth > MAX_INSTRUCTION_DEPTH) return;

  if (typeof value === 'string') {
    if (value.trim()) out.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) flattenInstructions(item, out, depth + 1);
    return;
  }

  if (!isJsonObject(value)) return;

  if (value['itemListElement'] !== undefined) {
    flattenInstructions(value['itemListElement'], out, depth + 1);
    return;
  }

  const text = readString(value['text']) ?? readString(value['description']);
  if (text) {
    out.push(text);
    return;
  }

  // Dernier recours : un `HowToStep` réduit à son seul libellé.
  const name = readString(value['name']);
  if (name) out.push(name);
}
