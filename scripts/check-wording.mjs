#!/usr/bin/env node
/* 文案红线：禁承诺/判读词；只在业务源码与页面里扫。 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || '.');
const targets = ['public', 'src', 'dsh', 'lib']
  .map((d) => join(root, d))
  .filter((d) => existsSync(d));
const banned = ['预后', '生存期', '疗效', '治愈率', '五年生存率', '复发风险', '建议化疗', '应该手术', '必须复查'];
const problems = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs);
    else if (/\.(js|mjs|html|css|json)$/.test(name)) {
      const lines = readFileSync(abs, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const word of banned) {
          if (!line.includes(word)) continue;
          /* 家族口径：否定式自述（不评疗效/不判预后）不算承诺；正向使用仍报红。 */
          const negated = new RegExp(`(不|非|禁|勿|无|未)[^。；，、]{0,6}${word}`).test(line);
          if (!negated) problems.push(`${abs.replace(root + '/', '')}:${i + 1} 命中「${word}」`);
        }
      });
    }
  }
}
for (const dir of targets) walk(dir);

if (problems.length) {
  for (const p of problems) console.error('✗ ' + p);
  process.exit(1);
}
console.log('✓ 文案红线：0 命中');
