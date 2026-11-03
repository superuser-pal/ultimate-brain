import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { BrainError } from "./errors.ts";
import { loadSchemas } from "./schemas.ts";
import { competingCopies, type Competing } from "./skills-competing.ts";
import { isNewerThanRange, satisfies } from "./skills-range.ts";
import {
  byteOrder, canonicalManifest, firstSchemaError, manifestOrderAndIntegrity, packageSnapshot, sha256, TREES, unlistedEntries,
  type Manifest, type PackageSnapshot,
} from "./skills-snapshot.ts";

/** A brain's pin, `skills.lock.json` (spec/skills-delivery.md §3, decision 0059). */
export interface Lock { format: 1; installed_by: string; snapshot: Manifest }
export type PinState = "unpinned" | "invalid" | "incompatible" | "missing" | "drift" | "pinned";
export const LOCK = "skills.lock.json";

export type LockRead = { kind: "absent" } | { kind: "invalid"; reason: string } | { kind: "valid"; lock: Lock };

/** §3 rows 1 and 2. */
export function readLock(root: string): LockRead {
  const path = join(root, LOCK);
  let metadata;
  try { metadata = lstatSync(path); } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "ENOENT" || code === "ENOTDIR" ? { kind: "absent" } : { kind: "invalid", reason: "unreadable" };
  }
  if (!metadata.isFile()) return { kind: "invalid", reason: "not a file" };
  let text: string;
  try { text = readFileSync(path, "utf8"); } catch { return { kind: "invalid", reason: "unreadable" }; }
  return parseLock(text);
}

export function parseLock(text: string): LockRead {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return { kind: "invalid", reason: "not JSON" }; }
  const validate = loadSchemas().skillsLock;
  if (!validate(value)) return { kind: "invalid", reason: `schema: ${firstSchemaError(validate.errors)}` };
  const lock = value as Lock;
  const reason = manifestOrderAndIntegrity(lock.snapshot);
  return reason === null ? { kind: "valid", lock } : { kind: "invalid", reason };
}

/** §3: 2-space JSON, keys in order, trailing newline, nothing time-dependent. */
export function serializeLock(installedBy: string, manifest: Manifest): string {
  return `${JSON.stringify({ format: 1, installed_by: installedBy, snapshot: canonicalManifest(manifest) }, null, 2)}\n`;
}

export interface Pin {
  state: PinState;
  lock: Lock | null;
  /** The invalid reason, or `{tree}/{skill}` for `missing`. */
  reason: string | null;
  missing: { skill: string; tree: string } | null;
}

function kind(path: string): "file" | "folder" | "other" | "absent" {
  try {
    const metadata = lstatSync(path);
    return metadata.isFile() ? "file" : metadata.isDirectory() ? "folder" : "other";
  } catch {
    return "absent";
  }
}

/** §3's state. Rows 1 to 4 never hash a file; row 5 (`drift`) runs only with `drift: true`. */
export function pinState(root: string, running: () => string, options: { drift: boolean }): Pin {
  const read = readLock(root);
  if (read.kind === "absent") return { state: "unpinned", lock: null, reason: null, missing: null };
  if (read.kind === "invalid") return { state: "invalid", lock: null, reason: read.reason, missing: null };
  const lock = read.lock;
  if (!satisfies(running(), lock.snapshot.cli)) return { state: "incompatible", lock, reason: null, missing: null };
  for (const skill of lock.snapshot.skills) {
    for (const tree of TREES) {
      if (kind(join(root, tree, skill.name, "SKILL.md")) !== "file") return { state: "missing", lock, reason: `${tree}/${skill.name}`, missing: { skill: skill.name, tree } };
    }
  }
  if (options.drift && skillDrift(root, lock.snapshot).length > 0) return { state: "drift", lock, reason: null, missing: null };
  return { state: "pinned", lock, reason: null, missing: null };
}

/**
 * Brain-relative paths where the two trees differ from `manifest` (lint's `product-file` for skills, `status` `data.skills.drift`): a pinned
 * skill folder missing from a tree, a listed file missing or with other bytes, an entry in a pinned skill's folder the manifest doesn't list.
 * `planned` overlays files a write is about to change (null: removed).
 */
export function skillDrift(root: string, manifest: Manifest, planned?: ReadonlyMap<string, string | Buffer | null>): string[] {
  const out: string[] = [];
  for (const tree of TREES) {
    for (const skill of manifest.skills) {
      const folder = `${tree}/${skill.name}`;
      const plannedHere = planned !== undefined && [...planned.entries()].some(([path, value]) => value !== null && path.startsWith(`${folder}/`));
      if (!plannedHere && kind(join(root, folder)) !== "folder") { out.push(folder); continue; }
      for (const file of skill.files) {
        const path = `${folder}/${file.path}`;
        let bytes: Buffer | null;
        if (planned?.has(path)) { const value = planned.get(path)!; bytes = value === null ? null : Buffer.from(value); }
        else bytes = kind(join(root, path)) === "file" ? readFileSync(join(root, path)) : null;
        if (bytes === null || bytes.length !== file.bytes || sha256(bytes) !== file.sha256) out.push(path);
      }
      const absent = (relative: string) => planned?.get(`${folder}/${relative}`) === null;
      for (const entry of unlistedEntries(join(root, folder), skill.files.map((file) => file.path), absent)) out.push(`${folder}/${entry}`);
    }
  }
  return out.sort(byteOrder);
}

