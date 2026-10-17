# 平台与客户端入口

以下是**文件格式适配能力**，不是每个版本都做过真实模型验收的承诺。所有客户端默认不启用。`skillsDir` 与 `mcpFile` 都可在本地清单覆盖，原生写入目标必须位于当前用户 home 内；目标或上级目录是 symlink/junction 时拒绝写入，请明确填写实际目录。

| 客户端 id | Mac MCP 默认入口 | Skill 默认入口 | Windows 默认路径 |
|---|---|---|---|
| `codex` | `~/.codex/config.toml` | `~/.codex/skills` | home 相对入口，需按客户端版本确认 |
| `qoder-cn` | `~/.qoder-cn/settings.json` | `~/.qoder-cn/skills` | 同上；CN 与国际版分开 |
| `qoder` | `~/.qoder/settings.json` | `~/.qoder/skills` | home 相对入口 |
| `gemini` | `~/.gemini/settings.json` | `~/.gemini/skills` | home 相对入口 |
| `workbuddy` | `~/.workbuddy/mcp.json` | `~/.workbuddy/skills` | 要求明确覆盖 |
| `minimax` | `~/.minimax/mcp.json` | 无默认；按实际启用的技能源填写 | 要求明确覆盖 |
| `trae-cn` | `~/Library/Application Support/Trae CN/User/mcp.json` | `~/.trae-cn/skills` | 要求明确覆盖 |
| `antigravity` | `~/.gemini/config/mcp_config.json` | `~/.gemini/config/skills` | 要求明确覆盖；桌面/IDE 版本可能不同 |
| `dsh` | `~/.dsh/profiles/desktop/cordis.patch.yml` | 无默认；需与 skill-filesystem 实际发现根一致 | 要求明确覆盖 |
| `zcode` | `~/.zcode/cli/config.json` 的 `mcp.servers` | 无默认 | 要求明确覆盖 |

没有证据证明 Windows 某个客户端实际读取哪个文件时，工具会拒绝套用 Mac 路径。请在该客户端的原生设置中确认路径，然后写入自己的 `agent-resources.local.json`。不会自动改 skill-filesystem、MiniMax 外部源、账号或授权设置。

## Qoder 的公共目录发现

Qoder 可能同时发现本端和 `~/.agents/skills` 中的技能；单看 Installed 的本地数量不足以验收。若你明确要隐藏已退役的名称，可在该客户端清单加入：

```json
"qoder-cn": {
  "skills": ["shared-scientific-critical-thinking"],
  "mcp": ["shared-context7"],
  "hiddenSkills": ["my-retired-skill"]
}
```

它只添加该客户端的 `skillOverrides.my-retired-skill = "off"`，不删源目录，不影响其他客户端。按资源 `hide-my-retired-skill` 可单独回滚。若已有同名可见性设置不同，保留原值并报冲突。依据：[Qoder 原生设置](https://docs.qoder.cn/cli/sdk/references-typescript#settings)。

Codex、MiniMax 等也可能从多处发现同名 Skill。本工具不会扫描、禁用或删除你未选择的公共来源；有重复时先做原生会话发现验收，再按该客户端自己的机制处理。不要向它们追加一大段强制工具路由规则。

## 参考文档

- [Qoder CN 用户配置目录](https://docs.qoder.cn/cli/config-scope)
- [Qoder 用户配置](https://docs.qoder.com/cli/settings)
- [Gemini CLI Skills](https://geminicli.com/docs/cli/skills/)
- [Codex 配置](https://developers.openai.com/codex/config-basic/)

路径与发现行为会随版本变化；新增适配器应先补文件保留/回滚用例，再提供真实客户端的脱敏证据。Claude 不在首版适配清单内。
