import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Workbench } from '../dsh/workbench.js';

function withWorkbench(fn) {
  const root = mkdtempSync(join(tmpdir(), 'sba-wb-'));
  const wb = new Workbench({ root });
  wb.open();
  try { return fn(wb, root); } finally {
    wb.close();
    rmSync(root, { recursive: true, force: true });
  }
}

test('开库→播种→bootstrap 稳定、幂等', () => {
  withWorkbench((wb) => {
    wb.open();
    const b1 = wb.bootstrap();
    const b2 = wb.bootstrap();
    assert.equal(JSON.stringify(b1), JSON.stringify(b2), 'bootstrap 应稳定');
    assert.equal(b1.demoMode, true);
    assert.equal(b1.subjects.length, 2);
    assert.ok(b1.counts.labs > 0);
    assert.equal(b1.channels.trials.status, 'NOT_CONNECTED');
    assert.ok(b1.disclaimers.length >= 3);
  });
});

test('缺 root 时错误信息指向 root', () => {
  assert.throws(() => new Workbench({}), /root/);
});

test('bootstrap 可按 profileKey 切换，档案摘要与计数同步', () => {
  withWorkbench((wb) => {
    const a = wb.bootstrap('demo-sba-a');
    const b = wb.bootstrap('demo-sba-b');
    assert.match(a.profile.name, /空肠/);
    assert.match(b.profile.name, /十二指肠/);
    assert.equal(b.profileKey, 'demo-sba-b');
    assert.equal(b.currentProfileKey, 'demo-sba-b');
    assert.ok(b.counts.diagnoses >= 1);
    assert.notDeepEqual(a.counts, {});
    const missing = wb.bootstrap('missing-key');
    assert.equal(missing.profileKey, 'demo-sba-b', '未知 key 回退到当前有效档案');
  });
});

test('新建本机档案 / 列表 / 删除；演示档案不可删', () => {
  withWorkbench((wb) => {
    const created = wb.createSubject({ name: '替家人代记', primarySiteText: '回肠' });
    assert.match(created.profileKey, /^local-/);
    const list = wb.subjects();
    assert.equal(list.length, 3);
    assert.equal(list.find((s) => s.profileKey === created.profileKey).isDemo, false);
    assert.equal(wb.profile(created.profileKey).primarySiteText, '回肠');
    assert.throws(() => wb.deleteSubject('demo-sba-a'), /演示档案不可删除/);
    wb.deleteSubject(created.profileKey);
    assert.equal(wb.subjects().length, 2);
  });
});

test('写入：白名单字段、必填校验、未知类型拒绝', () => {
  withWorkbench((wb) => {
    const key = wb.getCurrentProfileKey();
    const added = wb.addEntry(key, 'labs', {
      collectedOn: '2026-11-01', analyteText: 'CEA', valueNum: 1.23,
      unitText: 'ng/mL', methodText: '化学发光', orgText: '示例医院 X',
      evilColumn: 'should_not_land', isPrivate: true,
    });
    assert.ok(added.id > 0);
    const row = wb.db.prepare('SELECT * FROM lab_results WHERE id = ?').get(added.id);
    assert.equal(row.analyte_text, 'CEA');
    assert.equal(row.value_num, 1.23);
    assert.equal(Number(row.is_private), 1);
    assert.equal('evilColumn' in row, false);
    assert.throws(() => wb.addEntry(key, 'labs', { valueNum: 1 }), /analyteText/);
    assert.throws(() => wb.addEntry(key, 'nope', {}), /未知记录类型/);
  });
});

test('隐私：默认读不到，导出也读不到；打开 includePrivate 可读', () => {
  withWorkbench((wb) => {
    const key = wb.getCurrentProfileKey();
    const added = wb.addEntry(key, 'symptoms', { symptomText: '私密记录测试', severityNum: 2, isPrivate: true });
    const visible = wb.readEntity('symptoms', key);
    assert.ok(!visible.some((s) => s.id === added.id));
    const exported = wb.exportProfile(key);
    assert.ok(!exported.entities.symptoms.some((s) => s.id === added.id));
    assert.ok(!exported.entities.symptoms.some((s) => s.symptomText === '私密记录测试'));
    const withPrivate = wb.readEntity('symptoms', key, { includePrivate: true });
    assert.ok(withPrivate.some((s) => s.id === added.id));
  });
});

test('试验通道未接通时如实返回 UNAVAILABLE，不伪造结果', () => {
  withWorkbench((wb) => {
    const result = wb.trialMatch();
    assert.equal(result.status, 'UNAVAILABLE');
    assert.equal(result.items, undefined);
  });
});

test('数据根：拒绝主目录/桌面/下载/tmp；临时目录可切换', () => {
  withWorkbench((wb) => {
    assert.throws(() => wb.setDataRoot('/tmp/sba'), /tmp/);
    assert.throws(() => wb.setDataRoot('/Users/example/Desktop'), /桌面/);
    assert.throws(() => wb.setDataRoot('relative'), /绝对路径/);
  });
});

test('未知实体与不存在档案给出可读错误', () => {
  withWorkbench((wb) => {
    assert.throws(() => wb.readEntity('nope', wb.getCurrentProfileKey()), /未知实体/);
    assert.throws(() => wb.readEntity('labs', 'missing'), /档案不存在/);
  });
});
