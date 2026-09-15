import type Database from 'better-sqlite3';

export function seedDefaultUser(db: Database.Database): number {
  const existing = db.prepare('SELECT id FROM users ORDER BY id ASC LIMIT 1').get() as
    | { id: number }
    | undefined;

  if (existing) {
    return existing.id;
  }

  const result = db
    .prepare(
      'INSERT INTO users (email, display_name, created_at) VALUES (?, ?, ?)'
    )
    .run(null, 'Utilisateur', new Date().toISOString());

  return Number(result.lastInsertRowid);
}
