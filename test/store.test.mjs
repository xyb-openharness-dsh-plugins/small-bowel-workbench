import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openStore, migrate, tableNames, closeStore, migrationFiles, SCHEMA_DIR } from '../dsh/store.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

test('迁移：0001 可重复执行，ledger 只记一次', () => {
  const db = openStore(':memory:');
  try {
    const before = db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n;
    const again = migrate(db);
    const after = db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n;
    assert.equal(Number(before), Number(after), '重复迁移不应新增 ledger');
    assert.equal(again.ran, 0, '重复执行 ran 应为 0');
  } finally {
    closeStore(db);
  }
});

test('表清单：13 张业务表 + subjects/section_titles', () => {
  const db = openStore(':memory:');
  try {
    const names = tableNames(db);
    for (const table of [
      'subjects', 'section_titles', 'diagnoses', 'pathology_reports', 'lab_results',
      'imaging_events', 'treatments', 'medications', 'symptom_notes', 'nutrition_records',
      'followup_plans', 'documents', 'saved_trials', 'viewpoints',
    ]) {
      assert.ok(names.includes(table), '缺表 ' + table);
    }
    assert.equal(names.length, 14);
  } finally {
    closeStore(db);
  }
});

test('迁移文件：至少一个，编号连续从 0001 起', () => {
  const files = migrationFiles(SCHEMA_DIR);
  assert.ok(files.length >= 1);
  assert.equal(files[0], '0001_initial.sql');
});

test('冻结登记：sha256 与当前 0001 一致', () => {
  const sql = readFileSync(join(SCHEMA_DIR, '0001_initial.sql'), 'utf8');
  const contract = readFileSync(join(SCHEMA_DIR, 'freeze-contract.md'), 'utf8');
  assert.ok(contract.includes('draft-2026-11-14'), '冻结合同必须标草案状态');
  assert.ok(sql.includes('迁移只增不改'));
  const expected = contract.match(/sha256 \| `([0-9a-f]{64})`/)?.[1];
  const actual = createHash('sha256').update(sql).digest('hex');
  assert.equal(actual, expected, '0001 内容与冻结合同 sha256 不一致');
});
