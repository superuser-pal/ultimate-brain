import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy } from "./helpers.ts";

// Concepts become learned Documents (decision 0071, spec/schema.md §4, spec/cli.md §5.15 step 5a).
const NOW = "2026-12-10T09:00:00Z";
const SOURCE = "src-7w3c9k5m";
/** A document source: unlike minutes, it has an Inbox row. */
const BRIEF = "src-6e7f8g9h";
const AREA = "area-2m7c4h8n";
const PROJECT = "prj-9x4t1b7e";
const DECISION = "knowledge/decisions/2026-12-03-use-supabase-for-auth.md";

async function noteNew(dir: string, input: unknown) {
  const file = join(dir, "..", "input.json");
  await writeFile(file, JSON.stringify(input));
  return brain(["note", "new", "--input", file, "--brain", dir, "--now", NOW, "--json"]);
}

const exists = (path: string) => stat(path).then(() => true, () => false);
const errors = (run: { json: { data: { issues: Array<{ severity: string; rule: string; path: string }> } } }) =>
  run.json.data.issues.filter((issue) => issue.severity === "error");

/** Two concept notes as a brain before 0.9.1 holds them: published, linked from a decision, one linking the other. */
async function withConcepts(dir: string): Promise<void> {
  const source = await noteNew(dir, { notes: [{ type: "source", id: BRIEF, title: "Hosting brief", file_date: "2026-12-03", frontmatter: { source_key: "agent:test/hosting-brief", kind: "document", summary: "How Acme hosts the site." }, body: "Blue-green, edge cache.\n" }] });
  assert.equal(source.code, 0, source.stdout);
  await mkdir(join(dir, "knowledge/concepts"), { recursive: true });
  await writeFile(join(dir, "knowledge/concepts/deployment-model.md"), `---
id: con-2a3b4c5d
type: concept
title: Deployment model
summary: Blue-green deploys behind a feature flag.
lifecycle: reviewed
area: ${AREA}
projects: [${PROJECT}]
sources: [${BRIEF}]
notion: 10000000-0000-4000-8000-0000000000c1
last_synced: 2026-12-04T10:00:00Z
notion_published:
  Name: Deployment model
created: 2026-12-03
updated: 2026-12-03
---

Two stacks; traffic moves once checks pass. See [caching](caching.md#warm-up) and [Maria](../people/maria-lopez.md).
`);
  await writeFile(join(dir, "knowledge/concepts/caching.md"), `---
id: con-3b4c5d6e
type: concept
title: Caching
summary: Edge caching for the marketing pages.
lifecycle: draft
sources: [${BRIEF}]
created: 2026-12-03
updated: 2026-12-03
---

Pages are cached at the edge; deploys follow the [deployment model](./deployment-model.md "how we ship").
`);
  // A Document already holds caching.md's slug, so the converted one becomes caching-2.md.
  await mkdir(join(dir, "knowledge/references"), { recursive: true });
  await writeFile(join(dir, "knowledge/references/caching.md"), `---
id: ref-4c5d6e7f
type: reference
title: Caching table
summary: The cache durations Acme asked for.
lifecycle: draft
origin: part
sources: [${BRIEF}]
created: 2026-12-03
updated: 2026-12-03
---

| Page | TTL |
`);
  const decision = await readFile(join(dir, DECISION), "utf8");
  await writeFile(join(dir, DECISION), `${decision}\nShipped with the [deployment model](../concepts/deployment-model.md).\n`);
  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  config.notion.databases.concepts = "a1000000-0000-4000-8000-00000000000d";
  await writeFile(join(dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  assert.equal((await brain(["index", "--brain", dir, "--json"])).code, 0);
}

test("note new writes a learned Document as a draft in knowledge/references and refuses the concept type", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await noteNew(dir, { notes: [{ type: "reference", title: "Feature flags", frontmatter: { origin: "learned", summary: "Ship dark, turn on per client.", projects: [PROJECT], sources: [SOURCE] }, body: "Flags let a deploy ship dark.\n" }] });
  assert.equal(run.code, 0, run.stdout);
  const [created] = run.json.data.created;
  assert.equal(created.path, "knowledge/references/feature-flags.md");
  const note = parseFrontmatter(await readFile(join(dir, created.path), "utf8")).attributes;
  assert.equal(note.origin, "learned");
  assert.equal(note.lifecycle, "draft");

  // A learned Document keeps the concept's rule: sources are optional.
  const sourceless = await noteNew(dir, { notes: [{ type: "reference", title: "Pairing", frontmatter: { origin: "learned", summary: "Two people, one screen." }, body: "Pairing.\n" }] });
  assert.equal(sourceless.code, 0, sourceless.stdout);

  const concept = await noteNew(dir, { notes: [{ type: "concept", title: "Old style", frontmatter: { summary: "A concept." }, body: "x\n" }] });
  assert.equal(concept.json.error.code, "INPUT_INVALID");
  assert.match(JSON.stringify(concept.json.error), /learned/);
});

test("Promote is on decisions only: note new refuses a promoted Document from a learned one", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await noteNew(dir, { notes: [{ type: "reference", title: "RLS write-up", frontmatter: { origin: "promoted", promoted_from: "con-1s6t8e2b", summary: "RLS, written up." }, body: "RLS.\n" }] });
  assert.equal(run.json.error.code, "INPUT_INVALID");
  assert.match(JSON.stringify(run.json.error), /not an existing decision/);
});

