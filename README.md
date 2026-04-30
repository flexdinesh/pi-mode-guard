# pi-mode-guard

Three-mode workflow for the [pi coding agent](https://github.com/mariozechner/pi-coding-agent).

## What it does

Enforces **Conversation mode** (read-only) by default. You must explicitly switch to **Build mode** to make changes.

- **Conversation mode** — `edit` and `write` tools are blocked. Destructive bash (e.g. `rm`, `git commit`, `npm install`, `>`, `sudo`, etc.) requires confirmation. Non-destructive read/inspect commands pass freely. The model is guided to explore, discuss, ask questions, and avoid steering prematurely toward implementation.
- **Plan mode** — same read-only permissions as Conversation mode, but the model is guided toward analysis and planning.
- **Build mode** — all tools unlocked.

The active mode persists across sessions.

## How to use

| Action                  | Command                                      |
| ----------------------- | -------------------------------------------- |
| Enter Conversation mode | `/convo`                                     |
| Enter Plan mode         | `/plan`                                      |
| Enter Build mode        | `/build`                                     |
| Cycle mode              | `Ctrl + Alt + P` _(Conversation → Plan → Build; queues if agent is busy)_ |

The status bar shows the current mode:

- 💬 convo (Conversation mode)
- 🔒 plan (Plan mode)
- Build 🚀 (Build mode)

## How it works

The extension hooks into pi's event system:

- **`session_start`** — restores the previous mode, or defaults to Conversation on a fresh session.
- **`tool_call`** — intercepts `edit`/`write` in Conversation and Plan modes. Intercepts destructive bash and prompts for confirmation.
- **`before_agent_start`** — injects a mode-specific reminder into the system context when in Conversation or Plan mode.
- **`turn_end`** — applies any queued mode toggle.
- **`session_shutdown`** — clears pending toggle state.

Destructive bash detection uses a regex list covering common mutating commands (see `DESTRUCTIVE_PATTERNS` in `guards.ts`).

## Install

```bash
ln -s ~/workspace/pi-mode-guard ~/.pi/agent/extensions/mode-guard
```

Restart pi to load the extension.
