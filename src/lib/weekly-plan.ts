import type { Dismissal } from "./assistant-dismissals.ts";
import { computeFindings, taskStateOf, type RankedFinding, type Snapshot } from "./assistant-findings.ts";
import { isRecord } from "./input.ts";
import { modulesOf } from "./modules.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { reflectCandidates, reflectionNotes } from "./reflect.ts";
import type { Loaded } from "./suppressions.ts";
import { formatTimestamp } from "./time.ts";
import { computeClaims, type Claim, type Cursor, type TitleChange } from "./weekly-corrections.ts";
import { addDays, hashOf, isoWeek, localDate, weeklySettings, ZERO, type Counts, type WeeklyState } from "./weekly-state.ts";

// `brain weekly plan` (spec/cli.md §5.34; spec/weekly-review.md §1 step 3, §4, §7, §9.1, §10). Writes nothing.

const DAY_MS = 86_400_000;
const BULLETS = 8;
const WEIGHT = { decided: 4, changed: 3, open: 2, answered: 2, next: 1 } as const;
type ChangeKind = keyof typeof WEIGHT;
const TASK_SIGNALS = new Set(["task_overdue", "task_stalled", "task_no_project"]);
/** Counters that grow by themselves: left out of the evidence hash, since their growth is §7 rule 3's (urgency), not new evidence. */
const COUNTERS = new Set(["days_late", "days_idle"]);

export interface Change {
  key: string; kind: ChangeKind; ref: string; title: string; path: string | null; url: string | null; date: string; weight: number; bullet: boolean;
  field?: string; before?: unknown; after?: unknown; draft?: boolean;
}
export interface Repetition { show: boolean; because: string | null; shown: string | null; pending: string | null; evidence_hash: string }
export interface Subject { key: string; title: string; url: string | null; evidence: string }
export interface PlanData {
  week: string; as_of: string; local_date: string; notion: "live" | "unreachable";
  window: { from: string; to: string; first: boolean; days: number };
  report: { id: string; path: string } | null;
  changes: Change[];
  inputs: { meetings: number; sources: number };
  findings: Array<Record<string, unknown> & { key: string; signal: string; category: string; repetition: Repetition }>;
  skipped_signals: unknown[];
  task_analysis: { overdue: Subject[]; stalled: Subject[]; blocked: Subject[]; no_next_step: Subject[]; order: Subject[] };
  clusters: Array<Record<string, unknown> & { key: string; carried: boolean }>;
  clusters_left: string[];
  corrections: Claim[];
  pending: Array<{ key: string; proposal: string }>;
  week_state: { counts: Counts; items: string[] };
  earlier_open: number;
  budget: { minutes: number; max_judged: number };
  input_hash: string;
  quiet: boolean;
}

