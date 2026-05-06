# Mode Guard named safety rules

## Summary

Refactor `pi-mode-guard` so guard checks are explicit named rules that can be assigned per mode. For now, the new runtime/path guards apply only in **Conversation** and **Plan** modes. **Build** remains fully unlocked for now, but the structure will make future Build-specific rules easy to add.

## Key implementation changes

1. **Refactor guard logic in `guards.ts`**
   - Keep existing destructive bash behavior.
   - Add named rule support:
     - `destructive-bash`
     - `runtime-binary`
     - `home-path-outside-cwd`
     - `absolute-path-outside-cwd`
   - Add runtime binary detection for exact binary words anywhere in `bash.command`:
     - `python`, `python2`, `python3`
     - `node`
     - `ruby`
     - `perl`
     - `php`
     - `lua`
   - Do not exempt `--version` / `--help`; any use prompts.
   - Detect path substrings anywhere in `bash.command`, including quoted inline code.
   - Skip URL path portions.
   - Use lexical path resolution only; no `realpath`.

2. **Add `config.ts`**
   - Load config on `session_start` / reload only.
   - Load and combine:
     - global: `~/.pi/mode-guard.json`
     - project-local: `.pi-mode-guard.json` in `ctx.cwd`
   - Schema:
     ```json
     {
       "allowedExternalDirs": [
         "~/workspace/other-repo",
         "$HOME/src/shared"
       ]
     }
     ```
   - Expand `~`, `~/`, `$HOME`, `${HOME}`.
   - Resolve relative config entries relative to the config file location.
   - Invalid JSON or wrong shape: fail open with a one-time warning at config load.

3. **Update `index.ts` tool handling**
   - Replace the current `if (activeMode === "build") return undefined` style with a mode-to-rule mapping, likely near the top of `index.ts`, e.g.:
     ```ts
     const MODE_GUARD_RULES = {
       conversation: [
         "destructive-bash",
         "runtime-binary",
         "home-path-outside-cwd",
         "absolute-path-outside-cwd"
       ],
       plan: [
         "destructive-bash",
         "runtime-binary",
         "home-path-outside-cwd",
         "absolute-path-outside-cwd"
       ],
       build: []
     };
     ```
   - Preserve current `edit` / `write` hard-blocking in Conversation and Plan.
   - Apply path checks by tool name only for:
     - `read.path`
     - `grep.path`
     - `find.path`
     - `ls.path`
     - `bash.command`
   - Do not include `edit.path` or `write.path` yet.
   - Prompt separately per triggered rule.
   - Bash prompt order:
     1. `destructive-bash`
     2. `runtime-binary`
     3. `home-path-outside-cwd`
     4. `absolute-path-outside-cwd`
   - If a home-like absolute path matches both path rules, show only `home-path-outside-cwd`.
   - If one rule finds multiple paths, show one prompt for that rule listing all paths.
   - In no-UI mode, fail closed because confirmation is impossible.

4. **Path safety behavior**
   - Home-like patterns:
     - `~`
     - `~/...`
     - `$HOME`
     - `$HOME/...`
     - `${HOME}`
     - `${HOME}/...`
     - `/Users/...`
     - `/home/...`
     - `/root/...`
   - Absolute path rule:
     - Unix absolute paths only: `/...`
     - No Windows-style paths for now.
   - Do not prompt if path resolves inside `ctx.cwd`.
   - Do not prompt if path is inside any configured `allowedExternalDirs`.
   - `allowedExternalDirs` applies to both path rules and includes all descendants recursively.

5. **Add tests**
   - Add Node built-in test runner tests, no new dependencies.
   - Add `npm test` script.
   - Cover:
     - existing destructive bash patterns still work
     - runtime binaries trigger exact-word matches
     - `node_modules` / `python_script` do not trigger runtime rule
     - home-like outside cwd triggers
     - home-like inside cwd does not trigger
     - absolute outside cwd triggers
     - allowed external dirs suppress both path rules
     - URLs are skipped
     - duplicate home+absolute path produces only home rule
     - config loading combines global/project config
     - config expands `~` / `$HOME`
     - config resolves relative dirs by config file location
     - invalid config returns warning and ignores that file

6. **Update `README.md`**
   - Document named rules.
   - Document runtime binary prompts.
   - Document home/absolute path safety.
   - Document config paths and schema.
   - Document `npm test`.

## Decisions made

- New runtime/path guards apply only to Conversation and Plan for now.
- Build remains fully unlocked for now.
- Rule system should be explicit and mode-pluggable for future Build rules.
- Runtime binaries prompt, never hard-block in UI sessions.
- Runtime binary list is minimal.
- Any use of those binaries prompts, including version/help.
- Runtime binary matching is exact binary words anywhere in bash command text.
- Path safety scans built-in path fields plus `bash.command`.
- `edit.path` and `write.path` are not included now.
- Home-like paths are allowed if they resolve inside cwd.
- Both home-like and any absolute outside-cwd rules are enabled by default in Conversation/Plan.
- Config file approach with both global and project-local configs.
- Config loaded on session start/reload only.
- Invalid config fails open with warning.
- Multiple rules prompt separately.
- Same path matching both path rules gets one prompt, preferring home rule.
- Multiple paths in one rule get one prompt listing all paths.
- Project-local config is trusted as-is.
- Lexical path resolution only.
- Unix absolute paths only.
- Add tests and README updates.

## Tradeoffs and risks

- Scanning bash strings “anywhere” is intentionally protective but can produce false positives in echoed text or code examples.
- Runtime detection anywhere may prompt for commands like `grep "node" README.md`.
- Skipping URLs reduces common false positives but path extraction will still be regex-based, not a full shell parser.
- Lexical-only path checks do not catch symlink escapes.
- Trusted project-local config can broaden allowed external access if a repo includes `.pi-mode-guard.json`.
- No-UI sessions fail closed for guarded actions because prompts are impossible.

## Remaining open questions

None for implementation. The plan is decision-complete.

## Verification

Run:

```bash
npm test
```

Optionally smoke-test in Pi:

- `/plan`
- bash with `node --version` should prompt.
- bash with `cat ~/.zshrc` should prompt.
- `read.path` outside cwd should prompt.
- configured `allowedExternalDirs` should suppress path prompts.
- `/build` should bypass these new rules for now.

## Execution guidance

If execution deviates from this approved plan, update this saved plan file to reflect the latest approved plan and surface the deviation to the user before continuing.
