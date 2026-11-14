/**
 * 工作台服务层：档案、记录写入、隐私、资料目录。
 * 不依赖宿主，可单测；HTTP 层只做路由与认证。
 */
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { openStore, closeStore } from './store.js';
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
    savedOn: 'saved_on', noteText: 'note_text',
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
      channels: {
        trials: { status: 'NOT_CONNECTED', label: '试验检索未接通（M6）；不展示未经核对的条数' },
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

  trialMatch() {
    return {
      status: 'UNAVAILABLE',
      reason: '本次开发环境未联网，未建立试验快照；不返回未经核对的结果。',
      checkedAt: new Date().toISOString(),
    };
  }

  clinicalLibrary() {
    return libraryPayload();
  }
}
