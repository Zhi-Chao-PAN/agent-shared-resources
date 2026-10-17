# Agent Shared Resources

A portable, opt-in publisher for local desktop-agent Skills and stdio MCP connections. Use Node.js 22+ on macOS or Windows. The manager preserves unrelated native configuration, models, plugins, and permission rules.

```sh
npm ci --ignore-scripts
node bin/ars.mjs init
node bin/ars.mjs select --client qoder-cn --skills shared-scientific-critical-thinking --mcp -
node bin/ars.mjs plan --client qoder-cn
node bin/ars.mjs apply --client qoder-cn
node bin/ars.mjs doctor --client qoder-cn
```

On PowerShell use `npm.cmd`; no execution-policy changes or symlink privileges are required. Publication copies reviewed Skills into native directories. No clients are selected initially. No global Agent instructions, accounts, or approval settings are installed.

Optional MCP runtimes have a separate package lock in `runtimes/`. See [MCP setup](mcp.md). Each user authenticates their own official accounts. OAuth caches and publication receipts stay outside the Git repository. CLI `doctor` checks files; actual model discovery, tool calls, and native approval behavior need separate acceptance.

`rollback --client <id> [--resource <name>]` removes only owned, unchanged publications; identical pre-existing resources remain unowned. Backups and interrupted transaction state live in `~/.agent-shared-resources/`. `recover` finishes a prepared transaction only if targets still match the saved before/after states. Changed resources require an explicit rollback before republishing.

Ten configuration adapters are covered by fixtures. Windows native app paths are intentionally not guessed for undocumented clients. [Compatibility](compatibility.md), [design/recovery](design.md), and [validation boundaries](validation.md) distinguish CI tests from real desktop-agent verification. See the [Chinese README](../README.md) for complete commands.

Own code: MIT. Bundled Skills retain their original licenses; see [third-party notices](../THIRD_PARTY_NOTICES.md).
