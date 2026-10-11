import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { assertNoProblems, isRecord, readJsonInput, unknownKeys } from "../lib/input.ts";
import { listProposals, PROPOSAL_STATUSES, stageProposals } from "../lib/proposals.ts";
import { Workspace } from "../lib/workspace.ts";

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
    if (!dryRun) {
      await workspace.commit(created.map((proposal) => ({
        op: "proposal-new",
        id: proposal.id,
        title: proposal.title,
        pairs: proposal.target === undefined ? [["kind", proposal.kind]] : [["kind", proposal.kind], ["target", proposal.target]],
      })), now);
    }
    const human = created.map((proposal) => `${dryRun ? "would create" : "created"} ${proposal.path}\n`).join("")
      + skipped.map((skip) => `skipped proposals[${skip.input_index}]: same as pending ${skip.existing}\n`).join("");
    return { data: { created, skipped, dry_run: dryRun }, human: human || "Nothing to write.\n" };
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
      : proposals.map((proposal) => `${String(proposal.id)} ${String(proposal.status)} ${String(proposal.kind)} ${String(proposal.title)}\n`).join("");
    return { data: { proposals }, human };
  },
};
