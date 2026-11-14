#!/usr/bin/env node
/* 数据层红线：禁止判读列；事实表必须有 is_private 与 superseded_by。 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(process.argv[2] || '.');
const dir = join(root, 'schema');
const problems = [];
if (!existsSync(join(dir, '0001_initial.sql'))) {
  console.error('✗ 缺 schema/0001_initial.sql');
  process.exit(1);
}

const files = readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
const forbidden = new Set([
  'diagnosis', 'risk_level', 'activity_score', 'prognosis', 'response',
  'line_of_therapy', 'stage', 'is_conclusion', 'remission_status',
]);
const tables = new Map();

const contractPath = join(dir, 'freeze-contract.md');
if (!existsSync(contractPath)) problems.push('缺 schema/freeze-contract.md');
else {
  const contract = readFileSync(contractPath, 'utf8');
  const expected = contract.match(/sha256 \| `([0-9a-f]{64})`/)?.[1];
  if (!expected) problems.push('冻结合同缺 0001 的 sha256');
  else {
    const actual = createHash('sha256').update(readFileSync(join(dir, '0001_initial.sql'))).digest('hex');
    if (actual !== expected) problems.push(`0001 sha256 与冻结合同不一致（现行 ${actual}）`);
  }
}

for (const file of files) {
  const sql = readFileSync(join(dir, file), 'utf8');
  const tableRe = /CREATE TABLE\s+(\w+)\s*\(([\s\S]*?)\n\);/g;
  let match;
  while ((match = tableRe.exec(sql))) {
    const [, table, body] = match;
    const columns = [];
    for (const line of body.split('\n')) {
      const col = line.trim().match(/^([a-z_][a-z0-9_]*)\s+(TEXT|INTEGER|REAL|BLOB|NUMERIC)\b/i);
      if (col) columns.push(col[1]);
    }
    tables.set(table, columns);
    for (const col of columns) {
      if (forbidden.has(col)) problems.push(`${file} · ${table}.${col} 是判读列，禁止`);
    }
  }
}

const factTables = [
  'diagnoses', 'pathology_reports', 'lab_results', 'imaging_events', 'treatments',
  'medications', 'symptom_notes', 'nutrition_records', 'followup_plans', 'documents',
  'saved_trials', 'viewpoints',
];
if (!tables.has('subjects')) problems.push('缺 subjects 表');
for (const table of factTables) {
  const cols = tables.get(table);
  if (!cols) { problems.push('缺事实表 ' + table); continue; }
  if (!cols.includes('is_private')) problems.push(`${table} 缺 is_private`);
  if (!cols.includes('profile_key')) problems.push(`${table} 缺 profile_key`);
  if (table !== 'documents' && table !== 'saved_trials' && table !== 'viewpoints' && !cols.includes('superseded_by')) {
    problems.push(`${table} 缺 superseded_by（更正只增不改）`);
  }
}

if (problems.length) {
  for (const p of problems) console.error('✗ ' + p);
  process.exit(1);
}
console.log(`✓ schema 红线：${tables.size} 张表，判读列 0 命中`);
