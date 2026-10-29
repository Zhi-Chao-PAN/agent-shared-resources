# Five-minute quickstart: three agents, one library

Before changing a real client, run `node bin/ars.mjs trial` after installing dependencies. See [First trial / 首次试用](trial.md) for isolation boundaries and feedback.

This walkthrough publishes one Skill to Claude Code and Codex, and one Skill plus Context7 to Qoder CN. Every command is explicit, and every client remains independently configurable.

If you only use one client, stop after its section — the workflow is the same.

## What you need

- Node.js 22 or newer
- Git
- At least one supported desktop/CLI agent
- A disposable terminal session is enough; no account login is required for this walkthrough

The examples use `node bin/ars.mjs` so they work without changing your shell. If you prefer a global command, run `npm link` once inside the checkout and replace `node bin/ars.mjs` with `ars`.

## 1. Install and initialize

```sh
git clone https://github.com/Zhi-Chao-PAN/agent-shared-resources.git
cd agent-shared-resources
npm ci --ignore-scripts
node bin/ars.mjs init
```

`init` creates `agent-resources.local.json`, which is ignored by Git. No native client file has been touched yet.

Check what is available:

```sh
node bin/ars.mjs clients
node bin/ars.mjs resources
```

`clients` lists the adapter ids and their native paths. `resources` lists the reviewed Skills and MCP definitions, including descriptions and upstream sources.

## 2. Select resources per client

Choose one Skill for the two coding agents:

```sh
node bin/ars.mjs select --client claude --skills shared-scientific-critical-thinking --mcp -
node bin/ars.mjs select --client codex --skills shared-scientific-critical-thinking --mcp -
```

Choose a different combination for Qoder CN:

```sh
node bin/ars.mjs select --client qoder-cn --skills shared-scientific-critical-thinking --mcp shared-context7
```

`-` means an empty list. Omitting `--skills` or `--mcp` keeps the previous value. If you later want to clear a list, `-` only changes the manifest; it does **not** uninstall what was already published.

The resulting manifest looks like this:

```json
{
  "version": 1,
  "clients": {
    "claude": {"skills": ["shared-scientific-critical-thinking"], "mcp": []},
    "codex": {"skills": ["shared-scientific-critical-thinking"], "mcp": []},
    "qoder-cn": {"skills": ["shared-scientific-critical-thinking"], "mcp": ["shared-context7"]}
  },
  "skills": {},
  "servers": {},
  "runtime": {}
}
```

## 3. Preview the complete change set

```sh
node bin/ars.mjs plan --client claude
node bin/ars.mjs plan --client codex
node bin/ars.mjs plan --client qoder-cn
```

A first run reports one `copy` per Skill and one `add` per MCP, for example:

```json
{
  "ok": true,
  "changes": 2,
  "entries": [
    {"client": "qoder-cn", "resource": "shared-context7", "action": "add"},
    {"client": "qoder-cn", "resource": "shared-scientific-critical-thinking", "action": "copy"}
  ],
  "scope": "Files only; no server, account or model calls"
}
```

`plan` is read-only. It does not create the state directory, copy a Skill, modify a config, start a server, or contact a provider. If a target already contains the same resource, the action is `existing-identical-unowned` and rollback will leave it alone.

## 4. Apply

For the two Skill-only clients:

```sh
node bin/ars.mjs apply --client claude
node bin/ars.mjs apply --client codex
```

For Qoder CN, install the optional MCP runtime first, then apply:

```sh
cd runtimes
npm ci --ignore-scripts
cd ..
node bin/ars.mjs apply --client qoder-cn
```

The runtime install is separate because it pulls the pinned MCP packages and can be omitted entirely if you only want Skills. No postinstall hooks run.

Then verify the files:

```sh
node bin/ars.mjs doctor --client claude
node bin/ars.mjs doctor --client codex
node bin/ars.mjs doctor --client qoder-cn
```

`doctor` returning `"changes": 0` means the native files match the manifest. It does not mean the client's model has discovered or used anything yet.

## 5. Verify inside each client

Open a **new** task/session after publishing. Existing sessions may cache their Skill or MCP list.

### Claude Code

