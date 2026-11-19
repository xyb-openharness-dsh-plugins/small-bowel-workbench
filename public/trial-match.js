/* 小肠宝 · 临床试验粗筛（35 号 §二/§七：语义四规则 + 落地五条）
   只读档案已确认字段与快照真实字段。pct = 符合 ÷ 已对照；待确认按 0 计（只会偏低）；
   可对照 <2 不给百分数；药物靶点不进分母；反向条件显式反转、两侧词表同源。
   这不是入组资格，也不代表效果；证据链每条都能回溯到记录或登记原文。快照会过期。 */
(function (global) {
  'use strict';
  var TIER = { perfect: '字段都对得上', partial: '部分对得上', needs: '需补充信息', hard: '硬性条件不满足' };

  function norm(v) { return String(v == null ? '' : v).toLowerCase(); }
  function trialText(t) { return norm([t.eligibilityText, (t.conditions || []).join(' '), t.title, t.summary].join(' ')); }
  function conditionText(t) { return norm((t.conditions || []).join(' ')); }

  function calcTrialMatch(profile, trial) {
    var criteria = [];
    var text = trialText(trial);
    var cond = conditionText(trial);

    /* 1 病理类型 / 疾病范围（判据只来自快照真实字段：conditions + 标题）。
       反向词表同源：NET / 神经内分泌 / 淋巴瘤 / 肉瘤 不是腺癌。 */
    var histology = norm(profile.histologyText);
    var isAdeno = histology ? /腺癌|adenocarcinoma/.test(histology) : null;
    var trialSba = /small bowel|small intestine|small intestin|小肠/.test(cond) || /small bowel|small intestine/.test(text);
    var trialAdeno = /adenocarcinoma|腺癌/.test(cond) || !/neuroendocrine|carcinoid|lymphoma|sarcoma|gist|间质瘤/.test(cond);
    if (histology) {
      criteria.push({
        key: 'histology', cat: '诊断', hard: true, label: '病理类型：小肠腺癌',
        state: isAdeno && trialSba && trialAdeno ? 'yes' : (!isAdeno ? 'no' : (trialSba ? 'yes' : 'unknown')),
        recordText: profile.histologyText, source: '档案 · 病理类型',
        requirement: (trial.conditions || []).join(' / ') || '登记条件未列出病理类型；需核方案原文',
      });
    } else {
      criteria.push({ key: 'histology', cat: '诊断', hard: true, label: '病理类型：小肠腺癌', state: 'unknown', recordText: '未记录', source: '档案缺字段', requirement: (trial.conditions || []).join(' / ') || '需核方案原文' });
    }

    /* 2 疾病阶段：转移性 / 晚期试验（登记写明才对照；档案侧只认医生原文分期） */
    if (/metastatic|advanced|unresectable|晚期|转移|进展/.test(text)) {
      var stage = norm(profile.stageText);
      criteria.push({
        key: 'stage', cat: '疾病阶段', hard: true, label: '晚期 / 转移性',
        state: stage ? (/iv|4期|转移|晚期|metastatic|advanced/.test(stage) ? 'yes' : 'no') : 'unknown',
        recordText: profile.stageText || '未记录', source: '档案 · 诊断分期',
        requirement: '登记写明转移性 / 晚期 / 不可切除；具体以方案原文为准',
      });
    }

    /* 3 原发部位亚限制（十二指肠 / 空回肠）：登记限定才对照 */
    var siteLimit = null;
    if (/duoden/i.test(text)) siteLimit = '十二指肠';
    else if (/ileum|ileal/i.test(text)) siteLimit = '回肠';
    else if (/jejun/i.test(text)) siteLimit = '空肠';
    if (siteLimit) {
      var site = norm(profile.primarySiteText);
      criteria.push({
        key: 'site', cat: '诊断', hard: true, label: '原发部位：' + siteLimit,
        state: site ? (norm(siteLimit).split('').some(function () { return false; }) || site.indexOf(siteLimit.toLowerCase()) >= 0 || (siteLimit === '十二指肠' && /duoden|十二指肠/.test(site)) || (siteLimit === '回肠' && /ileum|ileal|回肠/.test(site)) || (siteLimit === '空肠' && /jejun|空肠/.test(site)) ? 'yes' : 'no') : 'unknown',
        recordText: profile.primarySiteText || '未记录', source: '档案 · 原发部位',
        requirement: '登记限定原发部位 ' + siteLimit + '；需核方案原文',
      });
    }

    /* 4 年龄 ≥ 18（登记写明才对照；出生年算年龄，缺出生年=待确认） */
    if (/age|year of age|≥\s*18|18 years/.test(text)) {
      var age = profile.birthYear ? 2026 - Number(profile.birthYear) : null;
      criteria.push({
        key: 'age', cat: '年龄', hard: true, label: '年龄 ≥ 18 岁',
        state: age ? (age >= 18 ? 'yes' : 'no') : 'unknown',
        recordText: age ? age + ' 岁（按出生年 ' + profile.birthYear + '）' : '未记录出生年', source: '档案 · 出生年',
        requirement: '登记写入组年龄 ≥ 18 岁',
      });
    }

    /* 5 分子标志物（MSI-H / dMMR / HER2 / RAS / BRAF）：档案分子检测写了才对照；
       反向词表同源：MSS / MSI 稳定 / 野生型 / 阴性 → no。 */
    var markers = [
      { re: /msi[- ]?h|microsatellite instability[- ]high|dmmr|mismatch repair[- ]defici/i, key: 'msi', label: 'MSI-H / dMMR', opp: /mss|msi[- ]?stable|稳|profici|pmmr/i },
      { re: /her2|erbb2/i, key: 'her2', label: 'HER2 阳性', opp: /her2[- ]?negative|erbb2[- ]?negative|野生|阴性|wild/i },
      { re: /braf[^)]*mut|braf V600/i, key: 'braf', label: 'BRAF 突变', opp: /braf[- ]?wild|野生/i },
      { re: /kras|nras[^)]*mut/i, key: 'ras', label: 'RAS 突变', opp: /ras[- ]?wild|野生/i },
    ];
    var molecular = norm(profile.molecularText);
    for (var i = 0; i < markers.length; i++) {
      (function (m) {
        if (!m.re.test(text)) return;
        var state = 'unknown';
        if (molecular) state = m.re.test(molecular) ? 'yes' : (m.opp.test(molecular) ? 'no' : 'unknown');
        criteria.push({
          key: m.key, cat: '分子检测', hard: true, label: m.label,
          state: state,
          recordText: molecular || '未记录', source: molecular ? '档案 · 病理报告分子检测' : '档案缺字段',
          requirement: '登记写明 ' + m.label + '；靶点不进分母的计算口径见 35 号 §七.2，此处为入组条件对照；需核方案原文',
        });
      })(markers[i]);
    }

    /* 6 体能状态：档案没有结构化记录，明确待确认，不猜 */
    if (/ecog|performance status|karnofsky/i.test(text)) {
      criteria.push({ key: 'ecog', cat: '体能状态', hard: false, label: 'ECOG 体能状态', state: 'unknown', recordText: '档案未记录 ECOG', source: '档案缺字段', requirement: '登记写入排要求的 ECOG 范围；需核方案原文' });
    }

    /* 7 既往治疗线数：档案没有结构化记录，待确认 */
    if (/prior (chemother|line)|一线|二线|line of therapy|previously treated/i.test(text)) {
      criteria.push({ key: 'prior_line', cat: '既往治疗', hard: false, label: '既往治疗线数', state: 'unknown', recordText: '档案未结构化记录治疗线数', source: '档案缺字段', requirement: '登记要求既往治疗线数范围；需核方案原文' });
    }

    var matched = criteria.filter(function (c) { return c.state === 'yes'; }).length;
    var compared = criteria.length;
    var pending = criteria.filter(function (c) { return c.state === 'unknown'; }).length;
    var hardNo = criteria.some(function (c) { return c.hard && c.state === 'no'; });
    var pct = compared >= 2 ? Math.round(matched * 100 / compared) : null;
    var tier = hardNo ? TIER.hard : pct == null ? TIER.needs : pct === 100 ? TIER.perfect : pct >= 50 ? TIER.partial : TIER.needs;
    return {
      pct: pct, matched: matched, compared: compared, pending: pending, tier: tier,
      hardNo: hardNo, criteria: criteria,
      note: '不是入组资格，也不代表效果；登记状态未核实；快照会过期。',
    };
  }

  global.calcTrialMatch = calcTrialMatch;
})(window);
