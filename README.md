<p align="center">
  <img src="./resources/chromie-logo-knot.svg" alt="Chromie" width="88" />
</p>

<h1 align="center">Chromie</h1>

<p align="center">在 macOS 上管理分散的资产，数据保存在本地</p>

Chromie 汇总券商、交易所和手动账户中的资产，支持多工作区、多币种折算、历史快照和 MCP。

## 功能

- 使用标签整理账户和持仓
- 管理 A 股、港股、美股和数字资产，按 `CNY`、`HKD` 或 `USD` 折算市值
- 自动查询资产名称、币种和价格
- 只读同步券商与交易所账户，也支持手动录入
- 创建快照，导入或导出工作区
- 通过 MCP 让本地 Agent 查询和维护资产

首次启动可进入只读示例工作区，示例数据不会保存。

## 支持的账户

| 账户 | 接入方式 | 资产内容 |
| --- | --- | --- |
| 富途牛牛 | Futu OpenD，默认 `127.0.0.1:33333` | 港美股持仓与分币种现金 |
| 盈透证券 | Client Portal Gateway，默认 `127.0.0.1:5000` | 证券持仓与分币种现金 |
| 华盛通 | [OpenAPI Gateway](https://quant-open.hstong.com/api-docs/introduction/guidelines.html)，默认 `127.0.0.1:11111` | 港股、美股、A 股通持仓与现金 |
| 欧易 | 只读 API Key | 交易账户与资金账户资产 |
| 币安 | 只读 HMAC API Key | 现货账户与资金钱包资产 |
| 手动账户 | 手动录入，可选择机构图标 | 持仓与价格 |

自动同步间隔默认为 30 秒。盈透证券和华盛通只连接本机 Gateway。交易所 API Key 应只保留读取权限。Chromie 不会下单、划转或提现。

## 行情与汇率

输入市场和资产代码后，Chromie 会查询名称、币种和价格。股票行情支持东方财富和 Yahoo Finance，数字资产行情支持 Coinbase 和 Yahoo Finance。查询失败时可手动填写。

汇率由 Coinbase 提供。打开工作区时会立即更新，之后默认每 15 分钟更新一次。行情数据源和汇率更新间隔可在“工作区设置”中修改。

## 数据与备份

- 数据和同步配置以明文 JSON 保存，默认目录为 `~/.chromie`。存储位置可在“工作区设置”中修改
- 快照保存账户、持仓价格和汇率，查看快照时会暂停编辑和自动同步
- 导入备份会创建新工作区，不会覆盖现有数据

> [!WARNING]
> 备份包含资产数据、连接配置和同步凭据。请妥善保管，不要提交到代码仓库或公开分享。

## MCP 协议

MCP 和写入权限默认开启。Agent 可以查询和修改资产数据，也可以创建快照。关闭写入权限后，Agent 仍可查询数据、同步账户和更新汇率。

在“工作区设置”中可以复制 MCP 客户端配置、关闭写入权限或停用 MCP。MCP 不提供删除工具，也不会返回同步凭据。

使用 MCP 时，Chromie 必须保持运行。辅助进程只转发请求，不会直接读取资产文件或凭据。

## 从源码运行

需要 macOS、Node.js 和 pnpm。

安装依赖并启动开发环境。

```bash
git clone https://github.com/ramzeng/chromie.git
cd chromie
pnpm install
pnpm dev
```

运行测试、类型检查和 macOS 构建。

```bash
pnpm test
pnpm typecheck
pnpm build:mac
```

`pnpm build:mac` 会在 `dist/` 下生成 macOS 安装包。正式分发还需要 Apple Developer 签名和 notarization。

## 开发

项目使用 Electron、electron-vite、React、TypeScript、Tailwind CSS v4、shadcn/ui 和 pnpm。

[查看交互式项目架构图](./chromie-architecture.html)

| 目录 | 用途 |
| --- | --- |
| `src/main` | Electron 主进程、本地数据与平台接入 |
| `src/preload` | 渲染进程与主进程之间的安全桥接 |
| `src/renderer` | React 界面与状态展示 |
| `src/shared` | 跨进程类型、命令和数据模型 |
| `tests` | 主进程服务、平台接入与共享逻辑测试 |

主进程按 `transport → service → repository → infra` 分层。资产数据由主进程保存和修改，渲染进程通过 IPC 读取数据并提交操作。
