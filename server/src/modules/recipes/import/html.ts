/**
 * Utilitaires HTML minimalistes, sans dépendance externe.
 *
 * Volontairement limité : le chemin principal d'import s'appuie sur les données
 * structurées JSON-LD (`extractJsonLdNodes`), qui ne demandent qu'à isoler des
 * balises `<script>`. Les helpers de parcours de balises ne servent qu'aux
 * stratégies de repli (microdata, heuristique) — voir docs/recipe-import.md.
 */

const JSON_LD_SCRIPT_RE =
  /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;

const OPEN_TAG_RE = /<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

const SCRIPT_OR_STYLE_RE = /<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi;
const LINE_BREAK_TAG_RE = /<br\s*\/?>/gi;
const BLOCK_END_TAG_RE = /<\/(p|div|li|ul|ol|h[1-6]|tr|section|article|figcaption)\s*>/gi;
const ANY_TAG_RE = /<[^>]*>/g;
const HORIZONTAL_SPACE_RE = /[ \t  ]+/g;
const SURROUNDING_NEWLINE_RE = /[ \t]*\n[ \t\n]*/g;

const NUMERIC_ENTITY_RE = /&#(x[0-9a-f]+|[0-9]+);/gi;
const NAMED_ENTITY_RE = /&([a-z][a-z0-9]{1,31});/gi;

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/** Entités nommées rencontrées en pratique sur les sites de recettes francophones. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  shy: '',
  hellip: '…',
  middot: '·',
  bull: '•',
  deg: '°',
  laquo: '«',
  raquo: '»',
  lsquo: '‘',
  rsquo: '’',
  sbquo: '‚',
  ldquo: '“',
  rdquo: '”',
  ndash: '–',
  mdash: '—',
  frac12: '½',
  frac13: '⅓',
  frac14: '¼',
  frac34: '¾',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  euml: 'ë',
  agrave: 'à',
  acirc: 'â',
  auml: 'ä',
  ccedil: 'ç',
  ugrave: 'ù',
  ucirc: 'û',
  uuml: 'ü',
  ocirc: 'ô',
  ouml: 'ö',
  icirc: 'î',
  iuml: 'ï',
  oelig: 'œ',
  aelig: 'æ',
  Eacute: 'É',
  euro: '€',
  copy: '©',
  reg: '®',
  times: '×',
  minus: '−',
};

/** Décode les entités HTML numériques et le sous-ensemble nommé le plus courant. */
export function decodeHtmlEntities(input: string): string {
  return input
    .replace(NUMERIC_ENTITY_RE, (_match, code: string) => {
      const codePoint = code[0]?.toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
      if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) return _match;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return _match;
      }
    })
    .replace(NAMED_ENTITY_RE, (match, name: string) => {
      const replacement = NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()];
      return replacement ?? match;
    });
}

/** Convertit un fragment HTML en texte lisible (balises retirées, entités décodées). */
export function htmlToText(html: string): string {
  const withoutMarkup = html
    .replace(SCRIPT_OR_STYLE_RE, ' ')
    .replace(LINE_BREAK_TAG_RE, '\n')
    .replace(BLOCK_END_TAG_RE, '\n')
    .replace(ANY_TAG_RE, ' ');

  return decodeHtmlEntities(withoutMarkup)
    .replace(HORIZONTAL_SPACE_RE, ' ')
    .replace(SURROUNDING_NEWLINE_RE, '\n')
    .trim();
}

/**
 * Extrait et parse les blocs `<script type="application/ld+json">`.
 * Les blocs illisibles sont ignorés silencieusement : une page peut en contenir
 * plusieurs (organisation, fil d'Ariane, recette) et un seul invalide ne doit
 * pas faire échouer l'import.
 */
export function extractJsonLdNodes(html: string): unknown[] {
  const nodes: unknown[] = [];
  JSON_LD_SCRIPT_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = JSON_LD_SCRIPT_RE.exec(html)) !== null) {
    const raw = match[1];
    if (!raw) continue;
    const parsed = parseJsonLenient(raw);
    if (parsed !== undefined) nodes.push(parsed);
  }

  return nodes;
}

function parseJsonLenient(raw: string): unknown {
  const cleaned = raw
    .replace(/^\s*<!--/, '')
    .replace(/-->\s*$/, '')
    .replace(/^\s*\/\/\s*<!\[CDATA\[/, '')
    .replace(/\/\/\s*\]\]>\s*$/, '')
    .replace(/^\s*<!\[CDATA\[/, '')
    .replace(/\]\]>\s*$/, '')
    .trim();

  if (!cleaned) return undefined;

  try {
    return JSON.parse(cleaned);
  } catch {
    // Réparation opportuniste : virgules traînantes, fréquentes sur les CMS maison.
    try {
      return JSON.parse(cleaned.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      return undefined;
    }
  }
}

export interface HtmlElement {
  tagName: string;
  attributes: string;
  innerHtml: string;
}

export type ElementPredicate = (tagName: string, attributes: string) => boolean;

/** Retourne la valeur décodée d'un attribut, ou `null` s'il est absent. */
export function getAttribute(attributes: string, name: string): string | null {
  const re = new RegExp(
    `(?:^|\\s)${escapeRegExp(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    'i'
  );
  const match = re.exec(attributes);
  if (!match) return null;
  return decodeHtmlEntities(match[1] ?? match[2] ?? match[3] ?? '');
}

/**
 * Parcourt les balises ouvrantes et retourne celles retenues par `predicate`,
 * avec leur contenu interne délimité par comptage de profondeur.
 */
export function findElements(html: string, predicate: ElementPredicate): HtmlElement[] {
  const found: HtmlElement[] = [];
  const openTagRe = new RegExp(OPEN_TAG_RE.source, 'g');

  let match: RegExpExecArray | null;
  while ((match = openTagRe.exec(html)) !== null) {
    const tagName = match[1]!.toLowerCase();
    const attributes = match[2] ?? '';
    if (!predicate(tagName, attributes)) continue;

    if (VOID_ELEMENTS.has(tagName) || attributes.trimEnd().endsWith('/')) {
      found.push({ tagName, attributes, innerHtml: '' });
      continue;
    }

    const contentStart = match.index + match[0].length;
    const contentEnd = findClosingTagIndex(html, tagName, contentStart);
    found.push({ tagName, attributes, innerHtml: html.slice(contentStart, contentEnd) });
  }

  return found;
}

function findClosingTagIndex(html: string, tagName: string, from: number): number {
  const re = new RegExp(`<(/?)${escapeRegExp(tagName)}(?=[\\s/>])`, 'gi');
  re.lastIndex = from;

  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return match.index;
  }

  return html.length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
