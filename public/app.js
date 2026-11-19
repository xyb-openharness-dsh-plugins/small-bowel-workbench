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
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">小</div>
          <div class="brand-text">
            <div class="brand-title">小肠宝 SmallBowelPal</div>
            <div class="brand-sub">小肠腺癌患者工作台 · 本机优先</div>
          </div>
        </div>
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

/* ---------------- 试验 ---------------- */

async function trialsPage(fresh) {
  const [trials, library] = await Promise.all([
    read('trials', { fresh }),
    api('/library').catch(() => ({ entries: [], sources: [], note: '本机临床库未读取。' })),
  ]);
  const channel = state.boot.channels?.trials || {};
  return `
    ${pageHead('临床试验', '收藏你看到的试验；本台不判断是否符合入组条件。')}
    <div class="notice"><strong>检索通道：${esc(channel.status || '未接通')}。</strong>${esc(channel.label || '本次未联网，未建立快照。')} 因此这里不显示条数，也不生成匹配结论。</div>
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
    </section>
    <section class="card" style="margin-top:14px">
      <h2>收藏的试验</h2>
      ${trials.length ? trials.map((t) => `<div style="padding:11px 0;border-bottom:1px solid var(--line)">
        <div class="lab-head"><h3>${esc(text(t.titleText))}</h3><span class="sub">${esc(dateText(t.savedOn))}</span></div>
        <dl class="kv">
          <dt>登记号</dt><dd>${esc(text(t.registryId))}</dd>
          <dt>状态（原文）</dt><dd>${esc(text(t.statusText))}</dd>
          <dt>入组条件（原文）</dt><dd>${esc(text(t.eligibilityText))}</dd>
          <dt>中心</dt><dd>${esc(text(t.siteText))}</dd>
        </dl>
        ${t.noteText ? `<p class="sub">${esc(t.noteText)}</p>` : ''}
        <div style="margin-top:6px">${privacyPill(t.isPrivate)} ${privacyButton('trials', t.id, t.isPrivate)}</div>
      </div>`).join('') : emptyState('还没有收藏的试验', 'M6 接通检索后，可以把看到的试验收藏到这里。')}
    </section>`;
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

document.addEventListener('submit', async (event) => {
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
