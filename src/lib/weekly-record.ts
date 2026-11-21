import { posix } from "node:path";

import { isRecord, type InputProblem } from "./input.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { pastTitle } from "./tidy.ts";
import { nextCursor } from "./weekly-corrections.ts";
import { correctionCursor, type CarryEntry, type PlanData } from "./weekly-plan.ts";
import { CAPS, type Item, type Selection } from "./weekly-select.ts";
import { addDays, isoWeek, KEEP_SHOWN_WEEKS, KEEP_WEEKS, localDate, mondayOf, mondayOfWeek, weeksBetween, type RowSlot, type WeeklyState } from "./weekly-state.ts";

// `brain weekly record`: the report's body (spec/weekly-review.md §3: Your week, then Clean-up), its shape check and word cap (§3.3), the row's
// labels and bases, the carry-over (§15.6), and the next state (§9.5).

export const MAX_WORDS = 450;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LABELS = ["Decided", "Changed", "Open", "Answered", "Next"];
const HIGHLIGHTS = 6;
const DONE_LINES = 6;
const FOCUS_LINES = 3;
const LINE_CHARS = 200;
const DATED = new RegExp(`\\b\\d{1,2} (${MONTHS.join("|")})\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b`);
const NOTION_PAGE = /^https:\/\/www\.notion\.so\/[0-9a-f]{32}$/;

/** A mechanical item `cleanup apply` applied in this run (its `data.applied`, as returned). */
export interface Cleaned { proposal: string; tidy: string; title: string; commit: string }
export interface RecordInput {
  plan: PlanData; selection: Selection; proposals: Array<{ key: string; proposal: string }>;
  in_short: string; highlights: string[]; focus_first: string[]; cleaned: Cleaned[];
  mode: "attended" | "unattended"; publish: boolean; failures: string[]; notes_read: number; seconds: number;
}
export const NOTHING_NEW = "- Nothing new this week.";
export const NO_PROBLEM = "- No overdue, stalled or blocked work.";

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

/** The checks of cli.md §5.34 and the shape check of weekly-review.md §3.3 that need no file: [] when the input may be recorded. */
export function recordProblems(input: RecordInput, now: Date, current: WeeklyState | null, notes: ReadonlyMap<string, Note>, publishAuto: boolean): InputProblem[] {
  const problems: InputProblem[] = [];
  const { plan, selection } = input;
  if (selection.week !== plan.week) problems.push({ pointer: "/selection/week", message: `is ${selection.week}, but the plan's week is ${plan.week}` });
  if (selection.input_hash !== plan.input_hash) problems.push({ pointer: "/selection/input_hash", message: "the selection was made from another plan: select again" });
  if (plan.quiet) problems.push({ pointer: "/plan/quiet", message: "is true: a quiet run writes nothing (weekly-review.md §9.1)" });
  if (isoWeek(localDate(now)) !== plan.week) problems.push({ pointer: "/plan/week", message: `is not this week (${isoWeek(localDate(now))}): plan again` });
  selection.items.forEach((item, index) => { if (item.n !== index + 1) problems.push({ pointer: `/selection/items/${index}/n`, message: `must be ${index + 1}` }); });
  const parts = { A: selection.items.filter((item) => item.part === "A").length, C: selection.items.filter((item) => item.part === "C").length };
  if (selection.counts.actions < parts.A) problems.push({ pointer: "/selection/counts/actions", message: "is less than the number of Actions" });
  if (selection.counts.doubtful < parts.C) problems.push({ pointer: "/selection/counts/doubtful", message: "is less than the number of doubtful items" });
  if (parts.A > CAPS.A) problems.push({ pointer: "/selection/items", message: `holds ${parts.A} Actions, over ${CAPS.A}` });
  if (parts.C > CAPS.C) problems.push({ pointer: "/selection/items", message: `holds ${parts.C} doubtful items, over ${CAPS.C}` });
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
  const cleaned = new Set<string>();
  input.cleaned.forEach((entry, index) => {
    const note = notes.get(entry.proposal);
    const decision = note !== undefined && isRecord(note.attributes.decision) ? note.attributes.decision : {};
    if (note === undefined || note.type !== "proposal" || note.attributes.status !== "applied" || decision.decided_by !== "cleanup") problems.push({ pointer: `/cleaned/${index}/proposal`, message: `${entry.proposal} is no clean-up item applied alone` });
    if (cleaned.has(entry.proposal)) problems.push({ pointer: `/cleaned/${index}/proposal`, message: `${entry.proposal} is listed twice` });
    cleaned.add(entry.proposal);
  });
  // The report is the week's Inbox row, whatever the modules; an unattended run publishes it only with settings.publish auto (weekly-review.md §9.3).
  if (input.publish && input.mode === "unattended" && !publishAuto) problems.push({ pointer: "/publish", message: "is true from an unattended run while settings.publish isn't auto: the report waits for the next attended publish (weekly-review.md §9.3)" });
  const thisWeek = current?.weeks[plan.week];
  const sameCounts = JSON.stringify(thisWeek?.counts ?? { actions: 0, doubtful: 0, cleaned: 0, targets: 0, queued: 0 }) === JSON.stringify(plan.week_state.counts);
  const sameItems = JSON.stringify(thisWeek?.items ?? []) === JSON.stringify(plan.week_state.items);
  if (!sameCounts || !sameItems) problems.push({ pointer: "/plan/week_state", message: "this week's state changed since the plan: plan again" });
  return problems;
}

