-- 0002 · 试验快照（35 号四段链路第 2 段：双通道之本地快照）
-- 只增不改：0001 已冻结（见 freeze-contract.md），本迁移只新增表，不改写 0001。
-- 数据来源：scripts/fetch-small-bowel-trials-2026.mjs（unified-trial-mcp，MCP stdio）
--   → research/small-bowel-2026/{manifest.json, trials-2026.jsonl, sqlite}
-- 装载：dsh/workbench.js syncTrialSnapshot()（jsonl → 本库 trials，manifest → app_setting）。
-- 纪律：FAILED / NEEDS_SETUP 原样进 source_statuses，不算「查过」、不计覆盖；
--       无判读列（无 diagnosis / risk_level / match_score 类派生判定入库）；pct 只在展示层算。

CREATE TABLE trials (
  record_id TEXT PRIMARY KEY,
  merged_sources TEXT,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  study_type TEXT,
  sponsors TEXT,
  registry_numbers TEXT,
  dates TEXT,
  source_url TEXT,
  retrieved_at TEXT,
  status_note TEXT,
  snapshot_date TEXT NOT NULL,
  conditions_json TEXT,
  phase_json TEXT,
  countries_json TEXT,
  eligibility_text TEXT,
  summary TEXT,
  raw_json TEXT,
  relevant INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE source_statuses (
  query TEXT NOT NULL,
  source_id TEXT NOT NULL,
  state TEXT NOT NULL,
  reason_code TEXT,
  explanation TEXT,
  result_count INTEGER,
  coverage_json TEXT,
  completeness_json TEXT,
  freshness_json TEXT,
  snapshot_date TEXT NOT NULL,
  PRIMARY KEY(query, source_id)
);

CREATE TABLE app_setting (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL
);

-- 收藏与跟踪三态（35 号 §六 收藏子页）：手工标记，不画进度条（快照无状态变化时间线）。
ALTER TABLE saved_trials ADD COLUMN state TEXT NOT NULL DEFAULT 'in_followup';
