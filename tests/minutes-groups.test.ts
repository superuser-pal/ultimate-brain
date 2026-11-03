import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseSummary, planExtract } from "../src/lib/selection.ts";
import { brain, fixtureCopy } from "./helpers.ts";

// CC-112 (decision 0067): quick follow-ups, the Scope toggle and the quote placement rule (capture-and-review §4.1, §4.2). Synthetic data only.

const TRANSCRIPT = [
  "Alice opened the meeting and welcomed everyone.",
  "We agreed the launch moves to March because the vendor slipped.",
  "Maria said she will send the revised plan by Friday.",
  "Alice mentioned her holiday plans in Lisbon next month.",
  "I will book the venue for the launch event this week.",
  "I will also draft the pricing proposal for the board before the next review.",
].join("\n\n");

const NEW_FORMAT = `## Highlights
- [s0.i1] Launch moves to March. "launch moves to March"

## Quick follow-ups
- [ ] Send Maria the link to the venue list
- [x] Forward the vendor's email to Bob

## Tasks
- [ ] [s0.i2] Draft the pricing proposal for the board. "draft the pricing proposal for the board"
<details>
<summary>Scope</summary>
	Done when: the proposal is shared with the board
	Due: 2026-12-17
	Project: Launch
	Notes: use last quarter's numbers
	and the vendor's new quote
</details>

## [s1] Launch
Selection: Use in brain
### Decisions
- [s1.i1] Launch moves to March because the vendor slipped. "agreed the launch moves to March"
### Quick follow-ups
- [ ] Book a call with the vendor
### Tasks
- [s1.i2] Book the venue for the launch event. "book the venue for the launch event"
<details><summary>**Scope**</summary>
Done when: venue confirmed in writing
Due:
Project: none
</details>
### Other commitments
- [s1.i3] Track: Waiting On — Maria will send the revised plan by Friday. "she will send the revised plan by Friday"
`;

test("quick follow-ups are listed, never items, never imported and never a blocker", () => {
  const summary = parseSummary(NEW_FORMAT);
  const plan = planExtract(summary, TRANSCRIPT);
  assert.equal(plan.ok, true, JSON.stringify(plan.problems));
  assert.deepEqual(plan.unnumbered, []);
  assert.deepEqual(plan.quick, [
    { subject: null, id: null, text: "Send Maria the link to the venue list", done: false },
    { subject: null, id: null, text: "Forward the vendor's email to Bob", done: true },
    { subject: "s1", id: null, text: "Book a call with the vendor", done: false },
  ]);
  assert.deepEqual(summary.items.map((item) => item.id), ["s0.i1", "s0.i2", "s1.i1", "s1.i2", "s1.i3"]);
  assert.ok(plan.copied.every((entry) => !/link to the venue|call with the vendor/.test(entry.text)));
});

test("a to-do marker before an item id is formatting, and a to-do outside a Quick follow-ups group still blocks", () => {
  const plan = planExtract(parseSummary(NEW_FORMAT), TRANSCRIPT);
  assert.deepEqual(plan.mappings.find((mapping) => mapping.item === "s0.i2")?.passages, [6]);
  const stray = planExtract(parseSummary("## Highlights\n- [ ] Send the link\n\n## [s1] A\n- [s1.i1] a \"launch moves to March\"\n"), TRANSCRIPT);
  assert.equal(stray.ok, false);
  assert.deepEqual(stray.problems.map((problem) => problem.code), ["UNNUMBERED_LINE"]);
});

test("a group ends at the next heading, group line or subject; a line moved into Quick follow-ups is a quick line", () => {
  const text = `## [s1] Launch
### Quick follow-ups
- [ ] Reply to Bob
- [s1.i1] Book the venue for the launch event. "book the venue for the launch event"
<details><summary>Scope</summary>
Due: not a date
</details>
- Meeting only: anything here is a quick line
**Tasks**
- [s1.i2] Launch moves to March. "launch moves to March"
### Open questions
- [s1.i3] Who pays for the venue? "venue for the launch event this week"
`;
  const summary = parseSummary(text);
  const plan = planExtract(summary, TRANSCRIPT);
  assert.equal(plan.ok, true, JSON.stringify(plan.problems));
  assert.deepEqual(plan.quick.map((line) => [line.id, line.text]), [
    [null, "Reply to Bob"],
    ["s1.i1", "Book the venue for the launch event. \"book the venue for the launch event\""],
    [null, "Meeting only: anything here is a quick line"],
  ]);
  assert.deepEqual(summary.items.map((item) => item.id), ["s1.i2", "s1.i3"]);
  assert.deepEqual(plan.scopes, [], "a Scope inside Quick follow-ups is not read");
  assert.equal(plan.mappings.some((mapping) => mapping.item === "s1.i1"), false);
});

