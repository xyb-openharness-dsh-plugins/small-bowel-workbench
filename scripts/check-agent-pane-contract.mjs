#!/usr/bin/env node
/* 面板合同：conversation 常挂载、宽度可拖、localStorage、无旧式 inject。 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || '.');
const src = readFileSync(join(root, 'src/client.js'), 'utf8');
const built = readFileSync(join(root, 'lib/client.js'), 'utf8');
const problems = [];

if (!/props\.conversation|props && props\.conversation/.test(src)) problems.push('Panel 未接收 conversation');
if (!/display: showPane \? 'flex' : 'none'/.test(src)) problems.push('会话区必须常挂载，只用 display 控显隐');
if (!/role: 'separator'/.test(src)) problems.push('缺分栏 separator');
if (!/ArrowLeft[\s\S]{0,300}ArrowRight/.test(src)) problems.push('分栏必须支持键盘调整');
if (!/localStorage/.test(src)) problems.push('宽度/开合状态未持久化');
if (/ctx\.inject\('dsh-desktop-workbenches'/.test(src)) problems.push('不许使用旧式 ctx.inject 写法');
if (!/ctx\.effect\(\(\) => ctx\.desktopWorkbenches\.register/.test(src)) problems.push('register 未包在 ctx.effect 内');
if (!/businessWidth: __PANEL_LAYOUT__\.businessWidth/.test(src)) problems.push('客户端未使用唯一来源的面板宽度');
if (!/const __PANEL_LAYOUT__ = \{"customFrame":true/.test(built)) problems.push('lib/client.js 未注入 panel layout');
if (!/const __VERSION__ = "0\.1\.0"/.test(built)) problems.push('lib/client.js 版本未注入');
if (!/initialize|initialization/.test(src)) problems.push('缺初始化策略声明');

if (problems.length) {
  for (const p of problems) console.error('✗ ' + p);
  process.exit(1);
}
console.log('✓ 面板合同：conversation / 分栏 / 持久化 / 注册');
