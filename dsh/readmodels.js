/**
 * 只读模型：UI 需要的形状在这里一次性拼好。
 *
 * 铁律：
 *   - 私密记录默认过滤（看板 / 导出 / AI 上下文三出口同一条规则）；
 *   - 化验按 analyte → (method, org) 分组，不跨组连线、不做差；
 *   - 所有裸 SELECT 带 ORDER BY rowid 兜底。
 */

const PRIVATE = 'is_private = 0';

function all(db, sql, params = []) {
  return db.prepare(sql).all(...params);
}

function one(db, sql, params = []) {
  return db.prepare(sql).get(...params);
}

function privacyClause(includePrivate) {
  return includePrivate ? '1 = 1' : PRIVATE;
}

export function readDiagnoses(db, key, { includePrivate = false } = {}) {
  return all(db, `SELECT * FROM diagnoses WHERE profile_key = ? AND ${privacyClause(includePrivate)}
    ORDER BY (diagnosed_on IS NULL), diagnosed_on DESC, rowid DESC`, [key]).map((r) => ({
    id: r.id,
    siteCode: r.site_code,
    siteText: r.site_text,
    histologyText: r.histology_text,
    gradeText: r.grade_text,
    stageText: r.stage_text,
    diagnosedOn: r.diagnosed_on,
    hospitalText: r.hospital_text,
    basisText: r.basis_text,
    noteText: r.note_text,
    isPrivate: Boolean(r.is_private),
    source: 'clinician-record',
  }));
}

export function readPathology(db, key, { includePrivate = false } = {}) {
  return all(db, `SELECT * FROM pathology_reports WHERE profile_key = ? AND ${privacyClause(includePrivate)}
    ORDER BY (reported_on IS NULL), reported_on DESC, rowid DESC`, [key]).map((r) => ({
    id: r.id,
    specimenText: r.specimen_text,
    collectedOn: r.collected_on,
    reportedOn: r.reported_on,
    hospitalText: r.hospital_text,
    findingsText: r.findings_text,
    marginText: r.margin_text,
    nodesExamined: r.nodes_examined,
    nodesPositive: r.nodes_positive,
    molecularText: r.molecular_text,
    noteText: r.note_text,
    state: r.state || 'in_followup',
    isPrivate: Boolean(r.is_private),
  }));
}

export function readLabs(db, key, { includePrivate = false } = {}) {
  const rows = all(db, `SELECT * FROM lab_results WHERE profile_key = ? AND ${privacyClause(includePrivate)}
    ORDER BY analyte_text, method_text, org_text, (collected_on IS NULL), collected_on, rowid`, [key]);
  const analytes = new Map();
  for (const r of rows) {
    const analyte = r.analyte_text;
    if (!analytes.has(analyte)) {
      analytes.set(analyte, { analyte, groups: new Map() });
    }
    const groupKey = `${r.method_text || ''}\u0000${r.org_text || ''}`;
    const entry = analytes.get(analyte);
    if (!entry.groups.has(groupKey)) {
      entry.groups.set(groupKey, {
        method: r.method_text || null,
        org: r.org_text || null,
        unit: r.unit_text || null,
        refText: r.ref_text || null,
        points: [],
      });
    }
    entry.groups.get(groupKey).points.push({
      id: r.id,
      date: r.collected_on,
      value: r.value_num,
      flagText: r.flag_text,
      noteText: r.note_text,
      isPrivate: Boolean(r.is_private),
    });
  }
  return [...analytes.values()].map((entry) => {
    const groups = [...entry.groups.values()].map((g) => ({
      ...g,
      count: g.points.length,
      latest: g.points.length ? g.points[g.points.length - 1] : null,
    }));
    const latestDate = groups
      .map((g) => g.latest?.date)
      .filter(Boolean)
      .sort()
      .pop() || null;
    return { analyte: entry.analyte, groups, latestDate };
  });
}

