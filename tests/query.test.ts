import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { rankCandidates, queryWords, type QueryContext } from "../src/lib/query.ts";
import type { Note } from "../src/lib/notes.ts";
import { isMarker } from "../src/lib/brain-marker.ts";
import { brain, FIXTURE_BRAIN, fixtureCopy } from "./helpers.ts";

const BRAIN = ["--brain", FIXTURE_BRAIN, "--json"];

test("query returns deterministic ranked candidates, the superseded decision right after the one that supersedes it", async () => {
  const run = await brain(["query", "--candidates", "auth", "--limit", "50", ...BRAIN]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.tokens, ["auth"]);
  const candidates = run.json.data.candidates;
  // The superseded decision scores almost as high; §5.13 step 5 places it right after its successor, marked.
  assert.deepEqual(candidates.slice(0, 2).map((candidate: { id: string; score: number; superseded_by?: string }) => [candidate.id, candidate.score, candidate.superseded_by]), [
    ["dec-7k2m9q4x", 1.1992, undefined], ["dec-2p9f6h1r", 1.1655, "dec-7k2m9q4x"],
  ]);
  assert.equal(candidates[1].assessment, "superseded");
  assert.equal("superseded_by" in candidates[0], false);
  assert.equal(candidates.some((candidate: { type: string }) => ["view", "proposal", "memory"].includes(candidate.type)), false);
  assert.deepEqual(candidates[1].snippets.map((snippet: { line: number }) => snippet.line), [24, 30]);
});

test("query scores one note as one BM25 document: title and aliases ×3, summary ×2, other frontmatter and the body ×1; up to three snippets", () => {
  const note: Note = {
    id: "con-00000001",
    type: "concept",
    path: "knowledge/concepts/auth.md",
    attributes: {
      id: "con-00000001",
      type: "concept",
      title: "Auth decision",
      aliases: ["Authentication"],
      summary: "Auth summary",
      facts: { owner: "auth team" },
      updated: "2026-12-03",
    },
    body: "auth one\nauth two\nauth three\nauth four\n",
    raw: "---\nid: con-00000001\n---\nauth one\nauth two\nauth three\nauth four\n",
  };
  const context: QueryContext = { repo: null, project: null, area: null };
  const [candidate] = rankCandidates([note], ["auth"], new Set(["concept"]), context);
  // Terms: title and alias [auth decision authentication] ×3 (9; `auth` matches 6), summary [auth summary] ×2 (4; 2),
  // other strings [con 00000001 concept auth team 2026 12 03] (8; 1), body [auth one auth two auth three auth four] (8; 4).
  // One note: N 1, df 1, |d| = avgdl = 29, f 13.
  assert.equal(candidate!.score, Math.round(Math.log(1 + 0.5 / 1.5) * 13 * 2.5 / (13 + 1.5) * 10_000) / 10_000);
  assert.equal(candidate!.score, 0.6448);
  assert.equal(candidate!.snippets.length, 3);
  assert.deepEqual(candidate!.snippets.map((snippet) => snippet.line), [4, 5, 6]);
});

test("query applies linked repository project context and explicit type selection", async (context) => {
  const repo = await mkdtemp(join(tmpdir(), "brain-query-"));
  context.after(() => rm(repo, { recursive: true, force: true }));
  await writeFile(join(repo, ".brain"), JSON.stringify({ repo: "acme-api", project: "prj-9x4t1b7e", area: "area-2m7c4h8n" }));

  const plain = await brain(["query", "--candidates", "auth", ...BRAIN]);
  const contextual = await brain(["query", "--candidates", "auth", "--repo", repo, ...BRAIN]);
  assert.deepEqual(contextual.json.data.context, {
    repo: "acme-api", project: "prj-9x4t1b7e", area: "area-2m7c4h8n",
  });
  const plainDecision = plain.json.data.candidates.find((candidate: { id: string }) => candidate.id === "dec-7k2m9q4x");
  const contextDecision = contextual.json.data.candidates.find((candidate: { id: string }) => candidate.id === "dec-7k2m9q4x");
  assert.ok(Math.abs(contextDecision.score - (plainDecision.score + 3)) <= 0.0001 + 1e-9, "the boost adds 3 before rounding");

  const views = await brain(["query", "--candidates", "acme", "--types", "view", ...BRAIN]);
  assert.equal(views.code, 0, views.stdout);
  assert.deepEqual(views.json.data.candidates.map((candidate: { type: string }) => candidate.type), ["view", "view", "view"]);
});

