import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";

import { BrainError } from "./errors.ts";
import { escapePointer, isRecord } from "./input.ts";
import { modulesOf } from "./modules.ts";
import type { Note } from "./notes.ts";
import { expandPath, type LinkedRepo } from "./repos.ts";
import { loadSchemas } from "./schemas.ts";

// The link kit of spec/linked-repos.md §2 (decision 0066): one file in a linked repo that says how the hub reads it.

export const KIT_FILE = "brain-kit.json";

export type Meaning = "todo" | "in_progress" | "waiting" | "review" | "done" | "dropped";
export const MEANINGS: readonly Meaning[] = ["todo", "in_progress", "waiting", "review", "done", "dropped"];

export type TaskSource =
  | { kind: "notion" }
  | { kind: "markdown"; path: string; format: "checklist" }
  | { kind: "markdown"; path: string; format: "pattern"; pattern: string }
  | { kind: "github"; repo: string }
  | { kind: "gitlab"; project: string };

export interface Kit {
  kit_version: 1;
  name: string;
  placement: { area: string; domain?: string; project?: string };
  knowledge: { patterns: string[]; never_read?: string[] };
  tasks?: { mode: "connected" | "tracked-in-repo"; source: TaskSource; status_map?: Record<string, Meaning> };
  methodology: { summary: string; files?: string[] };
  starter?: { name: "generic"; version: string };
}

export interface KitProblem { pointer: string; message: string }

/** `sha256:<64 hex>` of the bytes as they are (§2.1): a hand-edited kit is never re-serialised first. */
export function kitHash(bytes: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

/** The first 12 hex characters of a kit hash, for log lines. */
export const shortHash = (hash: string): string => hash.slice("sha256:".length, "sha256:".length + 12);

const ORDER: Record<string, readonly string[]> = {
  "": ["kit_version", "name", "placement", "knowledge", "tasks", "methodology", "starter"],
  "/placement": ["area", "domain", "project"],
  "/knowledge": ["patterns", "never_read"],
  "/tasks": ["mode", "source", "status_map"],
  "/tasks/source": ["kind", "path", "format", "pattern", "repo", "project"],
  "/methodology": ["summary", "files"],
  "/starter": ["name", "version"],
};

/** The kit as the hub writes it (§2.1): 2-space indent, keys in contract order, lists and `status_map` in input order, a trailing newline. */
export function serializeKit(kit: Record<string, unknown>): string {
  const order = (value: unknown, pointer: string): unknown => {
    if (!isRecord(value)) return value;
    const keys = ORDER[pointer];
    if (keys === undefined) return value; // status_map keeps its input order
    const out: Record<string, unknown> = {};
    for (const key of keys) if (value[key] !== undefined) out[key] = order(value[key], `${pointer}/${key}`);
    for (const key of Object.keys(value)) if (!(key in out) && value[key] !== undefined) out[key] = value[key];
    return out;
  };
  // JSON.stringify writes non-ASCII characters as themselves.
  return `${JSON.stringify(order(kit, ""), null, 2)}\n`;
}

// --- Path patterns (§2.1a) ---------------------------------------------------------------------------------------------

const cache = new Map<string, RegExp>();

function globRegExp(pattern: string): RegExp {
  const known = cache.get(pattern);
  if (known !== undefined) return known;
  let out = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i]!;
    if (char === "*" && pattern[i + 1] === "*") {
      const before = i === 0 || pattern[i - 1] === "/";
      const after = pattern[i + 2];
      if (before && after === "/") { out += "(?:.*/)?"; i += 2; continue; } // leading `**/` or `/**/`: zero or more folders
      if (before && after === undefined) { out += ".*"; i += 1; continue; } // trailing `/**` (or the whole pattern): everything inside
      out += "[^/]*"; i += 1; continue; // any other `**` is `*`
    }
    if (char === "*") { out += "[^/]*"; continue; }
    if (char === "?") { out += "[^/]"; continue; }
    if (char === "\\" && i + 1 < pattern.length) { out += escapeRegExp(pattern[i + 1]!); i += 1; continue; }
    if (char === "[") {
      const close = pattern.indexOf("]", i + 2);
      if (close !== -1) {
        let body = pattern.slice(i + 1, close);
        const negate = body.startsWith("!") || body.startsWith("^");
        if (negate) body = body.slice(1);
        out += `(?!/)[${negate ? "^" : ""}${body.replaceAll("\\", "\\\\").replaceAll("]", "\\]")}]`;
        i = close;
        continue;
      }
    }
    out += escapeRegExp(char);
  }
  const regexp = new RegExp(`^${out}$`, "s");
  cache.set(pattern, regexp);
  return regexp;
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * Whether a repo-relative path matches a Git glob pathspec as `git ls-files -- ':(glob)<pattern>'` does (§2.1a): the path itself
 * or, for a pattern without wildcards, a folder holding it; otherwise the whole path against the glob, case-sensitively.
 */
