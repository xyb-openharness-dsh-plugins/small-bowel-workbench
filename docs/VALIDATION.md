# VALIDATION · 本开发日验证记录（第二轮 · 0.2.0）

## 环境

- macOS · Node.js v22.19.0 · npm 10.9.3
- 命令行无外网（DNS 失败），无 npm 依赖安装；全部检查使用 Node 内置模块与 `node:sqlite`。GitHub 连接器可读取远端 BACKLOG 与 issues，但无写权限。
- 未安装到 DSH Desktop。

## 命令与结果

```bash
npm run check
```

结果：**通过**（2026-11-14，本机）。

```text
✓ 包合同：@xyb-community/small-bowel-workbench@0.1.0
✓ 宿主合同：name / inject / Config / apply / 认证
✓ 资料目录口径：9 个用例
✓ schema 红线：14 张表，判读列 0 命中
✓ 文案红线：0 命中
✓ 静态引用：4 条；八页与三态齐全
✓ 派生残留：0 命中
✓ 面板合同：conversation / 分栏 / 持久化 / 注册
✓ 版本同源：0.1.0
✓ lib/version.js 与 VERSION 同步
✓ lib/client.js 与源同步
✓ 激活烟测：register 1 次，描述符合法，Panel 是函数
# tests 44
# pass 44
# fail 0
```

覆盖：

- 语法：`dsh/index.js`、`lib/client.js`、`public/app.js`。
- 包合同：`check-workbench-package`、`check-host-contract`。
- 数据纪律：`check-data-dir`、`check-schema-words`。
- 文案红线：`check-wording`。
- 静态引用：`check-static-refs`。
- 派生残留：`check-derivative-leftovers`。
- 面板合同：`check-agent-pane-contract`。
- 版本同源：`check-version-literal` + `build-version --check`。
- 客户端产物：`build-client --check` + `smoke-activate`。
- 单测：`test/*.test.mjs`。
- 页面运行时：`test/ui-runtime.test.mjs` 用最小 DOM 桩执行真实 `public/app.js`，跑通八页模板；断言不出现 `undefined` / `NaN`，CEA 两组、只读桥可切页。
- 本机临床库：`test/library.test.mjs` 校验 10 条、4 个来源终态、快照文件与判读/推荐词红线。
- 写入与隐私：`test/server.test.mjs` 覆盖新增、私密过滤、导出不含私密与 `/library` 接口。

```bash
npm run pack:check
```

结果：**通过**（dry-run）。0.2.0 包内 25 个文件，tarball 58.7 kB，unpacked 218.1 kB；`private: true`。

## 隔离测试 profile

```bash
DSH_HOME="$PWD/.verify-harness" corepack pnpm --dir .verify-harness/profiles/web add -w \
  "file:$PWD/release/xyb-community-small-bowel-workbench-0.2.0.tgz" \
  --config.strict-store-pkg-content-check=false --offline
node /Users/qinxiaoqiang/Downloads/xyb-workbench-starter/scripts/check-profile.mjs \
  --profile "$PWD/.verify-harness/profiles/web" --only small-bowel
```

结果：安装 0.2.0；`check-profile` 通过 **1/1**；`newSession=1`、`subscribe=1`、`ensureSession=0`、`Boolean(conversation)=0`。原始输出在 `.verify-results/check-profile-small-bowel-2.txt` / `.json`。

## 本机限制

- 沙箱禁止 `listen`（`EPERM 127.0.0.1`），因此 `npm start` 的端口监听未实测；HTTP 路由改用 in-process handler 测试（`test/server.test.mjs`）。
- Chrome headless 在本沙箱退出码 134，浏览器截图未取得。页面只做了 DOM 桩运行时验证，**不是**视觉验收。
- 仓根 `.git` 写入被沙箱拒绝（`Operation not permitted`）；本地提交存于 `.gitstore/`，需用 `git --git-dir=.gitstore --work-tree=.` 访问。
- 日常 profile 未触碰；测试 profile 未安装宿主 peer，不能替代真实 Desktop 运行时。

## 未验证

- 真实 DSH Desktop 装机后 `apply()` 与 iframe 挂载。
- 真实患者资料目录选择与写入。
- 文档导入、试验检索、AI 会话草稿桥。
- 医学口径与临床审核。
- 视觉/响应式实机走查（窄屏、粘性顶栏、打印分页）。
