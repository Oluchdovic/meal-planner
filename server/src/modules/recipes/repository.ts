import type Database from 'better-sqlite3';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import { isUnit } from '../../shared/units.js';
import type { Recipe, RecipeInput } from './types.js';

export class RecipesRepository {
  constructor(private db: Database.Database) {}

  list(userId: number, tagNames: string[]): Recipe[] {
    let recipeIds: number[];

    if (tagNames.length > 0) {
      const placeholders = tagNames.map(() => '?').join(',');
      const rows = this.db
        .prepare(
          `SELECT DISTINCT r.id
           FROM recipes r
           JOIN recipe_tags rt ON rt.recipe_id = r.id
           JOIN tags t ON t.id = rt.tag_id
           WHERE r.user_id = ? AND t.name IN (${placeholders})`
        )
        .all(userId, ...tagNames) as { id: number }[];
      recipeIds = rows.map((r) => r.id);
    } else {
      const rows = this.db
        .prepare('SELECT id FROM recipes WHERE user_id = ? ORDER BY title ASC')
        .all(userId) as { id: number }[];
      recipeIds = rows.map((r) => r.id);
    }

    return recipeIds.map((id) => this.getById(userId, id));
  }

  getById(userId: number, id: number): Recipe {
    const row = this.db
      .prepare('SELECT * FROM recipes WHERE id = ? AND user_id = ?')
      .get(id, userId) as any;

    if (!row) {
      throw new NotFoundError(`Recette ${id} introuvable`);
    }

    const ingredients = this.db
      .prepare(
        'SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order ASC, id ASC'
      )
      .all(id) as any[];

    const tags = this.db
      .prepare(
        `SELECT t.id, t.name FROM tags t
         JOIN recipe_tags rt ON rt.tag_id = t.id
         WHERE rt.recipe_id = ?
         ORDER BY t.name ASC`
      )
      .all(id) as any[];

    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      servings: row.servings,
      prepTimeMinutes: row.prep_time_minutes,
      cookTimeMinutes: row.cook_time_minutes,
      instructions: JSON.parse(row.instructions ?? '[]'),
      photoPath: row.photo_path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ingredients: ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        sortOrder: i.sort_order,
      })),
      tags,
    };
  }

  create(userId: number, input: RecipeInput): Recipe {
    this.validateInput(input);
    const now = new Date().toISOString();

    const createTx = this.db.transaction(() => {
      const result = this.db
        .prepare(
          `INSERT INTO recipes
           (user_id, title, servings, prep_time_minutes, cook_time_minutes, instructions, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          userId,
          input.title,
          input.servings,
          input.prepTimeMinutes ?? null,
          input.cookTimeMinutes ?? null,
          JSON.stringify(input.instructions ?? []),
          now,
          now
        );

      const recipeId = Number(result.lastInsertRowid);
      this.replaceIngredients(recipeId, input.ingredients ?? []);
      this.replaceTags(recipeId, input.tagIds ?? []);
      return recipeId;
    });

    const recipeId = createTx();
    return this.getById(userId, recipeId);
  }

  update(userId: number, id: number, input: RecipeInput): Recipe {
    this.validateInput(input);
    this.getById(userId, id); // throws if not found / not owned
    const now = new Date().toISOString();

    const updateTx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE recipes
           SET title = ?, servings = ?, prep_time_minutes = ?, cook_time_minutes = ?, instructions = ?, updated_at = ?
           WHERE id = ? AND user_id = ?`
        )
        .run(
          input.title,
          input.servings,
          input.prepTimeMinutes ?? null,
          input.cookTimeMinutes ?? null,
          JSON.stringify(input.instructions ?? []),
          now,
          id,
          userId
        );

      this.replaceIngredients(id, input.ingredients ?? []);
      this.replaceTags(id, input.tagIds ?? []);
    });

    updateTx();
    return this.getById(userId, id);
  }

  delete(userId: number, id: number): void {
    this.getById(userId, id);
    this.db.prepare('DELETE FROM recipes WHERE id = ? AND user_id = ?').run(id, userId);
  }

  setPhotoPath(userId: number, id: number, photoPath: string): Recipe {
    this.getById(userId, id);
    this.db
      .prepare('UPDATE recipes SET photo_path = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(photoPath, new Date().toISOString(), id, userId);
    return this.getById(userId, id);
  }

  private replaceIngredients(
    recipeId: number,
    ingredients: { name: string; quantity: number; unit: string }[]
  ): void {
    this.db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(recipeId);
    const insert = this.db.prepare(
      `INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    );
    ingredients.forEach((ing, index) => {
      insert.run(recipeId, ing.name.trim(), ing.quantity, ing.unit, index);
    });
  }

  private replaceTags(recipeId: number, tagIds: number[]): void {
    this.db.prepare('DELETE FROM recipe_tags WHERE recipe_id = ?').run(recipeId);
    const insert = this.db.prepare(
      'INSERT INTO recipe_tags (recipe_id, tag_id) VALUES (?, ?)'
    );
    for (const tagId of tagIds) {
      insert.run(recipeId, tagId);
    }
  }

  private validateInput(input: RecipeInput): void {
    if (!input.title || !input.title.trim()) {
      throw new ValidationError('Le titre est obligatoire');
    }
    if (typeof input.servings !== 'number' || input.servings <= 0) {
      throw new ValidationError('Le nombre de portions doit être un nombre positif');
    }
    for (const ing of input.ingredients ?? []) {
      if (!ing.name || !ing.name.trim()) {
        throw new ValidationError('Le nom de l’ingrédient est obligatoire');
      }
      if (typeof ing.quantity !== 'number' || ing.quantity <= 0) {
        throw new ValidationError(`Quantité invalide pour l’ingrédient "${ing.name}"`);
      }
      if (!isUnit(ing.unit)) {
        throw new ValidationError(`Unité invalide pour l’ingrédient "${ing.name}": ${ing.unit}`);
      }
    }
  }
}
