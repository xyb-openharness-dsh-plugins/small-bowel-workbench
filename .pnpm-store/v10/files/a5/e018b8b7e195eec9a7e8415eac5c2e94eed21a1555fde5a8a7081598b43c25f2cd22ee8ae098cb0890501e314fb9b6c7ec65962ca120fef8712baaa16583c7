# SCHEMA 冻结合同 · 0001_initial.sql

状态：**M2 草案（未过 G3 临床数据签认）**。本文件登记当前文件的 sha256；正式冻结须用户签认后更新状态行。

| 项 | 值 |
| --- | --- |
| 文件 | `schema/0001_initial.sql` |
| 版本 | 0.1.0 |
| 登记日期 | 2026-11-14 |
| sha256 | `9232de6dba4465853afd28e3ba4fb4d679c2f399eea1f8f28789e2bdb3c8f9a8` |
| 状态 | draft-2026-11-14（M2 草案，G3 未签认） |

## 变更规则

1. `0001` 一旦标记 `frozen`，任何列/表变更只能新增 `0002_*.sql`，不得回改本文件。
2. 新迁移必须在 `schema_migrations` 留 ledger 行（`dsh/store.js` 自动写入）。
3. 每次新增迁移，同步更新 `docs/SCHEMA.md` 与 `docs/04-DATA.md`。
4. 任何新增列不得引入 `diagnosis` / `risk_level` / `activity_score` / `prognosis` /
   `response` / `line_of_therapy` 判读语义；医生原话只能落 `*_text` / `*_note`。

## 校验

```bash
node scripts/check-schema-words.mjs .
```
