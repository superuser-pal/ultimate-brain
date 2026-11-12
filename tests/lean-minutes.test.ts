import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { buildExtractPlan } from "../src/lib/extract.ts";
import { brain, fixtureCopy } from "./helpers.ts";

// CC-196 (decision 0079): the lean minutes shape, the id → quote join and quick follow-ups becoming Task inputs
// (capture-and-review §3.3, §4.1, §4.6, §6.3; cli §5.14.5, §5.14.6, §5.22, §5.23). Synthetic data only.

const FIXTURES = join(import.meta.dirname, "fixtures", "minutes-0079");
const fixture = (name: string): string => readFileSync(join(FIXTURES, name), "utf8");
const LEAN = fixture("lean-summary.md");
const TRANSCRIPT = fixture("transcript.md");
const PAGE = "0a0b0c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
const NOW = "2027-03-10T09:00:00Z";

const plan = (summary: string, transcript = TRANSCRIPT) => buildExtractPlan([], { page: PAGE, summary, transcript });
const codes = (data: { problems: { code: string }[] }) => data.problems.map((problem) => problem.code);
const swap = (text: string, from: string, to: string): string => {
  assert.ok(text.includes(from), `the fixture holds ${from}`);
  return text.replace(from, to);
};

test("the lean shape joins each readable line to its quote entry, in page order", () => {
  const data = plan(LEAN);
  assert.equal(data.ok, true, JSON.stringify(data.problems));
  assert.equal(data.shape, "lean");
  assert.deepEqual(data.problems, []);
  assert.deepEqual(data.items!.map((item) => [item.id, item.subject, item.place]), [
    ["s1.i3", "s1", "tasks"], ["s3.i2", "s3", "tasks"],
    ["s1.i1", "s1", "subject"], ["s1.i2", "s1", "subject"], ["s1.i4", "s1", "subject"], ["s1.i5", "s1", "subject"],
    ["s2.i1", "s2", "subject"], ["s3.i1", "s3", "subject"], ["s3.i3", "s3", "subject"], ["s4.i1", "s4", "subject"], ["s4.i2", "s4", "subject"],
  ]);
  assert.deepEqual(data.items!.find((item) => item.id === "s1.i4"), {
    id: "s1.i4", subject: "s1", place: "subject", prefix: "waiting_on", name: "Ben", track: true,
    text: "Waiting on Ben: confirm the soil delivery date by Wednesday", anchors: ["confirm the soil delivery date with the supplier by Wednesday"], depends_on: [],
  });
  assert.deepEqual(data.items!.find((item) => item.id === "s1.i2"), {
    id: "s1.i2", subject: "s1", place: "subject", prefix: "decided", name: null, track: false,
    text: "Decided: planting moves to the second Saturday of April", anchors: ["We agreed to move the spring planting day"], depends_on: [],
  });
  assert.equal(data.items!.find((item) => item.id === "s1.i1")?.prefix, null, "the gist line has no prefix");
  assert.deepEqual(data.items!.find((item) => item.id === "s1.i5")?.depends_on, ["s1.i1"]);
  assert.deepEqual(data.items!.map((item) => item.prefix).filter((prefix) => prefix !== null), ["decided", "waiting_on", "open", "concern", "idea"]);
  assert.deepEqual(data.passages.map((entry) => [entry.n, entry.items]), [
    [2, ["s1.i1", "s1.i2"]], [3, ["s1.i4"]], [5, ["s3.i1", "s3.i3"]], [6, ["s1.i3"]], [7, ["s1.i5"]], [9, ["s4.i2"]], [10, ["s3.i2"]],
  ]);
  assert.deepEqual(data.selection.slice(0, 4), [
    { id: "s1", effective: "use", explicit: "use" }, { id: "s2", effective: "meeting only", explicit: "meeting only" },
    { id: "s3", effective: "use", explicit: "use" }, { id: "s4", effective: "meeting only", explicit: "meeting only" },
  ]);
  assert.deepEqual(data.selection.find((entry) => entry.id === "s4.i2"), { id: "s4.i2", effective: "use", explicit: "use" }, "the token on the quote entry");
  assert.deepEqual(data.scopes, [{ item: "s1.i3", done_when: "the rota is shared with the group", due: "2027-03-20", project: null, notes: null, problems: [] }]);
  assert.deepEqual(data.unnumbered, []);
  assert.ok(data.body !== null && !data.body.includes("twelve hundred") && !data.body.includes("wedding"), "excluded paragraphs stay out");
  assert.ok(!data.body.includes("supplier's phone number"), "a follow-up's text never enters the extract");
});