test("lint reports a concept note left in a brain as concept-retired", async (context) => {
  const dir = await fixtureCopy(context);
  await withConcepts(dir);
  const run = await brain(["lint", "--brain", dir, "--json"]);
  const retired = errors(run).filter((issue) => issue.rule === "concept-retired").map((issue) => issue.path).sort();
  assert.deepEqual(retired, ["knowledge/concepts/caching.md", "knowledge/concepts/deployment-model.md"]);
});

test("brain upgrade turns every concept into a learned Document, rewrites the links to it and rebuilds the index", async (context) => {
  const dir = await fixtureCopy(context);
  await withConcepts(dir);

  const dry = await brain(["upgrade", "--brain", dir, "--dry-run", "--now", NOW, "--json"]);
  assert.equal(dry.code, 0, dry.stdout);
  assert.deepEqual(dry.json.data.converted, [
    { id: "con-3b4c5d6e", from: "knowledge/concepts/caching.md", to: "knowledge/references/caching-2.md" },
    { id: "con-2a3b4c5d", from: "knowledge/concepts/deployment-model.md", to: "knowledge/references/deployment-model.md" },
  ]);
  assert.equal(dry.json.data.lint.errors, 0, "the dry run lints the planned tree");
  assert.ok(await exists(join(dir, "knowledge/concepts/caching.md")), "a dry run writes nothing");

  const run = await brain(["upgrade", "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.converted, dry.json.data.converted);
  const actions = new Map<string, string>(run.json.data.files.map((file: { path: string; action: string }) => [file.path, file.action]));
  assert.equal(actions.get("knowledge/concepts/deployment-model.md"), "removed");
  assert.equal(actions.get("knowledge/references/deployment-model.md"), "created");
  assert.equal(actions.get(DECISION), "updated");
  assert.equal(actions.get("index.md"), "updated");
  assert.equal(actions.get("brain.json"), "updated");
  assert.equal(await exists(join(dir, "knowledge/concepts")), false, "the emptied folder is removed");

  const model = await readFile(join(dir, "knowledge/references/deployment-model.md"), "utf8");
  const attributes = parseFrontmatter(model).attributes;
  assert.equal(attributes.id, "con-2a3b4c5d", "the id is kept");
  assert.equal(attributes.type, "reference");
  assert.equal(attributes.origin, "learned");
  assert.equal(attributes.lifecycle, "reviewed");
  assert.equal(attributes.area, AREA);
  assert.deepEqual(attributes.projects, [PROJECT]);
  assert.deepEqual(attributes.sources, [BRIEF]);
  for (const key of ["notion", "last_synced", "notion_published"]) assert.equal(key in attributes, false, `${key} is cleared`);
  assert.match(model, /See \[caching\]\(caching-2\.md#warm-up\) and \[Maria\]\(\.\.\/people\/maria-lopez\.md\)\./);
  // Both moved to the same folder, so this link still reaches its file and stays as written.
  assert.match(await readFile(join(dir, "knowledge/references/caching-2.md"), "utf8"), /\[deployment model\]\(\.\/deployment-model\.md "how we ship"\)/);
  assert.match(await readFile(join(dir, DECISION), "utf8"), /\[deployment model\]\(\.\.\/references\/deployment-model\.md\)/);
  const index = await readFile(join(dir, "index.md"), "utf8");
  assert.doesNotMatch(index, /## Concepts|knowledge\/concepts/);
  assert.match(index, /\[Deployment model\]\(knowledge\/references\/deployment-model\.md\) — con-2a3b4c5d · origin: learned/);
  assert.equal("concepts" in JSON.parse(await readFile(join(dir, "brain.json"), "utf8")).notion.databases, false);

  const lint = await brain(["lint", "--brain", dir, "--json"]);
  assert.deepEqual(errors(lint), []);
  assert.equal(lint.json.data.issues.some((issue: { rule: string }) => issue.rule === "index-stale"), false);

  // Reachable from its project, area and source: render publishes it to Documents with both relations, and the source's Inbox row lists it.
  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  config.notion.databases.documents = "a1000000-0000-4000-8000-00000000000e";
  config.notion.databases.inbox = "a1000000-0000-4000-8000-00000000000c";
  await writeFile(join(dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  const render = await brain(["sync", "render", "--brain", dir, "--ids", `con-2a3b4c5d,${BRIEF}`, "--json"]);
  assert.equal(render.code, 0, render.stdout);
  const items = new Map<string, { database: string; action: string; properties: Record<string, { value: unknown }>; pending_relations: Array<{ property: string; ids: string[] }> }>(render.json.data.items.map((item: { id: string }) => [item.id, item]));
  const learned = items.get("con-2a3b4c5d")!;
  assert.equal(learned.database, "documents");
  assert.equal(learned.action, "create");
  assert.deepEqual(learned.properties.Origin, { type: "select", value: "Learned" });
  const linked = (property: string) => [...(learned.properties[property]?.value as unknown[] ?? []), ...learned.pending_relations.filter((pending) => pending.property === property).flatMap((pending) => pending.ids)];
  assert.equal(linked("Project").length, 1);
  assert.equal(linked("Area").length, 1);
  const inbox = items.get(BRIEF)!;
  assert.equal("Concepts" in inbox.properties, false, "Inbox · Concepts is retired");
  assert.ok(inbox.pending_relations.some((pending) => pending.property === "Documents" && pending.ids.includes("con-2a3b4c5d")));

  await writeFile(join(dir, "brain.json"), `${JSON.stringify({ ...config, notion: { ...config.notion, databases: { ...config.notion.databases, documents: undefined, inbox: undefined } } }, null, 2)}\n`);
  const again = await brain(["upgrade", "--brain", dir, "--now", NOW, "--json"]);
  assert.deepEqual(again.json.data.converted, []);
});

test("a Document promoted from a concept before 0.9.1 still lints clean once the concept is learned", async (context) => {
  const dir = await fixtureCopy(context);
  await withConcepts(dir);
  await writeFile(join(dir, "knowledge/references/deployment-write-up.md"), `---
id: ref-5d6e7f8g
type: reference
title: Deployment write-up
summary: Blue-green deploys behind a feature flag.
lifecycle: reviewed
origin: promoted
promoted_from: con-2a3b4c5d
created: 2026-12-04
updated: 2026-12-04
---

Blue-green deploys behind a feature flag.
`);
  const run = await brain(["upgrade", "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.equal(run.json.data.lint.errors, 0);
});

test("brain query finds a learned Document and says it is learned", async (context) => {
  const dir = await fixtureCopy(context);
  const created = await noteNew(dir, { notes: [{ type: "reference", title: "Feature flags", frontmatter: { origin: "learned", summary: "Ship dark with axolotl toggles.", sources: [SOURCE] }, body: "Flags let a deploy ship dark.\n" }] });
  assert.equal(created.code, 0, created.stdout);
  const run = await brain(["query", "--candidates", "axolotl toggles", "--brain", dir, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  const [candidate] = run.json.data.candidates;
  assert.equal(candidate.type, "reference");
  assert.equal(candidate.origin, "learned");
  const decisions = await brain(["query", "--candidates", "supabase", "--brain", dir, "--json"]);
  assert.equal("origin" in decisions.json.data.candidates.find((item: { type: string }) => item.type === "decision"), false);
});
