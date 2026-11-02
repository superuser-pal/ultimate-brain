import assert from "node:assert/strict";
import { test } from "node:test";

import { eligible, lineageOf, noteReleased, restrictedSources, type Context, type SourceInfo, type Suppression } from "../src/lib/eligibility.ts";

const M1 = "page-meeting-1";
const M2 = "page-meeting-2";
const source = (info: SourceInfo): [string, SourceInfo] => [info.id, info];
const sources = new Map<string, SourceInfo>([
  source({ id: "src-full1", source_key: `notion:${M1}` }),
  source({ id: "src-ex1v1", extract_of: M1, replaces: "src-full1", transcript_hash: "h1", passages: ["1:aaaaaaaa", "2:bbbbbbbb"] }),
  source({ id: "src-ex1v2", extract_of: M1, replaces: "src-ex1v1", transcript_hash: "h1", passages: ["1:aaaaaaaa"] }),
  source({ id: "src-other", source_key: `notion:${M2}` }),
  source({ id: "src-orphan" }),
]);
const suppress = (input: string, status: Suppression["status"] = "active"): Suppression => ({ input, version: 2, passages: [{ extract_of: input, transcript_hash: "h1", n: 2 }], status });
const context = (suppressions: Suppression[], awaitingRestore?: Set<string>): Context => ({ sources, suppressions, awaitingRestore });

test("lineage follows extract_of, source_key and the replaces chain; unknown is null", () => {
  assert.equal(lineageOf("src-ex1v2", sources), M1);
  assert.equal(lineageOf("src-full1", sources), M1);
  assert.equal(lineageOf("src-orphan", sources), null);
});

test("with no suppression every claim is eligible", () => {
  assert.equal(eligible({ entries: [{ source: "src-ex1v1", passage: { n: 2, hash: "bbbbbbbb" } }] }, context([])), true);
});

test("a claim on a suppressed passage is restricted, one on a kept passage is live, and an older full copy does not rescue it", () => {
  const ctx = context([suppress(M1)]);
  assert.equal(eligible({ entries: [{ source: "src-ex1v1", passage: { n: 2, hash: "bbbbbbbb" } }] }, ctx), false);
  assert.equal(eligible({ entries: [{ source: "src-ex1v2", passage: { n: 1, hash: "aaaaaaaa" } }] }, ctx), true);
  assert.equal(eligible({ entries: [{ source: "src-ex1v1", passage: { n: 2, hash: "bbbbbbbb" } }, { source: "src-full1" }] }, ctx), false);
});

test("a claim that also cites a different input stays eligible", () => {
  const entries = [{ source: "src-ex1v1", passage: { n: 2, hash: "bbbbbbbb" } }, { source: "src-other" }];
  assert.equal(eligible({ entries }, context([suppress(M1)])), true);
});

test("a re-included passage is live only after its Restore item is accepted", () => {
  const entry = { source: "src-ex1v2", passage: { n: 1, hash: "aaaaaaaa" } };
  assert.equal(eligible({ entries: [entry] }, context([suppress(M1)], new Set([`${M1}|h1|1`]))), false);
  assert.equal(eligible({ entries: [entry] }, context([suppress(M1)], new Set())), true);
});

test("unknown lineage is never live while any suppression is active, until every active input is cleared", () => {
  const claim = { entries: [{ source: "src-orphan" }] };
  assert.equal(eligible(claim, context([])), true);
  assert.equal(eligible(claim, context([suppress(M1)])), false);
  assert.equal(eligible({ ...claim, lineage_cleared: [M1] }, context([suppress(M1)])), true);
  assert.equal(eligible({ ...claim, lineage_cleared: [M1] }, context([suppress(M1), suppress(M2)])), false, "a second suppression restricts again");
  assert.equal(eligible({ ...claim, lineage_cleared: [M1, M2] }, context([suppress(M1), suppress(M2)])), true);
});

test("release is per note and per active suppression; a reconciled suppression no longer restricts", () => {
  const ctx = context([suppress(M1), suppress(M2)]);
  assert.equal(noteReleased({ lineage_cleared: [M1] }, ctx), false);
  assert.equal(noteReleased({ lineage_cleared: [M1] }, ctx, new Set([M2])), true);
  assert.equal(noteReleased({}, context([suppress(M1, "reconciled")])), true);
});

test("older versions and full copies of a changed input are restricted as sources; the latest extract is not", () => {
  assert.deepEqual([...restrictedSources(context([suppress(M1)]))].sort(), ["src-ex1v1", "src-full1"]);
  assert.equal(restrictedSources(context([])).size, 0);
});
