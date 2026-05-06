import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

export interface ModeGuardConfig {
  allowedExternalDirs: string[];
}

export interface LoadedModeGuardConfig extends ModeGuardConfig {
  warnings: string[];
}

interface ConfigFileSpec {
  path: string;
  baseDir: string;
  label: string;
}

const DEFAULT_CONFIG: ModeGuardConfig = {
  allowedExternalDirs: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function expandHomeReferences(value: string, homeDir: string): string {
  let expanded = value;
  if (expanded === "~") {
    expanded = homeDir;
  } else if (expanded.startsWith("~/")) {
    expanded = join(homeDir, expanded.slice(2));
  }
  return expanded.replaceAll("${HOME}", homeDir).replaceAll("$HOME", homeDir);
}

export function resolveConfiguredDir(value: string, baseDir: string, homeDir = homedir()): string {
  const expanded = expandHomeReferences(value, homeDir);
  return isAbsolute(expanded) ? resolve(expanded) : resolve(baseDir, expanded);
}

async function readConfigFile(spec: ConfigFileSpec, homeDir: string): Promise<LoadedModeGuardConfig> {
  let content: string;
  try {
    content = await readFile(spec.path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...DEFAULT_CONFIG, warnings: [] };
    }
    return {
      ...DEFAULT_CONFIG,
      warnings: [`Could not read ${spec.label} config at ${spec.path}: ${(error as Error).message}`],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return {
      ...DEFAULT_CONFIG,
      warnings: [`Ignoring invalid ${spec.label} config at ${spec.path}: ${(error as Error).message}`],
    };
  }

  if (!isRecord(parsed)) {
    return {
      ...DEFAULT_CONFIG,
      warnings: [`Ignoring invalid ${spec.label} config at ${spec.path}: expected a JSON object.`],
    };
  }

  const allowedExternalDirs = parsed.allowedExternalDirs;
  if (allowedExternalDirs === undefined) {
    return { ...DEFAULT_CONFIG, warnings: [] };
  }
  if (!Array.isArray(allowedExternalDirs) || !allowedExternalDirs.every((value) => typeof value === "string")) {
    return {
      ...DEFAULT_CONFIG,
      warnings: [
        `Ignoring invalid ${spec.label} config at ${spec.path}: allowedExternalDirs must be an array of strings.`,
      ],
    };
  }

  return {
    allowedExternalDirs: allowedExternalDirs.map((dir) => resolveConfiguredDir(dir, spec.baseDir, homeDir)),
    warnings: [],
  };
}

export async function loadModeGuardConfig(cwd: string, homeDir = homedir()): Promise<LoadedModeGuardConfig> {
  const globalConfigPath = join(homeDir, ".pi", "mode-guard.json");
  const projectConfigPath = join(cwd, ".pi-mode-guard.json");
  const specs: ConfigFileSpec[] = [
    { path: globalConfigPath, baseDir: dirname(globalConfigPath), label: "global" },
    { path: projectConfigPath, baseDir: cwd, label: "project" },
  ];

  const configs = await Promise.all(specs.map((spec) => readConfigFile(spec, homeDir)));
  return {
    allowedExternalDirs: unique(configs.flatMap((config) => config.allowedExternalDirs)),
    warnings: configs.flatMap((config) => config.warnings),
  };
}