export const taskUrl = (page: string): string => `https://www.notion.so/${page.replaceAll("-", "")}`;
const dateOf = (value: unknown): string | null => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : value instanceof Date ? value.toISOString().slice(0, 10) : null);
const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** How an assistant finding can be a decision item (weekly-review.md §6.1, §6.2): a task item for an overdue or stalled task; else a Review row for its first
 *  recommendation with a value that a Review row can carry (not add_task, which needs the user's words); else null: Task analysis only. */
export function itemShape(finding: { signal: string; subject: unknown; recommendations: unknown }): { lives: "task" | "review"; targets: string[]; recommendation: { action: string; value: unknown; label: string } | null } | null {
  const subject = isRecord(finding.subject) ? finding.subject : {};
  const page = typeof subject.page_id === "string" ? subject.page_id : null;
  if ((finding.signal === "task_overdue" || finding.signal === "task_stalled") && page !== null) return { lives: "task", targets: [`notion:${page}`], recommendation: null };
  const chosen = list(finding.recommendations).filter(isRecord).find((rec) => rec.value !== null && rec.value !== undefined && rec.action !== "add_task");
  if (chosen === undefined) return null;
  const recommendation = { action: String(chosen.action), value: chosen.value, label: String(chosen.label) };
  if (TASK_SIGNALS.has(finding.signal)) return page === null ? null : { lives: "review", targets: [`notion:${page}`], recommendation };
  if (chosen.action === "merge_projects" && isRecord(chosen.value)) return { lives: "review", targets: [String(chosen.value.target), String(chosen.value.merge_into)], recommendation };
  const id = typeof subject.id === "string" ? subject.id : Array.isArray(subject.ids) ? String(subject.ids[0]) : null;
  return id === null ? null : { lives: "review", targets: [id], recommendation };
}

/** The evidence hash of an assistant finding (weekly-review.md §7): its evidence object without the day counters. */
export function evidenceHash(evidence: Record<string, unknown>): string {
  return hashOf(Object.fromEntries(Object.entries(evidence).filter(([key]) => !COUNTERS.has(key))));
}

/** The step of a lateness (§7 rule 3): 0 below 7 days, then 1 at 7, 2 at 14, 3 at 28, and one more every 28 days. */
export function lateStep(days: number): number {
  if (days < 7) return 0;
  if (days < 14) return 1;
  if (days < 28) return 2;
  return 3 + Math.floor((days - 28) / 28);
}

/** §7: whether a finding shown before may be an item again, and why. `critical` is the knowledge stream's rule 4. */
export function repetitionOf(input: {
  key: string; category: string; evidenceHash: string; daysLate?: number; daysIdle?: number; critical?: boolean;
  state: WeeklyState | null; week: string; pending: string | null;
}): Repetition {
  const base = { pending: input.pending, evidence_hash: input.evidenceHash };
  const items = input.state?.weeks[input.week]?.items ?? [];
  const shown = input.state?.shown.find((entry) => entry.key === input.key) ?? null;
  if (items.includes(input.key)) return { show: true, because: "this_week", shown: shown?.week ?? input.week, ...base };
  if (shown === null) return { show: true, because: "new", shown: null, ...base };
  const again = (because: string): Repetition => ({ show: true, because, shown: shown.week, ...base });
  if (shown.evidence_hash !== input.evidenceHash) return again("evidence");
  if (input.category === "overdue" && shown.category !== "overdue") return again("overdue");
  if (input.daysLate !== undefined && lateStep(input.daysLate) > lateStep(shown.days_late ?? 0)) return again("urgency");
  if (input.daysIdle !== undefined && shown.days_idle !== undefined && shown.days_idle > 0 && input.daysIdle >= 2 * shown.days_idle) return again("urgency");
  if (input.critical === true) return again("critical");
  return { show: false, because: null, shown: shown.week, ...base };
}

/** The window of weekly-review.md §4.1, with the keys a change on `from`'s date must not have (the boundary day). */
export function windowOf(state: WeeklyState | null, week: string, now: Date): { from: string; to: string; first: boolean; days: number; skip: Set<string>; inclusive: boolean } {
  const to = formatTimestamp(now);
  const days = (from: string) => Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / DAY_MS));
  const earlier = (candidate: string) => compareCodePoints(candidate, week) < 0;
  const thisWeek = state?.weeks[week];
  if (thisWeek !== undefined) {
    const first = !Object.keys(state!.weeks).some(earlier);
    return { from: thisWeek.window_from, to, first, days: days(thisWeek.window_from), skip: new Set(thisWeek.window_skip), inclusive: first };
  }
  const last = state?.last_success ?? null;
  if (last !== null && earlier(last.week)) return { from: last.covered_to, to, first: false, days: days(last.covered_to), skip: new Set(last.covered_on_to), inclusive: false };
  const from = formatTimestamp(new Date(now.getTime() - 7 * DAY_MS));
  return { from, to, first: true, days: 7, skip: new Set(), inclusive: true };
}

export interface PlanInput {
  snapshot: Snapshot;
  notes: readonly Note[];
  loaded: Pick<Loaded, "suppressions"> & Partial<Pick<Loaded, "restores">>;
  config: Record<string, unknown>;
  dismissals: readonly Dismissal[];
  state: WeeklyState | null;
  now: Date;
  /** The titles changed since the cursor, read from Git by the caller (weekly-review.md §8.1); none when absent. */
  titles?: readonly TitleChange[];
}

/** The correction cursor a plan reads (weekly-review.md §8.1): as this week's first report found it on a rerun, else the state's. */
export function correctionCursor(state: WeeklyState | null, week: string): Cursor {
  return state?.weeks[week]?.corrections_from ?? state?.corrections ?? { checked_on: null, done_on_date: [], open: [] };
}

/** The date from which titles are read from Git (§8.1): the cursor's date, else the window's. */
export function titlesSince(state: WeeklyState | null, now: Date): string {
  const week = isoWeek(localDate(now));
  return correctionCursor(state, week).checked_on ?? windowOf(state, week, now).from.slice(0, 10);
}

