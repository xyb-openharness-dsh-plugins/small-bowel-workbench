#!/usr/bin/env node
/**
 * 独立启动：不装 Desktop 也能看真实页面。
 *   npm start -- --root /path/to/data [--port 8917]
 * root 必须存在且不是主目录/桌面/下载根/tmp；缺省时用临时目录只做演示。
 */
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Workbench } from '../dsh/workbench.js';
import { createHandler, checkDataDir } from '../dsh/server.js';
import { version, displayVersion, build as buildDate } from '../lib/version.js';
import { API_PREFIX } from '../lib/identity.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
function arg(name, fallback = '') {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}

let root = arg('--root');
if (root) {
  const check = checkDataDir(root);
  if (!check.ok) {
    console.error('✗ ' + check.reason);
    process.exit(1);
  }
} else {
  root = mkdtempSync(join(tmpdir(), 'small-bowel-demo-'));
  console.log('· 未提供 --root，使用临时演示目录：' + root);
}

const port = Number(arg('--port', process.env.PORT || 8917));
const workbench = new Workbench({ root });
workbench.open();

const services = {
  version, displayVersion, buildDate,
  capabilities: ['health', 'bootstrap', 'subjects', 'read', 'write', 'privacy', 'export', 'data-root', 'trials'],
  bootstrap: (key) => workbench.bootstrap(key),
  listSubjects: () => workbench.subjects(),
  createSubject: (input) => workbench.createSubject(input),
  deleteSubject: (key) => workbench.deleteSubject(key),
  readEntity: (entity, key) => workbench.readEntity(entity, key),
  addEntry: (key, kind, data) => workbench.addEntry(key, kind, data),
  setPrivacy: (key, kind, id, isPrivate) => workbench.setPrivacy(key, kind, id, isPrivate),
  exportProfile: (key) => workbench.exportProfile(key),
  dataRoot: () => workbench.dataRoot,
  setDataRoot: (dir) => workbench.setDataRoot(dir),
  trialMatch: () => workbench.trialMatch(),
  currentProfileKey: () => workbench.getCurrentProfileKey(),
};

const handler = createHandler({ apiBase: API_PREFIX, publicDir: join(HERE, '..', 'public'), services });
const server = createServer(handler);
server.listen(port, '127.0.0.1', () => {
  console.log(`✓ 小肠腺癌工作台（独立演示） http://127.0.0.1:${port}/small-bowel/`);
  console.log(`  API ${API_PREFIX}/bootstrap · 版本 ${displayVersion} · 构建 ${buildDate}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => { workbench.close(); process.exit(0); });
  });
}
