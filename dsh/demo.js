/**
 * 合成演示档案唯一来源。
 *
 * 规则：
 *   - 两套档案（A 空肠术后、B 十二指肠 MSI-H）覆盖不同部位、不同分子结果、不同随访阶段；
 *   - 医院、医生、路径、试验编号全部是虚构/占位，不对应真实机构或个人；
 *   - 每条临床内容都带「示例」或「（原文）」标记，界面另加全局「合成示例」常显条。
 */

const DEMO_A = 'demo-sba-a';
const DEMO_B = 'demo-sba-b';

function run(db, sql, params = []) {
  return db.prepare(sql).run(...params);
}

export const DEMO_KEYS = Object.freeze([DEMO_A, DEMO_B]);

export function hasDemoData(db) {
  const row = db.prepare('SELECT COUNT(*) AS n FROM subjects WHERE is_demo = 1').get();
  return Number(row?.n || 0) > 0;
}

export function seedDemoData(db) {
  if (hasDemoData(db)) return { seeded: false, profiles: 0 };

  db.exec('BEGIN');
  try {
    run(db, `INSERT INTO subjects
      (profile_key,name,is_demo,birth_year,sex_text,primary_site_text,histology_text,diagnosed_on,hospital_text,clinician_text,action_plan_text)
      VALUES (?,?,1,?,?,?,?,?,?,?,?)`, [
      DEMO_A, '示例档案 A · 空肠腺癌术后', 1968, '女', '空肠',
      '腺癌（肠型）', '2025-06-18', '示例医院·消化肿瘤中心（虚构）', '示例医生（虚构）',
      '下次复诊：肿瘤内科门诊（示例）。带好术后病理、最近一次 CT 报告与当前用药清单。',
    ]);
    run(db, `INSERT INTO subjects
      (profile_key,name,is_demo,birth_year,sex_text,primary_site_text,histology_text,diagnosed_on,hospital_text,clinician_text,action_plan_text)
      VALUES (?,?,1,?,?,?,?,?,?,?,?)`, [
      DEMO_B, '示例档案 B · 十二指肠腺癌（MSI-H）', 1959, '男', '十二指肠',
      '腺癌（肠型）', '2026-01-09', '示例医院·肝胆胰中心（虚构）', '示例医生（虚构）',
      '下次复诊：肿瘤内科门诊（示例）。带好手术记录、病理与基因检测报告。',
    ]);

    const titles = [
      ['today', '今天', '先看最近变化与下次复诊要带的东西。'],
      ['record', '档案', '确诊、病理与分子检测的医生原话。'],
      ['tests', '检查', '化验按方法与机构分组；影像按时间排列。'],
      ['treatment', '治疗', '手术、系统治疗与当前用药。'],
      ['symptoms', '症状与营养', '你自己的感受、体重与进食记录。'],
      ['followup', '随访', '医生已安排的复诊与检查。'],
      ['trials', '试验', '收藏的临床研究；检索未接通时如实标注。'],
      ['documents', '资料', '原始报告清单与解析状态。'],
    ];
    for (const [key, title, hint] of titles) {
      run(db, 'INSERT INTO section_titles (section_key,title_text,hint_text) VALUES (?,?,?)', [key, title, hint]);
    }

    /* ---------- 档案 A ---------- */
    run(db, `INSERT INTO diagnoses
      (profile_key,site_code,site_text,histology_text,grade_text,stage_text,diagnosed_on,hospital_text,basis_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [
      DEMO_A, 'jejunum', '空肠上段', '腺癌（肠型）', '中分化（医生记录）', 'pT3N1M0（医生记录，原文）',
      '2025-06-18', '示例医院·消化肿瘤中心（虚构）',
      '小肠镜活检 + 2025-06-18 根治性小肠段切除术后病理（示例）',
      '示例：分期写法照录病理/出院记录，本台不重新计算。',
    ]);
    run(db, `INSERT INTO pathology_reports
      (profile_key,specimen_text,collected_on,reported_on,hospital_text,findings_text,margin_text,nodes_examined,nodes_positive,molecular_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,0)`, [
      DEMO_A, '空肠段切除标本', '2025-06-18', '2025-06-25', '示例医院·病理科（虚构）',
      '溃疡型腺癌，浸润肠壁全层；未见脉管癌栓（示例）。',
      '切缘：近端（-），远端（-）（原文照录）', 14, 2,
      'MSI：MSS；HER2：未检测；NTRK：未检测；KRAS：未检测（示例报告原文）',
      '示例：分子结果只照录，不解释意义。',
    ]);
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_A, '2025-07-10', 'CEA', 2.1, 'ng/mL', '0–5（示例）', '化学发光', '示例医院 A（虚构）', null, null]);
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_A, '2025-10-12', 'CEA', 2.6, 'ng/mL', '0–5（示例）', '化学发光', '示例医院 A（虚构）', null, null]);
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_A, '2026-03-08', 'CEA', 2.4, 'ng/mL', '0–5（示例）', '化学发光', '示例医院 A（虚构）', null, null]);
    /* 不同机构/方法：单独成组，不与上面连线 */
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_A, '2026-05-11', 'CEA', 3.0, 'ng/mL', '0–5（示例）', '免疫荧光', '示例医院 B（虚构）', null, '换机构复查（示例）']);
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_A, '2025-07-10', '血红蛋白', 108, 'g/L', '115–150（示例）', '血细胞分析', '示例医院 A（虚构）', '低值（按报告原文）', null]);
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_A, '2025-10-12', '血红蛋白', 118, 'g/L', '115–150（示例）', '血细胞分析', '示例医院 A（虚构）', null, null]);
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_A, '2026-03-08', '血红蛋白', 121, 'g/L', '115–150（示例）', '血细胞分析', '示例医院 A（虚构）', null, null]);
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_A, '2026-03-08', '白蛋白', 40.1, 'g/L', '40–55（示例）', '生化', '示例医院 A（虚构）', null, null]);
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_A, '2026-03-08', '维生素 B12', 210, 'pg/mL', '200–900（示例）', '化学发光', '示例医院 A（虚构）', '低值（按报告原文）', '示例：是否补充由医生决定。']);
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_A, '2026-06-01', '铁蛋白', 18, 'ng/mL', '15–150（示例）', '化学发光', '示例医院 A（虚构）', null, null]);

    run(db, `INSERT INTO imaging_events
      (profile_key,performed_on,modality_text,region_text,org_text,impression_text,report_ref_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,0)`, [DEMO_A, '2025-06-05', 'CT', '腹盆（增强）', '示例医院 A（虚构）',
      '空肠上段肠壁增厚，考虑肿瘤性病变；未见远处转移（示例）。', '影像报告 2025-06-05', null]);
    run(db, `INSERT INTO imaging_events
      (profile_key,performed_on,modality_text,region_text,org_text,impression_text,report_ref_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,0)`, [DEMO_A, '2025-07-30', 'CT', '胸腹盆（增强）', '示例医院 A（虚构）',
      '术后改变；未见明确复发征象（示例）。', '影像报告 2025-07-30', null]);
    run(db, `INSERT INTO imaging_events
      (profile_key,performed_on,modality_text,region_text,org_text,impression_text,report_ref_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,0)`, [DEMO_A, '2025-12-15', 'MRI', '小肠', '示例医院 A（虚构）',
      '吻合口通畅，未见异常强化（示例）。', '影像报告 2025-12-15', null]);
    run(db, `INSERT INTO imaging_events
      (profile_key,performed_on,modality_text,region_text,org_text,impression_text,report_ref_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,0)`, [DEMO_A, '2026-06-20', 'CT', '胸腹盆（增强）', '示例医院 B（虚构）',
      '未见明确复发或转移征象（示例）。', '影像报告 2026-06-20', '换机构复查（示例）']);

    run(db, `INSERT INTO treatments
      (profile_key,kind_text,name_text,started_on,ended_on,intent_text,regimen_text,cycles_text,hospital_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_A, '手术', '根治性小肠段切除 + 区域淋巴结清扫', '2025-06-18', '2025-06-25',
      '根治性（医生记录）', null, null, '示例医院 A（虚构）', '术后恢复情况按出院记录。']);
    run(db, `INSERT INTO treatments
      (profile_key,kind_text,name_text,started_on,ended_on,intent_text,regimen_text,cycles_text,hospital_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_A, '系统治疗', '术后辅助化疗', '2025-07-15', '2025-12-20',
      '术后辅助（医生记录）', 'CAPOX（示例方案，按医嘱原文）', '6 周期（示例）', '示例医院 A（虚构）', '剂量调整与止吐方案按医嘱。']);

    run(db, `INSERT INTO medications
      (profile_key,name_text,dose_text,schedule_text,started_on,ended_on,purpose_text,prescriber_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,0)`, [DEMO_A, '奥沙利铂', '按体表面积计算（示例）', '每 3 周 1 次（示例）', '2025-07-15', '2025-12-20', '辅助化疗（医生记录）', '示例医生（虚构）', '已结束。']);
    run(db, `INSERT INTO medications
      (profile_key,name_text,dose_text,schedule_text,started_on,ended_on,purpose_text,prescriber_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,0)`, [DEMO_A, '卡培他滨', '按医嘱（示例）', '每日两次，服 14 天停 7 天（示例）', '2025-07-15', '2025-12-20', '辅助化疗（医生记录）', '示例医生（虚构）', '已结束。']);
    run(db, `INSERT INTO medications
      (profile_key,name_text,dose_text,schedule_text,started_on,ended_on,purpose_text,prescriber_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,0)`, [DEMO_A, '复合维生素', '每日 1 片（示例）', '每日一次', '2025-08-01', null, '营养补充（医生建议，示例）', '示例医生（虚构）', '仍在用。']);
    run(db, `INSERT INTO medications
      (profile_key,name_text,dose_text,schedule_text,started_on,ended_on,purpose_text,prescriber_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,0)`, [DEMO_A, '维生素 B12 注射', '按医嘱（示例）', '每 3 个月 1 次（示例）', '2026-03-20', null, 'B12 偏低（报告原文）', '示例医生（虚构）', '下次注射时间按门诊安排。']);

    run(db, `INSERT INTO symptom_notes
      (profile_key,occurred_on,symptom_text,severity_num,duration_text,context_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,0)`, [DEMO_A, '2025-09-02', '手脚发麻，碰冷水更明显', 3, '约 5 天', '化疗期间（示例）', '告诉过门诊医生。']);
    run(db, `INSERT INTO symptom_notes
      (profile_key,occurred_on,symptom_text,severity_num,duration_text,context_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,0)`, [DEMO_A, '2025-11-18', '腹泻，一天 4 次', 4, '2 天', '化疗后（示例）', '按医嘱补液。']);
    run(db, `INSERT INTO symptom_notes
      (profile_key,occurred_on,symptom_text,severity_num,duration_text,context_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,0)`, [DEMO_A, '2026-01-10', '饭后腹胀，吃一点就饱', 2, '1 周', '日常（示例）', '少量多餐后缓解。']);
    run(db, `INSERT INTO symptom_notes
      (profile_key,occurred_on,symptom_text,severity_num,duration_text,context_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,0)`, [DEMO_A, '2026-05-20', '容易累，走两层楼要歇', 5, '约 10 天', '日常（示例）', '复诊时想问是否需要查血。']);

    run(db, `INSERT INTO nutrition_records
      (profile_key,measured_on,weight_kg,height_cm,intake_text,supplements_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,0)`, [DEMO_A, '2025-06-10', 62.0, 168, '正常饮食（示例）', '无', '术前。']);
    run(db, `INSERT INTO nutrition_records
      (profile_key,measured_on,weight_kg,height_cm,intake_text,supplements_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,0)`, [DEMO_A, '2025-08-01', 58.5, 168, '少量多餐，日均 5 餐（示例）', '口服营养补充 2 次/日（示例）', '术后 6 周。']);
    run(db, `INSERT INTO nutrition_records
      (profile_key,measured_on,weight_kg,height_cm,intake_text,supplements_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,0)`, [DEMO_A, '2025-11-01', 57.8, 168, '少量多餐（示例）', '口服营养补充 2 次/日（示例）', null]);
    run(db, `INSERT INTO nutrition_records
      (profile_key,measured_on,weight_kg,height_cm,intake_text,supplements_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,0)`, [DEMO_A, '2026-03-01', 59.4, 168, '三餐 + 两次加餐（示例）', '复合维生素（示例）', null]);
    run(db, `INSERT INTO nutrition_records
      (profile_key,measured_on,weight_kg,height_cm,intake_text,supplements_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,0)`, [DEMO_A, '2026-06-01', 60.2, 168, '三餐 + 两次加餐（示例）', '复合维生素、B12 注射（示例）', null]);

    run(db, `INSERT INTO followup_plans
      (profile_key,planned_on,kind_text,status_text,hospital_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,0)`, [DEMO_A, '2025-09-15', '肿瘤内科复诊', '已完成（示例）', '示例医院 A（虚构）', '带出院记录。']);
    run(db, `INSERT INTO followup_plans
      (profile_key,planned_on,kind_text,status_text,hospital_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,0)`, [DEMO_A, '2025-12-15', '影像复查', '已完成（示例）', '示例医院 A（虚构）', 'MRI 小肠。']);
    run(db, `INSERT INTO followup_plans
      (profile_key,planned_on,kind_text,status_text,hospital_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,0)`, [DEMO_A, '2026-03-10', '化验 + 门诊', '已完成（示例）', '示例医院 A（虚构）', '含 B12、铁蛋白。']);
    run(db, `INSERT INTO followup_plans
      (profile_key,planned_on,kind_text,status_text,hospital_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,0)`, [DEMO_A, '2026-09-20', '门诊复诊', '待复诊（医生安排，示例）', '示例医院 A（虚构）', '带最近一次 CT 与用药清单。']);

    run(db, `INSERT INTO documents
      (profile_key,title_text,doc_type_text,added_on,source_path_text,sha256_text,parse_status_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,0)`, [DEMO_A, '术后病理报告', '病理', '2025-06-26', '/示例/档案A/病理报告.pdf',
      '0000000000000000000000000000000000000000000000000000000000000000', '未接通（MinerU 未配置）', '示例路径，不对应真实文件。']);
    run(db, `INSERT INTO documents
      (profile_key,title_text,doc_type_text,added_on,source_path_text,sha256_text,parse_status_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,0)`, [DEMO_A, '2026-06-20 腹部 CT 报告', '影像', '2026-06-21', '/示例/档案A/CT-20260620.pdf',
      '0000000000000000000000000000000000000000000000000000000000000000', '未接通（MinerU 未配置）', '示例路径，不对应真实文件。']);
    run(db, `INSERT INTO saved_trials
      (profile_key,registry_id,title_text,status_text,eligibility_text,site_text,url_text,saved_on,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,0)`, [DEMO_A, '示例-NCT-0000', '示例：小肠腺癌术后辅助治疗研究（占位，不对应真实试验）',
      '示例状态', '示例入组条件，需向研究团队核实', '示例中心', null, '2026-06-25', '仅演示收藏结构；未联网核对。']);
    run(db, `INSERT INTO viewpoints
      (profile_key,topic_text,body_text,source_text,recorded_on,is_private)
      VALUES (?,?,?,?,?,0)`, [DEMO_A, '复查间隔',
      '最想知道的是：如果这次复查指标都正常，复查间隔能不能拉长？', '患者自述（示例）', '2026-06-21']);

    /* ---------- 档案 B ---------- */
    run(db, `INSERT INTO diagnoses
      (profile_key,site_code,site_text,histology_text,grade_text,stage_text,diagnosed_on,hospital_text,basis_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [
      DEMO_B, 'duodenum', '十二指肠降部', '腺癌（肠型）', '低分化（医生记录）', 'pT2N0M0（医生记录，原文）',
      '2026-01-09', '示例医院·肝胆胰中心（虚构）',
      '十二指肠镜活检 + 2026-01-15 胰十二指肠切除术后病理（示例）',
      '示例：壶腹部来源已由病理/影像评估，本台不重判。',
    ]);
    run(db, `INSERT INTO pathology_reports
      (profile_key,specimen_text,collected_on,reported_on,hospital_text,findings_text,margin_text,nodes_examined,nodes_positive,molecular_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,0)`, [
      DEMO_B, '胰十二指肠切除标本', '2026-01-15', '2026-01-24', '示例医院·病理科（虚构）',
      '十二指肠腺癌，浸润肠壁肌层；未见脉管癌栓（示例）。',
      '切缘：R0（原文照录）', 18, 0,
      'MSI-H / dMMR（MLH1、PMS2 缺失，原文）；HER2 IHC 0；NTRK 未检测；BRAF V600E 未检测（示例）',
      '示例：分子结果只照录。',
    ]);
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_B, '2026-01-05', 'CEA', 4.8, 'ng/mL', '0–5（示例）', '化学发光', '示例医院 C（虚构）', null, null]);
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_B, '2026-04-02', 'CEA', 3.2, 'ng/mL', '0–5（示例）', '化学发光', '示例医院 C（虚构）', null, null]);
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_B, '2026-09-10', 'CEA', 2.9, 'ng/mL', '0–5（示例）', '化学发光', '示例医院 C（虚构）', null, null]);
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_B, '2026-01-05', 'CA19-9', 22.0, 'U/mL', '0–37（示例）', '化学发光', '示例医院 C（虚构）', null, null]);
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_B, '2026-04-02', 'CA19-9', 19.5, 'U/mL', '0–37（示例）', '化学发光', '示例医院 C（虚构）', null, null]);
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_B, '2026-02-01', '血红蛋白', 106, 'g/L', '130–175（示例）', '血细胞分析', '示例医院 C（虚构）', '低值（按报告原文）', null]);
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_B, '2026-05-01', '血红蛋白', 124, 'g/L', '130–175（示例）', '血细胞分析', '示例医院 C（虚构）', '低值（按报告原文）', null]);
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_B, '2026-09-10', '血红蛋白', 131, 'g/L', '130–175（示例）', '血细胞分析', '示例医院 C（虚构）', null, null]);
    run(db, `INSERT INTO lab_results
      (profile_key,collected_on,analyte_text,value_num,unit_text,ref_text,method_text,org_text,flag_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_B, '2026-09-10', '叶酸', 9.2, 'ng/mL', '3–17（示例）', '化学发光', '示例医院 C（虚构）', null, null]);

    run(db, `INSERT INTO imaging_events
      (profile_key,performed_on,modality_text,region_text,org_text,impression_text,report_ref_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,0)`, [DEMO_B, '2026-01-05', 'CT', '腹盆（增强）', '示例医院 C（虚构）',
      '十二指肠降部占位，考虑恶性；未见远处转移（示例）。', '影像报告 2026-01-05', null]);
    run(db, `INSERT INTO imaging_events
      (profile_key,performed_on,modality_text,region_text,org_text,impression_text,report_ref_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,0)`, [DEMO_B, '2026-04-02', 'CT', '胸腹盆（增强）', '示例医院 C（虚构）',
      '术后改变；未见明确复发征象（示例）。', '影像报告 2026-04-02', null]);
    run(db, `INSERT INTO imaging_events
      (profile_key,performed_on,modality_text,region_text,org_text,impression_text,report_ref_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,0)`, [DEMO_B, '2026-09-10', 'MRI', '肝胆胰', '示例医院 C（虚构）',
      '吻合口通畅；肝内未见异常信号（示例）。', '影像报告 2026-09-10', null]);

    run(db, `INSERT INTO treatments
      (profile_key,kind_text,name_text,started_on,ended_on,intent_text,regimen_text,cycles_text,hospital_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_B, '手术', '胰十二指肠切除（Whipple，示例）', '2026-01-15', '2026-02-02',
      '根治性（医生记录）', null, null, '示例医院 C（虚构）', '术后病理见档案。']);
    run(db, `INSERT INTO treatments
      (profile_key,kind_text,name_text,started_on,ended_on,intent_text,regimen_text,cycles_text,hospital_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,?,0)`, [DEMO_B, '系统治疗', '术后辅助化疗', '2026-02-20', '2026-07-10',
      '术后辅助（医生记录）', 'mFOLFOX6（示例方案，按医嘱原文）', '6 周期（示例）', '示例医院 C（虚构）', '剂量调整按医嘱。']);

    run(db, `INSERT INTO medications
      (profile_key,name_text,dose_text,schedule_text,started_on,ended_on,purpose_text,prescriber_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,0)`, [DEMO_B, '胰酶制剂', '按医嘱（示例）', '随餐服用（示例）', '2026-02-05', null, '术后消化酶补充（医生记录）', '示例医生（虚构）', '仍在用。']);
    run(db, `INSERT INTO medications
      (profile_key,name_text,dose_text,schedule_text,started_on,ended_on,purpose_text,prescriber_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,0)`, [DEMO_B, '奥沙利铂', '按体表面积计算（示例）', '每 2 周 1 次（示例）', '2026-02-20', '2026-07-10', '辅助化疗（医生记录）', '示例医生（虚构）', '已结束。']);

    run(db, `INSERT INTO symptom_notes
      (profile_key,occurred_on,symptom_text,severity_num,duration_text,context_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,0)`, [DEMO_B, '2026-03-12', '吃完饭后上腹胀，嗳气', 4, '约 2 周', '术后（示例）', '少量多餐后好些。']);
    run(db, `INSERT INTO symptom_notes
      (profile_key,occurred_on,symptom_text,severity_num,duration_text,context_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,0)`, [DEMO_B, '2026-04-20', '大便不成形，一天 3 次', 3, '4 天', '化疗期间（示例）', '告诉了门诊护士。']);
    run(db, `INSERT INTO symptom_notes
      (profile_key,occurred_on,symptom_text,severity_num,duration_text,context_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,0)`, [DEMO_B, '2026-08-01', '体重比术前轻了 6 公斤，衣服变松', 6, '持续', '日常（示例）', '复诊时想问营养门诊。']);

    run(db, `INSERT INTO nutrition_records
      (profile_key,measured_on,weight_kg,height_cm,intake_text,supplements_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,0)`, [DEMO_B, '2025-12-20', 70.0, 172, '正常饮食（示例）', '无', '术前。']);
    run(db, `INSERT INTO nutrition_records
      (profile_key,measured_on,weight_kg,height_cm,intake_text,supplements_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,0)`, [DEMO_B, '2026-02-01', 64.5, 172, '少量多餐（示例）', '胰酶制剂（示例）', '术后 2 周。']);
    run(db, `INSERT INTO nutrition_records
      (profile_key,measured_on,weight_kg,height_cm,intake_text,supplements_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,0)`, [DEMO_B, '2026-05-01', 63.0, 172, '三餐 + 加餐（示例）', '胰酶制剂（示例）', null]);
    run(db, `INSERT INTO nutrition_records
      (profile_key,measured_on,weight_kg,height_cm,intake_text,supplements_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,0)`, [DEMO_B, '2026-09-01', 64.2, 172, '三餐 + 加餐（示例）', '胰酶制剂（示例）', null]);

    run(db, `INSERT INTO followup_plans
      (profile_key,planned_on,kind_text,status_text,hospital_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,0)`, [DEMO_B, '2026-04-02', '影像复查', '已完成（示例）', '示例医院 C（虚构）', '胸腹盆 CT。']);
    run(db, `INSERT INTO followup_plans
      (profile_key,planned_on,kind_text,status_text,hospital_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,0)`, [DEMO_B, '2026-07-10', '肿瘤内科复诊', '已完成（示例）', '示例医院 C（虚构）', '化疗结束评估。']);
    run(db, `INSERT INTO followup_plans
      (profile_key,planned_on,kind_text,status_text,hospital_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,0)`, [DEMO_B, '2026-10-15', '门诊复诊', '待复诊（医生安排，示例）', '示例医院 C（虚构）', '带基因检测与最近影像。']);

    run(db, `INSERT INTO documents
      (profile_key,title_text,doc_type_text,added_on,source_path_text,sha256_text,parse_status_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,0)`, [DEMO_B, '手术记录', '手术', '2026-02-03', '/示例/档案B/手术记录.pdf',
      '0000000000000000000000000000000000000000000000000000000000000000', '未接通（MinerU 未配置）', '示例路径，不对应真实文件。']);
    run(db, `INSERT INTO documents
      (profile_key,title_text,doc_type_text,added_on,source_path_text,sha256_text,parse_status_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,0)`, [DEMO_B, '术后病理报告', '病理', '2026-01-25', '/示例/档案B/病理报告.pdf',
      '0000000000000000000000000000000000000000000000000000000000000000', '未接通（MinerU 未配置）', '示例路径，不对应真实文件。']);
    run(db, `INSERT INTO documents
      (profile_key,title_text,doc_type_text,added_on,source_path_text,sha256_text,parse_status_text,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,0)`, [DEMO_B, '基因检测报告', '分子检测', '2026-02-10', '/示例/档案B/基因检测.pdf',
      '0000000000000000000000000000000000000000000000000000000000000000', '未接通（MinerU 未配置）', '示例路径，不对应真实文件。']);
    run(db, `INSERT INTO saved_trials
      (profile_key,registry_id,title_text,status_text,eligibility_text,site_text,url_text,saved_on,note_text,is_private)
      VALUES (?,?,?,?,?,?,?,?,?,0)`, [DEMO_B, '示例-NCT-0001', '示例：MSI-H 实体瘤免疫治疗研究（占位，不对应真实试验）',
      '示例状态', '示例入组条件，需向研究团队核实', '示例中心', null, '2026-09-12', '仅演示收藏结构；未联网核对。']);
    run(db, `INSERT INTO viewpoints
      (profile_key,topic_text,body_text,source_text,recorded_on,is_private)
      VALUES (?,?,?,?,?,0)`, [DEMO_B, '免疫治疗',
      '报告写 MSI-H，是不是可以用免疫治疗？想在复诊时问医生。', '患者家属转述（示例）', '2026-09-12']);

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw new Error('演示数据播种失败：' + error.message);
  }
  return { seeded: true, profiles: 2 };
}
