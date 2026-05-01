/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

function listMigrationSqlFiles(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(migrationsDir, d.name, 'migration.sql'))
    .filter((p) => fs.existsSync(p))
    .sort((a, b) => a.localeCompare(b));
}

function main() {
  const outArg = process.argv[2] || 'dist/package/data/app.db';
  const outPath = path.resolve(process.cwd(), outArg);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

  // Lazy require so repo can install deps before running.
  const Database = require('better-sqlite3');
  const db = new Database(outPath);
  db.pragma('foreign_keys = ON');

  const migrationsDir = path.resolve(process.cwd(), 'prisma', 'migrations');
  const migrationFiles = listMigrationSqlFiles(migrationsDir);

  if (migrationFiles.length === 0) {
    console.error('No migration.sql files found under prisma/migrations');
    process.exit(1);
  }

  try {
    db.exec('BEGIN');
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(file, 'utf8');
      db.exec(sql);
    }
    db.exec('COMMIT');
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {}
    console.error('Failed applying migrations:', err);
    process.exit(1);
  } finally {
    db.close();
  }

  console.log(`Created SQLite DB at: ${outPath}`);
}

main();

