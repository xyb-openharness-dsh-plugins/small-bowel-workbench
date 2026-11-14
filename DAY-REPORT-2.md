# DAY-REPORT-2 · 2026-11-14（第二轮）

## 一句话结论

VERIFY-REPORT 的 P1 面板契约已修复：0.2.0 装进隔离测试 profile 后，家族 `check-profile` 复扫 **1/1 通过**（`newSession=1` / `subscribe=1` / `ensureSession=0` / `Boolean(conversation)=0`）；同时完成 M4 临床库、M5 开发版、M7–M9 草稿。未重启 Desktop、未改日常 profile、未发 Release/tag、未 push。

## 一、逐条对应 VERIFY-REPORT 问题清单

### P1 · AI 面板契约不满足装机门槛 → 已修复并通过复扫

- 修复内容：`src/client.js` 补 `bridge`、`currentSession()`、`ownsSession()`、`ownedSession()`、`createOwnedSession()`；`apply(ctx)` 注入宿主上下文；`Panel` 订阅 `desktopWorkbenches.subscribe`，无归属会话时点「AI 对话」调用 `newSession(defaultWorkspace()?.workspaceId)`。
- 失败模式消除：`ensureSession(` 计数 0；`Boolean(conversation)` 计数 0；不再用隐藏 conversation 容器判会话。
- 产物证据：重新 `build:client` 后 `lib/client.js` 注入 0.2.0；`check-agent-pane-contract` 同时校验源码与产物四项计数。
- 安装副本证据：`.verify-harness/profiles/web/node_modules/@xyb-community/small-bowel-workbench@0.2.0`，扫描 `1/1`，原始输出见 `.verify-results/check-profile-small-bowel-2.txt` / `.json`。

### P2 · 仓库 0.1.0 与日常 profile 的 0.2.4 版本冲突风险 → 已隔离，未触碰日常 profile

- 本仓版本推进到 **0.2.0**（`VERSION`、`package.json`、`lib/version.js`、`lib/client.js` 同源）。
- 全程只装 **仓内隔离测试 profile** `.verify-harness/profiles/web`；日常 profile 的 `package.json`、锁文件、`node_modules` 均未改。
- 包名保持 `@xyb-community/small-bowel-workbench`，与日常 profile 的 `short-bowel-workbench` 不是同一个包；未做降级或覆盖安装。

### P3 · 最小测试 profile 不能替代宿主运行时 → 未消除，已如实保留

- 测试 profile 仍未安装 4 个宿主 peer；直接 import `dsh/index.js` 仍会缺 `@deepseek-ai/schemastery`。
- 本轮只证明包内容、bundles/dependencies、面板静态契约与隔离安装；不证明服务启动、API、iframe 与真实会话行为。
- 未重开 Desktop，故 P3 相关的真实运行时结论仍写「未验证」。

## 二、本轮 M4–M9

- **M4 临床库**：`dsh/library.js` 单一来源 → `research/small-bowel-cancer/` 的 JSONL + SQLite + manifest；10 条范围/字段/记录口径、4 个来源终态，全部 `pending-clinical-review`。ClinicalTrials.gov 固定 `NOT_CONNECTED`，页面不显示条数。
- **M5 开发版**：12 类记录写入、逐条私密切换、JSON 导出、档案新建/删除、资料目录配置、临床库展示、打印样式保留。
- **M6 测试装机**：pack 0.2.0（25 文件 / 58.7 kB）→ pnpm 离线装入隔离 profile → `check-profile` 1/1。
- **M7**：只备 `docs/release-draft/TAG-0.2.0.md` 与 `RELEASE-NOTES-0.2.0.md`；未创建 tag，未发 Release。
- **M8**：只更新 `docs/release-draft/BACKLOG-ROW.md` 状态行草稿；未提交、未提 PR。
- **M9**：`docs/LESSONS.md` 8 条经验；`docs/GATE-RECORDS-2.md` 抄录本轮证据。

## 三、测试结果

```text
npm run check
# tests 44
# pass 44
# fail 0
```

- 面板契约：四项计数通过（源码 + 产物）。
- 临床库：10 条 / 4 源；判读/推荐词 0 命中；快照哈希与 SQLite 逐条一致。
- 写入/隐私：新增、私密过滤、导出不含私密、`/library` 接口。
- 页面运行时：八页 + 临床库，无 `undefined` / `NaN`；未接通时不显示试验条数。

```text
check-profile --only small-bowel
✓ @xyb-community/small-bowel-workbench 0.2.0  1/1  public/  bundle ✓ dep ✓
通过 1/1
```

## 四、未验证项

- 真实 Desktop：工作台列表、iframe 加载、八页切换、AI 对话点击、新建/切换会话刷新、分栏拖拽、视觉与打印。
- 日常 profile：未安装、未改；真实资料目录写入与迁移未验。
- 临床：0 患者访谈、0 临床医生审核；临床库条目不能当指南或建议。
- 联网：试验检索、MinerU 文档解析仍未接通。
- 推送：组织仓 `small-bowel-workbench` 已存在，远端 `main` 有独立初始提交 `0f6e5c3`（M0–M3）；本地 `.gitstore` 历史为 `dd15faa → a4b3ce6`，与远端无共同祖先。本机 SSH 22 与 443 均被沙箱拒绝（`Operation not permitted`），未 push；未使用 force，避免覆盖远端。

## 五、红线执行

- 未启动/关闭/重启 DSH Desktop。
- 未改日常 profile；只写仓内 `.verify-harness/`。
- 未发 Release/tag；未提 PR。
- 未读取真实患者资料；所有演示与测试数据均为合成。
- 未改本仓以外文件。

## 待用户决定（最多 3 条）

1. **品牌名**：继续用占位「小肠宝 SmallBowelPal」，还是定名后全局替换？
2. **发布与推送**：恢复本机 SSH/凭据后，是否推送本轮提交并创建 `v0.2.0` tag/Release？
3. **下一优先级**：先补真实 Desktop UI 验收，还是先做文档导入（MinerU）或试验快照？
