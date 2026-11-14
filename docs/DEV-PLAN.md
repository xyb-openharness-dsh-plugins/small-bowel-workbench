# DEV-PLAN · small-bowel-workbench

版本 0.2.0 · 2026-11-14 · 状态：M0–M6 完成，M7–M9 只出草稿；无人值守开发日，晨审未追认。

## 一、认领记录

- 病种：小肠腺癌（Small Bowel Adenocarcinoma, SBA）
- BACKLOG 定位：NCCN 病种表 #17 · 版本 3.2025 · 级别 T2 · 建议仓名 `small-bowel-workbench` · 招募对象 👤📝
- 认领前状态：**⬜ 招募中**
- 核验方式：目标 URL `https://raw.githubusercontent.com/xyb-openharness-dsh-plugins/.github/main/BACKLOG.md` 在本机 `curl` 环境无法解析域名；改用本机组织仓镜像 `/Users/qinxiaoqiang/Downloads/xyb-openharness-dsh-plugins.github/BACKLOG.md`（git HEAD `4d56608`，2026-10-31）核对，第 150 行为 ⬜。
- 远端复核：✅ 已通过 GitHub 连接器读取远端 `.github/BACKLOG.md`，该文件最新提交同为 `4d56608`（2026-10-31），该行为 ⬜；并以 `small-bowel-workbench` / 「小肠腺癌」检索 issues，未发现 SBA 认领 issue（关键词命中均为其他病种正文提及）。
- 未执行 `/claim`：`gh auth status` 显示 default token invalid，连接器亦无创建 issue / 仓库能力；无法建 issue 或评论。
- 仓状态：本地提交存于 `.gitstore`（沙箱拒绝 `.git`），未设 remote，未 push。

## 二、选择理由（BACKLOG §4 口径）

1. **真实空白**：家族已有胃癌、结直肠癌、壶腹部癌、GIST、肝胆与胰腺仓，但没有小肠原发腺癌仓；小肠腺癌在消化族里是独立病种，不能由结直肠癌仓替代。
2. **患者任务清楚**：确诊材料散（小肠镜/胶囊内镜/CT/病理）、手术记录与切缘难记、术后营养与体重是长期问题、复查项目多、临床试验入口少。适合做「资料整理 + 就诊准备」。
3. **差异化明确**：与壶腹部癌（Vater 壶腹、胰十二指肠切除为主）、胃癌、结直肠癌在解剖、分期表、手术方式与随访项目上均不同；详见 `DIFF-MATRIX.md`。
4. **风险可控**：不碰治疗推荐与预后判断，只做记录与呈现，适合无临床审核的 M0–M3 阶段。

## 三、里程碑

| 里程碑 | 内容 | 状态 | 证据 |
| --- | --- | --- | --- |
| M0 | 结构、README、DEV-REQUIREMENTS、SPEC/BRIEF、疾病概要、来源与差异矩阵 | ✅ 完成 | 本目录文件 |
| M1 | DSH 插件入口、health/bootstrap、静态服务、customFrame 外壳 | ✅ 完成 | `npm run check` 的 host/smoke 项 |
| M2 | SQLite 模型 0001、迁移 ledger、两套合成档案 | ✅ 完成 | `test/store.test.mjs`、`test/demo.test.mjs` |
| M3 | 八页骨架、只读 readmodels、三态与档案切换 | ✅ 完成 | `test/ui-contract.test.mjs`、`test/readmodels.test.mjs` |
| M4 | 本机临床库：范围/字段/通道终态快照 | ✅ 完成（LOCAL_ONLY） | `dsh/library.js`、`research/small-bowel-cancer/`、`check-clinical-library` |
| M5 | 开发版：12 类记录写入、隐私、导出、档案与资料目录 | ✅ 完成 | `public/app.js`、`test/ui-contract.test.mjs` |
| M6 | 装隔离测试 profile 并复扫 | ✅ 1/1 通过 | `.verify-results/check-profile-small-bowel-2.txt` |
| M7 | 只备 tag / release notes 草稿 | ✅ 草稿完成，未发 | `docs/release-draft/TAG-0.2.0.md` |
| M8 | 只备 BACKLOG 状态行草稿，不提 PR | ✅ 草稿完成，未提 | `docs/release-draft/BACKLOG-ROW.md` |
| M9 | 经验回流 | ✅ 完成 | `docs/LESSONS.md` |
| V2 | 真实 Desktop 界面加载与点击 | ⬜ 未做 | 未重启 Desktop |
| V3 | 真实用户流程与临床审核 | ⬜ 未做 | 0 患者访谈 / 0 临床审核 |

## 四、无人值守边界

允许：仓内文件、脚本、测试、本地 git commit、仓内隔离测试 profile。
冻结：tag、GitHub Release、BACKLOG 回填 PR（草稿在 `docs/release-draft/`）。
禁止：公开出版、向他人仓库推送、改日常 profile、重启 Desktop、读取真实患者资料。

## 五、已知风险

1. **解剖边界混淆**：用户可能把壶腹部癌、十二指肠乳头癌当成小肠腺癌。页面首屏与档案页必须显式说明收录范围。
2. **治疗外推**：小肠腺癌系统治疗常参考结直肠癌证据，但这属于医生决策；本台只存「医生原话」，不写方案推荐。
3. **营养问题被低估**：广泛小肠切除后的吸收不良、维生素 B12/铁/脂溶性维生素缺乏需要长期记录；页面用「记录 + 复诊时提问」呈现，不给补充剂剂量建议。
4. **0 患者访谈、0 临床审核**：所有文案都是工程假设，需在 M8 前补访谈与审核。