/** One to-do of the row (§3.3): its label, the proposal it maps to, and the line's text without the to-do box. */
export interface RowLine { label: string; proposal: string; text: string }
export interface Row { A: RowLine[]; C: RowLine[]; U: RowLine[]; slots: Record<string, RowSlot>; moved: Map<string, CarryEntry[]>; queuedCarried: string[]; dropped: string[] }

const clip = (text: string, room: number): string => (text.length <= room ? text : `${text.slice(0, Math.max(1, room - 1)).trimEnd()}…`);
const titleOf = (get: (id: string) => Note | undefined, id: unknown): string => String(get(String(id))?.attributes.title ?? id);
const quote = (text: string) => `"${text}"`;

/** What the change does, in words (§3.3, §15.5): the whole change, from the proposal. */
export function changeText(a: Record<string, unknown>, get: (id: string) => Note | undefined): string {
  const target = titleOf(get, a.target);
  switch (a.kind) {
    case "new_task": return `Add the next step ${quote(String(a.task_title))} to ${target}`;
    case "notion_change": return a.property === "Status" ? `Set ${String(a.page_title ?? "the page")} ${String(a.value_after)}` : `Set ${String(a.property)} of ${String(a.page_title ?? "the page")} to ${JSON.stringify(a.value_after)}`;
    case "new_item": return `Draft a Document on ${String(isRecord(a.note) ? a.note.title : a.title)}`;
    case "merge": return `Merge ${quote(target)} into ${quote(titleOf(get, a.merge_into))}`;
    case "set_field": {
      const value = typeof a.after === "string" && get(a.after) !== undefined ? titleOf(get, a.after) : JSON.stringify(a.after);
      return a.field === "area" || a.field === "domain" ? `Move ${target} to ${value}` : `Set ${target}'s ${String(a.field)} to ${value}`;
    }
    case "update_fact": return `Set ${target}'s ${String(a.field).replace(/^facts\./, "").replaceAll("_", " ")} to ${quote(String(a.after))}`;
    case "add_to_note": return `Add to ${target}: ${quote(String(a.content ?? "").split("\n").find((line) => line.trim() !== "")?.replace(/^\s*[-*]\s+/, "") ?? "")}`;
    default: return String(a.title ?? a.kind);
  }
}

/** Why the mechanical item was applied, short (§3.3 Already cleaned). */
function cleanedReason(tidy: string): string {
  return ({ pair_half: "one side of a pair was missing", moved_link: "its file was renamed", repeated_value: "a value was listed twice", exact_duplicate: "same title and text", stale_draft: "never reviewed, nothing links to it" } as Record<string, string>)[tidy] ?? "a mechanical fix";
}

/**
 * The row of this week (§3.3, §9.5): the labels of its Actions, doubtful items and cleaned items, kept from this week's earlier row and numbered
 * after the highest, with each line's text; which earlier rows lose items to it (§15.6); and the proposals of this week's earlier row no longer
 * offered, which leave it.
 */
