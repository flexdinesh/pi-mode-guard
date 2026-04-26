import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Key } from "@mariozechner/pi-tui";

const PLAN_TOOLS = ["read", "bash", "grep", "find", "ls"];
const BUILD_TOOLS = ["read", "bash", "edit", "write", "grep", "find", "ls"];

const DESTRUCTIVE_PATTERNS = [
  /\brm\b/i,
  /\brmdir\b/i,
  /\bmv\b/i,
  /\bcp\b/i,
  /\bmkdir\b/i,
  /\btouch\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\bchgrp\b/i,
  /\bln\b/i,
  /\btee\b/i,
  /\btruncate\b/i,
  /\bdd\b/i,
  /\bshred\b/i,
  /(^|[^<])\>(?!>)/,
  /\>\>/,
  /\bnpm\s+(install|uninstall|update|ci|link|publish)/i,
  /\byarn\s+(add|remove|install|publish)/i,
  /\bpnpm\s+(add|remove|install|publish)/i,
  /\bpip\s+(install|uninstall)/i,
  /\bapt(\-get)?\s+(install|remove|purge|update|upgrade)/i,
  /\bbrew\s+(install|uninstall|upgrade)/i,
  /\bgit\s+(add|commit|push|pull|merge|rebase|reset|checkout|branch\s+\-[dD]|stash|cherry\-pick|revert|tag|init|clone)/i,
  /\bsudo\b/i,
  /\bsu\b/i,
  /\bkill\b/i,
  /\bpkill\b/i,
  /\bkillall\b/i,
  /\breboot\b/i,
  /\bshutdown\b/i,
  /\bsystemctl\s+(start|stop|restart|enable|disable)/i,
  /\bservice\s+\S+\s+(start|stop|restart)/i,
  /\b(vim?|nano|emacs|code|subl)\b/i,
];

function isCurlCommand(command: string): boolean {
  return /^\s*curl\b/i.test(command);
}

function stripSafeCurlRedirects(command: string): string {
  return command
    .replace(/\s*&>\s*\/dev\/null\b/g, "")
    .replace(/\s*[12]?>\s*\/dev\/null\b/g, "")
    .replace(/\s*[12]>&[12]\b/g, "");
}

export default function modeGuardExtension(pi: ExtensionAPI): void {
  let planModeEnabled = false;
  let pendingToggle = false;

  function persistState(): void {
    pi.appendEntry("mode-guard", {
      planMode: planModeEnabled,
    });
  }

  function updateStatus(ctx: ExtensionContext): void {
    if (planModeEnabled) {
      ctx.ui.setStatus("mode-guard", ctx.ui.theme.fg("warning", "🔒 plan"));
    } else {
      ctx.ui.setStatus("mode-guard", ctx.ui.theme.fg("success", "Build 🚀"));
    }
  }

  function setPlanMode(ctx: ExtensionContext): void {
    planModeEnabled = true;
    pi.setActiveTools(PLAN_TOOLS);
    ctx.ui.notify("Plan mode: read-only. edit/write blocked. destructive bash requires confirmation.", "info");
    updateStatus(ctx);
    persistState();
  }

  function setBuildMode(ctx: ExtensionContext): void {
    planModeEnabled = false;
    pi.setActiveTools(BUILD_TOOLS);
    ctx.ui.notify("Build mode: full tool access restored.", "info");
    updateStatus(ctx);
    persistState();
  }

  function toggleMode(ctx: ExtensionContext): void {
    if (planModeEnabled) {
      setBuildMode(ctx);
    } else {
      setPlanMode(ctx);
    }
  }

  pi.registerCommand("plan", {
    description: "Enter plan mode (read-only)",
    handler: async (_args, ctx) => setPlanMode(ctx),
  });

  pi.registerCommand("build", {
    description: "Enter build mode (full access)",
    handler: async (_args, ctx) => setBuildMode(ctx),
  });

  pi.registerShortcut(Key.ctrlAlt("p"), {
    description: "Toggle plan/build mode",
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
    if (!planModeEnabled) return undefined;

    if (event.toolName === "edit" || event.toolName === "write") {
      return {
        block: true,
        reason: `Plan mode active: ${event.toolName} is blocked. Use /build to enable file modifications.`,
      };
    }

    if (event.toolName === "bash") {
      const command = (event.input.command as string) ?? "";
      const commandForDetection = isCurlCommand(command) ? stripSafeCurlRedirects(command) : command;
      const isDestructive = DESTRUCTIVE_PATTERNS.some((p) => p.test(commandForDetection));
      if (isDestructive) {
        if (!ctx.hasUI) {
          return { block: true, reason: `Plan mode: destructive bash blocked (no UI for confirmation).\nCommand: ${command}` };
        }
        const ok = await ctx.ui.confirm("Destructive bash in plan mode", `Allow?\n\n${command}`);
        if (!ok) {
          return { block: true, reason: "Blocked by user" };
        }
      }
    }

    return undefined;
  });

  pi.on("before_agent_start", async () => {
    if (!planModeEnabled) return;
    return {
      message: {
        customType: "mode-guard-plan",
        content: `[MODE: PLAN]
You are in plan mode. File modifications are DISABLED.
- You cannot use edit or write tools
- Destructive bash commands require user confirmation
- Focus on exploration, analysis, and planning only
- Do not attempt to make changes to files or the system`,
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
      .pop() as { data?: { planMode?: boolean } } | undefined;

    if (lastEntry) {
      // restore persisted mode
      if (lastEntry.data?.planMode === true) {
        planModeEnabled = true;
        pi.setActiveTools(PLAN_TOOLS);
      } else {
        planModeEnabled = false;
        pi.setActiveTools(BUILD_TOOLS);
      }
    } else {
      // fresh session: default to plan mode
      planModeEnabled = true;
      pi.setActiveTools(PLAN_TOOLS);
      persistState();
    }

    updateStatus(ctx);
  });

  pi.on("session_shutdown", async () => {
    pendingToggle = false;
  });
}
