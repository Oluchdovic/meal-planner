import { UnprocessableEntityError } from '../../../shared/errors.js';
import { parseHeuristicRecipe } from './fallback-parser.js';
import { normalizeRecipe } from './recipe-parser.js';
import { assertImportableUrl, fetchRecipePage } from './page-fetcher.js';
import type { PageFetcher } from './page-fetcher.js';
import { parseJsonLdRecipe, parseMicrodataRecipe } from './schemaorg-parser.js';
import type { ImportedRecipeDto, RawRecipe } from './types.js';

/**
 * Orchestration de l'import : validation de l'URL, récupération de la page,
 * puis extraction par stratégies successives (JSON-LD, microdata, heuristique).
 *
 * Le service ne persiste rien : il retourne un DTO que le client transforme en
 * recette via `POST /api/recipes`. Cela garde l'extraction sans effet de bord
 * et testable sans base de données.
 */
export class RecipeImportService {
  private readonly fetchPage: PageFetcher;

  constructor(fetchPage: PageFetcher = fetchRecipePage) {
    this.fetchPage = fetchPage;
  }

  async importFromUrl(rawUrl: unknown): Promise<ImportedRecipeDto> {
    const url = assertImportableUrl(rawUrl);
    const page = await this.fetchPage(url);

    const raw = extractRecipe(page.html);
    if (!raw) {
      throw new UnprocessableEntityError(
        'Aucune recette détectée sur cette page. Vérifiez l’adresse ou saisissez la recette manuellement.'
      );
    }

    const recipe = normalizeRecipe(raw, page.finalUrl);

    if (!recipe.name) {
      throw new UnprocessableEntityError(
        'La recette de cette page est incomplète : aucun titre n’a pu être lu.'
      );
    }

    if (recipe.ingredients.length === 0 && recipe.steps.length === 0) {
      throw new UnprocessableEntityError(
        'La recette de cette page est mal formée : ni ingrédients ni étapes n’ont pu être lus.'
      );
    }

    return recipe;
  }
}

/** Stratégies ordonnées : la première qui produit un résultat gagne. */
function extractRecipe(html: string): RawRecipe | null {
  return parseJsonLdRecipe(html) ?? parseMicrodataRecipe(html) ?? parseHeuristicRecipe(html);
}
