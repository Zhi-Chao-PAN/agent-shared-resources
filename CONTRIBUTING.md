# Contributing

Use Node.js 22+, run `npm ci --ignore-scripts`, then `npm run check`. Tests use disposable home directories, never the maintainer's live clients. Do not run `apply` against real home directories in automated tests.

`README.md` and `README.zh-CN.md` are parallel entry points. Update both when changing the quick start, supported-client table, or safety claims. `docs/quickstart.md` is the English walkthrough; the compatibility, MCP, design, and validation documents are currently Chinese. Keep client counts and “file adapter vs. real client acceptance” wording consistent. The repository social preview is `docs/assets/social-preview.png` (1280×640), rendered from the SVG in the same directory.

For a new client adapter, provide official path references where available, a native config fixture with unrelated private options/comments, publish/idempotency/rollback tests, and an honest OS support label. Add it to the README client table and compatibility document. Unknown Windows paths must require local overrides rather than inherit macOS paths. A model response claiming success is not enough: record native tool execution or a redacted result without account data.

Keep optional runtime versions pinned; preserve third-party licenses and update catalog hashes only after reviewing source changes. Do not add broad tool auto-approval rules, forced global Agent workflows, a default common-directory rollout, or diagnostic probes to all clients.

Never include local manifests, native app settings, OAuth caches, credentials, chat transcripts, private bridge destinations, or the user's machine-specific Git history in a contribution. Public bug reports should contain minimal sanitized fixtures. Report credential exposure privately through GitHub's available security reporting channel rather than posting the secret.
