<p align="center">
  <img src="./resources/chromie-logo-knot.svg" alt="Chromie" width="88" />
</p>

<h1 align="center">Chromie</h1>

<p align="center">在 macOS 上统一管理分散的资产，数据留在本机</p>

Chromie 汇总券商、交易所、银行和手工账户中的资产，支持多工作区、多币种折算、历史快照和受控的 MCP 访问。

## 功能

- 用统一标签整理资产账户和持仓
- 管理 A 股、港股、美股和数字资产，按 `CNY`、`HKD` 或 `USD` 折算市值
- 从券商与交易所只读同步，也可以手动维护账户和持仓
- 手动创建资产快照，并导入或导出完整工作区
- 允许本机 Agent 在授权范围内查询和维护资产数据

## 支持的账户

| 账户 | 接入方式 | 同步内容 |
| --- | --- | --- |
| 富途牛牛 | Futu OpenD，默认 `127.0.0.1:33333` | 港美股持仓与分币种现金 |
| 盈透证券 | Client Portal Gateway，默认 `127.0.0.1:5000` | 证券持仓与分币种现金 |
| 华盛通 | [OpenAPI Gateway](https://quant-open.hstong.com/api-docs/introduction/guidelines.html)，默认 `127.0.0.1:11111` | 港股、美股、深股通、沪股通持仓与现金 |
| 欧易 | 只读 API Key | 交易账户与资金账户资产 |
| 币安 | 只读 HMAC API Key | 现货账户与资金钱包资产 |
| 支付宝、中银国际、招商银行、中国银行、通用账户 | 手动维护 | 自行录入的持仓与价格 |

自动同步默认每 30 秒执行一次。盈透证券与华盛通只允许连接本机 Gateway，交易所 API Key 也应只保留读取权限。Chromie 不提供下单、划转或提现功能。

## 数据与备份

- 资产数据和同步配置经 Electron 安全存储加密后写入本机，macOS 上的密钥由 Keychain 保护
- 汇率来自 Coinbase 公共接口，默认每 15 分钟更新一次，并在本机保留最近一次成功结果
- 工作区备份包含账户、持仓、标签和快照，不包含连接参数与 API 凭据

导入备份时，Chromie 会新增一个工作区，不会覆盖已有数据。查看历史快照期间，编辑和自动同步会暂停。

## MCP 协议

在“工作区设置”中启用 MCP 协议后，Agent 可以查询工作区、资产概览、持仓、快照和同步状态。开启写入权限后，还可以修改本地资产数据、触发同步和更新汇率。

MCP 协议默认关闭，首次启用时仍为只读模式。它不提供删除工具，也不会读取或返回同步凭据。使用期间 Chromie 必须保持运行，辅助进程只负责 stdio 与本机 Unix Socket 之间的转发。

## 从源码运行

需要 macOS、Node.js 和 pnpm。

```bash
git clone https://github.com/ramzeng/chromie.git
cd chromie
pnpm install
pnpm dev
```

```bash
pnpm test
pnpm typecheck
pnpm build:mac
```

`pnpm build:mac` 会在 `dist/` 下生成 macOS 安装包。正式分发仍需准备有效的 Apple Developer 签名并完成 notarization。

## 开发

项目使用 Electron、electron-vite、React、TypeScript、Tailwind CSS v4、shadcn/ui 和 pnpm。

| 目录 | 用途 |
| --- | --- |
| `src/main` | 主进程、本地数据与平台接入 |
| `src/preload` | renderer 与主进程之间的安全桥接 |
| `src/renderer` | React 界面与状态投影 |
| `src/shared` | 跨进程类型、命令和数据模型 |

主进程依次分为 `transport → service → repository → infra`。资产数据只在主进程中保存和修改，renderer 通过 IPC 读取数据并提交命令。
