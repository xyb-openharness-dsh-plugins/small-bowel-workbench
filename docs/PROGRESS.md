# PROGRESS · 2026-11-14 开发日

| 阶段 | 判据 | 状态 | 证据 |
| --- | --- | --- | --- |
| M0 文档 | DEV-REQUIREMENTS / DEV-PLAN / SPEC / BRIEF / primer / 差异矩阵 / 来源 | ✅ | 文件存在且交叉引用一致 |
| M1 接入 | `dsh/index.js` 四要素、health、认证、静态、客户端注册 | ✅ | `npm run check` 中 host/smoke/package |
| M2 数据 | 0001 迁移、ledger、A/B 合成档案、隐私列 | ✅ | `test/store.test.mjs`、`test/demo.test.mjs` |
| M3 页面 | 八页、三态、档案切换、只读 API | ✅ | `test/ui-contract.test.mjs`、`test/readmodels.test.mjs` |
| V1 包级 | `npm run check` | ✅ 36/36 单测通过 | 见 `VALIDATION.md` |
| V2 装机 | 真实 Desktop 加载 | ⬜ 未做 | 本开发日禁止装机 |
| V3 业务 | 真实用户流程 | ⬜ 未做 | 0 患者访谈 |

## 下一步

1. 用户确认品牌名与服务主体。
2. M4：新增/编辑记录、私密切换、就诊前一页纸导出。
3. 补 3–5 位患者访谈与临床审核，再过 G1/G2/G3。

## 本开发日未完成的基础设施

- 远端仓与 `/claim` issue：`gh` token invalid + 无网络，均未执行；草稿见 `docs/release-draft/`。
- 浏览器视觉验收：沙箱禁止端口监听、Chrome headless 崩溃；仅完成 DOM 桩运行时测试。
