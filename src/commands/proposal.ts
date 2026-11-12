import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { assertNoProblems, isRecord, readJsonInput, unknownKeys } from "../lib/input.ts";
import { parseSettleInput, settle } from "../lib/notion-change.ts";
import { listProposals, PROPOSAL_STATUSES, stageBacklog, stageProposals } from "../lib/proposals.ts";
import { Skip } from "../lib/review-apply.ts";
import { reviseItem } from "../lib/review-revision.ts";
import { formatDate } from "../lib/time.ts";
import { Workspace } from "../lib/workspace.ts";
import { lintWarnings } from "../lib/warnings.ts";

/** Why an input item was not written, for the human output (the reasons of spec/cli.md §5.6). */
const SKIP_TEXT: Record<string, string> = {
  DUPLICATE_PENDING: "same as a pending proposal",
  ALREADY_LINKED: "already linked",
  NOTHING_TO_REVIEW: "nothing to review",
  ALREADY_ANSWERED: "the question already has an answer",
  NO_CHANGE: "no change",
  SOURCE_EXCLUDED: "rests on content you excluded from the brain",
};

/** `brain proposal new --input <file|-> [--dry-run]` (spec/cli.md §5.6). */
export const proposalNewCommand: Command = {
  name: "proposal new",
  usage: "brain proposal new --input <file|-> [--dry-run] [--json]",
  summary: "Write pending proposals for changes to existing knowledge. All or nothing; skips duplicates of pending proposals.",
  options: { input: "string", "dry-run": "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const input = await readJsonInput(args.options.input as string | undefined, "proposal new");
    if (!isRecord(input)) assertNoProblems([{ pointer: "", message: "must be an object with a proposals list" }]);
    const record = input as Record<string, unknown>;
    assertNoProblems(unknownKeys(record, ["proposals"], ""));

    const dryRun = args.options["dry-run"] === true;
    const workspace = await Workspace.open(brain!);
    const { created, skipped } = stageProposals(workspace, record.proposals, now);
    const warnings = lintWarnings(workspace.warnings());
    if (!dryRun) {
      await workspace.commit(created.map((proposal) => ({
        op: "proposal-new",
        id: proposal.id,
        title: proposal.title,
        pairs: proposal.target === undefined ? [["kind", proposal.kind]] : [["kind", proposal.kind], ["target", proposal.target]],
      })), now);
    }
    const human = created.map((proposal) => `${dryRun ? "would create" : "created"} ${proposal.path}\n`).join("")
      + skipped.map((skip) => `skipped proposals[${skip.input_index}]: ${SKIP_TEXT[skip.reason] ?? skip.reason}${skip.existing === undefined ? "" : ` (${skip.existing})`}\n`).join("");
    return { data: { created, skipped, dry_run: dryRun }, warnings, human: human || "Nothing to write.\n" };
  },
};

/** `brain proposal list [--status <s>[,<s>…]] [--target <id>]` (spec/cli.md §5.6). */
export const proposalListCommand: Command = {
  name: "proposal list",
  usage: "brain proposal list [--status <s>[,<s>…]] [--target <id>] [--json]",
  summary: "List proposals, filtered by status and target, sorted by created then id.",
  options: { status: "string", target: "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain }) {
    const statuses = typeof args.options.status === "string" ? args.options.status.split(",").map((status) => status.trim()).filter((status) => status !== "") : [];
    const unknown = statuses.filter((status) => !(PROPOSAL_STATUSES as readonly string[]).includes(status));
    if (unknown.length > 0) throw new BrainError("USAGE", `Unknown status ${unknown.join(", ")}; use ${PROPOSAL_STATUSES.join(", ")}`);
    const workspace = await Workspace.open(brain!);
    const proposals = listProposals(workspace, statuses, args.options.target as string | undefined);
    const human = proposals.length === 0
      ? "No proposals.\n"
      : proposals.map((proposal) => `${String(proposal.id)} ${String(proposal.status)} ${String(proposal.kind)} ${proposal.title === undefined ? "held: rests on content you excluded from the brain" : String(proposal.title)}\n`).join("");
    return { data: { proposals }, human };
  },
};

