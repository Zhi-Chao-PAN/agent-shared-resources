# 验证范围

## 本仓库

- 核心测试覆盖十一种客户端文件适配、私有配置保留、同名冲突、幂等、资源回滚、中断恢复、并发编辑、JSON 重复键、symlink/junction 保护和回执路径检查。
- CI 在 macOS、Windows、Linux 与 Node 22/24 组合执行。以[当前 CI 结果](https://github.com/Zhi-Chao-PAN/agent-shared-resources/actions/workflows/ci.yml)为准。
- 安装器不实际执行 MCP，也不申请账号授权。CI 不运行官方登录、浏览器和语言服务器，不访问个人业务数据。
- `doctor` 是文件与声明验收；客户端路径正确、技能可见性和工具调用需分别核对。

## 参考系统的 Mac 实机经验

本项目来自一套在 Apple Silicon Mac 使用的共享资源系统。参考系统曾对 Codex、Trae CN、WorkBuddy、MiniMax Code、DeepSeek Harness、Antigravity，以及后接入的 Qoder CN 做过不同轮次的原生模型只读调用。Qoder CN 最近一次验收包含七项 MCP、Skill 按问题选择、完整正文加载，以及公共目录旧技能的过滤复验。

这些是参考架构与资源的实机经验，**不等于本仓库新 CLI 已在全部客户端版本上重新部署验收**。个人会话、账户、机器路径、配置、回执与旧 Git 历史不随仓库发布。

Windows 的 CI 可以验证真实 Windows 文件行为，包括 junction 与复制发布；它不能证明某个 Windows Agent 实际读取了相同目录，也不能证明官方 OAuth 和每个工具均可调用。需要用户按具体客户端做一次小规模只读验收后再扩大部署。

贡献实机结果时可报告 OS / 架构、客户端版本、脱敏的路径形式、原生发现数量、实际工具名、成功/错误状态及保留检查；不要上传完整设置、日志、账号标识或 token。

## Isolated first trial

`node bin/ars.mjs trial` runs eight real-manager checks against temporary fixtures, including conflict refusal and recovery. `npm test` also verifies that it leaves the repository manifest and real publication receipt unchanged and rejects a home override. CI runs this coverage on each OS/Node combination. This does not verify actual client discovery or model invocation.