export function buildRow(input: RecordInput, previous: Record<string, RowSlot>, proposalOf: (item: Item) => string, get: (id: string) => Note | undefined): Row {
  const { selection, plan } = input;
  const reports = (id: string) => posix.relative("reports", get(id)?.path ?? "");
  const highest: Record<string, number> = { A: 0, C: 0, U: 0 };
  for (const label of Object.keys(previous)) highest[label[0]!] = Math.max(highest[label[0]!] ?? 0, Number(label.slice(1)));
  const labelOf = (part: "A" | "C" | "U", proposal: string): string => {
    const kept = Object.entries(previous).find(([label, slot]) => label.startsWith(part) && slot.proposal === proposal)?.[0];
    if (kept !== undefined) return kept;
    highest[part] = (highest[part] ?? 0) + 1;
    return `${part}${highest[part]}`;
  };
  const row: Row = { A: [], C: [], U: [], slots: {}, moved: new Map(), queuedCarried: [], dropped: [] };
  for (const item of selection.items) {
    if (item.part === "T") continue;
    const proposal = proposalOf(item);
    const a = get(proposal)!.attributes;
    const label = labelOf(item.part, proposal);
    const what = changeText(a, get);
    if (item.part === "A") {
      const why = String(a.why ?? item.because).split("\n")[0]!.replace(/\.$/, "");
      const room = LINE_CHARS - `- [ ] ${label} · `.length;
      const shortWhat = clip(what, Math.max(40, room - 40));
      row.A.push({ label, proposal, text: `${label} · ${shortWhat} (${clip(why, room - shortWhat.length - 3)})` });
    } else {
      const tail = " · recommended: yes · [Show the change]()";
      row.C.push({ label, proposal, text: `${label} · ${clip(what, LINE_CHARS - `- [ ] ${label} · `.length - tail.length)} · recommended: yes · [Show the change](${reports(proposal)})` });
    }
    row.slots[label] = { proposal, base: [] };
  }
  // Already cleaned: this week's earlier cleaned items still applied, then this run's, in the order applied.
  const cleaned = [
    ...Object.entries(previous).filter(([label, slot]) => label.startsWith("U") && get(slot.proposal)?.attributes.status === "applied").sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1))).map(([, slot]) => slot.proposal),
    ...input.cleaned.map((entry) => entry.proposal),
  ];
  for (const proposal of [...new Set(cleaned)]) {
    const a = get(proposal)!.attributes;
    const label = labelOf("U", proposal);
    const tail = " · tick to undo";
    const reason = ` (${cleanedReason(String(a.tidy))})`;
    row.U.push({ label, proposal, text: `${label} · ${clip(pastTitle(String(a.title ?? proposal)), LINE_CHARS - `- [ ] ${label} · `.length - reason.length - tail.length)}${reason}${tail}` });
    row.slots[label] = { proposal, base: [] };
  }
  // Carried items (§15.6): every carried item leaves its row, into this one or back to the queue.
  const admitted = new Set(selection.items.map((item) => item.proposal).filter((id): id is string => id !== null));
  for (const entry of plan.carry) {
    const queued = selection.queued.some((q) => q.proposal === entry.proposal);
    if (!admitted.has(entry.proposal) && !queued) continue;
    row.moved.set(entry.week, [...(row.moved.get(entry.week) ?? []), entry]);
    if (queued) row.queuedCarried.push(entry.proposal);
  }
  const offered = new Set(Object.values(row.slots).map((slot) => slot.proposal));
  row.dropped = Object.entries(previous).filter(([label, slot]) => !label.startsWith("U") && !offered.has(slot.proposal) && get(slot.proposal)?.attributes.status === "pending").map(([, slot]) => slot.proposal);
  return row;
}

export interface Rendered { body: string; header: [string, string]; problems: InputProblem[]; words: number }

