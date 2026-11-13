import { readJsonInput } from "../lib/input.ts";
import { applyPlan, buildPlan, parsePlan, parseSnapshot, record, render, renderTasks, unpublishDrafts } from "../lib/sync.ts";
import type { RenderItem } from "../lib/sync.ts";
import type { Command } from "../lib/command.ts";
import { Workspace } from "../lib/workspace.ts";
import { commitJournaled } from "../lib/journal.ts";
import { modulesOf } from "../lib/modules.ts";
import { BrainError } from "../lib/errors.ts";
import { lintWarnings } from "../lib/warnings.ts";

export const syncPlanCommand: Command = {
  name: "sync plan", usage: "brain sync plan --input <snapshot|-> [--json]", summary: "Compare a Notion snapshot with the brain without writing.", options: { input: "string" }, maxPositionals: 0, needsBrain: true,
  async run({ args, brain }) { const input = args.options.input as string | undefined; if (input === undefined) throw new BrainError("USAGE", "sync plan needs --input"); const workspace = await Workspace.open(brain!); const plan = buildPlan(workspace, parseSnapshot(await readJsonInput(input, "sync plan"))); return { data: plan, human: `${plan.create.length} creates, ${plan.updates.length} updates, ${plan.corrections.length} corrections\n` }; },
};

/** Whether a Review decision changed anything: those writes (the target and the proposal file) are one journaled operation (capture-and-review §7.11). */
const writesReview = (data: Record<string, unknown>): boolean => (data.review_results as Array<{ result: string }>).some((entry) => ["applied", "closed", "deferred"].includes(entry.result)) || (data.revision_results as Array<{ result: string }>).some((entry) => entry.result === "recorded");

export const syncApplyCommand: Command = {
  name: "sync apply", usage: "brain sync apply --input <plan|-> [--record-only] [--skip-conflicted] [--dry-run] [--json]", summary: "Apply a sync plan using atomic per-item writes.", options: { input: "string", "record-only": "boolean", "skip-conflicted": "boolean", "dry-run": "boolean" }, maxPositionals: 0, needsBrain: true,
  async run({ args, brain, now }) { const input = args.options.input as string | undefined; if (input === undefined) throw new BrainError("USAGE", "sync apply needs --input"); const workspace = await Workspace.open(brain!); const data = applyPlan(workspace, parsePlan(await readJsonInput(input, "sync apply")), now, args.options["record-only"] === true, args.options["skip-conflicted"] === true); const warnings = lintWarnings(workspace.warnings()); const dryRun = args.options["dry-run"] === true; let op: string | undefined; if (!dryRun) { if (writesReview(data) && workspace.changedPaths.length > 0) op = await commitJournaled(brain!.root, workspace, data.log as [], now, "sync apply: review decisions"); else await workspace.commit(data.log as [], now); } const { log: _log, ...output } = data; const failed = Number((data.summary as Record<string, unknown>).failed ?? 0); return { data: { dry_run: dryRun, ...(op === undefined ? {} : { op }), ...output }, warnings, exitCode: failed > 0 ? 1 : 0, human: `${failed} failed items\n` }; },
};