test("an edited readable line is the text read; its quotes and selection still come from the toggle", () => {
  const edited = plan(swap(LEAN, "- Decided: planting moves to the second Saturday of April [s1.i2]", "- Decided: planting moves to the **third** Saturday of April [s1.i2]"));
  const before = plan(LEAN);
  assert.equal(edited.ok, true);
  assert.equal(edited.items!.find((item) => item.id === "s1.i2")?.text, "Decided: planting moves to the third Saturday of April");
  assert.deepEqual(edited.items!.find((item) => item.id === "s1.i2")?.anchors, ["We agreed to move the spring planting day"]);
  assert.deepEqual(edited.passages, before.passages, "the same paragraphs enter");
  assert.equal(edited.body, before.body);
  const quoted = plan(swap(LEAN, "- Open: whether the school group can join [s1.i5]", "- Open: “whether the school group can join” [s1.i5]"));
  assert.equal(quoted.items!.find((item) => item.id === "s1.i5")?.text, "Open: “whether the school group can join”", "a quote on a readable line is text, never an anchor");
  assert.deepEqual(quoted.items!.find((item) => item.id === "s1.i5")?.anchors, ["whether the school group can join on the planting day"]);
});

test("a subject marked Meeting only in the toggle excludes its paragraphs, its Tasks for the brain lines included", () => {
  const base = plan(LEAN);
  assert.ok(!base.passages.some((entry) => entry.n === 4), "s2 is Meeting only: ¶4 stays out");
  const tap = plan(swap(LEAN, "[s3] Selection: Use in brain", "[s3] Selection: Meeting only"));
  assert.equal(tap.ok, true, JSON.stringify(tap.problems));
  assert.equal(tap.selection.find((entry) => entry.id === "s3.i2")?.effective, "meeting only", "a Tasks for the brain line takes the subject its id names");
  assert.deepEqual(tap.passages.map((entry) => entry.n), [2, 3, 6, 7, 9]);
  const item = plan(swap(LEAN, "[s1.i4] → “confirm", "[s1.i4] → Meeting only: “confirm"));
  assert.equal(item.selection.find((entry) => entry.id === "s1.i4")?.effective, "meeting only");
  assert.ok(!item.passages.some((entry) => entry.n === 3));
  const leading = plan(swap(LEAN, "[s1.i4] → “confirm", "Meeting only: [s1.i4] “confirm"));
  assert.equal(leading.selection.find((entry) => entry.id === "s1.i4")?.explicit, "meeting only", "the token may lead the quote entry");
});

test("follow-ups: an unticked one with a q id is a Task input; ticked, deleted, empty, untagged and duplicated ones are not", () => {
  const data = plan(LEAN);
  assert.deepEqual(data.quick, [
    { subject: null, id: null, text: "Send Ben the supplier's phone number", done: false, follow_up: "q1", task: true, recorded: null },
    { subject: null, id: null, text: "Share the call notes with Carla", done: true, follow_up: "q2", task: false, recorded: null },
    { subject: null, id: null, text: "Ask Carla for the shed key", done: false, follow_up: "q3", task: true, recorded: null },
  ]);
  const deleted = plan(swap(LEAN, "- [ ] Send Ben the supplier's phone number [q1]\n", ""));
  assert.deepEqual(deleted.quick.map((entry) => entry.follow_up), ["q2", "q3"]);
  const others = plan(swap(LEAN, "- [x] Share the call notes with Carla [q2]\n", "- [x] Share the call notes with Carla [q2]\n- [ ] [Q4]\n- [ ] Water the seedlings\n- Buy gloves [q5]\n- [ ] Call the supplier [q1]\n"));
  assert.equal(others.ok, true, "none of them blocks");
  assert.deepEqual(others.problems, [{ code: "DUPLICATE_FOLLOW_UP", id: "q1", reason: "q1 is on two to-dos: neither becomes a Task" }]);
  assert.deepEqual(others.quick.map((entry) => [entry.text, entry.follow_up, entry.task]), [
    ["Send Ben the supplier's phone number", "q1", false],
    ["Share the call notes with Carla", "q2", false],
    ["", "q4", false],
    ["Water the seedlings", null, false],
    ["Buy gloves [q5]", null, false],
    ["Call the supplier", "q1", false],
    ["Ask Carla for the shed key", "q3", true],
  ]);
});