/** The body of weekly-review.md §3: the header, Your week and Clean-up, the skill's prose checked and the rest rendered here. */
export function renderBody(input: RecordInput, row: Row, waiting: number, byPath: ReadonlyMap<string, Note>): Rendered {
  const { plan, selection } = input;
  const problems: InputProblem[] = [];
  const monday = mondayOf(plan.local_date);
  const since = plan.window.first ? "first review, last 7 days" : `changes since ${localStamp(plan.window.from)}`;
  const line1 = `Week of ${dayMonthYear(monday)} · ${since} · ${plan.notion === "live" ? "Notion read live" : "Notion unreachable: brain only"}`;
  const total = plan.changes.length;
  const notShown = plan.changes.filter((change) => !change.bullet);
  const byLabel = LABELS.map((label) => [label, notShown.filter((change) => change.kind === label.toLowerCase()).length] as const).filter(([, n]) => n > 0);
  const partial = selection.omitted.clusters.length + selection.omitted.correction_targets;
  const partialLine = partial > 0 ? `Partial: ${partial} check${partial === 1 ? "" : "s"} not done (budget); they come first next week.` : "";
  const line2 = [
    plan.window.days > 14 ? `${plan.window.days} days since the last review.` : "",
    `Covered: ${total} change${total === 1 ? "" : "s"} from ${plan.inputs.meetings} meeting${plan.inputs.meetings === 1 ? "" : "s"} and ${plan.inputs.sources} source${plan.inputs.sources === 1 ? "" : "s"}.`,
    notShown.length > 0 ? `${notShown.length} not shown: ${byLabel.map(([label, n]) => `${n} ${label.toLowerCase()}`).join(", ")}.` : "",
    selection.earlier_open > 0 ? `${selection.earlier_open} more item${selection.earlier_open === 1 ? "" : "s"} wait from earlier weeks.` : "",
    partialLine,
  ].filter((part) => part !== "").join(" ");

  const taskUrls = new Set([...plan.changes.map((change) => change.url), ...Object.values(plan.task_analysis).flat().map((subject) => subject.url), ...plan.done.map((entry) => entry.url)].filter((url): url is string => url !== null));
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

  // In short (§3.2): one or two sentences, one line.
  const inShort = input.in_short.trim();
  if (inShort === "" || inShort.includes("\n")) problems.push({ pointer: "/in_short", message: "must be one line: one or two sentences on the week" });
  else if ((inShort.match(/[.!?](\s|$)/g) ?? []).length > 2) problems.push({ pointer: "/in_short", message: "is at most two sentences" });
  linkProblems(inShort, "/in_short");

  // Highlights (§3.2): at most 6 bullets, labels in order, each linked and dated; or the nothing-new line.
  const nothingNew = input.highlights.length === 1 && input.highlights[0] === NOTHING_NEW;
  if (!nothingNew) {
    if (input.highlights.length === 0) problems.push({ pointer: "/highlights", message: `is at least one bullet, or ${NOTHING_NEW}` });
    if (input.highlights.length > HIGHLIGHTS) problems.push({ pointer: "/highlights", message: `holds at most ${HIGHLIGHTS} bullets` });
    let last = -1;
    input.highlights.forEach((line, index) => {
      const pointer = `/highlights/${index}`;
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

  // Focus first (§3.2): 1 to 3 numbered lines, or the no-problem line.
  const focus = input.focus_first;
  if (!(focus.length === 1 && focus[0] === NO_PROBLEM)) {
    if (focus.length < 1 || focus.length > FOCUS_LINES) problems.push({ pointer: "/focus_first", message: `holds 1 to ${FOCUS_LINES} numbered lines, or ${NO_PROBLEM}` });
    focus.forEach((line, index) => {
      if (!new RegExp(`^${index + 1}\\. \\S.*: \\S`).test(line) && !new RegExp(`^${index + 1}\\. \\S`).test(line)) problems.push({ pointer: `/focus_first/${index}`, message: `must be ${index + 1}. <subject>: <reason>` });
      linkProblems(line, `/focus_first/${index}`);
    });
  }

  // Done this week (§3.2): rendered here from the plan, newest first.
  const short = (date: string) => dayMonthYear(date).replace(/ \d{4}$/, "");
  const done = plan.done.slice(0, DONE_LINES).map((entry) => entry.kind === "task"
    ? `- [${entry.title}](${entry.url})${entry.project === null ? "" : ` (${entry.project})`}, done ${short(entry.date)}.`
    : `- [${entry.title}](${entry.url}) (project), Done ${short(entry.date)}.`);
  if (plan.done.length > DONE_LINES) done.push(`${plan.done.length - DONE_LINES} more done.`);

  const shownOf = selection.items.filter((item) => item.shown_of !== undefined).map((item) => ` (${item.shown_of!.k} of ${item.shown_of!.size} shown)`).join("");
  const clarify = (selection.corrections ?? []).reduce((sum, entry) => sum + entry.clarify, 0);
  const waitingLine = waiting > 0
    ? `**Waiting for you:** ${waiting} decision${waiting === 1 ? " waits" : "s wait"} in the session${shownOf}: say *what needs my decision* in Claude Code or Codex.`
    : "**Waiting for you:** nothing waits in the session.";
  const yourWeek = [
    `**In short:** ${inShort}`, "",
    "**Highlights**", ...input.highlights, "",
    ...(done.length > 0 ? ["**Done this week**", ...done, ""] : []),
    ...(row.A.length > 0 ? ["**Actions**", ...row.A.map((line) => `- [ ] ${line.text}`), ""] : []),
    "**Focus first**", ...focus, "",
    waitingLine,
    ...(clarify > 0 ? [`${clarify} correction match${clarify === 1 ? " needs" : "es need"} clarification: say "weekly review corrections".`] : []),
    ...(partialLine !== "" ? [partialLine] : []),
  ];
  const cleanUp = row.U.length + row.C.length === 0 ? ["- Nothing to clean up this week."] : [
    ...(row.U.length > 0 ? ["**Already cleaned**", ...row.U.map((line) => `- [ ] ${line.text}`)] : []),
    ...(row.U.length > 0 && row.C.length > 0 ? [""] : []),
    ...(row.C.length > 0 ? ["**For you to tick**", ...row.C.map((line) => `- [ ] ${line.text}`)] : []),
  ];
  // Shape (§3.3): every label once; a Clean-up line at most 200 characters, link targets not counted.
  const labels = [...row.A, ...row.C, ...row.U].map((line) => line.label);
  if (new Set(labels).size !== labels.length) problems.push({ pointer: "/selection/items", message: "a label is used twice" });
  for (const line of cleanUp) if (line.replace(/\]\([^)]*\)/g, "]()").length > LINE_CHARS) problems.push({ pointer: "/cleaned", message: `a Clean-up line is over ${LINE_CHARS} characters` });
  const sections = ["## Your week", ...yourWeek, "", "## Clean-up", ...cleanUp];
  const body = `${line1}\n${line2}\n\n${sections.join("\n")}\n`;
  // Your week's words (§3.3): neither the header, the to-dos' text nor link targets.
  return { body, header: [line1, line2], problems, words: wordCount(yourWeek.filter((line) => !line.startsWith("- [ ] ")).join("\n")) };
}

/** Words of a text without its link targets (§3.3): tokens holding a letter or a digit. */
export function wordCount(text: string): number {
  return text.replace(/\]\(\s*<?[^)\s>]+>?\s*\)/g, "]").split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** An earlier week's report once its items moved (§15.6): the moved to-dos replaced by one `Moved to …` line, a part left empty dropped. */