test("an id on a quick line counts for duplicates, and an item that depends on it depends on excluded context", () => {
  const dup = planExtract(parseSummary("## [s1] A\n### Quick follow-ups\n- [s1.i1] Reply \"launch moves to March\"\n### Tasks\n- [s1.i1] Again \"launch moves to March\"\n"), TRANSCRIPT);
  assert.ok(dup.problems.some((problem) => problem.reason === "duplicate id"));
  const dependent = planExtract(parseSummary("## [s1] A\n### Quick follow-ups\n- [s1.i1] Reply to Bob\n### Tasks\n- [s1.i2] Book the venue \"book the venue for the launch event\" (depends on [s1.i1])\n"), TRANSCRIPT);
  assert.equal(dependent.ok, true, JSON.stringify(dependent.problems));
  assert.deepEqual(dependent.problems.map((problem) => problem.code), ["DEPENDS_ON_EXCLUDED"]);
  assert.equal(dependent.copied.length, 0);
});

test("a Scope toggle is read into its item's fields", () => {
  const plan = planExtract(parseSummary(NEW_FORMAT), TRANSCRIPT);
  assert.deepEqual(plan.scopes, [
    { item: "s0.i2", done_when: "the proposal is shared with the board", due: "2026-12-17", project: "Launch", notes: "use last quarter's numbers\nand the vendor's new quote", problems: [] },
    { item: "s1.i2", done_when: "venue confirmed in writing", due: null, project: null, notes: null, problems: [] },
  ]);
});

test("a Scope problem is reported on the Scope and never blocks the input", () => {
  const text = `## [s1] A
### Tasks
- [s1.i1] Book the venue "book the venue for the launch event"
<details><summary>Scope</summary>
the venue, booked
Due: next Friday
Due: 2026-02-30
Project: Launch
Project: Launch
</details>
<details><summary>Scope</summary>
Due: 2026-12-01
</details>

### Decisions
<details><summary>Scope</summary>
Due: 2026-02-30
</details>
- [s1.i2] Launch moves to March. "launch moves to March"
`;
  const plan = planExtract(parseSummary(text), TRANSCRIPT);
  assert.equal(plan.ok, true, JSON.stringify(plan.problems));
  assert.deepEqual(plan.scopes.map((scope) => [scope.item, scope.due, scope.problems]), [
    ["s1.i1", null, ["text before the first field: the venue, booked", "Due is not a date (YYYY-MM-DD): next Friday", "Due given twice", "Project given twice"]],
    ["s1.i1", "2026-12-01", ["a second Scope for s1.i1"]],
    [null, null, ["a Scope with no item line directly above it", "Due is not a date (YYYY-MM-DD): 2026-02-30"]],
  ]);
});

test("lines inside a Scope are never items, unnumbered lines or controls", () => {
  const text = `## [s1] A
### Tasks
- [s1.i1] Book the venue "book the venue for the launch event"
<details><summary>Scope</summary>
- Done when: Meeting only room is booked
- Notes: see [s1.i9]
</details>
`;
  const plan = planExtract(parseSummary(text), TRANSCRIPT);
  assert.equal(plan.ok, true, JSON.stringify(plan.problems));
  assert.deepEqual(plan.unnumbered, []);
  assert.equal(plan.scopes[0]?.done_when, "Meeting only room is booked");
});

test("a quote longer than 12 words that occurs once is placed as it is", () => {
  const plan = planExtract(parseSummary("## [s1] A\n- [s1.i1] Pricing \"I will also draft the pricing proposal for the board before the next review\"\n"), TRANSCRIPT);
  assert.equal(plan.ok, true, JSON.stringify(plan.problems));
  assert.deepEqual(plan.mappings[0]?.passages, [6]);
  assert.deepEqual(plan.quotes, []);
});

