import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { loadModeGuardConfig } from "./config.ts";
import {
  detectRuntimeBinaries,
  evaluateToolCallGuards,
  isDestructiveCommand,
  type GuardContext,
  type GuardRuleName,
} from "./guards.ts";
import { DEFAULT_MODE, MODE_CONFIG, MODE_GUARD_RULES, MODE_ORDER, applyModeSystemReminder } from "./modes.ts";

const ALL_RULES: GuardRuleName[] = [
  "destructive-bash",
  "runtime-binary",
  "home-path-outside-cwd",
  "absolute-path-outside-cwd",
];

const context: GuardContext = {
  cwd: "/Users/me/workspace/project",
  homeDir: "/Users/me",
  allowedExternalDirs: [],
};

function findings(toolName: string, input: Record<string, unknown>, rules: GuardRuleName[] = ALL_RULES, ctx = context) {
  return evaluateToolCallGuards(toolName, input, rules, ctx).map((finding) => finding.rule);
}

test("existing destructive bash detection still works", () => {
  assert.equal(isDestructiveCommand("rm -rf dist"), true);
  assert.equal(isDestructiveCommand("git status --short"), false);
});

test("safe /dev/null redirects do not trigger destructive or absolute path guards", () => {
  assert.deepEqual(
    findings("bash", { command: "kubectl -n postgres-ha describe scheduledbackup postgres-cluster-backup 2>/dev/null | head -30" }),
    [],
  );
  assert.deepEqual(
    findings("bash", { command: "kubectl -n longhorn-system get recurringjob --no-headers 2> /dev/null" }),
    [],
  );
  assert.deepEqual(findings("bash", { command: "curl https://example.com &>>/dev/null" }), []);
  assert.deepEqual(findings("bash", { command: "grep pattern < /dev/null >/dev/null 2>&1" }), []);
});

test("unsafe redirects and non-redirect /dev/null paths still trigger", () => {
  assert.equal(isDestructiveCommand("echo hi > /tmp/out"), true);
  assert.equal(isDestructiveCommand("echo hi >> output.txt"), true);
  assert.equal(isDestructiveCommand("echo warning >&2"), true);
  assert.deepEqual(findings("bash", { command: "cat /dev/null" }, ["absolute-path-outside-cwd"]), [
    "absolute-path-outside-cwd",
  ]);
  assert.deepEqual(findings("bash", { command: "cat /etc/hosts 2>/dev/null" }, ["absolute-path-outside-cwd"]), [
    "absolute-path-outside-cwd",
  ]);
});

test("runtime binaries trigger as exact words anywhere", () => {
  assert.deepEqual(detectRuntimeBinaries("node --version && python -V && /usr/bin/ruby -v"), [
    "node",
    "python",
    "ruby",
  ]);
  assert.deepEqual(findings("bash", { command: "grep node README.md" }, ["runtime-binary"]), ["runtime-binary"]);
});

test("runtime binaries do not trigger inside larger words", () => {
  assert.deepEqual(detectRuntimeBinaries("ls node_modules && echo python_script && cat my-node-notes.txt"), []);
});

test("fresh sessions default to plan mode and cycle plan/build/conversation", () => {
  assert.equal(DEFAULT_MODE, "plan");
  assert.deepEqual(MODE_ORDER, ["plan", "build", "conversation"]);
});

test("mode system reminders append to the system prompt only for read-only modes", () => {
  assert.equal(
    applyModeSystemReminder("conversation", "base prompt"),
    `base prompt\n\n${MODE_CONFIG.conversation.systemReminder}`,
  );
  assert.equal(applyModeSystemReminder("build", "base prompt"), undefined);
});

test("build mode enables high-risk guards without runtime binary prompts", () => {
  assert.deepEqual(MODE_GUARD_RULES.build, ["destructive-bash", "home-path-outside-cwd", "absolute-path-outside-cwd"]);
  assert.equal(MODE_GUARD_RULES.build.includes("runtime-binary"), false);
  assert.deepEqual(findings("bash", { command: "node --version" }, MODE_GUARD_RULES.build), []);
  assert.deepEqual(findings("bash", { command: "rm -rf dist" }, MODE_GUARD_RULES.build), ["destructive-bash"]);
  assert.deepEqual(findings("bash", { command: "cat /etc/hosts" }, MODE_GUARD_RULES.build), [
    "absolute-path-outside-cwd",
  ]);
});

