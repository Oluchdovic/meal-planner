import { describe, expect, it } from 'vitest';
import {
  BadGatewayError,
  GatewayTimeoutError,
  UnprocessableEntityError,
  ValidationError,
} from '../../../shared/errors.js';
import { RecipeImportService } from './import-service.js';
import type { FetchedPage, PageFetcher } from './page-fetcher.js';

const SOURCE_URL = 'https://exemple.fr/ma-recette';

function pageWith(body: string): FetchedPage {
  return { html: `<html><head>${body}</head><body></body></html>`, finalUrl: SOURCE_URL };
}

function jsonLdPage(payload: unknown): FetchedPage {
  return pageWith(`<script type="application/ld+json">${JSON.stringify(payload)}</script>`);
}

function serviceReturning(page: FetchedPage): RecipeImportService {
  return new RecipeImportService(async () => page);
}

const FULL_RECIPE = {
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Lasagnes maison',
  recipeYield: '4 personnes',
  recipeIngredient: ['500 g de steak haché', '2 cuillères à soupe d’huile d’olive'],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Préparer les ingrédients' },
    { '@type': 'HowToStep', text: 'Enfourner 40 minutes' },
  ],
};

describe('RecipeImportService', () => {
  it('extrait une recette complète depuis le JSON-LD', async () => {
    const recipe = await serviceReturning(jsonLdPage(FULL_RECIPE)).importFromUrl(SOURCE_URL);

    expect(recipe).toEqual({
      name: 'Lasagnes maison',
      servings: 4,
      ingredients: [
        { name: 'steak haché', quantity: 500, unit: 'g' },
        { name: 'huile d’olive', quantity: 2, unit: 'cas' },
      ],
      steps: [
        { order: 1, description: 'Préparer les ingrédients' },
        { order: 2, description: 'Enfourner 40 minutes' },
      ],
      sourceUrl: SOURCE_URL,
      extraction: 'json-ld',
      warnings: [],
    });
  });

  it('valide l’URL avant tout appel réseau', async () => {
    let calls = 0;
    const fetchPage: PageFetcher = async () => {
      calls += 1;
      return jsonLdPage(FULL_RECIPE);
    };
    const service = new RecipeImportService(fetchPage);

    await expect(service.importFromUrl('pas-une-url')).rejects.toThrow(ValidationError);
    await expect(service.importFromUrl('http://localhost/r')).rejects.toThrow(ValidationError);
    expect(calls).toBe(0);
  });

  it('bascule sur les microdata quand le JSON-LD est absent', async () => {
    const page = pageWith(`
      <div itemscope itemtype="https://schema.org/Recipe">
        <h1 itemprop="name">Quiche lorraine</h1>
        <meta itemprop="recipeYield" content="6">
        <li itemprop="recipeIngredient">200 g de lardons</li>
        <div itemprop="recipeInstructions">Préchauffer le four à 180 °C</div>
      </div>`);

    const recipe = await serviceReturning(page).importFromUrl(SOURCE_URL);

    expect(recipe.extraction).toBe('microdata');
    expect(recipe.name).toBe('Quiche lorraine');
    expect(recipe.servings).toBe(6);
    expect(recipe.ingredients).toEqual([{ name: 'lardons', quantity: 200, unit: 'g' }]);
  });

  it('bascule sur l’heuristique et prévient de l’imprécision', async () => {
    const page: FetchedPage = {
      finalUrl: SOURCE_URL,
      html: `<html><head><title>Soupe de courge - MonBlog</title></head><body>
        <ul class="recipe-ingredients">
          <li>1 kg de courge</li>
          <li>20 cl de crème</li>
        </ul>
        <ol class="preparation">
          <li>Éplucher et couper la courge en cubes</li>
          <li>Mixer avec la crème puis servir</li>
        </ol>
      </body></html>`,
    };

    const recipe = await serviceReturning(page).importFromUrl(SOURCE_URL);

    expect(recipe.extraction).toBe('heuristic');
    expect(recipe.name).toBe('Soupe de courge');
    expect(recipe.ingredients).toEqual([
      { name: 'courge', quantity: 1, unit: 'kg' },
      { name: 'crème', quantity: 200, unit: 'ml' },
    ]);
    expect(recipe.steps).toHaveLength(2);
    expect(recipe.warnings[0]).toContain('Aucune donnée structurée');
  });

  it('refuse une page sans recette détectable', async () => {
    const page = pageWith('<title>Un article de blog</title>');
    await expect(serviceReturning(page).importFromUrl(SOURCE_URL)).rejects.toThrow(
      UnprocessableEntityError
    );
  });

  it('refuse une recette sans titre exploitable', async () => {
    const page = jsonLdPage({ '@type': 'Recipe', recipeIngredient: ['200 g de farine'] });
    await expect(serviceReturning(page).importFromUrl(SOURCE_URL)).rejects.toThrow(/titre/i);
  });

  it('refuse une recette sans ingrédient ni étape', async () => {
    const page = jsonLdPage({ '@type': 'Recipe', name: 'Recette fantôme' });
    await expect(serviceReturning(page).importFromUrl(SOURCE_URL)).rejects.toThrow(/mal formée/i);
  });

  it('accepte une recette partielle et remonte des avertissements', async () => {
    const page = jsonLdPage({
      '@type': 'Recipe',
      name: 'Pâte à crêpes',
      recipeIngredient: ['Farine', 'Lait'],
    });

    const recipe = await serviceReturning(page).importFromUrl(SOURCE_URL);

    expect(recipe.ingredients).toEqual([{ name: 'Farine' }, { name: 'Lait' }]);
    expect(recipe.steps).toEqual([]);
    expect(recipe.warnings).toHaveLength(4);
  });

  it('laisse remonter les erreurs réseau du fetcher', async () => {
    const timeout = new RecipeImportService(() => {
      throw new GatewayTimeoutError('Le site n’a pas répondu');
    });
    await expect(timeout.importFromUrl(SOURCE_URL)).rejects.toThrow(GatewayTimeoutError);

    const unreachable = new RecipeImportService(() => {
      throw new BadGatewayError('Le site est inaccessible');
    });
    await expect(unreachable.importFromUrl(SOURCE_URL)).rejects.toThrow(BadGatewayError);
  });
});
