import { constants } from "node:fs";
import { access, readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { BrainError } from "./errors.ts";

export interface ResolveBrainDirectoryOptions {
  brainFlag?: string;
  env?: NodeJS.ProcessEnv;
  homeDirectory?: string;
}

interface GlobalConfig {
  brain?: unknown;
}

/** Resolve and validate the brain directory using the documented precedence. */
export async function resolveBrainDirectory(
  options: ResolveBrainDirectoryOptions = {},
): Promise<string> {
  const env = options.env ?? process.env;
  const homeDirectory = options.homeDirectory ?? homedir();
  const higherPriority = firstNonEmpty(options.brainFlag, env.BRAIN_DIR);
  const configured = higherPriority === undefined ? await readConfiguredBrain(homeDirectory) : undefined;
  const candidate = higherPriority ?? configured?.brain;

  if (candidate === undefined) {
    throw new BrainError(
      "BRAIN_NOT_CONFIGURED",
      "Brain directory is not configured. Pass --brain, set BRAIN_DIR, or set brain in ~/.config/ultimate-brain/config.json.",
    );
  }

  const expanded = expandHome(candidate, homeDirectory);
  // A relative path in the config file is relative to that file's folder (spec/cli.md §4).
  const absolute = configured === undefined ? resolve(expanded) : resolve(configured.folder, expanded);

  let directory: string;
  try {
    const metadata = await stat(absolute);
    if (!metadata.isDirectory()) {
      throw new BrainError("BRAIN_NOT_FOUND", `Brain path is not a directory: ${absolute}`);
    }
    directory = await realpath(absolute);
  } catch (error) {
    if (error instanceof BrainError) throw error;
    throw new BrainError("BRAIN_NOT_FOUND", `Brain directory does not exist or cannot be read: ${absolute}`);
  }

  if (await isProductRepository(directory)) {
    throw new BrainError(
      "BRAIN_IS_PRODUCT_REPO",
      `Refusing to use the Ultimate Brain product repository as a brain: ${directory}`,
    );
  }

  return directory;
}

async function readConfiguredBrain(
  homeDirectory: string,
): Promise<{ brain: string; folder: string } | undefined> {
  const configPath = join(homeDirectory, ".config", "ultimate-brain", "config.json");
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      throw new Error("configuration must be a JSON object");
    }

    const config = parsed as GlobalConfig;
    if (config.brain === undefined) {
      return undefined;
    }
    if (typeof config.brain !== "string" || config.brain.trim() === "") {
      throw new Error('the "brain" value must be a non-empty string');
    }
    return { brain: config.brain, folder: dirname(configPath) };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new BrainError("BRAIN_CONFIG_INVALID", `Cannot read brain configuration at ${configPath}: ${detail}`);
  }
}

export async function isProductRepository(directory: string): Promise<boolean> {
  const markers = [join(directory, "spec", "cli.md"), join(directory, "src", "cli.ts")];
  const found = await Promise.all(
    markers.map(async (marker) => {
      try {
        await access(marker, constants.F_OK);
        return true;
      } catch {
        return false;
      }
    }),
  );
  return found.every(Boolean);
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value !== undefined && value.trim() !== "")?.trim();
}

function expandHome(path: string, homeDirectory: string): string {
  if (path === "~") return homeDirectory;
  if (path.startsWith("~/")) return join(homeDirectory, path.slice(2));
  return path;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
