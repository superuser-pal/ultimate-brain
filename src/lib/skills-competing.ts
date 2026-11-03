import { lstatSync, readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";

import { parseFrontmatter } from "./frontmatter.ts";
import { byteOrder, TREES } from "./skills-snapshot.ts";

/** A second definition of an operational skill that an agent also loads (spec/skills-delivery.md §5.2). */
export interface Competing { kind: "duplicate" | "global" | "plugin"; name: string; path: string }

const GLOBAL_FOLDERS = [".claude/skills", ".agents/skills", ".codex/skills"];
const PLUGIN = "ultimate-brain@ultimate-brain";

export interface CompetingOptions {
  /** The repo whose two trees are scanned for duplicates: the brain, or for `link` the linked repo. */
  treeRoot: string;
  names: readonly string[];
  /** `HOME`; undefined or empty skips the global checks and the home plugin check. */
  home: string | undefined;
  /** The brain, whose `.claude/settings.json` is checked for the retired plugin. */
  brainRoot: string;
  /** The brain's settings file as a planned write leaves it (undefined reads disk; null: removed). */
  brainSettings?: string | null;
}

/** §5.2: duplicates, global copies and the retired plugin, sorted by path, kind, name (§5.3). Never changes anything. */
export function competingCopies(options: CompetingOptions): Competing[] {
  const names = new Set(options.names);
  const out: Competing[] = [];
  if (names.size > 0) {
    for (const tree of TREES) {
      let entries: Dirent[];
      try { entries = readdirSync(join(options.treeRoot, tree), { withFileTypes: true }); } catch { entries = []; }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const name = frontmatterName(join(options.treeRoot, tree, entry.name, "SKILL.md"));
        if (name !== undefined && names.has(name) && name !== entry.name) out.push({ kind: "duplicate", name, path: `${tree}/${entry.name}` });
      }
    }
  }
  const home = options.home === undefined || options.home === "" ? undefined : options.home;
  if (home !== undefined) {
    for (const name of names) {
      for (const folder of GLOBAL_FOLDERS) {
        try { lstatSync(join(home, folder, name)); } catch { continue; }
        out.push({ kind: "global", name, path: `~/${folder}/${name}` });
      }
    }
    if (pluginEnabled(readOptional(join(home, ".claude", "settings.json")))) out.push({ kind: "plugin", name: "ultimate-brain", path: "~/.claude/settings.json" });
  }
  const brainSettings = options.brainSettings === undefined ? readOptional(join(options.brainRoot, ".claude", "settings.json")) : options.brainSettings;
  if (pluginEnabled(brainSettings)) out.push({ kind: "plugin", name: "ultimate-brain", path: ".claude/settings.json" });
  return out.sort((a, b) => byteOrder(a.path, b.path) || byteOrder(a.kind, b.kind) || byteOrder(a.name, b.name));
}

function frontmatterName(path: string): string | undefined {
  try {
    const name = parseFrontmatter(readFileSync(path, "utf8")).attributes.name;
    return typeof name === "string" ? name : undefined;
  } catch {
    return undefined;
  }
}

function readOptional(path: string): string | null {
  try { return lstatSync(path).isFile() ? readFileSync(path, "utf8") : null; } catch { return null; }
}

function pluginEnabled(text: string | null): boolean {
  if (text === null) return false;
  try {
    const value = JSON.parse(text) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const plugins = (value as Record<string, unknown>).enabledPlugins;
    return typeof plugins === "object" && plugins !== null && !Array.isArray(plugins) && (plugins as Record<string, unknown>)[PLUGIN] === true;
  } catch {
    return false;
  }
}

/** The lint message for a competing copy (§6.4). */
export function competingMessage(copy: Competing): string {
  if (copy.kind === "plugin") return `the retired ultimate-brain plugin is enabled in ${copy.path}; disable it`;
  if (copy.kind === "global") return `${copy.path} competes with the pinned skill ${copy.name}; remove it`;
  return `${copy.path} also defines skill ${copy.name}; remove it, the pinned copy is ${copy.path.slice(0, copy.path.lastIndexOf("/"))}/${copy.name}`;
}
