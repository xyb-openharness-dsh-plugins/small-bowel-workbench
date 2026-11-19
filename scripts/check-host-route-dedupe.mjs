#!/usr/bin/env node
/**
 * 宿主 exact route 按路径去重自查 —— 同路径多方法各自注册会激活失败。
 *
 * 现场（2026-11-19）：mpn-workbench 装机实测，`/api/mpn/root` 的 GET 与 POST
 * 各注册一次 `kind: 'exact'`，宿主 exact route 按「路径」去重（不区分 method），
 * 报 `webserver: duplicate exact route "/api/mpn/root"`，整包激活失败。
 * 静态桩（smoke:activate）与 npm test 都测不到——只有宿主 webserver 真注册才触发。
 *
 * 断言：dsh/ 下所有 JS 里 `webServer.register` 的 `kind: 'exact'` 注册，path 字面量
 * 不得重复（跨文件合计）。同路径多方法必须合并注册一次、handler 内按 method 分发。
 * 用法：node scripts/check-host-route-dedupe.mjs（--self-test 用内嵌反例自证有效）
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export function extractExactPaths(text) {
  const out = [];
  for (const call of text.match(/webServer\.register\s*\(\s*\{[^}]{0,400}?\}/gs) || []) {
    if (!/kind:\s*['"]exact['"]/.test(call)) continue;
    const m = call.match(/path:\s*['"]([^'"]+)['"]/);
    if (m) out.push(m[1]);
  }
  return out;
}

// 非「path: '字面量'」形态（如变量简写 path,）静态取不到字面量，按检查器纪律记「待人工」，
// 不静默计 0。
export function countUnextractableExactCalls(text) {
  const calls = text.match(/webServer\.register\s*\(\s*\{[^}]{0,400}?\}/gs) || [];
  return calls.filter((c) => /kind:\s*['"]exact['"]/.test(c) && !/path:\s*['"]/.test(c)).length;
}

function scanJs(dir) {
  const found = [];
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return found; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) found.push(...scanJs(p));
    else if (/\.(m?js)$/.test(e.name)) found.push([p, readFileSync(p, 'utf8')]);
  }
  return found;
}

function dupesOfText(text) {
  const seen = new Set(); const dupes = [];
  for (const p of extractExactPaths(text)) { if (seen.has(p)) dupes.push(p); seen.add(p); }
  return dupes;
}

if (process.argv.includes('--self-test')) {
  const bad = `ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/api/x/root', handler: g }), 'a');
ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/api/x/root', handler: h }), 'b');`;
  const good = `ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/api/x/root', handler: both }), 'a');
ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: '/api/x', handler: h }), 'b');`;
  const badDupes = dupesOfText(bad);
  const goodDupes = dupesOfText(good);
  if (badDupes.length !== 1 || badDupes[0] !== '/api/x/root') {
    console.error('✗ self-test 失败：反例应检出 /api/x/root 1 处重复，实得 ' + JSON.stringify(badDupes));
    process.exit(1);
  }
  if (goodDupes.length) { console.error('✗ self-test 失败：正例误报 ' + goodDupes.join(',')); process.exit(1); }
  console.log('✓ self-test：反例检出 1 处重复、正例 0 误报');
  process.exit(0);
}

const fails = [];
const manual = [];
const seen = new Map();
let total = 0;
for (const [file, text] of scanJs(join(ROOT, 'dsh'))) {
  for (const p of extractExactPaths(text)) {
    total++;
    if (seen.has(p)) fails.push(`exact route 路径重复注册：${p}（${seen.get(p)} 与 ${file}）`);
    else seen.set(p, file);
  }
  const n = countUnextractableExactCalls(text);
  if (n) manual.push(`${file}：${n} 处 exact 注册的 path 非字面量（变量简写），静态查不到重复，待人工核对`);
}
if (fails.length) {
  console.error('✗ 宿主 exact route 去重：\n' + fails.map((f) => '  - ' + f).join('\n'));
  console.error('  修法：同路径多方法合并注册一次，handler 内按 req.method 分发（见 starter docs/02-DSH-CONTRACT「exact route 按路径去重」）。');
  process.exit(1);
}
if (manual.length) {
  console.log('△ exact route 去重：字面量路径 ' + total + ' 个无重复；待人工：\n' + manual.map((m) => '  - ' + m).join('\n'));
  process.exit(0);
}
console.log(`✓ exact route 去重：dsh/ 下 ${total} 个 exact 注册路径无重复`);