test("query tokenizes accents and rejects invalid candidate forms", async () => {
  assert.deepEqual(queryWords("¿Qué decidió María? The él y auth"), ["decidio", "maria", "auth"]);
  const cjk = await brain(["query", "--candidates", "予算 auth", ...BRAIN]);
  assert.equal(cjk.code, 0, cjk.stdout);
  assert.deepEqual(cjk.json.data.tokens, ["auth", "予", "算", "予算"], "tokens lists the query's terms, CJK n-grams included");

  const missing = await brain(["query", ...BRAIN]);
  assert.equal(missing.code, 2);
  assert.equal(missing.json.error.code, "USAGE");
  assert.match(missing.json.error.message, /brain-query skill/);

  const limit = await brain(["query", "--candidates", "auth", "--limit", "51", ...BRAIN]);
  assert.equal(limit.code, 2);
  assert.equal(limit.json.error.code, "USAGE");

  const type = await brain(["query", "--candidates", "auth", "--types", "unknown", ...BRAIN]);
  assert.equal(type.code, 2);
  assert.equal(type.json.error.code, "USAGE");
});

test("query reads the .brain that brain link writes: plain (no context), --project (+3), and the same reader refuses an unknown key (CC-152)", async (context) => {
  const dir = await fixtureCopy(context);
  const plainRepo = await mkdtemp(join(tmpdir(), "brain-query-link-"));
  const projectRepo = await mkdtemp(join(tmpdir(), "brain-query-link-"));
  context.after(() => Promise.all([rm(plainRepo, { recursive: true, force: true }), rm(projectRepo, { recursive: true, force: true })]));
  const ARGS = ["--brain", dir, "--json"];

  const linkedPlain = await brain(["link", plainRepo, ...ARGS]);
  assert.equal(linkedPlain.code, 0, linkedPlain.stdout);
  assert.ok("skills" in linkedPlain.json.data.marker.value, "link records the skills it installed in .brain (skills-delivery §6.2)");
  const plain = await brain(["query", "--candidates", "auth", "--repo", plainRepo, ...ARGS]);
  assert.equal(plain.code, 0, plain.stdout);
  assert.deepEqual(plain.json.data.context, { repo: plainRepo.split("/").pop(), project: null, area: null });
  assert.ok(plain.json.data.candidates.length > 0);

  const linkedProject = await brain(["link", projectRepo, "--project", "prj-9x4t1b7e", ...ARGS]);
  assert.equal(linkedProject.code, 0, linkedProject.stdout);
  const contextual = await brain(["query", "--candidates", "auth", "--repo", projectRepo, ...ARGS]);
  assert.equal(contextual.code, 0, contextual.stdout);
  assert.equal(contextual.json.data.context.project, "prj-9x4t1b7e");
  assert.equal(contextual.json.data.context.area, "area-2m7c4h8n");
  const find = (run: { json: { data: { candidates: Array<{ id: string; score: number }> } } }) => run.json.data.candidates.find((candidate) => candidate.id === "dec-7k2m9q4x")!.score;
  assert.ok(Math.abs(find(contextual) - (find(plain) + 3)) <= 0.0001 + 1e-9, "the boost adds 3 before rounding");

  // From inside the repo, without --repo: the CLI reads the current folder's .brain (cli.md §5.13 step 4).
  const previous = process.cwd();
  process.chdir(projectRepo);
  try {
    const fromRepo = await brain(["query", "--candidates", "auth", ...ARGS]);
    assert.equal(fromRepo.code, 0, fromRepo.stdout);
    assert.equal(fromRepo.json.data.context.project, "prj-9x4t1b7e");
    assert.equal(find(fromRepo), find(contextual));
  } finally {
    process.chdir(previous);
  }

  await writeFile(join(plainRepo, ".brain"), JSON.stringify({ repo: "x", colour: "blue" }));
  const unknown = await brain(["query", "--candidates", "auth", "--repo", plainRepo, ...ARGS]);
  assert.equal(unknown.code, 2, unknown.stdout);
  assert.equal(unknown.json.error.code, "USAGE");
  assert.match(unknown.json.error.message, /must be an object with only repo, project, area, stacks, skills/);
});

test("the shared marker validation accepts what link writes and rejects the rest", () => {
  const skills = { name: "ultimate-brain-skills", version: "1.1.0", integrity: "sha256-abc", names: ["brain-query", "brain-workflow"] };
  assert.equal(isMarker({ repo: "acme-api", project: "prj-9x4t1b7e", area: "area-2m7c4h8n", stacks: ["nextjs"], skills }), true);
  assert.equal(isMarker({ repo: "acme-api", skills }), true);
  assert.equal(isMarker({}), true);
  assert.equal(isMarker({ repo: "acme-api", colour: "blue" }), false);
  assert.equal(isMarker({ skills: { ...skills, names: ["Not Kebab"] } }), false);
  assert.equal(isMarker({ skills: { name: "x", version: "1", names: [] } }), false, "integrity is required");
  assert.equal(isMarker([]), false);
});
