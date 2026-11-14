import { posix } from "node:path";

import type { InputProblem } from "./input.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { itemShape, type PlanData } from "./weekly-plan.ts";
import type { Item, Selection } from "./weekly-select.ts";
import { addDays, isoWeek, KEEP_SHOWN_WEEKS, KEEP_WEEKS, localDate, mondayOf, weeksBetween, type WeeklyState } from "./weekly-state.ts";

// `brain weekly record`: the report's body (spec/weekly-review.md §3), its shape check and word cap (§3.4), and the next state (§9.5).

export const MAX_WORDS = 450;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LABELS = ["Decided", "Changed", "Open", "Answered", "Next"];
const TASK_LABELS = ["Overdue", "Stalled", "Blocked", "No next step"];
const DATED = new RegExp(`\\b\\d{1,2} (${MONTHS.join("|")})\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b`);
const NOTION_PAGE = /^https:\/\/www\.notion\.so\/[0-9a-f]{32}$/;

export interface RecordInput {
  plan: PlanData; selection: Selection; proposals: Array<{ key: string; proposal: string }>;
  what_changed: string[]; task_analysis: string[]; mode: "attended" | "unattended"; publish: boolean; failures: string[]; notes_read: number; seconds: number;
}

/** `9 Nov 2026`. */
export function dayMonthYear(date: string): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** The report's title (§2): `Weekly review · 9–15 Nov 2026`, or `30 Nov–6 Dec 2026` across a month, `29 Dec 2025–4 Jan 2026` across a year. */
export function weeklyTitle(monday: string): string {
  const sunday = addDays(monday, 6);
  const [y1, m1, d1] = monday.split("-").map(Number) as [number, number, number];
  const [y2, m2, d2] = sunday.split("-").map(Number) as [number, number, number];
  const range = y1 !== y2 ? `${d1} ${MONTHS[m1 - 1]} ${y1}–${d2} ${MONTHS[m2 - 1]} ${y2}` : m1 !== m2 ? `${d1} ${MONTHS[m1 - 1]}–${d2} ${MONTHS[m2 - 1]} ${y2}` : `${d1}–${d2} ${MONTHS[m2 - 1]} ${y2}`;
  return `Weekly review · ${range}`;
}

