# Spec: System Prompt Mode Reminder

## Summary

Change mode reminders from hidden persistent session messages to per-turn system prompt mutation.

## Why

Pi docs state that `before_agent_start` can inject a persistent message or replace/extend `systemPrompt`. The current extension returns a hidden `message`, which is stored in session and sent to the LLM. For mode reminders, this creates unnecessary session/context growth and can leave stale hidden reminders in history after mode changes.

## Scope

- Update `before_agent_start` in `index.ts`.
- Append the active mode reminder to `event.systemPrompt` when the active mode has a reminder.
- Stop returning `message` for mode reminders.
- Keep reminder text and behavior unchanged for Conversation and Plan modes.
- Build mode still has no reminder unless later configured.

## Implementation Notes

- Handler should accept `event`.
- If `MODE_CONFIG[activeMode].systemReminder` is missing, return `undefined`.
- Otherwise return `{ systemPrompt: `${event.systemPrompt}\n\n${systemReminder}` }`.
- Do not call `ctx.getSystemPrompt()` because `event.systemPrompt` is the documented chained value for this hook.

## Tests

- Add mocked extension test for `before_agent_start` in Conversation mode.
- Assert return contains `systemPrompt` with original prompt plus reminder.
- Assert return does not contain `message`.
- Add/keep test for Build mode returning `undefined`.
- Run `npm test`.

## Decisions

- Use system prompt mutation rather than persisted hidden message.
- Preserve current reminder copy.

## Tradeoffs

- System prompt mutation is per turn and does not persist as auditable session history.
- This is acceptable because mode reminder is runtime policy, not conversation content.

## Risks

- Later-loaded extensions can still modify the system prompt after this one, per Pi docs.

## Acceptance Criteria

- `before_agent_start` no longer returns a `message` for mode reminders.
- Conversation/Plan reminders still reach the model through `systemPrompt`.
- Tests cover no hidden message persistence.
