import { isToolCallEventType, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";
import { loadModeGuardConfig, type ModeGuardConfig } from "./config.js";
import { evaluateToolCallGuards, type GuardFinding } from "./guards.js";
import { DEFAULT_MODE, MODE_CONFIG, MODE_GUARD_RULES, MODE_ORDER, applyModeSystemReminder, isMode, modeLabel, nextMode, type Mode } from "./modes.js";

const EMPTY_MODE_GUARD_CONFIG: ModeGuardConfig = {
  allowedExternalDirs: [],
};

function formatGuardFinding(finding: GuardFinding): string {
  return `Rule: ${finding.rule}\n${finding.message}`;
}

export default function modeGuardExtension(pi: ExtensionAPI): void {
  let activeMode: Mode = DEFAULT_MODE;
  let pendingToggle = false;
  let modeGuardConfig: ModeGuardConfig = EMPTY_MODE_GUARD_CONFIG;

  function persistState(): void {
    pi.appendEntry("mode-guard", {
      mode: activeMode,
    });
  }

  function applyActiveTools(): void {
    pi.setActiveTools(MODE_CONFIG[activeMode].tools);
  }

  function updateStatus(ctx: ExtensionContext): void {
    const config = MODE_CONFIG[activeMode];
    ctx.ui.setStatus("mode-guard", ctx.ui.theme.fg(config.statusTone, config.statusText));
  }

  function setMode(ctx: ExtensionContext, mode: Mode): void {
    activeMode = mode;
    applyActiveTools();
    ctx.ui.notify(MODE_CONFIG[mode].notification, "info");
    updateStatus(ctx);
    persistState();
  }

  function toggleMode(ctx: ExtensionContext): void {
    setMode(ctx, nextMode(activeMode));
  }

  function restoreMode(data?: { mode?: unknown; planMode?: boolean }): Mode {
    if (isMode(data?.mode)) return data.mode;
    if (data?.planMode === true) return "plan";
    if (data?.planMode === false) return "build";
    return DEFAULT_MODE;
  }

  for (const mode of MODE_ORDER) {
    const config = MODE_CONFIG[mode];
    pi.registerCommand(config.command, {
      description: config.description,
      handler: async (_args, ctx) => setMode(ctx, mode),
    });
  }

  pi.registerShortcut(Key.ctrlAlt("p"), {
    description: "Cycle plan/build/conversation mode",
    handler: async (ctx) => {
      if (!ctx.isIdle()) {
        if (pendingToggle) {
          pendingToggle = false;
          ctx.ui.notify("Mode switch cancelled", "info");
        } else {
          pendingToggle = true;
          ctx.ui.notify("Mode switch queued — will apply after current turn", "info");
        }
        return;
      }
      toggleMode(ctx);
    },
  });

  pi.on("tool_call", async (event, ctx) => {
    if (activeMode !== "build" && (event.toolName === "edit" || event.toolName === "write")) {
      return {
        block: true,
        reason: `${modeLabel(activeMode)} mode active: ${event.toolName} is blocked. Use /build to enable file modifications.`,
      };
    }

    const enabledRules = MODE_GUARD_RULES[activeMode];
    if (enabledRules.length === 0) return undefined;

    let guardInput = event.input;
    if (isToolCallEventType("bash", event)) {
      guardInput = { command: event.input.command };
    } else if (isToolCallEventType("read", event)) {
      guardInput = { path: event.input.path };
    } else if (isToolCallEventType("grep", event)) {
      guardInput = { path: event.input.path };
    } else if (isToolCallEventType("find", event)) {
      guardInput = { path: event.input.path };
    } else if (isToolCallEventType("ls", event)) {
      guardInput = { path: event.input.path };
    }

    const findings = evaluateToolCallGuards(event.toolName, guardInput, enabledRules, {
      cwd: ctx.cwd,
      allowedExternalDirs: modeGuardConfig.allowedExternalDirs,
    });

    for (const finding of findings) {
      const prompt = formatGuardFinding(finding);
      if (!ctx.hasUI) {
        return {
          block: true,
          reason: `${modeLabel(activeMode)} mode: ${finding.rule} blocked (no UI for confirmation).\n${prompt}`,
        };
      }

      const ok = await ctx.ui.confirm(`${finding.rule} in ${activeMode} mode`, `Allow?\n\nTool: ${event.toolName}\n\n${prompt}`);
      if (!ok) {
        return { block: true, reason: "Blocked by user" };
      }
    }

    return undefined;
  });

  pi.on("before_agent_start", async (event) => {
    const systemPrompt = applyModeSystemReminder(activeMode, event.systemPrompt);
    if (!systemPrompt) return undefined;

    return { systemPrompt };
  });

  pi.on("turn_end", async (_event, ctx) => {
    if (pendingToggle) {
      pendingToggle = false;
      toggleMode(ctx);
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    const loadedConfig = await loadModeGuardConfig(ctx.cwd);
    modeGuardConfig = { allowedExternalDirs: loadedConfig.allowedExternalDirs };
    for (const warning of loadedConfig.warnings) {
      if (ctx.hasUI) {
        ctx.ui.notify(warning, "warning");
      } else {
        console.warn(warning);
      }
    }

    const entries = ctx.sessionManager.getEntries();
    const lastEntry = entries
      .filter((e: { type: string; customType?: string }) => e.type === "custom" && e.customType === "mode-guard")
      .pop() as { data?: { mode?: unknown; planMode?: boolean } } | undefined;

    activeMode = restoreMode(lastEntry?.data);

    // Persist the new default mode only for fresh sessions. Existing sessions keep
    // their latest mode entry, including legacy two-mode state.
    if (!lastEntry) persistState();

    applyActiveTools();
    updateStatus(ctx);
  });

  pi.on("session_shutdown", async () => {
    pendingToggle = false;
  });
}
