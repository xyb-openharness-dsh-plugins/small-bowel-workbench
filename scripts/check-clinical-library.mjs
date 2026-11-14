#!/usr/bin/env node
/* 临床库红线：不含判读/推荐词，条目必须带来源与待审核状态。 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIBRARY_ENTRIES, LIBRARY_SOURCES } from '../dsh/library.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const problems = [];
const banned = /预后|生存期|疗效|治愈率|五年生存率|复发风险|建议化疗|应该手术|必须复查|推荐方案/;
const sourceIds = new Set(LIBRARY_SOURCES.map((s) => s.sourceId));

if (LIBRARY_ENTRIES.length < 8) problems.push('临床库条目少于 8 条');
for (const entry of LIBRARY_ENTRIES) {
  if (!entry.recordId || !entry.title || !entry.summaryText) problems.push('条目缺必填字段：' + entry.recordId);
  if (!sourceIds.has(entry.sourceId)) problems.push('来源未登记：' + entry.recordId);
  if (entry.verification !== 'pending-clinical-review') problems.push('审核状态必须为 pending-clinical-review：' + entry.recordId);
  if (banned.test(entry.title + entry.summaryText + entry.cautionText)) problems.push('条目含判读/推荐词：' + entry.recordId);
}
for (const source of LIBRARY_SOURCES) {
  if (!['OK', 'NOT_CONNECTED', 'REFERENCE_ONLY', 'LOCAL_ONLY', 'PENDING'].includes(source.state)) {
    problems.push('未知来源终态：' + source.sourceId);
  }
  if (source.state !== 'OK' && !source.detail) problems.push('非 OK 来源必须写明终态原因：' + source.sourceId);
}

const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
if (!readme.includes('临床库')) problems.push('README 未说明临床库边界');

if (problems.length) {
  for (const p of problems) console.error('✗ ' + p);
  process.exit(1);
}
console.log(`✓ 临床库红线：${LIBRARY_ENTRIES.length} 条 · 判读/推荐词 0 命中`);
