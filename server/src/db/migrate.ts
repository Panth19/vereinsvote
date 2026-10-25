import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Db } from './client.ts';

export async function runMigrations(db: Db) {
  // src/db/ in dev, dist/ or dist/db/ after the build
  const here = path.dirname(fileURLToPath(import.meta.url));
  const folder = [path.resolve(here, '../../drizzle'), path.resolve(here, '../drizzle')].find((p) =>
    existsSync(path.join(p, 'meta/_journal.json')),
  );
  if (!folder) throw new Error('Migrations folder not found');
  await migrate(db, { migrationsFolder: folder });
}
