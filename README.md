# pi-mode-guard

Three-mode workflow for the [pi coding agent](https://github.com/mariozechner/pi-coding-agent).

## What it does

Enforces **Conversation mode** (read-only) by default. You must explicitly switch to **Build mode** to make changes.

- **Conversation mode** — `edit` and `write` tools are blocked. Guarded bash/path activity requires confirmation. Non-destructive read/inspect commands pass freely unless they reference guarded paths. The model is guided to explore, discuss, ask questions, and avoid steering prematurely toward implementation.
- **Plan mode** — same read-only permissions as Conversation mode, but the model is guided toward analysis and planning.
- **Build mode** — all tools unlocked. Build-specific safety rules are intentionally not enabled yet.

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

## Guard rules

Guard checks are explicit named rules so each mode can choose which rules to apply.

Conversation and Plan currently enable:

| Rule | Applies to | Behavior |
| ---- | ---------- | -------- |
| `destructive-bash` | `bash.command` | Prompts for common mutating/destructive commands such as `rm`, `git commit`, `npm install`, redirects, `sudo`, etc. |
| `runtime-binary` | `bash.command` | Prompts when the command text contains exact binary words for `python`, `python2`, `python3`, `node`, `ruby`, `perl`, `php`, or `lua`, including version/help calls. |
| `home-path-outside-cwd` | `bash.command`, `read.path`, `grep.path`, `find.path`, `ls.path` | Prompts for home-like paths outside the current working directory and outside configured allowed external dirs. |
| `absolute-path-outside-cwd` | `bash.command`, `read.path`, `grep.path`, `find.path`, `ls.path` | Prompts for Unix absolute paths outside the current working directory and outside configured allowed external dirs. |

Build currently enables no guard rules.

When multiple rules match, pi prompts once per rule in this order for bash commands:

1. `destructive-bash`
2. `runtime-binary`
3. `home-path-outside-cwd`
4. `absolute-path-outside-cwd`

If the same path matches both path rules, only the more specific `home-path-outside-cwd` rule prompts. If a rule finds multiple paths, one prompt lists all matched paths. In no-UI mode, guarded actions are blocked because confirmation is impossible.

## Path safety configuration

The path rules allow anything inside the current working directory. To allow known external source trees, configure `allowedExternalDirs`.

Config files are loaded on session start/reload only:

1. Global: `~/.pi/mode-guard.json`
2. Project-local: `.pi-mode-guard.json` in the current working directory

Both files use the same schema and are combined:

```json
{
  "allowedExternalDirs": [
    "~/workspace/other-repo",
    "$HOME/src/shared",
    "../sibling-repo"
  ]
}
```

Config path handling:

- `~`, `~/`, `$HOME`, and `${HOME}` are expanded.
- Relative entries are resolved relative to the config file location.
  - Global relative paths resolve from `~/.pi/`.
  - Project-local relative paths resolve from the project cwd.
- Allowed directories include all descendants recursively.
- Invalid config files are ignored with a warning.

Guarded path patterns include:

- `~`, `~/...`
- `$HOME`, `$HOME/...`
- `${HOME}`, `${HOME}/...`
- `/Users/...`
- `/home/...`
- `/root/...`
- any Unix absolute path like `/etc/hosts`, `/tmp/foo`, `/var/log/...`

URL path portions are skipped to avoid prompts for URLs such as `https://example.com/api/v1`.

## How it works

The extension hooks into pi's event system:

- **`session_start`** — loads guard config, restores the previous mode, or defaults to Conversation on a fresh session.
- **`tool_call`** — intercepts `edit`/`write` in Conversation and Plan modes. Applies the active mode's named guard rules and prompts for confirmation.
- **`before_agent_start`** — injects a mode-specific reminder into the system context when in Conversation or Plan mode.
- **`turn_end`** — applies any queued mode toggle.
- **`session_shutdown`** — clears pending toggle state.

## Test

```bash
npm test
```

## Install

```bash
ln -s ~/workspace/pi-mode-guard ~/.pi/agent/extensions/mode-guard
```

Restart pi to load the extension.
