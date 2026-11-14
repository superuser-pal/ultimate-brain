import type { InputProblem } from "./input.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { criticalPending, itemShape, repetitionOf, type PlanData, type Repetition } from "./weekly-plan.ts";
import { hashOf, isoWeek, LIMIT, type Counts, type WeeklyState } from "./weekly-state.ts";

// `brain weekly select` (spec/cli.md §5.34; spec/weekly-review.md §5 to §7). Writes nothing.

export interface JudgedFinding { cluster: string; kind: "contradiction" | "stale" | "promotion" | "duplicate" | "theme"; fingerprint: string; targets: string[]; evidence: string[]; subject: string; decide: string }
export interface SelectInput { plan: PlanData; judged: { clusters: string[]; findings: JudgedFinding[]; corrections: Array<{ claim: string; note: string; verdict: string }> } }
export interface Item {
  n: number; key: string; stream: "work" | "knowledge" | "correction"; kind: string; category: string; subject: string; decide: string;
  lives: "review" | "task"; write: boolean; proposal: string | null; url: string | null; targets: string[]; new_items: number;
  because: string; evidence_hash: string; days_late?: number; days_idle?: number; shown_of?: { k: number; size: number };
  recommendation: { action: string; value: unknown; label: string } | null; finding: JudgedFinding | null;
}
export interface Selection {
  week: string; items: Item[]; queued: Array<{ key: string; category: string }>; counts: Counts; earlier_open: number;
  omitted: { clusters: string[]; correction_targets: number }; coverage: "complete" | "partial";
}

const WORK_LABEL: Record<string, string> = {
  task_overdue: "Overdue", task_stalled: "Stalled", project_stalled: "Stalled", project_no_next_step: "No next step", project_done_but_open: "Done but open",
  project_misplaced: "Misplaced", project_duplicate: "Duplicate project", task_no_project: "No project", area_no_domain: "No Domain", area_empty: "Empty Area",
};
const KNOWLEDGE_LABEL: Record<JudgedFinding["kind"], string> = { contradiction: "Contradiction", stale: "Stale fact", promotion: "Promotion", duplicate: "Duplicate", theme: "Theme" };
/** §5.2's order: 1 corrections, contradictions, stale facts; 2 overdue and stalled work; 3 structure, then duplicates, promotions, themes. */
const WORK_GROUP2 = ["task_overdue", "project_stalled", "task_stalled", "project_no_next_step", "project_done_but_open"];
const KNOWLEDGE_ORDER: Record<JudgedFinding["kind"], [number, number]> = { contradiction: [1, 1], stale: [1, 2], duplicate: [3, 2], promotion: [3, 3], theme: [3, 4] };

interface Candidate {
  key: string; group: number; sub: number; rank: number; category: string; repetition: Repetition;
  item: Omit<Item, "n" | "because" | "evidence_hash" | "write" | "proposal" | "new_items">; newItems: number;
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
  const claims = new Map(plan.corrections.map((claim) => [(claim as { claim: string }).claim, claim as { targets: Array<{ note: string }> }]));
  judged.corrections.forEach((judgment, index) => {
    const claim = claims.get(judgment.claim);
    if (claim === undefined || !claim.targets.some((target) => target.note === judgment.note)) problems.push({ pointer: `/judged/corrections/${index}`, message: `${judgment.claim} has no candidate target ${judgment.note} in the plan` });
  });
  return problems;
}