test("a reworded or joined quote of an included item is placed by its longest unique stretch of 6 to 12 words", () => {
  const reworded = planExtract(parseSummary("## [s1] A\n- [s1.i1] Pricing \"I will also write the pricing proposal for the board before the next review\"\n"), TRANSCRIPT);
  assert.equal(reworded.ok, true, JSON.stringify(reworded.problems));
  assert.deepEqual(reworded.mappings[0]?.passages, [6]);
  assert.deepEqual(reworded.quotes, [{ item: "s1.i1", anchor: "I will also write the pricing proposal for the board before the next review", result: "shortened", stretches: ["the pricing proposal for the board before the next review"], reason: "not found word for word" }]);
  const joined = planExtract(parseSummary("## [s1] A\n- [s1.i1] Both \"the launch moves to March because the vendor slipped. Maria said she will send the revised plan\"\n"), TRANSCRIPT);
  assert.deepEqual(joined.mappings[0]?.passages, [2, 3]);
  assert.equal(joined.quotes[0]?.result, "shortened");
});

test("an included item's unplaced quote is reported; with no quote left the item is not imported, and nothing blocks", () => {
  const text = "## [s1] A\n- [s1.i1] Launch \"launch moves to March\" \"the moon is made of cheese\"\n- [s1.i2] Venue \"the venue was cancelled\"\n- [s1.i3] No quote at all\n- [s1.i4] Common \"Alice\"\n- [s1.i5] Four \"launch moves to March\" \"revised plan by Friday\" \"book the venue\" \"holiday plans in Lisbon\"\n";
  const plan = planExtract(parseSummary(text), TRANSCRIPT);
  assert.equal(plan.ok, true, JSON.stringify(plan.problems));
  assert.deepEqual(plan.quotes.map((quote) => [quote.item, quote.result, quote.reason]), [
    ["s1.i1", "unplaced", "not in the transcript"],
    ["s1.i2", "unplaced", "not in the transcript"],
    ["s1.i3", "unplaced", "no quote"],
    ["s1.i4", "unplaced", "in 2 paragraphs"],
  ]);
  assert.deepEqual(plan.unplaced_items, ["s1.i2", "s1.i3", "s1.i4"]);
  assert.deepEqual(plan.mappings.find((mapping) => mapping.item === "s1.i1")?.passages, [2]);
  assert.deepEqual(plan.mappings.find((mapping) => mapping.item === "s1.i5")?.passages, [2, 3, 4, 5], "more than three quotes are all used");
  assert.equal(plan.mappings.find((mapping) => mapping.item === "s1.i2")?.imported, false);
  assert.deepEqual(plan.copied.map((entry) => entry.n), [2, 3, 4, 5]);
});

test("the same quote problems on an excluded item still block, and a stretch never places an excluded item", () => {
  for (const anchor of ["the moon is made of cheese", "Alice", "I will also write the pricing proposal for the board before the next review"]) {
    const plan = planExtract(parseSummary(`## [s1] A\nSelection: Meeting only\n- [s1.i1] x "${anchor}"\n`), TRANSCRIPT);
    assert.equal(plan.ok, false, anchor);
    assert.equal(plan.problems[0]?.code, "SELECTION_UNMAPPABLE");
  }
  const none = planExtract(parseSummary("## [s1] A\n- [s1.i1] Meeting only: no quote\n"), TRANSCRIPT);
  assert.equal(none.ok, false);
  const long = planExtract(parseSummary("## [s1] A\nSelection: Meeting only\n- [s1.i1] x \"I will also draft the pricing proposal for the board before the next review\"\n"), TRANSCRIPT);
  assert.equal(long.ok, true, "a long exact quote places an excluded item too");
  assert.deepEqual(long.copied, []);
});

