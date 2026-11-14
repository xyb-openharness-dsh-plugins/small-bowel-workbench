# DSH Desktop 装机验证报告 · small-bowel-workbench

时间：2026-11-14 09:40（Asia/Shanghai）  
范围：pack → 独立测试 profile 安装 → 对装机副本运行家族 `check-profile.mjs`  
结论：**pack 通过；测试 profile 安装落地；装机副本扫描 0/1，不通过；Desktop 界面加载未验证。**

本报告只记录本次实测。未重开 Desktop，未修改用户日常 profile，未发 Release/tag，未 push，未改代码。

## 一、环境

| 项 | 值 |
| --- | --- |
| 宿主 | DSH Desktop `0.13.2`（`io.dsh.desktop`） |
| 宿主目录 | `/Applications/DSH Desktop.app` |
| 日常 profile | `~/Library/Application Support/dsh-desktop/harness/profiles/web` |
| 日常 profile 现有本包 | `@xyb-community/short-bowel-workbench@0.2.4`（来自另一份 `Downloads` checkout） |
| 本次测试 profile | `/Users/qinxiaoqiang/dev/small-bowel-workbench/.verify-harness/profiles/web` |
| Node / npm / pnpm | `v22.19.0` / `10.9.3` / `10.34.5` |
| 仓版本 | `0.1.0`（`VERSION` 与 `package.json` 同源） |

日常 profile 的 `package.json` 在本次操作前 mtime 为 `2026-11-14T08:46:04+0800`、size `17213`；本次验证结束时仍未变化。测试安装只写入仓内 `.verify-harness/`。

未观察到与 `dsh-desktop` 匹配的运行中进程；无论如何，本次没有启动、关闭或重启任何 Desktop 实例。

## 二、Pack 结果

### 源码门禁

```text
$ npm run check
exit 0
# tests 36
# pass 36
# fail 0
```

同时通过：包合同、宿主合同、资料目录口径、schema 红线、文案红线、静态引用、派生残留、面板合同、版本同源、客户端产物同步、激活烟测。

### 实际产物

```text
$ npm pack --pack-destination release --cache ./.npm-cache
exit 0
文件名   xyb-community-small-bowel-workbench-0.1.0.tgz
路径     /Users/qinxiaoqiang/dev/small-bowel-workbench/release/xyb-community-small-bowel-workbench-0.1.0.tgz
文件数   21
压缩大小 46057 bytes（46.1 kB）
解包大小 159.9 kB
sha1     2f277074e7973942c66093a17677145e8f074146
sha256   8a7de34af29cc8f156006b5158e1f62747ba8f112e12799e96d52beb1b708413
```

包内容核对：

- `dsh/` 7 个入口/服务文件在包内。
- `lib/client.js`、`lib/layout.js`、`lib/version.js` 在包内。
- `public/index.html`、`public/app.js`、`public/style.css`、`public/primer.js` 在包内。
- `schema/0001_initial.sql` 与 `schema/freeze-contract.md` 在包内。
- 包内 `package.json` 的 `name/version` 为 `@xyb-community/small-bowel-workbench@0.1.0`，与 `VERSION` 一致。
- `npm run pack:check` 同为 21 文件、同一 shasum，exit 0。

占位符说明：`lib/client.js` 中没有未解析模板占位符。原文出现 17 次 `__PANEL_LAYOUT__` / `__AGENT_PANE__` / `__VERSION__`，三者在文件头部均已有生成后的 `const` 定义，属于模板标识符，不是待替换空值。`public/index.html` 的版本/日期 token 由服务端 `injectTokens` 在响应时替换，`npm run check` 的静态与运行时测试已覆盖。

## 三、测试 Profile 安装结果

测试 profile 为独立目录，自带 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml` 与 `node_modules`，不写入日常 profile。

安装命令：

```bash
DSH_HOME="$PWD/.verify-harness" NODE_OPTIONS= \
  corepack pnpm --dir .verify-harness/profiles/web add -w \
  "file:$PWD/release/xyb-community-small-bowel-workbench-0.1.0.tgz" \
  --config.strict-store-pkg-content-check=false --offline
```

结果：`exit 0`，pnpm `10.34.5`，已写入：

```json
{
  "dependencies": {
    "@xyb-community/small-bowel-workbench": "file:/Users/qinxiaoqiang/dev/small-bowel-workbench/release/xyb-community-small-bowel-workbench-0.1.0.tgz"
  },
  "dsh": {
    "profile": {
      "bundles": ["@xyb-community/small-bowel-workbench"]
    }
  }
}
```

装机副本核对：

```text
安装路径   .verify-harness/profiles/web/node_modules/@xyb-community/small-bowel-workbench
版本       0.1.0
文件数     21
tar 条目逐字节比对：checked=21 mismatch=0
public/index.html：存在
lib/client.js sha256：a77df2254727370cedace74856a2ee5fd358e0deb51d892f0af1e7f2197d1ab8
tar 内 client sha256：同一值
dsh/index.js / lib/client.js / public/app.js：node --check 均为 OK
```

测试 profile 使用 `autoInstallPeers: false`，因此 pnpm 报 4 个宿主 peer 未安装：`@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-connection`、`@deepseek-ai/dsh-host-webserver`、`@deepseek-ai/schemastery`。这些由 DSH Desktop 宿主提供，本机日常 profile 也不在自身 `node_modules` 顶层安装它们。

因此直接 `import` 测试副本的 `dsh/index.js` 会以 `ERR_MODULE_NOT_FOUND: @deepseek-ai/schemastery` 失败。这是最小测试 profile 缺少宿主运行时，不作为包缺陷；真实宿主内加载仍需 Desktop 验证。

## 四、装机副本扫描结果

工具：

```text
/Users/qinxiaoqiang/Downloads/xyb-workbench-starter/scripts/check-profile.mjs
sha256 6756709ed7b1f0d5af228ceb2ffc8817b9d21e6ab583c694c0faf2222a994e78
```

命令：

```bash
node /Users/qinxiaoqiang/Downloads/xyb-workbench-starter/scripts/check-profile.mjs \
  --profile "$PWD/.verify-harness/profiles/web" --only small-bowel
