import { isLean, parseLean } from "./lean-minutes.ts";
import { ID_IN_LINE, paragraphs, planExtract, summaryLines } from "./selection.ts";

// `brain minutes check` (spec/cli.md §5.36, capture-and-review §3.4.2, decision 0101 §8.3): minutes the agent proposes, checked against the
// page's transcript by 0079 §6's bar before anything is written. Pure: no I/O.

export type MinutesShape = "lean" | "inline-quote" | "legacy";
export type FailureReason = "no-quote-entry" | "not-found" | "not-unique" | "orphan";
export interface MinutesFailure { id: string; reason: FailureReason; quote?: string }
export interface MinutesProblem { code: string; id?: string; text?: string; reason: string }
export interface MinutesCheck {
  ok: boolean;
  shape: MinutesShape | null;
  items: number;
  passing: number;
  needed: number;
  failures: MinutesFailure[];
  follow_ups: number;
  problems: MinutesProblem[];
}

/** The problems of `extract-plan` that make its `ok` false (cli §5.22): blockers here too (step 2). */
const BLOCKERS = new Set(["SELECTION_UNREADABLE", "SELECTION_UNMAPPABLE", "UNNUMBERED_LINE"]);

/** A summary's shape as `extract-plan` names it (capture-and-review §4.1, "Shapes"). */
export function shapeOf(markdown: string): MinutesShape {
  if (isLean(markdown)) return "lean";
  return summaryLines(markdown).some((line) => ID_IN_LINE.test(line)) ? "inline-quote" : "legacy";
}

/** The least number of passing items that meets the bar `10 × passing ≥ 9 × items` (0079 §6). */
export function neededFor(items: number): number {
  return Math.ceil((9 * items) / 10);
}

/** A Notion page id compared without its dashes and case: the MCP gives it in either form. */
export function samePage(left: string, right: string): boolean {
  const plain = (id: string) => id.replace(/-/g, "").toLowerCase();
  return plain(left) === plain(right);
}

/**
 * Checks proposed minutes against the transcript (cli §5.36). `alreadyWritten` is true when the log holds a `minutes-written` line for the
 * page and `--again` was not given: the check then stops there.
 */
export function checkMinutes(minutes: string, transcript: string, alreadyWritten: boolean): MinutesCheck {
  const stopped = (shape: MinutesShape | null, problem: MinutesProblem): MinutesCheck =>
    ({ ok: false, shape, items: 0, passing: 0, needed: 0, failures: [], follow_ups: 0, problems: [problem] });
  if (alreadyWritten) return stopped(null, { code: "ALREADY_WRITTEN", reason: "the brain wrote minutes on this page before: only the user's ask writes them again (--again)" });

  // 1. The shape: minutes the agent writes are in the current format.
  const shape = shapeOf(minutes);
  if (shape !== "lean") return stopped(shape, { code: "NOT_LEAN", reason: `the minutes are in the ${shape} shape, not the lean shape with a For the brain toggle` });

  const summary = parseLean(minutes);
  const problems: MinutesProblem[] = [];
  // 2. Blockers: whatever makes extract-plan's ok false.
  for (const problem of planExtract(summary, transcript).problems) {
    if (BLOCKERS.has(problem.code)) problems.push({ code: problem.code, ...(problem.id === null ? {} : { id: problem.id }), reason: problem.reason });
  }

  // 3. Items: each readable item line; it passes when every quote of its entry is in exactly one paragraph (§4.2 rule 1, no stretch).
  const paras = paragraphs(transcript).paragraphs;
  const noEntry = new Set(summary.problems.filter((problem) => problem.code === "NO_QUOTE_ENTRY").map((problem) => problem.id));
  const failures: MinutesFailure[] = [];
  const readable = summary.readable ?? [];
  let passing = 0;
  for (const item of readable) {
    if (noEntry.has(item.id) || item.anchors.length === 0) { failures.push({ id: item.id, reason: "no-quote-entry" }); continue; }
    let passes = true;
    for (const quote of item.anchors) {
      const hits = paras.filter((paragraph) => paragraph.text.includes(quote)).length;
      if (hits === 1) continue;
      passes = false;
      failures.push({ id: item.id, reason: hits === 0 ? "not-found" : "not-unique", quote });
    }
    if (passes) passing += 1;
  }
  for (const orphan of summary.orphans ?? []) failures.push({ id: orphan.id, reason: "orphan" });

  // 4. Follow-ups: every to-do of Quick follow-ups has its own `q` id.
  for (const text of summary.untagged_todos ?? []) problems.push({ code: "FOLLOW_UP_WITHOUT_ID", text, reason: "a to-do of Quick follow-ups with no q id" });
  for (const problem of summary.problems) {
    if (problem.code === "DUPLICATE_FOLLOW_UP") problems.push({ code: problem.code, ...(problem.id === null ? {} : { id: problem.id }), reason: problem.reason });
  }
  const followUps = summary.quick.filter((entry) => entry.follow_up != null).length;

  // 5. The bar (0079 §6), and at least one item.
  const items = readable.length;
  if (items === 0) problems.push({ code: "NO_ITEMS", reason: "no item: a meeting with no subject gets no minutes from the agent" });
  const needed = neededFor(items);
  return { ok: problems.length === 0 && items > 0 && 10 * passing >= 9 * items, shape, items, passing, needed, failures, follow_ups: followUps, problems };
}

/** The human output (cli §5.36): the count line, ok or not ok, then one line per failure and per problem. */
export function minutesCheckText(check: MinutesCheck): string {
  const lines = [`Minutes check: ${check.passing} of ${check.items} items pass (${check.needed} needed) · ${check.follow_ups} follow-ups`, check.ok ? "ok" : "not ok"];
  for (const failure of check.failures) lines.push(`[${failure.id}] ${failure.reason}${failure.quote === undefined ? "" : `: “${failure.quote}”`}`);
  for (const problem of check.problems) lines.push(`${problem.code}${problem.id === undefined ? "" : ` [${problem.id}]`}${problem.text === undefined ? "" : ` “${problem.text}”`}: ${problem.reason}`);
  return `${lines.join("\n")}\n`;
}