/** Commands that always run, so the user can see and repair the pin (cli.md §5.28). */
export const PIN_EXEMPT = new Set(["status", "lint", "upgrade", "recover"]);

const npm = (version: string) => `npm install -g ultimate-brain@${version}`;

/** The SKILLS_INCOMPATIBLE message (cli.md §5.28); a version both newer and older gets the newer one. */
export function incompatibleMessage(lock: Lock, running: string): string {
  const { name, version, cli } = lock.snapshot;
  const head = `This brain's skills (${name} ${version}) need ultimate-brain ${cli}; this CLI is ${running}.`;
  return isNewerThanRange(running, cli)
    ? `${head} Run brain upgrade to install the skills this CLI ships, or keep these skills with ${npm(lock.installed_by)}.`
    : `${head} Install the version that pinned them: ${npm(lock.installed_by)}.`;
}

function details(pin: Pin, running: string): Record<string, string> {
  const out: Record<string, string> = { state: pin.state };
  if (pin.lock !== null) Object.assign(out, { name: pin.lock.snapshot.name, version: pin.lock.snapshot.version, cli: pin.lock.snapshot.cli });
  out.running = running;
  if (pin.lock !== null) out.installed_by = pin.lock.installed_by;
  if (pin.reason !== null) out.reason = pin.reason;
  if (pin.missing !== null) Object.assign(out, { skill: pin.missing.skill, path: `${pin.missing.tree}/${pin.missing.skill}/SKILL.md` });
  return out;
}

/** The pin guard (cli.md §5.28): refuse a guarded command for `invalid`, `incompatible` and `missing`, before it reads input or writes. */
export function guardPin(root: string, runningVersion: () => string): void {
  let running: string | undefined;
  const version = () => (running ??= runningVersion());
  const pin = pinState(root, version, { drift: false });
  if (pin.state === "invalid") {
    throw new BrainError("SKILLS_PIN_INVALID", `${LOCK} is invalid (${pin.reason}). Run brain upgrade to rewrite it.`, details(pin, version()));
  }
  if (pin.state === "incompatible") throw new BrainError("SKILLS_INCOMPATIBLE", incompatibleMessage(pin.lock!, version()), details(pin, version()));
  if (pin.state === "missing") {
    const { name, version: pinned } = pin.lock!.snapshot;
    throw new BrainError("SKILLS_SNAPSHOT_MISSING", `Pinned skill ${pin.missing!.skill} is missing from ${pin.missing!.tree} (${name} ${pinned}). Run brain upgrade to restore it.`, details(pin, version()));
  }
}

/** The SKILLS_SNAPSHOT_INVALID error for the package snapshot (cli.md §5.28). */
export function snapshotInvalid(reason: string, running: string): BrainError {
  return new BrainError("SKILLS_SNAPSHOT_INVALID", `The skills shipped with ultimate-brain ${running} are unusable (${reason}). Reinstall: ${npm(running)}.`, { reason, running });
}

/** Names whose competing copies `status` and `lint` check (§5.2). */
export function checkedNames(pin: Pin, pkg: PackageSnapshot): string[] {
  if (pin.lock !== null) return pin.lock.snapshot.skills.map((skill) => skill.name);
  return pkg.reason === null ? pkg.manifest!.skills.map((skill) => skill.name) : [];
}

export interface StatusSkills {
  state: PinState;
  name: string | null; version: string | null; cli: string | null; integrity: string | null; installed_by: string | null;
  running: string;
  reason: string | null;
  package: { name: string | null; version: string | null; compatible: boolean; reason: string | null };
  drift: string[];
  competing: Competing[];
}

/** `brain status` `data.skills` (cli.md §5.28). */
export function statusSkills(root: string, product: { root: string; version: string }, home: string | undefined): StatusSkills {
  const pkg = packageSnapshot(product.root, product.version);
  const pin = pinState(root, () => product.version, { drift: true });
  let drift: string[] = [];
  if (pin.lock !== null) drift = skillDrift(root, pin.lock.snapshot);
  else if (pin.state === "unpinned" && pkg.reason === null) drift = skillDrift(root, pkg.manifest!);
  const snapshot = pin.lock?.snapshot;
  return {
    state: pin.state,
    name: snapshot?.name ?? null,
    version: snapshot?.version ?? null,
    cli: snapshot?.cli ?? null,
    integrity: snapshot?.integrity ?? null,
    installed_by: pin.lock?.installed_by ?? null,
    running: product.version,
    reason: pin.reason,
    package: { name: pkg.manifest?.name ?? null, version: pkg.manifest?.version ?? null, compatible: pkg.compatible, reason: pkg.reason },
    drift,
    competing: competingCopies({ treeRoot: root, names: checkedNames(pin, pkg), home, brainRoot: root }),
  };
}

/** `HOME` as the CLI sees it (§5.2): the command's environment, else the process's. */
export function homeOf(env: NodeJS.ProcessEnv | undefined): string | undefined {
  const home = (env ?? process.env).HOME;
  return home === undefined || home === "" ? undefined : home;
}
