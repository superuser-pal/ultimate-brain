import type { InputProblem } from "./input.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { claimParts, type Claim, type Target } from "./weekly-corrections.ts";
import { criticalPending, itemShape, repetitionOf, type PlanData, type Repetition } from "./weekly-plan.ts";
import { hashOf, isoWeek, LIMIT, type Counts, type OldCounts, type WeeklyState } from "./weekly-state.ts";

// `brain weekly select` (spec/cli.md §5.34; spec/weekly-review.md §5 to §7). Writes nothing.

export interface JudgedFinding { cluster: string; kind: "contradiction" | "stale" | "promotion" | "duplicate" | "theme"; fingerprint: string; targets: string[]; evidence: string[]; subject: string; decide: string }
/** A next step the skill wrote from a project's own notes (weekly-review.md §6.1): only such a `project_no_next_step` becomes an Action. */
export interface NextStep { key: string; task_title: string; why: string }
export interface SelectInput { plan: PlanData; judged: { clusters: string[]; findings: JudgedFinding[]; corrections: Array<{ claim: string; note: string; verdict: string }>; next_steps?: NextStep[] } }
/** Where an item goes (§6.1): an Action (A), a doubtful item (C), or a session item counted in T. */
export type Part = "A" | "C" | "T";
export interface Item {
  n: number; part: Part; key: string; stream: "work" | "knowledge" | "correction" | "cleanup"; kind: string; category: string; subject: string; decide: string;
  write: boolean; proposal: string | null; targets: string[];
  because: string; evidence_hash: string; days_late?: number; days_idle?: number; shown_of?: { k: number; size: number };
  recommendation: { action: string; value: unknown; label: string } | null; finding: JudgedFinding | null;
  /** The week of the row it was carried from (§15.6). */
  carried_from?: string;
  proposal_input?: Array<Record<string, unknown>>;
}
export interface Selection {
  week: string; input_hash: string; items: Item[]; queued: Array<{ key: string; category: string; proposal?: string; carried_from?: string }>; counts: Counts; earlier_open: number;
  omitted: { clusters: string[]; correction_targets: number }; coverage: "complete" | "partial";
  corrections?: Array<{ claim: string; open: string[]; clarify: number }>;
}

/** The caps of §5: A Actions, C doubtful items, T targets of new session items. */
export const CAPS = { A: 5, C: 10, T: LIMIT } as const;
const WORK_LABEL: Record<string, string> = {
  project_stalled: "Stalled", project_no_next_step: "No next step", project_done_but_open: "Done but open",
  project_misplaced: "Misplaced", project_duplicate: "Duplicate project", task_no_project: "No project", area_no_domain: "No Domain", area_empty: "Empty Area",
};
const KNOWLEDGE_LABEL: Record<JudgedFinding["kind"], string> = { contradiction: "Contradiction", stale: "Stale fact", promotion: "Promotion", duplicate: "Duplicate", theme: "Theme" };
/** §5.2: Actions take these work signals, in the assistant's rank; doubtful items these structure signals. */
const ACTION_SIGNALS = new Set(["project_stalled", "project_no_next_step", "project_done_but_open"]);
const DOUBTFUL_SIGNALS = new Set(["project_misplaced", "project_duplicate", "task_no_project", "area_no_domain", "area_empty"]);
/** Order within C (§5.2): stale facts, promotions, duplicates (0052's severity), then structure, then mechanical items. */
const DOUBTFUL_ORDER: Record<string, number> = { stale: 1, promotion: 2, duplicate: 3 };

interface Candidate {
  key: string; part: Part; order: [number, number, number]; category: string; repetition: Repetition;
  item: Omit<Item, "n" | "because" | "evidence_hash" | "write" | "proposal">;
  /** The proposal it already has, carried from an earlier row (§15.6). */
  carried?: { week: string; proposal: string };
  /** A correction group (weekly-review.md §8.4): its restatements by note id, admitted in part when only some fit (§5.2). */
  group_?: { claim: Claim; drafted: Target[]; uncertain: Target[] };
  /** Links the waiting group of this week's item for the claim (a rerun, §8.4). */
  link?: string;
  /** A new item whose proposal select already words (a next step, a mechanical item while auto is off). */
  input?: Array<Record<string, unknown>>;
}

