import type Database from 'better-sqlite3';
import { NotFoundError, ValidationError } from '../../shared/errors.js';

export interface Tag {
  id: number;
  name: string;
}

export class TagsRepository {
  constructor(private db: Database.Database) {}

  list(userId: number): Tag[] {
    return this.db
      .prepare('SELECT id, name FROM tags WHERE user_id = ? ORDER BY name ASC')
      .all(userId) as Tag[];
  }

  create(userId: number, name: string): Tag {
    const trimmed = name?.trim();
    if (!trimmed) {
      throw new ValidationError('Le nom du tag est obligatoire');
    }

    const existing = this.db
      .prepare('SELECT id, name FROM tags WHERE user_id = ? AND name = ?')
      .get(userId, trimmed) as Tag | undefined;
    if (existing) {
      return existing;
    }

    const result = this.db
      .prepare('INSERT INTO tags (user_id, name) VALUES (?, ?)')
      .run(userId, trimmed);

    return { id: Number(result.lastInsertRowid), name: trimmed };
  }

  delete(userId: number, id: number): void {
    const existing = this.db
      .prepare('SELECT id FROM tags WHERE id = ? AND user_id = ?')
      .get(id, userId);
    if (!existing) {
      throw new NotFoundError(`Tag ${id} introuvable`);
    }
    this.db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(id, userId);
  }
}
