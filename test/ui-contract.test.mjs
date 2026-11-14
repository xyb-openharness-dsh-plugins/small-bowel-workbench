import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(ROOT, 'public/app.js'), 'utf8');
const css = readFileSync(join(ROOT, 'public/style.css'), 'utf8');
const html = readFileSync(join(ROOT, 'public/index.html'), 'utf8');

test('八页导航：id 唯一、文案齐全', () => {
  const ids = [...app.matchAll(/\{ id: '([a-z]+)'/g)].map((m) => m[1]);
  assert.equal(ids.length, 8);
  assert.equal(new Set(ids).size, 8);
  for (const label of ['今天', '档案', '检查', '治疗', '症状与营养', '随访', '试验', '资料']) {
    assert.ok(app.includes(`label: '${label}'`), '缺页面 ' + label);
  }
});

test('三态：骨架、空态、错误态都有', () => {
  assert.match(app, /function skeleton\(/);
  assert.match(app, /function emptyState\(/);
  assert.match(app, /function errorState\(/);
  assert.match(app, /data-retry/);
});

test('化验分组：方法+机构作为组键，不跨组合并', () => {
  assert.match(app, /group\.method/);
  assert.match(app, /group\.org/);
  assert.match(app, /不与其他方法\/机构合并/);
});

test('可访问性与响应式：skip link、aria-current、窄屏规则、打印', () => {
  assert.ok(html.includes('class="skip-link"'));
  assert.ok(app.includes('aria-current'));
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media print/);
  assert.match(css, /prefers-reduced-motion/);
});

test('无外部资源：不加载外站脚本/字体', () => {
  assert.ok(!/<script[^>]+https?:/.test(html));
  assert.ok(!/@import\s+url\(https?:/.test(css));
});

test('页面不写死演示档案 key（由 bootstrap 驱动）', () => {
  assert.ok(!app.includes('demo-sba-a'));
  assert.ok(!app.includes('demo-sba-b'));
});

test('M5 写入与隐私入口：12 类记录、两个对话框、逐条切换', () => {
  assert.equal((app.match(/kind: '[a-z]+', label:/g) || []).length, 12);
  assert.ok(html.includes('id="entry-dialog"'));
  assert.ok(html.includes('id="profile-dialog"'));
  assert.ok(html.includes('id="entry-private"'));
  assert.ok(app.includes('data-privacy-kind'));
  assert.ok(app.includes("api('/entries'"));
  assert.ok(app.includes("api('/privacy'"));
  assert.ok(app.includes('/export'));
});

test('M4 临床库：页面有入口，来源终态可见', () => {
  assert.ok(app.includes("api('/library')"));
  assert.ok(app.includes('本机临床库'));
  assert.ok(app.includes('待临床审核'));
});
