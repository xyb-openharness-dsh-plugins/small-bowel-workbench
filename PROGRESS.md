
## 2026-11-19 09:xx M6 装机实测修复（本地代跑，待晨审追认）

- 实测 bug：Desktop 真机加载报「Cannot read properties of null (reading 'currentProfileKey')」。根因：占位符 __API_BASE__ 只在 .html 注入，app.js 是外链静态文件永远带占位符 → fetch('__API_BASE__/bootstrap') 打到宿主 SPA fallback 返回 200 HTML → boot=null。V2/V3 从未真机加载过所以夜班未暴露。
- 修复：dsh/server.js 静态服务对 app.js 与 index.html 同样注入；升版 0.2.1；lib/client.js 重构建注入版本；README/CHANGELOG 版本段补齐。check 全绿（44/44）、test 44/44。
- 证据：mock handler 实测 app.js 输出 const API_BASE = '/api/small-bowel'、占位符 0 残留；装机三点核验 0.2.1；重启后 harness.log 本次段 mpn/small-bowel 报错 0 行。
- push 未执行（网络）；人眼真机走查待用户重试。

## 2026-11-19 09:xx 顶栏新建档案入口（用户反馈）

- 用户反馈：顶栏 head 区「档案」下拉菜单只有切换，缺创建新档案入口（原入口只在「档案」页内）。
- 修改：顶栏 profile-wrap 内档案下拉旁新增「＋ 新建档案」按钮（data-open-profile，复用既有 profile-dialog 与 document 级委托，全页可用）。
- 升版 0.2.2；check 44/44、test 44/44；装机三点核验 0.2.2；重启后本次段报错 0 行。

## 2026-11-19 11:xx 试验线 35 号落地 + 品牌去重（用户验收反馈，0.2.3）

- 品牌重复：宿主外壳 header 与 iframe 顶栏各渲染一次「小肠宝 SmallBowelPal」；按用户指示保留上面（外壳），移除 iframe 内 brand 块。
- 试验线四段链路：M4 快照（scripts/fetch-small-bowel-trials-2026.mjs，unified-trial-mcp；4 查询 221 去重 → SBA 命中子集 58 条详情，池上限 120，通道终态 24 项，详情失败 0）；schema 0002（trials/source_statuses/app_setting + saved_trials.state，只增不改）；匹配子页（window.calcTrialMatch：粗筛符合度 pct=符合÷已对照、待确认=0、可对照<2 不给百分数、硬性不满足单列；病理类型/分期/部位/年龄/分子标志物/ECOG 逐条证据链三态）；检索子页（按条件不掺分数）；收藏与跟踪三态（在跟/准备问/已归档）。
- 教训回流：fetch 详情逐条无容错曾让整批 256 条全丢（一条 60s 超时）→ 单条重试 1 次跳过并记录；broad 查询全量详情 25 分钟无界等待 → SBA 命中子集 + 上限。
- 门禁：check 全绿（含 check:trial-snapshot/chain/matching 入链）+ test 44/44；装机三点核验 0.2.3；重启后本次段报错 0 行。

## 2026-11-19 12:xx 官方登记页外链修复（用户验收反馈，0.2.4）

- 症状：试验详情浮窗「打开官方登记页 ↗」点击无反应。根因：宿主外壳 iframe 的 sandbox 白名单缺 allow-popups——沙箱 iframe 里 target=_blank 被静默拦截（mpn 同款潜在 bug）。
- 修复：src/client.js sandbox 增 allow-popups allow-popups-to-escape-sandbox；壳层监听 sba:open-external 兜底（业务页 window.open 返回空时 postMessage 请外壳代开）；业务页 source-link 加 data-open-external 点击兜底。原型同步。
- mpn 同款修复（lib/client.js 直改 + 原型同步），0.2.3。
- 门禁：双仓 check 全绿（sb 44/44、mpn 13/13）；装机 sb 0.2.4 / mpn 0.2.3；重启后本次段报错 0 行。