export function readImaging(db, key, { includePrivate = false } = {}) {
  return all(db, `SELECT * FROM imaging_events WHERE profile_key = ? AND ${privacyClause(includePrivate)}
    ORDER BY (performed_on IS NULL), performed_on DESC, rowid DESC`, [key]).map((r) => ({
    id: r.id,
    performedOn: r.performed_on,
    modalityText: r.modality_text,
    regionText: r.region_text,
    orgText: r.org_text,
    impressionText: r.impression_text,
    reportRefText: r.report_ref_text,
    noteText: r.note_text,
    isPrivate: Boolean(r.is_private),
  }));
}

export function readTreatments(db, key, { includePrivate = false } = {}) {
  return all(db, `SELECT * FROM treatments WHERE profile_key = ? AND ${privacyClause(includePrivate)}
    ORDER BY (started_on IS NULL), started_on DESC, rowid DESC`, [key]).map((r) => ({
    id: r.id,
    kindText: r.kind_text,
    nameText: r.name_text,
    startedOn: r.started_on,
    endedOn: r.ended_on,
    intentText: r.intent_text,
    regimenText: r.regimen_text,
    cyclesText: r.cycles_text,
    hospitalText: r.hospital_text,
    noteText: r.note_text,
    isPrivate: Boolean(r.is_private),
  }));
}

export function readMedications(db, key, { includePrivate = false } = {}) {
  return all(db, `SELECT * FROM medications WHERE profile_key = ? AND ${privacyClause(includePrivate)}
    ORDER BY (ended_on IS NULL) DESC, (started_on IS NULL), started_on DESC, rowid DESC`, [key]).map((r) => ({
    id: r.id,
    nameText: r.name_text,
    doseText: r.dose_text,
    scheduleText: r.schedule_text,
    startedOn: r.started_on,
    endedOn: r.ended_on,
    purposeText: r.purpose_text,
    prescriberText: r.prescriber_text,
    noteText: r.note_text,
    ongoing: !r.ended_on,
    isPrivate: Boolean(r.is_private),
  }));
}

export function readSymptoms(db, key, { includePrivate = false } = {}) {
  return all(db, `SELECT * FROM symptom_notes WHERE profile_key = ? AND ${privacyClause(includePrivate)}
    ORDER BY (occurred_on IS NULL), occurred_on DESC, rowid DESC`, [key]).map((r) => ({
    id: r.id,
    occurredOn: r.occurred_on,
    symptomText: r.symptom_text,
    severityNum: r.severity_num,
    durationText: r.duration_text,
    contextText: r.context_text,
    noteText: r.note_text,
    isPrivate: Boolean(r.is_private),
  }));
}

export function readNutrition(db, key, { includePrivate = false } = {}) {
  const rows = all(db, `SELECT * FROM nutrition_records WHERE profile_key = ? AND ${privacyClause(includePrivate)}
    ORDER BY (measured_on IS NULL), measured_on DESC, rowid DESC`, [key]).map((r) => ({
    id: r.id,
    measuredOn: r.measured_on,
    weightKg: r.weight_kg,
    heightCm: r.height_cm,
    intakeText: r.intake_text,
    supplementsText: r.supplements_text,
    noteText: r.note_text,
    isPrivate: Boolean(r.is_private),
  }));
  const weightSeries = rows
    .filter((r) => r.weightKg !== null && r.measuredOn)
    .slice()
    .sort((a, b) => a.measuredOn.localeCompare(b.measuredOn))
    .map((r) => ({ date: r.measuredOn, kg: r.weightKg }));
  return { records: rows, weightSeries };
}

export function readFollowups(db, key, { includePrivate = false } = {}) {
  return all(db, `SELECT * FROM followup_plans WHERE profile_key = ? AND ${privacyClause(includePrivate)}
    ORDER BY (planned_on IS NULL), planned_on, rowid`, [key]).map((r) => ({
    id: r.id,
    plannedOn: r.planned_on,
    kindText: r.kind_text,
    statusText: r.status_text,
    hospitalText: r.hospital_text,
    noteText: r.note_text,
    isPrivate: Boolean(r.is_private),
  }));
}