export function movedBody(body: string, labels: ReadonlySet<string>, week: string, actions: number, cleanUp: number): string {
  const moved = `Moved to Week of ${dayMonthYear(mondayOfWeek(week))}: ${actions} action${actions === 1 ? "" : "s"} and ${cleanUp} clean-up item${cleanUp === 1 ? "" : "s"}.`;
  const out: string[] = [];
  let placed = false;
  for (const line of body.split("\n")) {
    const label = /^- \[[ xX]\] ([AC]\d+) · /.exec(line)?.[1];
    if (label !== undefined && labels.has(label)) { if (!placed) { out.push(moved); placed = true; } continue; }
    out.push(line);
  }
  // A part whose to-dos all moved keeps no heading of its own.
  return out.filter((line, index) => !((line === "**Actions**" || line === "**For you to tick**") && !/^- \[[ xX]\] /.test(out[index + 1] ?? ""))).join("\n");
}

/** The state after a recorded run (§9.5). */
export function nextState(current: WeeklyState, input: RecordInput, report: { id: string; path: string }, row: Row): WeeklyState {
  const { plan, selection } = input;
  const week = plan.week;
  const previous = current.weeks[week];
  const windowSkip = previous?.window_skip ?? (current.last_success !== null && compareCodePoints(current.last_success.week, week) < 0 ? current.last_success.covered_on_to : []);
  const items = [...new Set([...(previous?.items ?? []), ...selection.items.map((item) => item.key)])];
  // The correction cursor as the week found it: a rerun lists the same claims, and this run's outcome is applied to it, never to its own write (§8.1).
  const before = correctionCursor(current, week);
  const counts = { ...selection.counts, cleaned: row.U.length };
  const weeks: WeeklyState["weeks"] = { ...current.weeks, [week]: { report: report.id, path: report.path, window_from: plan.window.from, window_skip: windowSkip, input_hash: plan.input_hash, counts, items, row: row.slots, carried_to: null, corrections_from: before } };
  for (const earlier of row.moved.keys()) if (weeks[earlier] !== undefined) weeks[earlier] = { ...weeks[earlier]!, carried_to: week };
  const kept = Object.keys(weeks).sort(compareCodePoints).slice(-KEEP_WEEKS);
  const toDate = plan.window.to.slice(0, 10);

  // shown: the items, and every other finding shown this week (Focus first only), so they don't hold off a quiet week (§9.1).
  const shown = new Map(current.shown.map((entry) => [entry.key, entry]));
  const itemKeys = new Set(selection.items.map((item) => item.key));
  for (const item of selection.items) shown.set(item.key, { key: item.key, week, category: item.category, evidence_hash: item.evidence_hash, ...(item.days_late === undefined ? {} : { days_late: item.days_late }), ...(item.days_idle === undefined ? {} : { days_idle: item.days_idle }) });
  for (const finding of plan.findings) {
    if (!finding.repetition.show || itemKeys.has(finding.key) || selection.queued.some((entry) => entry.key === finding.key)) continue;
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
    corrections: nextCursor(before, plan.corrections, new Map((selection.corrections ?? []).map((entry) => [entry.claim, entry.open])), plan.local_date),
  };
}