- Start a new session and ask it to use the scientific critical-thinking Skill on a short claim, or ask it to list the Skills it can see.
- Confirm that the Skill name appears and that its instructions affect the answer.
- If you published an MCP, check `/mcp` (or the equivalent settings view) and make one minimal read-only call.

Claude Code reads user-scope Skills from `~/.claude/skills` and user-scope MCP servers from `~/.claude.json`. Project-level `.mcp.json` and permission settings are intentionally untouched.

### Codex

- Start a new Codex session and ask it to apply the Skill to a small task.
- Confirm the Skill body is actually loaded, not just the name.
- If a Skill with the same name already exists from another directory, check which one wins before debugging this tool.

### Qoder CN

- Open a new task and check the Skills panel for the skill count.
- Ask Qoder to use the Skill, then confirm the body loads.
- For Context7, ask for a small library lookup and confirm the tool is called. Approve only the read-only operation you intended.
- Qoder may also scan `~/.agents/skills`; the count in the extension panel is not proof of what the model sees. See [compatibility and discovery](compatibility.md).

No acceptance step needs business data. A read-only lookup is enough.

## 6. Update one resource safely

Suppose you change the Context7 version or update a Skill source. The publication receipt remembers the old content, so republishing a different version directly is refused.

```sh
node bin/ars.mjs rollback --client qoder-cn --resource shared-context7
node bin/ars.mjs apply --client qoder-cn
```

Rollback removes only the unchanged entry created by this tool. If you edited the published Skill or the MCP entry yourself, rollback refuses and leaves your work in place; reconcile it manually before retrying.

To remove everything selected for one client:

```sh
node bin/ars.mjs rollback --client claude
```

To remove one resource across clients:

```sh
node bin/ars.mjs rollback --resource shared-scientific-critical-thinking
```

A bare `rollback` without `--client` or `--resource` is rejected to prevent accidental blanket removal.

## 7. Add your own Skill

Keep the source outside the published client directories, review its contents, and register it in `agent-resources.local.json`:

```json
"skills": {
  "my-reviewed-skill": "${home}/my-reviewed-skills/my-reviewed-skill"
}
```

Then select and publish it:

```sh
node bin/ars.mjs select --client claude --skills my-reviewed-skill
node bin/ars.mjs plan --client claude
node bin/ars.mjs apply --client claude
```

The `name:` field in `SKILL.md` must equal `my-reviewed-skill`. Relative paths resolve from the repository; `${root}`, `${home}`, and `${node}` are supported. A Skill is limited to 20 MiB, must not contain symlinks or special files, and must use portable filenames.

## Troubleshooting

| Symptom | What to check |
|---|---|
| `Interrupted publication exists; run recover first` | Run `node bin/ars.mjs recover`. If a native file was edited concurrently, recovery stops and preserves the file; reconcile manually. |
| `Another publisher holds the lock` | Check for a running `ars` process. Only remove a stale `~/.agent-shared-resources/publish.lock` after confirming nothing is publishing. |
| `Windows path needs an explicit local override` | The client's Windows location is not documented; set `mcpFile` / `skillsDir` in the local manifest after confirming the path in the client. |
| `Skill differs; private edits preserved` | Roll back the owned old version first, or intentionally keep your copy and remove the resource from the selection. |
| `Owned entry changed; rollback refused` | You edited the managed config entry. Keep your edit, remove the stale receipt only with a manual review, or reconcile the entry yourself. |
| `Optional runtime missing` | Install `runtimes/` dependencies or remove that MCP from the selection. |
| `doctor` passes but the client sees nothing | Open a new session, confirm the client version's native path, and check for duplicate discovery from a common directory. |
| `doctor` reports changes after a client update | The native file changed underneath the receipt. Inspect the difference; roll back or reconcile rather than forcing a whole-file restore. |

## Safety checklist

- [ ] I reviewed every Skill source before publishing it.
- [ ] I selected one client and one resource first, not every client at once.
- [ ] I ran `plan` and understood each action.
- [ ] I verified discovery in a new client session.
- [ ] I keep tokens in official login state or a keychain, never in `agent-resources.local.json`.
- [ ] I know that `apply` does not start, authorize, or test an MCP server for me.

Next: [compatibility and discovery](compatibility.md) · [MCP setup](mcp.md) · [design and recovery](design.md) · [validation boundaries](validation.md).