export function readDocuments(db, key, { includePrivate = false } = {}) {
  return all(db, `SELECT * FROM documents WHERE profile_key = ? AND ${privacyClause(includePrivate)}
    ORDER BY (added_on IS NULL), added_on DESC, rowid DESC`, [key]).map((r) => ({
    id: r.id,
    titleText: r.title_text,
    docTypeText: r.doc_type_text,
    addedOn: r.added_on,
    sourcePathText: r.source_path_text,
    sha256Text: r.sha256_text,
    parseStatusText: r.parse_status_text,
    noteText: r.note_text,
    isPrivate: Boolean(r.is_private),
  }));
}

export function readSavedTrials(db, key, { includePrivate = false } = {}) {
  return all(db, `SELECT * FROM saved_trials WHERE profile_key = ? AND ${privacyClause(includePrivate)}
    ORDER BY (saved_on IS NULL), saved_on DESC, rowid DESC`, [key]).map((r) => ({
    id: r.id,
    registryId: r.registry_id,
    titleText: r.title_text,
    statusText: r.status_text,
    eligibilityText: r.eligibility_text,
    siteText: r.site_text,
    urlText: r.url_text,
    savedOn: r.saved_on,
    noteText: r.note_text,
    isPrivate: Boolean(r.is_private),
  }));
}

export function readViewpoints(db, key, { includePrivate = false } = {}) {
  return all(db, `SELECT * FROM viewpoints WHERE profile_key = ? AND ${privacyClause(includePrivate)}
    ORDER BY (recorded_on IS NULL), recorded_on DESC, rowid DESC`, [key]).map((r) => ({
    id: r.id,
    topicText: r.topic_text,
    bodyText: r.body_text,
    sourceText: r.source_text,
    recordedOn: r.recorded_on,
    isPrivate: Boolean(r.is_private),
  }));
}

export function counts(db, key) {
  const tables = [
    ['diagnoses', 'diagnoses'], ['pathology', 'pathology_reports'], ['labs', 'lab_results'],
    ['imaging', 'imaging_events'], ['treatments', 'treatments'], ['medications', 'medications'],
    ['symptoms', 'symptom_notes'], ['nutrition', 'nutrition_records'], ['followups', 'followup_plans'],
    ['documents', 'documents'], ['trials', 'saved_trials'], ['viewpoints', 'viewpoints'],
  ];
  const out = {};
  for (const [label, table] of tables) {
    out[label] = Number(one(db, `SELECT COUNT(*) AS n FROM ${table} WHERE profile_key = ? AND is_private = 0`, [key])?.n || 0);
  }
  return out;
}

/** 「今天」页用：最近发生的事合并成一条时间线。 */
export function recentActivity(db, key, limit = 8) {
  const items = [];
  for (const r of all(db, `SELECT id, occurred_on AS date, symptom_text AS text, severity_num AS severity
      FROM symptom_notes WHERE profile_key = ? AND is_private = 0 ORDER BY rowid DESC LIMIT 6`, [key])) {
    items.push({ kind: 'symptom', date: r.date, text: r.text, detail: r.severity === null ? null : `自评 ${r.severity}/10` });
  }
  for (const r of all(db, `SELECT id, performed_on AS date, modality_text AS text, impression_text AS detail
      FROM imaging_events WHERE profile_key = ? AND is_private = 0 ORDER BY rowid DESC LIMIT 6`, [key])) {
    items.push({ kind: 'imaging', date: r.date, text: r.text, detail: r.detail });
  }
  for (const r of all(db, `SELECT id, started_on AS date, name_text AS text, kind_text AS detail
      FROM treatments WHERE profile_key = ? AND is_private = 0 ORDER BY rowid DESC LIMIT 6`, [key])) {
    items.push({ kind: 'treatment', date: r.date, text: r.text, detail: r.detail });
  }
  return items
    .filter((x) => x.date)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, limit);
}

export function upcomingFollowups(db, key, limit = 3) {
  return readFollowups(db, key).filter((f) => f.statusText && f.statusText.includes('待')).slice(0, limit);
}
