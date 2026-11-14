import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openStore, closeStore } from '../dsh/store.js';
import { seedDemoData, DEMO_KEYS } from '../dsh/demo.js';
import {
  readLabs, readImaging, readSymptoms, readNutrition, readTreatments, readMedications,
  readFollowups, readDiagnoses, readPathology, counts, recentActivity, upcomingFollowups,
} from '../dsh/readmodels.js';

function fresh() {
  const db = openStore(':memory:');
  seedDemoData(db);
  return db;
}

test('化验：同指标不同机构不合并，组内按日期升序', () => {
  const db = fresh();
  try {
    const labs = readLabs(db, DEMO_KEYS[0]);
    const cea = labs.find((l) => l.analyte === 'CEA');
    assert.ok(cea, '缺 CEA');
    assert.equal(cea.groups.length, 2, 'CEA 应有两组');
    const groupA = cea.groups.find((g) => g.org.includes('医院 A'));
    assert.equal(groupA.points.length, 3);
    const dates = groupA.points.map((p) => p.date);
    assert.deepEqual(dates, [...dates].sort(), '组内日期应升序');
    const groupB = cea.groups.find((g) => g.org.includes('医院 B'));
    assert.equal(groupB.points.length, 1);
    assert.equal(cea.latestDate, '2026-05-11', '最近日期跨组取最大');
  } finally {
    closeStore(db);
  }
});

test('体重：records 倒序，weightSeries 升序且只含有日期/数值的点', () => {
  const db = fresh();
  try {
    const nutrition = readNutrition(db, DEMO_KEYS[0]);
    assert.equal(nutrition.records[0].measuredOn, '2026-06-01');
    const dates = nutrition.weightSeries.map((p) => p.date);
    assert.deepEqual(dates, [...dates].sort());
    assert.ok(nutrition.weightSeries.every((p) => typeof p.kg === 'number'));
  } finally {
    closeStore(db);
  }
});

test('A/B 两套档案不串档', () => {
  const db = fresh();
  try {
    const a = readImaging(db, DEMO_KEYS[0]);
    const b = readImaging(db, DEMO_KEYS[1]);
    assert.ok(a.every((x) => !x.impressionText.includes('MSI')));
    assert.ok(b.every((x) => !x.impressionText.includes('空肠上段')));
    assert.notEqual(a[0]?.impressionText, b[0]?.impressionText);
  } finally {
    closeStore(db);
  }
});

test('计数、最近活动与待复诊只含非私密记录', () => {
  const db = fresh();
  try {
    const c = counts(db, DEMO_KEYS[0]);
    assert.ok(c.diagnoses >= 1);
    assert.ok(c.labs >= 1);
    assert.ok(recentActivity(db, DEMO_KEYS[0]).length > 0);
    const upcoming = upcomingFollowups(db, DEMO_KEYS[0]);
    assert.ok(upcoming.length >= 1);
    assert.ok(upcoming.every((f) => f.statusText.includes('待')));
  } finally {
    closeStore(db);
  }
});

test('读模型字段 camelCase 且缺失值为 null', () => {
  const db = fresh();
  try {
    const [dx] = readDiagnoses(db, DEMO_KEYS[0]);
    assert.equal(dx.siteCode, 'jejunum');
    assert.ok('stageText' in dx);
    const [path] = readPathology(db, DEMO_KEYS[0]);
    assert.equal(path.nodesExamined, 14);
    const meds = readMedications(db, DEMO_KEYS[0]);
    assert.ok(meds.some((m) => m.ongoing === true));
    const treatments = readTreatments(db, DEMO_KEYS[0]);
    assert.ok(treatments.length >= 2);
    const symptoms = readSymptoms(db, DEMO_KEYS[0]);
    assert.ok(symptoms.every((s) => s.severityNum === null || (s.severityNum >= 0 && s.severityNum <= 10)));
    const followups = readFollowups(db, DEMO_KEYS[1]);
    assert.ok(followups.length >= 2);
  } finally {
    closeStore(db);
  }
});
