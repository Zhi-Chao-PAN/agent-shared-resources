# First trial / 首次试用

Start with the isolated trial. It uses the real publication manager against disposable Skill and MCP fixtures, with a temporary repository and a temporary home. It does not read your local manifest or client configuration, start an MCP server, sign in, or invoke a model. The temporary fixture directory is removed when the command completes normally; a forced process kill may leave an `ars-trial-*` directory in the operating system's temporary directory.

```sh
npm ci --ignore-scripts
node bin/ars.mjs trial
```

On Windows PowerShell use `npm.cmd ci --ignore-scripts`; the Node command is the same. No administrator access or shell-policy change is needed.

A successful run returns `ok: true`, eight passing checks and `sandboxRemoved: true`:

1. Preview does not write native configuration.
2. Publish produces the selected files and passes `doctor`.
3. Repeating apply changes nothing.
4. A user's edit prevents rollback and survives the refusal.
5. Rollback preserves an unrelated setting and MCP entry.
6. Interrupted work has a pending transaction.
7. Recovery completes that transaction and is idempotent.
8. A final rollback removes only the managed resources.

The JSON report includes package version, operating-system family and Node major version. It excludes paths, hostname, account information, manifest contents and raw configuration. You can review and share it; nothing uploads automatically. A failed run exits nonzero and records the failed stage. The trial currently uses a Qoder-format fixture; it is **not** verification of an installed Qoder client or every adapter.

## Then choose one real client

Use [the compatibility matrix](compatibility.md) to verify the current paths and [the quickstart](quickstart.md) for exact commands. Choose one reviewed Skill first, without MCP credentials or runtime installation. Keep a copy of any existing client configuration before a real publication.

```sh
node bin/ars.mjs init
node bin/ars.mjs select --client qoder-cn --skills shared-scientific-critical-thinking --mcp -
node bin/ars.mjs plan --client qoder-cn
```

Inspect the paths and actions. Only continue if they match the installed client and your intent. `init` does not overwrite an existing manifest; if one already exists, review it instead of deleting it. `--home` on normal management commands is not the isolated trial: it still uses the repository's local manifest.

```sh
node bin/ars.mjs apply --client qoder-cn
node bin/ars.mjs doctor --client qoder-cn
```

Check discovery inside the client after its required reload or new session. A passing `doctor` only checks files. Actual discovery and a successful model/tool invocation must be recorded separately; an invocation may use your provider's quota. Keep client approval controls in place.

To remove the unchanged managed copy:

```sh
node bin/ars.mjs rollback --client qoder-cn --resource shared-scientific-critical-thinking
```

If the published copy has local edits, rollback deliberately stops. Keep those edits; follow [the recovery design](design.md). Do not delete state, receipts or your only copy to force a green check.

## Feedback worth collecting

Use [client compatibility feedback](https://github.com/Zhi-Chao-PAN/agent-shared-resources/issues/new?template=client_compatibility.yml) or [a bug report](https://github.com/Zhi-Chao-PAN/agent-shared-resources/issues/new?template=bug_report.yml). GitHub issues are public. Do not attach native configurations, account screenshots, access tokens, command arguments containing credentials, or unredacted terminal logs.

Report the package/Node/OS versions, client version, adapter, whether trial/plan/apply/doctor/discovery actually succeeded, what failed, and whether rollback preserved your unrelated settings. Mark untested steps as “not tested.” A redacted example is more useful than a claim that “everything works.” For sensitive details, use the maintainer's private contact route described in SECURITY.md.

## 中文说明

先运行上面的 `trial`，无需执行 `init`，也不需要提供真实客户端路径。它在临时目录里使用实际管理器演示预览、发布、幂等、冲突保护、回滚和中断恢复；正常完成后删除自己的夹具。它不会读取你的本地清单与客户端配置，不会启动 MCP、登录账号或调用模型。强行终止进程可能留下系统临时目录中的 `ars-trial-*` 演示目录。

报告只有版本、系统类型、Node 主版本和检查结果，没有用户名、完整路径、主机名或配置内容，也不会自动上传。八项通过仅代表隔离文件操作成功；目前使用 Qoder 格式夹具，不代表你的真实客户端已发现资源。

接入真实客户端时，只选一个已审查的 Skill，按兼容矩阵确认路径，先看 `plan`，再决定是否 `apply`。已有清单不要删除重建。发布后分别记录：文件检查通过、客户端发现成功、实际调用成功。三件事不要混为一谈。真实调用可能消耗你自己的模型额度。

反馈请说明哪里卡住、是否需要额外指导、撤销是否保留了其他设置。GitHub issue 公开可见，请先脱敏；未测试的步骤直接写“未测试”。
