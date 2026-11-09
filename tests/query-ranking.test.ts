// cli.md §5.13's ranking pinned on small synthetic notes: BM25 (k1 1.5, b 0.75), field weights, prefix match, CJK terms,
// the boost, the 4-place score, the tie order and the superseded notes' place (CC-173).
import assert from "node:assert/strict";
import { test } from "node:test";

import { bm25Scores } from "../src/lib/bm25.ts";
import { isCjkTerm } from "../src/lib/cjk.ts";
import { queryTerms, rankCandidates, type QueryCandidate, type QueryContext } from "../src/lib/query.ts";
import type { Note } from "../src/lib/notes.ts";

const NONE: QueryContext = { repo: null, project: null, area: null };
const CONCEPT = new Set(["concept"]);

/** A concept with only the attributes given (no id or type strings, so the lengths below are easy to count). */
function note(id: string, attributes: Record<string, unknown>, body = ""): Note {
  return { id, type: "concept", path: `knowledge/concepts/${id}.md`, attributes, body, raw: `---\n---\n${body}` };
}

const rank = (notes: Note[], query: string, context = NONE): QueryCandidate[] => rankCandidates(notes, queryTerms(query), CONCEPT, context);
const ids = (candidates: QueryCandidate[]): string[] => candidates.map((candidate) => candidate.id);
const round4 = (value: number): number => Math.round(value * 10_000) / 10_000;
/** One term's BM25 weight, written out from §5.13 step 3. */
const weight = (n: number, df: number, f: number, length: number, avgdl: number): number =>
  Math.log(1 + (n - df + 0.5) / (df + 0.5)) * f * 2.5 / (f + 1.5 * (1 - 0.75 + 0.75 * length / avgdl));

test("the score is BM25 with k1 1.5 and b 0.75, rounded to 4 places (§5.13 steps 3 and 5)", () => {
  // A: title "Auth" ×3 = [auth auth auth], length 3. B: title "Billing" ×3 + body [auth flow], length 5. avgdl 4, df(auth) 2.
  const [a, b] = rank([note("con-a", { title: "Auth" }), note("con-b", { title: "Billing" }, "auth flow\n")], "auth");
  assert.equal(a!.id, "con-a");
  assert.equal(a!.score, round4(weight(2, 2, 3, 3, 4)));
  assert.equal(b!.score, round4(weight(2, 2, 1, 5, 4)));
  assert.equal(a!.score, 0.3241);
  assert.equal(b!.score, 0.1639);
});

test("a title counts three times, a summary twice, other frontmatter strings and the body once", () => {
  const notes = [
    note("con-t", { title: "zebra" }),
    note("con-s", { title: "aa", summary: "zebra" }),
    note("con-o", { title: "aa", facts: { stripes: "zebra" } }),
    note("con-b", { title: "aa" }, "zebra\n"),
  ];
  const ranked = rank(notes, "zebra");
  // con-o and con-b tie (one occurrence each, length 4), so id decides.
  assert.deepEqual(ids(ranked), ["con-t", "con-s", "con-b", "con-o"]);
  assert.equal(ranked[2]!.score, ranked[3]!.score);
});

test("a rarer term weighs more (idf), and a repeated query term counts each time", () => {
  const notes = [note("con-1", {}, "common\n"), note("con-2", {}, "common\n"), note("con-3", {}, "common\n"), note("con-4", {}, "rare\n")];
  assert.equal(rank(notes, "common rare")[0]!.id, "con-4");
  const once = rank(notes, "rare")[0]!.score;
  const twice = rank(notes, "rare rare")[0]!.score;
  assert.ok(Math.abs(twice - 2 * once) <= 0.0001, `${twice} is about twice ${once}`);
});

test("a word matches every term it starts, summed (deci matches decision and decided)", () => {
  const [found] = rank([note("con-a", {}, "The decision was decided.\n"), note("con-b", {}, "Nothing here.\n")], "deci");
  assert.equal(found!.id, "con-a");
  // N 2, df 1, f 2 (decision, decided), length 2 of avgdl 2.
  assert.equal(found!.score, round4(weight(2, 1, 2, 2, 2)));
  assert.deepEqual(rank([note("con-a", {}, "decision\n")], "decisions"), []);
});

test("terms add CJK n-grams to the CLI's words; an n-gram matches only itself (§5.13 step 1)", () => {
  assert.deepEqual(queryTerms("東京の予算"), ["東", "京", "の", "予", "算", "東京", "京の", "の予", "予算", "東京の", "京の予", "の予算"]);
  assert.deepEqual(queryTerms("¿Decisión del 予算? Sign-in"), ["decision", "sign", "予", "算", "予算"]);
  // The dakuten stays: CJK runs are cut out before the words' NFKD.
  assert.deepEqual(queryTerms("が"), ["が"]);
  // 予 matches the 1-gram 予 only, not the 2-gram 予算 it starts.
  const doc = ["予", "算", "予算"];
  assert.ok(bm25Scores([doc, ["x"]], ["予"], isCjkTerm)[0]! < bm25Scores([doc, ["x"]], ["予"], () => false)[0]!);

  const notes = [note("con-a", { title: "Oficina" }, "東京オフィスの予算を決めた。\n"), note("con-b", { title: "Plan" }, "来週の予定。\n"), note("con-c", { title: "Budget" }, "no CJK here\n")];
  const ranked = rank(notes, "予算");
  assert.deepEqual(ids(ranked), ["con-a", "con-b"], "予 alone matches the schedule note, more weakly");
  assert.deepEqual(ranked[0]!.snippets.map((snippet) => snippet.text), ["東京オフィスの予算を決めた。"]);
});

