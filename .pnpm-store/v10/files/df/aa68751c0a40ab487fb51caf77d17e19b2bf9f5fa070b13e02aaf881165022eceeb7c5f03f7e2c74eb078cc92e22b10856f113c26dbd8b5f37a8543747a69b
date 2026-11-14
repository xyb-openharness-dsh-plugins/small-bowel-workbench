/* 小肠腺癌（Small Bowel Adenocarcinoma, SBA）工作台 · 初始数据模型（0001）
 *
 * 家族四条数据契约：
 *   1. 看法恒不为结论：viewpoints 只是记录，无 is_conclusion 列；
 *   2. 显式 null ≠ 0：未知日期、缺失数值一律 NULL，不用空串冒充；
 *   3. 更正只新增版本：各事实表带 ver 与 superseded_by，历史行保留；
 *   4. 事实分层不合并：文档 / 病理 / 化验 / 影像 / 治疗分表存放。
 *
 * 非判读红线：
 *   A. 全库不设 diagnosis / risk_level / activity_score / prognosis / response /
 *      line_of_therapy 类列；医生写的分期、分级、切缘、分子结果只以 *_text 原样保存，
 *      不由本台派生分期、复发风险或疗效结论。
 *   B. 化验可比组 = method + org：lab_results 不跨方法/机构合并，不做差、不生成趋势判定；
 *      界面按组陈列，分类指标不进趋势。
 *   C. 影像只存报告原文（impression_text）与检查事实，不设 RECIST / 缓解 / 进展判定列。
 *   D. 随访只存「医生已安排」的原话与状态（status_text），不生成 next_due 排程，
 *      不由本台计算复查间隔。
 *
 * 隐私：is_private 缺省 0；看板摘要、导出、AI 上下文三出口必须显式过滤 is_private=1。
 * 读序：所有裸 SELECT 必须 ORDER BY rowid。
 *
 * 迁移只增不改：本文件冻结后（sha256 见 freeze-contract.md），
 * 结构变更只能新增 0002_*.sql。
 */

/* ---------- 档案级 ---------- */

CREATE TABLE subjects (
  profile_key   TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  is_demo       INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  birth_year    INTEGER,
  sex_text      TEXT,
  primary_site_text TEXT,
  histology_text    TEXT,
  diagnosed_on  TEXT,
  hospital_text TEXT,
  clinician_text TEXT,
  action_plan_text TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  in_use        INTEGER NOT NULL DEFAULT 1 CHECK (in_use IN (0,1))
);

CREATE TABLE section_titles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_key TEXT NOT NULL UNIQUE,
  title_text  TEXT NOT NULL,
  hint_text   TEXT
);

/* ---------- 确诊与病理（只存原话） ---------- */

CREATE TABLE diagnoses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_key TEXT NOT NULL REFERENCES subjects(profile_key) ON DELETE CASCADE,
  site_code   TEXT,
  site_text   TEXT,
  histology_text TEXT,
  grade_text  TEXT,
  stage_text  TEXT,
  diagnosed_on TEXT,
  hospital_text TEXT,
  basis_text  TEXT,
  note_text   TEXT,
  ver INTEGER NOT NULL DEFAULT 1,
  superseded_by INTEGER,
  is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0,1))
);

CREATE TABLE pathology_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_key TEXT NOT NULL REFERENCES subjects(profile_key) ON DELETE CASCADE,
  specimen_text TEXT NOT NULL,
  collected_on TEXT,
  reported_on  TEXT,
  hospital_text TEXT,
  findings_text TEXT,
  margin_text   TEXT,
  nodes_examined INTEGER,
  nodes_positive INTEGER,
  molecular_text TEXT,
  note_text TEXT,
  ver INTEGER NOT NULL DEFAULT 1,
  superseded_by INTEGER,
  is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0,1))
);

/* ---------- 检查 ---------- */

CREATE TABLE lab_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_key TEXT NOT NULL REFERENCES subjects(profile_key) ON DELETE CASCADE,
  collected_on TEXT,
  analyte_text TEXT NOT NULL,
  value_num REAL,
  unit_text TEXT,
  ref_text  TEXT,
  method_text TEXT,
  org_text  TEXT,
  flag_text TEXT,
  note_text TEXT,
  ver INTEGER NOT NULL DEFAULT 1,
  superseded_by INTEGER,
  is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0,1))
);

