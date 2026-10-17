# Choosing a way to share Agent resources

There is no single right answer. The useful question is: **what is actually shared, and what must stay private?**

On one machine, an AI coding agent usually combines:

- shared capabilities (Skills, prompts, MCP server definitions);
- private state (account, model choice, plugins, permissions, approval rules, session history);
- machine-specific paths and credentials.

A good sharing mechanism handles the first without rewriting the second.

## Options compared

| Option | Best for | Main failure mode with multiple agents |
|---|---|---|
| Copy resources by hand | One client, a one-off experiment | Drift, forgotten copies, no record of what was installed |
| Symlink a shared Skill folder | Unix-only setups where every client follows links | Windows privileges and junction behavior; clients that do not follow links; a broken link fails silently |
| Dotfiles / whole-file templates | Managing a complete config you fully own | A client's file also contains private state; replacing it loses account, model, plugin, or approval settings |
| A custom copy script | A small, stable set of clients you control | No conflict detection, no receipt, no crash recovery; a half-run leaves mixed state |
| A central MCP gateway | Reducing per-client processes at scale | Adds a service to run and secure; does not help with Skills or native client settings |
| **This tool** | Several agents, mixed OSes, reviewed shared resources | It is not a config framework, account broker, or sandbox; it still needs one real discovery check per client |

## What “safe” means here

The manager treats a native config as a document it does not own:

1. It locates exactly one entry (`mcpServers.<name>`, `mcp_servers.<name>`, or a named YAML block).
2. It compares the rest of the document semantically before and after the edit.
3. It refuses to overwrite a same-named entry with different content.
4. It records a receipt only for entries it actually created.
5. It rolls back only entries that still match the published content.
6. It stops recovery if the file or Skill changed concurrently.

That is deliberately slower than “copy this folder everywhere.” The trade-off buys predictable rollback and preserves the private parts of each client.

## Where symlinks are still better

Use symlinks or junctions when:

- you are on one OS and every client follows links;
- the linked resource is a self-contained directory with no private sibling state;
- you want live edits to the source to be visible immediately without republishing.

This tool copies instead. If you edit a published Skill, the receipt no longer matches and rollback refuses rather than destroying your changes. To adopt an edit, update the source, roll back the old publication, and apply again.

## Where dotfiles are still better

Use dotfiles when:

- you own the entire file and want it identical on every machine;
- there is no private state to preserve;
- you are comfortable with whole-file replacement.

This tool is for the opposite case: JSONC with comments, TOML with a private model and plugins, YAML with hand-written entries. It edits one key or marked block and verifies that everything else is unchanged.

## Where a gateway is still better

A shared MCP gateway can centralize auth, auditing, and process count across a team. That is a server-side concern. This tool stays local and per-user: each client starts its own stdio child process, and each user completes their own official OAuth. It does not proxy, share, or store provider credentials for other people.

## What this tool will not solve

- Model routing: it cannot make an agent choose a tool.
- Permission design: it does not add auto-approval or sandbox rules.
- Cross-user sharing: each user has their own manifest, OAuth state, and receipts.
- Chat or memory sync: those are client features, not resource files.
- Unreviewed Skills: publishing a folder does not audit what its scripts do.

If those boundaries match your problem, start with the [five-minute quickstart](quickstart.md). If they do not, the native client configuration or a gateway may be the simpler answer.
