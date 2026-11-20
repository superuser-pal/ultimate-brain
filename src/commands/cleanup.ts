import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { schemaProblems } from "../lib/assistant-dismissals.ts";
import { applyAll } from "../lib/apply.ts";
import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { assertNoProblems, isRecord, readJsonInput } from "../lib/input.ts";
import { assertCleanTree, commitJournaled } from "../lib/journal.ts";
import type { LogEntry } from "../lib/log.ts";
import type { NotionWrite } from "../lib/notion-change.ts";
import { stageProposals } from "../lib/proposals.ts";
import { loadSchemas } from "../lib/schemas.ts";
import { requireSuppressions } from "../lib/suppressions.ts";
import { formatTimestamp } from "../lib/time.ts";
import { cleanupAuto, findTidyItems, type TidyItem } from "../lib/tidy.ts";
import { localDate, readState } from "../lib/weekly-state.ts";
import { Workspace } from "../lib/workspace.ts";

// `brain cleanup plan | apply | undo | ticks` (spec/cli.md §5.38; spec/weekly-review.md §15).

const exec = promisify(execFile);
const MAX_ITEMS = 20;
const NOTION_KINDS = new Set(["notion_change", "new_task"]);

async function git(root: string, args: string[]): Promise<string> {
  return (await exec("git", args, { cwd: root, maxBuffer: 64 * 1024 * 1024 })).stdout;
}

