import type { GuardRuleName } from "./guards.js";

export type Mode = "conversation" | "plan" | "build";

type StatusTone = "accent" | "warning" | "success";

export interface ModeConfig {
  mode: Mode;
  label: string;
  command: string;
  description: string;
  notification: string;
  statusText: string;
  statusTone: StatusTone;
  tools: string[];
  systemReminder?: string;
}

export const READ_ONLY_TOOLS = ["read", "bash", "grep", "find", "ls"];
export const BUILD_TOOLS = ["read", "bash", "edit", "write", "grep", "find", "ls"];

export const DEFAULT_MODE: Mode = "plan";
export const MODE_ORDER: Mode[] = ["plan", "build", "conversation"];

export const MODE_GUARD_RULES: Record<Mode, GuardRuleName[]> = {
  conversation: ["destructive-bash", "runtime-binary", "home-path-outside-cwd", "absolute-path-outside-cwd"],
  plan: ["destructive-bash", "runtime-binary", "home-path-outside-cwd", "absolute-path-outside-cwd"],
  build: ["destructive-bash", "home-path-outside-cwd", "absolute-path-outside-cwd"],
};

export const MODE_CONFIG: Record<Mode, ModeConfig> = {
  conversation: {
    mode: "conversation",
    label: "Conversation",
    command: "convo",
    description: "Enter conversation mode (read-only exploration)",
    notification: "Conversation mode: read-only exploration. edit/write blocked. destructive bash requires confirmation.",
    statusText: "💬 convo",
    statusTone: "accent",
    tools: READ_ONLY_TOOLS,
    systemReminder: `[MODE: CONVERSATION]
You are in conversation mode. File modifications are DISABLED.
- You cannot use edit or write tools
- Destructive bash commands require user confirmation
- Focus on exploration, understanding, and open-ended conversation
- Do not implement changes or mutate files/system state
- Do not steer the user toward a solution prematurely
- Keep the conversation going with the user through thoughtful questions and discussion`,
  },
  plan: {
    mode: "plan",
    label: "Plan",
    command: "plan",
    description: "Enter plan mode (read-only planning)",
    notification: "Plan mode: read-only. edit/write blocked. destructive bash requires confirmation.",
    statusText: "🔒 plan",
    statusTone: "warning",
    tools: READ_ONLY_TOOLS,
    systemReminder: `[MODE: PLAN]
You are in plan mode. File modifications are DISABLED.
- You cannot use edit or write tools
- Destructive bash commands require user confirmation
- Focus on exploration, analysis, and planning only
- Do not attempt to make changes to files or the system`,
  },
  build: {
    mode: "build",
    label: "Build",
    command: "build",
    description: "Enter build mode (full access)",
    notification: "Build mode: full tool access restored.",
    statusText: "Build 🚀",
    statusTone: "success",
    tools: BUILD_TOOLS,
  },
};

export function isMode(value: unknown): value is Mode {
  return value === "conversation" || value === "plan" || value === "build";
}

export function modeLabel(mode: Mode): string {
  return MODE_CONFIG[mode].label;
}

export function nextMode(mode: Mode): Mode {
  const index = MODE_ORDER.indexOf(mode);
  return MODE_ORDER[(index + 1) % MODE_ORDER.length];
}

export function applyModeSystemReminder(mode: Mode, systemPrompt: string): string | undefined {
  const systemReminder = MODE_CONFIG[mode].systemReminder;
  if (!systemReminder) return undefined;
  return `${systemPrompt}\n\n${systemReminder}`;
}
