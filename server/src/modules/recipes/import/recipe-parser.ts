import type { Unit } from '../../../shared/units.js';
import { htmlToText } from './html.js';
import type {
  ImportedIngredientDto,
  ImportedRecipeDto,
  ImportedRecipeStepDto,
  RawRecipe,
} from './types.js';

/**
 * Normalisation : transforme la sortie brute d'un extracteur en DTO exploitable
 * par la bibliothèque de recettes (unités ramenées à l'énumération fermée de
 * `shared/units.ts`, étapes numérotées, portions déduites).
 */

const DEFAULT_SERVINGS = 4;
const MAX_SERVINGS = 100;
const MAX_TITLE_LENGTH = 160;
const MAX_STEPS = 200;
const MAX_INGREDIENTS = 200;
const MIN_STEP_LENGTH = 2;

const DIACRITIC_RE = /\p{Diacritic}/gu;
const TOKEN_RE = /[^\s.]+/g;

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 0.25,
  '¾': 0.75,
  '⅕': 0.2,
  '⅖': 0.4,
  '⅗': 0.6,
  '⅘': 0.8,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

const WORD_QUANTITIES: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  demi: 0.5,
  demie: 0.5,
};

const MIXED_FRACTION_RE = /^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)/;
const UNICODE_FRACTION_RE = /^(?:(\d+)\s*)?([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/;
const DECIMAL_RE = /^\d+(?:[.,]\d+)?/;
const LEADING_WORD_RE = /^[^\W\d_]+/u;
const RANGE_TAIL_RE = /^\s*(?:[-–—]|a|à|to|ou)\s*(?:\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?|[½⅓⅔¼¾])/i;
const LEADING_CONNECTOR_RE = /^\s*(?:de\s+la\s+|de\s+l['’]\s*|de\s+|du\s+|des\s+|d['’]\s*|l['’]\s*)/i;
const LEADING_BULLET_RE = /^[\s,;:.·•◦*•▪\-–—]+/;
const EDGE_PUNCTUATION_RE = /^[\s,;:.·•◦*•▪\-–—]+|[\s,;:·•◦*\-–—]+$/g;
const MULTI_SPACE_RE = /\s+/g;
const SECTION_HEADER_RE = /:\s*$/;
const STEP_LABEL_RE = /^(?:étape|etape|step)\s*n?°?\s*\d+\s*[:.)\-–]?\s*/i;
const LEADING_STEP_NUMBER_RE = /^\d{1,2}\s*[:.)\/\-–]\s+/;
const NUMBER_IN_TEXT_RE = /\d+(?:[.,]\d+)?/;

/** Synonymes normalisés (minuscules, sans accent, points retirés) -> unité + facteur. */
const UNIT_SYNONYMS: readonly (readonly [string, Unit, number])[] = [
  ['mg', 'g', 0.001],
  ['milligramme', 'g', 0.001],
  ['milligrammes', 'g', 0.001],
  ['g', 'g', 1],
  ['gr', 'g', 1],
  ['gramme', 'g', 1],
  ['grammes', 'g', 1],
  ['kg', 'kg', 1],
  ['kilo', 'kg', 1],
  ['kilos', 'kg', 1],
  ['kilogramme', 'kg', 1],
  ['kilogrammes', 'kg', 1],
  ['ml', 'ml', 1],
  ['millilitre', 'ml', 1],
  ['millilitres', 'ml', 1],
  ['cl', 'ml', 10],
  ['centilitre', 'ml', 10],
  ['centilitres', 'ml', 10],
  ['dl', 'ml', 100],
  ['decilitre', 'ml', 100],
  ['decilitres', 'ml', 100],
  ['l', 'l', 1],
  ['lt', 'l', 1],
  ['litre', 'l', 1],
  ['litres', 'l', 1],
  ['cas', 'cas', 1],
  ['cs', 'cas', 1],
  ['c a s', 'cas', 1],
  ['c a soupe', 'cas', 1],
  ['cuil a soupe', 'cas', 1],
  ['cuillere a soupe', 'cas', 1],
  ['cuilleres a soupe', 'cas', 1],
  ['cuilleree a soupe', 'cas', 1],
  ['cuillerees a soupe', 'cas', 1],
  ['tablespoon', 'cas', 1],
  ['tablespoons', 'cas', 1],
  ['tbsp', 'cas', 1],
  ['tbs', 'cas', 1],
  ['cac', 'cac', 1],
  ['c a c', 'cac', 1],
  ['c a cafe', 'cac', 1],
  ['cuil a cafe', 'cac', 1],
  ['cuillere a cafe', 'cac', 1],
  ['cuilleres a cafe', 'cac', 1],
  ['cuillere a the', 'cac', 1],
  ['cuilleres a the', 'cac', 1],
  ['teaspoon', 'cac', 1],
  ['teaspoons', 'cac', 1],
  ['tsp', 'cac', 1],
  ['pincee', 'pincee', 1],
  ['pincees', 'pincee', 1],
  ['pinch', 'pincee', 1],
  ['tranche', 'tranche', 1],
  ['tranches', 'tranche', 1],
  ['rondelle', 'tranche', 1],
  ['rondelles', 'tranche', 1],
  ['slice', 'tranche', 1],
  ['slices', 'tranche', 1],
  ['botte', 'botte', 1],
  ['bottes', 'botte', 1],
  ['bouquet', 'botte', 1],
  ['bouquets', 'botte', 1],
  ['bunch', 'botte', 1],
  ['gousse', 'gousse', 1],
  ['gousses', 'gousse', 1],
  ['clove', 'gousse', 1],
  ['cloves', 'gousse', 1],
  ['sachet', 'sachet', 1],
  ['sachets', 'sachet', 1],
  ['paquet', 'sachet', 1],
  ['paquets', 'sachet', 1],
  ['packet', 'sachet', 1],
  ['packets', 'sachet', 1],
  ['unite', 'unite', 1],
  ['unites', 'unite', 1],
  ['piece', 'unite', 1],
  ['pieces', 'unite', 1],
  ['pc', 'unite', 1],
  ['pcs', 'unite', 1],
  ['unit', 'unite', 1],
  ['units', 'unite', 1],
];

/** Synonymes multi-mots d'abord, pour que « c a soupe » gagne sur « c ». */
const SORTED_UNIT_SYNONYMS = [...UNIT_SYNONYMS]
  .map(([synonym, unit, factor]) => ({ words: synonym.split(' '), unit, factor }))
  .sort((a, b) => b.words.length - a.words.length || b.words.join().length - a.words.join().length);

export function deaccent(value: string): string {
  return value.normalize('NFD').replace(DIACRITIC_RE, '').normalize('NFC');
}

// ---------------------------------------------------------------------------
// Portions
// ---------------------------------------------------------------------------

/** Interprète `recipeYield` : `4`, `"4 personnes"`, `"4 à 6 parts"`, `["4"]`, … */
export function parseServings(raw: unknown): number | null {
  if (typeof raw === 'number') return sanitizeServings(raw);

  if (typeof raw === 'string') {
    const match = NUMBER_IN_TEXT_RE.exec(raw);
    return match ? sanitizeServings(Number(match[0].replace(',', '.'))) : null;
  }

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const parsed = parseServings(item);
      if (parsed !== null) return parsed;
    }
    return null;
  }

  if (typeof raw === 'object' && raw !== null) {
    const record = raw as Record<string, unknown>;
    return parseServings(record['value'] ?? record['@value'] ?? record['name']);
  }

  return null;
}

