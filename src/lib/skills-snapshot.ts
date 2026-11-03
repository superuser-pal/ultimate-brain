import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { loadSchemas } from "./schemas.ts";
import { satisfies } from "./skills-range.ts";

/** A skill snapshot's manifest, `snapshot.json` (spec/skills-delivery.md §2, decision 0059). */
export interface SnapshotFile { path: string; sha256: string; bytes: number }
export interface SnapshotSkill { name: string; targets: string[]; files: SnapshotFile[] }
export interface Manifest {
  format: 1;
  name: "ultimate-brain-skills" | "ultimate-brain";
  version: string;
  cli: string;
  source: { repository: string; commit?: string };
  upstream: { repository: string; commit: string } | null;
  integrity: string;
  skills: SnapshotSkill[];
}

/** Files a reader ignores at the top of a snapshot (§2). */
export const OPTIONAL_FILES = new Set(["README.md", "LICENSE", "NOTICE.md"]);
export const TREES = [".agents/skills", ".claude/skills"] as const;

export const sha256 = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
export const byteOrder = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));

/** §2.2: the hash of the sorted `<sha256>  <skill>/<path>` lines. */
export function computeIntegrity(skills: readonly SnapshotSkill[]): string {
  const lines = skills
    .flatMap((skill) => skill.files.map((file) => ({ key: `${skill.name}/${file.path}`, line: `${file.sha256}  ${skill.name}/${file.path}\n` })))
    .sort((a, b) => byteOrder(a.key, b.key))
    .map((entry) => entry.line);
  return `sha256-${sha256(Buffer.from(lines.join(""), "utf8"))}`;
}

/** The first schema error as `<pointer> <message>` (cli.md INPUT_INVALID uses pointer and message). */
export function firstSchemaError(errors: ReadonlyArray<{ keyword: string; instancePath: string; message?: string }> | null | undefined): string {
  const error = (errors ?? []).find((entry) => !["if", "anyOf", "allOf", "oneOf"].includes(entry.keyword)) ?? errors?.[0];
  return error === undefined ? "invalid" : `${error.instancePath === "" ? "/" : error.instancePath} ${error.message ?? error.keyword}`;
}

/** §2.3 rule 3 on a schema-valid manifest. */
function sorted(values: readonly string[]): boolean {
  for (let index = 1; index < values.length; index += 1) if (byteOrder(values[index - 1]!, values[index]!) >= 0) return false;
  return true;
}

/** Manifest checks 3 and 4 (§2.3) on a manifest that passes its schema; the reason id, or null. */
export function manifestOrderAndIntegrity(manifest: Manifest): "manifest-order" | "integrity" | null {
  if (!sorted(manifest.skills.map((skill) => skill.name))) return "manifest-order";
  for (const skill of manifest.skills) if (!sorted(skill.targets) || !sorted(skill.files.map((file) => file.path))) return "manifest-order";
  return manifest.integrity === computeIntegrity(manifest.skills) ? null : "integrity";
}

export interface SnapshotCheck {
  /** The manifest when it passes its schema (rules 1–2), whatever the later rules say. */
  manifest: Manifest | null;
  /** `<id>` or `<id>: <path>` (§2.3), or null when the folder is a valid snapshot. */
  reason: string | null;
}

type Kind = "file" | "folder" | "other" | "absent";
function kindOf(path: string): Kind {
  try {
    const metadata = lstatSync(path);
    return metadata.isFile() ? "file" : metadata.isDirectory() ? "folder" : "other";
  } catch {
    return "absent";
  }
}

/** §2.3: validate the snapshot folder at `folder`, rules in order, stopping at the first failure. */
export function validateSnapshot(folder: string): SnapshotCheck {
  const manifestPath = join(folder, "snapshot.json");
  if (kindOf(manifestPath) !== "file") return { manifest: null, reason: "manifest-missing" };
  let text: string;
  try { text = readFileSync(manifestPath, "utf8"); } catch { return { manifest: null, reason: "manifest-missing" }; }
  let value: unknown;
  try { value = JSON.parse(text); } catch { return { manifest: null, reason: "manifest-unparseable" }; }
  if (!loadSchemas().skillsSnapshot(value)) return { manifest: null, reason: "manifest-schema" };
  const manifest = value as Manifest;
  const early = manifestOrderAndIntegrity(manifest);
  if (early !== null) return { manifest, reason: early };

  for (const skill of manifest.skills) {
    const skillFolder = kindOf(join(folder, skill.name));
    for (const file of skill.files) {
      const path = `${skill.name}/${file.path}`;
      if (skillFolder === "absent") return { manifest, reason: `file-missing: ${path}` };
      if (skillFolder !== "folder") return { manifest, reason: `not-a-file: ${path}` };
      const kind = kindOf(join(folder, path));
      if (kind === "absent") return { manifest, reason: `file-missing: ${path}` };
      if (kind !== "file") return { manifest, reason: `not-a-file: ${path}` };
      const bytes = readFileSync(join(folder, path));
      if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) return { manifest, reason: `file-mismatch: ${path}` };
    }
  }

  const unlisted: string[] = [];
  const skills = new Map(manifest.skills.map((skill) => [skill.name, skill]));
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.name === "snapshot.json") continue;
    if (OPTIONAL_FILES.has(entry.name) && entry.isFile()) continue;
    const skill = skills.get(entry.name);
    if (skill !== undefined && entry.isDirectory()) unlisted.push(...unlistedEntries(join(folder, entry.name), skill.files.map((file) => file.path)).map((path) => `${entry.name}/${path}`));
    else unlisted.push(entry.name);
  }
  if (unlisted.length > 0) return { manifest, reason: `unlisted-entry: ${unlisted.sort(byteOrder)[0]}` };
  return { manifest, reason: null };
}

