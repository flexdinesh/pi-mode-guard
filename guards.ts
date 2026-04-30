export const DESTRUCTIVE_PATTERNS = [
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

export function isDestructiveCommand(command: string): boolean {
  const commandForDetection = isCurlCommand(command) ? stripSafeCurlRedirects(command) : command;
  return DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(commandForDetection));
}
