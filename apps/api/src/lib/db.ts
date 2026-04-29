// Tiny typing helpers around D1's prepared-statement API.
// We don't use an ORM (per spec); raw `db.prepare()` is fine at this scale.

export async function one<T>(stmt: D1PreparedStatement): Promise<T | null> {
  const row = await stmt.first<T>();
  return row ?? null;
}

export async function many<T>(stmt: D1PreparedStatement): Promise<T[]> {
  const { results } = await stmt.all<T>();
  return results ?? [];
}
