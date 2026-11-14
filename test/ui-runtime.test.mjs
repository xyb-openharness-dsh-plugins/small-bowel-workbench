import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { Workbench } from '../dsh/workbench.js';
import {
  readDiagnoses, readPathology, readLabs, readImaging, readTreatments, readMedications,
  readSymptoms, readNutrition, readFollowups, readDocuments, readSavedTrials, readViewpoints,
} from '../dsh/readmodels.js';
import { libraryPayload } from '../dsh/library.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 用最小 DOM 桩执行真实的 public/app.js：
 * 目的不是替代浏览器，而是抓模板函数在真实演示数据上的运行时错误。
 */
function makeHarness() {
  const wb = new Workbench({ dbFile: ':memory:' });
  wb.open();
  const boot = wb.bootstrap();
  const key = boot.currentProfileKey;
  const readers = {
    diagnoses: readDiagnoses, pathology: readPathology, labs: readLabs, imaging: readImaging,
    treatments: readTreatments, medications: readMedications, symptoms: readSymptoms,
    nutrition: readNutrition, followups: readFollowups, documents: readDocuments,
    trials: readSavedTrials, viewpoints: readViewpoints,
  };
  const reads = Object.fromEntries(Object.entries(readers).map(([name, fn]) => [name, fn(wb.db, key)]));
  wb.close();

  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        id, innerHTML: '', textContent: '', value: '', open: false,
        dataset: {},
        focus() {}, setAttribute() {}, removeAttribute() {}, close() { this.open = false; },
        showModal() { this.open = true; },
        querySelector() { return null; },
      });
    }
    return elements.get(id);
  }

  const documentHandlers = {};
  const windowHandlers = {};
  const response = (payload) => ({ ok: true, status: 200, json: async () => payload });
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
    encodeURIComponent,
    location: { hash: '' },
    history: { replaceState() {} },
    document: {
      getElementById: element,
      querySelectorAll: () => [],
      addEventListener(type, fn) { documentHandlers[type] = fn; },
    },
    window: {
      addEventListener(type, fn) { windowHandlers[type] = fn; },
      scrollTo() {},
      print() {},
      SBA_PRIMER: '<section>primer</section>',
    },
    fetch: async (url) => {
      const u = String(url);
      if (u.includes('/bootstrap')) return response(boot);
      if (u.includes('/library')) return response(libraryPayload());
      const match = u.match(/\/read\/([a-z]+)/);
      if (match) return response({ entity: match[1], profileKey: key, data: reads[match[1]] });
      throw new Error('unexpected fetch: ' + u);
    },
  };
  sandbox.globalThis = sandbox;
  createContext(sandbox);
  runInContext(readFileSync(join(ROOT, 'public/app.js'), 'utf8'), sandbox);
  return { sandbox, boot, key, element, documentHandlers, windowHandlers };
}

async function waitFor(predicate, timeout = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return false;
}

test('页面运行时：today 真实渲染，含档案、八页与示例条', async () => {
  const h = makeHarness();
  const ok = await waitFor(() => h.element('page').innerHTML.includes('当前档案'));
  assert.ok(ok, 'today 页未渲染出来');
  const appHtml = h.element('app').innerHTML;
  const pageHtml = h.element('page').innerHTML;
  assert.ok(appHtml.includes('合成示例'));
  assert.equal((appHtml.match(/class="tab"/g) || []).length, 8);
  assert.ok(pageHtml.includes('示例档案 A'));
  assert.ok(pageHtml.includes('带去门诊'));
  assert.ok(pageHtml.includes('通道状态'));
  assert.ok(pageHtml.includes('不评疗效') || pageHtml.includes('不诊断'));
});

test('页面运行时：八个 buildPage 都能在真实演示数据上生成内容', async () => {
  const h = makeHarness();
  await waitFor(() => h.element('page').innerHTML.length > 0);
  for (const page of ['today', 'record', 'tests', 'treatment', 'symptoms', 'followup', 'trials', 'documents']) {
    const html = await h.sandbox.buildPage(page);
    assert.equal(typeof html, 'string', page + ' 未返回字符串');
    assert.ok(html.length > 200, page + ' 内容过短：' + html.length);
    assert.ok(!html.includes('undefined'), page + ' 渲染出 undefined');
    assert.ok(!html.includes('NaN'), page + ' 渲染出 NaN');
  }
});

test('页面运行时：化验卡按两组展示，图表 SVG 合法', async () => {
  const h = makeHarness();
  await waitFor(() => h.element('page').innerHTML.length > 0);
  const html = await h.sandbox.buildPage('tests');
  assert.ok(html.includes('CEA'));
  assert.ok(html.includes('示例医院 A'));
  assert.ok(html.includes('示例医院 B'));
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('不与其他方法/机构合并'));
  const ceaCard = (html.match(/<h2>CEA<\/h2>[\s\S]*?<\/section>/) || [''])[0];
  assert.ok(ceaCard.includes('示例医院 A') && ceaCard.includes('示例医院 B'), 'CEA 卡未包含两组');
  assert.equal((ceaCard.match(/class="lab-group"/g) || []).length, 2);
});

test('页面运行时：试验页展示本机临床库，但不伪造试验条数', async () => {
  const h = makeHarness();
  await waitFor(() => h.element('page').innerHTML.length > 0);
  const html = await h.sandbox.buildPage('trials');
  assert.ok(html.includes('本机临床库'));
  assert.ok(html.includes('收录范围：小肠原发腺癌'));
  assert.ok(html.includes('NOT_CONNECTED'));
  assert.ok(html.includes('待临床审核'));
  assert.ok(!/\d+ 条试验/.test(html), '未接通时不得显示试验条数');
});

test('页面运行时：只读桥可切页、拒绝未知页，不提供写入', async () => {
  const h = makeHarness();
  await waitFor(() => h.element('page').innerHTML.length > 0);
  const bridge = h.sandbox.window.__SBA_BRIDGE__;
  assert.ok(bridge, '缺只读桥');
  assert.equal(bridge.openPage('tests'), true);
  const ok = await waitFor(() => h.element('page').innerHTML.includes('化验按'));
  assert.ok(ok, '切到检查页后未渲染');
  assert.equal(bridge.page, 'tests');
  assert.equal(bridge.openPage('nope'), false);
  assert.equal(typeof bridge.addEntry, 'undefined', '桥不得暴露写入');
});
