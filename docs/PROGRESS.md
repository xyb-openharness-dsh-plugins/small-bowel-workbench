# PROGRESS · 2026-11-14 开发日（第二轮）

| 阶段 | 判据 | 状态 | 证据 |
| --- | --- | --- | --- |
| M0 文档 | DEV-REQUIREMENTS / DEV-PLAN / SPEC / BRIEF / primer / 差异矩阵 / 来源 | ✅ | 文件存在且交叉引用一致 |
| M1 接入 | `dsh/index.js` 四要素、health、认证、静态、客户端注册 | ✅ | `npm run check` 中 host/smoke/package |
| M2 数据 | 0001 迁移、ledger、A/B 合成档案、隐私列 | ✅ | `test/store.test.mjs`、`test/demo.test.mjs` |
| M3 页面 | 八页、三态、档案切换、只读 API | ✅ | `test/ui-contract.test.mjs`、`test/readmodels.test.mjs` |
| M4 临床库 | 本机条目、来源终态、快照一致性 | ✅ | `test/library.test.mjs`、`check-clinical-library` |
| M5 开发版 | 12 类写入、隐私、导出、档案/目录 | ✅ | `test/ui-contract.test.mjs`、`test/server.test.mjs` |
| M6 测试装机 | 隔离 profile 安装 + 家族扫描 | ✅ 1/1 | `.verify-results/check-profile-small-bowel-2.txt` |
| V1 包级 | `npm run check` | ✅ 44/44 单测通过 | 见 `VALIDATION.md` |
| V2 真实装机 | 日常 profile + Desktop 界面 | ⬜ 未做 | 未重启 Desktop、未改日常 profile |
| V3 业务 | 真实用户流程 | ⬜ 未做 | 0 患者访谈 |

## 下一步

1. 用户确认品牌名与服务主体。
2. 是否发 `v0.2.0` tag/Release（本轮只备草稿）。
3. 补 3–5 位患者访谈与临床审核，再过 G1/G2/G3。

## 本开发日未完成的基础设施

- 远端仓已存在（`main` 初始提交 `0f6e5c3`，M0–M3）；本地 `.gitstore` 历史与其无共同祖先。本机 SSH 22/443 均被沙箱拒绝，未 push；未 force。`gh` token invalid，未发认领 issue。
- 浏览器视觉验收：沙箱禁止端口监听、Chrome headless 崩溃；仅完成 DOM 桩运行时测试。
