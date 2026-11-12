import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { score } from "../eval/minutes-0.14/score.mjs";

const dir = new URL("../eval/minutes-0.14/", import.meta.url);
const transcript = readFileSync(new URL("transcript.md", dir), "utf8");
const reference = readFileSync(new URL("reference-output.md", dir), "utf8");

test("the reference output meets 0079 §6's bar", () => {
  const result = score(reference, transcript);
  assert.equal(result.toggle.form, "details");
  assert.equal(result.counts.items, 13);
  assert.equal(result.counts.items_passed, 13);
  assert.equal(result.counts.follow_ups_with_q, 3);
  assert.deepEqual(result.unnumbered, []);
  assert.deepEqual(result.problems, []);
  assert.equal(result.bar.pass, true);
});

test("an output read back with escapes and curly quotes scores the same", () => {
  const escaped = reference
    .replace(/\[(s\d+(?:\.i\d+)?|q\d+)\]/g, "\\[$1\\]")
    .replace(/"([^"\n]+)"/g, "“$1”");
  const result = score(escaped, transcript);
  assert.equal(result.counts.items_passed, 13);
  assert.equal(result.bar.pass, true);
});

test("a toggle heading or a plain line is not the toggle the contract reads", () => {
  const heading = reference.replace("<details>\n<summary>For the brain</summary>", '## For the brain {toggle="true"}');
  assert.equal(score(heading, transcript).toggle.form, "toggle heading");
  assert.equal(score(heading, transcript).bar.pass, false);
  const plain = reference.replace("<details>\n<summary>For the brain</summary>", "**For the brain**");
  assert.equal(score(plain, transcript).toggle.form, "plain line");
  assert.equal(score(plain, transcript).bar.toggle, false);
});

test("two misses of thirteen fail the bar; one passes it", () => {
  const one = reference.replace('"We keep twenty-five cents per minute during the pilot"', '"we keep the price at twenty-five cents"');
  const oneResult = score(one, transcript);
  assert.equal(oneResult.counts.items_passed, 12);
  assert.equal(oneResult.bar.items, true);
  const two = one.replace('"find one more issue in the refund flow"', '"we lose another two weeks and March is gone too as well"');
  const twoResult = score(two, transcript);
  assert.equal(twoResult.counts.items_passed, 11);
  assert.equal(twoResult.bar.items, false);
});

test("a quote that occurs in two paragraphs, or a missing entry, is a miss", () => {
  const repeated = reference.replace('"We could also try a weekend pass"', '"Ines Varga:"');
  assert.equal(score(repeated, transcript).items.find((i) => i.id === "s3.i3").pass, false);
  const missing = reference.replace(/\t\[s2\.i3\][^\n]*\n/, "");
  const result = score(missing, transcript);
  assert.equal(result.items.find((i) => i.id === "s2.i3").entry, null);
  assert.equal(result.counts.items_passed, 12);
});

test("a follow-up without a q id fails the follow-up bar", () => {
  const result = score(reference.replace("Send Priya the brand font files [q2]", "Send Priya the brand font files"), transcript);
  assert.equal(result.counts.follow_ups_with_q, 2);
  assert.equal(result.bar.followUps, false);
});

test("a lost tag, a token on a readable line and a Selection line outside the toggle are reported", () => {
  const broken = reference
    .replace("Decided: keep twenty-five cents per minute during the pilot. [s3.i2]", "Decided: keep twenty-five cents per minute during the pilot.")
    .replace("Idea: a nine-euro weekend pass", "Meeting only: a nine-euro weekend pass")
    .replace("## Pricing pilot [s3]\n", "## Pricing pilot [s3]\n[s3] Selection: Use in brain\n");
  const result = score(broken, transcript);
  assert.deepEqual(result.unnumbered, ["Decided: keep twenty-five cents per minute during the pilot."]);
  assert.ok(result.orphans.includes("s3.i2"));
  assert.ok(result.problems.some((p) => p.startsWith("a selection token on a readable line: s3.i3")));
  assert.ok(result.problems.some((p) => p.startsWith("a Selection line outside the toggle")));
});
