# 认领 issue 草稿（未提交）

原因：`gh auth status` 显示 default token invalid，GitHub 连接器无创建 issue / 仓库能力；`curl` 无网络。恢复凭据后按家族 `/claim` 流程发。

标题：

```text
[认领] 小肠腺癌 Small Bowel Adenocarcinoma · small-bowel-workbench
```

正文：

```markdown
## 认领病种

- NCCN #17 · Small Bowel Adenocarcinoma · 小肠腺癌 · 3.2025 · T2
- 建议仓库：`small-bowel-workbench`
- BACKLOG 状态：⬜ 招募中（远端 BACKLOG HEAD 4d56608，2026-10-31；issue 检索无他人认领）

## 当前进度

- 本地已完成 M0–M3：脚手架、DEV-REQUIREMENTS、SQLite 0001、两套合成档案、八页只读骨架。
- `npm run check`：36/36 单测通过（2026-11-14）。
- 未装机、未发 Release、未回填 BACKLOG。

## 边界

- 0 患者访谈、0 临床审核；阈值全部【待核】。
- 只做小肠原发腺癌；壶腹部/胰胆来源/GIST/淋巴瘤/神经内分泌肿瘤不在范围。
```

提交前检查：issue 是否带 `claim` 标签（家族机器人要求，见 DEV-REQUIREMENTS 参考）。