/** The cross-field checks of cli.md §5.34 that the schema can't make. */
export function selectProblems(input: SelectInput, notes: ReadonlyMap<string, Note>): InputProblem[] {
  const problems: InputProblem[] = [];
  const { plan, judged } = input;
  if (isoWeek(plan.local_date) !== plan.week) problems.push({ pointer: "/plan/week", message: `is not the week of local_date ${plan.local_date}` });
  if (plan.quiet) problems.push({ pointer: "/plan/quiet", message: "is true: a quiet run selects nothing (weekly-review.md §9.1)" });
  const clusterKeys = new Set(plan.clusters.map((cluster) => cluster.key));
  judged.clusters.forEach((key, index) => { if (!clusterKeys.has(key)) problems.push({ pointer: `/judged/clusters/${index}`, message: `${key} is not a cluster of the plan` }); });
  const judgedKeys = new Set(judged.clusters);
  const fingerprints = new Set<string>();
  judged.findings.forEach((finding, index) => {
    if (!judgedKeys.has(finding.cluster)) problems.push({ pointer: `/judged/findings/${index}/cluster`, message: `${finding.cluster} is not a judged cluster` });
    if (fingerprints.has(finding.fingerprint)) problems.push({ pointer: `/judged/findings/${index}/fingerprint`, message: `${finding.fingerprint} is listed twice` });
    fingerprints.add(finding.fingerprint);
    finding.targets.forEach((id, at) => { if (!notes.has(id)) problems.push({ pointer: `/judged/findings/${index}/targets/${at}`, message: `no note with id ${id}` }); });
  });
  const noNextStep = new Map(plan.findings.filter((finding) => finding.signal === "project_no_next_step").map((finding) => [finding.key, finding]));
  const steps = new Set<string>();
  (judged.next_steps ?? []).forEach((step, index) => {
    const finding = noNextStep.get(step.key);
    if (finding === undefined) problems.push({ pointer: `/judged/next_steps/${index}/key`, message: `${step.key} is no project_no_next_step finding of the plan` });
    else if (typeof (finding.subject as Record<string, unknown>).id !== "string" || !notes.has(String((finding.subject as Record<string, unknown>).id))) problems.push({ pointer: `/judged/next_steps/${index}/key`, message: `${step.key} names no project of the brain: a next step is a task of a brain project` });
    if (steps.has(step.key)) problems.push({ pointer: `/judged/next_steps/${index}/key`, message: `${step.key} is listed twice` });
    steps.add(step.key);
  });
  const claims = new Map(plan.corrections.map((claim) => [(claim as { claim: string }).claim, claim as { targets: Array<{ note: string }> }]));
  const judgedTargets = new Set<string>();
  judged.corrections.forEach((judgment, index) => {
    const claim = claims.get(judgment.claim) as Claim | undefined;
    const target = claim?.targets.find((candidate) => candidate.note === judgment.note);
    const at = `/judged/corrections/${index}`;
    if (target === undefined) { problems.push({ pointer: at, message: `${judgment.claim} has no candidate target ${judgment.note} in the plan` }); return; }
    const key = `${judgment.claim}\u0000${judgment.note}`;
    if (judgedTargets.has(key)) problems.push({ pointer: at, message: `${judgment.note} is judged twice for ${judgment.claim}` });
    judgedTargets.add(key);
    if (target.pending !== null) problems.push({ pointer: at, message: `${judgment.note} already waits for a decision in the session (${target.pending}) for ${judgment.claim}: it is not judged again` });
    if (judgment.verdict === "restatement" && target.field === null && target.line_after === null) problems.push({ pointer: `${at}/verdict`, message: `${judgment.note} has no one-for-one fix (line_after is null): judge it uncertain (weekly-review.md §8.2)` });
  });
  return problems;
}

/** A week's counts in the 0.17.0 shape: an entry written before keeps its targets and queued, and had no Actions or doubtful items. */
export function currentCounts(counts: Counts | OldCounts): Counts {
  return "actions" in counts ? { ...counts } : { actions: 0, doubtful: 0, cleaned: 0, targets: counts.targets, queued: counts.queued };
}

