# CHANGELOG

## 0.2.1 — 2026-11-19

Desktop 装机实测修复：静态服务对 public/app.js 同样做 __API_BASE__ 等占位符注入（此前 app.js 外链永远带占位符，bootstrap 请求打到宿主 SPA fallback 导致页面无法加载）。

## 0.2.0 — 2026-11-14

M4–M9 开发日：面板契约修复、本机临床库、写入/隐私/导出、隔离测试 profile 装机扫描。

- 面板：补 `newSession` / `subscribe` / `currentSession + ownsSession` / `defaultWorkspace`；会话区常挂载只切 `display`；`ensureSession` 与 `Boolean(conversation)` 均为 0。
- M4：`dsh/library.js` + `research/small-bowel-cancer/` 本机临床库（10 条、4 个来源终态，全部待临床审核）。
- M5：新增记录（12 类）、逐条私密切换、档案新建/删除、JSON 导出、资料目录配置、临床库展示。
- M6：0.2.0 打包并安装到仓内隔离测试 profile；家族 `check-profile` 复扫 1/1。
- M7–M9：只备 tag / release notes / BACKLOG 状态行草稿与经验回流，未发 Release/tag、未提 PR。

## 0.1.0 — 2026-11-14

首个 M0–M3 开发日提交。

- M0：家族脚手架结构、`docs/DEV-REQUIREMENTS.md`、DEV-PLAN、SPEC/BRIEF、疾病概要、差异化矩阵与来源清单。
- M1：DSH 插件入口、带认证的 health/bootstrap、静态资源服务、customFrame 客户端外壳。
- M2：SQLite 初始数据模型 `0001_initial.sql`（14 张表）与两套合成演示档案。
- M3：八个核心页面骨架（今天 / 档案 / 检查 / 治疗 / 症状与营养 / 随访 / 试验 / 资料），只读渲染 + 空态/错误态。
- 未做：真实患者写入 UI、文档导入、试验联网检索、装机验证。