test("a stretch that lands on an excluded item's paragraph is caught by the fail-closed copy rule", () => {
  const text = "## [s1] A\n- [s1.i1] Trip \"Alice talked about her holiday plans in Lisbon next month\"\n\n## [s2] B\nSelection: Meeting only\n- [s2.i1] Holiday \"holiday plans in Lisbon\"\n";
  const plan = planExtract(parseSummary(text), TRANSCRIPT);
  assert.equal(plan.ok, false);
  assert.ok(plan.problems.some((problem) => problem.id === "s1.i1" && problem.reason === "shares a paragraph with excluded content"));
});

test("0.8 minutes with My actions give the same plan as before", () => {
  const summary = `## Attendees
Alice (host), Maria (vendor)

## Projects
Launch

All subjects included unless marked Meeting only. Mark Reviewed to confirm.

## Highlights
- [s0.i1] Launch moves to March. "launch moves to March"

## My actions
- [s0.i2] Book the venue for the launch event. "book the venue for the launch event"

## [s1] Launch
Selection: Use in brain
### Decisions
- [s1.i1] Launch moves to March because the vendor slipped. "agreed the launch moves to March"
### My actions
- [s1.i3] Book the venue this week. "venue for the launch event this week" (depends on [s1.i1])
### Other commitments
- [s1.i2] Track: Waiting On — Maria will send the revised plan by Friday. "she will send the revised plan by Friday"

## [s2] Small talk
Selection: Meeting only
- [s2.i1] Alice's holiday plans. "holiday plans in Lisbon"
`;
  const plan = planExtract(parseSummary(summary), TRANSCRIPT);
  // Recorded from the 0.8.1 parser before CC-112.
  assert.deepEqual({ ok: plan.ok, mappings: plan.mappings, copied: plan.copied.map((entry) => [entry.n, entry.items]), uncovered: plan.uncovered, problems: plan.problems }, {
    ok: true,
    mappings: [
      { item: "s0.i1", effective: "use", explicit: null, passages: [2], imported: true, context_excluded: false },
      { item: "s0.i2", effective: "use", explicit: null, passages: [5], imported: true, context_excluded: false },
      { item: "s1.i1", effective: "use", explicit: null, passages: [2], imported: true, context_excluded: false },
      { item: "s1.i3", effective: "use", explicit: null, passages: [5], imported: true, context_excluded: false },
      { item: "s1.i2", effective: "use", explicit: null, passages: [3], imported: true, context_excluded: false },
      { item: "s2.i1", effective: "meeting only", explicit: null, passages: [4], imported: false, context_excluded: false },
    ],
    copied: [[2, ["s0.i1", "s1.i1"]], [3, ["s1.i2"]], [5, ["s0.i2", "s1.i3"]]],
    uncovered: 2,
    problems: [],
  });
  assert.deepEqual([plan.quick, plan.scopes, plan.quotes, plan.unplaced_items], [[], [], [], []]);
});

test("source extract-plan returns the quick lines, the Scopes and the quote report, and writes the extract without them", async (context) => {
  const dir = await fixtureCopy(context);
  const summary = join(dir, "..", "summary.md");
  const transcript = join(dir, "..", "transcript.md");
  await writeFile(transcript, TRANSCRIPT);
  await writeFile(summary, NEW_FORMAT.replace("\"agreed the launch moves to March\"", "\"we agreed that the launch moves to March because the vendor slipped\""));
  const run = await brain(["source", "extract-plan", "--page", "7a7b0000-0000-4000-8000-0000000000cc", "--summary", summary, "--transcript", transcript, "--brain", dir, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  const data = run.json.data;
  assert.equal(data.ok, true);
  assert.equal(data.quick.length, 3);
  assert.deepEqual(data.scopes.map((scope: { item: string; due: string | null }) => [scope.item, scope.due]), [["s0.i2", "2026-12-17"], ["s1.i2", null]]);
  assert.deepEqual(data.quotes.map((quote: { item: string; result: string }) => [quote.item, quote.result]), [["s1.i1", "shortened"]]);
  assert.deepEqual(data.unplaced_items, []);
  assert.ok(!data.body.includes("Send Maria") && !data.body.includes("Done when"), "quick lines and Scopes never enter the extract");
  assert.deepEqual(data.selection.map((entry: { id: string }) => entry.id), ["s1", "s0.i1", "s0.i2", "s1.i1", "s1.i2", "s1.i3"]);
});
