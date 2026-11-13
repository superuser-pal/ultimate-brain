import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Command, Warning } from "../lib/command.ts";
import { atomicWriteFile } from "../lib/fs-safe.ts";
import { buildIndex } from "../lib/index-builder.ts";
import { scanNotes } from "../lib/notes.ts";
import { planStructure, structureStale } from "../lib/structure.ts";
import { indexNotes, requireSuppressions } from "../lib/suppressions.ts";

/** `brain index [--check]` (spec/cli.md §5.8, spec/schema.md §13). */
export const indexCommand: Command = {
  name: "index",
  usage: "brain index [--check] [--json]",
  summary: "Regenerate index.md and the structure block of AGENTS.md from note frontmatter. --check writes nothing and exits 1 if either is out of date.",
  options: { check: "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain }) {
    const root = brain!.root;
    const check = args.options.check === true;
    const { notes, problems } = await scanNotes(root);
    // A view the derived-content rule withholds keeps no title in the JSON index (§5.8); index.md lists no views.
    const published = indexNotes(notes, requireSuppressions(root), { exists: (path) => existsSync(join(root, path)) });
    const built = buildIndex(published);
    // The structure block of AGENTS.md (cli §5.8.1, decision 0089), from the same published notes.
    const structure = await planStructure(root, published, brain!.config);

    const warnings: Warning[] = [
      ...problems.map((problem) => ({ code: problem.code, message: `${problem.path}: ${problem.message}`, path: problem.path })),
      ...built.duplicates.map((duplicate) => ({
        code: "DUPLICATE_ID",
        message: `${duplicate.id} in ${duplicate.path} is also in ${duplicate.kept}; kept ${duplicate.kept}`,
        path: duplicate.path,
        id: duplicate.id,
      })),
    ];

    let current: string | null;
    try {
      current = await readFile(join(root, "index.md"), "utf8");
    } catch {
      current = null;
    }
    const differs = current !== built.markdown;
    const written = !check && differs;
    if (written) await atomicWriteFile(root, "index.md", built.markdown);
    const structureDiffers = structureStale(structure);
    if (!check && structureDiffers) await atomicWriteFile(root, "AGENTS.md", structure.after!);
    if (structure.warn) {
      warnings.push({ code: "AGENTS_BLOCK_NOT_FOUND", message: "AGENTS.md is missing, a symbolic link, or its rules, style or structure markers are missing, out of order or duplicated; the structure block was not written. Run brain upgrade to restore it." });
    }
    // `stale`: index.md or the structure block is out of date after this command (only possible with --check).
    const stale = check && (differs || structureDiffers);

    const human = (check
      ? differs ? "index.md is out of date (run brain index)\n" : "index.md is current\n"
      : written ? `index.md updated (${built.entries.length} notes)\n` : "index.md already current\n")
      + (check
        ? structureDiffers ? "AGENTS.md structure block is out of date (run brain index)\n" : ""
        : structureDiffers ? `AGENTS.md structure block ${structure.action}\n` : "");

    return {
      data: {
        written,
        stale,
        path: "index.md",
        structure: { path: "AGENTS.md", action: structure.action },
        counts: built.counts,
        notes: built.entries,
        backlinks: built.backlinks,
      },
      warnings,
      exitCode: check && stale ? 1 : 0,
      human,
    };
  },
};
