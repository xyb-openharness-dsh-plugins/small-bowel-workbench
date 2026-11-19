/**
 * 工作台服务层：档案、记录写入、隐私、资料目录。
 * 不依赖宿主，可单测；HTTP 层只做路由与认证。
 */
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { openStore, closeStore } from './store.js';
import { fileURLToPath } from 'node:url';
import { checkDataDir } from './data-dir.js';
import { seedDemoData, hasDemoData, DEMO_KEYS } from './demo.js';
import {
  readDiagnoses, readPathology, readLabs, readImaging, readTreatments, readMedications,
  readSymptoms, readNutrition, readFollowups, readDocuments, readSavedTrials, readViewpoints,
  counts, recentActivity, upcomingFollowups,
} from './readmodels.js';
import { DB_FILE } from '../lib/identity.js';
import { version, displayVersion, build as buildDate } from '../lib/version.js';
import { libraryPayload } from './library.js';

const READERS = {
  diagnoses: readDiagnoses,
  pathology: readPathology,
  labs: readLabs,
  imaging: readImaging,
  treatments: readTreatments,
  medications: readMedications,
  symptoms: readSymptoms,
  nutrition: readNutrition,
  followups: readFollowups,
  documents: readDocuments,
  trials: readSavedTrials,
  viewpoints: readViewpoints,
};

const KIND_TABLES = {
  diagnoses: 'diagnoses',
  pathology: 'pathology_reports',
  labs: 'lab_results',
  imaging: 'imaging_events',
  treatments: 'treatments',
  medications: 'medications',
  symptoms: 'symptom_notes',
  nutrition: 'nutrition_records',
  followups: 'followup_plans',
  documents: 'documents',
  trials: 'saved_trials',
  viewpoints: 'viewpoints',
};

/** camelCase → 列名；只允许这里列出的字段进入 SQL。 */
const FIELDS = {
  diagnoses: {
    siteCode: 'site_code', siteText: 'site_text', histologyText: 'histology_text',
    gradeText: 'grade_text', stageText: 'stage_text', diagnosedOn: 'diagnosed_on',
    hospitalText: 'hospital_text', basisText: 'basis_text', noteText: 'note_text',
  },
  pathology: {
    specimenText: 'specimen_text', collectedOn: 'collected_on', reportedOn: 'reported_on',
    hospitalText: 'hospital_text', findingsText: 'findings_text', marginText: 'margin_text',
    nodesExamined: 'nodes_examined', nodesPositive: 'nodes_positive',
    molecularText: 'molecular_text', noteText: 'note_text',
  },
  labs: {
    collectedOn: 'collected_on', analyteText: 'analyte_text', valueNum: 'value_num',
    unitText: 'unit_text', refText: 'ref_text', methodText: 'method_text',
    orgText: 'org_text', flagText: 'flag_text', noteText: 'note_text',
  },
  imaging: {
    performedOn: 'performed_on', modalityText: 'modality_text', regionText: 'region_text',
    orgText: 'org_text', impressionText: 'impression_text', reportRefText: 'report_ref_text',
    noteText: 'note_text',
  },
  treatments: {
    kindText: 'kind_text', nameText: 'name_text', startedOn: 'started_on', endedOn: 'ended_on',
    intentText: 'intent_text', regimenText: 'regimen_text', cyclesText: 'cycles_text',
    hospitalText: 'hospital_text', noteText: 'note_text',
  },
  medications: {
    nameText: 'name_text', doseText: 'dose_text', scheduleText: 'schedule_text',
    startedOn: 'started_on', endedOn: 'ended_on', purposeText: 'purpose_text',
    prescriberText: 'prescriber_text', noteText: 'note_text',
  },
  symptoms: {
    occurredOn: 'occurred_on', symptomText: 'symptom_text', severityNum: 'severity_num',
    durationText: 'duration_text', contextText: 'context_text', noteText: 'note_text',
  },
  nutrition: {
    measuredOn: 'measured_on', weightKg: 'weight_kg', heightCm: 'height_cm',
    intakeText: 'intake_text', supplementsText: 'supplements_text', noteText: 'note_text',
  },
  followups: {
    plannedOn: 'planned_on', kindText: 'kind_text', statusText: 'status_text',
    hospitalText: 'hospital_text', noteText: 'note_text',
  },
  documents: {
    titleText: 'title_text', docTypeText: 'doc_type_text', addedOn: 'added_on',
    sourcePathText: 'source_path_text', sha256Text: 'sha256_text',
    parseStatusText: 'parse_status_text', noteText: 'note_text',
  },
  trials: {
    registryId: 'registry_id', titleText: 'title_text', statusText: 'status_text',
    eligibilityText: 'eligibility_text', siteText: 'site_text', urlText: 'url_text',
    savedOn: 'saved_on', noteText: 'note_text', state: 'state',
  },
  viewpoints: {
    topicText: 'topic_text', bodyText: 'body_text', sourceText: 'source_text', recordedOn: 'recorded_on',
  },
};