function sanitizeServings(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(Math.round(value * 2) / 2, MAX_SERVINGS);
}

// ---------------------------------------------------------------------------
// Ingrédients
// ---------------------------------------------------------------------------

interface Token {
  norm: string;
  end: number;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const re = new RegExp(TOKEN_RE.source, 'g');

  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    tokens.push({ norm: deaccent(match[0].toLowerCase()), end: match.index + match[0].length });
  }

  return tokens;
}

interface LeadingQuantity {
  value: number;
  rest: string;
}

/** Lit une quantité en tête de ligne : `500`, `1,5`, `1/2`, `1 1/2`, `½`, `deux`. */
export function readLeadingQuantity(input: string): LeadingQuantity | null {
  const line = input.trimStart();

  const mixed = MIXED_FRACTION_RE.exec(line);
  if (mixed && Number(mixed[3]) > 0) {
    const whole = mixed[1] ? Number(mixed[1]) : 0;
    return { value: whole + Number(mixed[2]) / Number(mixed[3]), rest: line.slice(mixed[0].length) };
  }

  const unicode = UNICODE_FRACTION_RE.exec(line);
  if (unicode) {
    const whole = unicode[1] ? Number(unicode[1]) : 0;
    return { value: whole + UNICODE_FRACTIONS[unicode[2]!]!, rest: line.slice(unicode[0].length) };
  }

  const decimal = DECIMAL_RE.exec(line);
  if (decimal) {
    return { value: Number(decimal[0].replace(',', '.')), rest: line.slice(decimal[0].length) };
  }

  const word = LEADING_WORD_RE.exec(line);
  if (word) {
    const value = WORD_QUANTITIES[deaccent(word[0].toLowerCase())];
    if (value !== undefined) return { value, rest: line.slice(word[0].length) };
  }

  return null;
}

interface LeadingUnit {
  unit: Unit;
  factor: number;
  rest: string;
}

