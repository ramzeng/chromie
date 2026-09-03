<p align="center">
  <img src="./resources/chromie-logo-knot.svg" alt="Chromie" width="88" />
</p>

<h1 align="center">Chromie</h1>

<p align="center">在 macOS 上统一管理分散的资产，数据保存在本地</p>

Chromie 汇总分散在券商、交易所、银行和手工账户中的资产，并提供多工作区管理、多币种折算、历史快照和本地 MCP 访问。

## 功能

- 使用统一标签整理账户和持仓
- 管理 A 股、港股、美股和数字资产，按 `CNY`、`HKD` 或 `USD` 折算市值
- 根据市场和资产代码查询行情，自动填写名称、币种和当前价格
- 从券商与交易所只读同步资产，也可以手动维护账户和持仓
- 创建资产快照，并导入或导出完整工作区
- 通过 MCP 让本地 Agent 在授权范围内查询和维护资产数据

首次启动后，可以直接进入只读示例工作区。示例数据只用于体验，不会写入本地。

## 支持的账户

| 账户 | 接入方式 | 同步内容 |
| --- | --- | --- |
| 富途牛牛 | Futu OpenD，默认 `127.0.0.1:33333` | 港美股持仓与分币种现金 |
| 盈透证券 | Client Portal Gateway，默认 `127.0.0.1:5000` | 证券持仓与分币种现金 |
| 华盛通 | [OpenAPI Gateway](https://quant-open.hstong.com/api-docs/introduction/guidelines.html)，默认 `127.0.0.1:11111` | 港股、美股、深股通、沪股通持仓与现金 |
| 欧易 | 只读 API Key | 交易账户与资金账户资产 |
| 币安 | 只读 HMAC API Key | 现货账户与资金钱包资产 |
| 支付宝、中银国际、招商银行、中国银行、通用账户 | 手动维护 | 自行录入的持仓与价格 |

自动同步默认每 30 秒执行一次。盈透证券与华盛通只允许连接运行在本机的 Gateway，交易所 API Key 也应只保留读取权限。Chromie 不提供下单、划转或提现功能。

## 行情与汇率

添加或编辑持仓时，Chromie 会根据市场和资产代码查询行情，并尝试填写资产名称、币种和当前价格。股票行情支持东方财富和 Yahoo Finance，数字资产行情支持 Coinbase 和 Yahoo Finance。查询失败或信息不完整时，仍可手动填写。

不同币种的市值通过 Coinbase 公共汇率接口折算。打开工作区时，Chromie 会立即更新汇率，随后默认每 15 分钟更新一次，并在本地保留最近一次成功结果。行情数据源和汇率更新间隔可以在“工作区设置”中调整。

## 数据与备份

- 资产数据和同步配置以明文 JSON 保存在本地，默认目录为 `~/.chromie`，可以在“工作区设置”的“基础信息”中更改
- 工作区快照会保存当时的账户、持仓价格和汇率，查看快照时不会修改当前数据
- 导入备份会新增一个工作区，不会覆盖已有数据

> [!WARNING]
> 工作区备份包含账户、持仓、标签、快照、连接参数与 API 凭据。请将备份文件保存在可信位置，不要将其提交到代码仓库，也不要公开分享。

查看历史快照期间，编辑和自动同步会暂停。

## MCP 协议

Chromie 默认启用 MCP 协议和写入权限。Agent 可以查询工作区、资产概览、持仓、快照和同步状态，也可以新建或修改工作区、标签、账户和持仓，还可以创建快照。即使关闭写入权限，Agent 仍可同步账户和更新汇率。

你可以在“工作区设置”的“MCP 协议”页面复制当前安装环境的客户端配置，也可以关闭写入权限或停用 MCP 协议。MCP 不提供删除工具，也不会读取或返回同步凭据。

使用 MCP 期间，Chromie 必须保持运行。客户端启动的辅助进程只负责在 `stdio` 与本地 Unix Socket 之间转发请求，不会直接读取资产文件或同步凭据。

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

`pnpm build:mac` 会在 `dist/` 下生成 macOS 安装包。正式分发前，还需配置有效的 Apple Developer 签名并完成 notarization。

## 开发

项目使用 Electron、electron-vite、React、TypeScript、Tailwind CSS v4、shadcn/ui 和 pnpm。

| 目录 | 用途 |
| --- | --- |
| `src/main` | Electron 主进程、本地数据与平台接入 |
| `src/preload` | 渲染进程与主进程之间的安全桥接 |
| `src/renderer` | React 界面与状态展示 |
| `src/shared` | 跨进程类型、命令和数据模型 |
| `tests` | 主进程服务、平台接入与共享逻辑测试 |

主进程代码按 `transport → service → repository → infra` 分层。资产数据由主进程统一保存和修改，渲染进程通过 IPC 读取数据并提交命令。
