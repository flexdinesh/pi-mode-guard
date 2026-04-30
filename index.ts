import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Key } from "@mariozechner/pi-tui";
import { isDestructiveCommand } from "./guards.js";
import { MODE_CONFIG, MODE_ORDER, isMode, modeLabel, nextMode, type Mode } from "./modes.js";

export default function modeGuardExtension(pi: ExtensionAPI): void {
  let activeMode: Mode = "conversation";
  let pendingToggle = false;

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
    return "conversation";
  }

  for (const mode of MODE_ORDER) {
    const config = MODE_CONFIG[mode];
    pi.registerCommand(config.command, {
      description: config.description,
      handler: async (_args, ctx) => setMode(ctx, mode),
    });
  }

  pi.registerShortcut(Key.ctrlAlt("p"), {
    description: "Cycle conversation/plan/build mode",
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
    if (activeMode === "build") return undefined;

    if (event.toolName === "edit" || event.toolName === "write") {
      return {
        block: true,
        reason: `${modeLabel(activeMode)} mode active: ${event.toolName} is blocked. Use /build to enable file modifications.`,
      };
    }

    if (event.toolName === "bash") {
      const command = (event.input.command as string | undefined) ?? "";
      if (isDestructiveCommand(command)) {
        if (!ctx.hasUI) {
          return { block: true, reason: `${modeLabel(activeMode)} mode: destructive bash blocked (no UI for confirmation).\nCommand: ${command}` };
        }
        const ok = await ctx.ui.confirm(`Destructive bash in ${activeMode} mode`, `Allow?\n\n${command}`);
        if (!ok) {
          return { block: true, reason: "Blocked by user" };
        }
      }
    }

    return undefined;
  });

  pi.on("before_agent_start", async () => {
    const systemReminder = MODE_CONFIG[activeMode].systemReminder;
    if (!systemReminder) return;

    return {
      message: {
        customType: `mode-guard-${activeMode}`,
        content: systemReminder,
        display: false,
      },
    };
  });

  pi.on("turn_end", async (_event, ctx) => {
    if (pendingToggle) {
      pendingToggle = false;
      toggleMode(ctx);
    }
  });

  pi.on("session_start", async (_event, ctx) => {
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