test("home-like outside-cwd paths trigger", () => {
  assert.deepEqual(findings("bash", { command: "cat ~/.zshrc" }, ["home-path-outside-cwd"]), [
    "home-path-outside-cwd",
  ]);
  assert.deepEqual(findings("read", { path: "$HOME/.ssh/config" }, ["home-path-outside-cwd"]), [
    "home-path-outside-cwd",
  ]);
});

test("home-like paths inside cwd do not trigger", () => {
  assert.deepEqual(findings("bash", { command: "ls ~/workspace/project/src" }, ["home-path-outside-cwd"]), []);
  assert.deepEqual(findings("read", { path: "/Users/me/workspace/project/package.json" }, ["home-path-outside-cwd"]), []);
});

test("absolute outside-cwd paths trigger", () => {
  assert.deepEqual(findings("bash", { command: "cat /etc/hosts /var/log/system.log" }, ["absolute-path-outside-cwd"]), [
    "absolute-path-outside-cwd",
  ]);
  assert.deepEqual(findings("bash", { command: "ls /" }, ["absolute-path-outside-cwd"]), [
    "absolute-path-outside-cwd",
  ]);
  assert.deepEqual(findings("ls", { path: "/tmp" }, ["absolute-path-outside-cwd"]), [
    "absolute-path-outside-cwd",
  ]);
});

test("allowed external dirs suppress home-like and absolute path rules", () => {
  const allowedContext: GuardContext = {
    ...context,
    allowedExternalDirs: ["/Users/me/workspace/other-repo"],
  };

  assert.deepEqual(
    findings(
      "bash",
      { command: "cat ~/workspace/other-repo/src/file.ts /Users/me/workspace/other-repo/package.json" },
      ["home-path-outside-cwd", "absolute-path-outside-cwd"],
      allowedContext,
    ),
    [],
  );
});

test("URLs are skipped by path extraction", () => {
  assert.deepEqual(
    findings("bash", { command: "echo https://example.com/Users/me/.ssh/config https://example.com/api/v1" }, [
      "home-path-outside-cwd",
      "absolute-path-outside-cwd",
    ]),
    [],
  );
});

test("home-like absolute paths prefer home rule over absolute rule for the same path", () => {
  assert.deepEqual(
    findings("bash", { command: "cat /Users/me/.ssh/config" }, [
      "home-path-outside-cwd",
      "absolute-path-outside-cwd",
    ]),
    ["home-path-outside-cwd"],
  );
});

test("config loading combines global and project configs with expansion and relative resolution", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "mode-guard-test-"));
  try {
    const homeDir = join(tempRoot, "home");
    const cwd = join(homeDir, "workspace", "project");
    const globalConfigDir = join(homeDir, ".pi");
    await mkdir(globalConfigDir, { recursive: true });
    await mkdir(cwd, { recursive: true });

    await writeFile(
      join(globalConfigDir, "mode-guard.json"),
      JSON.stringify({ allowedExternalDirs: ["~/workspace/shared", "relative-global"] }),
    );
    await writeFile(
      join(cwd, ".pi-mode-guard.json"),
      JSON.stringify({ allowedExternalDirs: ["$HOME/src/shared", "../sibling"] }),
    );

    const config = await loadModeGuardConfig(cwd, homeDir);
    assert.deepEqual(config.warnings, []);
    assert.deepEqual(config.allowedExternalDirs.sort(), [
      resolve(globalConfigDir, "relative-global"),
      resolve(homeDir, "src/shared"),
      resolve(homeDir, "workspace/project/../sibling"),
      resolve(homeDir, "workspace/shared"),
    ].sort());
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("invalid config warns and ignores that file", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "mode-guard-test-"));
  try {
    const homeDir = join(tempRoot, "home");
    const cwd = join(homeDir, "workspace", "project");
    const globalConfigDir = join(homeDir, ".pi");
    await mkdir(globalConfigDir, { recursive: true });
    await mkdir(cwd, { recursive: true });

    await writeFile(join(globalConfigDir, "mode-guard.json"), "{not-json");
    await writeFile(join(cwd, ".pi-mode-guard.json"), JSON.stringify({ allowedExternalDirs: ["../shared"] }));

    const config = await loadModeGuardConfig(cwd, homeDir);
    assert.equal(config.warnings.length, 1);
    assert.match(config.warnings[0], /Ignoring invalid global config/);
    assert.deepEqual(config.allowedExternalDirs, [resolve(cwd, "../shared")]);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