test("a q tag outside the Quick follow-ups group is plain text, and the In one line line is never read", () => {
  const data = plan(swap(LEAN, "**In one line:** the planting day", "**In one line:** [s9.i9] Meeting only: the planting day"));
  assert.equal(data.ok, true, JSON.stringify(data.problems));
  const block = plan(swap(LEAN, "- Concern: the leak may damage the north beds [s3.i3]", "- Concern: the leak may damage the north beds [s3.i3]\n- [ ] Call the plumber [q7]"));
  assert.deepEqual(codes(block), ["UNNUMBERED_LINE"], "a to-do in a subject block is an unnumbered line, its q tag plain text");
  assert.deepEqual(block.unnumbered, [{ subject: "s3", text: "[ ] Call the plumber [q7]" }]);
  assert.ok(!block.quick.some((entry) => entry.follow_up === "q7"));
});

test("a readable line with no quote entry and a quote entry with no readable line are reported, failing closed", () => {
  const missing = plan(swap(LEAN, "[s3.i3] → “still leaks after the repair”\n", ""));
  assert.equal(missing.ok, true);
  assert.deepEqual(missing.problems, [{ code: "NO_QUOTE_ENTRY", id: "s3.i3", reason: "a readable line with no quote entry" }]);
  assert.deepEqual(missing.unplaced_items, ["s3.i3"]);
  assert.deepEqual(missing.quotes, [{ item: "s3.i3", anchor: null, result: "unplaced", reason: "no quote" }]);
  const excluded = plan(swap(LEAN, "[s2.i1] → “please keep that figure inside this group for now”\n", ""));
  assert.equal(excluded.ok, false, "an excluded item with no quote blocks");
  assert.deepEqual(codes(excluded), ["NO_QUOTE_ENTRY", "SELECTION_UNMAPPABLE"]);
  const orphan = plan(swap(LEAN, "The raised beds have a budget for this year. [s2.i1]\n", ""));
  assert.equal(orphan.ok, true, JSON.stringify(orphan.problems));
  assert.deepEqual(orphan.problems, [{ code: "ORPHAN_QUOTE_ENTRY", id: "s2.i1", reason: "a quote entry with no readable line" }]);
  assert.deepEqual(orphan.selection.find((entry) => entry.id === "s2.i1"), { id: "s2.i1", effective: "meeting only", explicit: null }, "an excluded orphan still keeps its paragraphs out");
  assert.ok(!orphan.items!.some((item) => item.id === "s2.i1"));
  const shared = plan(swap(swap(LEAN, "The raised beds have a budget for this year. [s2.i1]\n", ""), "[s3.i3] → “still leaks after the repair”", "[s3.i3] → “twelve hundred”"));
  assert.equal(shared.ok, false, "a use item sharing the orphan's paragraph is unmappable");
  assert.ok(shared.problems.some((problem) => problem.code === "SELECTION_UNMAPPABLE" && problem.id === "s3.i3"));
  const withOrphan = swap(LEAN, "[s3.i3] → “still leaks after the repair”", "[s3.i3] → “still leaks after the repair”\n[s3.i9] → “Ana opened the call”");
  const used = plan(withOrphan);
  assert.deepEqual(used.problems, [{ code: "ORPHAN_QUOTE_ENTRY", id: "s3.i9", reason: "a quote entry with no readable line" }]);
  assert.ok(!used.selection.some((entry) => entry.id === "s3.i9") && !used.passages.some((entry) => entry.n === 1), "an included orphan cites nothing");
  const depends = plan(swap(withOrphan, "(depends on [s1.i1])", "(depends on [s3.i9])"));
  assert.deepEqual(codes(depends), ["ORPHAN_QUOTE_ENTRY", "DEPENDS_ON_EXCLUDED"], "depending on an orphan entry is depending on excluded context");
});

