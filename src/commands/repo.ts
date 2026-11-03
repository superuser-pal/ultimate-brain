import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { isProductRepository } from "../lib/brain-path.ts";
import { openBrain, type Brain } from "../lib/brain.ts";
import type { Command, Warning } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { atomicWriteFile } from "../lib/fs-safe.ts";
import { readJsonInput } from "../lib/input.ts";
import { journalExists } from "../lib/journal.ts";
import { assertKitTarget, KIT_FILE, kitBytesIfAny, kitHash, kitInvalid, kitProblems, matchesAny, parseKitBytes, readKitFile, serializeKit, shortHash, validKit, type HubContext, type Kit, type KitRead } from "../lib/link-kit.ts";
import { appendLog } from "../lib/log.ts";
import { scanNotes } from "../lib/notes.ts";
import { repoHealth } from "../lib/repo-health.ts";
import { checkIssueInput, countItems, parseIssues, parseMarkdownTasks, percentOf, rollupMarkdown, statusMap, unmappedOf, type TaskItem } from "../lib/repo-tasks.ts";
import { assertAncestor, expandPath, fileAtHead, fileDirty, findRepo, headCommit, isDirty, linkedRepos, openRepo, repoChanges, resolveCommit, workTreeTop, type LinkedRepo } from "../lib/repos.ts";
import { describeErrors, loadSchemas } from "../lib/schemas.ts";
import { guardPin, PIN_EXEMPT } from "../lib/skills-pin.ts";
import { installedProduct } from "../lib/skills.ts";
import { openWorkflowForRepo } from "../lib/workflow-store.ts";

const exec = promisify(execFile);
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Write brain.json with `repos` replaced, after checking the whole file against its schema. */
async function writeRepos(brain: Brain, repos: LinkedRepo[]): Promise<void> {
  const next: Record<string, unknown> = { ...structuredClone(brain.config), repos };
  const schemas = loadSchemas();
  if (!schemas.brain(next)) throw new BrainError("INPUT_INVALID", `brain.json would be invalid: ${describeErrors(schemas.brain.errors).join("; ")}`);
  await atomicWriteFile(brain.root, "brain.json", `${JSON.stringify(next, null, 2)}\n`);
}

async function hubOf(brain: Brain, home?: string): Promise<HubContext> {
  const { notes } = await scanNotes(brain.root);
  return { notes, config: brain.config, repos: linkedRepos(brain.config), home };
}