export function computePlan(input: PlanInput): PlanData {
  const { snapshot, notes, config, state, now } = input;
  const live = snapshot.notion === "live";
  const local = localDate(now);
  const week = isoWeek(local);
  const settings = weeklySettings(config);
  const window = windowOf(state, week, now);
  const fromDate = window.from.slice(0, 10);
  const toDate = window.to.slice(0, 10);
  /** A dated change is in the window when after from's date, or on it and not covered by the report that ended there (§4.1). */
  const inWindow = (date: string | null, key: string): boolean => date !== null && date <= toDate && (date > fromDate || (date === fromDate && (window.inclusive || !window.skip.has(key))));
  const datedIn = (date: string | null): boolean => date !== null && date >= fromDate && date <= toDate;

  const eligible = reflectionNotes(notes, input.loaded);
  const byId = new Map(eligible.map((note) => [note.id, note]));
  const proposals = notes.filter((note) => note.type === "proposal");

  // ---- What changed (§4.2)
  const changes: Change[] = [];
  const add = (change: Omit<Change, "weight" | "bullet">) => { if (!changes.some((other) => other.key === change.key)) changes.push({ ...change, weight: WEIGHT[change.kind], bullet: false }); };
  const fromNote = (note: Note) => ({ ref: note.id, title: String(note.attributes.title ?? note.id), path: note.path, url: null, ...(note.attributes.lifecycle === "draft" ? { draft: true } : {}) });
  const archivedOrMoved = (note: Note) => note.attributes.lifecycle === "archived" || note.path.startsWith("archive/");
  for (const note of eligible) {
    if (note.type === "decision" && !archivedOrMoved(note)) {
      const key = `decided:${note.id}`;
      const created = dateOf(note.attributes.created);
      const dated = dateOf(note.attributes.date);
      const date = inWindow(created, key) ? created : inWindow(dated, key) ? dated : null;
      if (date !== null) add({ key, kind: "decided", date, ...fromNote(note) });
    }
    if (note.type === "question" && !archivedOrMoved(note)) {
      const key = `open:${note.id}`;
      const created = dateOf(note.attributes.created);
      if (inWindow(created, key)) add({ key, kind: "open", date: created!, ...fromNote(note) });
    }
    const timeline = list(note.attributes.timeline).filter(isRecord);
    timeline.forEach((entry, index) => {
      if (entry.assessment !== "accepted" || typeof entry.field !== "string") return;
      const learned = dateOf(entry.learned);
      const key = `changed:${note.id}:${entry.field}:${learned}`;
      if (!inWindow(learned, key)) return;
      const earlier = timeline.slice(0, index).filter((other) => other.field === entry.field && JSON.stringify(other.value) !== JSON.stringify(entry.value));
      if (earlier.length === 0) return;
      add({ key, kind: "changed", date: learned!, field: entry.field, before: earlier.at(-1)!.value, after: entry.value, ...fromNote(note) });
    });
  }
  for (const proposal of proposals) {
    const a = proposal.attributes;
    if (a.status !== "applied") continue;
    const applied = dateOf(a.updated);
    const target = typeof a.target === "string" ? byId.get(a.target) : undefined;
    if (target === undefined) continue;
    if (a.kind === "supersede" && target.type === "decision") {
      const key = `decided:${target.id}`;
      if (inWindow(applied, key)) add({ key, kind: "decided", date: applied!, ...fromNote(target) });
    }
    if (a.kind === "answer" && target.type === "question") {
      const key = `answered:${target.id}`;
      if (inWindow(applied, key)) add({ key, kind: "answered", date: applied!, ...fromNote(target) });
    }
  }
  const tasksOn = modulesOf(config).tasks;
  const stateOf = taskStateOf(snapshot, config);
  const openTasks = live && tasksOn ? (snapshot.tasks ?? []).filter((task) => { const s = stateOf(task.status); return s !== "done" && s !== "dropped"; }) : [];
  for (const task of openTasks) {
    const key = `next:notion:${task.page_id}`;
    const created = dateOf(task.created);
    const dueSoon = task.due !== null && task.due >= local && task.due <= addDays(local, 7);
    if (inWindow(created, key) || dueSoon) add({ key, kind: "next", ref: `notion:${task.page_id}`, title: task.title, path: null, url: taskUrl(task.page_id), date: dueSoon ? task.due! : created! });
  }
  changes.sort((a, b) => b.weight - a.weight || compareCodePoints(b.date, a.date) || compareCodePoints(a.key, b.key));
  changes.forEach((change, index) => { change.bullet = index < BULLETS; });

  const inputs = { meetings: 0, sources: 0 };
  for (const note of eligible) {
    if (note.type === "meeting" && datedIn(dateOf(note.attributes.date))) inputs.meetings += 1;
    if (note.type === "source" && note.attributes.kind !== "minutes" && datedIn(dateOf(note.attributes.captured))) inputs.sources += 1;
  }

  // ---- Assistant findings (§5.31's rules, every finding) with their repetition (§7)
  const result = computeFindings({ snapshot, notes, config, dismissals: input.dismissals, scope: null, exclude: new Set(), limit: Number.MAX_SAFE_INTEGER, numberFrom: 1 });
  const pendingBy = new Map<string, string>();
  for (const proposal of [...proposals].sort((a, b) => compareCodePoints(a.id, b.id))) {
    if (proposal.attributes.status !== "pending") continue;
    for (const field of ["finding", "fingerprint", "correction"] as const) {
      const value = proposal.attributes[field];
      if (typeof value === "string") { const key = field === "correction" ? `correction:${value}` : value; if (!pendingBy.has(key)) pendingBy.set(key, proposal.id); }
    }
  }
  const findings = result.findings.map((finding: RankedFinding) => {
    const evidence = finding.evidence;
    const days = (name: string) => (typeof evidence[name] === "number" ? evidence[name] as number : undefined);
    const repetition = repetitionOf({ key: finding.key, category: finding.category, evidenceHash: evidenceHash(evidence), daysLate: days("days_late"), daysIdle: days("days_idle"), state, week, pending: pendingBy.get(finding.key) ?? null });
    return {
      rank: finding.rank, key: finding.key, signal: finding.signal, category: finding.category, subject: finding.subject,
      project: finding.project, area: finding.area, evidence, recommendations: finding.recommendations, status_offers: finding.status_offers, repetition,
    };
  });

  // ---- Task analysis candidates (§3.3)
  const subjectOf = (finding: RankedFinding): Subject => ({
    key: finding.key, title: finding.text.title,
    url: TASK_SIGNALS.has(finding.signal) && typeof finding.subject.page_id === "string" ? taskUrl(finding.subject.page_id) : null,
    evidence: finding.text.evidence,
  });
  const ofSignals = (...signals: string[]) => result.findings.filter((finding) => signals.includes(finding.signal)).slice(0, 3).map(subjectOf);
  const blocked = openTasks.filter((task) => stateOf(task.status) === "waiting")
    .sort((a, b) => compareCodePoints(a.last_edited, b.last_edited) || compareCodePoints(a.page_id, b.page_id)).slice(0, 3)
    .map((task) => ({ key: `blocked:notion:${task.page_id}`, title: task.title, url: taskUrl(task.page_id), evidence: `waiting since ${task.last_edited.slice(0, 10)}` }));
  const task_analysis = {
    overdue: ofSignals("task_overdue"),
    stalled: ofSignals("project_stalled", "task_stalled"),
    blocked,
    no_next_step: ofSignals("project_no_next_step", "project_done_but_open"),
    order: result.findings.filter((finding) => finding.category !== "structure").slice(0, 3).map(subjectOf),
  };

  // ---- Reflection clusters in the window, carried ones first (§4.1, §10)
  const candidates = reflectCandidates(notes, input.loaded, now, Number.MAX_SAFE_INTEGER, 0);
  const carry = new Set(state?.carry.clusters ?? []);
  const clusterDates = (cluster: Record<string, unknown>): string[] => [
    ...list(cluster.notes).filter(isRecord).map((member) => dateOf(member.updated)),
    ...list(cluster.evidence).filter(isRecord).map((item) => dateOf(item.date)),
  ].filter((date): date is string => date !== null);
  const carried = candidates.clusters.filter((cluster) => carry.has(cluster.key));
  const windowed = candidates.clusters.filter((cluster) => !carry.has(cluster.key) && clusterDates(cluster).some(datedIn));
  const ordered = [...carried.map((cluster) => ({ ...cluster, carried: true })), ...windowed.map((cluster) => ({ ...cluster, carried: false }))];
  const clusters = ordered.slice(0, settings.max_judged);
  const clusters_left = ordered.slice(settings.max_judged).map((cluster) => cluster.key);

  // ---- The correction queue (§8): claims new to the cursor, or still open, with their candidate targets
  const corrections = computeClaims({ eligible, all: notes, cursor: correctionCursor(state, week), windowFrom: fromDate, titles: input.titles ?? [] });

  // ---- This week, pending proposals and the earlier ones still open (§5.1, §7)
  const thisWeek = state?.weeks[week];
  const week_state = { counts: thisWeek?.counts ?? { ...ZERO }, items: thisWeek?.items ?? [] };
  const pending = [...pendingBy].map(([key, proposal]) => ({ key, proposal })).sort((a, b) => compareCodePoints(a.key, b.key));
  const shownKeys = new Set((state?.shown ?? []).map((entry) => entry.key));
  const showing = new Set(findings.filter((finding) => finding.repetition.show).map((finding) => finding.key));
  const earlier_open = pending.filter((entry) => shownKeys.has(entry.key) && !showing.has(entry.key) && !week_state.items.includes(entry.key)).length;

  // ---- input_hash and quiet (§9.1)
  const input_hash = hashOf({
    changes: changes.map(({ key, date, before, after }) => ({ key, date, before, after })),
    findings: findings.map((finding) => ({ key: finding.key, evidence: finding.evidence, current: isRecord(finding.subject) ? finding.subject.current ?? null : null })),
    clusters: ordered.map((cluster) => ({ key: cluster.key, notes: list(cluster.notes).filter(isRecord).map((member) => [member.id, member.updated]), evidence: list((cluster as Record<string, unknown>).evidence).filter(isRecord).map((item) => [item.id, item.date]) })),
    blocked: blocked.map((subject) => subject.key),
    corrections: corrections.map((claim) => ({ claim: claim.claim, old: claim.old, new: claim.new, targets: claim.targets.map(({ note, field, line, before_hash }) => ({ note, field, line, before_hash })) })),
  });
  // §7 rule 4: an unresolved contradiction on a reviewed note stays visible every week, so it holds off a quiet week too.
  const critical = criticalPending(pending, new Map([...proposals, ...eligible].map((note) => [note.id, note])));
  // A correction target already in Review is no queued check: it doesn't hold off a quiet week (§9.1).
  const queuedTargets = corrections.some((claim) => claim.targets.some((target) => target.pending === null));
  const nothing = changes.length === 0 && !findings.some((finding) => finding.repetition.show) && ordered.length === 0 && critical.length === 0 && !queuedTargets;
  // A finding that can only be in Task analysis is "shown" once a report listed it (record keeps it in `shown`), so it doesn't hold off a quiet week.
  const unchanged = thisWeek !== undefined && thisWeek.input_hash === input_hash;
  const quiet = live && (nothing || unchanged);

  return {
    week, as_of: formatTimestamp(now), local_date: local, notion: snapshot.notion,
    window: { from: window.from, to: window.to, first: window.first, days: window.days },
    report: thisWeek === undefined ? null : { id: thisWeek.report, path: thisWeek.path },
    changes, inputs, findings, skipped_signals: result.skipped_signals, task_analysis, clusters, clusters_left, corrections,
    pending, week_state, earlier_open, budget: { minutes: settings.minutes, max_judged: settings.max_judged }, input_hash, quiet,
  };
}

/**
 * The pending contradiction proposals on a reviewed note (§7 rule 4): they stay decision items every week while unresolved, even once the
 * cluster that found them is out of the window. The fingerprint is the key, so a judged finding of this week replaces it.
 */
export function criticalPending(pending: ReadonlyArray<{ key: string; proposal: string }>, byId: ReadonlyMap<string, Note>): Array<{ key: string; proposal: Note; target: string }> {
  const out: Array<{ key: string; proposal: Note; target: string }> = [];
  for (const entry of pending) {
    if (!entry.key.startsWith("contradiction:")) continue;
    const proposal = byId.get(entry.proposal);
    const target = proposal?.attributes.target;
    if (proposal === undefined || typeof target !== "string" || byId.get(target)?.attributes.lifecycle !== "reviewed") continue;
    out.push({ key: entry.key, proposal, target });
  }
  return out;
}

export { str };
