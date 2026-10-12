import { readJsonInput } from "../lib/input.ts";
import { applyPlan, buildPlan, parsePlan, parseSnapshot, record, render, renderTasks } from "../lib/sync.ts";
import type { Command } from "../lib/command.ts";
import { Workspace } from "../lib/workspace.ts";
import { BrainError } from "../lib/errors.ts";
import { lintWarnings } from "../lib/warnings.ts";

export const syncPlanCommand: Command = {
  name: "sync plan", usage: "brain sync plan --input <snapshot|-> [--json]", summary: "Compare a Notion snapshot with the brain without writing.", options: { input: "string" }, maxPositionals: 0, needsBrain: true,
  async run({ args, brain }) { const input = args.options.input as string | undefined; if (input === undefined) throw new BrainError("USAGE", "sync plan needs --input"); const workspace = await Workspace.open(brain!); const plan = buildPlan(workspace, parseSnapshot(await readJsonInput(input, "sync plan"))); return { data: plan, human: `${plan.create.length} creates, ${plan.updates.length} updates, ${plan.corrections.length} corrections\n` }; },
};

export const syncApplyCommand: Command = {
  name: "sync apply", usage: "brain sync apply --input <plan|-> [--record-only] [--dry-run] [--json]", summary: "Apply a sync plan using atomic per-item writes.", options: { input: "string", "record-only": "boolean", "dry-run": "boolean" }, maxPositionals: 0, needsBrain: true,
  async run({ args, brain, now }) { const input = args.options.input as string | undefined; if (input === undefined) throw new BrainError("USAGE", "sync apply needs --input"); const workspace = await Workspace.open(brain!); const data = applyPlan(workspace, parsePlan(await readJsonInput(input, "sync apply")), now, args.options["record-only"] === true); const dryRun = args.options["dry-run"] === true; if (!dryRun) await workspace.commit(data.log as [], now); const { log: _log, ...output } = data; const failed = Number((data.summary as Record<string, unknown>).failed ?? 0); return { data: { dry_run: dryRun, ...output }, warnings: lintWarnings(workspace.warnings()), exitCode: failed > 0 ? 1 : 0, human: `${failed} failed items\n` }; },
};

export const syncRenderCommand: Command = {
  name: "sync render", usage: "brain sync render (--changed | --ids <id>[,<id>…]) [--plan <plan.json>] [--json]", summary: "Render Notion payloads without writing.", options: { changed: "boolean", ids: "string", plan: "string" }, maxPositionals: 0, needsBrain: true,
  async run({ args, brain, now }) {
    const changed = args.options.changed === true; const idsText = args.options.ids as string | undefined;
    if (changed === (idsText !== undefined)) throw new BrainError("USAGE", "provide exactly one of --changed or --ids");
    const workspace = await Workspace.open(brain!); const ids = idsText === undefined ? undefined : idsText.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids !== undefined) for (const id of ids) if (workspace.get(id) === undefined) throw new BrainError("UNKNOWN_ID", `No note with id ${id}`);
    const held = new Map<string, Set<string>>(); const planPath = args.options.plan as string | undefined;
    if (planPath !== undefined) for (const item of parsePlan(await readJsonInput(planPath, "sync render")).conflicts) if (item.code === "BOTH_CHANGED" && typeof item.brain_id === "string" && typeof item.property === "string") { const set = held.get(item.brain_id) ?? new Set<string>(); set.add(item.property); held.set(item.brain_id, set); }
    const data = render(workspace, now, ids, held); return { data: { items: data.items, errors: data.errors }, warnings: data.warnings, exitCode: data.errors.length > 0 ? 1 : 0, human: `${data.items.length} payloads\n` };
  },
};

export const syncTasksCommand: Command = {
  name: "sync tasks", usage: "brain sync tasks --meeting <mtg-id> --input <file|-> [--json]", summary: "Render action-item task payloads for a meeting.", options: { meeting: "string", input: "string" }, maxPositionals: 0, needsBrain: true,
  async run({ args, brain }) { const meeting = args.options.meeting as string | undefined; const input = args.options.input as string | undefined; if (meeting === undefined || input === undefined) throw new BrainError("USAGE", "sync tasks needs --meeting and --input"); return { data: renderTasks(await Workspace.open(brain!), meeting, await readJsonInput(input, "sync tasks")), human: "Task payloads rendered.\n" }; },
};

export const syncRecordCommand: Command = {
  name: "sync record", usage: "brain sync record --input <file|-> [--dry-run] [--json]", summary: "Record successful Notion publication results.", options: { input: "string", "dry-run": "boolean" }, maxPositionals: 0, needsBrain: true,
  async run({ args, brain, now }) { const input = args.options.input as string | undefined; if (input === undefined) throw new BrainError("USAGE", "sync record needs --input"); const workspace = await Workspace.open(brain!); const data = record(workspace, await readJsonInput(input, "sync record")); const records = data.records as Array<Record<string, unknown>>; const dryRun = args.options["dry-run"] === true; if (!dryRun) await workspace.commit([], now); const failed = records.filter((item) => item.result === "failed").length; return { data: { dry_run: dryRun, ...data }, exitCode: failed > 0 ? 1 : 0, human: `${records.length} records\n` }; },
};