export const syncRenderCommand: Command = {
  name: "sync render", usage: "brain sync render (--changed | --ids <id>[,<id>…]) [--plan <plan.json> [--skip-conflicted]] | --unpublish-drafts [--json]", summary: "Render Notion payloads without writing.", options: { changed: "boolean", ids: "string", plan: "string", "skip-conflicted": "boolean", "unpublish-drafts": "boolean" }, maxPositionals: 0, needsBrain: true,
  async run({ args, brain, now }) {
    const changed = args.options.changed === true; const idsText = args.options.ids as string | undefined;
    // The Draft pages from before 0.9.1, moved to the trash after a yes (cli §5.14.4, migration 0020).
    if (args.options["unpublish-drafts"] === true) {
      if (changed || idsText !== undefined || args.options.plan !== undefined || args.options["skip-conflicted"] === true) throw new BrainError("USAGE", "--unpublish-drafts runs alone");
      const items = unpublishDrafts(await Workspace.open(brain!), now);
      return { data: { items, errors: [], skipped: [] }, human: `${items.length} Draft pages to move to the trash\n` };
    }
    if (changed === (idsText !== undefined)) throw new BrainError("USAGE", "provide exactly one of --changed or --ids");
    const workspace = await Workspace.open(brain!); const ids = idsText === undefined ? undefined : idsText.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids !== undefined) for (const id of ids) if (workspace.get(id) === undefined) throw new BrainError("UNKNOWN_ID", `No note with id ${id}`);
    const held = new Map<string, Set<string>>(); const planPath = args.options.plan as string | undefined; const skipConflicted = args.options["skip-conflicted"] === true;
    if (skipConflicted && planPath === undefined) throw new BrainError("USAGE", "--skip-conflicted needs --plan");
    const plan = planPath === undefined ? undefined : parsePlan(await readJsonInput(planPath, "sync render"));
    if (plan !== undefined) for (const item of plan.conflicts) if (item.code === "BOTH_CHANGED" && typeof item.brain_id === "string" && typeof item.property === "string") { const set = held.get(item.brain_id) ?? new Set<string>(); set.add(item.property); held.set(item.brain_id, set); }
    const data = render(workspace, now, ids, held);
    // --skip-conflicted (cli §5.14.4, 0051): a conflicted row, and a report with a What to fix nobody has read, are held back whole.
    const withheld = new Map<string, string>(); const conflictedPages = new Set<string>();
    if (skipConflicted && plan !== undefined) {
      for (const item of plan.conflicts) { if (typeof item.brain_id === "string") withheld.set(item.brain_id, "ROW_CONFLICTED"); conflictedPages.add(String(item.page_id)); }
      for (const item of plan.report_fixes) if (!withheld.has(item.report)) withheld.set(item.report, "FIX_WAITING");
    }
    // A note whose Notion text is unresolved is never overwritten (cli §5.14.7, 0054): a pending proposal, an unaccepted draft, or accepted wording not yet imported.
    // Only its body waits when every row naming it says the page is not accepted (#221); an accepted page gets no write at all, since any write would make the acceptance look stale.
    const bodyOnly = new Set<string>();
    if (plan !== undefined) {
      const rows = [...plan.wording_waiting, ...plan.wording_held, ...plan.accepted_wording];
      for (const item of rows) if (!withheld.has(item.note)) { withheld.set(item.note, "WORDING_PENDING"); bodyOnly.add(item.note); }
      for (const item of rows) if (!("accepted" in item) || item.accepted !== false) bodyOnly.delete(item.note);
    }
    // A Review row with edits or decisions in Notion is never rewritten (capture-and-review §7.10).
    if (plan !== undefined) for (const item of plan.review_pending) if (!withheld.has(item.proposal)) withheld.set(item.proposal, "REVIEW_PENDING");
    const skipped: Array<{ id: string; reason: string }> = [...data.skipped]; const items = data.items.filter((item) => {
      const reason = withheld.get(item.id) ?? (item.page_id !== null && conflictedPages.has(item.page_id) ? "ROW_CONFLICTED" : undefined);
      if (reason === undefined) return true; skipped.push({ id: item.id, reason });
      if (!bodyOnly.has(item.id) || item.action !== "update") return false;
      holdBody(item); return Object.keys(item.properties).some((name) => name !== "Last Synced");
    });
    return { data: { items, errors: data.errors, skipped }, warnings: data.warnings, exitCode: data.errors.length > 0 ? 1 : 0, human: `${items.length} payloads\n` };
  },
};

/** A held note's update without its body (cli §5.14.7, #221): no body, no Refresh asked, and the body baselines in S left as they were. */
function holdBody(item: RenderItem): void {
  item.body = null; item.sections = null;
  delete item.properties["Refresh asked"];
  delete item.published["@content"]; delete item.published["@git_body"];
}

export const syncTasksCommand: Command = {
  name: "sync tasks", usage: "brain sync tasks (--meeting <mtg-id> | --source <src-id> | --direct) --input <file|-> [--json]", summary: "Render task payloads for a meeting's or source's action items, or for tasks said yes to in a chat (--direct).", options: { meeting: "string", source: "string", direct: "boolean", input: "string" }, maxPositionals: 0, needsBrain: true,
  async run({ args, brain }) {
    const meeting = args.options.meeting as string | undefined; const source = args.options.source as string | undefined; const direct = args.options.direct === true; const input = args.options.input as string | undefined;
    if ([meeting !== undefined, source !== undefined, direct].filter(Boolean).length !== 1 || input === undefined) throw new BrainError("USAGE", "sync tasks needs exactly one of --meeting, --source or --direct, and --input");
    if (!modulesOf(brain!.config).tasks) throw new BrainError("MODULE_OFF", "The Tasks module is off: brain modules on tasks");
    return { data: renderTasks(await Workspace.open(brain!), direct ? undefined : meeting ?? source!, await readJsonInput(input, "sync tasks")), human: "Task payloads rendered.\n" };
  },
};

export const syncRecordCommand: Command = {
  name: "sync record", usage: "brain sync record --input <file|-> [--dry-run] [--json]", summary: "Record successful Notion publication results.", options: { input: "string", "dry-run": "boolean" }, maxPositionals: 0, needsBrain: true,
  async run({ args, brain, now }) { const input = args.options.input as string | undefined; if (input === undefined) throw new BrainError("USAGE", "sync record needs --input"); const workspace = await Workspace.open(brain!); const data = record(workspace, await readJsonInput(input, "sync record")); const records = data.records as Array<Record<string, unknown>>; const dryRun = args.options["dry-run"] === true; if (!dryRun) await workspace.commit([], now); const failed = records.filter((item) => item.result === "failed").length; return { data: { dry_run: dryRun, records }, warnings: data.warnings, exitCode: failed > 0 ? 1 : 0, human: `${records.length} records\n` }; },
};
