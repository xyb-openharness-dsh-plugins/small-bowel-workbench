# 冻结备稿 · BACKLOG 行（不提交、不提 PR）

本轮只更新草稿，未向 `xyb-openharness-dsh-plugins/.github` 提交任何修改，也未提 PR。

当前证据：V1 通过（44/44）；M6 隔离测试 profile 扫描 1/1；V2 真实 Desktop 界面加载、点击与视觉仍未验证；V3 业务验收未做。因此状态列**不能**写成「装机通过」或「验收通过」。

```markdown
| 17 | Small Bowel Adenocarcinoma | 小肠腺癌 | 3.2025 | T2 | [small-bowel-workbench](https://github.com/xyb-openharness-dsh-plugins/small-bowel-workbench) | 🟡 v0.2.0（2026-11-14 认领，M0–M6 完成；测试 profile 1/1，Desktop UI 未验） | 👤📝 |
```

提交前必须：

1. 远端仓可写且本机 push 成功（本轮 SSH 22/443 均被沙箱拒绝）。
2. `npm run check` 全绿 + 真实 Desktop UI 实测 + 业务验收记录。
3. 只改状态列与招募列，不改序号/病种/版本/级别。
4. 认领 issue 已发（本轮 `gh` token invalid，未发）。
