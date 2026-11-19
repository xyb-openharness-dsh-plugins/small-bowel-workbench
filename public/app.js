/* 小肠宝 SmallBowelPal · 小肠腺癌工作台（M5 开发版）
   八页导航 + 本机写入/隐私/导出 + 本机临床库。所有数据来自本机 /api/small-bowel。
   原则：记录不等于判断；缺失显示「未记录」；不同方法/机构的化验不合并。 */

const API_BASE = '__API_BASE__';
const VERSION = '__VERSION__';
const VERSION_DISPLAY = '__VERSION_DISPLAY__';
const BUILD_DATE = '__BUILD_DATE__';

const PAGES = [
  { id: 'today', label: '今天', hint: '最近变化与下次复诊' },
  { id: 'record', label: '档案', hint: '确诊、病理与分子检测' },
  { id: 'tests', label: '检查', hint: '化验与影像' },
  { id: 'treatment', label: '治疗', hint: '手术、系统治疗与用药' },
  { id: 'symptoms', label: '症状与营养', hint: '你的感受与体重' },
  { id: 'followup', label: '随访', hint: '医生已安排的复诊' },
  { id: 'trials', label: '试验', hint: '收藏的临床研究' },
  { id: 'documents', label: '资料', hint: '原始报告清单' },
];

/* 录入字段白名单与后端 dsh/workbench.js 的 FIELDS 一一对应；不在这里的字段不进 SQL。 */
const ENTRY_KINDS = [
  { kind: 'diagnoses', label: '确诊记录', fields: [
    ['siteText', '部位原文'], ['histologyText', '病理类型'], ['gradeText', '分级原文'], ['stageText', '分期原文'],
    ['diagnosedOn', '确诊日期', 'date'], ['hospitalText', '医院'], ['basisText', '确诊依据', 'textarea'], ['noteText', '备注', 'textarea'],
  ] },
  { kind: 'pathology', label: '病理报告', fields: [
    ['specimenText', '标本 *', 'text', true], ['collectedOn', '取材日期', 'date'], ['reportedOn', '报告日期', 'date'],
    ['hospitalText', '医院'], ['findingsText', '镜下所见', 'textarea'], ['marginText', '切缘原文'],
    ['nodesExamined', '检出淋巴结数', 'number'], ['nodesPositive', '阳性淋巴结数', 'number'],
    ['molecularText', '分子检测原文', 'textarea'], ['noteText', '备注', 'textarea'],
  ] },
  { kind: 'labs', label: '化验', fields: [
    ['analyteText', '指标 *', 'text', true], ['collectedOn', '采样日期', 'date'], ['valueNum', '结果数值', 'number'],
    ['unitText', '单位'], ['refText', '参考范围'], ['methodText', '方法'], ['orgText', '机构'],
    ['flagText', '报告标记'], ['noteText', '备注', 'textarea'],
  ] },
  { kind: 'imaging', label: '影像/内镜', fields: [
    ['performedOn', '检查日期', 'date'], ['modalityText', '检查类型'], ['regionText', '部位'],
    ['orgText', '机构'], ['impressionText', '报告结论原文', 'textarea'], ['reportRefText', '报告编号'],
    ['noteText', '备注', 'textarea'],
  ] },
  { kind: 'treatments', label: '治疗', fields: [
    ['kindText', '治疗类别'], ['nameText', '名称'], ['startedOn', '开始日期', 'date'], ['endedOn', '结束日期', 'date'],
    ['intentText', '医生写的意图'], ['regimenText', '方案原文', 'textarea'], ['cyclesText', '周期'],
    ['hospitalText', '医院'], ['noteText', '备注', 'textarea'],
  ] },
  { kind: 'medications', label: '用药', fields: [
    ['nameText', '药物 *', 'text', true], ['doseText', '剂量'], ['scheduleText', '频次'],
    ['startedOn', '开始日期', 'date'], ['endedOn', '结束日期', 'date'], ['purposeText', '用途原文'],
    ['prescriberText', '开药医生'], ['noteText', '备注', 'textarea'],
  ] },
  { kind: 'symptoms', label: '症状', fields: [
    ['occurredOn', '发生日期', 'date'], ['symptomText', '症状 *', 'text', true],
    ['severityNum', '自评 0–10', 'number'], ['durationText', '持续多久'], ['contextText', '当时情境'],
    ['noteText', '备注', 'textarea'],
  ] },
  { kind: 'nutrition', label: '体重/营养', fields: [
    ['measuredOn', '日期', 'date'], ['weightKg', '体重 kg', 'number'], ['heightCm', '身高 cm', 'number'],
    ['intakeText', '进食方式'], ['supplementsText', '补充剂原文'], ['noteText', '备注', 'textarea'],
  ] },
  { kind: 'followups', label: '随访安排', fields: [
    ['plannedOn', '计划日期', 'date'], ['kindText', '复诊/检查项目'], ['statusText', '状态原文'],
    ['hospitalText', '医院'], ['noteText', '备注', 'textarea'],
  ] },
  { kind: 'documents', label: '资料', fields: [
    ['titleText', '标题 *', 'text', true], ['docTypeText', '类型'], ['addedOn', '加入日期', 'date'],
    ['sourcePathText', '本机路径'], ['sha256Text', 'SHA-256'], ['parseStatusText', '解析状态'],
    ['noteText', '备注', 'textarea'],
  ] },
  { kind: 'trials', label: '收藏试验', fields: [
    ['registryId', '登记号'], ['titleText', '标题', 'text'], ['statusText', '状态原文'],
    ['eligibilityText', '入组条件原文', 'textarea'], ['siteText', '中心'], ['urlText', '链接'],
    ['savedOn', '收藏日期', 'date'], ['noteText', '备注', 'textarea'],
  ] },
  { kind: 'viewpoints', label: '想问医生的问题', fields: [
    ['topicText', '主题'], ['bodyText', '内容', 'textarea'], ['sourceText', '来源'],
    ['recordedOn', '记录日期', 'date'],
  ] },
];

const state = {
  boot: null,
  bootError: null,
  page: 'today',
  profileKey: null,
  cache: new Map(),
  requestToken: 0,
  flash: '',
  trialTab: 'match',
  trialFilters: {},
  trialDetail: null,
};

const app = document.getElementById('app');

/* ---------------- 基础工具 ---------------- */

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

function text(value, fallback = '未记录') {
  return value === null || value === undefined || String(value).trim() === '' ? fallback : String(value);
}

function num(value, digits = 1) {
  if (value === null || value === undefined || value === '') return '未记录';
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits).replace(/\.0$/, '') : '未记录';
}

function dateText(value) {
  return value ? String(value).slice(0, 10) : '未记录';
}

