# Changelog

## 0.1.0 — 2026-10-18

Initial public release.

- One local manifest selects Skills and MCP servers per client.
- `init`, `select`, `plan`, `apply`, `doctor`, `rollback`, `recover`, `clients`, `resources`, and `--version` commands.
- Copy-based Skill publication without symlink or administrator requirements.
- Key-level JSON/JSONC edits, marked TOML/YAML blocks, conflict refusal, and unrelated-setting preservation.
- Transaction receipts, backups, concurrency checks, and explicit recovery.
- Eleven adapters: Claude Code, Codex, Qoder / Qoder CN, Gemini, WorkBuddy, MiniMax, Trae CN, Antigravity, DSH, and ZCode.
- Claude Code uses user scope only: `~/.claude.json` and `~/.claude/skills`; project-level settings are untouched.
- `rollback --resource <name>` removes one resource across clients; `rollback --client` keeps the per-client form.
- Four reviewed third-party Skills with licenses, provenance, and content hashes.
- Seven optional MCP definitions with per-user official authentication.
- English-first README, Chinese README, a three-client quickstart, and a design comparison.
- Terminal demo and social-preview assets.
- Issue forms for bugs, client compatibility reports, and feature requests; pull-request checklist.
- CI on macOS, Windows, and Linux with Node.js 22 and 24.
