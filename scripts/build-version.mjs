#!/usr/bin/env node
/* 从 VERSION 派生 lib/version.js；--check 只校验同步。 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const check = process.argv.includes('--check');
const version = readFileSync(join(ROOT, 'VERSION'), 'utf8').trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('✗ VERSION 不是 semver：' + version);
  process.exit(1);
}
let commit = 'local';
try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* 非 git */ }
if (!commit) commit = 'local';
const build = new Date().toISOString().slice(0, 10);
const out = `/* 生成物，勿手改：由 scripts/build-version.mjs 从 VERSION 派生。 */
export const version = '${version}';
export const displayVersion = 'v${version}';
export const channel = 'dev';
export const channelLabel = '开发';
export const build = '${build}';
export const commit = '${commit}';
export default { version, displayVersion, channel, channelLabel, build, commit };
`;
const target = join(ROOT, 'lib/version.js');
if (check) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  const normalized = current.replace(/build = '\d{4}-\d{2}-\d{2}'/, "build = '0000-00-00'")
    .replace(/commit = '[^']*'/, "commit = 'x'");
  const expected = out.replace(/build = '\d{4}-\d{2}-\d{2}'/, "build = '0000-00-00'")
    .replace(/commit = '[^']*'/, "commit = 'x'");
  if (normalized !== expected) {
    console.error('✗ lib/version.js 与 VERSION 不同步（跑 npm run build:version）');
    process.exit(1);
  }
  console.log('✓ lib/version.js 与 VERSION 同步');
  process.exit(0);
}
writeFileSync(target, out);
console.log(`✓ lib/version.js（v${version}）`);
