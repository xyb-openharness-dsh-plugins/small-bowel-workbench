# LESSONS · 小肠腺癌工作台 0.2.0 开发日

## L1 · 装机扫描只认安装副本，源码树全绿不算装机通过

VERIFY-REPORT 的 0/1 来自 `.verify-harness/profiles/web/node_modules/` 里的 `lib/client.js`，不是仓根源码。修复后必须重新 `npm pack` → 重装测试 profile → 再扫；只跑 `npm run check` 会得到假安全感。

## L2 · 面板契约数的是「真实调用」，不是字符串提及

`check-profile` 剥注释后按 `newSession(` / `subscribe` / `ensureSession(` / `Boolean(conversation)` 计数。只写注释、只做能力探测（`desktopWorkbenches.newSession`）都不算调用；必须实际执行 `service.newSession(workspaceId)` 并订阅 `desktopWorkbenches.subscribe(...)`。

## L3 · 会话归属不能看 conversation 容器

customFrame 下没有会话时宿主也会传隐藏 `conversation` 容器；`Boolean(conversation)` 恒真，点按钮不会创建。正确顺序是 `currentSession()` → `ownsSession()` → `ownedSession()`，再用 `newSession(defaultWorkspace()?.workspaceId)` 创建。会话区常挂载，只切 `display`，避免卸载丢草稿。

## L4 · 版本推进要在打包前完成

测试 profile 的 `package.json` 指向具体 tgz 路径。改版本后若不重新 pack + add，扫描到的仍是旧 0.1.0。本轮顺序固定为：改 `VERSION` → `build:version` → `build:client` → `build:library` → `check` → `pack` → 重装 → `check-profile`。

## L5 · 离线临床库要如实写终态，不能补数字

没有网络时不建立试验快照，`ClinicalTrials.gov` 固定 `NOT_CONNECTED`，页面不显示「共 N 条」。临床库只放范围、字段与记录口径，全部 `pending-clinical-review`；不复制指南正文，不把相邻瘤种证据写成建议。

## L6 · 测试 profile 通过 ≠ 真实 Desktop 通过

隔离 profile 没有宿主 peer，`dsh/index.js` 直接 import 会缺 `@deepseek-ai/schemastery`。`check-profile` 只证明包内容、bundles/dependencies 与面板静态契约；工作台列表、iframe 加载、AI 对话点击、分栏与视觉仍需重开 Desktop 后人验。红线要求不重启，所以报告必须保留「未验证」。

## L7 · 沙箱会挡住仓根 `.git` 与 SSH

本轮 `git init` 在仓根写 `.git` 返回 `Operation not permitted`，只能用仓内 `.gitstore` 作为 git 目录；`ssh github.com:22` 与 `ssh.github.com:443` 均被沙箱拒绝。提交与推送报告要写清实际边界，不能把「本地 commit」写成「已推送」。

## L8 · DOM 桩测试能抓模板运行时错误，但不能替代浏览器

44 个测试能在真实演示数据上跑通八页、临床库与新写入入口，抓 `undefined` / `NaN` 与契约缺失；但它不验证真实布局、焦点、对话框与打印分页。视觉验收仍需浏览器或真实宿主。
