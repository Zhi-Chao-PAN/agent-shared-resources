## Summary

What changes, and which user problem does it solve?

## Safety checklist

- [ ] Native client config is edited only at the selected key/block, not replaced wholesale.
- [ ] Unrelated settings, comments, models, plugins, and approval rules are preserved.
- [ ] Conflicting entries are refused rather than overwritten.
- [ ] Publish, idempotency, rollback, and interruption behavior are covered by tests (when applicable).
- [ ] No credentials, tokens, account ids, local manifests, native settings, or personal paths are included.

## Verification

- [ ] `npm run check` passes.
- [ ] I tested on a disposable home directory, not a live client configuration.
- [ ] For a client adapter: official path reference added, fixture includes unrelated private settings, and the OS support label is honest.

## Notes for reviewers

Anything version-specific, unverified, or intentionally out of scope.