export function computeSelection(input: SelectInput, notes: ReadonlyMap<string, Note>, state: WeeklyState | null): Selection {
  const { plan, judged } = input;
  const pending = new Map(plan.pending.map((entry) => [entry.key, entry.proposal]));
  const rowOf = new Map(plan.pending.map((entry) => [entry.proposal, entry.weekly ?? null]));
  const carriedProposals = new Set(plan.carry.map((entry) => entry.proposal));
  const thisWeek = new Set(plan.week_state.items);
  const candidates: Candidate[] = [];
  // A finding whose note this run's clean-up merged or archived is retired (§5.2): an archived or missing target drops it.
  const retired = (targets: readonly string[]): boolean => targets.some((id) => /^[a-z]+-[0-9a-z]{8}$/.test(id) && !id.startsWith("notion:") && (notes.get(id) === undefined || notes.get(id)!.attributes.lifecycle === "archived"));
  // A finding whose proposal another row offers, and that isn't carried from it, stays that row's (§15.6).
  const otherRow = (proposal: string | null): boolean => proposal !== null && !carriedProposals.has(proposal) && rowOf.get(proposal) !== null && rowOf.get(proposal) !== undefined && rowOf.get(proposal) !== plan.week;
  const steps = new Map((judged.next_steps ?? []).map((step) => [step.key, step]));

  // Carried items first (§15.6), in their earlier order.
  plan.carry.forEach((entry, index) => {
    const repetition: Repetition = { show: true, because: "carried", shown: entry.week, pending: entry.proposal, evidence_hash: hashOf([entry.proposal]) };
    candidates.push({
      key: entry.key, part: entry.part, order: [0, index, 0], category: entry.category, repetition, carried: { week: entry.week, proposal: entry.proposal },
      item: { part: entry.part, key: entry.key, stream: entry.stream, kind: entry.kind, category: entry.category, subject: entry.subject, decide: entry.decide, targets: [...entry.targets], recommendation: null, finding: null, carried_from: entry.week },
    });
  });
  const carriedKeys = new Set(plan.carry.map((entry) => entry.key));

  // The work stream: Actions and doubtful structure changes (§6.1, §7).
  for (const finding of plan.findings) {
    if (!finding.repetition.show || carriedKeys.has(finding.key) || otherRow(finding.repetition.pending)) continue;
    const signal = finding.signal;
    const subject = finding.subject as Record<string, unknown>;
    const title = String(subject.title ?? (Array.isArray(subject.titles) ? (subject.titles as string[]).join(" and ") : finding.key));
    const base = { key: finding.key, stream: "work" as const, kind: WORK_LABEL[signal] ?? "Structure", category: finding.category, subject: title, finding: null, ...dayCounters(finding.evidence as Record<string, unknown>) };
    if (signal === "project_no_next_step") {
      const step = steps.get(finding.key);
      const project = typeof subject.id === "string" ? subject.id : null;
      if (step === undefined || project === null) continue; // Focus first only (§6.1)
      const proposal = { kind: "new_task", title: cut(`Add the next step "${step.task_title}" to ${title}`), target: project, task_title: step.task_title, why: step.why, source: plan.source, finding: finding.key, ...(typeof finding.area === "string" ? { area: finding.area } : {}) };
      candidates.push({ key: finding.key, part: "A", order: [1, Number(finding.rank), 0], category: finding.category, repetition: finding.repetition, input: [proposal],
        item: { ...base, part: "A", decide: `add the next step "${step.task_title}"`, targets: [project], recommendation: null } });
      continue;
    }
    if (!ACTION_SIGNALS.has(signal) && !DOUBTFUL_SIGNALS.has(signal)) continue;
    const shape = itemShape(finding as unknown as { signal: string; subject: unknown; recommendations: unknown });
    if (shape === null || shape.lives !== "session" || shape.recommendation === null) continue;
    if (retired(shape.targets)) continue;
    const part: Part = ACTION_SIGNALS.has(signal) ? "A" : "C";
    candidates.push({ key: finding.key, part, order: [part === "A" ? 1 : 2, Number(finding.rank), 0], category: finding.category, repetition: finding.repetition,
      item: { ...base, part, decide: `${shape.recommendation.label}?`, targets: shape.targets, recommendation: shape.recommendation } });
  }

  // The knowledge stream: the findings the skill drew from the clusters it judged (§6.2, §7).
  const rankOf = new Map(plan.clusters.map((cluster) => [cluster.key, Number(cluster.rank)]));
  for (const finding of judged.findings) {
    if (carriedKeys.has(finding.fingerprint) || retired(finding.targets)) continue;
    const critical = finding.kind === "contradiction" && finding.targets.some((id) => notes.get(id)?.attributes.lifecycle === "reviewed");
    const repetition = repetitionOf({ key: finding.fingerprint, category: finding.kind, evidenceHash: hashOf([...finding.evidence].sort(compareCodePoints)), critical, state, week: plan.week, pending: pending.get(finding.fingerprint) ?? null });
    if (!repetition.show || otherRow(repetition.pending)) continue;
    const part: Part = finding.kind === "contradiction" ? "T" : finding.kind === "theme" ? "A" : "C";
    const rank = rankOf.get(finding.cluster) ?? Number.MAX_SAFE_INTEGER;
    const order: [number, number, number] = part === "T" ? [2, rank, 0] : part === "A" ? [3, rank, 0] : [1, DOUBTFUL_ORDER[finding.kind] ?? 9, rank];
    candidates.push({ key: finding.fingerprint, part, order, category: finding.kind, repetition,
      item: { part, key: finding.fingerprint, stream: "knowledge", kind: KNOWLEDGE_LABEL[finding.kind], category: finding.kind, subject: finding.subject, decide: finding.decide, targets: [...finding.targets], recommendation: null, finding } });
  }

  // §7 rule 4: an unresolved contradiction on a reviewed note found in an earlier week, linking its pending proposal.
  const judgedKeys = new Set(judged.findings.map((finding) => finding.fingerprint));
  for (const { key, proposal, target } of criticalPending(plan.pending, notes)) {
    if (judgedKeys.has(key)) continue;
    const shown = state?.shown.find((entry) => entry.key === key);
    const repetition = repetitionOf({ key, category: "contradiction", evidenceHash: shown?.evidence_hash ?? hashOf([]), critical: true, state, week: plan.week, pending: proposal.id });
    const field = String(proposal.attributes.field ?? "");
    candidates.push({ key, part: "T", order: [2, Number.MAX_SAFE_INTEGER, 0], category: "contradiction", repetition,
      item: { part: "T", key, stream: "knowledge", kind: KNOWLEDGE_LABEL.contradiction, category: "contradiction", subject: String(proposal.attributes.title ?? key).slice(0, 120), decide: `${field.replace(/^facts\./, "")} now ${JSON.stringify(proposal.attributes.after ?? null)}?`.slice(0, 120), targets: [target], recommendation: null, finding: null } });
  }

  // Mechanical items while settings.cleanup.auto is off (§15.2): doubtful items, last in C.
  if (!plan.cleanup_auto) {
    plan.cleanup.forEach((tidy, index) => {
      if (carriedKeys.has(tidy.fingerprint) || otherRow(pending.get(tidy.fingerprint) ?? null)) return;
      const linked = pending.get(tidy.fingerprint) ?? null;
      const repetition: Repetition = { show: true, because: thisWeek.has(tidy.fingerprint) ? "this_week" : "new", shown: null, pending: linked, evidence_hash: hashOf(tidy.proposal_input) };
      candidates.push({ key: tidy.fingerprint, part: "C", order: [3, index, 0], category: "cleanup", repetition, input: [tidy.proposal_input],
        item: { part: "C", key: tidy.fingerprint, stream: "cleanup", kind: "Clean-up", category: "cleanup", subject: tidy.title, decide: `${tidy.title}?`, targets: [...tidy.targets], recommendation: null, finding: null } });
    });
  }

  // The correction stream (§8.4): one group per claim of its restatements not yet proposed, oldest claim first; or, on a rerun, the link to
  // the group this week's item wrote.
  const outcomes = new Map<string, { open: string[]; clarify: number }>();
  let omittedTargets = 0;
  plan.corrections.forEach((claim, index) => {
    const verdicts = new Map(judged.corrections.filter((judgment) => judgment.claim === claim.claim).map((judgment) => [judgment.note, judgment.verdict]));
    const fresh = claim.targets.filter((target) => target.pending === null);
    const unjudged = fresh.filter((target) => !verdicts.has(target.note));
    omittedTargets += unjudged.length;
    const drafted = fresh.filter((target) => verdicts.get(target.note) === "restatement");
    const uncertain = fresh.filter((target) => verdicts.get(target.note) === "uncertain");
    outcomes.set(claim.claim, { open: unjudged.map((target) => target.note), clarify: uncertain.length });
    const key = `correction:${claim.claim}`;
    const parts = claimParts(claim.claim);
    const field = parts.kind === "fact" ? parts.field!.replaceAll("_", " ") : parts.kind === "supersede" ? "decision" : parts.kind;
    const old = claim.old.length === 0 ? "" : String(claim.old[0]);
    const size = drafted.length + uncertain.length;
    const subject = `${claim.title} ${field}${old === "" ? "" : ` ${old}`} → ${String(claim.new)}`.slice(0, 120);
    const base = { part: "T" as const, stream: "correction" as const, kind: "Correction", category: "correction", subject, recommendation: null, finding: null };
    if (drafted.length > 0) {
      const evidenceHash = hashOf(drafted.map(({ note, line }) => ({ note, line })).sort((a, b) => compareCodePoints(a.note, b.note)));
      const repetition = repetitionOf({ key, category: "correction", evidenceHash, critical: claim.open, state, week: plan.week, pending: null });
      if (!repetition.show) return;
      outcomes.get(claim.claim)!.open.push(...drafted.map((target) => target.note));
      candidates.push({
        key, part: "T", order: [1, index, 0], category: "correction", repetition, group_: { claim, drafted, uncertain },
        item: { ...base, key, decide: `${size} note${size === 1 ? " restates" : "s restate"} ${old === "" ? "it" : old}`.slice(0, 120), targets: drafted.map((target) => target.note) },
      });
      return;
    }
    const waiting = claim.targets.filter((target) => target.pending !== null);
    if (waiting.length > 0 && thisWeek.has(key)) {
      const repetition = repetitionOf({ key, category: "correction", evidenceHash: hashOf([]), state, week: plan.week, pending: waiting[0]!.pending });
      candidates.push({
        key, part: "T", order: [1, index, 0], category: "correction", repetition, link: waiting[0]!.pending!,
        item: { ...base, key, decide: `${waiting.length} note${waiting.length === 1 ? " restates" : "s restate"} ${old === "" ? "it" : old}`.slice(0, 120), targets: [...new Set(waiting.map((target) => target.note))] },
      });
    }
  });

  const partOrder: Record<Part, number> = { T: 0, A: 1, C: 2 };
  candidates.sort((a, b) => partOrder[a.part] - partOrder[b.part] || a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2] || compareCodePoints(a.key, b.key));

  // The walk (§5.2): each list is filled once, in its order, within its cap; this week's items cost nothing again (§5.1).
  const counts: Counts = { ...currentCounts(plan.week_state.counts), queued: 0 };
  const items: Item[] = [];
  const queued: Selection["queued"] = [];
  const seen = new Set<string>();
  const queue = (candidate: Candidate) => queued.push({ key: candidate.key, category: candidate.category, ...(candidate.carried === undefined ? {} : { proposal: candidate.carried.proposal, carried_from: candidate.carried.week }) });
  for (const candidate of candidates) {
    if (seen.has(candidate.key)) continue;
    seen.add(candidate.key);
    if (candidate.group_ !== undefined) {
      // A correction group admits its first restatements by note id that fit the T left (§5.2, §8.4); the rest stay queued under its claim.
      const room = Math.min(candidate.group_.drafted.length, CAPS.T - counts.targets);
      if (room < 1) { queue(candidate); continue; }
      const { claim, drafted, uncertain } = candidate.group_;
      const admitted = drafted.slice(0, room);
      const outcome = outcomes.get(claim.claim)!;
      outcome.open = outcome.open.filter((note) => !admitted.some((target) => target.note === note));
      counts.targets += admitted.length;
      const size = drafted.length + uncertain.length;
      items.push({
        ...candidate.item, targets: admitted.map((target) => target.note), n: items.length + 1, because: candidate.repetition.because!, evidence_hash: candidate.repetition.evidence_hash,
        write: true, proposal: null, ...(admitted.length < size ? { shown_of: { k: admitted.length, size } } : {}),
        proposal_input: groupInput(claim, admitted, uncertain, size),
      });
      continue;
    }
    if (candidate.link !== undefined) {
      items.push({ ...candidate.item, n: items.length + 1, because: "this_week", evidence_hash: candidate.repetition.evidence_hash, write: false, proposal: candidate.link });
      continue;
    }
    const again = thisWeek.has(candidate.key);
    const proposal = candidate.carried?.proposal ?? candidate.repetition.pending;
    // An item of this week whose proposal was decided since stays counted and isn't shown again (§5.1).
    if (again && proposal === null && candidate.carried === undefined) continue;
    const write = proposal === null;
    const cost = again ? 0 : candidate.part === "T" ? candidate.item.targets.length : 1;
    const used = candidate.part === "A" ? counts.actions : candidate.part === "C" ? counts.doubtful : counts.targets;
    if (used + cost > CAPS[candidate.part]) { queue(candidate); continue; }
    if (candidate.part === "A") counts.actions += cost;
    else if (candidate.part === "C") counts.doubtful += cost;
    else counts.targets += cost;
    items.push({ ...candidate.item, n: items.length + 1, because: candidate.repetition.because!, evidence_hash: candidate.repetition.evidence_hash, write, proposal, ...(write && candidate.input !== undefined ? { proposal_input: candidate.input } : {}) });
  }
  counts.queued = queued.length;

  const judgedSet = new Set(judged.clusters);
  const omittedClusters = [...plan.clusters.filter((cluster) => !judgedSet.has(cluster.key)).map((cluster) => cluster.key), ...plan.clusters_left];
  return {
    week: plan.week, input_hash: plan.input_hash, items, queued, counts, earlier_open: plan.earlier_open,
    omitted: { clusters: omittedClusters, correction_targets: omittedTargets },
    coverage: omittedClusters.length > 0 || omittedTargets > 0 ? "partial" : "complete",
    corrections: [...outcomes].map(([claim, outcome]) => ({ claim, open: [...new Set(outcome.open)].sort(compareCodePoints), clarify: outcome.clarify })),
  };
}

