# Spec: Build Mode Guard Rules

## Summary

Enable safety prompts in Build mode by default for high-risk operations while keeping runtime binaries unguarded.

## Why

Build mode currently disables all guard rules. That restores full implementation access but removes prompts for destructive shell commands and external path access. The chosen behavior keeps Build productive while still confirming high-risk actions.

## Scope

- Update `MODE_GUARD_RULES.build` in `index.ts`.
- Build mode default rules:
  - `destructive-bash`
  - `home-path-outside-cwd`
  - `absolute-path-outside-cwd`
- Do not enable `runtime-binary` in Build mode.
- Update README guard-rule table/description.
- Add tests for rule configuration or extension behavior.

## Implementation Notes

- Preserve Build mode `edit`/`write` access.
- `tool_call` should still skip only when active mode has no enabled rules; after this change, Build should not skip.
- Confirmation UI behavior remains same as Conversation/Plan.
- No-UI behavior remains block when guarded action requires confirmation.

## Tests

- Add/adjust tests to verify Build mode enables the 3 selected rules.
- Add mocked extension test if feasible: after `/build`, a destructive bash tool call prompts/blocks on denial.
- Existing guard helper tests should remain unchanged.
- Run `npm test`.

## Decisions

- Build guards default on.
- Use recommended 3 rules.
- Exclude `runtime-binary` because Build commonly runs `node`, `python`, and similar runtimes.
- Ignore manual `!`/`!!` `user_bash`; not important for this plugin.
- No startup mode flag.

## Tradeoffs

- Build is no longer fully unprompted.
- Users get safer defaults for destructive or external-path actions.
- Runtime commands stay frictionless for normal build/test workflows.

## Risks

- More prompts in Build mode may interrupt workflows that use destructive shell commands intentionally.

## Acceptance Criteria

- Build mode prompts/blocks for destructive bash and guarded external paths.
- Build mode does not prompt just because command contains `node`, `python`, etc.
- README documents Build mode guard behavior accurately.
