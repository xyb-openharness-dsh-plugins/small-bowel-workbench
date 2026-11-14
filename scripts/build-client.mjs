#!/usr/bin/env node
/**
 * 把 src/client.js 打成宿主可加载的 lib/client.js。
 * 产物必须是 lib/client.js（package.json exports['./client'] 指向它）。
 * 注入：__PANEL_LAYOUT__ / __AGENT_PANE__ / __VERSION__，均来自唯一来源。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PANEL, AGENT_PANE } from '../lib/layout.js';
import { version } from '../lib/version.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const check = process.argv.includes('--check');
const src = readFileSync(join(ROOT, 'src/client.js'), 'utf8');
const body = src
  .replace(/^export\s+(const|function|let)\s/gm, '$1 ')
  .replace(/^export\s+\{[^}]*\}\s*;?\s*$/gm, '');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const banner = `/* 由 scripts/build-client.mjs 从 src/client.js 生成，勿手改。 */
/* 面板参数来自 lib/layout.js，版本来自 lib/version.js（VERSION 派生）。 */
`;
const out = `${banner}window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkg.name)},
  factory(require) {
    const React = require('react')
    const __PANEL_LAYOUT__ = ${JSON.stringify(PANEL)}
    const __AGENT_PANE__ = ${JSON.stringify(AGENT_PANE)}
    const __VERSION__ = ${JSON.stringify(version)}

${body.split('\n').map((line) => (line.trim() === '' ? '' : '    ' + line)).join('\n')}

    return { apply, inject: INJECT }
  }
})
`;

const target = join(ROOT, 'lib/client.js');
if (check) {
  let current = '';
  try { current = readFileSync(target, 'utf8'); } catch { /* 不存在就是不同步 */ }
  if (current !== out) {
    console.error('✗ lib/client.js 与 src/client.js 不同步（跑 npm run build:client）');
    process.exit(1);
  }
  console.log('✓ lib/client.js 与源同步');
  process.exit(0);
}
writeFileSync(target, out);
console.log(`✓ lib/client.js（${out.split('\n').length} 行 · ${version}）`);
