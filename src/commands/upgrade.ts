import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, readdir, readFile, rmdir, unlink } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { promisify } from "node:util";

import type { Command, Warning } from "../lib/command.ts";
import { planConceptConversion } from "../lib/concept-upgrade.ts";
import { IDENTITY_COMMANDS } from "./init.ts";
import { BrainError, type ErrorCode } from "../lib/errors.ts";
import { atomicWriteFile, ensureDirectory } from "../lib/fs-safe.ts";
import { appendLog } from "../lib/log.ts";
import { isRecord } from "../lib/input.ts";
import { lintBrain } from "../lib/lint.ts";
import { modulesOf, storedModules, withModules } from "../lib/modules.ts";
import { compareCodePoints, NOTE_FOLDERS, parseNote, scanNotes, type Note } from "../lib/notes.ts";
import { planStructureText, readAgentsMarkdown, structureBlock } from "../lib/structure.ts";
import { indexNotes, loadSuppressions, type Loaded } from "../lib/suppressions.ts";
import { assertPlainPath, installedProduct, SUB_AGENT } from "../lib/skills.ts";
import { notionMigrations, notionMigrationsLine } from "../lib/notion-migrations.ts";
import { competingCopies } from "../lib/skills-competing.ts";
import { styleLines, withStyleBlock } from "../lib/style.ts";
import { homeOf, LOCK, readLock, serializeLock, snapshotInvalid, type Lock } from "../lib/skills-pin.ts";
import { comparePrecedence } from "../lib/skills-range.ts";
import { packageProblem, packageSnapshot, serializeManifest, TREES, type Manifest } from "../lib/skills-snapshot.ts";
import { planProjects, projectsHuman, projectWarnings, nextLines, skillsDiffer, writeProjects } from "../lib/upgrade-projects.ts";
import {
  commitOnly, compare, compareUncommitted, conflictLines, fingerprint, firstChange, gitContext, gitOperation, gitOperationMessage, GitFailure,
  hasIdentity, headBytes, headCommit, ignoredPaths, indexEntries, leftAsTheyWere, readStatus, restoreIndex, type Footprint, type StatusRead,
  type UncommittedReport,
} from "../lib/upgrade-git.ts";
import { waitForIndex } from "../lib/workflow-store.ts";

const exec = promisify(execFile);
const START = /^<!-- ultimate-brain:rules:start\b[^\n]*-->$/gm;
const END = /^<!-- ultimate-brain:rules:end -->$/gm;

type Action = "created" | "updated" | "removed" | "skipped";
const WEEKLY_IGNORE = "_weekly/attempt.json";
const LF_ATTRIBUTE = "* text=auto eol=lf";
interface Change { path: string; action: Action; content?: string | Buffer }
/** A file the upgrade wrote: its bytes before (null when it created it) and after (null when it removed it), for undoing a refused commit. */
interface Written { path: string; before: Buffer | null; after: Buffer | null }

const IDENTITY_MESSAGE = [
  "Git doesn't know your name and email yet, and the upgrade commits its changes with them. Run these two lines, with your own name and email:",
  ...IDENTITY_COMMANDS,
  "Then run brain upgrade again. Nothing was written.",
].join("\n");

/** Test seams (spec/cli.md §5.15, Uncommitted work items 6 and 8): run after planning, and right before the commit. */
const hooks: { afterPlanning?: () => Promise<void>; beforeCommit?: () => Promise<void> } = {};
export function setUpgradeHooksForTests(next: typeof hooks): void {
  hooks.afterPlanning = next.afterPlanning;
  hooks.beforeCommit = next.beforeCommit;
}

