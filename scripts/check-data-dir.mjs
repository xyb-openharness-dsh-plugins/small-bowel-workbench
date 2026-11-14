#!/usr/bin/env node
/* 资料目录口径：拒绝主目录/桌面/下载根/tmp/相对路径；入口必须读 config.root。 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { checkDataDir } from '../dsh/data-dir.js';

const root = resolve(process.argv[2] || '.');
const cases = [
  ['/Users/example', false, '主目录'],
  ['/Users/example/', false, '主目录带斜杠'],
  ['/Users/example/Desktop', false, '桌面'],
  ['/Users/example/Downloads', false, '下载根'],
  ['/tmp/sba', false, 'tmp'],
  ['relative/path', false, '相对路径'],
  ['', false, '空'],
  ['/Users/example/Documents/small-bowel-data', true, '专用目录'],
  ['/Volumes/Health/SBA', true, '外接卷'],
];
const problems = [];
for (const [dir, ok, label] of cases) {
  const got = checkDataDir(dir);
  if (got.ok !== ok) problems.push(`${label}：期望 ${ok}，实际 ${got.ok}（${got.reason || 'ok'}）`);
}

const index = readFileSync(join(root, 'dsh/index.js'), 'utf8');
if (!/config\?\.root/.test(index)) problems.push('dsh/index.js 未从 config.root 取资料目录');
if (/\/Users\/[^'"\s]+\/(Documents|Desktop|Downloads)/.test(index)) problems.push('入口不得硬编码个人资料目录');
const serve = readFileSync(join(root, 'scripts/serve.mjs'), 'utf8');
if (!/checkDataDir/.test(serve)) problems.push('独立启动必须复用 checkDataDir');
if (/mkdtempSync/.test(serve) && !/临时演示/.test(serve)) problems.push('临时目录必须明示是演示，不可冒充资料目录');

if (problems.length) {
  for (const p of problems) console.error('✗ ' + p);
  process.exit(1);
}
console.log(`✓ 资料目录口径：${cases.length} 个用例`);