/** `brain proposal backlog [--dry-run]` (spec/cli.md §5.6, 0041). */
export const proposalBacklogCommand: Command = {
  name: "proposal backlog",
  usage: "brain proposal backlog [--dry-run] [--json]",
  summary: "Write one Review notes proposal per source over the draft notes nobody has accepted yet. A second run writes nothing.",
  options: { "dry-run": "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const dryRun = args.options["dry-run"] === true;
    const workspace = await Workspace.open(brain!);
    const created = stageBacklog(workspace, now);
    const warnings = lintWarnings(workspace.warnings());
    if (!dryRun) {
      await workspace.commit(created.map((proposal) => ({ op: "proposal-new", id: proposal.id, title: proposal.title, pairs: [["kind", proposal.kind]] })), now);
    }
    const human = created.map((proposal) => `${dryRun ? "would create" : "created"} ${proposal.path}\n`).join("");
    return { data: { created, skipped: [], dry_run: dryRun }, warnings, human: human || "Nothing to write.\n" };
  },
};

/** `brain proposal revise --input <file|->` (spec/cli.md §5.27, capture-and-review §7.8): the new draft of a revision-requested item. */
export const proposalReviseCommand: Command = {
  name: "proposal revise",
  usage: "brain proposal revise --input <file|-> [--dry-run] [--json]",
  summary: "Replace the stored proposal of a revision-requested Review item with a new draft, keeping the user's previous wording. Accepts nothing.",
  options: { input: "string", "dry-run": "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const input = await readJsonInput(args.options.input as string | undefined, "proposal revise");
    const problems = isRecord(input) ? unknownKeys(input, ["proposal", "item_id", "proposed", "previous", "passages"], "") : [{ pointer: "", message: "must be an object" }];
    if (isRecord(input)) for (const key of ["proposal", "item_id", "proposed", "previous"]) if (typeof input[key] !== "string") problems.push({ pointer: `/${key}`, message: "must be a string" });
    assertNoProblems(problems);
    const workspace = await Workspace.open(brain!);
    const request = input as { proposal: string; item_id: string; proposed: string; previous: string; passages?: unknown };
    try {
      const data = reviseItem(workspace, request, now, formatDate(now));
      const errors = workspace.newErrors();
      if (errors.length > 0) throw new BrainError("INPUT_INVALID", `The revision fails lint: ${errors.map((issue) => `${issue.rule}: ${issue.message}`).join("; ")}`);
      if (args.options["dry-run"] !== true) await workspace.commit([{ op: "proposal-revise", id: request.proposal, title: request.item_id }], now);
      return { data: { ...data, result: args.options["dry-run"] === true ? "DRY_RUN" : "REVISED" }, human: `revised ${request.item_id}\n` };
    } catch (error) {
      if (error instanceof Skip) throw new BrainError("INPUT_INVALID", `${error.code}: ${error.message}`);
      throw error;
    }
  },
};

/** `brain proposal settle --input <file|-> [--dry-run]` (spec/cli.md §5.6, assistant.md §6.4): what the skill did with each Notion write. */
export const proposalSettleCommand: Command = {
  name: "proposal settle",
  usage: "brain proposal settle --input <file|-> [--dry-run] [--json]",
  summary: "Record the result of the Notion writes of approved notion_change proposals: applied, or stale. Atomic per item; exits 1 if any item failed.",
  options: { input: "string", "dry-run": "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const items = parseSettleInput(await readJsonInput(args.options.input as string | undefined, "proposal settle"));
    const dryRun = args.options["dry-run"] === true;
    const workspace = await Workspace.open(brain!);
    const { settled, log } = settle(workspace, items, now);
    if (!dryRun) await workspace.commit(log, now);
    const human = settled.map((item) => `${item.result} ${item.proposal}${item.reason === undefined ? "" : ` (${item.reason})`}\n`).join("");
    return { data: { settled, dry_run: dryRun }, exitCode: settled.some((item) => item.result === "failed") ? 1 : 0, human: human || "Nothing to settle.\n" };
  },
};