/** The bytes of `--input <file|->`, unparsed: the kit's hash is of these bytes (linked-repos.md §2.1). */
async function readInputBytes(path: string): Promise<Buffer> {
  try {
    if (path !== "-") return await readFile(path);
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  } catch (error) {
    throw new BrainError("INPUT_UNREADABLE", `Cannot read input ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** The kit a write command was given: parsed, or KIT_INVALID when the bytes aren't JSON. */
async function inputKit(path: string | undefined, command: string): Promise<Record<string, unknown>> {
  if (path === undefined) throw new BrainError("USAGE", `brain ${command} needs --input <file|->`);
  const read = parseKitBytes(await readInputBytes(path));
  if (read.kit === null) throw kitInvalid(read.problems);
  return read.kit as Record<string, unknown>;
}

/** CONFIRMATION_REQUIRED or CONFIRMATION_MISMATCH unless `--confirm` names exactly these bytes (linked-repos.md §3). */
function assertConfirmed(confirm: string | undefined, bytes: string): void {
  const hash = kitHash(bytes);
  if (confirm === undefined) throw new BrainError("CONFIRMATION_REQUIRED", `Writing ${KIT_FILE} needs --confirm with the hash of the content the user said yes to (${hash})`);
  if (confirm !== hash) throw new BrainError("CONFIRMATION_MISMATCH", `--confirm ${confirm} isn't the hash of the content to write (${hash}): show the user this content and ask again`);
}

const ensureAbsolute = (path: string, home?: string): string => {
  if (!/^(\/|~\/)/.test(path)) throw new BrainError("INPUT_INVALID", `--path ${path} must be absolute or start with ~/`);
  return expandPath(path, home);
};

/** A kit-linked `repos` entry: the kit's copies, in schema order (linked-repos.md §5). */
function kitEntry(name: string, path: string, kit: Kit, commit: string, sha256: string): LinkedRepo {
  return {
    name, path, area: kit.placement.area, patterns: kit.knowledge.patterns,
    ...(kit.knowledge.never_read === undefined ? {} : { never_read: kit.knowledge.never_read }),
    ...(kit.placement.project === undefined ? {} : { project: kit.placement.project }),
    commit, kit: { sha256 },
  };
}

/** `brain repo add <name> --path <path> (--area <area-id> --pattern <glob>… | --kit)` (spec/cli.md §5.16, §5.29). */
export const repoAddCommand: Command = {
  name: "repo add",
  usage: "brain repo add <name> --path <path> (--area <area-id> --pattern <glob> [--pattern <glob>]… | --kit) [--json]",
  summary: "Link a Git repo as a read-only source for an area: its files matching the patterns (or its link kit's) are ingested as they change.",
  options: { path: "string", area: "string", pattern: "list", kit: "boolean" },
  maxPositionals: 1,
  needsBrain: true,
  async run({ args, brain, now, environment }) {
    const [name] = args.positionals;
    const path = args.options.path as string | undefined;
    const area = args.options.area as string | undefined;
    const patterns = (args.options.pattern as string[] | undefined) ?? [];
    const fromKit = args.options.kit === true;
    if (fromKit && (area !== undefined || patterns.length > 0)) throw new BrainError("USAGE", "brain repo add --kit takes the area and patterns from the kit: drop --area and --pattern");
    if (name === undefined || path === undefined || (!fromKit && (area === undefined || patterns.length === 0))) {
      throw new BrainError("USAGE", "brain repo add needs <name>, --path, and --kit or --area with at least one --pattern");
    }
    if (!NAME.test(name)) throw new BrainError("INPUT_INVALID", `${name}: a repo name is lowercase kebab-case`);
    const repos = linkedRepos(brain!.config);
    if (repos.some((repo) => repo.name === name)) throw new BrainError("INPUT_INVALID", `${name} is already a linked repo`);
    if (!/^(\/|~\/)/.test(path)) throw new BrainError("INPUT_INVALID", `--path ${path} must be absolute or start with ~/`);

    let repo: LinkedRepo;
    if (fromKit) {
      const top = await openRepo({ name, path, area: "", patterns: [], commit: "" }, environment.homeDirectory);
      if (top === (await realpath(brain!.root))) throw new BrainError("REPO_IS_BRAIN", `${path} is the brain itself; link another repo`);
      const read = await readKitFile(top);
      const kit = await validKit(read, await hubOf(brain!, environment.homeDirectory), { forPath: top });
      if (kit.name !== name) throw kitInvalid([{ pointer: "/name", message: `is ${kit.name}, not ${name}` }]);
      repo = kitEntry(name, path, kit, "", read.sha256);
    } else {
      const { notes } = await scanNotes(brain!.root);
      const target = notes.find((note) => note.id === area);
      if (target === undefined) throw new BrainError("UNKNOWN_ID", `No note with id ${area}`);
      if (target.type !== "area") throw new BrainError("INPUT_INVALID", `${area} is a ${target.type}, not an area`);
      repo = { name, path, area: area!, patterns, commit: "" };
      const top = await openRepo(repo, environment.homeDirectory);
      // Compared after resolving symbolic links, so a link to the brain is refused too.
      if (top === (await realpath(brain!.root))) throw new BrainError("REPO_IS_BRAIN", `${path} is the brain itself; link another repo`);
    }

    await writeRepos(brain!, [...repos, repo]);
    await appendLog(brain!.root, now, [{ op: "repo-add", id: "-", title: name }]);
    return { data: repo, human: `linked ${name} (${expandPath(path, environment.homeDirectory)}) to ${repo.area}\n` };
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
    const changes = await repoChanges(path, repo.patterns, repo.commit, to);
    // Never read: the entry's never_read paths, and the kit itself (cli.md §5.29).
    const readable = (file: string) => file !== KIT_FILE && !matchesAny(repo.never_read, file);
    const files = changes.files.filter((file) => readable(file.path));
    const deleted = changes.deleted.filter(readable);
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

/** Open the brain when one resolves (linked-repos.md §2.2: `kit check` skips the hub checks otherwise), with the same refusals as any command. */
async function optionalBrain(args: { options: Record<string, unknown> }, environment: { env?: NodeJS.ProcessEnv; homeDirectory?: string }): Promise<Brain | null> {
  let brain: Brain;
  try {
    brain = await openBrain({ brainFlag: args.options.brain as string | undefined, env: environment.env, homeDirectory: environment.homeDirectory });
  } catch (error) {
    if (error instanceof BrainError && (error.code === "BRAIN_NOT_CONFIGURED" || error.code === "BRAIN_NOT_FOUND")) return null;
    throw error;
  }
  if (journalExists(brain.root)) throw new BrainError("RECOVERY_NEEDED", "An interrupted operation left a journal: run `brain recover` first");
  if (!PIN_EXEMPT.has("repo kit check")) guardPin(brain.root, () => installedProduct().version);
  return brain;
}

/** `brain repo kit check (--path <path> | --input <file|->) [--name <name>]` (spec/cli.md §5.29). */
export const repoKitCheckCommand: Command = {
  name: "repo kit check",
  usage: "brain repo kit check (--path <path> | --input <file|->) [--name <name>] [--json]",
  summary: "Validate a link kit, in a repo or given as input, and list its problems. Writes nothing.",
  options: { path: "string", input: "string", name: "string" },
  maxPositionals: 0,
  needsBrain: false,
  async run({ args, environment }) {
    const path = args.options.path as string | undefined;
    const input = args.options.input as string | undefined;
    if ((path === undefined) === (input === undefined)) throw new BrainError("USAGE", "brain repo kit check needs exactly one of --path or --input");
    const brain = await optionalBrain(args, environment);
    const hub = brain === null ? null : await hubOf(brain, environment.homeDirectory);
    let read: KitRead;
    let entry: LinkedRepo | undefined;
    if (path !== undefined) {
      const absolute = resolve(expandPath(path, environment.homeDirectory));
      read = await readKitFile(absolute);
      const real = await realpath(absolute).catch(() => absolute);
      for (const repo of hub?.repos ?? []) if (await realpath(expandPath(repo.path, environment.homeDirectory)).catch(() => repo.path) === real) entry = repo;
    } else read = parseKitBytes(await readInputBytes(input!));
    const name = args.options.name as string | undefined;
    const problems = [...read.problems, ...(read.kit === null ? [] : await kitProblems(read.kit, hub, { name, entry }))];
    return {
      data: { kit: read.kit, sha256: read.sha256, problems },
      resolvedBrain: brain?.root ?? null,
      human: problems.length === 0 ? `${KIT_FILE} is valid (${read.sha256})\n` : problems.map((problem) => `${problem.pointer || "/"} ${problem.message}\n`).join(""),
    };
  },
};

/** The refusals of `kit write` and `new` for a target folder (cli.md §5.29 step 1). */
async function assertWritableRepo(brain: Brain, top: string): Promise<void> {
  if (top === (await realpath(brain.root))) throw new BrainError("REPO_IS_BRAIN", `${top} is the brain itself; it has no link kit`);
  if (await isProductRepository(top)) throw new BrainError("OUTSIDE_ROOT", `${top} is the Ultimate Brain product repo, whose contents are public: it gets no link kit`);
}

/** `brain repo kit write --path <path> --input <file|-> --confirm <sha256> [--replace <sha256>]` (spec/cli.md §5.29, linked-repos.md §3). */
export const repoKitWriteCommand: Command = {
  name: "repo kit write",
  usage: "brain repo kit write --path <path> --input <file|-> --confirm <sha256> [--replace <sha256>] [--json]",
  summary: "Write a linked repo's brain-kit.json, after the user's yes to exactly this content. The only file the brain writes in a linked repo.",
  options: { path: "string", input: "string", confirm: "string", replace: "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now, environment }) {
    const path = args.options.path as string | undefined;
    if (path === undefined) throw new BrainError("USAGE", "brain repo kit write needs --path");
    const absolute = ensureAbsolute(path, environment.homeDirectory);
    const top = await workTreeTop(absolute);
    const real = await realpath(absolute).catch(() => null);
    if (top === null || real !== top) throw new BrainError("REPO_NOT_FOUND", `${path} is not the top of a Git working tree`);
    await assertWritableRepo(brain!, top);

    const value = await inputKit(args.options.input as string | undefined, "repo kit write");
    const hub = await hubOf(brain!, environment.homeDirectory);
    let entry: LinkedRepo | undefined;
    for (const repo of hub.repos) if (await realpath(expandPath(repo.path, environment.homeDirectory)).catch(() => repo.path) === top) entry = repo;
    const problems = await kitProblems(value, hub, { entry, forPath: top });
    if (problems.length > 0) throw kitInvalid(problems);
    const kit = value as unknown as Kit;

    await assertKitTarget(top);
    const current = await kitBytesIfAny(top);
    const replace = args.options.replace as string | undefined;
    if (current !== null && replace === undefined) throw new BrainError("KIT_EXISTS", `${KIT_FILE} already exists in ${path}: pass --replace with the hash of the kit the user saw (${kitHash(current)})`);
    if (current !== null && replace !== kitHash(current)) throw new BrainError("KIT_CHANGED", `${KIT_FILE} changed since the user saw it (now ${kitHash(current)}): show the new diff and ask again`);
    if (current === null && replace !== undefined) throw new BrainError("KIT_MISSING", `--replace names a kit, but ${path} has no ${KIT_FILE}`);

    const bytes = serializeKit(value);
    assertConfirmed(args.options.confirm as string | undefined, bytes);
    const sha256 = kitHash(bytes);
    const action = current === null ? "created" : current.equals(Buffer.from(bytes, "utf8")) ? "unchanged" : "updated";
    if (action !== "unchanged") await atomicWriteFile(top, KIT_FILE, bytes);
    await appendLog(brain!.root, now, [{ op: "repo-kit", id: "-", title: kit.name, pairs: [["sha", shortHash(sha256)]] }]);
    return { data: { path_abs: join(top, KIT_FILE), sha256, action }, human: `${KIT_FILE} ${action} in ${top} (${sha256})\n` };
  },
};

/** Read and check the kit of a kit-linked entry (NO_KIT for a legacy one). */
async function entryKit(brain: Brain, repo: LinkedRepo, home?: string): Promise<{ top: string; read: KitRead; kit: Kit }> {
  if (repo.kit === undefined) throw new BrainError("NO_KIT", `${repo.name} is linked without a kit (0042): write one with the brain-repos skill`);
  const top = await openRepo(repo, home);
  const read = await readKitFile(top);
  return { top, read, kit: await validKit(read, await hubOf(brain, home), { entry: repo }) };
}

/** `brain repo refresh <name> [--dry-run]` (spec/cli.md §5.29): copy a changed kit into brain.json. */
export const repoRefreshCommand: Command = {
  name: "repo refresh",
  usage: "brain repo refresh <name> [--dry-run] [--json]",
  summary: "Re-read a kit-linked repo's brain-kit.json and copy its placement and patterns into brain.json.",
  options: { "dry-run": "boolean" },
  maxPositionals: 1,
  needsBrain: true,
  async run({ args, brain, now, environment }) {
    const [name] = args.positionals;
    if (name === undefined) throw new BrainError("USAGE", "Name the repo: brain repo refresh <name>");
    const repo = findRepo(brain!.config, name);
    const { read, kit } = await entryKit(brain!, repo, environment.homeDirectory);
    const changed = read.sha256 !== repo.kit!.sha256;
    const diff = (before: readonly string[] = [], after: readonly string[] = []) => after.filter((value) => !before.includes(value));
    const data = {
      name,
      changed,
      placement_changed: repo.area !== kit.placement.area || repo.project !== kit.placement.project,
      added_patterns: diff(repo.patterns, kit.knowledge.patterns),
      removed_patterns: diff(kit.knowledge.patterns, repo.patterns),
      added_never_read: diff(repo.never_read, kit.knowledge.never_read),
      removed_never_read: diff(kit.knowledge.never_read, repo.never_read),
      reingest: false,
    };
    data.reingest = data.added_patterns.length > 0 || data.removed_never_read.length > 0;
    if (changed && args.options["dry-run"] !== true) {
      const next = kitEntry(name, repo.path, kit, repo.commit, read.sha256);
      await writeRepos(brain!, linkedRepos(brain!.config).map((entry) => (entry.name === name ? next : entry)));
      await appendLog(brain!.root, now, [{ op: "repo-refresh", id: "-", title: name, pairs: [["sha", shortHash(read.sha256)]] }]);
    }
    return { data, human: changed ? `${name}: kit applied${data.reingest ? "; run brain repo record --reset to read the newly readable files" : ""}\n` : `${name}: kit unchanged\n` };
  },
};

/** `brain repo show <name>` (spec/cli.md §5.29). */
export const repoShowCommand: Command = {
  name: "repo show",
  usage: "brain repo show <name> [--json]",
  summary: "Show a linked repo's brain.json entry, its kit and the workflow running in it. Writes nothing.",
  options: {},
  maxPositionals: 1,
  needsBrain: true,
  async run({ args, brain, environment }) {
    const [name] = args.positionals;
    if (name === undefined) throw new BrainError("USAGE", "Name the repo: brain repo show <name>");
    const repo = findRepo(brain!.config, name);
    let kit: unknown = null;
    let kitSha: string | null = null;
    let status: "current" | "changed" | "missing" | "invalid" | "none" = "none";
    if (repo.kit !== undefined) {
      let bytes: Buffer | null = null;
      try { bytes = await kitBytesIfAny(await openRepo(repo, environment.homeDirectory)); } catch { /* path missing */ }
      if (bytes === null) status = "missing";
      else {
        const read = parseKitBytes(bytes);
        kitSha = read.sha256;
        const problems = [...read.problems, ...(read.kit === null ? [] : await kitProblems(read.kit, await hubOf(brain!, environment.homeDirectory), { entry: repo }))];
        if (problems.length > 0) status = "invalid";
        else { kit = read.kit; status = read.sha256 === repo.kit.sha256 ? "current" : "changed"; }
      }
    }
    const workflow = openWorkflowForRepo(brain!.root, name);
    return { data: { entry: repo, kit, kit_sha256: kitSha, kit_status: status, workflow }, human: `${name}: ${expandPath(repo.path, environment.homeDirectory)} · kit ${status}${workflow === null ? "" : ` · workflow ${workflow.id} (${workflow.state})`}\n` };
  },
};

/** `brain repo health [<name>] [--input <file|->] [--rollup-as-of <timestamp>]` (spec/cli.md §5.29, linked-repos.md §6). */
export const repoHealthCommand: Command = {
  name: "repo health",
  usage: "brain repo health [<name>] [--input <file|->] [--rollup-as-of <timestamp>] [--json]",
  summary: "Check linked repos: path, kit, patterns, ingest state, task source and rollup. Writes nothing; exit 1 on an error.",
  options: { input: "string", "rollup-as-of": "string" },
  maxPositionals: 1,
  needsBrain: true,
  async run({ args, brain, now, environment }) {
    const [name] = args.positionals;
    const input = args.options.input as string | undefined;
    const asOfText = args.options["rollup-as-of"] as string | undefined;
    if ((input !== undefined || asOfText !== undefined) && name === undefined) throw new BrainError("USAGE", "brain repo health --input and --rollup-as-of need <name>");
    let rollupAsOf: Date | undefined;
    if (asOfText !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z$/.test(asOfText) || Number.isNaN(new Date(asOfText).getTime())) throw new BrainError("USAGE", `--rollup-as-of must be an ISO 8601 UTC timestamp, got "${asOfText}"`);
      rollupAsOf = new Date(asOfText);
    }
    const issues = input === undefined ? undefined : await readJsonInput(input, "repo health");
    const repos = name === undefined ? linkedRepos(brain!.config) : [findRepo(brain!.config, name)];
    const hub = await hubOf(brain!, environment.homeDirectory);
    const results = [];
    for (const repo of repos) results.push({ name: repo.name, checks: await repoHealth(repo, hub, brain!.root, { issues, rollupAsOf, now }) });
    const failed = results.some((result) => result.checks.some((check) => check.severity === "error"));
    return {
      data: { repos: results },
      exitCode: failed ? 1 : 0,
      human: results.map((result) => `${result.name}: ${result.checks.length === 0 ? "healthy" : result.checks.map((check) => `\n  ${check.severity} ${check.code}: ${check.message}`).join("")}\n`).join(""),
    };
  },
};

/** `brain repo tasks <name> [--input <file|->]` (spec/cli.md §5.29, linked-repos.md §4): the read-only rollup. */
export const repoTasksCommand: Command = {
  name: "repo tasks",
  usage: "brain repo tasks <name> [--input <file|->] [--json]",
  summary: "Build the read-only rollup of a tracked-in-repo repo's tasks, for its Project or Area page. Writes nothing.",
  options: { input: "string" },
  maxPositionals: 1,
  needsBrain: true,
  async run({ args, brain, now, environment }) {
    const [name] = args.positionals;
    if (name === undefined) throw new BrainError("USAGE", "Name the repo: brain repo tasks <name>");
    const repo = findRepo(brain!.config, name);
    const { top, kit } = await entryKit(brain!, repo, environment.homeDirectory);
    if (kit.tasks === undefined) throw new BrainError("NO_TASKS", `${name}'s kit tracks no tasks`);
    if (kit.tasks.mode === "connected") throw new BrainError("MODE_CONNECTED", `${name}'s tasks are in Notion, through its connected workflow: it has no rollup`);
    const source = kit.tasks.source;
    const map = statusMap(kit);
    const warnings: Warning[] = [];
    let items: TaskItem[];
    let asOf = now;
    if (source.kind === "markdown") {
      if (args.options.input !== undefined) throw new BrainError("USAGE", "A markdown task source is read from the repo: drop --input");
      const text = await fileAtHead(top, source.path);
      if (text === null) throw kitInvalid([{ pointer: "/tasks/source/path", message: `${source.path} doesn't exist at HEAD` }]);
      if (await fileDirty(top, source.path)) warnings.push({ code: "REPO_DIRTY", message: `${source.path} has uncommitted changes; the rollup reads it at HEAD`, path: source.path });
      items = parseMarkdownTasks(text.toString("utf8"), source, map);
    } else if (source.kind === "github" || source.kind === "gitlab") {
      if (args.options.input === undefined) throw new BrainError("USAGE", `A ${source.kind} task source needs --input with the issues the skill fetched`);
      const input = checkIssueInput(await readJsonInput(args.options.input as string, "repo tasks"), source.kind);
      items = parseIssues(input, source.kind, map);
      asOf = new Date(input.fetched_at);
    } else throw new BrainError("MODE_CONNECTED", `${name}'s tasks are in Notion: it has no rollup`);
    const counts = countItems(items);
    const heading = `Repo tasks · ${name}`;
    return {
      data: {
        name,
        target: kit.placement.project !== undefined ? { project: kit.placement.project } : { area: kit.placement.area },
        as_of: asOf.toISOString().replace(/\.\d{3}Z$/, "Z"),
        counts,
        percent: percentOf(counts.done, items.length, counts.dropped),
        items,
        unmapped: unmappedOf(items),
        toggle: { heading, markdown: rollupMarkdown(name, source, asOf, items) },
      },
      warnings,
      human: `${heading}\n${rollupMarkdown(name, source, asOf, items)}`,
    };
  },
};

/** `brain repo unlink <name>` (spec/cli.md §5.29, linked-repos.md §9): the knowledge stays. */
export const repoUnlinkCommand: Command = {
  name: "repo unlink",
  usage: "brain repo unlink <name> [--json]",
  summary: "Remove a linked repo from brain.json. Its sources and notes stay; nothing in the repo changes.",
  options: {},
  maxPositionals: 1,
  needsBrain: true,
  async run({ args, brain, now }) {
    const [name] = args.positionals;
    if (name === undefined) throw new BrainError("USAGE", "Name the repo: brain repo unlink <name>");
    const removed = findRepo(brain!.config, name);
    const { notes } = await scanNotes(brain!.root);
    const sources = notes.filter((note) => note.type === "source" && note.attributes.repo === name).length;
    const workflow = openWorkflowForRepo(brain!.root, name);
    await writeRepos(brain!, linkedRepos(brain!.config).filter((entry) => entry.name !== name));
    await appendLog(brain!.root, now, [{ op: "repo-unlink", id: "-", title: name }]);
    return { data: { name, removed, sources, workflow }, human: `unlinked ${name}; ${sources} source(s) kept${workflow === null ? "" : `; workflow ${workflow.id} still runs in the repo`}\n` };
  },
};

const STARTER = new URL("../../templates/repo/generic/", import.meta.url);
/** The generic starter's files (linked-repos.md §7): repo path → template file. `.gitignore` is stored as `gitignore`, which npm keeps. */
const STARTER_FILES: ReadonlyArray<readonly [string, string]> = [
  [".gitignore", "gitignore"], ["AGENTS.md", "AGENTS.md"], ["CLAUDE.md", "CLAUDE.md"], ["README.md", "README.md"], ["TASKS.md", "TASKS.md"],
  ["decisions/_template.md", "decisions/_template.md"], ["docs/README.md", "docs/README.md"],
];

const TASK_LINES: Record<string, string> = {
  "tracked-in-repo": 'Tasks are in TASKS.md: one line "- [ ] title" each; "[x]" when done.',
  connected: "Tasks are in Notion, through the connected workflow.",
  none: "This repo tracks no tasks.",
};

/** OUTSIDE_ROOT when `target` would sit inside the brain (compared through the nearest existing folder's real path). */
async function assertOutsideBrain(brain: Brain, target: string): Promise<void> {
  let existing = target;
  while (!existsSync(existing) && dirname(existing) !== existing) existing = dirname(existing);
  const real = join(await realpath(existing), target.slice(existing.length));
  const root = await realpath(brain.root);
  if (real === root || real.startsWith(`${root}/`)) throw new BrainError("OUTSIDE_ROOT", `${target} is inside the brain; start the repo elsewhere`);
}

/** `brain repo new --path <path> --starter generic --input <file|-> --confirm <sha256>` (spec/cli.md §5.29, linked-repos.md §7). */
export const repoNewCommand: Command = {
  name: "repo new",
  usage: "brain repo new --path <path> --starter generic --input <file|-> --confirm <sha256> [--json]",
  summary: "Start a new repo from the generic starter with its link kit, and make its first commit. Doesn't link it.",
  options: { path: "string", starter: "string", input: "string", confirm: "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now, environment }) {
    const path = args.options.path as string | undefined;
    if (path === undefined || args.options.starter === undefined) throw new BrainError("USAGE", "brain repo new needs --path, --starter generic, --input and --confirm");
    if (args.options.starter !== "generic") throw new BrainError("USAGE", `--starter ${String(args.options.starter)}: the only starter is generic`);
    const target = resolve(ensureAbsolute(path, environment.homeDirectory));
    await assertOutsideBrain(brain!, target);
    if (existsSync(target)) {
      const stats = await lstat(target);
      if (!stats.isDirectory() || (await readdir(target)).length > 0) throw new BrainError("TARGET_NOT_EMPTY", `${path} exists and isn't an empty folder`);
    }

    const value = await inputKit(args.options.input as string | undefined, "repo new");
    // The command sets `starter` (§7), so the confirmed bytes are the kit as written.
    const kitValue: Record<string, unknown> = { ...value, starter: { name: "generic", version: installedProduct().version } };
    const problems = await kitProblems(kitValue, await hubOf(brain!, environment.homeDirectory), { forPath: target });
    const kit = kitValue as unknown as Kit;
    if (problems.length === 0 && kit.tasks?.mode === "tracked-in-repo") {
      const source = kit.tasks.source as Record<string, unknown>;
      if (source.kind !== "markdown" || source.path !== "TASKS.md" || source.format !== "checklist") problems.push({ pointer: "/tasks/source", message: 'must be { "kind": "markdown", "path": "TASKS.md", "format": "checklist" }: the starter writes that file' });
    }
    if (problems.length > 0) throw kitInvalid(problems);
    const bytes = serializeKit(kitValue);
    assertConfirmed(args.options.confirm as string | undefined, bytes);

    const fill = (text: string) => text.replaceAll("{name}", kit.name).replaceAll("{summary}", kit.methodology.summary).replaceAll("{tasks}", TASK_LINES[kit.tasks?.mode ?? "none"]!);
    const written: string[] = [];
    await mkdir(target, { recursive: true });
    for (const [file, template] of STARTER_FILES) {
      if (file === "TASKS.md" && kit.tasks?.mode !== "tracked-in-repo") continue;
      await mkdir(dirname(join(target, file)), { recursive: true });
      await writeFile(join(target, file), fill(await readFile(new URL(template, STARTER), "utf8")));
      written.push(file);
    }
    await writeFile(join(target, KIT_FILE), bytes);
    written.push(KIT_FILE);
    written.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    const warnings: Warning[] = [];
    const git = (...gitArgs: string[]) => exec("git", ["-C", target, ...gitArgs]);
    await git("init", "-q");
    let commit: string | null = null;
    try {
      await git("add", "--", ...written);
      await git("commit", "-q", "-m", "Start from the Ultimate Brain generic starter");
      commit = (await git("rev-parse", "--short", "HEAD")).stdout.trim();
    } catch (error) {
      warnings.push({ code: "GIT_COMMIT_SKIPPED", message: `The first commit failed (${error instanceof Error ? error.message.split("\n")[0] : String(error)}); the files are in place: commit them yourself` });
    }
    await appendLog(brain!.root, now, [{ op: "repo-new", id: "-", title: kit.name }]);
    return { data: { path_abs: target, files: written, sha256: kitHash(bytes), commit }, warnings, human: `started ${kit.name} in ${target}${commit === null ? "" : ` (${commit})`}\n` };
  },
};
