# 小肠宝 SmallBowelPal · 小肠腺癌患者工作台

版本 0.2.2 · 2026-11-19 · 状态：**M0–M6 开发版**（测试 profile 扫描通过；未发布、未临床审核）。

本机优先的小肠腺癌（Small Bowel Adenocarcinoma, SBA）确诊档案、病理与分子检测、手术/系统治疗、化验影像、症状营养与复诊准备工具。目标用户：已确诊的成人患者本人与家属照护者。

**诚实声明：0 患者访谈、0 临床审核。** 所有医学阈值与复查间隔均为【待核】；判读归医生。演示数据全部是**合成示例**，不对应真实患者。

## 疾病概要

> 四段固定：定义 → 医学资料规范和指南情况 → 目前治疗全景概要 → 发展趋势。页面顶栏「?」打开同一份内容；完整版见 `docs/DISEASE-PRIMER.md`。

### 定义

小肠腺癌是起源于小肠黏膜上皮的恶性肿瘤，最常见于十二指肠，其次为空肠与回肠。小肠只占全部消化道恶性肿瘤的很小比例，因此它属于少见肿瘤。诊断边界很重要：壶腹部癌（Vater 壶腹）分期与手术方式不同；胰腺、远端胆管来源侵犯十二指肠不属于小肠原发；GIST、神经内分泌肿瘤、淋巴瘤也不是本台范围。

**来源**：NCCN Guidelines · Small Bowel Adenocarcinoma（3.2025，据组织 BACKLOG）· 未取得原件 · 页码待核 ｜ WHO Digestive System Tumours, 5th ed.（2019）· 未取得原件。

### 医学资料规范和指南情况

| 机构 | 文件 | 版本/年份 | 原件 |
| --- | --- | --- | --- |
| NCCN | Small Bowel Adenocarcinoma | 3.2025（BACKLOG 记录） | 未取得 |
| AJCC / UICC | Cancer Staging Manual（小肠章节） | 8th ed.（2017） | 未取得 |
| WHO | Digestive System Tumours | 5th ed.（2019） | 未取得 |
| 中国 | 国内指南/共识 | 待核 | 未取得 |

本台不复制条文，也不把指南条目转成建议；病理、分子检测、分期与治疗计划一律按医生原话记录。

### 目前治疗全景概要

公开资料里通常围绕手术（肠段切除，十二指肠部位可能涉及胰十二指肠切除）、术后辅助治疗（是否做由病理风险与医生判断；常参考结直肠癌的氟尿嘧啶/奥沙利铂方案，属证据外推）、晚期系统治疗、分子检测（MSI/dMMR、HER2、NTRK、BRAF、KRAS/NRAS）与支持治疗（营养、疼痛、恶心呕吐、腹泻、肠梗阻风险）展开。具体到个人由医生决定，本台不提供推荐。

### 发展趋势

分子分型进入常规讨论；少见病种向高容量中心集中；营养与生活质量管理前移；临床试验仍是主要证据来源。

## 当前能力（M0–M6）

- 八个页面骨架：今天 / 档案 / 检查 / 治疗 / 症状与营养 / 随访 / 试验 / 资料。
- 本机写入：确诊、病理、化验、影像、治疗、用药、症状、营养、随访、文档、收藏试验与问题记录；字段白名单落库。
- 隐私：逐条「设为私密/公开」；摘要、`/export` 与 AI 上下文统一由 `is_private` 过滤。
- 导出：`/api/small-bowel/export` 只导出非私密记录；打印样式可带一页就诊材料。
- 只读数据流：SQLite 初始模型（14 张表）→ readmodels → `/api/small-bowel/read/*` → 页面。
- 两套合成档案：空肠腺癌术后（A）与十二指肠腺癌 MSI-H（B），切换时全页联动。
- 化验按「方法 + 机构」分组，不跨组合并；影像按时间排列；体重单独成线。
- DSH 客户端外壳：`customFrame` + 业务 iframe + 原生会话右栏（宿主管理），宽度可拖、可收起。
- 面板契约：`newSession` 创建归属会话、`subscribe` 跟随会话变化刷新、`currentSession + ownsSession` 判归属；会话区常挂载只切 `display`。

## 本机临床库（M4）

`dsh/library.js` 是单一来源，生成 `research/small-bowel-cancer/` 的 JSONL + SQLite 快照。当前 10 条**范围与记录口径**条目、4 个来源终态；全部标记 `pending-clinical-review`。

- 未取得 NCCN 3.2025 原件，不复制指南正文，不给诊断/治疗建议。
- ClinicalTrials.gov 通道为 `NOT_CONNECTED`；页面不显示试验条数，也不生成匹配结论。
- `npm run check` 中的 `check-clinical-library` 校验来源、审核状态与判读/推荐词红线。

## 未实现 / 未验证

- 记录编辑（只支持新增与隐私切换，不支持修改/删除单条记录）。
- 文档导入与 MinerU 解析；当前只登记元数据，状态写「未接通」。
- 临床试验联网检索与快照；当前通道 `NOT_CONNECTED`，不显示条数。
- 真实 Desktop 界面加载、点击与视觉验收（本轮只装隔离测试 profile，未重开 Desktop）。
- 患者访谈、临床审核、G1/G2/G3 签认。

## 开发与本地验收

需要 Node.js 22+（`node:sqlite`）。本仓**零运行期依赖**，不执行 `npm install` 也能跑检查。

```bash
npm run check
npm start -- --root "$HOME/Documents/small-bowel-data"
# 打开 http://127.0.0.1:8917/small-bowel/
```

不传 `--root` 时使用临时目录，仅用于看演示；主目录、桌面、下载根与 `/tmp` 不作为正式资料目录。

## 仓库结构

```text
dsh/       宿主插件入口、HTTP、工作台服务、SQLite、读模型、合成演示
lib/       身份、面板参数、版本（生成）、客户端产物（生成）
src/       客户端源文件
public/    页面、样式、疾病概要
schema/    0001 初始模型与冻结合同
research/  本机临床库快照（JSONL + SQLite + manifest）
scripts/   构建、检查、独立启动
docs/      需求、计划、规格、数据模型、来源与验收
test/      单元/接口/页面合同测试
```

## 边界

本台只做资料整理与就诊准备，不做诊断、分期判定、复发风险评估、疗效评价或治疗推荐；不连接医院账号；不上传云端；不内置密钥。

认领与 BACKLOG 状态见 `docs/DEV-PLAN.md`、`docs/31-BACKLOG-STATUS.md`；本开发日未推送远端，原因见 `DAY-REPORT.md`。
