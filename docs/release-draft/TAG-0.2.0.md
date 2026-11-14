# Tag 草稿 · v0.2.0（未执行）

状态：**只备草稿，不创建本地/远端 tag，不发 Release。**

```text
tag:        v0.2.0
target:     <COMMIT>
annotated:  yes
message:    小肠腺癌工作台 0.2.0 · M0–M6 开发版
```

建议命令（需用户明确授权后执行）：

```bash
git tag -a v0.2.0 -m "小肠腺癌工作台 0.2.0 · M0–M6 开发版"
git push origin v0.2.0
```

发布前检查：

1. `npm run check` 退出码 0（本轮 44/44）。
2. `npm pack` 产物为 0.2.0，包内 25 个文件。
3. 隔离测试 profile `check-profile` 1/1（本轮已过）。
4. 真实 Desktop 界面加载与 AI 对话点击仍为未验证；是否允许在未验 UI 的情况下发 tag，由用户决定。

禁止：把本文件当成已发 tag 的证据。
