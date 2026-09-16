import {
  BadGatewayError,
  GatewayTimeoutError,
  UnprocessableEntityError,
  ValidationError,
} from '../../../shared/errors.js';

/** Délai maximum accordé au site distant. */
export const FETCH_TIMEOUT_MS = 10_000;

/** Au-delà, le HTML est tronqué : les données structurées sont en tête de page. */
const MAX_HTML_BYTES = 4 * 1024 * 1024;

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'ip6-localhost',
  'metadata.google.internal',
  '169.254.169.254',
]);

const PRIVATE_IPV4_RE =
  /^(?:10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;
const LOOPBACK_IPV6_RE = /^\[?(?:::1|::ffff:127\.|fc|fd|fe80:)/i;
const LOCAL_TLD_RE = /\.(?:local|localhost|internal|home|lan)$/i;
const HTML_CONTENT_TYPE_RE = /(?:text\/html|application\/xhtml|text\/plain|\+xml)/i;
const CHARSET_RE = /charset\s*=\s*"?([\w-]+)"?/i;

const USER_AGENT =
  'Mozilla/5.0 (compatible; MijoteRecipeImporter/1.0; +https://github.com/mijote)';

export interface FetchedPage {
  html: string;
  /** URL finale après redirections. */
  finalUrl: string;
}

export type PageFetcher = (url: URL) => Promise<FetchedPage>;

/**
 * Valide l'URL saisie par l'utilisateur avant tout appel réseau.
 *
 * Bloque les cibles internes (loopback, RFC 1918, link-local, TLD locaux) pour
 * éviter de transformer l'API en relais SSRF. Limite connue : la résolution DNS
 * n'est pas vérifiée, un domaine public pointant vers une IP privée passe.
 */
export function assertImportableUrl(rawUrl: unknown): URL {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new ValidationError('L’URL de la recette est obligatoire');
  }

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new ValidationError(
      'L’URL fournie est invalide. Attendu : une adresse complète, par exemple https://exemple.fr/ma-recette'
    );
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new ValidationError('Seules les adresses http:// et https:// peuvent être importées');
  }

  const hostname = url.hostname.toLowerCase();
  const isBlocked =
    BLOCKED_HOSTNAMES.has(hostname) ||
    PRIVATE_IPV4_RE.test(hostname) ||
    LOOPBACK_IPV6_RE.test(hostname) ||
    LOCAL_TLD_RE.test(hostname) ||
    !hostname.includes('.');

  if (isBlocked) {
    throw new ValidationError(
      'Cette adresse pointe vers le réseau local et ne peut pas être importée'
    );
  }

  return url;
}

/** Récupère le HTML d'une page de recette, avec délai et taille bornés. */
export const fetchRecipePage: PageFetcher = async (url) => {
  let response: Response;

  try {
    response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
    });
  } catch (error) {
    if (isTimeout(error)) {
      throw new GatewayTimeoutError(
        `Le site ${url.hostname} n’a pas répondu dans le délai de ${FETCH_TIMEOUT_MS / 1000} s`
      );
    }
    throw new BadGatewayError(`Le site ${url.hostname} est inaccessible`);
  }

  if (!response.ok) {
    throw new BadGatewayError(
      `Le site ${url.hostname} a refusé la requête (erreur HTTP ${response.status})`
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType && !HTML_CONTENT_TYPE_RE.test(contentType)) {
    throw new UnprocessableEntityError('Cette adresse ne renvoie pas une page web exploitable');
  }

  let html: string;
  try {
    html = await readBoundedText(response, readCharset(contentType));
  } catch (error) {
    if (isTimeout(error)) {
      throw new GatewayTimeoutError(
        `Le site ${url.hostname} n’a pas répondu dans le délai de ${FETCH_TIMEOUT_MS / 1000} s`
      );
    }
    throw new BadGatewayError(`La page de ${url.hostname} n’a pas pu être lue entièrement`);
  }

  if (!html.trim()) {
    throw new UnprocessableEntityError('La page renvoyée par ce site est vide');
  }

  return { html, finalUrl: response.url || url.toString() };
};

/**
 * Lit le corps par morceaux et coupe au-delà de `MAX_HTML_BYTES` : une page de
 * recette pathologique (ou malveillante) ne doit pas saturer la mémoire.
 */
async function readBoundedText(response: Response, charset: string): Promise<string> {
  const body = response.body;
  if (!body) return (await response.text()).slice(0, MAX_HTML_BYTES);

  const reader = body.getReader();
  const decoder = createDecoder(charset);
  let received = 0;
  let html = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      received += value.byteLength;
      html += decoder.decode(value, { stream: true });

      if (received >= MAX_HTML_BYTES) {
        await reader.cancel();
        return html;
      }
    }
  } finally {
    reader.releaseLock();
  }

  return html + decoder.decode();
}

function readCharset(contentType: string): string {
  return CHARSET_RE.exec(contentType)?.[1]?.trim().toLowerCase() ?? 'utf-8';
}

/** Certains sites francophones servent encore du latin-1 : on respecte l'en-tête. */
function createDecoder(charset: string): InstanceType<typeof TextDecoder> {
  try {
    return new TextDecoder(charset);
  } catch {
    return new TextDecoder('utf-8');
  }
}

function isTimeout(error: unknown): boolean {
  return (
    error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}
