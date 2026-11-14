#!/usr/bin/env node
/* 宿主接线：入口四要素、Config 位置、inject、认证、无 ctx.config。 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || '.');
const src = readFileSync(join(root, 'dsh/index.js'), 'utf8');
const problems = [];

const must = [
  [/export const name = PLUGIN_ID/, '缺 name 导出'],
  [/export const inject = \['webServer', 'connection'\]/, 'inject 必须含 webServer、connection'],
  [/export function apply\(ctx, config = \{\}\)/, '缺 apply(ctx, config)'],
  [/export const Config = Schema\.object/, '缺 Config = Schema.object'],
  [/@deepseek-ai\/schemastery/, 'Config 必须来自宿主 Schemastery'],
  [/ctx\.connection\??\.requestRejection\(req\)/, '缺 connection 认证调用'],
  [/API_BASE_HOSTED/, 'API 前缀必须走常量'],
  [/ctx\.webServer\.register/, '缺 webServer.register'],
];
for (const [re, why] of must) if (!re.test(src)) problems.push(why);
if (/ctx\.config\s*[?.]\s*[A-Za-z_$]/.test(src)) problems.push('不许读 ctx.config（config 是 apply 第二参）');
if (/requestRejection\(req\)\s*\)\s*return;/.test(src)) problems.push('不许在认证失败时静默返回');
if (!/503/.test(src)) problems.push('认证能力缺失时必须 503');

const configAt = src.lastIndexOf('export const Config');
const applyAt = src.indexOf('export function apply');
if (configAt < applyAt) problems.push('Config 必须在文件末尾（宿主 peer 依赖不可单测）');

if (problems.length) {
  for (const p of problems) console.error('✗ ' + p);
  process.exit(1);
}
console.log('✓ 宿主合同：name / inject / Config / apply / 认证');