```

原始输出：

```text
profile: /Users/qinxiaoqiang/dev/small-bowel-workbench/.verify-harness/profiles/web
已登记 bundles: 1 · dependencies: 1

工作表                               版本            面板(new/sub)   界面                    bundle  dep
✗ @xyb-community/small-bowel-workbench0.1.0         0/0           public/                 ✓   ✓

通过 0/1

✗ @xyb-community/small-bowel-workbench
   - 没有 newSession（无会话时点「AI 对话」不会创建）
   - 没有 subscribe（新建/切换会话后界面不会刷新）
```

扫描数字：

| 检查项 | 值 |
| --- | --- |
| 扫描包数 | 1 |
| 通过 | **0/1** |
| 版本 | `0.1.0` |
| `newSession` | 0 |
| `subscribe` | 0 |
| `ensureSession` | 0 |
| `Boolean(conversation)` | 0 |
| 业务界面 | `public/` |
| bundles 登记 | 是 |
| dependencies | 是 |
| 残留副本 | 0 |
| 退出码 | **1** |

机器可读输出与文本输出已保存：

- `.verify-results/check-profile-small-bowel.txt`
- `.verify-results/check-profile-small-bowel.json`

## 五、因 Desktop 未重开而未验证

以下项目不能由 `check-profile.mjs` 或本次静态安装证明，且本次遵守红线未重开 Desktop：

| 项目 | 状态 |
| --- | --- |
| 工作台是否出现在 Desktop 工作台列表、版本是否显示 0.1.0 | 未验证 |
| 业务 iframe 是否实际加载、八个一级页面是否可切换 | 未验证 |
| 顶栏「AI 对话」是否正确创建/恢复归属会话 | 未验证；代码层已缺 `newSession` / `subscribe` |
| 已有会话时只开合、不重建 | 未验证 |
| 新建/切换会话后面板是否刷新 | 未验证；代码层无订阅 |
| 资料目录选择、读写、失效提示 | 未验证 |
| 合成 A/B 档案切换、化验分组、影像分组 | 未验证（本次未启动宿主或独立服务） |
| `/api/small-bowel/health` 与 `/api/small-bowel/bootstrap` 在真实宿主内响应 | 未验证 |
| 分栏默认 65/35、拖宽、键盘调整、窄屏 | 未验证 |
| 视觉、可访问性与打印布局 | 未验证 |

`npm run check` 的 36 项测试和本次 `check-profile` 都不能替代上述宿主 UI 验收。

## 六、问题清单

### P1 · AI 面板契约不满足当前家族装机门槛

证据：

- 装机副本 `lib/client.js`：`newSession=0`、`subscribe=0`。
- 同时未发现 `ownsSession`、`currentSession`、`defaultWorkspace` 调用。
- 当前实现只在 `register({...}, Panel)` 时注册外壳；面板从 `props.conversation` 读取内容。
- 对照当前家族已装包（如 `ampullary-workbench`），其客户端包含 `ownsSession`、`defaultWorkspace`、`newSession` 和 `desktopWorkbenches.subscribe`。

影响：按 `check-profile` 的判据，无会话时点「AI 对话」不会创建归属会话；会话切换后界面不会自动刷新。实际 UI 表现仍需重开 Desktop 后确认，但代码层门槛已确定未通过。

处理：本次按要求只记录，未改代码。

### P2 · 仓库 0.1.0 与日常 profile 已装的 0.2.4 存在版本冲突风险

日常 profile 当前登记的是 `@xyb-community/short-bowel-workbench@0.2.4`，来自
`/Users/qinxiaoqiang/Downloads/short-bowel-workbench/release/`；本仓是 `0.1.0`。

影响：若把本仓产物直接装进日常 profile，会形成降级或版本来源混淆。本次未触碰日常 profile。

### P3 · 最小测试 profile 不能替代宿主运行时

测试 profile 未安装宿主 peer，`dsh/index.js` 直接 import 会缺 `@deepseek-ai/schemastery`。这是隔离测试配置的结果，不是本包独有缺陷；但意味着服务启动、API、数据库和 iframe 路径在本报告中没有运行时证据。

## 七、红线执行记录

- 未关闭、未重启、未新开 DSH Desktop。
- 未修改用户日常 profile 的 `package.json`、锁文件或 `node_modules`。
- 未发 Release/tag。
- 未 Git push；本仓当前也没有可用的 `.git`，只有 `.gitstore`。
- 未修改任何业务代码或修复扫描发现的问题。
- 未读取或写入真实患者资料；只使用仓内合成示例。

## 八、产物位置

```text
release/xyb-community-small-bowel-workbench-0.1.0.tgz
.verify-harness/profiles/web/                         # 独立测试 profile
.verify-results/check-profile-small-bowel.txt
.verify-results/check-profile-small-bowel.json
VERIFY-REPORT.md
```

最终判定：**测试 profile 安装成功；装机副本扫描失败（0/1）；Desktop 加载与业务实测未验证。不得表述为「装机通过」。**