const sha256 = (text: string): string => `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
const logPath = (path: string): boolean => /^log\/\d{4}-\d{2}\.md$/.test(path);

/** `brain cleanup plan [--now <ts>]`: the mechanical items now, written nowhere (cli.md §5.38). */
export const cleanupPlanCommand: Command = {
  name: "cleanup plan",
  usage: "brain cleanup plan [--now <ts>] [--json]",
  summary: "List the weekly clean-up's mechanical items: what it would fix alone, in order. Writes nothing.",
  options: {},
  maxPositionals: 0,
  needsBrain: true,
  async run({ brain, now }) {
    const workspace = await Workspace.open(brain!);
    const plan = await findTidyItems(brain!.root, workspace.notes, requireSuppressions(brain!.root), now, localDate(now));
    const lines = plan.items.map((item) => `${item.tidy}  ${item.title}`);
    return { data: plan, human: `${lines.length === 0 ? "Nothing to clean up." : lines.join("\n")}${plan.held > 0 ? `\n${plan.held} held (undone or declined before)` : ""}\n` };
  },
};

interface Applied { proposal: string; tidy: string; title: string; commit: string }

/** Apply one item in its own journaled commit; the result, or why it failed or waits. */
async function applyItem(root: string, brain: NonNullable<Parameters<Command["run"]>[0]["brain"]>, item: TidyItem, now: Date, touched: Set<string>): Promise<Applied | { deferred: true } | { title: string; reason: string }> {
  if (item.paths.some((path) => touched.has(path))) return { deferred: true };
  const workspace = await Workspace.open(brain);
  // A pending proposal of the same item (queued, or written while auto was off) is the one applied: never a second question.
  let id = workspace.notes.find((note) => note.type === "proposal" && note.attributes.fingerprint === item.fingerprint && note.attributes.status === "pending")?.id;
  if (id === undefined) {
    const staged = stageProposals(workspace, [item.proposal_input], now);
    if (staged.created.length !== 1) return { title: item.title, reason: staged.skipped[0]?.reason ?? "NOT_WRITTEN" };
    id = staged.created[0]!.id;
  }
  const result = applyAll(workspace, { decisions: [{ proposal: id, action: "approve", decided_at: formatTimestamp(now), decided_by: "cleanup" }] }, { now, recordOnly: false });
  const decision = result.decisions[0]!;
  if (decision.result !== "applied") return { title: item.title, reason: decision.reason ?? decision.result.toUpperCase() };
  const written = workspace.changedPaths;
  const proposalPath = workspace.get(id)!.path;
  if (written.some((path) => path !== proposalPath && touched.has(path))) return { deferred: true };
  const title = String(workspace.get(id)!.attributes.title ?? item.title);
  await commitJournaled(root, workspace, [{ op: "tidy", id, title, pairs: [["tidy", item.tidy]] }], now, `Clean-up: ${title}`, { trailers: [`Cleanup: ${id}`] });
  for (const path of written) if (path !== proposalPath) touched.add(path);
  return { proposal: id, tidy: item.tidy, title, commit: (await git(root, ["rev-parse", "HEAD"])).trim() };
}

/** `brain cleanup apply [--max <n>] [--now <ts>]`: each mechanical item alone, in its own commit (cli.md §5.38). */
export const cleanupApplyCommand: Command = {
  name: "cleanup apply",
  usage: "brain cleanup apply [--max <n>] [--now <ts>] [--json]",
  summary: "Apply the weekly clean-up's mechanical items alone, each in its own commit with its undo (at most 20 a run).",
  options: { max: "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const root = brain!.root;
    const raw = args.options.max as string | undefined;
    const max = raw === undefined ? MAX_ITEMS : Number(raw);
    if (!Number.isInteger(max) || max < 1 || max > MAX_ITEMS) throw new BrainError("USAGE", `--max must be a whole number from 1 to ${MAX_ITEMS}`);
    if (!cleanupAuto(brain!.config)) throw new BrainError("CLEANUP_OFF", "settings.cleanup.auto is off: nothing is applied alone; the weekly run offers these items to tick instead");
    await assertCleanTree(root);
    const workspace = await Workspace.open(brain!);
    const plan = await findTidyItems(root, workspace.notes, requireSuppressions(root), now, localDate(now));
    const applied: Applied[] = [];
    const failed: Array<{ title: string; reason: string }> = [];
    const touched = new Set<string>();
    let deferred = 0;
    for (const item of plan.items.slice(0, max)) {
      try {
        const outcome = await applyItem(root, brain!, item, now, touched);
        if ("deferred" in outcome) deferred += 1;
        else if ("commit" in outcome) applied.push(outcome);
        else failed.push(outcome);
      } catch (error) {
        failed.push({ title: item.title, reason: error instanceof BrainError ? error.code : "INTERNAL" });
      }
    }
    const left = Math.max(0, plan.items.length - max);
    const human = [...applied.map((item) => `cleaned  ${item.title}`), ...failed.map((item) => `failed   ${item.title} (${item.reason})`)];
    return {
      data: { applied, failed, deferred, left },
      exitCode: failed.length > 0 ? 1 : 0,
      human: `${human.length === 0 ? "Nothing to clean up." : human.join("\n")}${deferred + left > 0 ? `\n${deferred + left} wait for next week` : ""}\n`,
    };
  },
};

interface Restoring { proposal: Record<string, unknown> & { id: string }; path: string; title: string; restored: Array<{ path: string; content: string | null }>; changed: string[] }

/** What an undo restores (weekly-review.md §15.3): each path the item's commit wrote, but its proposal and the log, back to the parent. */
async function undoPlan(root: string, workspace: Workspace, id: string): Promise<Restoring> {
  const note = workspace.get(id);
  if (note === undefined || note.type !== "proposal") throw new BrainError("UNKNOWN_ID", `No proposal with id ${id}`);
  const a = note.attributes;
  const decision = isRecord(a.decision) ? a.decision : {};
  if (a.status === "closed" && a.closed_reason === "undone") throw new BrainError("ALREADY_UNDONE", `${id} was undone already`);
  if (a.status !== "applied" || decision.decided_by !== "cleanup") throw new BrainError("NOT_A_CLEANUP", `${id} is not a clean-up item the weekly run applied alone`);
  const commit = (await git(root, ["log", "--format=%H", `--grep=^Cleanup: ${id}$`])).trim().split("\n")[0] ?? "";
  if (commit === "") throw new BrainError("NOT_A_CLEANUP", `No commit carries the trailer Cleanup: ${id}`);
  const status = (await git(root, ["diff-tree", "--no-commit-id", "--name-status", "-r", "--relative", "--root", commit])).split("\n").filter((line) => line !== "");
  const restored: Restoring["restored"] = [];
  const changed: string[] = [];
  for (const line of status) {
    const [code, path] = line.split("\t") as [string, string];
    if (path === note.path || logPath(path)) continue;
    const then = code.startsWith("D") ? null : await git(root, ["show", `${commit}:./${path}`]);
    const staged = workspace.stagedContent(path);
    const now = staged !== undefined ? staged : existsSync(join(root, path)) ? await readFile(join(root, path), "utf8") : null;
    if (now !== then) { changed.push(path); continue; }
    restored.push({ path, content: code.startsWith("A") ? null : await git(root, ["show", `${commit}^:./${path}`]) });
  }
  return { proposal: { ...a, id }, path: note.path, title: String(a.title ?? id), restored, changed };
}

/** Stage an undo into a workspace: the restored files and the proposal closed `undone`. Returns the paths to remove after the write. */
function stageUndo(workspace: Workspace, plan: Restoring, now: Date): string[] {
  const remove: string[] = [];
  for (const { path, content } of plan.restored) {
    if (content === null) remove.push(path);
    else workspace.writeText(path, content);
  }
  const document = workspace.edit(workspace.get(plan.proposal.id)!);
  document.attributes.status = "closed";
  document.attributes.closed_reason = "undone";
  document.attributes.undone_at = formatTimestamp(now);
  workspace.save(plan.path, document);
  return remove;
}

const staleError = (id: string, changed: string[]): BrainError => new BrainError("UNDO_STALE", `${id} can't be undone alone: ${changed.join(", ")} changed since the clean-up`, changed.map((path) => ({ path, message: "changed since the clean-up" })));