/** `Mon 2 Nov 08:04`, in the machine's time zone. */
function localStamp(timestamp: string): string {
  const at = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${WEEKDAYS[at.getDay()]} ${at.getDate()} ${MONTHS[at.getMonth()]} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** The checks of cli.md §5.34 and the shape check of weekly-review.md §3.4 that need no file: [] when the input may be recorded. */
export function recordProblems(input: RecordInput, now: Date, current: WeeklyState | null, notes: ReadonlyMap<string, Note>, reportsOn: boolean): InputProblem[] {
  const problems: InputProblem[] = [];
  const { plan, selection } = input;
  if (selection.week !== plan.week) problems.push({ pointer: "/selection/week", message: `is ${selection.week}, but the plan's week is ${plan.week}` });
  if (plan.quiet) problems.push({ pointer: "/plan/quiet", message: "is true: a quiet run writes nothing (weekly-review.md §9.1)" });
  if (isoWeek(localDate(now)) !== plan.week) problems.push({ pointer: "/plan/week", message: `is not this week (${isoWeek(localDate(now))}): plan again` });
  selection.items.forEach((item, index) => { if (item.n !== index + 1) problems.push({ pointer: `/selection/items/${index}/n`, message: `must be ${index + 1}` }); });
  if (selection.counts.decisions < selection.items.length) problems.push({ pointer: "/selection/counts/decisions", message: "is less than the number of items" });
  const writes = new Map(selection.items.filter((item) => item.write).map((item) => [item.key, item]));
  const named = new Map<string, string>();
  input.proposals.forEach((entry, index) => {
    if (!writes.has(entry.key)) problems.push({ pointer: `/proposals/${index}/key`, message: `${entry.key} is no item with write true` });
    if (named.has(entry.key)) problems.push({ pointer: `/proposals/${index}/key`, message: `${entry.key} is named twice` });
    named.set(entry.key, entry.proposal);
    const note = notes.get(entry.proposal);
    if (note === undefined || note.type !== "proposal") problems.push({ pointer: `/proposals/${index}/proposal`, message: `no proposal with id ${entry.proposal}` });
    else if (note.attributes.status !== "pending") problems.push({ pointer: `/proposals/${index}/proposal`, message: `${entry.proposal} is ${String(note.attributes.status)}, not pending` });
  });
  for (const key of writes.keys()) if (!named.has(key)) problems.push({ pointer: "/proposals", message: `the item ${key} has write true and no proposal` });
  selection.items.forEach((item, index) => {
    if (item.proposal === null) return;
    const note = notes.get(item.proposal);
    if (note === undefined || note.type !== "proposal") problems.push({ pointer: `/selection/items/${index}/proposal`, message: `no proposal with id ${item.proposal}` });
  });
  if (input.publish && !reportsOn) problems.push({ pointer: "/publish", message: "is true with the Reports module off: the weekly report is never published then (weekly-review.md §9.3)" });
  const thisWeek = current?.weeks[plan.week];
  const sameCounts = JSON.stringify(thisWeek?.counts ?? { decisions: 0, new_items: 0, targets: 0, queued: 0 }) === JSON.stringify(plan.week_state.counts);
  const sameItems = JSON.stringify(thisWeek?.items ?? []) === JSON.stringify(plan.week_state.items);
  if (!sameCounts || !sameItems) problems.push({ pointer: "/plan/week_state", message: "this week's state changed since the plan: plan again" });
  return problems;
}

/** The link target of an item (§3.4): a relative link from reports/ to its proposal file, its task's page, or none (brain only). */
function itemLine(item: Item, proposalPath: (id: string) => string | undefined): string {
  const shown = item.shown_of === undefined ? "" : ` (${item.shown_of.k} of ${item.shown_of.size} shown)`;
  const head = `${item.n}. ${item.kind} · ${item.subject} · ${item.decide}${shown}`;
  if (item.lives === "task") return item.url === null ? `${head} → ${item.subject} (brain only: no link)` : `${head} → [the task](${item.url})`;
  const path = proposalPath(item.proposal!);
  return `${head} → [Review](${posix.relative("reports", path ?? "")})`;
}

export interface Rendered { body: string; header: [string, string]; problems: InputProblem[]; words: number }

/** The body of weekly-review.md §3: the header and What needs your decision rendered here, the skill's two sections checked. */
export function renderBody(input: RecordInput, proposalOf: (key: string) => string, notes: ReadonlyMap<string, Note>, byPath: ReadonlyMap<string, Note>): Rendered {
  const { plan, selection } = input;
  const problems: InputProblem[] = [];
  const monday = mondayOf(plan.local_date);
  const since = plan.window.first ? "first review, last 7 days" : `changes since ${localStamp(plan.window.from)}`;
  const line1 = `Week of ${dayMonthYear(monday)} · ${since} · ${plan.notion === "live" ? "Notion read live" : "Notion unreachable: brain only"}`;
  const total = plan.changes.length;
  const notShown = plan.changes.filter((change) => !change.bullet);
  const byLabel = LABELS.map((label) => [label, notShown.filter((change) => change.kind === label.toLowerCase()).length] as const).filter(([, n]) => n > 0);
  const partial = selection.omitted.clusters.length + selection.omitted.correction_targets;
  const line2 = [
    plan.window.days > 14 ? `${plan.window.days} days since the last review.` : "",
    `Covered: ${total} change${total === 1 ? "" : "s"} from ${plan.inputs.meetings} meeting${plan.inputs.meetings === 1 ? "" : "s"} and ${plan.inputs.sources} source${plan.inputs.sources === 1 ? "" : "s"}.`,
    notShown.length > 0 ? `${notShown.length} not shown: ${byLabel.map(([label, n]) => `${n} ${label.toLowerCase()}`).join(", ")}.` : "",
    selection.earlier_open > 0 ? `${selection.earlier_open} more decision${selection.earlier_open === 1 ? "" : "s"} wait in Review from earlier weeks.` : "",
    partial > 0 ? `Partial: ${partial} check${partial === 1 ? "" : "s"} not done (budget); they come first next week.` : "",
  ].filter((part) => part !== "").join(" ");

  // The skill's What changed (§3.2): labels in order, each bullet linked and dated.
  const taskUrls = new Set([...plan.changes.map((change) => change.url), ...Object.values(plan.task_analysis).flat().map((subject) => subject.url)].filter((url): url is string => url !== null));
  const linkProblems = (line: string, pointer: string) => {
    for (const match of line.matchAll(/\]\(\s*<?([^)\s>]+)>?\s*\)/g)) {
      const target = match[1]!;
      if (NOTION_PAGE.test(target)) { if (!taskUrls.has(target)) problems.push({ pointer, message: `${target} is no task page of the plan` }); continue; }
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) { problems.push({ pointer, message: `${target} is neither a note nor a task page` }); continue; }
      let decoded = target.split(/[?#]/)[0]!;
      try { decoded = decodeURIComponent(decoded); } catch { /* keep */ }
      if (!byPath.has(posix.normalize(posix.join("reports", decoded)))) problems.push({ pointer, message: `link ${target} doesn't resolve to a note` });
    }
  };
  const nothingNew = input.what_changed.length === 1 && input.what_changed[0] === "- Nothing new this week.";
  if (!nothingNew) {
    let last = -1;
    input.what_changed.forEach((line, index) => {
      const pointer = `/what_changed/${index}`;
      const label = /^- \*\*([A-Za-z]+):\*\*/.exec(line)?.[1];
      const at = label === undefined ? -1 : LABELS.indexOf(label);
      if (at === -1) { problems.push({ pointer, message: `must start - **<${LABELS.join("|")}>:**` }); return; }
      if (at < last) problems.push({ pointer, message: `${label} comes after ${LABELS[last]}: the labels go ${LABELS.join(", ")}` });
      last = Math.max(last, at);
      if (!/\]\(/.test(line)) problems.push({ pointer, message: "cites no note or task: every bullet links what it rests on" });
      if (!DATED.test(line)) problems.push({ pointer, message: "carries no date: every bullet says when (its freshness)" });
      linkProblems(line, pointer);
    });
  }

  // The skill's Task analysis (§3.3): up to 4 category bullets in order, then Order of attention with 1 to 3 lines; or the no-problem line.
  const task = input.task_analysis;
  if (!(task.length === 1 && task[0] === "- No overdue, stalled or blocked work.")) {
    let index = 0;
    let lastLabel = -1;
    while (index < task.length && task[index]!.startsWith("- ")) {
      const label = /^- \*\*([A-Za-z ]+):\*\*/.exec(task[index]!)?.[1];
      const at = label === undefined ? -1 : TASK_LABELS.indexOf(label);
      if (at <= lastLabel) problems.push({ pointer: `/task_analysis/${index}`, message: `must be one of - **${TASK_LABELS.join(":**, - **")}:**, once each, in that order` });
      lastLabel = Math.max(lastLabel, at);
      linkProblems(task[index]!, `/task_analysis/${index}`);
      index += 1;
    }
    if (task[index] === "") index += 1;
    if (task[index] !== "Order of attention:") problems.push({ pointer: `/task_analysis/${index}`, message: "must be Order of attention: after the category bullets and a blank line" });
    else {
      index += 1;
      let n = 0;
      while (index < task.length && new RegExp(`^${n + 1}\\. \\S`).test(task[index]!)) { linkProblems(task[index]!, `/task_analysis/${index}`); n += 1; index += 1; }
      if (n < 1 || n > 3) problems.push({ pointer: "/task_analysis", message: "Order of attention has 1 to 3 numbered lines" });
      if (index < task.length) problems.push({ pointer: `/task_analysis/${index}`, message: "nothing follows the order of attention" });
    }
  }

  // What needs your decision (§3.4), rendered here.
  const proposalPath = (id: string) => notes.get(id)?.path;
  const decision = selection.items.length === 0 ? ["- Nothing needs your decision this week."] : selection.items.map((item) => itemLine({ ...item, proposal: item.proposal ?? proposalOf(item.key) }, proposalPath));
  const after = [
    selection.queued.length > 0 ? `${selection.queued.length} more finding${selection.queued.length === 1 ? "" : "s"} wait${selection.queued.length === 1 ? "s" : ""} for next week. Say "weekly review more" in a session for the rest.` : "",
    selection.earlier_open > 0 ? `${selection.earlier_open} earlier finding${selection.earlier_open === 1 ? " is" : "s are"} still open in Review.` : "",
    partial > 0 ? `Partial: ${partial} check${partial === 1 ? "" : "s"} not done (budget); they come first next week.` : "",
  ].filter((line) => line !== "");

  const sections = [
    "## What changed", ...input.what_changed, "",
    "## Task analysis", ...input.task_analysis, "",
    "## What needs your decision", ...decision, ...(after.length > 0 ? ["", ...after] : []),
  ];
  const body = `${line1}\n${line2}\n\n${sections.join("\n")}\n`;
  return { body, header: [line1, line2], problems, words: wordCount(sections.join("\n")) };
}

