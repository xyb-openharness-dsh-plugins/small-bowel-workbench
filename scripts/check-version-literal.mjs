#!/usr/bin/env node
/* 版本同源：VERSION / package / lib/version.js / README / CHANGELOG。 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || '.');
const version = readFileSync(join(root, 'VERSION'), 'utf8').trim();
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const lib = readFileSync(join(root, 'lib/version.js'), 'utf8');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
const problems = [];

if (pkg.version !== version) problems.push(`package.json ${pkg.version} ≠ VERSION ${version}`);
const libVersion = lib.match(/export const version = '([^']+)'/)?.[1];
if (libVersion !== version) problems.push(`lib/version.js ${libVersion} ≠ VERSION ${version}`);
if (!readme.includes(`版本 ${version}`)) problems.push(`README 缺「版本 ${version}」`);
if (!changelog.includes(`## ${version}`)) problems.push(`CHANGELOG 缺「## ${version}」`);
if (!lib.includes(`export const displayVersion = 'v${version}'`)) problems.push('displayVersion 不同源');

if (problems.length) {
  for (const p of problems) console.error('✗ ' + p);
  process.exit(1);
}
console.log('✓ 版本同源：' + version);