/**
 * Entries under `folder` that are neither a listed file (a regular file) nor a folder on a listed file's path; an unlisted folder is one
 * entry. Paths relative to `folder`. `absent(path)` lets a caller hide entries a planned write removes.
 */
export function unlistedEntries(folder: string, listed: readonly string[], absent: (path: string) => boolean = () => false): string[] {
  const files = new Set(listed);
  const folders = new Set(listed.flatMap((path) => path.split("/").slice(0, -1).map((_, index, parts) => parts.slice(0, index + 1).join("/"))));
  const out: string[] = [];
  const visit = (relative: string): void => {
    let entries;
    try { entries = readdirSync(join(folder, relative), { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const path = relative === "" ? entry.name : `${relative}/${entry.name}`;
      if (entry.isFile() && files.has(path)) continue;
      if (entry.isDirectory() && folders.has(path)) { visit(path); continue; }
      if (absent(path)) continue;
      if (entry.isDirectory() && allAbsent(join(folder, path), path, absent)) continue;
      out.push(path);
    }
  };
  visit("");
  return out;
}

/** A folder every file of which a planned write removes (so the write prunes it too). Not for the empty case without a plan. */
function allAbsent(full: string, relative: string, absent: (path: string) => boolean): boolean {
  let entries;
  try { entries = readdirSync(full, { withFileTypes: true }); } catch { return false; }
  let any = false;
  for (const entry of entries) {
    const path = `${relative}/${entry.name}`;
    if (entry.isDirectory()) { if (!allAbsent(join(full, entry.name), path, absent)) return false; any = true; continue; }
    if (!absent(path)) return false;
    any = true;
  }
  return any;
}

/** Key order of §2, so the manifest serialises the same way however it was read. */
export function canonicalManifest(manifest: Manifest): Manifest {
  return {
    format: manifest.format,
    name: manifest.name,
    version: manifest.version,
    cli: manifest.cli,
    source: manifest.source.commit === undefined ? { repository: manifest.source.repository } : { repository: manifest.source.repository, commit: manifest.source.commit },
    upstream: manifest.upstream === null ? null : { repository: manifest.upstream.repository, commit: manifest.upstream.commit },
    integrity: manifest.integrity,
    skills: manifest.skills.map((skill) => ({
      name: skill.name,
      targets: [...skill.targets],
      files: skill.files.map((file) => ({ path: file.path, sha256: file.sha256, bytes: file.bytes })),
    })),
  };
}

export const serializeManifest = (manifest: Manifest): string => `${JSON.stringify(canonicalManifest(manifest), null, 2)}\n`;

export interface ManifestMeta {
  name: Manifest["name"];
  version: string;
  cli: string;
  source: Manifest["source"];
  upstream: Manifest["upstream"];
  /** Targets of each skill; `["brain"]` when absent. */
  targets?: (name: string) => string[];
}

/** The generator: a manifest for every skill folder under `folder` (entries starting with `.` are skipped), as §2 and §9 describe. */
export function buildManifest(folder: string, meta: ManifestMeta): Manifest {
  const skills: SnapshotSkill[] = [];
  const names = readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort(byteOrder);
  for (const name of names) {
    const files: SnapshotFile[] = [];
    const visit = (relative: string): void => {
      for (const entry of readdirSync(join(folder, name, relative), { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        const path = relative === "" ? entry.name : `${relative}/${entry.name}`;
        if (entry.isSymbolicLink()) throw new Error(`symbolic link in a snapshot: ${name}/${path}`);
        if (entry.isDirectory()) visit(path);
        else if (entry.isFile()) {
          const bytes = readFileSync(join(folder, name, path));
          files.push({ path, sha256: sha256(bytes), bytes: bytes.length });
        }
      }
    };
    visit("");
    files.sort((a, b) => byteOrder(a.path, b.path));
    skills.push({ name, targets: [...new Set(meta.targets?.(name) ?? ["brain"])].sort(byteOrder), files });
  }
  return canonicalManifest({ format: 1, name: meta.name, version: meta.version, cli: meta.cli, source: meta.source, upstream: meta.upstream, integrity: computeIntegrity(skills), skills });
}

/** §9's phase A range for a package version: `>=<version> <<major>.<minor + 1>.0`. */
export function phaseARange(version: string): string {
  const [major, minor] = version.split(".");
  return `>=${version} <${major}.${Number(minor) + 1}.0`;
}

export interface PackageSnapshot {
  /** The package snapshot folder, `<package root>/.agents/skills`. */
  folder: string;
  manifest: Manifest | null;
  reason: string | null;
  /** Valid and the running CLI satisfies its range (§2.3). */
  compatible: boolean;
  running: string;
}

/** The snapshot shipped at `<root>/.agents/skills/`, checked against `running` (§1, §2.3). */
export function packageSnapshot(root: string, running: string): PackageSnapshot {
  const folder = join(root, ".agents", "skills");
  const check = validateSnapshot(folder);
  const compatible = check.reason === null && satisfies(running, check.manifest!.cli);
  return { folder, manifest: check.manifest, reason: check.reason, compatible, running };
}

/** `{reason}` of SKILLS_SNAPSHOT_INVALID (cli.md §5.28): the §2.3 reason, or the range the running CLI misses. */
export function packageProblem(snapshot: PackageSnapshot): string | null {
  if (snapshot.reason !== null) return snapshot.reason;
  return snapshot.compatible ? null : `not compatible with ${snapshot.running} (${snapshot.manifest!.cli})`;
}
