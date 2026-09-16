import { describe, expect, it } from 'vitest';
import { parseJsonLdRecipe, parseMicrodataRecipe } from './schemaorg-parser.js';

function jsonLd(payload: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(
    payload
  )}</script></head><body></body></html>`;
}

describe('parseJsonLdRecipe', () => {
  it('lit un noeud Recipe simple', () => {
    const html = jsonLd({
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: 'Lasagnes maison',
      recipeYield: '4 personnes',
      recipeIngredient: ['500 g de steak haché', '1 gousse d’ail'],
      recipeInstructions: 'Préparer les ingrédients',
    });

    expect(parseJsonLdRecipe(html)).toEqual({
      name: 'Lasagnes maison',
      servingsRaw: '4 personnes',
      ingredientLines: ['500 g de steak haché', '1 gousse d’ail'],
      instructionBlocks: ['Préparer les ingrédients'],
      extraction: 'json-ld',
    });
  });

  it('trouve la recette dans un @graph', () => {
    const html = jsonLd({
      '@graph': [
        { '@type': 'WebSite', name: 'Mon site' },
        { '@type': 'Recipe', name: 'Tarte', recipeIngredient: ['200 g de farine'] },
      ],
    });

    expect(parseJsonLdRecipe(html)?.name).toBe('Tarte');
  });

  it('accepte un tableau racine et les types multiples', () => {
    const html = jsonLd([
      { '@type': 'BreadcrumbList' },
      { '@type': ['NewsArticle', 'Recipe'], name: 'Soupe', recipeIngredient: ['1 l de bouillon'] },
    ]);

    expect(parseJsonLdRecipe(html)?.name).toBe('Soupe');
  });

  it('accepte le type préfixé par l’URL schema.org', () => {
    const html = jsonLd({ '@type': 'http://schema.org/Recipe', name: 'Crêpes' });
    expect(parseJsonLdRecipe(html)?.name).toBe('Crêpes');
  });

  it('aplatit les HowToStep et les HowToSection', () => {
    const html = jsonLd({
      '@type': 'Recipe',
      name: 'Gratin',
      recipeInstructions: [
        { '@type': 'HowToStep', text: 'Éplucher les pommes de terre' },
        {
          '@type': 'HowToSection',
          name: 'Cuisson',
          itemListElement: [
            { '@type': 'HowToStep', text: 'Enfourner 40 min' },
            { '@type': 'HowToStep', name: 'Servir chaud' },
          ],
        },
      ],
    });

    expect(parseJsonLdRecipe(html)?.instructionBlocks).toEqual([
      'Éplucher les pommes de terre',
      'Enfourner 40 min',
      'Servir chaud',
    ]);
  });

  it('nettoie le HTML présent dans les champs', () => {
    const html = jsonLd({
      '@type': 'Recipe',
      name: 'Cr&eacute;pes <em>fines</em>',
      recipeInstructions: '<p>Mélanger</p>',
    });

    const raw = parseJsonLdRecipe(html);
    expect(raw?.name).toBe('Crépes fines');
    expect(raw?.instructionBlocks).toEqual(['<p>Mélanger</p>']);
  });

  it('retourne null en l’absence de noeud Recipe', () => {
    expect(parseJsonLdRecipe(jsonLd({ '@type': 'Article', name: 'Pas une recette' }))).toBeNull();
    expect(parseJsonLdRecipe('<html></html>')).toBeNull();
  });

  it('accepte l’alias historique « ingredients »', () => {
    const html = jsonLd({ '@type': 'Recipe', name: 'Salade', ingredients: ['2 tomates'] });
    expect(parseJsonLdRecipe(html)?.ingredientLines).toEqual(['2 tomates']);
  });
});

describe('parseMicrodataRecipe', () => {
  it('lit les itemprop Schema.org', () => {
    const html = `
      <div itemscope itemtype="https://schema.org/Recipe">
        <h1 itemprop="name">Quiche lorraine</h1>
        <meta itemprop="recipeYield" content="6">
        <li itemprop="recipeIngredient">200 g de lardons</li>
        <li itemprop="recipeIngredient">3 œufs</li>
        <div itemprop="recipeInstructions"><p>Préchauffer le four</p></div>
      </div>`;

    expect(parseMicrodataRecipe(html)).toEqual({
      name: 'Quiche lorraine',
      servingsRaw: '6',
      ingredientLines: ['200 g de lardons', '3 œufs'],
      instructionBlocks: ['Préchauffer le four'],
      extraction: 'microdata',
    });
  });

  it('retourne null sans itemprop de recette', () => {
    expect(parseMicrodataRecipe('<div itemprop="name">Titre</div>')).toBeNull();
  });
});
