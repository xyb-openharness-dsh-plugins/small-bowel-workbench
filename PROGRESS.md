
## 2026-11-19 09:xx M6 装机实测修复（本地代跑，待晨审追认）

- 实测 bug：Desktop 真机加载报「Cannot read properties of null (reading 'currentProfileKey')」。根因：占位符 __API_BASE__ 只在 .html 注入，app.js 是外链静态文件永远带占位符 → fetch('__API_BASE__/bootstrap') 打到宿主 SPA fallback 返回 200 HTML → boot=null。V2/V3 从未真机加载过所以夜班未暴露。
- 修复：dsh/server.js 静态服务对 app.js 与 index.html 同样注入；升版 0.2.1；lib/client.js 重构建注入版本；README/CHANGELOG 版本段补齐。check 全绿（44/44）、test 44/44。
- 证据：mock handler 实测 app.js 输出 const API_BASE = '/api/small-bowel'、占位符 0 残留；装机三点核验 0.2.1；重启后 harness.log 本次段 mpn/small-bowel 报错 0 行。
- push 未执行（网络）；人眼真机走查待用户重试。

## 2026-11-19 09:xx 顶栏新建档案入口（用户反馈）

- 用户反馈：顶栏 head 区「档案」下拉菜单只有切换，缺创建新档案入口（原入口只在「档案」页内）。
- 修改：顶栏 profile-wrap 内档案下拉旁新增「＋ 新建档案」按钮（data-open-profile，复用既有 profile-dialog 与 document 级委托，全页可用）。
- 升版 0.2.2；check 44/44、test 44/44；装机三点核验 0.2.2；重启后本次段报错 0 行。
