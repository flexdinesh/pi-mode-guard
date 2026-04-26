# pi-mode-guard

Two-mode workflow for the [pi coding agent](https://github.com/mariozechner/pi-coding-agent).

## What it does

Enforces **Plan mode** (read-only) by default. You must explicitly switch to **Build mode** to make changes.

- **Plan mode** — `edit` and `write` tools are blocked. Destructive bash (e.g. `rm`, `git commit`, `npm install`, `>`, `sudo`, etc.) requires confirmation. Non-destructive read/inspect commands pass freely.
- **Build mode** — all tools unlocked.

The active mode persists across sessions.

## How to use

| Action           | Command                                      |
| ---------------- | -------------------------------------------- |
| Enter Plan mode  | `/plan`                                      |
| Enter Build mode | `/build`                                     |
| Toggle mode      | `Ctrl + Alt + P` _(queues if agent is busy)_ |

The status bar shows the current mode:

- 🔒 plan (Plan mode)
- Build 🚀 (Build mode)

## How it works

The extension hooks into pi's event system:

- **`session_start`** — restores the previous mode, or defaults to Plan on a fresh session.
- **`tool_call`** — intercepts `edit`/`write` in Plan mode. Intercepts destructive bash and prompts for confirmation.
- **`before_agent_start`** — injects a reminder into the system context when in Plan mode.
- **`turn_end`** — applies any queued mode toggle.
- **`session_shutdown`** — clears pending toggle state.

Destructive bash detection uses a regex list covering common mutating commands (see `DESTRUCTIVE_PATTERNS` in `index.ts`).

## Install

```bash
ln -s ~/workspace/pi-mode-guard ~/.pi/agent/extensions/mode-guard
```

Restart pi to load the extension.
