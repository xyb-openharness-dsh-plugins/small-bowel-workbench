/**
 * 开库 / 迁移 / 关库。生产用数据根下的 sqlite 文件，测试用 ':memory:'。
 *
 * 三条硬约束：
 *   ① 迁移只增不改：schema/00*.sql 按编号全部执行；0001 冻结后只加 0002+；
 *   ② ledger 记录迁移编号与 sha256，重复执行幂等；
 *   ③ 裸 SELECT 必须 ORDER BY rowid（见 readmodels.js）。
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCHEMA_DIR = join(HERE, '..', 'schema');

export function migrationFiles(dir = SCHEMA_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
}

export function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function openStore(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  migrate(db);
  return db;
}

export function migrate(db, dir = SCHEMA_DIR) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    migration TEXT PRIMARY KEY,
    sha256 TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);
  const applied = new Set(
    db.prepare('SELECT migration FROM schema_migrations ORDER BY rowid').all().map((r) => r.migration),
  );
  const files = migrationFiles(dir);
  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (migration, sha256) VALUES (?,?)').run(file, sha256(sql));
      db.exec('COMMIT');
      ran += 1;
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`迁移 ${file} 失败：${error.message}`);
    }
  }
  return { ran, total: files.length };
}

export function closeStore(db) {
  try { db.close(); } catch { /* 已关闭 */ }
}

export function tableNames(db) {
  return db.prepare(`SELECT name FROM sqlite_master WHERE type='table'
    AND name NOT LIKE 'sqlite_%' AND name <> 'schema_migrations'
    ORDER BY name`).all().map((r) => r.name);
}
