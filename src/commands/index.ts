import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Command, Warning } from "../lib/command.ts";
import { atomicWriteFile } from "../lib/fs-safe.ts";
import { buildIndex } from "../lib/index-builder.ts";
import { scanNotes } from "../lib/notes.ts";

/** `brain index [--check]` (spec/cli.md §5.8, spec/schema.md §13). */
export const indexCommand: Command = {
  name: "index",
  usage: "brain index [--check] [--json]",
  summary: "Regenerate index.md from note frontmatter. --check writes nothing and exits 1 if index.md is out of date.",
  options: { check: "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain }) {
    const root = brain!.root;
    const check = args.options.check === true;
    const { notes, problems } = await scanNotes(root);
    const built = buildIndex(notes);

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
    // `stale`: index.md is out of date after this command (only possible with --check).
    const stale = check && differs;

    const human = check
      ? differs ? "index.md is out of date (run brain index)\n" : "index.md is current\n"
      : written ? `index.md updated (${built.entries.length} notes)\n` : "index.md already current\n";

    return {
      data: {
        written,
        stale,
        path: "index.md",
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
