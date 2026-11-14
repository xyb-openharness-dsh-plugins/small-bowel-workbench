#!/usr/bin/env node
/**
 * 从 dsh/library.js 生成 research/small-bowel-cancer/ 的本机临床库快照。
 * --check 校验：manifest 哈希、JSONL 与 SQLite 逐条一致、来源终态行数。
 */
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIBRARY_ENTRIES, LIBRARY_SOURCES, LIBRARY_SNAPSHOT_DATE, LIBRARY_TOPIC } from '../dsh/library.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIR = join(ROOT, 'research', LIBRARY_TOPIC);
const JSONL = 'clinical-entries.jsonl';
const DB = 'clinical-library.sqlite';
const MANIFEST = 'manifest.json';
const check = process.argv.includes('--check');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const JSONL_KEYS = [
  'recordId', 'category', 'title', 'summaryText', 'appliesTo', 'sourceId', 'verification', 'cautionText',
];

function sortedRow(entry) {
  return Object.fromEntries(JSONL_KEYS.map((key) => [key, entry[key] ?? null]));
}

function build() {
  mkdirSync(DIR, { recursive: true });
  const jsonl = LIBRARY_ENTRIES.map((entry) => JSON.stringify(sortedRow(entry))).join('\n') + '\n';
  writeFileSync(join(DIR, JSONL), jsonl);

  const dbPath = join(DIR, DB);
  if (existsSync(dbPath)) rmSync(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE clinical_entries (
      record_id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      summary_text TEXT NOT NULL,
      applies_to TEXT NOT NULL,
      source_id TEXT NOT NULL,
      verification TEXT NOT NULL,
      caution_text TEXT NOT NULL
    );
    CREATE TABLE source_statuses (
      source_id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      state TEXT NOT NULL,
      detail TEXT NOT NULL,
      checked_at TEXT
    );
  `);
  const insertEntry = db.prepare(`INSERT INTO clinical_entries
    (record_id,category,title,summary_text,applies_to,source_id,verification,caution_text)
    VALUES (?,?,?,?,?,?,?,?)`);
  for (const e of LIBRARY_ENTRIES) {
    insertEntry.run(e.recordId, e.category, e.title, e.summaryText, e.appliesTo, e.sourceId, e.verification, e.cautionText);
  }
  const insertSource = db.prepare(`INSERT INTO source_statuses
    (source_id,label,state,detail,checked_at) VALUES (?,?,?,?,?)`);
  for (const s of LIBRARY_SOURCES) insertSource.run(s.sourceId, s.label, s.state, s.detail, s.checkedAt);
  db.close();

  const bytes = readFileSync(dbPath);
  const manifest = {
    topic: LIBRARY_TOPIC,
    snapshotDate: LIBRARY_SNAPSHOT_DATE,
    recordCount: LIBRARY_ENTRIES.length,
    dbCount: LIBRARY_ENTRIES.length,
    sourceStatusRows: LIBRARY_SOURCES.length,
    files: {
      [JSONL]: { sha256: sha256(readFileSync(join(DIR, JSONL))) },
      [DB]: { sha256: sha256(bytes) },
    },
    sources: LIBRARY_SOURCES.map((s) => ({ sourceId: s.sourceId, state: s.state })),
  };
  writeFileSync(join(DIR, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
}

function verify() {
  const problems = [];
  const manifestPath = join(DIR, MANIFEST);
  if (!existsSync(manifestPath)) {
    console.error('✗ 缺 manifest.json（跑 npm run build:library）');
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const name of Object.keys(manifest.files || {})) {
    const file = join(DIR, name);
    if (!existsSync(file)) { problems.push('缺文件：' + name); continue; }
    if (sha256(readFileSync(file)) !== manifest.files[name].sha256) problems.push('SHA-256 不一致：' + name);
  }
  const rows = readFileSync(join(DIR, JSONL), 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  if (rows.length !== manifest.recordCount) problems.push(`JSONL ${rows.length} ≠ manifest ${manifest.recordCount}`);
  const byId = new Map(rows.map((row) => [row.recordId, row]));
  for (const entry of LIBRARY_ENTRIES) {
    const row = byId.get(entry.recordId);
    if (!row) { problems.push('JSONL 缺条目：' + entry.recordId); continue; }
    for (const key of JSONL_KEYS) {
      if ((row[key] ?? null) !== (entry[key] ?? null)) problems.push(`字段不一致：${entry.recordId}.${key}`);
    }
  }
  const db = new DatabaseSync(join(DIR, DB), { readOnly: true });
  try {
    const integrity = db.prepare('PRAGMA integrity_check').all().map((r) => Object.values(r)[0]);
    if (integrity.length !== 1 || integrity[0] !== 'ok') problems.push('SQLite integrity_check 失败');
    const dbRows = db.prepare('SELECT * FROM clinical_entries ORDER BY record_id').all();
    if (dbRows.length !== manifest.dbCount) problems.push(`SQLite ${dbRows.length} ≠ manifest ${manifest.dbCount}`);
    const statuses = db.prepare('SELECT * FROM source_statuses ORDER BY source_id').all();
    if (statuses.length !== manifest.sourceStatusRows) problems.push(`source_statuses ${statuses.length} ≠ manifest ${manifest.sourceStatusRows}`);
    const dbById = new Map(dbRows.map((row) => [row.record_id, row]));
    for (const entry of LIBRARY_ENTRIES) {
      const row = dbById.get(entry.recordId);
      if (!row) { problems.push('SQLite 缺条目：' + entry.recordId); continue; }
      if (row.summary_text !== entry.summaryText) problems.push(`SQLite 字段不一致：${entry.recordId}.summary_text`);
      if (row.verification !== entry.verification) problems.push(`SQLite 字段不一致：${entry.recordId}.verification`);
    }
  } finally {
    db.close();
  }
  if (problems.length) {
    for (const p of problems) console.error('✗ ' + p);
    process.exit(1);
  }
  console.log(`✓ 临床库快照：${LIBRARY_ENTRIES.length} 条 · ${LIBRARY_SOURCES.length} 个来源终态`);
}

if (check) verify();
else {
  build();
  console.log(`✓ 临床库快照已生成：research/${LIBRARY_TOPIC}/`);
}
