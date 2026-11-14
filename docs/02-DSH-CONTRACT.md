# DSH 接入合同（本仓摘要）

完整合同以家族 `xyb-workbench-starter/docs/02-DSH-CONTRACT.md` 为准；本文件只记本仓实现位置。

| 要素 | 本仓位置 |
| --- | --- |
| npm 包名 | `@xyb-community/small-bowel-workbench` |
| 入口 | `dsh/index.js`，导出 `name` / `inject` / `Config` / `apply` |
| patch | `cordis.patch.yml`，`insert.name` 为完整包名 |
| 客户端 | `lib/client.js`（由 `src/client.js` 生成），`exports["./client"]` |
| 服务端 | `dsh/server.js`，API 前缀 `/api/small-bowel` |
| 静态 | `public/`，宿主挂载 `/small-bowel/` |
| 健康 | `GET /api/small-bowel/health` |
| 认证 | `ctx.connection.requestRejection(req)`；缺失能力 503 |
| 面板 | `customFrame:true`、`businessSide:'left'`、`businessWidth:0.65` |

## 路由

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/small-bowel/health` | 版本、能力清单 |
| GET | `/api/small-bowel/bootstrap` | 档案列表、当前档案、计数、通道状态 |
| GET | `/api/small-bowel/subjects` | 档案列表 |
| POST | `/api/small-bowel/subjects` | 新建本机档案（`local-` 前缀） |
| DELETE | `/api/small-bowel/subjects?profileKey=` | 删除真实档案；演示档案拒绝 |
| GET | `/api/small-bowel/read/:entity?profileKey=` | 只读实体（labs/imaging/...） |
| POST | `/api/small-bowel/entries` | 新增记录（M3 仅服务端能力，UI 留 M4） |
| GET | `/api/small-bowel/root` | 资料目录状态 |
| POST | `/api/small-bowel/root` | 设置资料目录（拒绝主目录/桌面/下载/tmp） |

错误一律 JSON：`{ error, detail? }`；静态 404 回 `index.html` 走 SPA。
