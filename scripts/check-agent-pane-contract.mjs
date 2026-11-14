#!/usr/bin/env node
/* 面板合同：conversation 常挂载、宽度可拖、localStorage、无旧式 inject。 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || '.');
const src = readFileSync(join(root, 'src/client.js'), 'utf8');
const built = readFileSync(join(root, 'lib/client.js'), 'utf8');
const version = readFileSync(join(root, 'VERSION'), 'utf8').trim();
const problems = [];

function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => (/^\s*\/\//.test(line) ? '' : line.replace(/\/\/.*$/, '')))
    .join('\n');
}

if (!/props\.conversation|props && props\.conversation/.test(src)) problems.push('Panel 未接收 conversation');
if (!/display: showPane \? 'flex' : 'none'/.test(src)) problems.push('会话区必须常挂载，只用 display 控显隐');
if (!/role: 'separator'/.test(src)) problems.push('缺分栏 separator');
if (!/ArrowLeft[\s\S]{0,300}ArrowRight/.test(src)) problems.push('分栏必须支持键盘调整');
if (!/localStorage/.test(src)) problems.push('宽度/开合状态未持久化');
if (/ctx\.inject\('dsh-desktop-workbenches'/.test(src)) problems.push('不许使用旧式 ctx.inject 写法');
if (!/ctx\.effect\(\(\) => ctx\.desktopWorkbenches\.register/.test(src)) problems.push('register 未包在 ctx.effect 内');
if (!/businessWidth: __PANEL_LAYOUT__\.businessWidth/.test(src)) problems.push('客户端未使用唯一来源的面板宽度');
if (!/const __PANEL_LAYOUT__ = \{"customFrame":true/.test(built)) problems.push('lib/client.js 未注入 panel layout');
if (!built.includes(`const __VERSION__ = "${version}"`)) problems.push('lib/client.js 版本未注入');
if (!/initialize|initialization/.test(src)) problems.push('缺初始化策略声明');

for (const [label, source] of [['源码', src], ['产物', built]]) {
  const code = codeOnly(source);
  if (!/newSession\s*\(/.test(code)) problems.push(label + '缺 newSession 调用（无会话时无法创建）');
  if (!/subscribe/.test(code)) problems.push(label + '缺 subscribe（会话变化不刷新）');
  if (/ensureSession\s*\(/.test(code)) problems.push(label + '仍在调用已废弃的 ensureSession');
  if (/Boolean\(conversation\)/.test(code)) problems.push(label + '仍用 Boolean(conversation) 判断会话');
}

if (problems.length) {
  for (const p of problems) console.error('✗ ' + p);
  process.exit(1);
}
console.log('✓ 面板合同：conversation / 分栏 / 持久化 / 注册');