test("lean shape blockers: tokens and Selection lines on the readable part, toggles, tags and look-alikes", () => {
  const blocked = (summary: string, reason: RegExp) => {
    const data = plan(summary);
    assert.equal(data.ok, false, `blocks: ${reason}`);
    assert.equal(data.body, null);
    assert.ok(data.problems.some((problem) => problem.code === "SELECTION_UNREADABLE" && reason.test(problem.reason)), `${reason} in ${JSON.stringify(data.problems)}`);
  };
  blocked(swap(LEAN, "- Open: whether", "- Meeting only: Open: whether"), /marked in the For the brain toggle/);
  blocked(swap(LEAN, "- Track: Waiting On — Waiting on Ben", "- Track: Waiting On — Use in brain: Waiting on Ben"), /marked in the For the brain toggle/);
  blocked(swap(LEAN, "- Open: whether", "- Meetng only: whether"), /marked in the For the brain toggle/);
  blocked(swap(LEAN, "## Budget [s2]\n", "## Budget [s2]\nSelection: Meeting only\n"), /Selection line outside the For the brain toggle/);
  blocked(`${LEAN}\n<details>\n<summary>For the brain</summary>\n[s2] Selection: Use in brain\n</details>\n`, /second For the brain toggle/);
  blocked(swap(LEAN, "[s2] Selection: Meeting only\n", "<details>\n<summary>Hidden</summary>\n[s2] Selection: Meeting only\n"), /toggle inside the For the brain toggle/);
  blocked(swap(LEAN, "[s1.i4] → “confirm", "Meeting only: [s1.i4] → Use in brain: “confirm"), /token/);
  blocked(swap(LEAN, "[s1.i4] → “confirm", "[s1.i4] → Meetng only: “confirm"), /token/);
  blocked(swap(LEAN, "[s1.i5] → “whether the school group can join on the planting day” (depends on [s1.i1])", "[s1.i5] → “whether the school group can join on the planting day” (meeting only)"), /token/);
  blocked(swap(LEAN, "[s4] Selection: Meeting only", "[s4] Selection: Private"), /unreadable selection/);
  blocked(swap(LEAN, "[s4] Selection: Meeting only", "[s4] Selection: Meeting only\n[s4] Selection: Use in brain"), /two Selection lines/);
  blocked(swap(LEAN, "[s4] Selection: Meeting only", "[s4] Selection: Meeting only\n[s9] Selection: Meeting only"), /no subject heading/);
  blocked(swap(LEAN, "[s4] Selection: Meeting only", "Selection: Meeting only"), /control/);
  blocked(swap(LEAN, "[s4] Selection: Meeting only", "[s4] Meeting only"), /id that is not an item/);
  blocked(swap(LEAN, "- Open: whether the school group can join [s1.i5]", "- Open: whether [s1.i1] the school group can join [s1.i5]"), /id that is not an item/);
  blocked(swap(LEAN, "- Open: whether the school group can join [s1.i5]", "- Open: whether [s1.i5] the school group can join"), /id that is not an item/);
  blocked(swap(LEAN, "- Email the council about the tap repair warranty [s3.i2]", "- Email the council about the tap repair warranty [s7.i2]"), /names no subject/);
  blocked(swap(LEAN, "- Concern: the leak may damage the north beds [s3.i3]", "- Concern: the leak may damage the north beds [s1.i9]"), /not under its subject/);
  blocked(swap(LEAN, "## Budget [s2]", "## Meeting only: Budget [s2]"), /subject title/);
  const bare = plan(swap(LEAN, "<details>\n<summary>For the brain</summary>", "<details>\n<summary>For the brain</summary>\n**For the brain:**"));
  assert.ok(bare.problems.some((problem) => problem.code === "SELECTION_UNREADABLE" && /For the brain/.test(problem.reason)));
  const unclosed = plan(`## [s1] A\n- [s1.i1] Planting “move the spring planting day”\n\n## For the brain\n[s1.i1] → “move the spring planting day”\n`);
  assert.equal(unclosed.shape, "lean", "a For the brain line outside a toggle still makes the shape lean");
  assert.equal(unclosed.ok, false);
  const stray = plan(swap(LEAN, "- Concern: the leak may damage the north beds [s3.i3]", "- Concern: the leak may damage the north beds [s3.i3]\nThe plumber comes on Monday."));
  assert.deepEqual(codes(stray), ["UNNUMBERED_LINE"], "a line in a subject block without its tag blocks");
  assert.deepEqual(stray.unnumbered, [{ subject: "s3", text: "The plumber comes on Monday." }]);
  const heading = plan(swap(LEAN, "- Concern: the leak", "### Notes\n- Concern: the leak"));
  assert.equal(heading.ok, true, "a heading without a tag is not read");
  const duplicate = plan(swap(LEAN, "[s3.i3] → “still leaks after the repair”", "[s3.i3] → “still leaks after the repair”\n[s3.i3] → “after the repair”"));
  assert.ok(duplicate.problems.some((problem) => problem.code === "SELECTION_UNMAPPABLE" && problem.id === "s3.i3"), "two quote entries with one id");
  const twice = plan(swap(LEAN, "- Concern: the leak may damage the north beds [s3.i3]", "- Concern: the leak may damage the north beds [s3.i3]\n- Concern: again [s3.i3]"));
  assert.ok(twice.problems.some((problem) => problem.code === "SELECTION_UNMAPPABLE" && problem.reason === "duplicate id"));
});

