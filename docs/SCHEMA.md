# SCHEMA · 小肠腺癌工作台数据模型（0001）

实现：`schema/0001_initial.sql`（M2 草案，G3 未签认）。打开与迁移：`dsh/store.js`。

## 设计取舍

1. **一个档案一串事实**：所有事实表用 `profile_key` 外键挂到 `subjects`，演示 A/B 与真实档案同构。
2. **原文优先**：分期、分级、切缘、分子结果、影像结论、医生计划都存 `*_text`，不做枚举化判读。
3. **可更正**：事实表带 `ver` 与 `superseded_by`；更正新增一行，旧行保留。
4. **可比性靠分组**：化验保留 `method_text` 与 `org_text`，读模型按二元组分组。
5. **隐私在位**：每张含患者内容的事实表带 `is_private`；三出口显式过滤。

## 表

| 表 | 一行是什么 | 关键列 | 不做什么 |
| --- | --- | --- | --- |
| `subjects` | 一个患者档案 | `profile_key`、`is_demo`、`birth_year`、`primary_site_text` | 不存身份证号、手机号、住址 |
| `section_titles` | 页面分节标题与提示 | `section_key`、`title_text` | — |
| `diagnoses` | 一次确诊记录 | `site_code`、`histology_text`、`grade_text`、`stage_text`、`basis_text` | 不派生分期、不判可切除性 |
| `pathology_reports` | 一份病理报告 | `specimen_text`、`margin_text`、`nodes_*`、`molecular_text` | 不解释切缘好坏、不判分子结果意义 |
| `lab_results` | 一次化验单项 | `analyte_text`、`value_num`、`unit_text`、`ref_text`、`method_text`、`org_text` | 不合并方法、不做差、不设阈值判定 |
| `imaging_events` | 一次影像/内镜 | `modality_text`、`region_text`、`impression_text` | 不设 RECIST/缓解/进展列 |
| `treatments` | 一段治疗 | `kind_text`、`name_text`、`regimen_text`、`cycles_text`、`intent_text` | 不评疗效、不排序线 |
| `medications` | 一种在用/停用药物 | `name_text`、`dose_text`、`schedule_text` | 不做相互作用检查 |
| `symptom_notes` | 一次症状自述 | `symptom_text`、`severity_num`（0–10 自评）、`context_text` | 不判病因、不给分诊结论 |
| `nutrition_records` | 一次体重/进食记录 | `weight_kg`、`height_cm`、`intake_text`、`supplements_text` | 不算 BMI 判读、不给剂量建议 |
| `followup_plans` | 一条医生安排的随访 | `planned_on`、`kind_text`、`status_text` | 不生成 `next_due`、不推算间隔 |
| `documents` | 一份原始资料 | `title_text`、`source_path_text`、`sha256_text`、`parse_status_text` | 不存文件正文、不自动上传 |
| `saved_trials` | 一条收藏的临床试验 | `registry_id`、`title_text`、`eligibility_text`、`url_text` | 不判断是否符合入组 |
| `viewpoints` | 一条患者/家属看法 | `topic_text`、`body_text`、`source_text` | 不设 `is_conclusion` |

## 读模型

- `bootstrap()`：档案列表、当前档案、各表计数、通道状态。
- `readLabs(key)`：按 `analyte → method+org` 分组；组内按日期升序；值缺失保留 `null`。
- `readImaging(key)` / `readTreatments(key)` / `readSymptoms(key)` / `readNutrition(key)` / `readFollowups(key)`：按日期倒序，`ORDER BY rowid` 兜底。
- `readDiagnoses(key)` / `readPathology(key)`：原话直出，附 `source: 'clinician-record'`。
- `readDocuments(key)` / `readSavedTrials(key)` / `readViewpoints(key)`：私密过滤后返回。

## 迁移

```bash
node -e "import('./dsh/store.js').then(m=>{const db=m.openStore(':memory:');console.log(m.tableNames(db).length)})"
```

冻结后只增不改；见 `schema/freeze-contract.md`。