async function api(path, { method = 'GET', body: requestBody } = {}) {
  const init = { method, headers: { accept: 'application/json' } };
  if (requestBody !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(requestBody);
  }
  const response = await fetch(API_BASE + path, init);
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const detail = body?.detail || body?.error || `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return body;
}

async function read(entity, { fresh = false } = {}) {
  const cacheKey = `${state.profileKey}:${entity}`;
  if (!fresh && state.cache.has(cacheKey)) return state.cache.get(cacheKey);
  const body = await api(`/read/${entity}?profileKey=${encodeURIComponent(state.profileKey)}`);
  state.cache.set(cacheKey, body.data);
  return body.data;
}

function pageFromHash() {
  const id = (location.hash || '').replace(/^#/, '');
  return PAGES.some((p) => p.id === id) ? id : 'today';
}

/* ---------------- 启动 ---------------- */

async function loadBoot(preferredKey) {
  state.bootError = null;
  try {
    const suffix = preferredKey ? `?profileKey=${encodeURIComponent(preferredKey)}` : '';
    const boot = await api('/bootstrap' + suffix);
    state.boot = boot;
    state.profileKey = boot.currentProfileKey;
    state.page = pageFromHash();
    render();
  } catch (error) {
    state.bootError = error;
    renderBootError();
  }
}

function renderBootError() {
  app.innerHTML = `
    <div class="page">
      <div class="error-banner" role="alert">
        <div>
          <p><strong>工作台没有打开。</strong> ${esc(state.bootError?.message || '未知错误')}</p>
          <p class="detail">资料仍在本机；这一步只影响页面加载。若反复失败，请确认资料目录已配置。</p>
        </div>
        <button class="text-btn" data-retry-boot type="button">重试</button>
      </div>
    </div>`;
}

function render() {
  if (!state.boot) return;
  const profile = state.boot.profile;
  const isDemo = Boolean(profile?.isDemo);
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <!-- 品牌名由宿主外壳 header 呈现（用户反馈 2026-11-19：双份重复，保留上面、移除下面）；
             file:// 独立打开时 title 仍标注于 <title>。 -->
        <div class="topbar-spacer"></div>
        <div class="profile-wrap">
          <label for="profile-select">档案</label>
          <select id="profile-select" class="profile-select" aria-label="切换患者档案">
            ${(state.boot.subjects || []).map((s) => `
              <option value="${esc(s.profileKey)}" ${s.profileKey === state.profileKey ? 'selected' : ''}>
                ${esc(s.name)}${s.isDemo ? '（示例）' : ''}
              </option>`).join('')}
          </select>
          <button class="text-btn" data-open-profile type="button" aria-label="创建新档案">＋ 新建档案</button>
        </div>
        <div class="top-actions">
          ${state.profileKey ? '<button class="text-btn" data-open-entry type="button">新增记录</button>' : ''}
          ${state.profileKey ? '<button class="text-btn" data-export type="button">导出</button>' : ''}
          <button class="text-btn" data-print type="button">打印本页</button>
          <button class="icon-btn" data-primer type="button" aria-label="打开疾病概要" title="疾病概要">?</button>
        </div>
      </header>
      ${isDemo ? `<div class="demo-strip"><span class="dot" aria-hidden="true"></span><strong>合成示例</strong><span>当前档案不对应任何真实患者；医院、医生、路径与试验编号均为虚构。</span></div>` : ''}
      ${state.flash ? `<div class="notice ok" role="status">${esc(state.flash)}</div>` : ''}
      <nav class="tabs" aria-label="工作台页面">
        ${PAGES.map((p) => `<button class="tab" type="button" data-page="${p.id}" ${p.id === state.page ? 'aria-current="page"' : ''}>${p.label}</button>`).join('')}
      </nav>
      <main class="page" id="page" tabindex="-1"></main>
      <footer class="footer">
        <span>版本 ${esc(VERSION_DISPLAY)} · 构建 ${esc(BUILD_DATE || '未记录')} · 包 ${esc(VERSION)}</span>
        <span>资料只存本机 · 不做诊断、不分期、不评疗效 · 阈值【待核】</span>
      </footer>
    </div>`;
  renderPage();
}

/* ---------------- 页面框架 ---------------- */

function pageHead(title, subtitle) {
  return `<div class="page-head">
    <div><p class="eyebrow">小肠腺癌 · 资料整理</p><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>
    <button class="text-btn" data-print type="button">打印</button>
  </div>`;
}

function skeleton() {
  return `<div class="skeleton" aria-label="正在读取本机资料">
    <div class="sk-card"></div><div class="sk-card"></div><div class="sk-card"></div>
  </div>`;
}

function emptyState(title, body) {
  return `<div class="empty"><strong>${esc(title)}</strong><span>${esc(body)}</span></div>`;
}

function errorState(error) {
  return `<div class="error-banner" role="alert">
    <div><p><strong>这一页没有读出来。</strong> ${esc(error.message || error)}</p>
    <p class="detail">可以重试；如果一直失败，资料本身不会被改动。</p></div>
    <button class="text-btn" data-retry="${esc(state.page)}" type="button">重试</button>
  </div>`;
}

function setPage(html) {
  const el = document.getElementById('page');
  if (el) el.innerHTML = html;
}

/* ---------------- 本机写入 / 档案 / 导出 ---------------- */

const PAGE_KIND = {
  record: 'diagnoses', tests: 'labs', treatment: 'treatments', symptoms: 'symptoms',
  followup: 'followups', trials: 'trials', documents: 'documents', today: 'symptoms',
};

function renderEntryFields(kind) {
  const config = ENTRY_KINDS.find((item) => item.kind === kind) || ENTRY_KINDS[0];
  const host = document.getElementById('entry-fields');
  if (!host) return;
  host.innerHTML = config.fields.map(([name, label, type = 'text', required = false]) => {
    const wide = type === 'textarea' ? ' wide' : '';
    const requiredAttr = required ? ' required' : '';
    if (type === 'textarea') {
      return `<label class="field${wide}"><span>${esc(label)}</span><textarea name="${esc(name)}"${requiredAttr}></textarea></label>`;
    }
    const inputType = type === 'date' ? 'date' : type === 'number' ? 'number' : 'text';
    const step = type === 'number' ? ' step="any"' : '';
    return `<label class="field${wide}"><span>${esc(label)}</span><input type="${inputType}" name="${esc(name)}"${step}${requiredAttr}></label>`;
  }).join('');
}

function openEntryDialog(kind) {
  const dialog = document.getElementById('entry-dialog');
  const select = document.getElementById('entry-kind');
  if (!dialog || !select) return;
  select.innerHTML = ENTRY_KINDS.map((item) => `<option value="${item.kind}">${esc(item.label)}</option>`).join('');
  select.value = kind || PAGE_KIND[state.page] || 'diagnoses';
  renderEntryFields(select.value);
  dialog.showModal();
}

function openProfileDialog() {
  document.getElementById('profile-dialog')?.showModal();
}

function privacyButton(kind, id, isPrivate) {
  return `<button class="text-btn tiny" type="button" data-privacy-kind="${esc(kind)}"
    data-privacy-id="${esc(id)}" data-privacy-value="${isPrivate ? 1 : 0}">${isPrivate ? '设为公开' : '设为私密'}</button>`;
}

function privacyPill(isPrivate) {
  return isPrivate ? '<span class="pill off">私密</span>' : '';
}