/** Words of the body without its header and link targets (§3.4): tokens holding a letter or a digit. */
export function wordCount(text: string): number {
  return text.replace(/\]\(\s*<?[^)\s>]+>?\s*\)/g, "]").split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** The state after a recorded run (§9.5). */
export function nextState(current: WeeklyState, input: RecordInput, report: { id: string; path: string }): WeeklyState {
  const { plan, selection } = input;
  const week = plan.week;
  const previous = current.weeks[week];
  const windowSkip = previous?.window_skip ?? (current.last_success !== null && compareCodePoints(current.last_success.week, week) < 0 ? current.last_success.covered_on_to : []);
  const items = [...new Set([...(previous?.items ?? []), ...selection.items.map((item) => item.key)])];
  const weeks = { ...current.weeks, [week]: { report: report.id, path: report.path, window_from: plan.window.from, window_skip: windowSkip, input_hash: plan.input_hash, counts: selection.counts, items } };
  const kept = Object.keys(weeks).sort(compareCodePoints).slice(-KEEP_WEEKS);
  const toDate = plan.window.to.slice(0, 10);

  // shown: the decision items, and the findings a report can only list in Task analysis (so they don't hold off a quiet week, §9.1).
  const shown = new Map(current.shown.map((entry) => [entry.key, entry]));
  for (const item of selection.items) shown.set(item.key, { key: item.key, week, category: item.category, evidence_hash: item.evidence_hash, ...(item.days_late === undefined ? {} : { days_late: item.days_late }), ...(item.days_idle === undefined ? {} : { days_idle: item.days_idle }) });
  for (const finding of plan.findings) {
    if (!finding.repetition.show || itemShape(finding as unknown as { signal: string; subject: unknown; recommendations: unknown }) !== null) continue;
    const evidence = finding.evidence as Record<string, unknown>;
    shown.set(finding.key, { key: finding.key, week, category: finding.category, evidence_hash: finding.repetition.evidence_hash, ...(typeof evidence.days_late === "number" ? { days_late: evidence.days_late } : {}), ...(typeof evidence.days_idle === "number" ? { days_idle: evidence.days_idle } : {}) });
  }
  const recent = [...shown.values()].filter((entry) => weeksBetween(entry.week, week) < KEEP_SHOWN_WEEKS).sort((a, b) => compareCodePoints(a.key, b.key));

  return {
    version: 1,
    last_success: { week, report: report.id, covered_to: plan.window.to, covered_on_to: plan.changes.filter((change) => change.date === toDate).map((change) => change.key).sort(compareCodePoints), coverage: selection.coverage },
    weeks: Object.fromEntries(kept.map((key) => [key, weeks[key]!])),
    shown: recent,
    queued: selection.queued.map((entry) => ({ key: entry.key, week })),
    carry: { clusters: [...selection.omitted.clusters] },
    corrections: current.corrections,
  };
}