export function computeSelection(input: SelectInput, notes: ReadonlyMap<string, Note>, state: WeeklyState | null): Selection {
  const { plan, judged } = input;
  const pending = new Map(plan.pending.map((entry) => [entry.key, entry.proposal]));
  const thisWeek = new Set(plan.week_state.items);
  const candidates: Candidate[] = [];

  // The work stream: every assistant finding that may be an item this week (§6.1, §7).
  for (const finding of plan.findings) {
    if (!finding.repetition.show) continue;
    const shape = itemShape(finding as unknown as { signal: string; subject: unknown; recommendations: unknown });
    if (shape === null) continue;
    const signal = finding.signal;
    const group = WORK_GROUP2.includes(signal) ? 2 : 3;
    const subject = finding.subject as Record<string, unknown>;
    const title = String(subject.title ?? (Array.isArray(subject.titles) ? (subject.titles as string[]).join(" and ") : finding.key));
    const url = shape.lives === "task" && typeof subject.page_id === "string" ? `https://www.notion.so/${subject.page_id.replaceAll("-", "")}` : null;
    const decide = shape.lives === "task" ? "new date, Done or Won't Do" : `${shape.recommendation!.label}?`;
    candidates.push({
      key: finding.key, group, sub: 0, rank: Number(finding.rank), category: finding.category, repetition: finding.repetition,
      newItems: shape.lives === "task" ? 0 : 1,
      item: { key: finding.key, stream: "work", kind: WORK_LABEL[signal] ?? "Structure", category: finding.category, subject: shape.lives === "task" ? `"${title}"` : title, decide, lives: shape.lives, url, targets: shape.targets, recommendation: shape.recommendation, finding: null,
        ...dayCounters(finding.evidence as Record<string, unknown>) },
    });
  }

  // The knowledge stream: the findings the skill drew from the clusters it judged (§6.2, §7).
  const rankOf = new Map(plan.clusters.map((cluster) => [cluster.key, Number(cluster.rank)]));
  for (const finding of judged.findings) {
    const critical = finding.kind === "contradiction" && finding.targets.some((id) => notes.get(id)?.attributes.lifecycle === "reviewed");
    const repetition = repetitionOf({ key: finding.fingerprint, category: finding.kind, evidenceHash: hashOf([...finding.evidence].sort(compareCodePoints)), critical, state, week: plan.week, pending: pending.get(finding.fingerprint) ?? null });
    if (!repetition.show) continue;
    const [group, sub] = KNOWLEDGE_ORDER[finding.kind];
    candidates.push({
      key: finding.fingerprint, group, sub, rank: rankOf.get(finding.cluster) ?? Number.MAX_SAFE_INTEGER, category: finding.kind, repetition, newItems: 1,
      item: { key: finding.fingerprint, stream: "knowledge", kind: KNOWLEDGE_LABEL[finding.kind], category: finding.kind, subject: finding.subject, decide: finding.decide, lives: "review", url: null, targets: [...finding.targets], recommendation: null, finding },
    });
  }

  // §7 rule 4: an unresolved contradiction on a reviewed note found in an earlier week, linking its pending row.
  const judgedKeys = new Set(judged.findings.map((finding) => finding.fingerprint));
  for (const { key, proposal, target } of criticalPending(plan.pending, notes)) {
    if (judgedKeys.has(key)) continue;
    const shown = state?.shown.find((entry) => entry.key === key);
    const repetition = repetitionOf({ key, category: "contradiction", evidenceHash: shown?.evidence_hash ?? hashOf([]), critical: true, state, week: plan.week, pending: proposal.id });
    const field = String(proposal.attributes.field ?? "");
    candidates.push({
      key, group: 1, sub: KNOWLEDGE_ORDER.contradiction[1], rank: Number.MAX_SAFE_INTEGER, category: "contradiction", repetition, newItems: 1,
      item: { key, stream: "knowledge", kind: KNOWLEDGE_LABEL.contradiction, category: "contradiction", subject: String(proposal.attributes.title ?? key).slice(0, 120), decide: `${field.replace(/^facts\./, "")} now ${JSON.stringify(proposal.attributes.after ?? null)}?`.slice(0, 120), lives: "review", url: null, targets: [target], recommendation: null, finding: null },
    });
  }

  candidates.sort((a, b) => a.group - b.group || a.sub - b.sub || a.rank - b.rank || compareCodePoints(a.key, b.key));

  // The walk (§5.2): admit while D, I and T stay within 5; this week's items cost nothing again (§5.1); stop when D is 5.
  const counts = { ...plan.week_state.counts, queued: 0 };
  const items: Item[] = [];
  const queued: Array<{ key: string; category: string }> = [];
  for (const candidate of candidates) {
    const again = thisWeek.has(candidate.key);
    const proposal = candidate.item.lives === "review" ? candidate.repetition.pending : null;
    // An item of this week whose Review row was decided since stays counted and isn't shown again (§5.1).
    if (again && candidate.item.lives === "review" && proposal === null) continue;
    const write = candidate.item.lives === "review" && proposal === null;
    const cost = again ? { d: 0, i: 0, t: 0 } : { d: 1, i: write ? candidate.newItems : 0, t: candidate.item.targets.length };
    const fits = items.length < LIMIT && counts.decisions + cost.d <= LIMIT && counts.new_items + cost.i <= LIMIT && counts.targets + cost.t <= LIMIT;
    if (!fits || (counts.decisions >= LIMIT && !again)) { queued.push({ key: candidate.key, category: candidate.category }); continue; }
    counts.decisions += cost.d; counts.new_items += cost.i; counts.targets += cost.t;
    items.push({ ...candidate.item, n: items.length + 1, because: candidate.repetition.because!, evidence_hash: candidate.repetition.evidence_hash, write, proposal, new_items: write ? candidate.newItems : 0 });
  }
  counts.queued = queued.length;

  const judgedSet = new Set(judged.clusters);
  const omittedClusters = [...plan.clusters.filter((cluster) => !judgedSet.has(cluster.key)).map((cluster) => cluster.key), ...plan.clusters_left];
  return {
    week: plan.week, items, queued, counts, earlier_open: plan.earlier_open,
    omitted: { clusters: omittedClusters, correction_targets: 0 },
    coverage: omittedClusters.length > 0 ? "partial" : "complete",
  };
}

function dayCounters(evidence: Record<string, unknown>): { days_late?: number; days_idle?: number } {
  return {
    ...(typeof evidence.days_late === "number" ? { days_late: evidence.days_late } : {}),
    ...(typeof evidence.days_idle === "number" ? { days_idle: evidence.days_idle } : {}),
  };
}