test("a readable line moved into Quick follow-ups is read like an item, failing closed", () => {
  const moved = plan(swap(swap(LEAN, "The raised beds have a budget for this year. [s2.i1]\n", ""), "- [x] Share the call notes with Carla [q2]", "- [x] Share the call notes with Carla [q2]\n- [ ] The raised beds have a budget for this year. [s2.i1]"));
  assert.equal(moved.ok, false, "outside its subject's block it blocks");
  assert.ok(moved.problems.some((problem) => problem.code === "SELECTION_UNREADABLE" && /not under its subject s2/.test(problem.reason)));
  assert.deepEqual(moved.quick.find((entry) => entry.id === "s2.i1"), { subject: null, id: "s2.i1", text: "The raised beds have a budget for this year.", done: false, follow_up: null, task: false, recorded: null });
  assert.ok(!moved.problems.some((problem) => problem.code === "ORPHAN_QUOTE_ENTRY"), "its quote entry is joined to it");
  const token = plan(swap(LEAN, "- [x] Share the call notes with Carla [q2]", "- [x] Share the call notes with Carla [q2]\n- [ ] Meeting only: a note [s0.i7]"));
  assert.ok(token.problems.some((problem) => problem.code === "SELECTION_UNREADABLE" && problem.id === "s0.i7"));
});

test("a Tasks for the brain line may name s0 or any subject, and a Scope under it is read", () => {
  const data = plan(swap(swap(LEAN, "- Email the council about the tap repair warranty [s3.i2]", "- Email the council about the tap repair warranty [s0.i1]"), "[s3.i2] →", "[s0.i1] →"));
  assert.equal(data.ok, true, JSON.stringify(data.problems));
  assert.equal(data.items!.find((item) => item.id === "s0.i1")?.subject, null);
  assert.deepEqual(data.passages.find((entry) => entry.n === 10)?.items, ["s0.i1"]);
  const leading = plan(swap(LEAN, "- Email the council about the tap repair warranty [s3.i2]", "- [ ] [s3.i2] Email the council about the tap repair warranty"));
  assert.equal(leading.items!.find((item) => item.id === "s3.i2")?.text, "Email the council about the tap repair warranty", "the tag may lead");
});

test("the inline-quote and legacy shapes read exactly as before 0.14.0", () => {
  const golden = (name: string) => JSON.parse(fixture(name));
  assert.deepEqual(plan(fixture("inline-summary.md")), golden("inline-plan.json"));
  assert.deepEqual(plan(fixture("legacy-summary.md")), golden("legacy-plan.json"));
  const R = join(import.meta.dirname, "fixtures", "minutes-0067");
  assert.deepEqual(plan(readFileSync(join(R, "blind-summary.md"), "utf8"), readFileSync(join(R, "transcript.md"), "utf8")), golden("inline-0067-plan.json"));
  assert.equal(JSON.stringify(plan(fixture("inline-summary.md"))), JSON.stringify(golden("inline-plan.json")), "key for key, in order");
});

// ---- CC-229: Markdown escapes (capture-and-review §4.3). The Notion API's markdown export writes `\[s1.i1\]`; the reader reads `[s1.i1]`. ----