test("the boost adds +3 for the project, else +2 for the area, and a boosted note without a match is returned (§5.13 step 4)", () => {
  // As before CC-173, "else" is per note: a note in the area but not the project gets +2 even when the repo names a project.
  const notes = [
    // Each is four terms long: the title ×3 and one word (`prj`, `area`, `zz`; a 1-character `1` is no word).
    note("con-p", { title: "Auth", projects: ["prj-1"] }),
    note("con-a", { title: "Auth", area: "area-1" }),
    note("con-x", { title: "Other", projects: ["prj-1"] }),
    note("con-n", { title: "Auth", facts: { k: "zz" } }),
  ];
  const plain = rank(notes, "auth").find((candidate) => candidate.id === "con-n")!.score;
  const withProject = rank(notes, "auth", { repo: "r", project: "prj-1", area: "area-1" });
  assert.deepEqual(withProject.map((candidate) => [candidate.id, candidate.score]), [["con-p", round4(plain + 3)], ["con-x", 3], ["con-a", round4(plain + 2)], ["con-n", plain]]);
  const withArea = rank(notes, "auth", { repo: "r", project: null, area: "area-1" });
  assert.deepEqual(withArea.map((candidate) => [candidate.id, candidate.score]), [["con-a", round4(plain + 2)], ["con-n", plain], ["con-p", plain]], "no project: the area boosts, and con-x has nothing");
});

test("ties break by updated, newest first, then by id", () => {
  const notes = [note("con-c", { title: "Auth", updated: "2026-01-01" }), note("con-b", { title: "Auth", updated: "2026-02-01" }), note("con-a", { title: "Auth", updated: "2026-01-01" })];
  assert.deepEqual(ids(rank(notes, "auth")), ["con-b", "con-a", "con-c"]);
});

test("restricted evidence is applied first: a left-out note is no document, so N and df leave it out", () => {
  const notes = [note("con-a", { title: "Auth" }), note("con-b", { title: "Auth" }), note("con-c", { title: "Billing" })];
  const filtered = rankCandidates(notes, ["auth"], CONCEPT, NONE, (candidate) => (candidate.id === "con-b" ? null : candidate));
  assert.deepEqual(filtered, rank([notes[0]!, notes[2]!], "auth"));
});

const supersededBy = (target: string) => ({ relations: [{ type: "superseded_by", target }] });

test("a superseded note ranks right after the note that supersedes it, and carries superseded_by (§5.13 step 5)", () => {
  const notes = [
    note("con-old", { title: "Auth auth", ...supersededBy("con-new") }),
    note("con-mid", { title: "Auth", summary: "auth" }),
    note("con-new", { title: "Auth" }),
    note("con-low", {}, "auth\n"),
  ];
  const ranked = rank(notes, "auth");
  assert.deepEqual(ids(ranked), ["con-mid", "con-new", "con-old", "con-low"]);
  assert.equal(ranked[2]!.superseded_by, "con-new");
  assert.equal("superseded_by" in ranked[1]!, false);
  // The move is decided on the whole list before --limit: a page of 3 holds the pair, and a page of 1 drops the old note with its successor.
  assert.deepEqual(ids(ranked.slice(0, 3)), ["con-mid", "con-new", "con-old"]);
  assert.deepEqual(ids(ranked.slice(0, 1)), ["con-mid"]);
});

test("a chain A → B → C orders C, B, A; a successor ranked above, absent or on a cycle moves nothing", () => {
  const chain = [
    note("con-a", { title: "Auth auth auth", ...supersededBy("con-b") }),
    note("con-b", { title: "Auth auth", ...supersededBy("con-c") }),
    note("con-c", { title: "Auth" }),
  ];
  assert.deepEqual(ids(rank(chain, "auth")), ["con-c", "con-b", "con-a"]);

  const above = [note("con-new", { title: "Auth auth" }), note("con-old", { title: "Auth", ...supersededBy("con-new") })];
  assert.deepEqual(ids(rank(above, "auth")), ["con-new", "con-old"]);
  const absent = [note("con-old", { title: "Auth auth", ...supersededBy("con-gone") }), note("con-x", { title: "Other" }, "auth\n")];
  assert.deepEqual(ids(rank(absent, "auth")), ["con-old", "con-x"]);
  const cycle = [note("con-a", { title: "Auth auth", ...supersededBy("con-b") }), note("con-b", { title: "Auth", ...supersededBy("con-a") })];
  assert.deepEqual(ids(rank(cycle, "auth")), ["con-a", "con-b"]);
  // An archived note without the relation keeps its place.
  const archived = [note("con-arch", { title: "Auth auth", lifecycle: "archived" }), note("con-live", { title: "Auth" })];
  assert.deepEqual(ids(rank(archived, "auth")), ["con-arch", "con-live"]);
});