/** `brain cleanup undo <proposal> [--now <ts>]` (cli.md §5.38, weekly-review.md §15.3). */
export const cleanupUndoCommand: Command = {
  name: "cleanup undo",
  usage: "brain cleanup undo <proposal> [--now <ts>] [--json]",
  summary: "Undo one clean-up item the weekly run applied alone: its files back as they were, in one commit.",
  options: {},
  maxPositionals: 1,
  needsBrain: true,
  async run({ args, brain, now }) {
    const root = brain!.root;
    const id = args.positionals[0];
    if (id === undefined) throw new BrainError("USAGE", "brain cleanup undo needs a proposal id");
    const workspace = await Workspace.open(brain!);
    const plan = await undoPlan(root, workspace, id);
    if (plan.changed.length > 0) throw staleError(id, plan.changed);
    await assertCleanTree(root);
    const remove = stageUndo(workspace, plan, now);
    const log: LogEntry[] = [{ op: "tidy-undo", id, title: plan.title, pairs: [["restored", plan.restored.length]] }];
    await commitJournaled(root, workspace, log, now, `Undo clean-up: ${plan.title}`, { trailers: [`Cleanup-undo: ${id}`], remove });
    const commit = (await git(root, ["rev-parse", "HEAD"])).trim();
    return { data: { proposal: id, restored: plan.restored.map((entry) => entry.path), commit }, human: `Undone: ${plan.title} (${plan.restored.length} file${plan.restored.length === 1 ? "" : "s"} restored)\n` };
  },
};

type TickResult = "applied" | "declined" | "open" | "stale" | "waiting" | "ask" | "undone" | "kept" | "already" | "skipped" | "failed";
interface TickItem { label: string; ticked: boolean; note: string }
interface Outcome { label: string; proposal: string | null; result: TickResult; reason?: string; note?: string }

const labelOrder = (label: string): [number, number] => ["A", "C", "U"].indexOf(label[0]!) === -1 ? [3, 0] : [["A", "C", "U"].indexOf(label[0]!), Number(label.slice(1))];

