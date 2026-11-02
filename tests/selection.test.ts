import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyDrift, extractBody, pageFingerprint, paragraphs, parseSummary, planExtract } from "../src/lib/selection.ts";

const TRANSCRIPT = [
  "We start with the launch plan and agree the launch moves to February.",
  "Pricing is 95k, keep it between us, and also the offsite is booked.",
  "Small talk about the weather and the train.",
  "Maria will send the draft contract on Friday.",
].join("\n\n");

const SUMMARY = `## [s1] Launch
Selection: Use in brain
- [s1.i1] Launch moves to February “the launch moves to February”
- [s1.i2] Maria sends the contract “send the draft contract on Friday”

## [s2] Pricing
Selection: Meeting only
- [s2.i1] Pricing figure “Pricing is 95k”
- [s2.i2] Offsite booked “the offsite is booked”
`;

test("parses subjects, tokens and items, tolerating bullets and straight quotes", () => {
  const summary = parseSummary(SUMMARY.replace(/“|”/g, '"'));
  assert.deepEqual(summary.subjects.map((s) => [s.id, s.selection]), [["s1", "use"], ["s2", "meeting only"]]);
  assert.equal(summary.items.length, 4);
  assert.deepEqual(summary.items[0]?.anchors, ["the launch moves to February"]);
  assert.equal(summary.problems.length, 0);
});

test("an unreadable subject token is SELECTION_UNREADABLE and blocks the input", () => {
  const summary = parseSummary("## [s1] A\nSelection: Maybe\n- [s1.i1] x “the launch moves to February”\n");
  assert.equal(summary.problems[0]?.code, "SELECTION_UNREADABLE");
  assert.equal(planExtract(summary, TRANSCRIPT).ok, false);
});

test("a paragraph shared with excluded content is not copied and blocks the including item", () => {
  const shared = SUMMARY.replace("“the launch moves to February”", "“also the offsite is booked”");
  const plan = planExtract(parseSummary(shared), TRANSCRIPT);
  assert.equal(plan.ok, false);
  const blocked = plan.problems.find((p) => p.reason === "shares a paragraph with excluded content");
  assert.equal(blocked?.id, "s1.i1");
  assert.deepEqual(blocked?.with, ["s2.i1", "s2.i2"]);
  assert.ok(plan.copied.every((entry) => !entry.text.includes("95k")), "the excluded words never reach the extract");
});

test("separate paragraphs: only included subjects are copied, the transcript is never copied whole", () => {
  const summary = parseSummary(SUMMARY.replace("the launch moves to February”", "launch moves to February”").replace("“Pricing is 95k”", "“keep it between us”"));
  const plan = planExtract(summary, TRANSCRIPT.replace("and also the offsite is booked", "and nothing else"));
  assert.equal(plan.ok, false, "s2.i2 anchor is gone so it is unmappable");
  const fixed = parseSummary(SUMMARY.replace("“Pricing is 95k”", "“keep it between us”").replace("“the offsite is booked”", "“keep it between us”"));
  const clean = planExtract(fixed, [TRANSCRIPT.split("\n\n")[0], "Pricing is 95k, keep it between us.", TRANSCRIPT.split("\n\n")[3]].join("\n\n"));
  assert.equal(clean.ok, true);
  assert.deepEqual(clean.copied.map((entry) => entry.n), [1, 3]);
  assert.ok(!extractBody(clean).includes("95k"));
  assert.equal(clean.uncovered, 0);
});

test("an explicit Use in brain under a Meeting only subject is copied when no excluded item cites its paragraph", () => {
  const summary = parseSummary("## [s2] Pricing\nSelection: Meeting only\n- [s2.i1] Use in brain: Contract “send the draft contract on Friday”\n");
  const plan = planExtract(summary, TRANSCRIPT);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.copied.map((entry) => entry.n), [4]);
});

test("missing, ambiguous, absent-id and cyclic references make the item unmappable", () => {
  const text = "A repeated line.\n\nA repeated line.\n\nUnique line here.";
  const summary = parseSummary("## [s1] A\n- [s1.i1] a “A repeated line”\n- [s1.i2] b “not in transcript”\n- [s1.i3] c “Unique line here” (depends on [s9])\n- [s1.i4] d “Unique line here” (depends on [s1.i5])\n- [s1.i5] e “Unique line here” (depends on [s1.i4])\n");
  const reasons = planExtract(summary, text).problems.map((p) => `${p.id}:${p.reason.split(" ").slice(0, 3).join(" ")}`);
  assert.deepEqual(reasons, ["s1.i1:anchor in 2", "s1.i2:anchor not in", "s1.i3:depends on unknown", "s1.i4:depends on cycle", "s1.i5:depends on cycle"]);
});

test("an item that depends on excluded context is not imported unless it has an explicit use", () => {
  const base = "## [s1] Context\nSelection: Meeting only\n- [s1.i1] c “We start with the launch plan”\n\n## [s2] Ask\n- [s2.i1] a “Maria will send the draft contract” (depends on [s1])\n";
  const dropped = planExtract(parseSummary(base), TRANSCRIPT);
  assert.equal(dropped.problems[0]?.code, "DEPENDS_ON_EXCLUDED");
  assert.equal(dropped.copied.length, 0);
  const kept = planExtract(parseSummary(base.replace("[s2.i1] a", "[s2.i1] Use in brain: a")), TRANSCRIPT);
  assert.deepEqual(kept.copied.map((entry) => entry.n), [4]);
  assert.equal(kept.mappings.find((m) => m.item === "s2.i1")?.context_excluded, true);
});

test("paragraphs are numbered, identical paragraphs are two passages, and re-reading is stable", () => {
  const a = paragraphs("One.\n\nOne.\n\nTwo.");
  assert.deepEqual(a.paragraphs.map((p) => p.n), [1, 2, 3]);
  assert.equal(a.paragraphs[0]?.hash, a.paragraphs[1]?.hash);
  assert.equal(paragraphs("One.\n\nOne.\n\nTwo.").transcript_hash, a.transcript_hash);
});

test("drift: tokens, text-only, stale and none", () => {
  const hash = paragraphs(TRANSCRIPT).transcript_hash;
  const before = parseSummary(SUMMARY);
  assert.deepEqual(classifyDrift(before, parseSummary(SUMMARY), hash, hash), { kind: "none" });
  const tokens = classifyDrift(before, parseSummary(SUMMARY.replace("Selection: Meeting only", "Selection: Use in brain")), hash, hash);
  assert.equal(tokens.kind, "tokens");
  assert.deepEqual(tokens.kind === "tokens" && tokens.changes.map((c) => c.id), ["s2", "s2.i1", "s2.i2"].slice(0, 1));
  assert.equal(classifyDrift(before, parseSummary(SUMMARY.replace("Pricing figure", "The price")), hash, hash).kind, "text");
  assert.equal(classifyDrift(before, parseSummary(SUMMARY.replace("“Pricing is 95k”", "“keep it between us”")), hash, hash).kind, "stale");
  assert.equal(classifyDrift(before, before, hash, "other").kind, "stale");
  assert.notEqual(pageFingerprint(before, hash), pageFingerprint(parseSummary(SUMMARY.replace("Pricing figure", "The price")), hash));
});