/** Lit une unité en tête de chaîne et retourne le reste (le nom de l'ingrédient). */
export function readLeadingUnit(input: string): LeadingUnit | null {
  const tokens = tokenize(input);
  if (tokens.length === 0) return null;

  for (const { words, unit, factor } of SORTED_UNIT_SYNONYMS) {
    if (words.length > tokens.length) continue;

    let matches = true;
    for (let i = 0; i < words.length; i += 1) {
      if (tokens[i]!.norm !== words[i]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return { unit, factor, rest: input.slice(tokens[words.length - 1]!.end) };
    }
  }

  return null;
}

/**
 * Parse une ligne d'ingrédient en langage naturel.
 * Retourne `null` pour les lignes non exploitables (vides, titres de section).
 */
export function parseIngredientLine(rawLine: string): ImportedIngredientDto | null {
  const line = htmlToText(rawLine)
    .replace(MULTI_SPACE_RE, ' ')
    .replace(LEADING_BULLET_RE, '')
    .trim();
  if (!line) return null;

  const quantity = readLeadingQuantity(line);

  // « Pour la garniture : » et autres intertitres glissés dans recipeIngredient.
  if (!quantity && SECTION_HEADER_RE.test(line)) return null;

  let rest = quantity ? quantity.rest.replace(RANGE_TAIL_RE, '') : line;
  const unit = quantity ? readLeadingUnit(rest) : null;
  if (unit) rest = unit.rest;

  // Le connecteur n'est retiré que derrière une quantité/unité : « de la crème »
  // reste intact si la ligne ne commence pas par un nombre.
  const nameSource = quantity ? rest.replace(LEADING_CONNECTOR_RE, '') : rest;
  const name = cleanIngredientName(nameSource);
  if (!name) return null;

  const ingredient: ImportedIngredientDto = { name };

  if (quantity) {
    const value = quantity.value * (unit?.factor ?? 1);
    if (value > 0) ingredient.quantity = Math.round(value * 1000) / 1000;
  }
  if (unit) ingredient.unit = unit.unit;

  return ingredient;
}

function cleanIngredientName(value: string): string {
  const cleaned = value.replace(EDGE_PUNCTUATION_RE, '').replace(MULTI_SPACE_RE, ' ').trim();
  // Une ligne réduite à de la ponctuation ou à un nombre n'est pas un ingrédient.
  return /[^\W\d_]/u.test(cleaned) ? cleaned : '';
}

// ---------------------------------------------------------------------------
// Étapes
// ---------------------------------------------------------------------------

/** Découpe, nettoie et numérote les blocs d'instructions. */
export function parseSteps(blocks: readonly string[]): ImportedRecipeStepDto[] {
  const steps: ImportedRecipeStepDto[] = [];
  let previous = '';

  for (const block of blocks) {
    for (const fragment of htmlToText(block).split('\n')) {
      const description = stripStepNumbering(fragment);
      if (description.length < MIN_STEP_LENGTH) continue;
      if (description === previous) continue;

      previous = description;
      steps.push({ order: steps.length + 1, description });
      if (steps.length >= MAX_STEPS) return steps;
    }
  }

  return steps;
}

function stripStepNumbering(fragment: string): string {
  let text = fragment.replace(MULTI_SPACE_RE, ' ').trim();
  text = text.replace(STEP_LABEL_RE, '');
  text = text.replace(LEADING_STEP_NUMBER_RE, '');
  return text.trim();
}

// ---------------------------------------------------------------------------
// Normalisation complète
// ---------------------------------------------------------------------------

export function normalizeRecipe(raw: RawRecipe, sourceUrl: string): ImportedRecipeDto {
  const warnings: string[] = [];

  if (raw.extraction === 'heuristic') {
    warnings.push(
      'Aucune donnée structurée Schema.org sur cette page : les informations ont été devinées depuis le HTML, relisez-les.'
    );
  }

  const name = (raw.name ?? '').replace(MULTI_SPACE_RE, ' ').trim().slice(0, MAX_TITLE_LENGTH);

  const parsedServings = parseServings(raw.servingsRaw);
  if (parsedServings === null) {
    warnings.push(
      `Nombre de personnes introuvable : ${DEFAULT_SERVINGS} portions ont été appliquées par défaut.`
    );
  }

  const ingredients: ImportedIngredientDto[] = [];
  let withoutQuantity = 0;
  let withoutUnit = 0;

  for (const line of raw.ingredientLines) {
    const ingredient = parseIngredientLine(line);
    if (!ingredient) continue;

    if (ingredient.quantity === undefined) withoutQuantity += 1;
    if (ingredient.unit === undefined) withoutUnit += 1;

    ingredients.push(ingredient);
    if (ingredients.length >= MAX_INGREDIENTS) break;
  }

  if (ingredients.length === 0) {
    warnings.push('Aucun ingrédient n’a pu être extrait de cette page.');
  } else {
    if (withoutQuantity > 0) {
      warnings.push(
        `${withoutQuantity} ingrédient(s) sans quantité lisible : vérifiez-les avant de faire vos courses.`
      );
    }
    if (withoutUnit > 0) {
      warnings.push(
        `${withoutUnit} ingrédient(s) dont l’unité n’a pas d’équivalent dans l’application : « unité(s) » a été appliqué.`
      );
    }
  }

  const steps = parseSteps(raw.instructionBlocks);
  if (steps.length === 0) {
    warnings.push('Aucune étape de préparation n’a pu être extraite de cette page.');
  }

  return {
    name,
    servings: parsedServings ?? DEFAULT_SERVINGS,
    ingredients,
    steps,
    sourceUrl,
    extraction: raw.extraction,
    warnings,
  };
}