/** Every ASCII punctuation character escaped, as a Markdown writer may: the text Markdown reads is unchanged. */
const escapeAll = (text: string): string => text.replace(/[!-/:-@[-`{-~]/g, "\\$&");
const unescapeBrackets = (text: string): string => text.replace(/\\([[\]])/g, "$1");

test("minutes read through Notion's markdown export keep their ids, tags and quotes (the CC-197 gate's run 1)", () => {
  const escaped = fixture("notion-export-summary.md");
  const transcript = fixture("notion-export-transcript.md");
  assert.ok(escaped.includes("\\[s1.i1\\]") && escaped.includes("\\[q1\\]"), "the fixture holds the export's escaped brackets");
  const data = plan(escaped, transcript);
  assert.equal(data.shape, "lean");
  assert.equal(data.ok, true, JSON.stringify(data.problems));
  assert.deepEqual(data.problems, []);
  assert.deepEqual(data.items!.map((item) => item.id), ["s1.i1", "s1.i2", "s1.i3", "s1.i4", "s2.i1", "s2.i2", "s2.i3", "s2.i4"]);
  assert.deepEqual(data.items!.find((item) => item.id === "s1.i2")?.text, "Decided: Move the public launch from 10 February to 3 March 2027.");
  assert.deepEqual(data.items!.find((item) => item.id === "s1.i2")?.anchors, ["We move the public launch from the tenth of February", "to the third of March 2027"]);
  assert.deepEqual(data.selection.slice(0, 2), [{ id: "s1", effective: "use", explicit: "use" }, { id: "s2", effective: "use", explicit: "use" }]);
  assert.deepEqual(data.quick.map((entry) => [entry.follow_up, entry.task, entry.text]), [["q1", true, "Forward the city regulation PDF to Tomas"]]);
  assert.deepEqual(data.unnumbered, []);
  assert.ok(data.body !== null && !data.body.includes("\\["), "the extract holds the transcript's paragraphs as written");
  const plain = unescapeBrackets(escaped);
  assert.ok(!plain.includes("\\"));
  assert.equal(JSON.stringify(data), JSON.stringify(plan(plain, transcript)), "byte-identical to the same minutes with no escape");
});

test("a Markdown escape on any punctuation reads as the character, in every shape: the goldens stay the same", () => {
  assert.equal(JSON.stringify(plan(escapeAll(LEAN))), JSON.stringify(plan(LEAN)), "lean");
  const golden = (name: string) => JSON.stringify(JSON.parse(fixture(name)));
  assert.equal(JSON.stringify(plan(escapeAll(fixture("inline-summary.md")))), golden("inline-plan.json"), "inline-quote");
  assert.equal(JSON.stringify(plan(escapeAll(fixture("legacy-summary.md")))), golden("legacy-plan.json"), "legacy");
  const R = join(import.meta.dirname, "fixtures", "minutes-0067");
  assert.equal(JSON.stringify(plan(escapeAll(readFileSync(join(R, "blind-summary.md"), "utf8")), readFileSync(join(R, "transcript.md"), "utf8"))), golden("inline-0067-plan.json"), "0067 inline-quote");
  // A backslash before a letter, a digit or a space is not an escape, and a doubled one is one backslash: both stay in the text read.
  const kept = plan(swap(LEAN, "- Open: whether the school group can join [s1.i5]", "- Open: whether C:\\temp or 2\\3 \\ can join \\\\[s1.i5]"));
  assert.equal(kept.items!.find((item) => item.id === "s1.i5")?.text, "Open: whether C:\\temp or 2\\3 \\ can join \\", "only the escape is removed");
});

test("an escaped bracket inside a quote still places the quote", () => {
  const transcript = swap(TRANSCRIPT, "We agreed to move the spring planting day", "We agreed to move the [spring] planting day");
  const summary = swap(LEAN, "[s1.i2] → “We agreed to move the spring planting day”", "\\[s1.i2\\] → “We agreed to move the \\[spring\\] planting day”");
  const data = plan(summary, transcript);
  assert.equal(data.ok, true, JSON.stringify(data.problems));
  assert.deepEqual(data.items!.find((item) => item.id === "s1.i2")?.anchors, ["We agreed to move the [spring] planting day"]);
  assert.equal(JSON.stringify(data), JSON.stringify(plan(unescapeBrackets(summary), transcript)), "the same plan as the unescaped minutes");
  assert.deepEqual(data.passages.find((entry) => entry.n === 2)?.items, ["s1.i1", "s1.i2"]);
  assert.ok(!data.quotes.some((entry) => entry.item === "s1.i2"), "placed word for word");
});

// ---- The CLI: extract, sync tasks, sync record, legacy_tasks and the cleanup plan ----

const git = (dir: string, ...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });

async function gitBrain(context: TestContext): Promise<string> {
  const dir = await fixtureCopy(context);
  git(dir, "init", "-q"); git(dir, "config", "user.email", "t@example.com"); git(dir, "config", "user.name", "T");
  git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "fixture");
  return dir;
}

async function write(dir: string, name: string, value: unknown): Promise<string> {
  const path = join(dir, "..", name);
  await writeFile(path, typeof value === "string" ? value : JSON.stringify(value));
  return path;
}

async function extract(dir: string, summary: string, ...extra: string[]) {
  return brain(["source", "extract", "--page", PAGE, "--title", "Garden call", "--date", "2027-03-10", "--summary", await write(dir, "s.md", summary), "--transcript", await write(dir, "t.md", TRANSCRIPT), "--brain", dir, "--now", NOW, "--json", ...extra]);
}

async function extractPlan(dir: string, summary: string, previous: string) {
  return brain(["source", "extract-plan", "--page", PAGE, "--summary", await write(dir, "s.md", summary), "--transcript", await write(dir, "t.md", TRANSCRIPT), "--previous", previous, "--brain", dir, "--json"]);
}

const TASK = "6a7b0000-0000-4000-8000-0000000000f1";

test("an unticked follow-up gives one Task input, and none on a re-read once its q id is recorded", async (context) => {
  const dir = await gitBrain(context);
  const v1 = await extract(dir, LEAN);
  assert.equal(v1.code, 0, v1.stdout);
  const id = v1.json.data.created[0] as string;
  const file = await readFile(join(dir, v1.json.data.path), "utf8");
  assert.ok(!file.includes("supplier's phone number") && !file.includes("shed key"), "a follow-up's text never enters Git");
  const tasks = await brain(["sync", "tasks", "--source", id, "--input", await write(dir, "tasks.json", { items: [{ title: "Send Ben the supplier's phone number", follow_up: "q1", projects: ["prj-9x4t1b7e"] }, { title: "Draft the volunteer rota for planting day", item: "s1.i3" }] }), "--brain", dir, "--json"]);
  assert.equal(tasks.code, 0, tasks.stdout);
  assert.equal(tasks.json.data.items[0].follow_up, "q1", "the q id is echoed like an item");
  assert.equal(tasks.json.data.items[0].item, undefined);
  assert.equal(tasks.json.data.items[0].properties.Name.value, "Send Ben the supplier's phone number");
  assert.equal(tasks.json.data.items[0].properties.Due, undefined, "no due date");
  assert.equal(tasks.json.data.items[0].properties["Brain ID"].value, id);
  const recorded = await brain(["sync", "record", "--input", await write(dir, "rec.json", { records: [{ id, synced_at: NOW, tasks: [TASK], task_items: { q1: TASK } }] }), "--brain", dir, "--json"]);
  assert.equal(recorded.json.data.records[0].result, "recorded", recorded.stdout);
  git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "tasks");

  const again = await extractPlan(dir, LEAN, id);
  assert.equal(again.code, 0, again.stdout);
  assert.deepEqual(again.json.data.quick.map((entry: { follow_up: string; task: boolean; recorded: string | null }) => [entry.follow_up, entry.task, entry.recorded]), [["q1", false, TASK], ["q2", false, null], ["q3", true, null]]);
  assert.deepEqual(again.json.data.previous.legacy_tasks, [], "a follow-up's Task is always mapped");
  const edited = await extractPlan(dir, swap(LEAN, "Send Ben the supplier's phone number [q1]", "Send Ben the new number [q1]"), id);
  assert.equal(edited.json.data.quick[0].task, false, "the q id is the identity, whatever the text now says");
  const refused = await brain(["sync", "tasks", "--source", id, "--input", await write(dir, "again.json", { items: [{ title: "Send Ben the supplier's phone number", follow_up: "q1" }] }), "--brain", dir, "--json"]);
  assert.equal(refused.json.error.code, "INPUT_INVALID");
  assert.match(refused.json.error.message, new RegExp(TASK));
  assert.deepEqual(refused.json.error.details.map((detail: { pointer: string }) => detail.pointer), ["/items/0/follow_up"]);

  const v2 = await extract(dir, swap(LEAN, "[s3] Selection: Use in brain", "[s3] Selection: Meeting only"), "--previous", id);
  assert.equal(v2.code, 0, v2.stdout);
  const id2 = v2.json.data.created[0] as string;
  assert.match(await readFile(join(dir, v2.json.data.path), "utf8"), /task_items:\n {2}q1: 6a7b0000-0000-4000-8000-0000000000f1/, "the q key is carried forward");
  const chain = await brain(["sync", "tasks", "--source", id2, "--input", await write(dir, "chain.json", { items: [{ title: "x", follow_up: "q1" }] }), "--brain", dir, "--json"]);
  assert.equal(chain.json.error.code, "INPUT_INVALID", "refused along the replaces chain");
  const cleanup = await brain(["source", "cleanup-plan", "--page", PAGE, "--brain", dir, "--json"]);
  assert.equal(cleanup.code, 0, cleanup.stdout);
  assert.deepEqual(cleanup.json.data.tasks, [], "a follow-up's Task is never in a cleanup row");
});

test("sync tasks refuses a follow-up outside an extract source, a malformed q id and the keys a follow-up cannot carry", async (context) => {
  const dir = await gitBrain(context);
  const v1 = await extract(dir, LEAN);
  const id = v1.json.data.created[0] as string;
  const refused = async (target: string[], item: Record<string, unknown>, pointer: string, items?: unknown[]) => {
    const run = await brain(["sync", "tasks", ...target, "--input", await write(dir, "bad.json", { items: items ?? [{ title: "Send Ben the number", ...item }] }), "--brain", dir, "--json"]);
    assert.equal(run.json?.error?.code, "INPUT_INVALID", `${JSON.stringify(item)}: ${run.stdout}`);
    assert.deepEqual(run.json.error.details.map((detail: { pointer: string }) => detail.pointer), [pointer]);
  };
  await refused(["--meeting", "mtg-8c4n2p7w"], { follow_up: "q1" }, "/items/0/follow_up");
  await refused(["--direct"], { follow_up: "q1" }, "/items/0/follow_up");
  const email = "src-4a5b6c7d";
  assert.equal((await brain(["note", "new", "--brain", dir, "--now", NOW, "--input", await write(dir, "email.json", { notes: [{ type: "source", id: email, title: "Pasted email", file_date: "2027-03-10", frontmatter: { source_key: "agent:test/email", kind: "email" }, body: "Send the number.\n" }] }), "--json"])).code, 0);
  await refused(["--source", email], { follow_up: "q1" }, "/items/0/follow_up");
  for (const bad of ["Q1", "q", "s1.i1", "q1a", 1]) await refused(["--source", id], { follow_up: bad }, "/items/0/follow_up");
  await refused(["--source", id], { follow_up: "q1", item: "s1.i3" }, "/items/0/item");
  await refused(["--source", id], { follow_up: "q1", due: "2027-03-20" }, "/items/0/due");
  await refused(["--source", id], { follow_up: "q1", status: "waiting_on", owner: "Ben" }, "/items/0/status");
  await refused(["--source", id], { follow_up: "q1", owner: "Ben" }, "/items/0/owner");
  await refused(["--source", id], {}, "/items/1/follow_up", [{ title: "a", follow_up: "q1" }, { title: "b", follow_up: "q1" }]);
  const ok = await brain(["sync", "tasks", "--source", id, "--input", await write(dir, "ok.json", { items: [{ title: "Ask Carla for the shed key", follow_up: "q3" }] }), "--brain", dir, "--json"]);
  assert.equal(ok.code, 0, ok.stdout);
});

test("sync record takes a q key on an extract, refuses a malformed one and never rebinds it", async (context) => {
  const dir = await gitBrain(context);
  const v1 = await extract(dir, LEAN);
  const id = v1.json.data.created[0] as string;
  const record = async (taskItems: unknown, tasks: string[]) => brain(["sync", "record", "--input", await write(dir, "rec.json", { records: [{ id, synced_at: NOW, tasks, task_items: taskItems }] }), "--brain", dir, "--json"]);
  assert.equal((await record({ Q1: TASK }, [TASK])).json.data.records[0].reason, "INVALID_RESULT", "a q id is lower case");
  assert.equal((await record({ q1: TASK }, [TASK])).json.data.records[0].result, "recorded");
  git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "q1");
  assert.equal((await record({ q1: "6a7b0000-0000-4000-8000-0000000000f2" }, ["6a7b0000-0000-4000-8000-0000000000f2"])).json.data.records[0].reason, "TASK_ITEM_EXISTS");
});
