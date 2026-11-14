#!/usr/bin/env node
/* 静态引用与页面骨架：refs 存在、令牌齐全、八页、三态。 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || '.');
const html = readFileSync(join(root, 'public/index.html'), 'utf8');
const app = readFileSync(join(root, 'public/app.js'), 'utf8');
const primer = readFileSync(join(root, 'public/primer.js'), 'utf8');
const problems = [];

const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
for (const ref of refs) {
  if (/^(https?:|data:|#)/.test(ref)) continue;
  const rel = ref.replace(/^\/small-bowel\//, '');
  if (!existsSync(join(root, 'public', rel))) problems.push('静态引用不存在：' + ref);
}
for (const token of ['__API_BASE__', '__VERSION__', '__VERSION_DISPLAY__', '__BUILD_DATE__']) {
  if (!app.includes(token)) problems.push('public/app.js 缺注入令牌 ' + token);
}
for (const state of ['skeleton', 'emptyState', 'errorState']) {
  if (!app.includes('function ' + state)) problems.push('缺页面三态函数：' + state);
}
if (!/const PAGES = \[[\s\S]*?\]/.test(app)) problems.push('缺 PAGES 常量');
const pageIds = [...app.matchAll(/\{ id: '([a-z]+)'/g)].map((m) => m[1]);
const expected = ['today', 'record', 'tests', 'treatment', 'symptoms', 'followup', 'trials', 'documents'];
if (pageIds.length !== 8 || expected.some((id) => !pageIds.includes(id))) {
  problems.push('一级页面不是预期的八项：' + pageIds.join(','));
}
if (!/window\.SBA_PRIMER/.test(primer)) problems.push('primer.js 未导出 SBA_PRIMER');
if (!/不构成诊断或治疗建议/.test(primer)) problems.push('primer 缺边界声明');
if (/<script[^>]+https?:/.test(html)) problems.push('页面不得加载外部脚本');
if (/@import\s+url\(https?:/.test(readFileSync(join(root, 'public/style.css'), 'utf8'))) {
  problems.push('样式不得引入外部字体');
}

if (problems.length) {
  for (const p of problems) console.error('✗ ' + p);
  process.exit(1);
}
console.log(`✓ 静态引用：${refs.length} 条；八页与三态齐全`);
