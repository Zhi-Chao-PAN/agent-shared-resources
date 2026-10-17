# Security and privacy boundaries

Do not place tokens, native settings, account caches, chat logs, local manifests or publication receipts in this repository or issue attachments. Authentication stays with each user's official providers. This tool does not mediate business permissions or guarantee sandboxing of Skill scripts or custom MCP commands; use only sources you have reviewed.

The publisher targets explicit home-contained native paths, rejects symlink/junction destinations, refuses conflicting entries, keeps local backups, and checks concurrent file edits. Unix private modes are applied to local state; Windows inherits the user's directory ACLs. A publication lock coordinates only this tool, not edits made by another application.

The publication checker detects common credential patterns, accidental native-state files and machine paths. It is a guardrail, not proof that a repository contains no secrets. Use GitHub push protection and review diffs before publishing.

For a vulnerability, use GitHub private vulnerability reporting if available on the repository. Otherwise contact the maintainer using their public profile without including live credentials, and arrange a private report. Do not send working secrets in public issues.
