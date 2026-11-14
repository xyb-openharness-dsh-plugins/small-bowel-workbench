# AGENTS · small-bowel-workbench

本仓是小肠腺癌（Small Bowel Adenocarcinoma, SBA）患者工作台，属于小 X 宝家族 DSH 工作台。

## 先读什么

1. `docs/DEV-REQUIREMENTS.md` — 本仓硬约束与验收命令。
2. `docs/DEV-PLAN.md` — 认领记录、里程碑、未验证边界。
3. `docs/SCHEMA.md` 与 `schema/freeze-contract.md` — 数据模型与冻结合同。
4. `docs/DISEASE-PRIMER.md` — 疾病概要四段（页面「?」同源）。
5. `README.md` — 当前能力与本地启动。

## 工作纪律

- 一切医学结论归医生。代码与文案不得出现「预后」「疗效」「治愈率」「生存期」等判读或承诺性表述；阈值一律标【待核】。
- 演示数据唯一来源是 `dsh/demo.js` 的合成档案；不得混入真实患者信息。界面必须常显「合成示例」。
- 数据层不设派生判读列（`diagnosis` / `risk_level` / `activity_score` / `prognosis` / `response`）。医生原话只存 `*_text` / `*_note`。
- 化验按 `method + org` 分组，不跨方法合并、不连线、不做差；影像跨机构分组陈列。
- 迁移只增不改：`0001` 冻结后改结构只能新增 `0002+`，并更新 `schema/freeze-contract.md`。
- 版本先改 `VERSION`，再跑 `npm run build:version`；`lib/client.js` 由 `npm run build:client` 生成，勿手改。

## 验证门禁

```bash
npm run check   # 静态接线 + 契约 + 单测（本机无依赖即可跑）
npm start -- --root /path/to/data   # 独立启动，浏览合成示例
```

`npm run check` 全绿只算 V1（包级）。装机（V2）与业务实测（V3）未做之前，不得在 README 或报告中写「已验证」。
