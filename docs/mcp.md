# 七项可选 MCP

所有连接默认关闭，必须先 `select` 再 `plan/apply`。原生插件已能完成任务时不必再装重复连接。每个客户端仍管理自己的 stdio 子进程；没有共享后台网关或跨账号服务。

## 可选 Node 运行包

在 `runtimes/` 执行 `npm ci --ignore-scripts`（Windows 使用 `npm.cmd`），使用独立锁文件安装：

| 资源 | 实现 / 版本 | 登录与范围 |
|---|---|---|
| Notion | 官方 hosted MCP + mcp-remote 0.14.3 | 使用者在官方页面 OAuth，自行选择范围 |
| Linear | 官方 hosted MCP + mcp-remote 0.14.3 | 使用者在官方页面 OAuth，保留客户端写入确认 |
| Context7 | @upstash/context7-mcp 4.4.1 | 默认匿名，服务端额度依其规则 |
| Exa | 官方 hosted MCP + mcp-remote 0.14.3 | 匿名有额度限制，不做绕过或自动付费 |
| Playwright | @playwright/mcp 0.0.83 | 可选的 headless / isolated 浏览器，不读取你的常用浏览器 profile |
| GitHub | 官方 github-mcp-server 2.0.2 | 单独安装官方二进制并核对 SHA-256；复用自己的 gh 登录 |
| Serena | serena-agent 2.0.0，经 uvx 启动 | 单独安装 uv；项目由用户/客户端任务决定，不自动激活或全盘索引 |

管理器用当前 Node 的绝对路径启动包内入口，避免在 Windows 依赖 `npx.cmd` / shell 转义。启动器核对 Node 包版本。安装与锁文件校验和不等于每个上游能力都已在每种系统实际验收。

## 官方授权与共享

Notion、Linear 的 canonical endpoint 分别固定为 `https://mcp.notion.com/mcp`、`https://mcp.linear.app/mcp`。各端调用同一个本机启动器，每项服务使用当前用户私有的 `~/.agent-shared-resources/auth/<service>/` 缓存。首次调用可能打开官方授权页，由使用者完成；同一用户、同一服务的客户端进程可复用该缓存。

OAuth 的 client、scope、工作区策略或并发刷新行为由上游决定，失效时使用官方流程重新授权。不要复制作者的缓存或把 token 放进 Git。多人、多租户、多台机器分别管理授权，不把“共用入口”理解为跨用户共用凭据。mcp-remote 自己的缓存/跨进程行为见[上游文档](https://github.com/punkpeye/mcp-remote)。

业务工具可以提供读写能力。授权连接不代表批准任意业务写入，也不改变客户端原有确认方式。以账号自查、团队列表、公开文档读取等最小只读操作验收，不用创建/删除业务数据来测试。

## GitHub

从[官方 release](https://github.com/github/github-mcp-server/releases)获取符合系统/架构的 2.0.2 二进制，并用官方 checksums 文件验证。自己运行 `gh auth login`。在本地清单的 `runtime` 里填写二进制的绝对路径、已核实的 64 位十六进制 `githubSha256`，必要时另填 `gh` 的绝对路径。

启动器通过无 shell 子进程读取 `gh auth token`，只把它置入 MCP 子进程的环境，不写文件、不放命令行参数、不输出到日志。没有可用登录就报错，不代替用户登录。若已有原生 GitHub 连接，保持它即可。

## Playwright / Serena

Playwright 的浏览器资源需使用该锁定版本依赖的 CLI 单独安装。安装前规划磁盘空间；可按 Playwright 官方方式设置 `PLAYWRIGHT_BROWSERS_PATH`。新任务需从 GUI 获取环境变量时，按客户端官方方式配置环境，不要求用户修改系统安全设置。公开入口默认 `--headless --isolated --browser chromium`。

常用网页协作继续使用 Agent 自带的可见浏览器；Playwright 用于隔离回归、DOM / 可访问性检查等。它可能在本地输出快照文件。Serena 用 ide context，通过 `uvx --from serena-agent==2.0.0 serena start-mcp-server --context ide` 启动；安装 uv 或 Python 时遵循官方说明。源码、索引和语言服务器的权限仍由项目与客户端控制。

## 本地运行路径

`runtime.nodeModules` 可指向已按同版本锁文件准备的可选依赖目录；默认 `runtimes/node_modules`。`runtime.uvx`、`runtime.gh`、`runtime.githubBinary`、`runtime.playwrightOutput` 可按本机填写。不要在共享服务器声明里填 token/密码；自定义服务器可使用继承的环境和官方密钥存储。

来源：[Notion](https://developers.notion.com/guides/mcp/get-started-with-mcp)、[Linear](https://linear.app/docs/mcp)、[Context7](https://github.com/upstash/context7)、[Exa](https://exa.ai/docs/get-started/exa-mcp)、[GitHub](https://github.com/github/github-mcp-server)、[Playwright](https://github.com/microsoft/playwright-mcp)、[Serena](https://github.com/oraios/serena)。
