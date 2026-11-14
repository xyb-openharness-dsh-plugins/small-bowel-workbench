# DAY-REPORT · 2026-11-14

## 一句话结论

小肠腺癌在远端与本机 BACKLOG 中均仍为 ⬜ 招募中，本开发日已在 `~/dev/small-bowel-workbench` 完成 M0–M3 本地工作台；`npm run check` 36/36 通过。因 `gh` token 失效且连接器无写权限，**认领、远端建仓与 push 未完成**，仅作本地提交。

## 做了什么

- **BACKLOG 核验**：`curl` 目标 raw URL 无 DNS；改用 GitHub 连接器读取远端 `.github/BACKLOG.md`，该文件最新提交 `4d56608`（2026-10-31），第 150 行 `#17 Small Bowel Adenocarcinoma / 小肠腺癌 / 3.2025 / T2 / small-bowel-workbench / ⬜ 招募中`，与本机镜像一致。issue 检索 `small-bowel-workbench` 为 0 条，`小肠腺癌` 的 4 条命中均为其他病种正文提及，无 SBA 认领 issue。未改选病种。
- **M0**：家族结构脚手架；`docs/DEV-REQUIREMENTS.md`、DEV-PLAN、SPEC/BRIEF、疾病概要四段、来源清单、与壶腹部/胃/结直肠/GIST 的差异矩阵、BACKLOG 快照。
- **M1**：`dsh/index.js` 四要素、`/api/small-bowel/health` 与认证闸、静态服务、`customFrame` 客户端外壳（业务 iframe + 原生会话右栏、可拖/可收起/窄屏抽屉）。
- **M2**：`schema/0001_initial.sql` 14 张表（subjects + section_titles + 12 张事实表）；迁移 ledger；两套合成档案 A（空肠术后）/ B（十二指肠 MSI-H）；`is_private`、`superseded_by`、`ver`。
- **M3**：八页只读骨架（今天 / 档案 / 检查 / 治疗 / 症状与营养 / 随访 / 试验 / 资料）；加载/空/错误三态；档案切换联动；化验按「方法 + 机构」分组；体重单独成线；疾病概要弹窗；打印样式。
- **配套**：`npm run check` 检查链（包合同、宿主合同、资料目录、schema 红线、文案红线、静态引用、派生残留、面板合同、版本同源、客户端构建同步、激活烟测）；36 个单测 + DOM 桩页面运行时测试。
- **纪律**：未发 Release/tag，未装机到真实 DSH Desktop，未改本仓以外文件，未读取真实患者资料。本地提交存于仓内 `.gitstore`（哈希见其日志；沙箱拒绝创建 `.git`）。

## 测试结果

```text
✓ 包合同：@xyb-community/small-bowel-workbench@0.1.0
✓ 宿主合同：name / inject / Config / apply / 认证
✓ 资料目录口径：9 个用例
✓ schema 红线：14 张表，判读列 0 命中
✓ 文案红线：0 命中
✓ 静态引用：4 条；八页与三态齐全
✓ 派生残留：0 命中
✓ 面板合同：conversation / 分栏 / 持久化 / 注册
✓ 版本同源：0.1.0
✓ lib/version.js 与 VERSION 同步
✓ lib/client.js 与源同步
✓ 激活烟测：register 1 次，描述符合法，Panel 是函数
# tests 36
# pass 36
# fail 0
```

- `npm run check`：通过（V1 包级）。
- `npm run pack:check`：dry-run 通过；21 个文件，tarball 46.1 kB，未生成 `.tgz`。
- 页面运行时：用最小 DOM 桩执行真实 `public/app.js`，八页均生成内容，无 `undefined` / `NaN`；CEA 两组不合并；只读桥可切页。
- 构建：`lib/client.js` 与 `lib/version.js` 由脚本生成且 `--check` 同步。

## 未验证项

- **远端 BACKLOG**：已通过连接器读到 HEAD `4d56608`（2026-10-31）且无认领 issue；但连接器读取为展示层，未逐字节比对整份远端文件。
- **认领与远端仓**：`gh auth status` 显示 default token invalid，连接器无创建 issue / 仓库能力；未发 `/claim`、未建 GitHub 仓、未 push。仅本地提交存于 `.gitstore`。
- **V2 装机**：未装 DSH Desktop，`apply()` 的真宿主生命周期、iframe 挂载、原生会话接线未实测。
- **V3 业务**：0 患者访谈、0 临床审核；所有文案与阈值是工程假设。
- **HTTP 监听**：沙箱禁止 `listen`（`EPERM 127.0.0.1`），`npm start` 端口未实测；路由用 in-process handler 测试。
- **视觉验收**：Chrome headless 在本沙箱退出码 134，未取得截图；只做了 DOM 桩运行时验证，不是视觉/响应式验收。
- **文档导入 / 试验检索 / AI 草稿桥**：分别留到 M5 / M6 / M4+，当前 UI 明确标「未接通」。
- **标准 `.git` 布局**：沙箱对仓根 `.git` 写入返回 `Operation not permitted`，本提交存于 `.gitstore/`；标准 `git status` 不识别，需 `git --git-dir=.gitstore --work-tree=.` 或迁出沙箱后将 `.gitstore` 改名为 `.git`。

## 待用户决定（最多 3 条）

1. **品牌名**：当前占位「小肠宝 SmallBowelPal」，是否采用？定名后全局替换。
2. **认领恢复**：是否由你恢复 `gh auth` 后，让我按 `docs/release-draft/CLAIM-ISSUE.md` 发 `/claim` 并建远端仓、push 本地提交？
3. **M4 优先级**：下一步先做「新增/编辑记录 + 私密切换」，还是先做「就诊前一页纸导出 + 打印」？
