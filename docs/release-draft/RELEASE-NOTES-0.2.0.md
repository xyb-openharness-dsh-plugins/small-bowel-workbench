# Release Notes 草稿 · 0.2.0（未发布）

## 小肠宝 SmallBowelPal 0.2.0 · 小肠腺癌患者工作台

本版把 M0–M3 只读骨架推进到可本机录入的开发版，并修复装机扫描发现的面板会话契约。

### 新增

- 12 类记录的本机新增：确诊、病理、化验、影像、治疗、用药、症状、营养、随访、文档、收藏试验、问题。
- 逐条私密切换；摘要、导出与 AI 上下文三个出口统一过滤。
- JSON 导出、打印样式、档案新建/删除、资料目录配置。
- M4 本机临床库：10 条范围与记录口径、4 个来源终态，全部 `pending-clinical-review`。

### 修复

- 面板补 `newSession`、`subscribe`、`currentSession + ownsSession`、`defaultWorkspace`。
- 无会话时点「AI 对话」创建归属会话；新建/切换会话后面板刷新。
- `ensureSession` 与 `Boolean(conversation)` 均为 0。

### 验证

- `npm run check`：44/44。
- 隔离测试 profile：家族 `check-profile` 1/1。
- 包：25 个文件，58.7 kB tarball。

### 未验证 / 边界

- 未重启 Desktop，工作台列表、iframe 加载、点击行为与视觉未验。
- 0 患者访谈、0 临床审核；临床库不是指南替代品。
- 试验检索 `NOT_CONNECTED`；文档解析未接通。
- 未发 tag / Release；本文件只是草稿。
