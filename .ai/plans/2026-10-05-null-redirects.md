# Allow Safe /dev/null Redirects in Mode Guard

## Summary

Treat shell redirections to `/dev/null` as non-destructive for bash guard detection, without globally allowing `/dev/null` as a normal absolute path.

## Key implementation changes

1. Replace the curl-specific safe redirect sanitizer with a general sanitizer for safe `/dev/null` redirect forms.
2. Apply the sanitizer before `destructive-bash` detection for all bash commands.
3. Apply the sanitizer before bash path detection so redirected `/dev/null` does not trigger `absolute-path-outside-cwd`.
4. Keep non-redirect uses of `/dev/null`, such as `cat /dev/null`, subject to existing absolute path guard behavior.
5. Limit the exemption to `/dev/null`; do not add other `/dev/*` paths.
6. Update tests and README documentation.

## User decisions

- Support broad common shell redirect syntax for `/dev/null`, including spaced forms, append forms, stdout/stderr forms, combined stdout/stderr forms, input redirects, and fd duplication used with null redirects.
- Exempt only redirect usage, not `/dev/null` globally.
- Exempt only `/dev/null`, not other device files.

## Tests and verification

- Add tests proving `kubectl ... 2>/dev/null` and similar safe redirects do not trigger guard findings.
- Add tests proving unsafe redirects still trigger.
- Add tests proving `cat /dev/null` still triggers the absolute path guard.
- Run `npm test`.

## Tradeoffs and risks

- This is intentionally narrower than a global `/dev/null` allowlist, preserving path guard strictness for normal absolute path references.
- Regex-based shell parsing remains approximate, but the supported cases are common, targeted, and test-covered.

## Execution guidance

If implementation needs to deviate from this approved plan, update this plan file to reflect the latest approved plan and surface the deviation to the user before proceeding.