const cut = (text: string): string => (text.length > 120 ? `${text.slice(0, 119)}…` : text);

/** The exact `proposal new` input of a correction group (weekly-review.md §8.4): its review_notes, then one change per admitted target. */
export function groupInput(claim: Claim, admitted: readonly Target[], uncertain: readonly Target[], size: number): Array<Record<string, unknown>> {
  const parts = claimParts(claim.claim);
  const field = parts.kind === "fact" ? parts.field! : parts.kind === "supersede" ? "decision" : parts.kind;
  const old = claim.old.length === 0 ? "" : String(claim.old[0]);
  const cut = (text: string) => (text.length > 120 ? `${text.slice(0, 119)}…` : text);
  const shared = { why: claim.why, source: claim.source, passages: claim.passages, correction: claim.claim };
  return [
    {
      kind: "review_notes", title: cut(`Correction: ${claim.title} ${field}: ${old === "" ? "" : `${old} → `}${String(claim.new)} (${size} note${size === 1 ? "" : "s"})`.replace(": → ", ": ")), notes: [],
      why: claim.why, source: claim.source, correction: claim.claim,
      ...(uncertain.length > 0 ? { needs_clarification: uncertain.map((target) => ({ note: target.note, line: target.line })) } : {}),
    },
    ...admitted.map((target) => target.field !== null
      ? { kind: "update_fact", title: cut(`${target.title}: ${old} → ${String(claim.new)}`), target: target.note, field: target.field, after: claim.new, ...shared }
      : { kind: "replace_line", title: cut(`${target.title}: ${old} → ${String(claim.new)}`), target: target.note, line_before: target.line, line_after: target.line_after, ...shared }),
  ];
}

function dayCounters(evidence: Record<string, unknown>): { days_late?: number; days_idle?: number } {
  return {
    ...(typeof evidence.days_late === "number" ? { days_late: evidence.days_late } : {}),
    ...(typeof evidence.days_idle === "number" ? { days_idle: evidence.days_idle } : {}),
  };
}