const REQUIRED = {
  labs: 'analyteText',
  symptoms: 'symptomText',
  documents: 'titleText',
  medications: 'nameText',
  pathology: 'specimenText',
};

function cleanValue(value) {
  if (value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return value;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export class Workbench {
  constructor({ root, demo = true, dbFile } = {}) {
    if (!root && !dbFile) throw new Error('Workbench 需要 root（资料目录）或 dbFile');
    this.root = root || null;
    this.demo = demo !== false;
    this.dbFile = dbFile || (root ? join(root, DB_FILE) : ':memory:');
    this.db = null;
    this.currentProfileKey = null;
    this.seeded = false;
  }

  open() {
    if (this.db) return this;
    if (this.dbFile !== ':memory:') mkdirSync(this.root || '.', { recursive: true });
    this.db = openStore(this.dbFile);
    try { this.syncTrialSnapshot(); } catch { /* 快照装载失败不阻断打开；试验页按未接通呈现 */ }
    if (this.demo && !hasDemoData(this.db)) {
      seedDemoData(this.db);
      this.seeded = true;
    }
    const first = this.db.prepare(
      'SELECT profile_key FROM subjects WHERE in_use = 1 ORDER BY is_demo DESC, rowid LIMIT 1',
    ).get();
    this.currentProfileKey = first?.profile_key || null;
    return this;
  }

  close() {
    if (this.db) closeStore(this.db);
    this.db = null;
    this.currentProfileKey = null;
  }

  ensure() {
    if (!this.db) this.open();
    return this.db;
  }

  get dataRoot() {
    if (!this.root) return { configured: false, dir: null, ok: false, reason: '当前为内存演示库' };
    const check = checkDataDir(this.root);
    const exists = existsSync(this.root) && statSync(this.root).isDirectory();
    return {
      configured: true,
      dir: this.root,
      ok: check.ok && exists,
      reason: check.ok ? (exists ? null : '目录不存在') : check.reason,
    };
  }

  setDataRoot(dir) {
    const check = checkDataDir(dir);
    if (!check.ok) throw new Error(check.reason);
    const previousRoot = this.root;
    const previousFile = this.dbFile;
    this.close();
    this.root = check.dir;
    this.dbFile = join(check.dir, DB_FILE);
    try {
      this.open();
    } catch (error) {
      this.root = previousRoot;
      this.dbFile = previousFile;
      throw error;
    }
    return this.dataRoot;
  }

  subjects() {
    this.ensure();
    return this.db.prepare(`SELECT profile_key, name, is_demo, primary_site_text, diagnosed_on, hospital_text
      FROM subjects WHERE in_use = 1 ORDER BY is_demo DESC, rowid`).all().map((r) => ({
      profileKey: r.profile_key,
      name: r.name,
      isDemo: Boolean(r.is_demo),
      primarySiteText: r.primary_site_text,
      diagnosedOn: r.diagnosed_on,
      hospitalText: r.hospital_text,
    }));
  }

  profile(key) {
    this.ensure();
    const row = this.db.prepare('SELECT * FROM subjects WHERE profile_key = ?').get(String(key || ''));
    if (!row) return null;
    return {
      profileKey: row.profile_key,
      name: row.name,
      isDemo: Boolean(row.is_demo),
      birthYear: row.birth_year,
      sexText: row.sex_text,
      primarySiteText: row.primary_site_text,
      histologyText: row.histology_text,
      diagnosedOn: row.diagnosed_on,
      stageText: this.db.prepare('SELECT stage_text FROM diagnoses WHERE profile_key=? AND stage_text IS NOT NULL ORDER BY rowid DESC LIMIT 1').get(row.profile_key)?.stage_text || null,
      molecularText: this.db.prepare('SELECT molecular_text FROM pathology_reports WHERE profile_key=? AND molecular_text IS NOT NULL ORDER BY rowid DESC LIMIT 1').get(row.profile_key)?.molecular_text || null,
      hospitalText: row.hospital_text,
      clinicianText: row.clinician_text,
      actionPlanText: row.action_plan_text,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  subjectExists(key) {
    this.ensure();
    return Boolean(this.db.prepare('SELECT 1 AS ok FROM subjects WHERE profile_key = ?').get(String(key || '')));
  }

  createSubject(input = {}) {
    this.ensure();
    const name = String(input.name || '').trim();
    if (!name) throw new Error('档案名不能为空');
    const profileKey = `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.db.prepare(`INSERT INTO subjects
      (profile_key,name,is_demo,birth_year,sex_text,primary_site_text,histology_text,diagnosed_on,hospital_text,clinician_text,action_plan_text)
      VALUES (?,?,0,?,?,?,?,?,?,?,?)`).run(
      profileKey, name,
      numberOrNull(input.birthYear),
      cleanValue(input.sexText),
      cleanValue(input.primarySiteText),
      cleanValue(input.histologyText),
      cleanValue(input.diagnosedOn),
      cleanValue(input.hospitalText),
      cleanValue(input.clinicianText),
      cleanValue(input.actionPlanText),
    );
    this.currentProfileKey = profileKey;
    return { profileKey, name, isDemo: false };
  }

  deleteSubject(key) {
    this.ensure();
    const row = this.db.prepare('SELECT is_demo FROM subjects WHERE profile_key = ?').get(String(key || ''));
    if (!row) throw new Error('档案不存在');
    if (row.is_demo) throw new Error('演示档案不可删除');
    this.db.prepare('DELETE FROM subjects WHERE profile_key = ?').run(String(key));
    if (this.currentProfileKey === key) {
      this.currentProfileKey = this.db.prepare('SELECT profile_key FROM subjects ORDER BY rowid LIMIT 1').get()?.profile_key || null;
    }
    return { deleted: true, profileKey: key };
  }

  readEntity(entity, key, options = {}) {
    this.ensure();
    const reader = READERS[entity];
    if (!reader) throw new Error('未知实体：' + entity);
    if (!this.subjectExists(key)) throw new Error('档案不存在');
    return reader(this.db, String(key), options);
  }

  getCurrentProfileKey() {
    this.ensure();
    if (this.currentProfileKey && this.subjectExists(this.currentProfileKey)) return this.currentProfileKey;
    const first = this.db.prepare('SELECT profile_key FROM subjects ORDER BY is_demo DESC, rowid LIMIT 1').get();
    this.currentProfileKey = first?.profile_key || null;
    return this.currentProfileKey;
  }

  /** 导出只走公开（非私密）记录；与看板、AI 上下文同一条过滤规则。 */
  exportProfile(key) {
    this.ensure();
    if (!this.subjectExists(key)) throw new Error('档案不存在');
    const profile = this.profile(key);
    const entities = {};
    for (const name of Object.keys(READERS)) entities[name] = READERS[name](this.db, String(key));
    return {
      exportedAt: new Date().toISOString(),
      profileKey: String(key),
      profile,
      entities,
      note: '仅包含未标记私密的记录；本导出是资料副本，不构成医学结论。',
      disclaimers: this.bootstrap().disclaimers,
    };
  }

  addEntry(key, kind, data = {}) {
    this.ensure();
    if (!this.subjectExists(key)) throw new Error('档案不存在');
    const table = KIND_TABLES[kind];
    const fields = FIELDS[kind];
    if (!table || !fields) throw new Error('未知记录类型：' + kind);
    const required = REQUIRED[kind];
    if (required && !String(data[required] || '').trim()) throw new Error(`缺少必填字段：${required}`);

    const columns = ['profile_key'];
    const values = [String(key)];
    for (const [camel, column] of Object.entries(fields)) {
      if (!(camel in data)) continue;
      let value = cleanValue(data[camel]);
      if (['nodesExamined', 'nodesPositive', 'severityNum'].includes(camel)) value = numberOrNull(value);
      if (['valueNum', 'weightKg', 'heightCm'].includes(camel)) value = numberOrNull(value);
      columns.push(column);
      values.push(value);
    }
    if ('isPrivate' in data) {
      columns.push('is_private');
      values.push(data.isPrivate ? 1 : 0);
    }
    const placeholders = columns.map(() => '?').join(',');
    const result = this.db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`).run(...values);
    return { id: Number(result.lastInsertRowid), kind };
  }

  setPrivacy(key, kind, id, isPrivate) {
    this.ensure();
    const table = KIND_TABLES[kind];
    if (!table) throw new Error('未知记录类型：' + kind);
    if (!this.subjectExists(key)) throw new Error('档案不存在');
    const info = this.db.prepare(`UPDATE ${table} SET is_private = ? WHERE id = ? AND profile_key = ?`)
      .run(isPrivate ? 1 : 0, Number(id), String(key));
    if (Number(info.changes) !== 1) throw new Error('记录不存在或不属于该档案');
    return { id: Number(id), isPrivate: Boolean(isPrivate) };
  }

  statCounts(key) {
    this.ensure();
    return counts(this.db, String(key));
  }

  bootstrap(preferredKey) {
    this.ensure();
    const subjects = this.subjects();
    const current = preferredKey && subjects.some((s) => s.profileKey === preferredKey)
      ? preferredKey
      : this.currentProfileKey && subjects.some((s) => s.profileKey === this.currentProfileKey)
        ? this.currentProfileKey
        : subjects[0]?.profileKey || null;
    this.currentProfileKey = current;
    const profile = current ? this.profile(current) : null;
    const base = {
      version,
      displayVersion,
      buildDate,
      apiVersion: 'v1',
      demoMode: Boolean(profile?.isDemo),
      subjects,
      profileKey: current,
      currentProfileKey: current,
      profile,
      dataRoot: this.dataRoot,
      counts: current ? this.statCounts(current) : {},
      recent: current ? recentActivity(this.db, current) : [],
      upcoming: current ? upcomingFollowups(this.db, current) : [],
      ...(this.trialData()),
      channels: {
        trials: this.trialData().trialSnapshot.recordCount
          ? { status: 'LOCAL_SNAPSHOT', label: '本地快照已装载（会过期）；在线通道未接通' }
          : { status: 'NOT_CONNECTED', label: '试验检索未接通；不展示未经核对的条数' },
        library: { status: 'LOCAL_ONLY', label: '本机临床库：只含范围与记录口径，待临床审核' },
        documents: { status: 'NOT_CONNECTED', label: '文档解析未接通（MinerU 未配置）' },
        ai: { status: 'HOST_MANAGED', label: 'AI 会话由 DSH 宿主管理' },
      },
      disclaimers: [
        '本台只整理资料与就诊准备，不诊断、不分期、不评疗效、不给治疗建议。',
        '演示内容为合成示例，不对应任何真实患者。',
        '医学阈值与复查间隔均为【待核】占位，以医生意见为准。',
      ],
      demoKeys: [...DEMO_KEYS],
    };
    return base;
  }

  stats() {
    this.ensure();
    const subjectCount = Number(this.db.prepare('SELECT COUNT(*) AS n FROM subjects').get()?.n || 0);
    return { subjects: subjectCount, hasDemo: hasDemoData(this.db), seeded: this.seeded };
  }

  /* 收藏三态（35 号 §六 收藏子页）：手工标记 in_followup / preparing / archived。 */
  setTrialState(key, id, state) {
    this.ensure();
    if (!this.subjectExists(key)) throw Object.assign(new Error('档案不存在'), { status: 404 });
    if (!['in_followup', 'preparing', 'archived'].includes(state)) throw Object.assign(new Error('收藏状态不合法'), { status: 400 });
    const changes = Number(this.db.prepare('UPDATE saved_trials SET state=? WHERE id=? AND profile_key=?').run(state, Number(id), String(key)).changes);
    if (!changes) throw Object.assign(new Error('没有找到这条收藏'), { status: 404 });
    return { ok: true, id: Number(id), state };
  }

  /* 快照装载：research/small-bowel-2026 的 jsonl → trials 表，manifest → app_setting。
     只增不改；FAILED / NEEDS_SETUP 原样进 source_statuses，不算「查过」、不计覆盖。 */
  syncTrialSnapshot() {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'research', 'small-bowel-2026');
    const manifestPath = join(dir, 'manifest.json');
    if (!existsSync(manifestPath)) return;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const jsonlPath = join(dir, 'trials-2026.jsonl');
    if (!existsSync(jsonlPath)) return;
    const rows = readFileSync(jsonlPath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    const db = this.ensure();
    const ins = db.prepare(`INSERT INTO trials(record_id,merged_sources,source_id,title,study_type,sponsors,registry_numbers,dates,source_url,retrieved_at,status_note,snapshot_date,conditions_json,phase_json,countries_json,eligibility_text,summary,raw_json,relevant)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(record_id) DO UPDATE SET
      title=excluded.title, study_type=excluded.study_type, sponsors=excluded.sponsors,
      registry_numbers=excluded.registry_numbers, dates=excluded.dates, source_url=excluded.source_url,
      retrieved_at=excluded.retrieved_at, status_note=excluded.status_note, snapshot_date=excluded.snapshot_date,
      conditions_json=excluded.conditions_json, phase_json=excluded.phase_json, countries_json=excluded.countries_json,
      eligibility_text=excluded.eligibility_text, summary=excluded.summary, relevant=excluded.relevant`);
    db.prepare(`INSERT INTO app_setting(key,value,updated_at) VALUES('trial_manifest',?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
      .run(JSON.stringify({ snapshotDate: manifest.snapshotDate, recordCount: manifest.recordCount, relevant: manifest.relevant, channels: manifest.channels, failed: manifest.failed }), new Date().toISOString());
    db.exec('BEGIN');
    try {
      for (const r of rows) {
        ins.run(r.recordId, JSON.stringify(r.mergedSources || [r.sourceId]), r.sourceId, r.title, r.studyType || null,
          JSON.stringify(r.sponsor || []), JSON.stringify(r.registryNumbers || []), JSON.stringify(r.dates || {}), r.sourceUrl || '',
          r.retrievedAt || null, r.statusNote || '登记状态，未核实', r.snapshotDate || manifest.snapshotDate,
          JSON.stringify(r.conditions || []), JSON.stringify(r.phase || []), JSON.stringify(r.countries || []),
          r.eligibilityText || '', r.summary || '', '{}', 1);
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }

  /* 试验数据装配：快照 trial 行 → 展示形态（无判读列；pct 由展示层 trial-match.js 计算，不入库）。 */
  trialData() {
    this.ensure();
    const parse = (s, fallback) => { try { const v = JSON.parse(s); return v ?? fallback; } catch { return fallback; } };
    const manifest = (() => { try { return JSON.parse(this.db.prepare("SELECT value FROM app_setting WHERE key='trial_manifest'").get()?.value || 'null'); } catch { return null; } })();
    const trials = this.db.prepare('SELECT * FROM trials WHERE relevant=1 ORDER BY snapshot_date DESC, record_id').all().map((r) => ({
      trialKey: r.record_id, title: r.title, registry: (parse(r.registry_numbers, []) || []).find((x) => x.registry === 'NCT')?.value || r.record_id,
      phase: (parse(r.phase_json, []) || []).join(' / ') || '未标注', status: r.status_note || '登记状态，未核实', studyType: r.study_type,
      sponsor: (parse(r.sponsors, []) || [])[0] || '未标注', countries: parse(r.countries_json, []) || [],
      startDate: parse(r.dates, {})?.startDate || '', conditions: parse(r.conditions_json, []) || [],
      source: r.source_id, sourceUrl: r.source_url, eligibilityText: r.eligibility_text || '', summary: r.summary || '',
      snapshotDate: r.snapshot_date,
    }));
    return {
      trials,
      trialSnapshot: {
        snapshotDate: manifest?.snapshotDate || '未标注', recordCount: manifest?.recordCount ?? trials.length,
        relevant: manifest?.relevant ?? trials.length, returned: trials.length,
        candidateScope: `本地快照 ${manifest?.recordCount ?? trials.length} 条；相关 ${manifest?.relevant ?? trials.length} 条；不是全库扫描`,
        channels: (manifest?.channels || []).map((c) => ({ id: c.id, label: c.id, state: c.state, count: c.records, note: '' })),
        failed: manifest?.failed || [],
        disclaimer: '登记状态，未核实；登记 ≠ 有效 ≠ 安全 ≠ 可入组。快照会过期。',
      },
    };
  }

  /* 检索子页：关键词 LIKE，不掺分数；未建快照时如实返回空池 + 原因。 */
  trialMatch(keyword) {
    this.ensure();
    const hasSnapshot = Number(this.db.prepare('SELECT COUNT(*) AS n FROM trials').get()?.n || 0) > 0
    if (!hasSnapshot) {
      return { ok: false, status: 'UNAVAILABLE', reason: '本机未建立试验快照；不返回未经核对的结果。', checkedAt: new Date().toISOString() };
    }
    const total = Number(this.db.prepare('SELECT COUNT(*) AS n FROM trials').get()?.n || 0);
    const q = String(keyword || '').trim().slice(0, 120);
    const rows = q
      ? this.db.prepare(`SELECT * FROM trials WHERE title LIKE ? OR conditions_json LIKE ? OR eligibility_text LIKE ? ORDER BY record_id LIMIT 100`).all(`%${q}%`, `%${q}%`, `%${q}%`)
      : this.db.prepare('SELECT * FROM trials ORDER BY record_id LIMIT 100').all();
    return {
      ok: true, total, returned: rows.length,
      honestyNote: '登记状态未核实；快照会过期；不是全库扫描；登记 ≠ 有效 ≠ 安全 ≠ 可入组。',
      records: rows,
    };
  }

  clinicalLibrary() {
    return libraryPayload();
  }
}
