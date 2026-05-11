# Spec: Typed Tool Guard Narrowing

## Summary

Use Pi's typed tool-event helper for built-in tool inputs while preserving current guard behavior.

## Why

Pi docs recommend `isToolCallEventType()` to narrow built-in tool event inputs. The current implementation reads `event.input` through raw `toolName` string checks. Typed narrowing reduces drift risk and keeps tool-specific input handling aligned with Pi primitives.

## Scope

- Import `isToolCallEventType` from `@earendil-works/pi-coding-agent`.
- Use it in the `tool_call` hook for relevant built-in tools.
- Preserve existing read-only blocking for `edit` and `write` outside Build mode.
- Preserve existing guard checks and prompts.
- Avoid type assertions and `any`.

## Implementation Notes

- Keep guard evaluation centralized in `evaluateToolCallGuards()`.
- `evaluateToolCallGuards()` currently accepts `Record<string, unknown>`.
- For typed event inputs, pass them to a small helper only if it can be done without type assertions.
- If TypeScript cannot express the generic input shape safely, keep runtime guard input as `event.input` and use `isToolCallEventType()` for tool-specific access where needed.
- Do not broaden behavior or change guard rule matching.

## Tests

- Existing guard helper tests should continue to pass.
- Add extension-level tests if mocking Pi handlers is feasible.
- Run `npm test`.

## Decisions

- Prefer typed Pi helper where practical.
- Do not introduce unsafe type assertions.
- Do not rewrite guard detection internals unless necessary.

## Tradeoffs

- Full static typing may require more wrapper code because guard helpers intentionally work with generic tool inputs.
- Minimal typed narrowing is better than adding broad abstractions.

## Risks

- Importing helper depends on latest package namespace from spec 01.

## Acceptance Criteria

- `tool_call` uses `isToolCallEventType()` for built-in tools where the extension inspects tool-specific input.
- No behavior regression in guard tests.
- No `any`, no non-null assertions, no type assertions added.
