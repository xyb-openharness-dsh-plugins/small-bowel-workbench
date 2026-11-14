import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { Workbench } from '../dsh/workbench.js';
import { createHandler, resolveStatic, injectTokens } from '../dsh/server.js';
import { version, displayVersion, build } from '../lib/version.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function services(wb) {
  return {
    version, displayVersion, buildDate: build,
    capabilities: ['health', 'bootstrap', 'subjects', 'read', 'write', 'privacy', 'export', 'data-root', 'trials', 'library'],
    bootstrap: (key) => wb.bootstrap(key),
    listSubjects: () => wb.subjects(),
    createSubject: (input) => wb.createSubject(input),
    deleteSubject: (key) => wb.deleteSubject(key),
    readEntity: (entity, key) => wb.readEntity(entity, key),
    addEntry: (key, kind, data) => wb.addEntry(key, kind, data),
    setPrivacy: (key, kind, id, value) => wb.setPrivacy(key, kind, id, value),
    exportProfile: (key) => wb.exportProfile(key),
    dataRoot: () => wb.dataRoot,
    setDataRoot: (dir) => wb.setDataRoot(dir),
    trialMatch: () => wb.trialMatch(),
    clinicalLibrary: () => wb.clinicalLibrary(),
    currentProfileKey: () => wb.getCurrentProfileKey(),
  };
}

/** 不监听端口：直接把 req/res 喂给 handler（沙箱禁止 bind socket）。 */
async function invoke(handler, method, url, body) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  const req = Readable.from(payload ? [Buffer.from(payload)] : []);
  req.method = method;
  req.url = url;
  req.headers = {};
  const chunks = [];
  const headers = {};
  const res = {
    statusCode: 0,
    writeHead(status, hdrs) { this.statusCode = status; Object.assign(headers, hdrs || {}); },
    end(chunk) { if (chunk !== undefined) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))); },
  };
  await handler(req, res);
  const textBody = Buffer.concat(chunks).toString('utf8');
  let json = null;
  try { json = JSON.parse(textBody); } catch { /* 静态/文本 */ }
  return { status: res.statusCode, headers, text: textBody, json };
}

async function withServer(fn) {
  const root = mkdtempSync(join(tmpdir(), 'sba-srv-'));
  const wb = new Workbench({ root });
  wb.open();
  const handler = createHandler({ apiBase: '/api/small-bowel', publicDir: join(ROOT, 'public'), services: services(wb) });
  try { return await fn(handler, wb); } finally {
    wb.close();
    rmSync(root, { recursive: true, force: true });
  }
}

test('静态：路径穿越拒绝、SPA 兜底、index 注入令牌', () => {
  const pub = join(ROOT, 'public');
  assert.equal(resolveStatic(pub, '/../etc/passwd'), null);
  assert.equal(resolveStatic(pub, 'a/../../package.json'), null);
  assert.equal(resolveStatic(pub, '/nope.js'), null);
  assert.ok(resolveStatic(pub, '/index.html'));
  const html = injectTokens('<b>__VERSION_DISPLAY__</b><i>__API_BASE__</i>', {
    apiBase: '/api/small-bowel', version: '0.1.0', displayVersion: 'v0.1.0',
  });
  assert.equal(html, '<b>v0.1.0</b><i>/api/small-bowel</i>');
});

test('API：health / bootstrap / read / subjects', async () => {
  await withServer(async (handler) => {
    const health = await invoke(handler, 'GET', '/api/small-bowel/health');
    assert.equal(health.status, 200);
    assert.equal(health.json.ok, true);
    assert.ok(health.json.capabilities.includes('bootstrap'));

    const boot = await invoke(handler, 'GET', '/api/small-bowel/bootstrap');
    assert.equal(boot.status, 200);
    assert.equal(boot.json.subjects.length, 2);
    assert.equal(boot.json.demoMode, true);

    const bootB = await invoke(handler, 'GET', '/api/small-bowel/bootstrap?profileKey=demo-sba-b');
    assert.equal(bootB.json.profileKey, 'demo-sba-b');
    assert.match(bootB.json.profile.name, /十二指肠/);

    const key = boot.json.currentProfileKey;
    const labs = await invoke(handler, 'GET', `/api/small-bowel/read/labs?profileKey=${key}`);
    assert.equal(labs.status, 200);
    assert.equal(labs.json.entity, 'labs');
    assert.ok(labs.json.data.some((l) => l.analyte === 'CEA'));

    const created = await invoke(handler, 'POST', '/api/small-bowel/subjects', { name: '本机新档案' });
    assert.equal(created.status, 200);
    assert.match(created.json.profileKey, /^local-/);

    const del = await invoke(handler, 'DELETE', `/api/small-bowel/subjects?profileKey=${created.json.profileKey}`);
    assert.equal(del.json.deleted, true);
  });
});

test('API：本机临床库返回条目与来源终态，不伪造联网结果', async () => {
  await withServer(async (handler) => {
    const res = await invoke(handler, 'GET', '/api/small-bowel/library');
    assert.equal(res.status, 200);
    assert.equal(res.json.state, 'LOCAL_ONLY');
    assert.equal(res.json.entries.length, 10);
    assert.equal(res.json.counts.connectedSources, 0);
    assert.ok(res.json.sources.some((s) => s.state === 'NOT_CONNECTED'));
    assert.ok(res.json.entries.every((e) => e.verification === 'pending-clinical-review'));
  });
});

test('API：错误走 JSON，不裸抛；未知实体 400', async () => {
  await withServer(async (handler) => {
    const res = await invoke(handler, 'GET', '/api/small-bowel/read/nope?profileKey=demo-sba-a');
    assert.equal(res.status, 400);
    assert.equal(res.json.error, 'read failed');
    assert.match(res.json.detail, /未知实体/);

    const rootRes = await invoke(handler, 'POST', '/api/small-bowel/root', { dir: '/tmp/x' });
    assert.equal(rootRes.status, 400);
    assert.match(rootRes.json.error, /tmp/);

    const badJson = await invoke(handler, 'POST', '/api/small-bowel/entries', undefined);
    assert.equal(badJson.status, 400, '空 body 应按缺字段拒绝');
  });
});

test('API：写记录 + 隐私过滤 + 导出不含私密', async () => {
  await withServer(async (handler) => {
    const created = await invoke(handler, 'POST', '/api/small-bowel/entries', {
      profileKey: 'demo-sba-a', kind: 'symptoms',
      data: { symptomText: '导出私密测试', severityNum: 3, isPrivate: true },
    });
    assert.equal(created.status, 200);
    assert.ok(created.json.id > 0);

    const exported = await invoke(handler, 'GET', '/api/small-bowel/export?profileKey=demo-sba-a');
    assert.equal(exported.status, 200);
    assert.ok(!exported.json.entities.symptoms.some((s) => s.symptomText === '导出私密测试'));
    assert.ok(exported.json.note.includes('未标记私密'));
  });
});

test('静态：宿主挂载前缀被剥掉后仍能找到资源', async () => {
  await withServer(async (handler) => {
    const res = await invoke(handler, 'GET', '/small-bowel/app.js');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /javascript/);
    assert.ok(res.text.includes('PAGES'));

    const index = await invoke(handler, 'GET', '/small-bowel/');
    assert.equal(index.status, 200);
    assert.ok(index.text.includes('__VERSION_DISPLAY__') === false, 'index 应已被服务端注入版本');
    assert.ok(index.text.includes('v' + version));
  });
});
