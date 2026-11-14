#!/usr/bin/env node
/* 派生残留：源码里不得出现近邻病种的仓名/API 前缀。 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || '.');
const dirs = ['dsh', 'lib', 'public', 'src', 'schema'].map((d) => join(root, d)).filter(existsSync);
const patterns = [
  /gca-workbench/i, /psc-workbench/i, /ampullary-workbench/i, /gastric-workbench/i,
  /colorectal-workbench/i, /\/api\/gca\b/, /\/api\/psc\b/, /\/gca\//, /GlcaPal|GcaPal|PscPal/,
];
const problems = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs);
    else if (/\.(js|mjs|html|css|sql|json|yml)$/.test(name)) {
      const content = readFileSync(abs, 'utf8');
      for (const re of patterns) {
        if (re.test(content)) problems.push(`${abs.replace(root + '/', '')} 命中 ${re}`);
      }
    }
  }
}
for (const dir of dirs) walk(dir);

if (problems.length) {
  for (const p of problems) console.error('✗ ' + p);
  process.exit(1);
}
console.log('✓ 派生残留：0 命中');