/** `brain cleanup ticks --input <file|-> [--attended] [--now <ts>]`: what the user ticked in a Ready Weekly row (cli.md §5.38, weekly-review.md §15.4). */
export const cleanupTicksCommand: Command = {
  name: "cleanup ticks",
  usage: "brain cleanup ticks --input <file|-> [--attended] [--now <ts>] [--json]",
  summary: "Apply the ticks of a Ready Weekly row: ticked items after a stale check, undos, unticked ones declined when nothing else waits.",
  options: { input: "string", attended: "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const root = brain!.root;
    const attended = args.options.attended === true;
    const input = await readJsonInput(args.options.input as string | undefined, "cleanup ticks");
    const validate = loadSchemas().weekly("ticksInput");
    if (!validate(input)) assertNoProblems(schemaProblems(validate.errors));
    const { week, page, read_at: readAt, items } = input as { week: string; page: string; read_at: string; items: TickItem[] };
    const state = readState(root);
    const entry = state?.weeks[week];
    if (entry === undefined || entry.row === undefined) assertNoProblems([{ pointer: "/week", message: `no Weekly row was written for ${week}` }]);
    const row = entry!.row!;
    const workspace = await Workspace.open(brain!);
    const report = workspace.get(entry!.report);
    if (report === undefined || report.attributes.notion !== page) assertNoProblems([{ pointer: "/page", message: `is not the Notion page of the week's row${report?.attributes.notion === undefined ? " (the report isn't published)" : ""}` }]);
    const seen = new Set<string>();
    for (const [index, item] of items.entries()) {
      if (seen.has(item.label)) assertNoProblems([{ pointer: `/items/${index}/label`, message: `${item.label} is given twice` }]);
      seen.add(item.label);
    }
    const settings = isRecord(brain!.config.settings) ? brain!.config.settings : {};
    const publishAuto = settings.publish === "auto";
    const decidedAt = formatTimestamp(new Date(readAt));
    const results: Outcome[] = [];
    const writes: NotionWrite[] = [];
    const remove: string[] = [];
    const unticked: TickItem[] = [];
    const sorted = [...items].sort((a, b) => { const [x, y] = [labelOrder(a.label), labelOrder(b.label)]; return x[0] - y[0] || x[1] - y[1]; });
    const decide = (id: string, action: "approve" | "reject", note?: string) => applyAll(workspace, { decisions: [{ proposal: id, action, decided_at: decidedAt, decided_by: "tick", ...(note === undefined ? {} : { note }) }] }, { now, recordOnly: false });
    for (const item of sorted) {
      const slot = row[item.label];
      if (slot === undefined) { results.push({ label: item.label, proposal: null, result: "skipped", reason: "UNKNOWN_LABEL" }); continue; }
      const proposal = workspace.get(slot.proposal);
      if (proposal === undefined || proposal.type !== "proposal") { results.push({ label: item.label, proposal: slot.proposal, result: "failed", reason: "UNKNOWN_ID" }); continue; }
      const a = proposal.attributes;
      const base = { label: item.label, proposal: proposal.id };
      if (item.label.startsWith("U")) {
        if (a.status === "closed" && a.closed_reason === "undone") { results.push({ ...base, result: "already" }); continue; }
        if (!item.ticked) { results.push({ ...base, result: "kept" }); continue; }
        try {
          const plan = await undoPlan(root, workspace, proposal.id);
          if (plan.changed.length > 0) { results.push({ ...base, result: "stale", reason: "UNDO_STALE", note: plan.changed.join(", ") }); continue; }
          remove.push(...stageUndo(workspace, plan, now));
          results.push({ ...base, result: "undone" });
        } catch (error) {
          results.push({ ...base, result: "failed", reason: error instanceof BrainError ? error.code : "INTERNAL" });
        }
        continue;
      }
      if (a.status !== "pending" || (typeof a.weekly === "string" && a.weekly !== week)) { results.push({ ...base, result: "already", ...(a.status === "pending" ? { reason: "MOVED" } : {}) }); continue; }
      if (item.note !== "") { results.push({ ...base, result: attended ? "ask" : "waiting", note: item.note }); continue; }
      if (!item.ticked) { unticked.push(item); continue; }
      // The stale check (§15.4): every file the change would write is as it was when the row was written.
      const changed: string[] = [];
      for (const { path, hash } of slot.base) {
        const staged = workspace.stagedContent(path);
        const current = staged !== undefined ? staged : existsSync(join(root, path)) ? await readFile(join(root, path), "utf8") : null;
        if (current === null || sha256(current) !== hash) changed.push(path);
      }
      if (changed.length > 0) {
        const document = workspace.edit(proposal);
        document.attributes.status = "closed";
        document.attributes.closed_reason = "stale";
        document.attributes.decision = { action: "approve", decided_at: decidedAt, decided_by: "tick" };
        workspace.save(proposal.path, document);
        results.push({ ...base, result: "stale", reason: "STALE_PROPOSAL", note: changed.join(", ") });
        continue;
      }
      if (NOTION_KINDS.has(String(a.kind)) && !publishAuto && !attended) { results.push({ ...base, result: "waiting", reason: "PUBLISH_ASK" }); continue; }
      const applied = decide(proposal.id, "approve");
      writes.push(...applied.notion_writes);
      const outcome = applied.decisions[0]!;
      if (outcome.result === "applied" || outcome.result === "awaiting_notion") results.push({ ...base, result: "applied" });
      else if (outcome.result === "closed") results.push({ ...base, result: "stale", ...(outcome.reason === undefined ? {} : { reason: outcome.reason }) });
      else results.push({ ...base, result: "failed", reason: outcome.reason ?? outcome.result.toUpperCase() });
    }
    const holding = results.some((result) => result.result === "waiting" || result.result === "ask");
    for (const item of unticked) {
      const slot = row[item.label]!;
      if (holding) { results.push({ label: item.label, proposal: slot.proposal, result: "open" }); continue; }
      const outcome = decide(slot.proposal, "reject", "unticked when the row was set Ready").decisions[0]!;
      results.push({ label: item.label, proposal: slot.proposal, result: outcome.result === "applied" ? "declined" : "failed", ...(outcome.result === "applied" ? {} : { reason: outcome.reason ?? outcome.result.toUpperCase() }) });
    }
    results.sort((a, b) => { const [x, y] = [labelOrder(a.label), labelOrder(b.label)]; return x[0] - y[0] || x[1] - y[1] || a.label.localeCompare(b.label); });
    // Done (§15.4): every A and C item of the row decided, closed or moved, and nothing left waiting, asked or open.
    const done = !results.some((result) => ["waiting", "ask", "open", "failed"].includes(result.result)) && Object.entries(row).filter(([label]) => !label.startsWith("U")).every(([, slot]) => {
      const a = workspace.get(slot.proposal)?.attributes;
      return a === undefined || a.status !== "pending" || (typeof a.weekly === "string" && a.weekly !== week);
    });
    const count = (result: TickResult) => results.filter((entry) => entry.result === result).length;
    const log: LogEntry[] = [{ op: "weekly-ticks", id: "-", title: "", pairs: [["week", week], ["applied", count("applied")], ["declined", count("declined")], ["open", count("open")], ["stale", count("stale")], ["waiting", count("waiting")], ["undone", count("undone")], ["skipped", count("skipped")]] }];
    await workspace.commit(log, now);
    for (const path of remove) await rm(join(root, path), { force: true });
    return {
      data: { week, results, notion_writes: writes, done },
      exitCode: results.some((result) => result.result === "failed") ? 1 : 0,
      human: `${results.map((result) => `${result.label} ${result.result}${result.reason === undefined ? "" : ` (${result.reason})`}`).join("\n")}${done ? "\nThe row is done." : ""}\n`,
    };
  },
};

export const CLEANUP_COMMANDS = [cleanupPlanCommand, cleanupApplyCommand, cleanupUndoCommand, cleanupTicksCommand];
