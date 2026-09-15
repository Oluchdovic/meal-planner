import type Database from 'better-sqlite3';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import { MEAL_TYPES } from './types.js';
import type { MealPlan, MealPlanInput, PlanSlot, PlanSlotInput } from './types.js';

export class PlansRepository {
  constructor(private db: Database.Database) {}

  list(userId: number): MealPlan[] {
    const rows = this.db
      .prepare('SELECT id FROM meal_plans WHERE user_id = ? ORDER BY start_date DESC')
      .all(userId) as { id: number }[];
    return rows.map((r) => this.getById(userId, r.id));
  }

  getById(userId: number, id: number): MealPlan {
    const row = this.db
      .prepare('SELECT * FROM meal_plans WHERE id = ? AND user_id = ?')
      .get(id, userId) as any;

    if (!row) {
      throw new NotFoundError(`Plan ${id} introuvable`);
    }

    const slotRows = this.db
      .prepare(
        `SELECT ps.*, r.title AS recipe_title
         FROM plan_slots ps
         LEFT JOIN recipes r ON r.id = ps.recipe_id
         WHERE ps.plan_id = ?
         ORDER BY ps.date ASC, ps.meal_type ASC`
      )
      .all(id) as any[];

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      createdAt: row.created_at,
      slots: slotRows.map((s) => this.mapSlotRow(s)),
    };
  }

  private mapSlotRow(row: any): PlanSlot {
    return {
      id: row.id,
      planId: row.plan_id,
      date: row.date,
      mealType: row.meal_type,
      recipeId: row.recipe_id,
      recipeTitle: row.recipe_title ?? null,
      servingsOverride: row.servings_override,
      constraintTags: row.constraint_tags ? JSON.parse(row.constraint_tags) : null,
    };
  }

  create(userId: number, input: MealPlanInput): MealPlan {
    this.validateDates(input.startDate, input.endDate);
    const now = new Date().toISOString();

    const createTx = this.db.transaction(() => {
      const result = this.db
        .prepare(
          'INSERT INTO meal_plans (user_id, name, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(userId, input.name ?? null, input.startDate, input.endDate, now);

      const planId = Number(result.lastInsertRowid);
      const insertSlot = this.db.prepare(
        'INSERT INTO plan_slots (plan_id, date, meal_type) VALUES (?, ?, ?)'
      );

      for (const date of this.datesInRange(input.startDate, input.endDate)) {
        for (const mealType of MEAL_TYPES) {
          insertSlot.run(planId, date, mealType);
        }
      }

      return planId;
    });

    const planId = createTx();
    return this.getById(userId, planId);
  }

  update(userId: number, id: number, input: MealPlanInput): MealPlan {
    this.validateDates(input.startDate, input.endDate);
    this.getById(userId, id);

    this.db
      .prepare(
        'UPDATE meal_plans SET name = ?, start_date = ?, end_date = ? WHERE id = ? AND user_id = ?'
      )
      .run(input.name ?? null, input.startDate, input.endDate, id, userId);

    return this.getById(userId, id);
  }

  delete(userId: number, id: number): void {
    this.getById(userId, id);
    this.db.prepare('DELETE FROM meal_plans WHERE id = ? AND user_id = ?').run(id, userId);
  }

  updateSlot(userId: number, planId: number, slotId: number, input: PlanSlotInput): PlanSlot {
    const plan = this.getById(userId, planId);
    const slot = plan.slots.find((s) => s.id === slotId);
    if (!slot) {
      throw new NotFoundError(`Créneau ${slotId} introuvable pour ce plan`);
    }

    if (input.recipeId != null) {
      const recipe = this.db
        .prepare('SELECT id FROM recipes WHERE id = ? AND user_id = ?')
        .get(input.recipeId, userId);
      if (!recipe) {
        throw new ValidationError(`Recette ${input.recipeId} introuvable`);
      }
    }

    this.db
      .prepare(
        `UPDATE plan_slots
         SET recipe_id = ?, servings_override = ?, constraint_tags = ?
         WHERE id = ? AND plan_id = ?`
      )
      .run(
        input.recipeId ?? null,
        input.servingsOverride ?? null,
        input.constraintTags ? JSON.stringify(input.constraintTags) : null,
        slotId,
        planId
      );

    const row = this.db
      .prepare(
        `SELECT ps.*, r.title AS recipe_title
         FROM plan_slots ps
         LEFT JOIN recipes r ON r.id = ps.recipe_id
         WHERE ps.id = ?`
      )
      .get(slotId) as any;

    return this.mapSlotRow(row);
  }

  private validateDates(startDate: string, endDate: string): void {
    if (!startDate || !endDate) {
      throw new ValidationError('start_date et end_date sont obligatoires');
    }
    if (new Date(startDate) > new Date(endDate)) {
      throw new ValidationError('start_date doit être antérieure ou égale à end_date');
    }
  }

  private datesInRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const cursor = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');

    while (cursor <= end) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return dates;
  }
}
