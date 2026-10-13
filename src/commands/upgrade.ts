import { lstat, readdir, readFile, unlink } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import type { Command, Warning } from "../lib/command.ts";
import { atomicWriteFile, ensureDirectory } from "../lib/fs-safe.ts";
import { appendLog } from "../lib/log.ts";
import { assertPlainPath, listShippedSkillFiles } from "../lib/skills.ts";

const TEMPLATE_ROOT = fileURLToPath(new URL("../../templates/brain/", import.meta.url));
const PACKAGE_JSON = fileURLToPath(new URL("../../package.json", import.meta.url));
const START = /^<!-- ultimate-brain:rules:start\b[^\n]*-->$/gm;
const END = /^<!-- ultimate-brain:rules:end -->$/gm;

type Action = "created" | "updated" | "removed" | "skipped";
interface Change { path: string; action: Action; content?: string | Buffer }

/** `brain upgrade` (spec/cli.md §5.15): bring the product-owned files of a brain up to the installed package. */
export const upgradeCommand: Command = {
  name: "upgrade",
  usage: "brain upgrade [--dry-run] [--json]",
  summary: "Update the brain's product-owned AGENTS.md block and skills to the installed version.",
  options: { "dry-run": "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const root = brain!.root;
    const warnings: Warning[] = [];
    const changes: Change[] = [];
    let unchanged = 0;

    // Every check runs before the first write, so a refusal leaves the brain untouched.
    const template = await readFile(join(TEMPLATE_ROOT, "AGENTS.md"), "utf8");
    await assertPlainPath(root, "AGENTS.md");
    const current = await readOptional(join(root, "AGENTS.md"));
    if (current === null) changes.push({ path: "AGENTS.md", action: "created", content: template });
    else {
      const block = rulesBlock(template)!;
      const own = rulesBlock(current);
      if (own === undefined) {
        changes.push({ path: "AGENTS.md", action: "skipped" });
        warnings.push({ code: "AGENTS_BLOCK_NOT_FOUND", message: "AGENTS.md has no single ultimate-brain rules block; left unchanged." });
      } else if (own === block) unchanged += 1;
      else changes.push({ path: "AGENTS.md", action: "updated", content: current.replace(own, () => block) });
    }
    if (!(await exists(join(root, "CLAUDE.md")))) changes.push({ path: "CLAUDE.md", action: "created", content: "@AGENTS.md\n" });
    else unchanged += 1;

    // Skills (decision 0029): shipped files are product-owned, inside the folders of shipped skills only.
    const shipped = await listShippedSkillFiles();
    const shippedPaths = new Set(shipped.map((file) => file.relative));
    for (const name of new Set(shipped.map((file) => file.relative.split("/")[0]!))) await assertPlainPath(root, `.agents/skills/${name}`, "folder");
    for (const file of shipped) {
      const path = `.agents/skills/${file.relative}`;
      await assertPlainPath(root, path);
      const existing = await readOptionalBuffer(join(root, path));
      if (existing === null) changes.push({ path, action: "created", content: file.content });
      else if (existing.equals(file.content)) unchanged += 1;
      else changes.push({ path, action: "updated", content: file.content });
    }
    for (const name of new Set(shipped.map((file) => file.relative.split("/")[0]!))) {
      for (const file of await listFiles(join(root, ".agents/skills", name))) {
        const inSkills = `${name}/${file}`;
        await assertPlainPath(root, `.agents/skills/${inSkills}`);
        if (!shippedPaths.has(inSkills)) changes.push({ path: `.agents/skills/${inSkills}`, action: "removed" });
      }
    }

    changes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const written = changes.filter((change) => change.action !== "skipped");
    const version = JSON.parse(await readFile(PACKAGE_JSON, "utf8")).version as string;
    const dryRun = args.options["dry-run"] === true;
    if (!dryRun && written.length > 0) {
      for (const change of written) {
        if (change.action === "removed") { await unlink(join(root, change.path)); continue; }
        await ensureDirectory(root, dirname(change.path));
        await atomicWriteFile(root, change.path, change.content!);
      }
      await appendLog(root, now, [{ op: "upgrade", id: "-", title: version, pairs: [["files", written.length]] }]);
    }
    return {
      warnings,
      data: { dry_run: dryRun, version, files: changes.map(({ path, action }) => ({ path, action })), unchanged },
      human: `${written.length} files ${dryRun ? "would change" : "changed"}, ${unchanged} unchanged\n`,
    };
  },
};

/** The text from the rules start marker through the end marker, when exactly one well-ordered pair exists. */
function rulesBlock(text: string): string | undefined {
  const starts = [...text.matchAll(START)]; const ends = [...text.matchAll(END)];
  if (starts.length !== 1 || ends.length !== 1 || ends[0]!.index! < starts[0]!.index!) return undefined;
  return text.slice(starts[0]!.index!, ends[0]!.index! + ends[0]![0].length);
}

async function listFiles(folder: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(current: string): Promise<void> {
    let entries;
    try { entries = await readdir(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else files.push(relative(folder, path).split(sep).join("/"));
    }
  }
  await visit(folder);
  return files;
}

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch { return false; }
}

async function readOptional(path: string): Promise<string | null> {
  const buffer = await readOptionalBuffer(path);
  return buffer === null ? null : buffer.toString("utf8");
}

async function readOptionalBuffer(path: string): Promise<Buffer | null> {
  try {
    if (!(await lstat(path)).isFile()) return null;
    return await readFile(path);
  } catch {
    return null;
  }
}
