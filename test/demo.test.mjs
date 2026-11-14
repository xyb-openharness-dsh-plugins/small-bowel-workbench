import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openStore, closeStore } from '../dsh/store.js';
import { seedDemoData, hasDemoData, DEMO_KEYS } from '../dsh/demo.js';

test('演示数据：两套档案、幂等、全部 is_demo=1', () => {
  const db = openStore(':memory:');
  try {
    assert.equal(hasDemoData(db), false);
    const first = seedDemoData(db);
    assert.equal(first.seeded, true);
    assert.equal(first.profiles, 2);
    assert.equal(hasDemoData(db), true);
    const second = seedDemoData(db);
    assert.equal(second.seeded, false, '二次播种应跳过');

    const subjects = db.prepare('SELECT profile_key, is_demo FROM subjects ORDER BY rowid').all();
    assert.equal(subjects.length, 2);
    assert.deepEqual(subjects.map((s) => s.profile_key), DEMO_KEYS);
    assert.ok(subjects.every((s) => Number(s.is_demo) === 1));
  } finally {
    closeStore(db);
  }
});

test('演示数据：两套档案都覆盖核心事实表，且不串档', () => {
  const db = openStore(':memory:');
  try {
    seedDemoData(db);
    const tables = ['diagnoses', 'pathology_reports', 'lab_results', 'imaging_events', 'treatments', 'medications', 'symptom_notes', 'nutrition_records', 'followup_plans', 'documents', 'saved_trials', 'viewpoints'];
    for (const key of DEMO_KEYS) {
      for (const table of tables) {
        const n = db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE profile_key = ?`).get(key).n;
        assert.ok(Number(n) > 0, `${key} 的 ${table} 为空`);
      }
    }
    const aSites = db.prepare("SELECT site_text FROM diagnoses WHERE profile_key = 'demo-sba-a'").all();
    const bSites = db.prepare("SELECT site_text FROM diagnoses WHERE profile_key = 'demo-sba-b'").all();
    assert.ok(aSites.some((r) => r.site_text.includes('空肠')));
    assert.ok(bSites.some((r) => r.site_text.includes('十二指肠')));
  } finally {
    closeStore(db);
  }
});

test('演示数据：CEA 在 A 档案中有两个机构/方法组', () => {
  const db = openStore(':memory:');
  try {
    seedDemoData(db);
    const rows = db.prepare("SELECT method_text, org_text FROM lab_results WHERE profile_key = 'demo-sba-a' AND analyte_text = 'CEA' ORDER BY rowid").all();
    const groups = new Set(rows.map((r) => `${r.method_text}|${r.org_text}`));
    assert.equal(groups.size, 2);
  } finally {
    closeStore(db);
  }
});