/** `brain upgrade` (spec/cli.md §5.15): bring the product-owned files of a brain up to the installed package. */
export const upgradeCommand: Command = {
  name: "upgrade",
  usage: "brain upgrade [--dry-run] [--json]",
  summary: "Update the brain's product-owned AGENTS.md block and skills to the installed version.",
  options: { "dry-run": "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  allowInvalidBrainConfig: true,
  async run({ args, brain, now, environment }) {
    const root = brain!.root;
    const product = installedProduct();
    if (product.source) throw new BrainError("UNRELEASED_BUILD", "brain upgrade requires a published ultimate-brain package");
    const warnings: Warning[] = [];
    const changes: Change[] = [];
    let unchanged = 0;
    const dryRun = args.options["dry-run"] === true;

    // Uncommitted work (spec/cli.md §5.15, decision 0103), item 1: Git's state, first of the Git checks. A dry run reports what it would refuse.
    const context = await gitContext(root);
    let status: StatusRead | null = null;
    let wouldRefuse: ErrorCode | null = null;
    let operation: string | null = null;
    if (context !== null) {
      if (!dryRun) await waitForIndex(root);
      status = await readStatus(root, context);
      operation = await gitOperation(root, status.unmerged);
      if (operation !== null) {
        if (!dryRun) throw new BrainError("GIT_OPERATION_IN_PROGRESS", gitOperationMessage(operation));
        wouldRefuse = "GIT_OPERATION_IN_PROGRESS";
      }
    }
    // Item 6: what the upgrade plans from, compared again just before the first write.
    const plannedFrom = context !== null && !dryRun ? await fingerprint(root, []) : null;

    // Every check runs before the first write, so a refusal leaves the brain untouched.
    const template = await readFile(join(product.root, "templates/brain/AGENTS.md"), "utf8");
    await assertPlainPath(root, "AGENTS.md");
    const current = await readOptional(join(root, "AGENTS.md"));
    // A brain.json that isn't JSON (step 5) leaves the style block as it is: brain!.config is then {}, which would read as Standard.
    const readable = await parses(join(root, "brain.json"));
    const scanned = await scanNotes(root);
    const { rules, styled, structure, text: agentsText } = planAgents(current, template, brain!.config, readable, scanned.notes, loadSuppressions(root));
    if (structure?.warn) warnings.push({ code: "AGENTS_BLOCK_NOT_FOUND", message: "AGENTS.md's structure markers are missing, out of order or duplicated; the structure block was left as it is." });
    if (rules === undefined) {
      changes.push({ path: "AGENTS.md", action: "skipped" });
      warnings.push({ code: "AGENTS_BLOCK_NOT_FOUND", message: "AGENTS.md has no single ultimate-brain rules block; left unchanged." });
    } else if (styled === undefined) {
      changes.push({ path: "AGENTS.md", action: "skipped" });
      warnings.push({ code: "AGENTS_BLOCK_NOT_FOUND", message: "AGENTS.md's style markers are missing, out of order or duplicated; left unchanged." });
    } else if (current === null) changes.push({ path: "AGENTS.md", action: "created", content: agentsText! });
    else if (agentsText === current) unchanged += 1;
    else changes.push({ path: "AGENTS.md", action: "updated", content: agentsText! });
    if (!(await exists(join(root, "CLAUDE.md")))) changes.push({ path: "CLAUDE.md", action: "created", content: "@AGENTS.md\n" });
    else unchanged += 1;
    // 0.10.0: the Ultimate Assistant sub-agent, product-owned as a whole file (spec/cli.md §5.15 step 2a).
    const agentTemplate = await readFile(join(product.root, "templates/brain", SUB_AGENT));
    await assertPlainPath(root, SUB_AGENT);
    const agentBefore = await readOptionalBuffer(join(root, SUB_AGENT));
    if (agentBefore === null) changes.push({ path: SUB_AGENT, action: "created", content: agentTemplate });
    else if (agentBefore.equals(agentTemplate)) unchanged += 1;
    else changes.push({ path: SUB_AGENT, action: "updated", content: agentTemplate });

    // 0.15.0: the weekly review's attempt marker is never committed (spec/cli.md §5.15 step 2b, weekly-review.md §9.5).
    await assertPlainPath(root, ".gitignore");
    const ignoreBefore = await readOptionalBuffer(join(root, ".gitignore"));
    const ignoreText = ignoreBefore?.toString("utf8") ?? null;
    if (ignoreText === null) changes.push({ path: ".gitignore", action: "created", content: `${WEEKLY_IGNORE}\n` });
    else if (ignoreText.split(/\r?\n/).some((line) => line.trim() === WEEKLY_IGNORE)) unchanged += 1;
    else changes.push({ path: ".gitignore", action: "updated", content: `${ignoreText}${ignoreText === "" || ignoreText.endsWith("\n") ? "" : "\n"}${WEEKLY_IGNORE}\n` });

    // 0.15.2: text files stay LF on every system, so Git on Windows doesn't check notes out with CRLF (spec/cli.md §5.15 step 1d, decision 0097).
    await assertPlainPath(root, ".gitattributes");
    const attributesText = (await readOptionalBuffer(join(root, ".gitattributes")))?.toString("utf8") ?? null;
    if (attributesText === null) changes.push({ path: ".gitattributes", action: "created", content: await readFile(join(product.root, "templates/brain/gitattributes"), "utf8") });
    else if (attributesText.split(/\r?\n/).some((line) => line.trim() === LF_ATTRIBUTE)) unchanged += 1;
    else changes.push({ path: ".gitattributes", action: "updated", content: `${LF_ATTRIBUTE}\n${attributesText}${attributesText === "" || attributesText.endsWith("\n") ? "" : "\n"}` });

    // 0.3.0: Inbox is the former Capture Inbox; 0.6.0: Documents are the former References (0049).
    // Keep each database id, but retire the old key. 0.6.0 also writes the modules block (0048).
    const brainJson = "brain.json";
    await assertPlainPath(root, brainJson);
    const brainText = await readOptional(join(root, brainJson));
    if (brainText !== null) {
      try {
        let config = JSON.parse(brainText) as Record<string, unknown>;
        let changed = false;
        const notion = config.notion;
        if (isRecord(notion) && isRecord(notion.databases)) {
          let databases = notion.databases;
          for (const [old, key] of [["capture_inbox", "inbox"], ["references", "documents"]] as const) {
            if (databases[old] === undefined) continue;
            databases = renameKey(databases, old, key);
            changed = true;
          }
          // 0.9.1: the Concepts database is retired (0071); its key goes, whatever its value.
          if ("concepts" in databases) {
            databases = Object.fromEntries(Object.entries(databases).filter(([name]) => name !== "concepts"));
            changed = true;
          }
          if (changed) config = { ...config, notion: { ...notion, databases } };
        }
        if (isRecord(config) && !("modules" in config)) {
          config = withModules(config, modulesOf(config));
          changed = true;
        }
        // 0.16.0: the Knowledge module is retired (0099 §1); its key goes, whatever its value. The decisions and questions database ids stay:
        // the 0.16.0 Notion migration reads Questions once, then removes both (spec/cli.md §5.15 step 5, §5.14.9).
        if (isRecord(config.modules) && "knowledge" in config.modules) {
          config = { ...config, modules: Object.fromEntries(Object.entries(config.modules).filter(([name]) => name !== "knowledge")) };
          changed = true;
        }
        // 0.9.1: a report is a Documents row, so Reports needs Documents on (0071).
        const stored = storedModules(config);
        if (stored.reports && !stored.documents) {
          config = withModules(config, { ...stored, documents: true });
          changed = true;
          warnings.push({ code: "DOCUMENTS_TURNED_ON", message: `Reports now live in Documents, so the Documents module is on. Apply Notion migration 0019 before the next publish: ${join(installedProduct().root, "notion", "migrations", "0019-reports-move-to-documents.md")}` });
        }
        if (changed) changes.push({ path: brainJson, action: "updated", content: `${JSON.stringify(config, null, 2)}\n` });
      } catch {
        changes.push({ path: brainJson, action: "skipped" });
        warnings.push({ code: "BRAIN_JSON_UNPARSEABLE", message: "brain.json is not valid JSON; left unchanged." });
      }
    }

    // 0.9.1 (step 5a, decision 0071): concepts become learned Documents, the links to them follow, and index.md is rebuilt.
    const indexBefore = await readOptional(join(root, "index.md"));
    const concepts = planConceptConversion(root, scanned.notes, (path) => existsSync(join(root, path)), indexBefore);
    for (const change of concepts.changes) {
      await assertPlainPath(root, change.path);
      changes.push(change);
    }
    for (const { path, links } of concepts.unresolved) {
      warnings.push({ code: "CONCEPT_LINK_UNRESOLVED", message: `${path}: ${links.join(", ")} ${links.length === 1 ? "points" : "point"} at a concept note that no longer exists, and no learned Document has its file name. Fix ${links.length === 1 ? "it" : "them"} by hand.` });
    }

    // Skills (decisions 0029, 0059): the package snapshot replaces the pinned one (spec/skills-delivery.md §6.3). Its refusals are
    // decided here and raised after the BRAIN_DIRTY check, still before any write.
    const pkg = packageSnapshot(product.root, product.version);
    const previous = readLock(root);
    await assertPlainPath(root, LOCK);
    let refusal: BrainError | undefined;
    let manifest: Manifest | undefined;
    let from: { name: string; version: string } | null = null;
    const retired: string[] = [];
    /** Skill folders to prune after the writes; `true` when the folder itself goes too (a retired skill). */
    const prune = new Map<string, boolean>();
    let lock: Lock | undefined;
    let previousCli: string | null = null;
    const problem = packageProblem(pkg);
    if (problem !== null) refusal = snapshotInvalid(problem, product.version);
    else {
      manifest = pkg.manifest!;
      const old = previous.kind === "valid" ? previous.lock : undefined;
      if (previous.kind === "invalid") warnings.push({ code: "SKILLS_LOCK_REPLACED", message: `${LOCK} was invalid (${previous.reason}) and was replaced.` });
      if (old !== undefined) {
        from = { name: old.snapshot.name, version: old.snapshot.version };
        if (old.snapshot.name === manifest.name) {
          const order = comparePrecedence(old.snapshot.version, manifest.version);
          if (order > 0) {
            refusal = new BrainError("SKILLS_DOWNGRADE", `This brain pins ${manifest.name} ${old.snapshot.version}; this CLI ships the older ${manifest.version}. Install ultimate-brain@${old.installed_by}, or roll back as docs/releasing.md says.`, { name: manifest.name, pinned: old.snapshot.version, shipped: manifest.version, installed_by: old.installed_by });
          } else if (order === 0 && serializeManifest(old.snapshot) !== serializeManifest(manifest)) {
            refusal = snapshotInvalid("same version, different content", product.version);
          }
        }
      }
      if (refusal === undefined) {
        const names = new Set(manifest.skills.map((skill) => skill.name));
        for (const tree of TREES) {
          for (const skill of manifest.skills) {
            const folder = `${tree}/${skill.name}`;
            await assertPlainPath(root, folder, "folder");
            prune.set(folder, false);
            const listed = new Set(skill.files.map((file) => file.path));
            for (const file of skill.files) {
              const path = `${folder}/${file.path}`;
              await assertPlainPath(root, path);
              const content = await readFile(join(pkg.folder, skill.name, file.path));
              const existing = await readOptionalBuffer(join(root, path));
              if (existing === null) changes.push({ path, action: "created", content });
              else if (existing.equals(content)) unchanged += 1;
              else changes.push({ path, action: "updated", content });
            }
            for (const file of await listFiles(join(root, folder))) {
              await assertPlainPath(root, `${folder}/${file}`);
              if (!listed.has(file)) changes.push({ path: `${folder}/${file}`, action: "removed" });
            }
          }
          // A skill the old (valid) lock names and the new snapshot doesn't is retired: its product-owned folder goes, whatever it holds.
          for (const skill of old?.snapshot.skills ?? []) {
            if (names.has(skill.name)) continue;
            const folder = `${tree}/${skill.name}`;
            await assertPlainPath(root, folder, "folder");
            if (!(await exists(join(root, folder)))) continue;
            prune.set(folder, true);
            for (const file of await listFiles(join(root, folder))) {
              await assertPlainPath(root, `${folder}/${file}`);
              changes.push({ path: `${folder}/${file}`, action: "removed" });
            }
          }
        }
        retired.push(...(old?.snapshot.skills ?? []).map((skill) => skill.name).filter((name) => !names.has(name)).sort());
        const write = old === undefined || old.snapshot.name !== manifest.name || old.snapshot.version !== manifest.version;
        lock = { format: 1, installed_by: write ? product.version : old!.installed_by, snapshot: manifest };
        if (write) {
          changes.push({ path: LOCK, action: previous.kind === "absent" ? "created" : "updated", content: serializeLock(product.version, manifest) });
          previousCli = old !== undefined ? old.installed_by : await lastUpgradeCli(root, product.version);
        } else unchanged += 1;
      }
    }

    const settings = ".claude/settings.json";
    await assertPlainPath(root, settings);
    const settingsBefore = await readOptional(join(root, settings));
    if (settingsBefore !== null) {
      try {
        const value = JSON.parse(settingsBefore) as Record<string, unknown>;
        let changed = false;
        for (const [key, remove] of [["enabledPlugins", "ultimate-brain@ultimate-brain"], ["extraKnownMarketplaces", "ultimate-brain"]] as const) {
          if (value[key] !== null && typeof value[key] === "object" && !Array.isArray(value[key]) && remove in (value[key] as object)) {
            delete (value[key] as Record<string, unknown>)[remove];
            changed = true;
            if (Object.keys(value[key] as object).length === 0) delete value[key];
          }
        }
        if (changed) {
          changes.push({
            path: settings,
            action: Object.keys(value).length === 0 ? "removed" : "updated",
            content: Object.keys(value).length === 0 ? undefined : `${JSON.stringify(value, null, 2)}\n`,
          });
        }
      } catch {
        changes.push({ path: settings, action: "skipped" });
        warnings.push({ code: "SETTINGS_UNPARSEABLE", message: ".claude/settings.json is not valid JSON; left unchanged." });
      }
    }

    changes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const written = changes.filter((change) => change.action !== "skipped");
    const version = product.version;
    if (refusal !== undefined) throw refusal;

    // Items 2 to 5, after the pin: the footprint, its generated inputs, and every uncommitted path compared with them.
    const logPath = `log/${now.toISOString().slice(0, 7)}.md`;
    const footprint = footprintOf(root, written, written.length > 0 ? logPath : null, concepts.converted);
    let uncommitted: UncommittedReport | null = null;
    if (context !== null && status !== null && operation === null) {
      const inputs = new Map<string, string[]>();
      const agentsBuilt = footprint.files.has("AGENTS.md") && agentsText !== undefined;
      const indexBuilt = concepts.index !== null;
      for (const { path } of status.entries) {
        if (footprint.files.has(path)) continue;
        const note = isNotePath(path);
        const suppression = /^_suppressions\/[^/]+\.json$/.test(path);
        if (!(note || suppression || path === "brain.json") || !(agentsBuilt || (indexBuilt && path !== "brain.json"))) continue;
        const committed = (await headBytes(root, context, path))?.toString("utf8") ?? null;
        const notes = note ? withNote(scanned.notes, path, committed) : scanned.notes;
        const records = suppression ? loadSuppressions(root, new Map([[path.slice("_suppressions/".length), committed]])) : loadSuppressions(root);
        const affects: string[] = [];
        if (agentsBuilt) {
          const config = path === "brain.json" ? configOf(committed) : brain!.config;
          const configReadable = path === "brain.json" ? committed !== null && parsesText(committed) : readable;
          if (planAgents(current, template, config, configReadable, notes, records).text !== agentsText) affects.push("AGENTS.md");
        }
        if (indexBuilt && path !== "brain.json") {
          const again = planConceptConversion(root, notes, (taken) => existsSync(join(root, taken)), indexBefore, records);
          if ((again.index ?? indexBefore) !== concepts.index) affects.push("index.md");
        }
        if (affects.length > 0) inputs.set(path, affects);
      }
      // The old lock is an input of the retired skills' removals and of the new lock, but a lock that retires a skill is itself rewritten:
      // an uncommitted lock then conflicts as `changed`, so it needs no input check of its own.
      const ignorable = [...footprint.files].filter(([, action]) => action !== "removed").map(([path]) => path);
      uncommitted = compareUncommitted(status.entries, footprint, inputs, await ignoredPaths(root, ignorable), context.ignoreCase);
      if (uncommitted.conflicts.length > 0) {
        const lines = conflictLines(uncommitted);
        if (!dryRun) {
          const message = `Upgrade stopped before writing anything: ${lines[0]}`;
          throw new BrainError("BRAIN_DIRTY", message, uncommitted, [message, ...lines.slice(1)].join("\n"));
        }
        wouldRefuse ??= "BRAIN_DIRTY";
      }
    }
    if (context !== null && written.length > 0 && !(await hasIdentity(root))) {
      if (!dryRun) throw new BrainError("GIT_IDENTITY_MISSING", IDENTITY_MESSAGE);
      wouldRefuse ??= "GIT_IDENTITY_MISSING";
    }
    // Step 9: every registered linked project is judged and planned before the first write, and written after the brain.
    const home = homeOf(environment.env);
    const projects = await planProjects({ brainRoot: root, config: brain!.config, notes: scanned.notes, manifest: manifest!, folder: pkg.folder, homeDirectory: environment.homeDirectory, home });
    let done: Written[] = [];
    if (!dryRun && written.length > 0) {
      // Item 6: nothing the upgrade planned from changed since, else nothing is written.
      await hooks.afterPlanning?.();
      if (context !== null) {
        const moved = (await headCommit(root)) !== context.head ? "HEAD" : null;
        const again = moved === null ? await readStatus(root, context) : null;
        const changed = moved ?? (again === null ? null : firstStatusChange(status!, again)) ?? firstChange(plannedFrom!, await fingerprint(root, [...footprint.files.keys()]));
        if (changed !== null) throw new BrainError("BRAIN_CHANGED", `The brain changed while the upgrade was planning (${changed}). Nothing was written; run brain upgrade again.`);
      }
      done = await writeChanges(root, written);
      for (const [folder, self] of prune) await pruneEmpty(join(root, folder), self);
      // knowledge/concepts/ and every folder under it the conversion left empty (spec/cli.md §5.15 step 5a).
      if (concepts.converted.length > 0) await pruneEmpty(join(root, "knowledge/concepts"), true);
      const logBefore = await readOptionalBuffer(join(root, logPath));
      await appendLog(root, now, [{ op: "upgrade", id: "-", title: version, pairs: [["files", written.length]] }]);
      done.push({ path: logPath, before: logBefore, after: await readOptionalBuffer(join(root, logPath)) });
    }
    // A dry run lints the planned tree: the converted notes as step 5a would leave them (spec/cli.md §5.15 step 7).
    const { notes, problems } = dryRun ? { notes: concepts.notes, problems: scanned.problems } : await scanNotes(root);
    const plannedProductFiles = new Map<string, string | null>();
    for (const change of changes) if (change.action !== "skipped") plannedProductFiles.set(change.path, change.action === "removed" ? null : Buffer.from(change.content!).toString("utf8"));
    const agentsMarkdown = dryRun && plannedProductFiles.has("AGENTS.md") ? plannedProductFiles.get("AGENTS.md")! : await readAgentsMarkdown(root);
    const lint = lintBrain({ root, notes, problems, brainConfig: brain!.config, indexMarkdown: dryRun && concepts.index !== null ? concepts.index : await readOptional(join(root, "index.md")), agentsMarkdown,
      pendingPaths: dryRun ? new Set(concepts.changes.filter((change) => change.action === "created").map((change) => change.path)) : undefined, plannedProductFiles, skillsLock: lock, home });
    const competing = competingCopies({ treeRoot: root, names: manifest!.skills.map((skill) => skill.name), home, brainRoot: root, brainSettings: plannedProductFiles.get(".claude/settings.json") });
    if (competing.length > 0) warnings.push({ code: "SKILLS_COMPETING", message: `${competing.length} competing skill copies; see data.skills.competing and remove them.` });
    let commit: string | null = null;
    let pushed = false;
    if (!dryRun && written.length > 0 && context !== null) {
      // Item 7: the commit takes the footprint only; item 8: a refused commit undoes the upgrade and leaves the user's index as it was.
      const files = [...footprint.files.keys()].sort(compare);
      const before = await indexEntries(root, context, files);
      // A removed file Git doesn't track (an ignored file in a skill folder) is deleted with nothing to commit for it.
      const paths = files.filter((path) => before.has(path) || existsSync(join(root, path)));
      try {
        await hooks.beforeCommit?.();
        if ((await headCommit(root)) !== context.head) throw new Error("HEAD moved since the upgrade planned");
        await waitForIndex(root);
        await commitOnly(root, paths, `upgrade: ultimate brain ${version}, skills ${manifest!.name} ${manifest!.version}`);
        commit = (await exec("git", ["rev-parse", "--short", "HEAD"], { cwd: root })).stdout.trim();
      } catch (error) {
        const reason = error instanceof GitFailure || error instanceof Error ? error.message : String(error);
        const left = await undoWrites(root, done, [...footprint.folders]);
        await restoreIndex(root, context, paths, before);
        throw new BrainError("UPGRADE_NOT_COMMITTED", [
          `Git didn't commit the upgrade (${reason}). Nothing of the upgrade was kept, and your own changes are untouched. Fix the cause, then run brain upgrade again.`,
          ...(left.length > 0 ? [`These files were changed since the upgrade wrote them and were left as they are: ${left.join(", ")}.`] : []),
        ].join(" "));
      }
      if (commit !== null) {
        try {
          await exec("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], { cwd: root });
        } catch {
          warnings.push({ code: "PUSH_SKIPPED", message: "Git branch has no upstream; commit was not pushed." });
        }
        if (!warnings.some((warning) => warning.code === "PUSH_SKIPPED")) {
          try {
            await exec("git", ["push"], { cwd: root });
            pushed = true;
          } catch (error) {
            warnings.push({ code: "PUSH_FAILED", message: String(error) });
          }
        }
      }
    }
    // The Notion migrations newer than the template (0078, §5.15): read only, the same with --dry-run.
    const migrations = await notionMigrations(product.root, brain!.config);
    let definitionsDiffer = false;
    if (!dryRun) {
      await writeProjects(projects, manifest!);
      const differs = await skillsDiffer(root, manifest!.skills);
      if (differs !== null) {
        definitionsDiffer = true;
        warnings.push({ code: "DEFINITIONS_DIFFER", message: `${differs}; run brain upgrade again.` });
      }
    }
    const reports = projects.map((project) => project.report);
    warnings.push(...projectWarnings(reports));
    return {
      warnings,
      exitCode: definitionsDiffer || reports.some((report) => report.state === "unfinished") || wouldRefuse !== null ? 1 : 0,
      data: { dry_run: dryRun, dirty: dryRun ? status !== null && status.entries.length > 0 : undefined, version, files: changes.map(({ path, action }) => ({ path, action })), unchanged, converted: concepts.converted,
        skills: { from, to: { name: manifest!.name, version: manifest!.version }, retired, previous_cli: previousCli, competing },
        lint: { errors: lint.filter((x) => x.severity === "error").length, warnings: lint.filter((x) => x.severity === "warning").length }, notion_migrations: migrations, commit, pushed,
        uncommitted, would_refuse: dryRun ? wouldRefuse : undefined,
        projects: reports, next: nextLines(reports) },
      human: [
        `${written.length} files ${dryRun ? "would change" : "changed"}, ${unchanged} unchanged`,
        ...(wouldRefuse !== null ? [`The upgrade would stop before writing: ${refusalText(wouldRefuse, operation, uncommitted)}`] : []),
        ...(wouldRefuse === null && uncommitted !== null && uncommitted.unrelated.length > 0 ? [leftAsTheyWere(uncommitted.unrelated.length)] : []),
        `${notionMigrationsLine(product.root, migrations)}\n${projectsHuman(reports)}`,
      ].join("\n"),
    };
  },
};

/** Apply the planned changes; when one fails, restore every file already replaced or removed and delete the created ones (cli.md §3.6). */
async function writeChanges(root: string, written: readonly Change[]): Promise<Written[]> {
  const done: Array<{ change: Change; before: Buffer | null }> = [];
  try {
    for (const change of written) {
      const before = change.action === "created" ? null : await readOptionalBuffer(join(root, change.path));
      if (change.action === "removed") await unlink(join(root, change.path));
      else {
        await ensureDirectory(root, dirname(change.path));
        await atomicWriteFile(root, change.path, change.content!);
      }
      done.push({ change, before });
    }
    return done.map(({ change, before }) => ({ path: change.path, before, after: change.action === "removed" ? null : Buffer.from(change.content!) }));
  } catch (error) {
    for (const { change, before } of done.reverse()) {
      if (before === null) await unlink(join(root, change.path)).catch(() => undefined);
      else {
        await ensureDirectory(root, dirname(change.path)).catch(() => undefined);
        await atomicWriteFile(root, change.path, before).catch(() => undefined);
      }
    }
    throw error;
  }
}

/** Remove the empty folders under `folder` (and `folder` itself when `self`): an emptied or unlisted folder is not part of a skill. */
async function pruneEmpty(folder: string, self: boolean): Promise<void> {
  let entries;
  try { entries = await readdir(folder, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) if (entry.isDirectory()) await pruneEmpty(join(folder, entry.name), true);
  if (self) await rmdir(folder).catch(() => undefined);
}

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

async function parses(path: string): Promise<boolean> {
  try { JSON.parse((await readOptional(path)) ?? ""); return true; } catch { return false; }
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

/**
 * Item 8: undo the upgrade's writes after Git refused its commit. A file still holding what the upgrade wrote gets its bytes from before
 * (a created one is deleted), then the folders the writes created go when empty. Returns the files someone changed since, left as they are.
 */
async function undoWrites(root: string, done: readonly Written[], folders: readonly string[]): Promise<string[]> {
  const left: string[] = [];
  for (const { path, before, after } of [...done].reverse()) {
    const now = await readOptionalBuffer(join(root, path));
    const ours = after === null ? now === null && !(await exists(join(root, path))) : now !== null && now.equals(after);
    if (!ours) { left.push(path); continue; }
    if (before === null) await unlink(join(root, path)).catch(() => undefined);
    else {
      await ensureDirectory(root, dirname(path));
      await atomicWriteFile(root, path, before);
    }
  }
  for (const folder of [...folders].sort((a, b) => b.length - a.length)) await rmdir(join(root, folder)).catch(() => undefined);
  return left.sort(compare);
}

/** Steps 1 to 1b: AGENTS.md with the template's rules block, the style block and the structure block (undefined text when it is skipped). */
function planAgents(current: string | null, template: string, config: Record<string, unknown>, readable: boolean, notes: readonly Note[], suppressions: Loaded) {
  const own = current === null ? undefined : rulesBlock(current);
  const rules = current === null ? template : own === undefined ? undefined : current.replace(own, () => rulesBlock(template)!);
  const styled = rules === undefined ? undefined : readable ? withStyleBlock(rules, styleLines(config)) : { text: rules };
  const structure = styled === undefined || !readable
    ? undefined
    : planStructureText(styled.text, structureBlock(indexNotes(notes, suppressions), config));
  return { rules, styled, structure, text: styled === undefined ? undefined : structure?.after ?? styled.text };
}

/** Item 3: the files the upgrade changes, the monthly log, the folders its writes create and both endpoints of a moved concept. */
function footprintOf(root: string, written: readonly Change[], log: string | null, converted: ReadonlyArray<{ from: string; to: string }>): Footprint {
  const files: Footprint["files"] = new Map(written.map((change) => [change.path, change.action as "created" | "updated" | "removed"]));
  if (log !== null) files.set(log, "log");
  const folders = new Set<string>();
  for (const [path, action] of files) {
    if (action === "removed") continue;
    const parts = path.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      const folder = parts.slice(0, index).join("/");
      if (!existsSync(join(root, folder))) folders.add(folder);
    }
  }
  return { files, folders, moved: new Set(converted.flatMap(({ from, to }) => [from, to])), log };
}

/** A note path as `scanNotes` reads it: a `.md` file in a note folder, no part of its path hidden. */
function isNotePath(path: string): boolean {
  const parts = path.split("/");
  return path.endsWith(".md") && (NOTE_FOLDERS as readonly string[]).includes(parts[0]!) && parts.length > 1 && parts.every((part) => !part.startsWith("."));
}

/** `notes` with the note at `path` read from `text` instead (absent when null or not a note). */
function withNote(notes: readonly Note[], path: string, text: string | null): Note[] {
  const others = notes.filter((note) => note.path !== path);
  const parsed = text === null ? null : parseNote(path, text);
  if (parsed !== null && !("code" in parsed)) others.push(parsed);
  return others.sort((a, b) => compareCodePoints(a.path, b.path));
}

function configOf(text: string | null): Record<string, unknown> {
  try {
    const value = JSON.parse(text ?? "") as unknown;
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function parsesText(text: string): boolean {
  try { JSON.parse(text); return true; } catch { return false; }
}

/** The first uncommitted path whose status entry changed between two reads, or null. */
function firstStatusChange(before: StatusRead, after: StatusRead): string | null {
  const paths = [...new Set([...before.raw.keys(), ...after.raw.keys()])].sort(compare);
  return paths.find((path) => before.raw.get(path) !== after.raw.get(path)) ?? null;
}

/** A dry run's reason for the refusal the real run would make (spec/cli.md §5.15, Uncommitted work item 5). */
function refusalText(code: ErrorCode, operation: string | null, uncommitted: UncommittedReport | null): string {
  if (code === "BRAIN_DIRTY" && uncommitted !== null) return conflictLines(uncommitted).join("\n");
  if (code === "GIT_IDENTITY_MISSING") return IDENTITY_MESSAGE;
  return gitOperationMessage(operation ?? "conflicts");
}

/** Rename `old` to `key` in place; when `key` already holds an id, just drop `old` (spec/cli.md §5.15 step 5). */
function renameKey(values: Record<string, unknown>, old: string, key: string): Record<string, unknown> {
  const value = typeof values[key] === "string" && values[key] !== "" ? values[key] : values[old];
  const next: Record<string, unknown> = {};
  for (const [name, existing] of Object.entries(values)) {
    if (name === old) next[key] = value;
    else if (name !== key) next[name] = existing;
  }
  return next;
}

/** The first pin's `previous_cli` (skills-delivery §7, CC-129): the version in the newest `upgrade: ultimate brain <version>` commit other than the running one, or null. */
async function lastUpgradeCli(root: string, running: string): Promise<string | null> {
  try {
    const { stdout } = await exec("git", ["log", "--format=%s"], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
    for (const subject of stdout.split("\n")) {
      const match = /^upgrade: ultimate brain (\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:, skills .*)?$/.exec(subject);
      if (match !== null && match[1] !== running) return match[1];
    }
  } catch { /* not a Git repo, or no commits: null */ }
  return null;
}