export function globMatch(pattern: string, path: string): boolean {
  if (path === pattern) return true;
  if (!/[*?[\\]/.test(pattern)) return path.startsWith(pattern.endsWith("/") ? pattern : `${pattern}/`);
  return globRegExp(pattern).test(path);
}

export const matchesAny = (patterns: readonly string[] | undefined, path: string): boolean => (patterns ?? []).some((pattern) => globMatch(pattern, path));

// --- Reading and checking -------------------------------------------------------------------------------------------------

export interface KitRead { bytes: Buffer; sha256: string; kit: unknown; problems: KitProblem[] }

/** Parse kit bytes: `kit` is null when they aren't JSON (problem at "" `not JSON: <reason>`, cli.md §5.29). */
export function parseKitBytes(bytes: Buffer): KitRead {
  const sha256 = kitHash(bytes);
  let text = bytes.toString("utf8");
  if (text.startsWith("﻿")) text = text.slice(1);
  try {
    return { bytes, sha256, kit: JSON.parse(text), problems: [] };
  } catch (error) {
    return { bytes, sha256, kit: null, problems: [{ pointer: "", message: `not JSON: ${error instanceof Error ? error.message : String(error)}` }] };
  }
}

/** Read `<repo>/brain-kit.json`; KIT_MISSING when there is no such file. */
export async function readKitFile(repoRoot: string): Promise<KitRead> {
  let bytes: Buffer;
  try {
    bytes = await readFile(join(repoRoot, KIT_FILE));
  } catch {
    throw new BrainError("KIT_MISSING", `${KIT_FILE} not found in ${repoRoot}`);
  }
  return parseKitBytes(bytes);
}

/** The kit file's bytes, or null when it is missing or not a file. */
export async function kitBytesIfAny(repoRoot: string): Promise<Buffer | null> {
  try {
    return await readFile(join(repoRoot, KIT_FILE));
  } catch {
    return null;
  }
}

/** Schema problems as `{pointer, message}`: one per failure, without the noise of composition keywords. */
export function schemaProblems(kit: unknown): KitProblem[] {
  const validate = loadSchemas().linkKit;
  if (validate(kit)) return [];
  const problems: KitProblem[] = [];
  const errors = validate.errors ?? [];
  // A task source that matches no branch of its oneOf reports every branch's mismatch: keep the oneOf error alone.
  const oneOfPaths = new Set(errors.filter((error) => error.keyword === "oneOf").map((error) => error.instancePath));
  for (const error of errors) {
    if (["if", "anyOf", "allOf"].includes(error.keyword)) continue;
    if (error.schemaPath.includes("/oneOf/") && oneOfPaths.has(error.instancePath)) continue;
    if (error.schemaPath.includes("/oneOf/") && [...oneOfPaths].some((path) => error.instancePath.startsWith(`${path}/`))) continue;
    let pointer = error.instancePath;
    let message = error.message ?? error.keyword;
    if (error.keyword === "additionalProperties") { pointer = `${pointer}/${escapePointer(String(error.params.additionalProperty))}`; message = "unknown key"; }
    else if (error.keyword === "required") message = `missing ${String(error.params.missingProperty)}`;
    else if (error.keyword === "oneOf") message = "is not a valid task source";
    else if (error.keyword === "not") message = "status_map is only allowed with tracked-in-repo";
    else if (error.keyword === "const" && pointer === "/kit_version") message = `kit version ${JSON.stringify((kit as Record<string, unknown>).kit_version)} needs a newer brain`;
    if (!problems.some((problem) => problem.pointer === pointer && problem.message === message)) problems.push({ pointer, message });
  }
  return problems;
}

/** The task source's pattern check (§2.2): it compiles with flag `u` and has a named group `title`. */
export function patternProblems(kit: Kit): KitProblem[] {
  const source = kit.tasks?.source;
  if (source?.kind !== "markdown" || source.format !== "pattern") return [];
  try {
    // An empty alternative always matches, and its groups list every named group of the pattern.
    const groups = new RegExp(`(?:${source.pattern})|`, "u").exec("")?.groups ?? {};
    if (!Object.hasOwn(groups, "title")) return [{ pointer: "/tasks/source/pattern", message: "has no named group title" }];
  } catch (error) {
    return [{ pointer: "/tasks/source/pattern", message: `doesn't compile: ${error instanceof Error ? error.message : String(error)}` }];
  }
  return [];
}

/** The never-read checks that need no brain (§2.2): a methodology file or the task source path that `never_read` matches. */
function neverReadProblems(kit: Kit): KitProblem[] {
  const problems: KitProblem[] = [];
  const never = kit.knowledge.never_read;
  (kit.methodology.files ?? []).forEach((file, index) => {
    if (matchesAny(never, file)) problems.push({ pointer: `/methodology/files/${index}`, message: `${file} matches never_read` });
  });
  const source = kit.tasks?.source;
  if (source?.kind === "markdown" && matchesAny(never, source.path)) problems.push({ pointer: "/tasks/source/path", message: `${source.path} matches never_read` });
  return problems;
}

export interface HubContext {
  notes: readonly Note[];
  config: Record<string, unknown>;
  repos: readonly LinkedRepo[];
  home?: string;
}

export interface KitCheckOptions {
  /** `--name`: the kit's name must equal it. */
  name?: string;
  /** The kit is read for this existing `repos` entry: its name must be the entry's. */
  entry?: LinkedRepo;
  /** The kit is written or added for this repo path: no entry with the kit's name may exist for another path. */
  forPath?: string;
}

const realOrSelf = async (path: string): Promise<string> => { try { return await realpath(path); } catch { return path; } };

/** The §2.2 checks that need the hub: ids exist, placement agrees, names agree. */
export async function hubProblems(kit: Kit, hub: HubContext, options: KitCheckOptions = {}): Promise<KitProblem[]> {
  const problems: KitProblem[] = [];
  const byId = new Map(hub.notes.map((note) => [note.id, note]));
  const area = byId.get(kit.placement.area);
  if (area === undefined || area.type !== "area") problems.push({ pointer: "/placement/area", message: `${kit.placement.area} is not an area in the brain` });
  if (kit.placement.project !== undefined) {
    const project = byId.get(kit.placement.project);
    if (project === undefined || project.type !== "project") problems.push({ pointer: "/placement/project", message: `${kit.placement.project} is not a project in the brain` });
    else if (project.attributes.area !== kit.placement.area) problems.push({ pointer: "/placement/project", message: `${kit.placement.project} belongs to ${String(project.attributes.area ?? "no area")}, not ${kit.placement.area}` });
  }
  if (kit.placement.domain !== undefined && modulesOf(hub.config).domains) {
    const domain = byId.get(kit.placement.domain);
    if (domain === undefined || domain.type !== "domain") problems.push({ pointer: "/placement/domain", message: `${kit.placement.domain} is not a domain in the brain` });
    else if (area !== undefined && area.attributes.domain === undefined) problems.push({ pointer: "/placement/domain", message: `${kit.placement.area} has no domain; a repo's Domain is its Area's (0055)` });
    else if (area !== undefined && area.attributes.domain !== kit.placement.domain) problems.push({ pointer: "/placement/domain", message: `${kit.placement.area} is in ${String(area.attributes.domain)}; a repo's Domain is its Area's (0055)` });
  }
  if (options.entry !== undefined && options.entry.name !== kit.name) problems.push({ pointer: "/name", message: `is ${kit.name}, but the repo is linked as ${options.entry.name}` });
  if (options.forPath !== undefined) {
    const real = await realOrSelf(options.forPath);
    for (const repo of hub.repos) {
      if (repo.name === kit.name && await realOrSelf(expandPath(repo.path, hub.home)) !== real) problems.push({ pointer: "/name", message: `${kit.name} is already linked for another path` });
    }
  }
  return problems;
}

/** Every problem of a parsed kit: schema first, then the checks beyond it; the hub checks only with a hub. */
export async function kitProblems(value: unknown, hub: HubContext | null, options: KitCheckOptions = {}): Promise<KitProblem[]> {
  const schema = schemaProblems(value);
  const problems = [...schema];
  if (options.name !== undefined && isRecord(value) && value.name !== options.name) problems.push({ pointer: "/name", message: `is ${JSON.stringify(value.name)}, not ${options.name}` });
  if (schema.length > 0) return problems;
  const kit = value as Kit;
  problems.push(...patternProblems(kit), ...neverReadProblems(kit));
  if (hub !== null) problems.push(...await hubProblems(kit, hub, options));
  return problems;
}

/** KIT_INVALID naming the first problem, with every problem as `details` `[{pointer, message}]` (cli.md §5.29). */
export function kitInvalid(problems: readonly KitProblem[]): BrainError {
  const [first] = problems;
  return new BrainError("KIT_INVALID", `brain-kit.json is invalid: ${first!.pointer || "/"} ${first!.message}`, problems.map(({ pointer, message }) => ({ pointer, message })));
}

/** A valid kit from bytes, or KIT_INVALID. */
export async function validKit(read: KitRead, hub: HubContext | null, options: KitCheckOptions = {}): Promise<Kit> {
  const problems = [...read.problems, ...(read.kit === null ? [] : await kitProblems(read.kit, hub, options))];
  if (problems.length > 0) throw kitInvalid(problems);
  return read.kit as Kit;
}

/** OUTSIDE_ROOT when `<repo>/brain-kit.json` is a symbolic link or a folder (§3). */
export async function assertKitTarget(repoRoot: string): Promise<void> {
  try {
    const stats = await lstat(join(repoRoot, KIT_FILE));
    if (stats.isSymbolicLink() || !stats.isFile()) throw new BrainError("OUTSIDE_ROOT", `${KIT_FILE} in ${repoRoot} is ${stats.isSymbolicLink() ? "a symbolic link" : "not a file"}; refusing to write it`);
  } catch (error) {
    if (error instanceof BrainError) throw error;
  }
}
