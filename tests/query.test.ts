import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { rankCandidates, queryWords, type QueryContext } from "../src/lib/query.ts";
import type { Note } from "../src/lib/notes.ts";
import { brain, FIXTURE_BRAIN } from "./helpers.ts";

const BRAIN = ["--brain", FIXTURE_BRAIN, "--json"];

test("query returns deterministic ranked candidates, including superseded decisions", async () => {
  const run = await brain(["query", "--candidates", "auth", "--limit", "50", ...BRAIN]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.tokens, ["auth"]);
  const candidates = run.json.data.candidates;
  assert.equal(candidates[0].id, "dec-2p9f6h1r");
  assert.equal(candidates[0].assessment, "superseded");
  assert.equal(candidates.some((candidate: { type: string }) => ["view", "proposal", "memory"].includes(candidate.type)), false);
  assert.deepEqual(candidates[0].snippets.map((snippet: { line: number }) => snippet.line), [24, 30]);
});

test("query scores title, summary, all other frontmatter and up to three matching body lines", () => {
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
  assert.equal(candidate!.score, 13);
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
  assert.equal(contextDecision.score, plainDecision.score + 3);

  const views = await brain(["query", "--candidates", "acme", "--types", "view", ...BRAIN]);
  assert.equal(views.code, 0, views.stdout);
  assert.deepEqual(views.json.data.candidates.map((candidate: { type: string }) => candidate.type), ["view", "view"]);
});

test("query tokenizes accents and rejects invalid candidate forms", async () => {
  assert.deepEqual(queryWords("¿Qué decidió María? The él y auth"), ["decidio", "maria", "auth"]);

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