async function exportProfile() {
  if (!state.profileKey) return;
  try {
    const body = await api(`/export?profileKey=${encodeURIComponent(state.profileKey)}`);
    const blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `small-bowel-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    state.flash = '已导出未标私密的记录；导出文件只是资料副本，不构成医学结论。';
    render();
  } catch (error) {
    state.flash = '导出失败：' + (error.message || error);
    render();
  }
}

function setNav() {
  document.querySelectorAll('[data-page]').forEach((btn) => {
    if (btn.dataset.page === state.page) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
}

async function renderPage({ fresh = false } = {}) {
  if (!state.boot) return;
  setNav();
  if (!state.profileKey) {
    setPage(pageHead('还没有档案', '新建档案功能在 M4；当前可先查看演示档案。'));
    return;
  }
  const token = ++state.requestToken;
  setPage(skeleton());
  try {
    const html = await buildPage(state.page, fresh);
    if (token !== state.requestToken) return;
    setPage(html);
  } catch (error) {
    if (token !== state.requestToken) return;
    setPage(errorState(error));
  }
}

async function buildPage(page, fresh) {
  switch (page) {
    case 'today': return todayPage();
    case 'record': return recordPage(fresh);
    case 'tests': return testsPage(fresh);
    case 'treatment': return treatmentPage(fresh);
    case 'symptoms': return symptomsPage(fresh);
    case 'followup': return followupPage(fresh);
    case 'trials': return trialsPage(fresh);
    case 'documents': return documentsPage(fresh);
    default: return todayPage();
  }
}

/* ---------------- 今天 ---------------- */

function todayPage() {
  const boot = state.boot;
  const profile = boot.profile || {};
  const counts = boot.counts || {};
  const dataRootNotice = boot.dataRoot && !boot.dataRoot.ok
    ? `<div class="notice calm"><strong>资料目录：</strong>${esc(boot.dataRoot.reason || '尚未配置专用目录')}。演示模式不受影响。</div>`
    : '';
  const next = (boot.upcoming || []);
  return `
    ${pageHead('今天', '先看最近发生了什么，再把下次门诊要带的东西收在一起。')}
    ${dataRootNotice}
    <section class="hero">
      <p class="eyebrow">当前档案</p>
      <h1>${esc(profile.name || '未命名档案')}</h1>
      <div class="meta">
        <span>原发部位：${esc(text(profile.primarySiteText))}</span>
        <span>病理：${esc(text(profile.histologyText))}</span>
        <span>确诊：${esc(dateText(profile.diagnosedOn))}</span>
        <span>${esc(text(profile.hospitalText, '医院未记录'))}</span>
      </div>
      ${profile.actionPlanText ? `<p class="plan"><strong>医生已安排：</strong>${esc(profile.actionPlanText)}</p>` : ''}
    </section>

    <div class="grid two">
      <section class="card">
        <h2>下次复诊</h2>
        ${next.length ? `<ul class="timeline">${next.map((f) => `<li>
          <div class="when">${esc(dateText(f.plannedOn))}</div>
          <div class="what">${esc(text(f.kindText))}</div>
          <div class="detail">${esc(text(f.statusText))} · ${esc(text(f.hospitalText, '机构未记录'))}</div>
          ${f.noteText ? `<div class="detail">${esc(f.noteText)}</div>` : ''}
        </li>`).join('')}</ul>` : emptyState('没有待复诊记录', '医生安排的复诊会显示在这里；也可以先在「随访」页查看全部记录。')}
      </section>

      <section class="card">
        <h2>带去门诊</h2>
        <ul class="list">
          <li><div class="row"><b>病理与分子检测报告</b><span class="pill ${counts.pathology ? 'live' : ''}">${counts.pathology || 0} 份</span></div><div class="note">切缘、淋巴结、MSI/dMMR、HER2 等按原文带上。</div></li>
          <li><div class="row"><b>最近一次影像</b><span class="pill ${counts.imaging ? 'live' : ''}">${counts.imaging || 0} 次</span></div><div class="note">CT / MRI / PET-CT / 小肠镜，带报告与片子。</div></li>
          <li><div class="row"><b>当前用药清单</b><span class="pill ${counts.medications ? 'live' : ''}">${counts.medications || 0} 种</span></div><div class="note">含剂量、频次、开始/结束时间。</div></li>
          <li><div class="row"><b>想问医生的问题</b><span class="pill ${counts.viewpoints ? 'live' : ''}">${counts.viewpoints || 0} 条</span></div><div class="note">在「档案」页可以写下来，避免门诊时忘记。</div></li>
        </ul>
      </section>

      <section class="card">
        <h2>最近变化</h2>
        ${(boot.recent || []).length ? `<ul class="timeline">${boot.recent.map((item) => `<li>
          <div class="when">${esc(dateText(item.date))}</div>
          <div class="what">${esc(item.text)}</div>
          <div class="detail">${esc(kindLabel(item.kind))}${item.detail ? ' · ' + esc(item.detail) : ''}</div>
        </li>`).join('')}</ul>` : emptyState('还没有记录', '化验、影像、治疗或症状记录后，这里会出现最近变化。')}
      </section>

      <section class="card">
        <h2>通道状态</h2>
        <ul class="list">
          <li><div class="row"><b>文档解析</b><span class="pill off">${esc(boot.channels?.documents?.status || '未接通')}</span></div><div class="note">${esc(boot.channels?.documents?.label || '')}</div></li>
          <li><div class="row"><b>临床试验检索</b><span class="pill off">${esc(boot.channels?.trials?.status || '未接通')}</span></div><div class="note">${esc(boot.channels?.trials?.label || '')}</div></li>
          <li><div class="row"><b>AI 对话</b><span class="pill">${esc(boot.channels?.ai?.status || '宿主管理')}</span></div><div class="note">${esc(boot.channels?.ai?.label || '')}</div></li>
        </ul>
      </section>
    </div>

    <section class="card" style="margin-top:14px">
      <h2>本台的边界</h2>
      <div class="callout"><span class="mark" aria-hidden="true">※</span><div>
        ${(boot.disclaimers || []).map((line) => `<p>${esc(line)}</p>`).join('')}
      </div></div>
    </section>`;
}

function kindLabel(kind) {
  return ({ symptom: '症状', imaging: '影像', treatment: '治疗', lab: '化验' })[kind] || '记录';
}

/* ---------------- 档案 ---------------- */

async function recordPage(fresh) {
  const [diagnoses, pathology, viewpoints] = await Promise.all([
    read('diagnoses', { fresh }), read('pathology', { fresh }), read('viewpoints', { fresh }),
  ]);
  const hasAny = diagnoses.length || pathology.length;
  return `
    ${pageHead('档案', '医生写了什么，就记什么。本台不重新分期，也不解释切缘好坏。')}
    <div class="notice"><strong>收录范围：</strong>小肠原发腺癌（十二指肠 / 空肠 / 回肠）。壶腹部癌、胰胆来源、GIST、淋巴瘤、神经内分泌肿瘤不在本台范围内。</div>
    <div class="page-head" style="margin-top:10px">
      <p class="sub">本机档案只存在你选定的资料目录。</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="text-btn" data-open-profile type="button">新建本机档案</button>
        ${state.boot.profile && !state.boot.profile.isDemo
          ? `<button class="text-btn" data-delete-profile type="button">删除当前档案</button>` : ''}
      </div>
    </div>
    ${!hasAny ? emptyState('还没有确诊或病理记录', '点顶栏「新增记录」，从确诊或病理报告开始；演示档案里也可以看到两套不同部位的示例。') : ''}
    <div class="grid two" style="margin-top:14px">
      ${diagnoses.map((d) => `<section class="card">
        <p class="eyebrow">确诊记录 · 医生原话</p>
        <h2>${esc(text(d.siteText, '部位未记录'))}</h2>
        <dl class="kv">
          <dt>病理类型</dt><dd>${esc(text(d.histologyText))}</dd>
          <dt>分级</dt><dd>${esc(text(d.gradeText))}</dd>
          <dt>分期（原文）</dt><dd>${esc(text(d.stageText))}</dd>
          <dt>确诊日期</dt><dd>${esc(dateText(d.diagnosedOn))}</dd>
          <dt>机构</dt><dd>${esc(text(d.hospitalText))}</dd>
          <dt>依据</dt><dd>${esc(text(d.basisText))}</dd>
        </dl>
        ${d.noteText ? `<p class="sub" style="margin-top:10px">${esc(d.noteText)}</p>` : ''}
        <div style="display:flex;gap:8px;align-items:center;margin-top:8px">${privacyPill(d.isPrivate)}${privacyButton('diagnoses', d.id, d.isPrivate)}</div>
      </section>`).join('')}
    </div>

    <section class="card" style="margin-top:14px">
      <h2>病理与分子检测</h2>
      ${pathology.length ? pathology.map((p) => `<div style="padding:12px 0;border-bottom:1px solid var(--line)">
        <div class="lab-head"><h3>${esc(p.specimenText)}</h3><span class="sub">报告 ${esc(dateText(p.reportedOn))}</span></div>
        <dl class="kv">
          <dt>取材日期</dt><dd>${esc(dateText(p.collectedOn))}</dd>
          <dt>机构</dt><dd>${esc(text(p.hospitalText))}</dd>
          <dt>镜下所见</dt><dd>${esc(text(p.findingsText))}</dd>
          <dt>切缘</dt><dd>${esc(text(p.marginText))}</dd>
          <dt>淋巴结</dt><dd>${p.nodesExamined === null && p.nodesPositive === null ? '未记录' : `${p.nodesPositive ?? '未记录'} / ${p.nodesExamined ?? '未记录'}（阳性 / 检出）`}</dd>
        </dl>
        <div class="quote" style="margin-top:10px"><strong>分子检测（原文）</strong><br>${esc(text(p.molecularText))}
          <span class="who">仅照录报告；是否影响用药由医生判断。</span></div>
        ${p.noteText ? `<p class="sub" style="margin-top:8px">${esc(p.noteText)}</p>` : ''}
        <div style="display:flex;gap:8px;align-items:center;margin-top:8px">${privacyPill(p.isPrivate)}${privacyButton('pathology', p.id, p.isPrivate)}</div>
      </div>`).join('') : emptyState('还没有病理报告', '病理报告是后续复诊最常被问到的材料。')}
    </section>

    <section class="card" style="margin-top:14px">
      <h2>想问医生的问题</h2>
      ${viewpoints.length ? viewpoints.map((v) => `<div class="quote" style="margin-bottom:10px">
        ${v.topicText ? `<strong>${esc(v.topicText)}</strong><br>` : ''}${esc(v.bodyText)}
        <span class="who">${esc(text(v.sourceText, '来源未记录'))} · ${esc(dateText(v.recordedOn))}</span>
        <div style="margin-top:6px">${privacyButton('viewpoints', v.id, v.isPrivate)}</div>
      </div>`).join('') : emptyState('还没有写下问题', '门诊时间短，先把问题记下来更不容易忘。')}
    </section>`;
}

/* ---------------- 检查 ---------------- */

async function testsPage(fresh) {
  const [labs, imaging] = await Promise.all([read('labs', { fresh }), read('imaging', { fresh })]);
  return `
    ${pageHead('检查', '化验按「方法 + 机构」分组；不同组不合并、不连线、不做差。')}
    <div class="notice calm"><strong>怎么看趋势：</strong>只有同一指标、同一方法、同一机构的两点以上才画线。换医院或换方法后会单独成组。</div>
    ${labs.length ? labs.map((lab) => labCard(lab)).join('') : emptyState('还没有化验记录', '化验单上的数值、单位、参考范围和机构都可以记在这里。')}
    <section class="card" style="margin-top:16px">
      <h2>影像与内镜</h2>
      ${imaging.length ? `<ul class="timeline">${imaging.map((img) => `<li>
        <div class="when">${esc(dateText(img.performedOn))}</div>
        <div class="what">${esc(text(img.modalityText))} · ${esc(text(img.regionText, '部位未记录'))}</div>
        <div class="detail">${esc(text(img.impressionText))}</div>
        <div class="detail">${esc(text(img.orgText, '机构未记录'))}${img.noteText ? ' · ' + esc(img.noteText) : ''}</div>
      </li>`).join('')}</ul>` : emptyState('还没有影像记录', 'CT、MRI、PET-CT、小肠镜或胶囊内镜都可以按时间记录。')}
    </section>`;
}

function labCard(lab) {
  return `<section class="card lab-card">
    <div class="lab-head"><h2>${esc(lab.analyte)}</h2><span class="sub">最近：${esc(dateText(lab.latestDate))}</span></div>
    ${lab.groups.map((group) => `<div class="lab-group">
      <div class="lab-group-head">
        <span><b>${esc(group.method || '方法未记录')}</b> · ${esc(group.org || '机构未记录')}</span>
        <span>${esc(group.unit || '单位未记录')} · 参考 ${esc(group.refText || '未记录')}</span>
      </div>
      ${chartSvg(group.points, group.unit)}
      <div class="table-wrap"><table class="table">
        <thead><tr><th>日期</th><th>结果</th><th>报告标记</th></tr></thead>
        <tbody>${group.points.slice().reverse().slice(0, 6).map((p) => `<tr>
          <td class="num">${esc(dateText(p.date))}</td>
          <td class="num">${esc(num(p.value, 2))}</td>
          <td>${p.flagText ? `<span class="chip warn">${esc(p.flagText)}</span>` : '<span class="sub">—</span>'}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <p class="sub">本组 ${group.count} 个点；不与其他方法/机构合并。</p>
    </div>`).join('')}
  </section>`;
}

function chartSvg(points, unit) {
  const usable = points.filter((p) => Number.isFinite(Number(p.value)));
  if (usable.length < 2) return '';
  const values = usable.map((p) => Number(p.value));
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max === min) { max += 1; min -= 1; }
  const pad = (max - min) * 0.12;
  min -= pad;
  max += pad;
  const W = 360;
  const H = 132;
  const L = 38;
  const R = 14;
  const T = 14;
  const B = 26;
  const at = (i) => L + (i / (usable.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const line = usable.map((p, i) => `${at(i).toFixed(1)},${y(Number(p.value)).toFixed(1)}`).join(' ');
  const frames = [0, 0.5, 1].map((f) => T + f * (H - T - B));
  const labels = [max - pad, (max + min) / 2, min + pad].map((v) => num(v, 1));
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(usable[0].date)} 至 ${esc(usable[usable.length - 1].date)} 的${esc(unit || '')}变化">
    ${frames.map((fy, i) => `<line class="grid-line" x1="${L}" y1="${fy.toFixed(1)}" x2="${W - R}" y2="${fy.toFixed(1)}"></line>
      <text class="axis" x="2" y="${(fy + 3).toFixed(1)}">${esc(labels[i])}</text>`).join('')}
    <polyline class="line" points="${line}"></polyline>
    ${usable.map((p, i) => `<circle class="pt ${p.flagText ? 'flag' : ''}" cx="${at(i).toFixed(1)}" cy="${y(Number(p.value)).toFixed(1)}" r="3"></circle>`).join('')}
    <text class="axis" x="${L}" y="${H - 6}">${esc(dateText(usable[0].date))}</text>
    <text class="axis" x="${W - R}" y="${H - 6}" text-anchor="end">${esc(dateText(usable[usable.length - 1].date))}</text>
  </svg>`;
}

/* ---------------- 治疗 ---------------- */

async function treatmentPage(fresh) {
  const [treatments, medications] = await Promise.all([
    read('treatments', { fresh }), read('medications', { fresh }),
  ]);
  return `
    ${pageHead('治疗', '手术、系统治疗与用药都按医嘱原文记录；本台不评疗效，也不给方案建议。')}
    <section class="card">
      <h2>治疗时间线</h2>
      ${treatments.length ? `<ul class="timeline">${treatments.map((t) => `<li>
        <div class="when">${esc(dateText(t.startedOn))}${t.endedOn ? ' → ' + esc(dateText(t.endedOn)) : ' → 进行中/未记录结束'}</div>
        <div class="what">${esc(text(t.kindText))} · ${esc(text(t.nameText, '名称未记录'))}</div>
        <div class="detail">${t.intentText ? '意图：' + esc(t.intentText) + ' · ' : ''}${t.regimenText ? '方案：' + esc(t.regimenText) + ' · ' : ''}${t.cyclesText ? esc(t.cyclesText) : ''}</div>
        <div class="detail">${esc(text(t.hospitalText, '机构未记录'))}${t.noteText ? ' · ' + esc(t.noteText) : ''}</div>
        <div style="margin-top:6px">${privacyPill(t.isPrivate)} ${privacyButton('treatments', t.id, t.isPrivate)}</div>
      </li>`).join('')}</ul>` : emptyState('还没有治疗记录', '手术、化疗、放疗或支持治疗都可以按时间段记录。')}
    </section>

    <section class="card" style="margin-top:14px">
      <h2>用药</h2>
      ${medications.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>药物</th><th>剂量</th><th>频次</th><th>开始</th><th>结束</th><th>用途（原文）</th></tr></thead>
        <tbody>${medications.map((m) => `<tr>
          <td><b>${esc(m.nameText)}</b> ${m.ongoing ? '<span class="pill live">在用</span>' : '<span class="pill">已停</span>'}</td>
          <td>${esc(text(m.doseText))}</td>
          <td>${esc(text(m.scheduleText))}</td>
          <td class="num">${esc(dateText(m.startedOn))}</td>
          <td class="num">${esc(dateText(m.endedOn))}</td>
          <td>${esc(text(m.purposeText))}${m.noteText ? `<div class="sub">${esc(m.noteText)}</div>` : ''}
            <div style="margin-top:4px">${privacyPill(m.isPrivate)} ${privacyButton('medications', m.id, m.isPrivate)}</div></td>
        </tr>`).join('')}</tbody>
      </table></div>` : emptyState('还没有用药记录', '当前在用的药、剂量和频次是复诊时最常被问到的信息。')}
    </section>`;
}

/* ---------------- 症状与营养 ---------------- */

async function symptomsPage(fresh) {
  const [symptoms, nutrition] = await Promise.all([
    read('symptoms', { fresh }), read('nutrition', { fresh }),
  ]);
  const latestWeight = nutrition.weightSeries.length ? nutrition.weightSeries[nutrition.weightSeries.length - 1] : null;
  return `
    ${pageHead('症状与营养', '用你自己的话记症状；体重与进食按日期记。本台不判断原因，也不给补充剂剂量。')}
    <div class="grid two">
      <section class="card">
        <h2>体重</h2>
        ${latestWeight ? `<p class="sub">最近一次：<b style="font-size:20px;color:var(--ink)">${esc(num(latestWeight.kg, 1))} kg</b> · ${esc(dateText(latestWeight.date))}</p>` : '<p class="sub">还没有体重记录。</p>'}
        ${nutrition.weightSeries.length >= 2 ? chartSvg(nutrition.weightSeries.map((p) => ({ date: p.date, value: p.kg })), 'kg') : '<p class="sub">至少两次记录后才画线。</p>'}
        <p class="sub">体重只按时间排列，不按机构分组；变化是否需要注意，由医生/营养师判断。</p>
      </section>
      <section class="card">
        <h2>需要提前联系医院的情况</h2>
        <div class="notice"><strong>这不是分诊建议。</strong>如果出现持续呕吐、腹胀明显加重、停止排气排便、无法进水，按医院给你的紧急联系方式处理；不要只在本台记录后等待。</div>
        <p class="sub" style="margin-top:10px">具体措辞与阈值【待核】，需临床审核后再定稿。</p>
      </section>
    </div>

    <section class="card" style="margin-top:14px">
      <h2>症状记录</h2>
      ${symptoms.length ? `<ul class="timeline">${symptoms.map((s) => `<li>
        <div class="when">${esc(dateText(s.occurredOn))}</div>
        <div class="what">${esc(s.symptomText)} ${severity(s.severityNum)}</div>
        <div class="detail">${[s.durationText, s.contextText].filter(Boolean).map(esc).join(' · ') || '时长/情境未记录'}</div>
        ${s.noteText ? `<div class="detail">${esc(s.noteText)}</div>` : ''}
      </li>`).join('')}</ul>` : emptyState('还没有症状记录', '可以记下发生日期、持续多久、当时在做什么，以及你自己给的不适程度。')}
    </section>

    <section class="card" style="margin-top:14px">
      <h2>进食与补充剂</h2>
      ${nutrition.records.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>日期</th><th>体重</th><th>进食</th><th>补充剂</th><th>备注</th></tr></thead>
        <tbody>${nutrition.records.map((n) => `<tr>
          <td class="num">${esc(dateText(n.measuredOn))}</td>
          <td class="num">${esc(num(n.weightKg, 1))} kg</td>
          <td>${esc(text(n.intakeText))}</td>
          <td>${esc(text(n.supplementsText))}</td>
          <td>${esc(text(n.noteText, '—'))}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : emptyState('还没有营养记录', '体重、进食方式与补充剂都可以按日期记。')}
    </section>`;
}

function severity(value) {
  if (value === null || value === undefined) return '<span class="sub">未自评</span>';
  const filled = Math.round(Number(value) / 2);
  return `<span class="sev" aria-label="自评不适程度 ${esc(value)} 分，满分 10 分"><span class="sev-bars">${
    Array.from({ length: 5 }, (_, i) => `<i class="${i < filled ? (Number(value) >= 6 ? 'on high' : 'on') : ''}"></i>`).join('')
  }</span>${esc(value)}/10</span>`;
}

/* ---------------- 随访 ---------------- */

async function followupPage(fresh) {
  const followups = await read('followups', { fresh });
  const upcoming = followups.filter((f) => String(f.statusText || '').includes('待'));
  const past = followups.filter((f) => !String(f.statusText || '').includes('待'));
  return `
    ${pageHead('随访', '只记录医生已经安排的复诊与检查；本台不推算下次时间。')}
    <div class="grid two">
      <section class="card">
        <h2>待复诊</h2>
        ${upcoming.length ? `<ul class="timeline">${upcoming.map((f) => `<li>
          <div class="when">${esc(dateText(f.plannedOn))}</div>
          <div class="what">${esc(text(f.kindText))}</div>
          <div class="detail">${esc(text(f.statusText))} · ${esc(text(f.hospitalText, '机构未记录'))}</div>
          ${f.noteText ? `<div class="detail">${esc(f.noteText)}</div>` : ''}
        </li>`).join('')}</ul>` : emptyState('没有待复诊记录', '如果医生已经安排了复查，可以记在「随访」里。')}
      </section>
      <section class="card">
        <h2>已完成</h2>
        ${past.length ? `<ul class="list">${past.map((f) => `<li>
          <div class="row"><b>${esc(text(f.kindText))}</b><span class="sub">${esc(dateText(f.plannedOn))}</span></div>
          <div class="note">${esc(text(f.statusText))} · ${esc(text(f.hospitalText, '机构未记录'))}${f.noteText ? ' · ' + esc(f.noteText) : ''}</div>
        </li>`).join('')}</ul>` : emptyState('还没有已完成记录', '复诊或检查完成后可以在这里留痕。')}
      </section>
    </div>
    <section class="card" style="margin-top:14px">
      <h2>复诊材料清单</h2>
      <ul class="list">
        <li><div class="row"><b>病理报告与分子检测</b><span class="sub">原件或复印件</span></div><div class="note">切缘、淋巴结、MSI/dMMR、HER2、NTRK、BRAF 等。</div></li>
        <li><div class="row"><b>最近一次影像</b><span class="sub">报告 + 片子/光盘</span></div><div class="note">CT / MRI / PET-CT / 小肠镜。</div></li>
        <li><div class="row"><b>当前用药清单</b><span class="sub">含剂量与频次</span></div><div class="note">处方药、非处方药、补充剂都算。</div></li>
        <li><div class="row"><b>想问的问题</b><span class="sub">按优先级排序</span></div><div class="note">在「档案」页记录，打印时一起带走。</div></li>
      </ul>
    </section>`;
}

/* ---------------- 试验（35 号四段链路：匹配 / 检索 / 收藏与跟踪） ---------------- */

/* 沙箱/测试环境无 document.body：惰性挂载，取不到就空操作 */
let drawerRoot = null;
function drawerRootEl() {
  if (!drawerRoot && typeof document !== 'undefined' && document.createElement && document.body) {
    drawerRoot = document.createElement('div');
    document.body.appendChild(drawerRoot);
  }
  return drawerRoot;
}

function findTrial(key) { return (state.boot?.trials || []).find((t) => t.trialKey === key); }

function matchRows(p) {
  const rows = (state.boot?.trials || []).map((t) => ({
    trial: t,
    result: window.calcTrialMatch ? window.calcTrialMatch(p, t, {}) : { pct: null, matched: 0, compared: 0, pending: 0, tier: '需补充信息', criteria: [] },
  }));
  const order = { '字段都对得上': 0, '部分对得上': 1, '需补充信息': 2, '硬性条件不满足': 3 };
  rows.sort((a, b) => (order[a.result.tier] !== order[b.result.tier] ? order[a.result.tier] - order[b.result.tier] : (b.result.pct || -1) - (a.result.pct || -1)));
  return rows;
}

function poolHead(snap, returned) {
  const recordCount = snap.recordCount == null ? '—' : snap.recordCount;
  return `<div class="pool-head"><span>已载 <b>${recordCount}</b> 条快照</span><span>本次返回 <b>${returned}</b> 条</span><span>不是全库扫描</span><span>快照 <b>${esc(snap.snapshotDate || '未标注')}</b></span>` +
    `<span>相关 ${snap.relevant == null ? '—' : snap.relevant} 条</span><span class="muted">相关 0 也不等于“没有研究”：检索词命中才进池，通道召回有限。</span></div>`;
}

function trialFacts(p) {
  const facts = [
    { label: '病理类型', value: p.histologyText, source: '档案 · 病理类型' },
    { label: '原发部位', value: p.primarySiteText, source: '档案 · 原发部位' },
    { label: '分期（医生原文）', value: p.stageText, source: '档案 · 诊断' },
    { label: '分子检测（病理报告）', value: p.molecularText, source: '档案 · 病理报告' },
    { label: '出生年', value: p.birthYear ? String(p.birthYear) : '', source: '档案 · 出生年' },
  ];
  return `<section class="card"><div class="section-title"><h2>已确认的档案字段</h2></div><div class="fact-grid">` +
    facts.map((f) => `<div class="fact ${f.value ? '' : 'pending'}"><div class="k">${esc(f.label)}${f.value ? '' : ' · 待确认'}</div><div class="v">${esc(f.value || '未填')}</div><div class="tiny muted">${esc(f.source)}</div></div>`).join('') +
    `</div><p class="sub" style="margin-top:10px">未确认字段不参与匹配；药物靶点不进分母。可对照项少于 2 项时不给百分数。</p></section>`;
}

function matchCard(t, r) {
  const criteria = (r.criteria || []).slice().sort((a, b) => ({ no: 0, unknown: 1, yes: 2 }[a.state] - { no: 0, unknown: 1, yes: 2 }[b.state]));
  const shown = criteria.slice(0, 4);
  const score = r.pct == null
    ? '<div class="score needs"><b>需补充<br>信息</b><span>可对照 &lt; 2 项</span></div>'
    : '<div class="score"><b>' + r.pct + '%</b><span>登记字段<br>符合度</span></div>';
  return `<article class="trial-card" data-trial="${esc(t.trialKey)}">${score}` +
    `<div class="trial-main"><h3>${esc(t.title)}</h3>` +
    `<div class="trial-meta"><span>${esc(t.registry)}</span><span>${esc(t.phase)}</span><span>${esc(t.status)}</span><span>${esc(t.sponsor)}</span><span>${esc((t.countries || []).join(' / ') || '地区未标注')}</span></div>` +
    `<div class="denominator">${r.matched} / ${r.compared} 项对得上 · ${r.pending} 项待确认</div>` +
    `<div class="criteria">${shown.map(criterionHtml).join('')}</div>` +
    `<div class="trial-foot"><span class="disclaimer">不是入组资格，也不代表效果。</span>` +
    `<button class="text-btn" data-action="trial-detail" data-key="${esc(t.trialKey)}">看证据链</button>` +
    `<button class="text-btn" data-action="save-trial" data-key="${esc(t.trialKey)}">收藏</button></div>` +
    `</div></article>`;
}

function criterionHtml(c) {
  const mark = c.state === 'yes' ? '✓' : c.state === 'no' ? '✕' : '?';
  return `<div class="criterion ${esc(c.state)}"><span class="state">${mark}</span><div><b>${esc(c.label)}</b> ` +
    `<span class="why">记录里是：${esc(c.recordText)}（${esc(c.source || '未标注')}） · 条件要求：${esc(c.requirement)}</span></div></div>`;
}

async function trialsPage(fresh) {
  const saved = await read('trials', { fresh });
  const snap = state.boot?.trialSnapshot || {};
  const snapEmpty = !snap.recordCount;
  const head = `<div class="tabs" role="tablist">` +
    [['match', '匹配'], ['search', '检索'], ['saved', '收藏与跟踪']].map((t) =>
      `<button type="button" role="tab" data-trial-tab="${t[0]}" aria-selected="${state.trialTab === t[0]}">${t[1]}</button>`).join('') + `</div>`;
  const emptySnap = `<div class="notice"><strong>本机未建立试验快照。</strong>不返回未经核对的结果；快照由 M4 采集脚本生成（scripts/fetch-small-bowel-trials-2026.mjs）。</div>`;
  if (state.trialTab === 'match') {
    if (snapEmpty) return pageHead('临床试验', '先看分母，再看线索。') + head + emptySnap + trialFacts(state.boot.profile || {}) + await librarySection();
    const rows = matchRows(state.boot.profile || {});
    return pageHead('临床试验', '先看分母，再看线索。', '登记信息不是入组资格；只做字段对照。') + head + trialFacts(state.boot.profile || {}) + poolHead(snap, rows.length) +
      `<div class="section-title"><h2>候选线索</h2></div>` +
      (rows.length ? rows.map((row) => matchCard(row.trial, row.result)).join('') : emptyState('本轮没有候选记录', '不是“没有研究”。通道终态与快照日期见上方口径。')) +
      `<div class="notice calm">登记状态，未核实；登记 ≠ 有效 ≠ 安全 ≠ 可入组。快照会过期，入排原文请到官方登记页核对；是否参加，<b>这一句需要问你的医生</b>。</div>` + await librarySection();
  }
  if (state.trialTab === 'search') {
    if (snapEmpty) return pageHead('临床试验', '按条件检索登记。') + head + emptySnap + await librarySection();
    return pageHead('临床试验', '按条件检索登记。') + head + poolHead(snap, (state.boot.trials || []).length) + trialSearchForm() + trialSearchResults() + await librarySection();
  }
  const base = pageHead('临床试验', '我留下的线索。') + head + trialSavedPage(saved, snap);
  return base + await librarySection();
}

/* 本机临床库（M4）：范围与记录口径，待临床审核；与试验线分列，不混充试验条数。 */
async function librarySection() {
  const library = await api('/library').catch(() => ({ entries: [], sources: [], note: '本机临床库未读取。' }));
  return `
    <section class="card" style="margin-top:14px">
      <h2>本机临床库</h2>
      <p class="sub">${esc(library.note || '只含范围与记录口径，待临床审核。')} 快照：${esc(library.snapshotDate || '未记录')} · ${esc(String(library.counts?.entries ?? library.entries?.length ?? 0))} 条。</p>
      ${library.entries?.length ? `<div class="lib-grid" style="margin-top:10px">${library.entries.map((e) => `
        <article class="lib-item">
          <h3>${esc(e.title)}</h3>
          <p>${esc(e.summaryText)}</p>
          <div class="caution">${esc(e.cautionText || '')}</div>
          <div style="margin-top:6px"><span class="pill off">待临床审核</span> <span class="sub">${esc(e.category)}</span></div>
        </article>`).join('')}</div>` : emptyState('本机临床库为空', '未取得条目时会如实显示为空。')}
      ${library.sources?.length ? `<div class="table-wrap" style="margin-top:12px"><table class="table status-table">
        <thead><tr><th>来源</th><th>终态</th><th>说明</th></tr></thead>
        <tbody>${library.sources.map((s) => `<tr>
          <td><b>${esc(s.label)}</b></td><td><span class="pill ${s.state === 'OK' ? 'live' : 'off'}">${esc(s.state)}</span></td>
          <td>${esc(s.detail)}</td></tr>`).join('')}</tbody>
      </table></div>` : ''}
    </section>`;
}

function trialSearchForm() {
  const f = state.trialFilters;
  return `<form id="trial-search-form" class="trial-controls card" aria-label="检索条件">` +
    `<div class="field"><label for="t-keyword">关键词 / 登记号</label><input class="profile-select" id="t-keyword" name="keyword" value="${esc(f.keyword || '')}" placeholder="例如：化疗、NCT 开头编号"></div>` +
    `<div class="field"><label for="t-status">状态</label><select class="profile-select" id="t-status" name="status"><option value="">全部</option>` +
      ['Recruiting', 'Active', 'Completed', 'Enrolling by invitation'].map((s) => `<option${f.status === s ? ' selected' : ''}>${s}</option>`).join('') + `</select></div>` +
    `<div class="field"><label for="t-phase">阶段</label><select class="profile-select" id="t-phase" name="phase"><option value="">全部</option>` +
      ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'].map((s) => `<option${f.phase === s ? ' selected' : ''}>${s}</option>`).join('') + `</select></div>` +
    `<div class="field"><label for="t-country">地区</label><select class="profile-select" id="t-country" name="country"><option value="">全部</option>` +
      ['China', 'United States', 'Japan', 'Korea'].map((s) => `<option${f.country === s ? ' selected' : ''}>${s}</option>`).join('') + `</select></div>` +
    `<div class="field" style="grid-column:1/-1;display:flex;gap:8px;align-items:center"><button class="text-btn" type="submit">按条件检索</button><button class="text-btn" type="button" data-action="clear-search">清空条件</button><span class="sub">按条件排，不掺分数</span></div>` +
    `</form>`;
}

function trialSearchResults() {
  const f = state.trialFilters;
  const keyword = String(f.keyword || '').toLowerCase().trim();
  const rows = (state.boot?.trials || []).filter((t) => {
    const hay = [t.title, t.registry, (t.conditions || []).join(' '), t.sponsor, (t.countries || []).join(' ')].join(' ').toLowerCase();
    if (keyword && hay.indexOf(keyword) < 0) return false;
    if (f.status && String(t.status || '').toLowerCase().indexOf(f.status.toLowerCase()) < 0) return false;
    if (f.phase && String(t.phase || '').toLowerCase().indexOf(f.phase.toLowerCase()) < 0) return false;
    if (f.country && (t.countries || []).join(' ').toLowerCase().indexOf(f.country.toLowerCase()) < 0) return false;
    return true;
  });
  return `<div class="search-row"><span>返回 ${rows.length} 条</span><span>只按条件筛选；没有排序分</span></div>` +
    `<div class="trial-list">` + (rows.length ? rows.map((t) =>
      `<div class="trial-hit"><div><h3>${esc(t.title)}</h3><div class="trial-meta"><span>${esc(t.registry)}</span><span>${esc(t.phase)}</span><span>${esc(t.status)}</span><span>${esc((t.countries || []).join(' / '))}</span></div></div>` +
      `<button class="text-btn" data-action="trial-detail" data-key="${esc(t.trialKey)}">详情</button></div>`).join('')
      : emptyState('没有命中', '清空条件重试；检索词命中才进池，不等于没有研究。')) + `</div>` +
    `<div class="notice calm">检索页不显示分数、百分比或排名。匹配只在“匹配”子页按已确认字段对照。</div>`;
}

function trialSavedPage(saved, snap) {
  return poolHead(snap, saved.length) +
    `<div class="section-title"><h2>我留下的线索</h2></div>` +
    (saved.length ? `<div class="saved-grid">` + saved.map((s) => {
      const t = findTrial(s.registryId) || null;
      return `<div class="saved-row"><div><h3>${esc(s.titleText || (t ? t.title : s.registryId))}</h3><div class="trial-meta">${esc(t ? t.registry + ' · ' + t.phase + ' · ' + t.status : (s.registryId || '登记号未填') + ' · 快照中没有这条（可能已过期）')} · 收藏于 ${esc(s.savedOn || '未标注')}</div></div>` +
        `<div class="saved-controls">` + [['in_followup', '在跟'], ['preparing', '准备问'], ['archived', '已归档']].map((x) =>
          `<button class="text-btn tiny ${s.state === x[0] ? 'primary' : ''}" data-action="save-state" data-id="${esc(s.id)}" data-state="${x[0]}">${x[1]}</button>`).join('') + `</div></div>`;
    }).join('') + `</div>` : emptyState('还没有收藏', '在匹配或检索里看到想留的线索，点“收藏”。收藏只记本机，不等于报名。')) +
    `<div class="notice calm">快照没有登记状态变化时间线，所以这里不画进度条。状态是“在跟 / 准备问 / 已归档”的手工标记。</div>`;
}

function renderTrialDrawer() {
  const root = drawerRootEl();
  if (!root) return;
  if (!state.trialDetail) { root.innerHTML = ''; return; }
  const t = findTrial(state.trialDetail);
  if (!t) { root.innerHTML = ''; return; }
  const result = window.calcTrialMatch ? window.calcTrialMatch(state.boot?.profile || {}, t, {}) : { criteria: [], matched: 0, compared: 0, pending: 0, pct: null, tier: '需补充信息' };
  const criteria = (result.criteria || []).slice().sort((a, b) => ({ no: 0, unknown: 1, yes: 2 }[a.state] - { no: 0, unknown: 1, yes: 2 }[b.state]));
  root.innerHTML = `<div class="drawer-scrim" data-close-drawer="1"></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="td-title">` +
    `<div class="drawer-head"><h2 id="td-title">${esc(t.title)}</h2><button class="close" data-close-drawer="1" aria-label="关闭详情">✕</button></div>` +
    `<div class="trial-meta"><span>${esc(t.registry)}</span><span>${esc(t.phase)}</span><span>${esc(t.status)}</span><span>${esc(t.sponsor)}</span></div>` +
    `<p class="denominator">${result.matched} / ${result.compared} 项对得上 · ${result.pending} 项待确认 ${result.pct == null ? '· 可对照项不足 2，不给百分数' : '· 登记字段符合度 ' + result.pct + '%'}</p>` +
    `<div class="notice calm">不是入组资格，也不代表效果。以下是登记字段与档案字段的逐条对照；入排原文请到官方登记页核对。</div>` +
    `<h3>证据链</h3>` + (criteria.length ? criteria.map(criterionHtml).join('') : '<p>没有可对照字段。</p>') +
    `<h3>登记信息</h3><p>${esc(t.summary || '本机快照只存登记的结构化字段，入排标准请到官方登记页核对。')}</p>` +
    `<p class="sub">条件要求来自登记摘要与入排原文；记录里是的值来自档案。${esc(t.snapshotDate || '')} 快照。</p>` +
    (t.sourceUrl ? `<a class="source-link" href="${esc(t.sourceUrl)}" target="_blank" rel="noopener noreferrer" data-open-external="${esc(t.sourceUrl)}">打开官方登记页 ↗</a>` : '<p class="sub">本机快照没有官方链接；请按登记号自行检索。</p>') +
    `<div class="trial-foot" style="margin-top:18px"><button class="text-btn" data-action="save-trial" data-key="${esc(t.trialKey)}">收藏这条线索</button></div>` +
    `</aside>`;
  setTimeout(() => { const b = drawerRoot.querySelector('.drawer .close'); if (b) b.focus(); }, 0);
}

async function saveTrial(key) {
  const t = findTrial(key);
  if (!t) return;
  try {
    await api('/entries', { method: 'POST', body: { profileKey: state.profileKey, kind: 'trials', data: {
      registryId: t.registry, titleText: t.title, statusText: t.status, eligibilityText: (t.eligibilityText || '').slice(0, 800),
      siteText: (t.countries || []).join(' / '), urlText: t.sourceUrl || '', savedOn: new Date().toISOString().slice(0, 10), state: 'in_followup',
    } } });
    state.cache.clear();
    render();
    renderTrialDrawer();
  } catch (error) { alert('收藏失败：' + error.message); }
}

async function setTrialState(id, trialState) {
  try {
    await api('/trials/state', { method: 'POST', body: { profileKey: state.profileKey, id: Number(id), state: trialState } });
    state.cache.clear();
    render();
  } catch (error) { alert('状态更新失败：' + error.message); }
}

/* ---------------- 资料 ---------------- */

async function documentsPage(fresh) {
  const documents = await read('documents', { fresh });
  const channel = state.boot.channels?.documents || {};
  const root = state.boot.dataRoot || {};
  return `
    ${pageHead('资料', '原始报告只在本机登记；本台不解包、不上传。')}
    <div class="notice calm"><strong>解析状态：</strong>${esc(channel.label || '文档解析未接通')}。当前只记录文件名、类型、来源路径与校验值。</div>
    <section class="card" style="margin-top:14px">
      <h2>本机资料目录</h2>
      <p class="sub">当前：${esc(root.dir || '未配置（演示内存库）')}${root.ok ? '' : ' · ' + esc(root.reason || '不可写')}</p>
      <form data-root-form style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <input class="profile-select" name="dir" style="max-width:520px;flex:1" placeholder="/Users/you/Documents/sba-records" aria-label="资料目录路径">
        <button class="text-btn" type="submit">保存资料目录</button>
      </form>
      <p class="sub">拒绝主目录、桌面、下载与临时目录；目录必须由你明确指定。</p>
    </section>
    <section class="card" style="margin-top:14px">
      <h2>文档清单</h2>
      ${documents.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>标题</th><th>类型</th><th>加入日期</th><th>来源路径</th><th>解析</th><th>隐私</th></tr></thead>
        <tbody>${documents.map((d) => `<tr>
          <td><b>${esc(d.titleText)}</b></td>
          <td>${esc(text(d.docTypeText))}</td>
          <td class="num">${esc(dateText(d.addedOn))}</td>
          <td><span class="sub" style="overflow-wrap:anywhere">${esc(text(d.sourcePathText))}</span></td>
          <td>${esc(text(d.parseStatusText))}</td>
          <td>${privacyPill(d.isPrivate)} ${privacyButton('documents', d.id, d.isPrivate)}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : emptyState('还没有文档', '病理、影像、手术记录与基因检测报告都可以登记。')}
    </section>
    <section class="card" style="margin-top:14px">
      <h2>隐私</h2>
      <p>标记为私密的记录不会出现在「今天」摘要、导出文件和 AI 上下文中；逐条切换入口在各记录卡上。当前演示档案全部为公开示例。</p>
    </section>`;
}

/* ---------------- 事件 ---------------- */

document.addEventListener('click', async (event) => {
  const pageBtn = event.target.closest('[data-page]');
  if (pageBtn) {
    const next = pageBtn.dataset.page;
    if (next === state.page) return;
    state.flash = '';
    state.page = next;
    history.replaceState(null, '', '#' + next);
    renderPage();
    document.getElementById('page')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (event.target.closest('[data-print]')) { window.print(); return; }

  if (event.target.closest('[data-open-entry]')) { openEntryDialog(); return; }

  if (event.target.closest('[data-export]')) { exportProfile(); return; }

  if (event.target.closest('[data-open-profile]')) { openProfileDialog(); return; }

  const trialTab = event.target.closest('[data-trial-tab]');
  if (trialTab) { state.trialTab = trialTab.getAttribute('data-trial-tab'); render(); return; }

  const trialDetail = event.target.closest('[data-action="trial-detail"]');
  if (trialDetail) { state.trialDetail = trialDetail.getAttribute('data-key'); renderTrialDrawer(); return; }

  const saveTrialBtn = event.target.closest('[data-action="save-trial"]');
  if (saveTrialBtn) { saveTrial(saveTrialBtn.getAttribute('data-key')); return; }

  const saveStateBtn = event.target.closest('[data-action="save-state"]');
  if (saveStateBtn) { setTrialState(saveStateBtn.getAttribute('data-id'), saveStateBtn.getAttribute('data-state')); return; }

  if (event.target.closest('[data-action="clear-search"]')) { state.trialFilters = {}; render(); return; }

  if (event.target.closest('[data-close-drawer]')) { state.trialDetail = null; renderTrialDrawer(); return; }

  // 官方登记页：沙箱 iframe 里 target=_blank 可能被静默拦截——window.open 返回空就请外壳代开
  const external = event.target.closest('[data-open-external]');
  if (external) {
    const url = external.getAttribute('data-open-external');
    if (/^https?:\/\//i.test(url)) {
      event.preventDefault();
      const opened = window.open(url, '_blank', 'noopener');
      if (!opened && window.parent !== window) {
        try { window.parent.postMessage({ type: 'sba:open-external', url }, location.origin); } catch { /* 跨源兜底失败时保持原跳转 */ }
      }
    }
    return;
  }

  if (event.target.closest('.drawer-scrim')) { state.trialDetail = null; renderTrialDrawer(); return; }

  if (event.target.closest('[data-close-entry]')) { document.getElementById('entry-dialog')?.close(); return; }

  if (event.target.closest('[data-close-profile]')) { document.getElementById('profile-dialog')?.close(); return; }

  const privacy = event.target.closest('[data-privacy-kind]');
  if (privacy) {
    const kind = privacy.dataset.privacyKind;
    const id = Number(privacy.dataset.privacyId);
    const wasPrivate = privacy.dataset.privacyValue === '1';
    try {
      await api('/privacy', {
        method: 'POST',
        body: { profileKey: state.profileKey, kind, id, isPrivate: !wasPrivate },
      });
      state.cache.clear();
      state.flash = wasPrivate ? '已设为公开记录。' : '已设为私密：摘要、导出与 AI 上下文都会过滤。';
      await loadBoot(state.profileKey);
    } catch (error) {
      state.flash = '隐私切换失败：' + (error.message || error);
      render();
    }
    return;
  }

  if (event.target.closest('[data-delete-profile]')) {
    if (!window.confirm('删除当前本机档案？该操作只删除本机数据库里的这份档案，演示档案不可删除。')) return;
    try {
      await api(`/subjects?profileKey=${encodeURIComponent(state.profileKey)}`, { method: 'DELETE' });
      state.cache.clear();
      state.flash = '当前本机档案已删除。';
      await loadBoot();
    } catch (error) {
      state.flash = '删除失败：' + (error.message || error);
      render();
    }
    return;
  }

  if (event.target.closest('[data-retry-boot]')) { loadBoot(); return; }

  const retry = event.target.closest('[data-retry]');
  if (retry) { renderPage({ fresh: true }); return; }

  if (event.target.closest('[data-primer]')) {
    const dialog = document.getElementById('primer-dialog');
    document.getElementById('primer-body').innerHTML = window.SBA_PRIMER || '<p>疾病概要未加载。</p>';
    if (dialog && !dialog.open) dialog.showModal();
    return;
  }

  if (event.target.closest('[data-close-primer]')) {
    document.getElementById('primer-dialog')?.close();
  }
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'entry-kind') {
    renderEntryFields(event.target.value);
    return;
  }
  if (event.target.id === 'profile-select') {
    state.flash = '';
    state.profileKey = event.target.value;
    state.cache.clear();
    loadBoot(state.profileKey);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.trialDetail) { state.trialDetail = null; renderTrialDrawer(); }
});

document.addEventListener('submit', async (event) => {
  if (event.target.id === 'trial-search-form') {
    event.preventDefault();
    const fd = new FormData(event.target);
    state.trialFilters = { keyword: fd.get('keyword') || '', status: fd.get('status') || '', phase: fd.get('phase') || '', country: fd.get('country') || '' };
    render();
    return;
  }

  const entryForm = event.target.closest('#entry-form');
  if (entryForm) {
    event.preventDefault();
    const kind = document.getElementById('entry-kind').value;
    const config = ENTRY_KINDS.find((item) => item.kind === kind);
    if (!config) return;
    const data = {};
    for (const [name, , type] of config.fields) {
      const field = entryForm.elements[name];
      const raw = field ? String(field.value || '').trim() : '';
      if (raw === '') continue;
      data[name] = type === 'number' ? Number(raw) : raw;
    }
    data.isPrivate = Boolean(document.getElementById('entry-private').checked);
    const submit = entryForm.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      await api('/entries', { method: 'POST', body: { profileKey: state.profileKey, kind, data } });
      entryForm.reset();
      document.getElementById('entry-dialog')?.close();
      state.cache.clear();
      state.flash = '已保存到本机；可回到对应页面核对。';
      await loadBoot(state.profileKey);
    } catch (error) {
      state.flash = '保存失败：' + (error.message || error);
      render();
    } finally {
      if (submit) submit.disabled = false;
    }
    return;
  }

  const profileForm = event.target.closest('#profile-form');
  if (profileForm) {
    event.preventDefault();
    const formData = new FormData(profileForm);
    const payload = {};
    for (const [key, value] of formData.entries()) {
      const trimmed = String(value || '').trim();
      if (trimmed) payload[key] = trimmed;
    }
    try {
      const created = await api('/subjects', { method: 'POST', body: payload });
      profileForm.reset();
      document.getElementById('profile-dialog')?.close();
      state.cache.clear();
      state.flash = '本机档案已创建；资料目录仍然是当前配置的目录。';
      await loadBoot(created.profileKey);
    } catch (error) {
      state.flash = '创建档案失败：' + (error.message || error);
      render();
    }
    return;
  }

  const rootForm = event.target.closest('[data-root-form]');
  if (rootForm) {
    event.preventDefault();
    const dir = String(new FormData(rootForm).get('dir') || '').trim();
    try {
      await api('/root', { method: 'POST', body: { dir } });
      state.cache.clear();
      state.flash = '资料目录已切换；原有档案请在新目录重新建立或用演示档案核对结构。';
      await loadBoot();
    } catch (error) {
      state.flash = '资料目录未保存：' + (error.message || error);
      render();
    }
  }
});

window.addEventListener('hashchange', () => {
  const next = pageFromHash();
  if (next === state.page) return;
  state.page = next;
  renderPage();
});

loadBoot();

/* 宿主/Agent 只读桥：只暴露页面切换与只读状态，不提供写入或隐私绕过。 */
window.__SBA_BRIDGE__ = Object.freeze({
  version: VERSION,
  get page() { return state.page; },
  get profileKey() { return state.profileKey; },
  get counts() { return state.boot ? state.boot.counts : null; },
  openPage(id) {
    if (!PAGES.some((p) => p.id === id)) return false;
    state.page = id;
    history.replaceState(null, '', '#' + id);
    setNav();
    renderPage();
    return true;
  },
  refresh() { return renderPage({ fresh: true }); },
});
