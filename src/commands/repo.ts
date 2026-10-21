import { realpath } from "node:fs/promises";

import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { atomicWriteFile } from "../lib/fs-safe.ts";
import { appendLog } from "../lib/log.ts";
import { assertAncestor, expandPath, findRepo, headCommit, isDirty, linkedRepos, openRepo, repoChanges, resolveCommit, type LinkedRepo } from "../lib/repos.ts";
import { describeErrors, loadSchemas } from "../lib/schemas.ts";
import { scanNotes } from "../lib/notes.ts";
import type { Brain } from "../lib/brain.ts";

/** Write brain.json with `repos` replaced, after checking the whole file against its schema. */
async function writeRepos(brain: Brain, repos: LinkedRepo[]): Promise<void> {
  const next: Record<string, unknown> = { ...structuredClone(brain.config), repos };
  const schemas = loadSchemas();
  if (!schemas.brain(next)) throw new BrainError("INPUT_INVALID", `brain.json would be invalid: ${describeErrors(schemas.brain.errors).join("; ")}`);
  await atomicWriteFile(brain.root, "brain.json", `${JSON.stringify(next, null, 2)}\n`);
}

/** `brain repo add <name> --path <path> --area <area-id> --pattern <glob>…` (spec/cli.md §5.16, 0042). */
export const repoAddCommand: Command = {
  name: "repo add",
  usage: "brain repo add <name> --path <path> --area <area-id> --pattern <glob> [--pattern <glob>]… [--json]",
  summary: "Link a Git repo as a read-only source for an area: its files matching the patterns are ingested as they change.",
  options: { path: "string", area: "string", pattern: "list" },
  maxPositionals: 1,
  needsBrain: true,
  async run({ args, brain, now, environment }) {
    const [name] = args.positionals;
    const path = args.options.path as string | undefined;
    const area = args.options.area as string | undefined;
    const patterns = (args.options.pattern as string[] | undefined) ?? [];
    if (name === undefined || path === undefined || area === undefined || patterns.length === 0) {
      throw new BrainError("USAGE", "brain repo add needs <name>, --path, --area and at least one --pattern");
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) throw new BrainError("INPUT_INVALID", `${name}: a repo name is lowercase kebab-case`);
    const repos = linkedRepos(brain!.config);
    if (repos.some((repo) => repo.name === name)) throw new BrainError("INPUT_INVALID", `${name} is already a linked repo`);
    const { notes } = await scanNotes(brain!.root);
    const target = notes.find((note) => note.id === area);
    if (target === undefined) throw new BrainError("UNKNOWN_ID", `No note with id ${area}`);
    if (target.type !== "area") throw new BrainError("INPUT_INVALID", `${area} is a ${target.type}, not an area`);
    if (!/^(\/|~\/)/.test(path)) throw new BrainError("INPUT_INVALID", `--path ${path} must be absolute or start with ~/`);

    const repo: LinkedRepo = { name, path, area, patterns, commit: "" };
    const top = await openRepo(repo, environment.homeDirectory);
    // Compared after resolving symbolic links, so a link to the brain is refused too.
    if (top === (await realpath(brain!.root))) throw new BrainError("REPO_IS_BRAIN", `${path} is the brain itself; link another repo`);

    await writeRepos(brain!, [...repos, repo]);
    await appendLog(brain!.root, now, [{ op: "repo-add", id: "-", title: name }]);
    return { data: repo, human: `linked ${name} (${expandPath(path, environment.homeDirectory)}) to ${area}\n` };
  },
};

/** `brain repo changes <name>` (spec/cli.md §5.16): the files to ingest since the recorded commit. */
export const repoChangesCommand: Command = {
  name: "repo changes",
  usage: "brain repo changes <name> [--json]",
  summary: "List a linked repo's files that match its patterns and changed since the recorded commit. Writes nothing.",
  options: {},
  maxPositionals: 1,
  needsBrain: true,
  async run({ args, brain, environment }) {
    const [name] = args.positionals;
    if (name === undefined) throw new BrainError("USAGE", "Name the repo: brain repo changes <name>");
    const repo = findRepo(brain!.config, name);
    const path = await openRepo(repo, environment.homeDirectory);
    const to = await headCommit(path);
    if (repo.commit !== "") {
      await resolveCommit(path, repo.commit);
      await assertAncestor(path, repo.commit, to);
    }
    const { files, deleted } = await repoChanges(path, repo.patterns, repo.commit, to);
    const warnings = (await isDirty(path)) ? [{ code: "REPO_DIRTY", message: `${name} has uncommitted changes; only committed files are listed` }] : [];
    return {
      data: { name, area: repo.area, from: repo.commit, to, files, deleted },
      warnings,
      human: `${files.length} file(s) to ingest, ${deleted.length} deleted\n${files.map((file) => `  ${file.status} ${file.path}\n`).join("")}`,
    };
  },
};

/** `brain repo record <name> (--commit <sha> | --reset)` (spec/cli.md §5.16). */
export const repoRecordCommand: Command = {
  name: "repo record",
  usage: "brain repo record <name> (--commit <sha> | --reset) [--json]",
  summary: "Record the commit a linked repo was ingested up to; --reset makes the next changes list every matching file.",
  options: { commit: "string", reset: "boolean" },
  maxPositionals: 1,
  needsBrain: true,
  async run({ args, brain, now, environment }) {
    const [name] = args.positionals;
    const given = args.options.commit as string | undefined;
    const reset = args.options.reset === true;
    if (name === undefined || (given === undefined) === !reset) throw new BrainError("USAGE", "brain repo record needs <name> and exactly one of --commit <sha> or --reset");
    const repos = linkedRepos(brain!.config);
    const repo = findRepo(brain!.config, name);
    let commit = "";
    if (given !== undefined) {
      const path = await openRepo(repo, environment.homeDirectory);
      commit = await resolveCommit(path, given);
      if (repo.commit !== "") await assertAncestor(path, repo.commit, commit);
    }
    await writeRepos(brain!, repos.map((entry) => (entry.name === name ? { ...entry, commit } : entry)));
    await appendLog(brain!.root, now, [{ op: "repo-record", id: "-", title: name, pairs: [["commit", commit]] }]);
    return { data: { name, previous: repo.commit, commit }, human: `${name}: ${repo.commit || "(none)"} → ${commit || "(none)"}\n` };
  },
};