CREATE TABLE imaging_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_key TEXT NOT NULL REFERENCES subjects(profile_key) ON DELETE CASCADE,
  performed_on TEXT,
  modality_text TEXT NOT NULL,
  region_text   TEXT,
  org_text      TEXT,
  impression_text TEXT,
  report_ref_text TEXT,
  note_text TEXT,
  ver INTEGER NOT NULL DEFAULT 1,
  superseded_by INTEGER,
  is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0,1))
);

/* ---------- 治疗与用药 ---------- */

CREATE TABLE treatments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_key TEXT NOT NULL REFERENCES subjects(profile_key) ON DELETE CASCADE,
  kind_text   TEXT NOT NULL,
  name_text   TEXT,
  started_on  TEXT,
  ended_on    TEXT,
  intent_text TEXT,
  regimen_text TEXT,
  cycles_text TEXT,
  hospital_text TEXT,
  note_text TEXT,
  ver INTEGER NOT NULL DEFAULT 1,
  superseded_by INTEGER,
  is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0,1))
);

CREATE TABLE medications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_key TEXT NOT NULL REFERENCES subjects(profile_key) ON DELETE CASCADE,
  name_text TEXT NOT NULL,
  dose_text TEXT,
  schedule_text TEXT,
  started_on TEXT,
  ended_on TEXT,
  purpose_text TEXT,
  prescriber_text TEXT,
  note_text TEXT,
  ver INTEGER NOT NULL DEFAULT 1,
  superseded_by INTEGER,
  is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0,1))
);

/* ---------- 症状与营养 ---------- */

CREATE TABLE symptom_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_key TEXT NOT NULL REFERENCES subjects(profile_key) ON DELETE CASCADE,
  occurred_on TEXT,
  symptom_text TEXT NOT NULL,
  severity_num INTEGER CHECK (severity_num IS NULL OR (severity_num >= 0 AND severity_num <= 10)),
  duration_text TEXT,
  context_text TEXT,
  note_text TEXT,
  ver INTEGER NOT NULL DEFAULT 1,
  superseded_by INTEGER,
  is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0,1))
);

CREATE TABLE nutrition_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_key TEXT NOT NULL REFERENCES subjects(profile_key) ON DELETE CASCADE,
  measured_on TEXT,
  weight_kg REAL,
  height_cm REAL,
  intake_text TEXT,
  supplements_text TEXT,
  note_text TEXT,
  ver INTEGER NOT NULL DEFAULT 1,
  superseded_by INTEGER,
  is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0,1))
);

/* ---------- 随访 ---------- */

CREATE TABLE followup_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_key TEXT NOT NULL REFERENCES subjects(profile_key) ON DELETE CASCADE,
  planned_on TEXT,
  kind_text  TEXT,
  status_text TEXT,
  hospital_text TEXT,
  note_text TEXT,
  ver INTEGER NOT NULL DEFAULT 1,
  superseded_by INTEGER,
  is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0,1))
);

/* ---------- 资料与试验收藏 ---------- */

CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_key TEXT NOT NULL REFERENCES subjects(profile_key) ON DELETE CASCADE,
  title_text TEXT NOT NULL,
  doc_type_text TEXT,
  added_on TEXT,
  source_path_text TEXT,
  sha256_text TEXT,
  parse_status_text TEXT,
  note_text TEXT,
  is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0,1))
);

CREATE TABLE saved_trials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_key TEXT NOT NULL REFERENCES subjects(profile_key) ON DELETE CASCADE,
  registry_id TEXT,
  title_text TEXT,
  status_text TEXT,
  eligibility_text TEXT,
  site_text TEXT,
  url_text TEXT,
  saved_on TEXT,
  note_text TEXT,
  is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0,1))
);

/* ---------- 患者视角记录（不是结论） ---------- */

CREATE TABLE viewpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_key TEXT NOT NULL REFERENCES subjects(profile_key) ON DELETE CASCADE,
  topic_text TEXT,
  body_text TEXT NOT NULL,
  source_text TEXT,
  recorded_on TEXT,
  is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0,1))
);

CREATE INDEX idx_lab_profile_date ON lab_results(profile_key, collected_on);
CREATE INDEX idx_lab_analyte ON lab_results(profile_key, analyte_text);
CREATE INDEX idx_imaging_profile_date ON imaging_events(profile_key, performed_on);
CREATE INDEX idx_treatment_profile ON treatments(profile_key, started_on);
CREATE INDEX idx_symptom_profile_date ON symptom_notes(profile_key, occurred_on);
CREATE INDEX idx_followup_profile_date ON followup_plans(profile_key, planned_on);
CREATE INDEX idx_documents_profile ON documents(profile_key, added_on);
