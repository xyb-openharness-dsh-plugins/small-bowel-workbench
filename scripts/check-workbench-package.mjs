#!/usr/bin/env node
/* 包合同：名字、入口、exports、patch、客户端注入、files 清单。 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || '.');
const problems = [];
const read = (p) => readFileSync(join(root, p), 'utf8');
let pkg;
try { pkg = JSON.parse(read('package.json')); } catch (error) {
  console.error('✗ package.json 读不了：' + error.message);
  process.exit(1);
}
const version = read('VERSION').trim();

if (pkg.name !== '@xyb-community/small-bowel-workbench') problems.push('包名不是 @xyb-community/small-bowel-workbench');
if (pkg.version !== version) problems.push(`package.version(${pkg.version}) ≠ VERSION(${version})`);
if (pkg.main !== './dsh/index.js') problems.push('main 必须指向 ./dsh/index.js');
if (pkg.exports?.['.'] !== './dsh/index.js') problems.push('exports["."] 必须指向入口');
if (pkg.exports?.['./client'] !== './lib/client.js') problems.push('exports["./client"] 必须指向 lib/client.js');
if (!pkg.dsh?.bundle?.patch) problems.push('缺 dsh.bundle.patch');
if (!Array.isArray(pkg.dsh?.client?.inject) || !pkg.dsh.client.inject.includes('dsh-desktop-workbenches')) {
  problems.push('dsh.client.inject 必须包含 dsh-desktop-workbenches');
}

for (const file of ['dsh/index.js', 'lib/client.js', 'public/index.html', 'schema/0001_initial.sql', 'cordis.patch.yml', 'README.md', 'NOTICE.md']) {
  if (!existsSync(join(root, file))) problems.push('缺文件：' + file);
}
for (const dir of ['dsh', 'lib', 'public', 'schema']) {
  if (!(pkg.files || []).includes(dir)) problems.push(`files 未包含 ${dir}/`);
}
if (pkg.dependencies && Object.keys(pkg.dependencies).length) problems.push('不应有运行期 dependencies（宿主 peer 之外）');
if (pkg.devDependencies && Object.keys(pkg.devDependencies).length) problems.push('不应有 devDependencies（本机零依赖检查链）');

const patch = read('cordis.patch.yml');
if (!patch.includes('name: "@xyb-community/small-bowel-workbench"')) problems.push('cordis.patch.yml 的 insert.name 不是完整包名');
if (!patch.includes('config:') || !patch.includes('root:')) problems.push('cordis.patch.yml 缺 config.root');

if (problems.length) {
  for (const p of problems) console.error('✗ ' + p);
  process.exit(1);
}
console.log('✓ 包合同：' + pkg.name + '@' + pkg.version);
