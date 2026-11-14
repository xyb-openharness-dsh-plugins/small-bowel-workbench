# GATE-RECORDS-2 · 2026-11-14 第二轮

本文件只抄录本轮实际命令与原始结果。未执行的项目写「未执行」，不写成「通过」。

## V1 · 源码与包级

```bash
npm run check
```

```text
✓ 包合同：@xyb-community/small-bowel-workbench@0.2.0
✓ 宿主合同
✓ 资料目录口径：9 个用例
✓ schema 红线：14 张表
✓ 文案红线：0 命中
✓ 静态引用：八页与三态齐全
✓ 派生残留：0 命中
✓ 面板合同：conversation / 分栏 / 持久化 / 注册 / 会话四计数
✓ 临床库红线：10 条 · 判读/推荐词 0 命中
✓ 临床库快照：10 条 · 4 个来源终态
✓ 版本同源：0.2.0
# tests 44
# pass 44
# fail 0
```

退出码：0。

## M6 · 隔离测试 profile

安装目标：

```text
.verify-harness/profiles/web/node_modules/@xyb-community/small-bowel-workbench
version 0.2.0
```

家族扫描：

```text
profile: /Users/qinxiaoqiang/dev/small-bowel-workbench/.verify-harness/profiles/web
已登记 bundles: 1 · dependencies: 1

工作表                               版本            面板(new/sub)   界面                    bundle  dep
✓ @xyb-community/small-bowel-workbench0.2.0         1/1           public/                 ✓   ✓

通过 1/1

✓ 装机层核验通过（界面加载与点击行为仍需重开 Desktop 后人验）
```

面板计数（安装副本 `lib/client.js`，剥注释后）：`newSession=1`、`subscribe=1`、`ensureSession=0`、`Boolean(conversation)=0`。

原始输出：

- `.verify-results/check-profile-small-bowel-2.txt`
- `.verify-results/check-profile-small-bowel-2.json`

## 未执行

- 未启动/重启 Desktop；未验证工作台列表、iframe 加载、AI 对话点击与分栏。
- 未改日常 profile；未验证真实资料目录写入。
- 未发 Release/tag；未提 BACKLOG PR。
- 未联网，试验检索仍为 `NOT_CONNECTED`。
- 未 push：远端 `main` 已有独立初始提交 `0f6e5c3`；本地历史无共同祖先，SSH 22/443 被沙箱拒绝。
