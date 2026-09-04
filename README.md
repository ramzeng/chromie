<h1 align="center">
  <img src="./resources/chromie-logo-knot.svg" alt="Chromie" width="72" /><br />
  Chromie
</h1>

<p align="center">在 macOS 上管理分散的资产，数据保存在本地</p>

![Chromie 项目架构](./resources/chromie-architecture.webp)

## 功能

- 使用标签整理账户和持仓
- 管理 A 股、场外基金、港股、美股和数字资产，按 `CNY`、`HKD` 或 `USD` 折算市值
- 自动查询资产名称、币种和价格
- 只读同步券商与交易所账户，也支持手动录入
- 为每个交易所账户单独选择系统网络、强制直连或远端代理
- 创建快照，导入或导出工作区
- 通过 MCP 让本地 Agent 查询和维护资产

首次启动可进入只读示例工作区，示例数据不会保存。

## 支持的账户

| 账户 | 接入方式 | 资产内容 |
| --- | --- | --- |
| 富途牛牛 | [Futu OpenD](https://openapi.futunn.com/futu-api-doc/opend/opend-intro.html)，默认 `127.0.0.1:33333` | 港美股持仓与分币种现金 |
| 盈透证券 | [Client Portal Gateway](https://ibkrcampus.com/docs/web-api/authentication/cpgw/installation-authentication)，默认 `127.0.0.1:5000` | 证券持仓与分币种现金 |
| 华盛通 | [OpenAPI Gateway](https://quant-open.hstong.com/api-docs/introduction/guidelines.html)，默认 `127.0.0.1:11111` | 港股、美股、A 股通持仓与现金 |
| 欧易 | 只读 API Key | 交易账户与资金账户资产 |
| 币安 | 只读 HMAC API Key | 现货账户与资金钱包资产 |
| 手动账户 | 手动录入，可选择机构图标 | 持仓与价格 |

自动同步间隔默认为 30 秒。盈透证券和华盛通只连接本机 Gateway。交易所 API Key 应只保留读取权限。Chromie 不会下单、划转或提现。

## 网络代理

欧易和币安账户可以分别跟随系统网络、强制直连，或使用可复用的远端代理配置。显式代理支持 HTTP、HTTPS、SOCKS5 和 SOCKS5H，并可使用用户名和密码认证。SOCKS5H 会通过代理服务器解析远端域名，适用于 `socks5h://user:password@host:port` 形式的代理。

代理连接失败时，Chromie 会直接报告错误，不会静默改为直连。可以在“工作区设置 → 网络代理”中分别测试欧易和币安的公共时间接口。

## 行情与汇率

输入市场和资产代码后，Chromie 会查询名称、币种和价格。股票行情支持东方财富和 Yahoo Finance，场外基金使用东方财富，数字资产行情支持 Coinbase 和 Yahoo Finance。查询失败时可手动填写。

汇率由 Coinbase 提供。打开工作区时会立即更新，之后默认每 15 分钟更新一次。行情数据源和汇率更新间隔可在“工作区设置”中修改。

## 数据与备份

- 数据、同步配置和代理凭据以明文 JSON 保存，默认目录为 `~/.chromie`。存储位置可在“工作区设置”中修改
- 快照保存账户、持仓价格和汇率，查看快照时会暂停编辑和自动同步
- 导入备份会创建新工作区，不会覆盖现有数据

> [!WARNING]
> 备份包含资产数据、连接配置、同步凭据，以及当前工作区引用的明文代理凭据。请妥善保管，不要提交到代码仓库或公开分享。

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

## 发布 macOS 安装包

向 GitHub 推送与 `package.json` 版本一致的 `v*` 标签后，Release 工作流会运行测试和类型检查，构建同时支持 Apple 芯片与 Intel 芯片的通用 DMG，完成 Developer ID 签名及 Apple 公证，然后创建 GitHub Release。ZIP 包一并保留，供后续接入应用内自动更新。

在仓库的“Settings → Secrets and variables → Actions”中配置以下 Secrets：

| Secret | 内容 |
| --- | --- |
| `MAC_CSC_LINK` | Developer ID Application `.p12` 文件的 Base64 内容 |
| `MAC_CSC_KEY_PASSWORD` | 导出 `.p12` 时设置的密码 |
| `APPLE_API_KEY_P8` | App Store Connect Team API Key `.p8` 文件的 Base64 内容 |
| `APPLE_API_KEY_ID` | App Store Connect API Key ID |
| `APPLE_API_ISSUER` | App Store Connect API Issuer ID |

在 macOS 上可以用下面的命令复制文件的 Base64 内容：

```bash
base64 < DeveloperIDApplication.p12 | tr -d '\n' | pbcopy
base64 < AuthKey_KEYID.p8 | tr -d '\n' | pbcopy
```

公证必须使用 Team API Key，Individual API Key 不支持 `notarytool`。证书和私钥文件不得提交到仓库。

发布新版本时，先更新并提交 `package.json` 中的版本号，再创建并推送标签。例如发布 `0.3.0`：

```bash
git tag -a v0.3.0 -m "Release v0.3.0"
git push origin v0.3.0
```

## 开发

项目使用 Electron、electron-vite、React、TypeScript、Tailwind CSS v4、shadcn/ui 和 pnpm。

| 目录 | 用途 |
| --- | --- |
| `src/main` | Electron 主进程、本地数据与平台接入 |
| `src/preload` | 渲染进程与主进程之间的安全桥接 |
| `src/renderer` | React 界面与状态展示 |
| `src/shared` | 跨进程类型、命令和数据模型 |
| `tests` | 主进程服务、平台接入与共享逻辑测试 |

主进程按 `transport → service → repository → infra` 分层。资产数据由主进程保存和修改，渲染进程通过 IPC 读取数据并提交操作。
