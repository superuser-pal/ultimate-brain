import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { posix } from "node:path";

import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { lintBrain } from "../lib/lint.ts";
import { scanNotes } from "../lib/notes.ts";

/** `brain lint [<path>…] [--strict]` (spec/cli.md §5.10). */
export const lintCommand: Command = {
  name: "lint",
  usage: "brain lint [<path>…] [--strict] [--json]",
  summary: "Validate notes, links and brain.json against the schema. Exits 1 on errors (or warnings with --strict).",
  options: { strict: "boolean" },
  needsBrain: true,
  async run({ args, brain }) {
    const root = brain!.root;
    const { notes, problems } = await scanNotes(root);
    let indexMarkdown: string | null;
    try {
      indexMarkdown = await readFile(join(root, "index.md"), "utf8");
    } catch {
      indexMarkdown = null;
    }

    const all = lintBrain({ root, notes, problems, brainConfig: brain!.config, indexMarkdown });
    // Path filters: note files, brain-relative folders (prefix match), brain.json, index.md. brain.json is always checked.
    const known = new Set([...notes.map((note) => note.path), ...problems.map((problem) => problem.path), "brain.json", "index.md"]);
    const filters = args.positionals.map((path) => posix.normalize(path).replace(/^\.\//, "").replace(/\/$/, ""));
    for (const filter of filters) {
      if (!known.has(filter) && ![...known].some((path) => path.startsWith(`${filter}/`))) {
        throw new BrainError("USAGE", `No note file or folder "${filter}" in the brain`);
      }
    }
    const matches = (path: string) => path === "brain.json" || filters.some((filter) => path === filter || path.startsWith(`${filter}/`));
    const issues = filters.length === 0 ? all : all.filter((issue) => matches(issue.path));
    const errors = issues.filter((issue) => issue.severity === "error").length;
    const warnings = issues.filter((issue) => issue.severity === "warning").length;
    const failed = errors > 0 || (args.options.strict === true && warnings > 0);

    const human = issues.length === 0
      ? "No issues.\n"
      : `${issues.map((issue) => `${issue.path}:${issue.line} ${issue.severity} ${issue.rule}: ${issue.message}`).join("\n")}\n${errors} errors, ${warnings} warnings\n`;

    return {
      data: { errors, warnings, files: notes.length + problems.length, issues },
      exitCode: failed ? 1 : 0,
      human,
    };
  },
};
