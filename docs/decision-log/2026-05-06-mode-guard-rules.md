---
title: Mode guard named safety rules
description: Refactor pi-mode-guard around named per-mode guard rules with runtime and path safety prompts.
date: 2026-05-06
slug: mode-guard-rules
status: implemented
tags:
  - pi-extension
  - safety
  - permissions
related_paths:
  - index.ts
  - guards.ts
  - config.ts
  - guards.test.ts
  - README.md
---

## Why

The existing mode guard blocked writes in Conversation/Plan and prompted for destructive bash, but it did not catch agents using programming runtimes such as `python` or `node` to run arbitrary scripts. It also did not guard reads/searches/commands that reference sensitive paths outside the current working directory.

## What

- Use explicit named guard rules so different modes can opt into different safety behavior later.
- Apply new runtime/path guards only to Conversation and Plan for now; keep Build fully unlocked for now.
- Prompt in UI sessions for guarded actions; fail closed when no UI is available because confirmation is impossible.
- Guard rule names:
  - `destructive-bash`
  - `runtime-binary`
  - `home-path-outside-cwd`
  - `absolute-path-outside-cwd`
- Runtime binary rule covers exact binary words anywhere in `bash.command` for:
  - `python`, `python2`, `python3`, `node`, `ruby`, `perl`, `php`, `lua`
- Path rules scan:
  - `bash.command`
  - `read.path`
  - `grep.path`
  - `find.path`
  - `ls.path`
- Do not scan `edit.path` or `write.path` yet because those tools are already blocked in Conversation/Plan.
- Enable both home-like and any Unix absolute outside-cwd path rules by default in Conversation/Plan.

## How

- Load allowed external directories from config files at session start/reload only:
  - global: `~/.pi/mode-guard.json`
  - project-local: `.pi-mode-guard.json`
- Config schema:
  ```json
  {
    "allowedExternalDirs": ["~/workspace/other-repo", "$HOME/src/shared"]
  }
  ```
- Expand `~`, `$HOME`, and `${HOME}` in config values.
- Resolve relative config entries from the config file location.
- Treat allowed external directories recursively and apply them to both path rules.
- Invalid config fails open with a warning and contributes no allowed dirs from that file.
- Use lexical path resolution only; do not resolve symlinks.
- Skip URL path portions during bash path scanning.
- If one path matches both path rules, prompt only for `home-path-outside-cwd`.
- If one rule matches multiple paths, use one prompt for that rule listing all paths.

## Tradeoffs and gotchas

- Bash scanning intentionally checks substrings broadly, so commands like `grep "node" README.md` can trigger the runtime prompt.
- Lexical-only path checks do not catch symlink escapes.
- Trusted project-local config can broaden allowed external access if a repo includes `.pi-mode-guard.json`.
- Build mode has no safety rules yet by design; future Build-specific policy can reuse the named rule structure.
