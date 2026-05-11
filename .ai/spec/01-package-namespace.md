# Spec: Package Namespace Migration

## Summary

Migrate the extension from the old `@mariozechner/*` Pi package namespace to the latest documented `@earendil-works/*` namespace.

## Why

Latest Pi extension docs list `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` as the supported imports. Keeping the old namespace risks install/runtime failures for users on current Pi versions.

## Scope

- Update extension imports in `index.ts`.
- Update Pi peer dependencies in `package.json`.
- Update README references that point to the old Pi repository or package namespace.
- Do not change extension behavior.

## Implementation Notes

- Replace `@mariozechner/pi-coding-agent` with `@earendil-works/pi-coding-agent`.
- Replace `@mariozechner/pi-tui` with `@earendil-works/pi-tui`.
- Keep these as `peerDependencies` with `"*"`, per Pi package docs.
- If the local environment cannot resolve the new packages during tests, document that as environment/package install gap rather than adding compatibility shims.

## Tests

- Run `npm test`.
- If a typecheck script exists later, run it too.
- Verify `package.json` still has `pi.extensions: ["./index.ts"]`.

## Decisions

- Use latest documented `@earendil-works/*` namespace.
- Do not keep backward compatibility imports for old namespace.

## Tradeoffs

- Users pinned to old Pi packages may need to upgrade Pi.
- Simpler package metadata and fewer compatibility paths.

## Risks

- Local tests may fail if the installed Pi package is still only available under the old namespace.

## Acceptance Criteria

- No source or docs reference `@mariozechner/pi-coding-agent` or `@mariozechner/pi-tui`.
- Current Pi namespace appears in imports and peer dependencies.
- Tests pass or any environment-only dependency issue is clearly reported.
