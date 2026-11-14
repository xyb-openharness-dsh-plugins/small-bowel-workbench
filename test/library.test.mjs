import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIBRARY_ENTRIES, LIBRARY_SOURCES, libraryPayload } from '../dsh/library.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'research', 'small-bowel-cancer');

test('临床库：条目带来源、待审核状态与边界说明', () => {
  assert.ok(LIBRARY_ENTRIES.length >= 8);
  assert.equal(new Set(LIBRARY_ENTRIES.map((e) => e.recordId)).size, LIBRARY_ENTRIES.length);
  const sourceIds = new Set(LIBRARY_SOURCES.map((s) => s.sourceId));
  for (const entry of LIBRARY_ENTRIES) {
    assert.ok(sourceIds.has(entry.sourceId), '未登记来源：' + entry.recordId);
    assert.equal(entry.verification, 'pending-clinical-review');
    assert.ok(entry.cautionText.length > 8, '缺边界说明：' + entry.recordId);
  }
});

test('临床库：不把未接通来源写成已查询', () => {
  const payload = libraryPayload();
  assert.equal(payload.state, 'LOCAL_ONLY');
  assert.equal(payload.counts.connectedSources, 0);
  assert.ok(payload.sources.every((s) => s.state !== 'OK'));
});

test('临床库：快照文件与 manifest 存在，且记录数一致', () => {
  const manifest = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8'));
  assert.equal(manifest.recordCount, LIBRARY_ENTRIES.length);
  assert.equal(manifest.dbCount, LIBRARY_ENTRIES.length);
  assert.equal(manifest.sourceStatusRows, LIBRARY_SOURCES.length);
  assert.ok(existsSync(join(DIR, 'clinical-entries.jsonl')));
  assert.ok(existsSync(join(DIR, 'clinical-library.sqlite')));
});

test('临床库：不含判读/推荐词', () => {
  const banned = /预后|生存期|疗效|治愈率|五年生存率|复发风险|建议化疗|应该手术|必须复查|推荐方案/;
  for (const entry of LIBRARY_ENTRIES) {
    assert.doesNotMatch(entry.title + entry.summaryText + entry.cautionText, banned, entry.recordId);
  }
});
