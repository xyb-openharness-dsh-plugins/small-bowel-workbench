#!/usr/bin/env node
/**
 * 静态占位符注入覆盖自查 —— 外链 JS 里的 __API_BASE__ 必须也被注入。
 *
 * 现场（2026-11-19）：small-bowel-workbench Desktop 装机实测，页面报
 * 「Cannot read properties of null (reading 'currentProfileKey')」。根因：
 * public/app.js 携带 `const API_BASE = '__API_BASE__'`，而占位符注入只对
 * .html 做——app.js 是外链静态文件，永远不会被替换 → fetch('__API_BASE__/bootstrap')
 * 打到宿主 SPA fallback 返回 200 HTML → JSON 解析失败 → boot=null。
 * 夜班 V2/V3 从未真机加载过页面，所以全绿门禁没拦住。
 *
 * 断言：若 public/ 下任何 .js 含 __TOKEN__ 形占位符，则 dsh/ 服务端注入条件必须
 * 覆盖 .js（injectTokens 调用点的守卫文本需匹配 /app\.js|\.js/）。
 * 用法：node scripts/check-static-token-inject.mjs（--self-test 用内嵌反例自证有效）
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TOKEN_RE = /__[A-Z][A-Z0-9_]{2,}__/g;

export function jsFilesWithTokens(publicDir) {
  const hits = [];
  let entries = [];
  try { entries = readdirSync(publicDir, { withFileTypes: true }); } catch { return hits; }
  for (const e of entries) {
    if (e.isFile() && /\.js$/.test(e.name)) {
      const text = readFileSync(join(publicDir, e.name), 'utf8');
      const tokens = [...new Set(text.match(TOKEN_RE) || [])];
      if (tokens.length) hits.push([e.name, tokens]);
    }
  }
  return hits;
}

export function injectCoversJs(serverText) {
  // 找 injectTokens 的「调用点」（排除 function injectTokens 定义），取其前方最近的条件守卫块
  const calls = [...serverText.matchAll(/(?<!function\s)injectTokens\s*\(/g)];
  if (!calls.length) return false;
  const idx = calls[calls.length - 1].index;
  const guardStart = serverText.lastIndexOf('if (', idx);
  const guard = guardStart === -1 ? '' : serverText.slice(guardStart, idx);
  return /app\.js|\.js/.test(guard) || /endsWith\(['"]\.js/.test(serverText.slice(Math.max(0, idx - 300), idx));
}

if (process.argv.includes('--self-test')) {
  const badServer = `if (file.endsWith('.html')) { body = injectTokens(body, {...}) }`;
  const goodServer = `if (file.endsWith('.html') || file.endsWith('app.js')) { body = injectTokens(body, {...}) }`;
  if (injectCoversJs(badServer)) { console.error('✗ self-test 失败：只注入 .html 的反例不应判通过'); process.exit(1); }
  if (!injectCoversJs(goodServer)) { console.error('✗ self-test 失败：覆盖 .js 的正例应判通过'); process.exit(1); }
  console.log('✓ self-test：反例判不通过、正例判通过');
  process.exit(0);
}

const publicDir = join(ROOT, 'public');
const hits = jsFilesWithTokens(publicDir);
if (!hits.length) {
  console.log('✓ 静态占位符注入：public/ 下 JS 无 __TOKEN__ 占位符，无需检查注入');
  process.exit(0);
}
const serverText = ['dsh/server.js', 'dsh/index.js']
  .filter((f) => existsSync(join(ROOT, f)))
  .map((f) => readFileSync(join(ROOT, f), 'utf8'))
  .join('\n');
if (injectCoversJs(serverText)) {
  console.log(`✓ 静态占位符注入：${hits.map(([f, t]) => `${f}(${t.length} 个占位符)`).join('、')}，注入条件已覆盖 .js`);
  process.exit(0);
}
console.error('✗ 静态占位符注入：public/ 下 JS 携带占位符 ' + hits.map(([f, t]) => `${f}: ${t.join(',')}`).join('；'));
console.error('  但 dsh/ 服务端注入只覆盖 .html —— 外链 JS 的占位符永远不会被替换，');
console.error('  fetch(__API_BASE__/…) 会打到宿主 SPA fallback 返回 200 HTML，前端拿到 null 静默崩。');
console.error('  修法：静态服务对 .js 与 .html 同样调用 injectTokens（见 starter docs/02-DSH-CONTRACT「静态占位符注入覆盖 JS」）。');
process.exit(1);
