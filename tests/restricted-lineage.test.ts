import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";

import { serializeNewFile } from "../src/lib/frontmatter.ts";
import { scanNotes } from "../src/lib/notes.ts";
import { contextFor, eligibleNote, requireSuppressions } from "../src/lib/suppressions.ts";
import { passageHash } from "../src/lib/selection.ts";
import { brain } from "./helpers.ts";

// Restricted evidence (capture-and-review §5.1, CC-174): provenance that names no input is live, and a note with nothing eligible left is left
// out whole. One active suppression sits in another project; every note here is synthetic.

const NOW = "2026-11-08T10:00:00Z";
const AREA = "area-2m7c4h8n";
const PROJECT = "prj-9x4t1b7e";
const OTHER_PROJECT = "prj-4w7c2n9x";
const INPUT = "11111111-2222-4333-8444-555555555555";
const LIVE = "A live paragraph.";
const SECRET = "The second-year discount is 18 percent.";
const SECRET_REF = `^[src-ex1a3b4c#¶2:${passageHash(SECRET)}]`;
const LIVE_REF = `^[src-ex2a3b4c#¶1:${passageHash(LIVE)}]`;
const SESSION = "agent:brain-query/20261108T090000Z";

// Every note's title, summary and body hold "zephyr", so one search reaches all of them.
const IDS = {
  agentMemory: "mem-aaaa0001", decisionMemory: "mem-aaaa0002", secretMemory: "mem-aaaa0003",
  liveDecision: "dec-aaaa0001", noKeyDecision: "dec-aaaa0002", secretDecision: "dec-aaaa0003", partlyDecision: "dec-aaaa0004", headingDecision: "dec-aaaa0005",
};

interface World { dir: string; repo: string }

async function put(dir: string, path: string, attributes: Record<string, unknown>, body = ""): Promise<void> {
  await mkdir(dirname(join(dir, path)), { recursive: true });
  await writeFile(join(dir, path), serializeNewFile(attributes, body));
}

function extract(id: string, version: number, replaces: string | null, paragraphs: Array<[number, string]>): string {
  const body = paragraphs.map(([n, text]) => `<!-- passage ¶${n} item s1 -->\n${text}\n`).join("\n");
  return `---\nid: ${id}\ntype: source\ntitle: Pricing call extract v${version}\nsource_key: notion:${INPUT}\nkind: minutes\nextract: true\nextract_of: ${INPUT}\nextract_version: ${version}\n${replaces === null ? "" : `replaces: ${replaces}\n`}transcript_hash: ${"a".repeat(64)}\nselection:\n  - id: s1\n    effective: use\npassages:\n${paragraphs.map(([n, text]) => `  - n: ${n}\n    hash: ${passageHash(text)}`).join("\n")}\ncaptured: 2026-10-10\ncontent_hash: ${"b".repeat(64)}\n---\n${body}`;
}

const decision = (id: string, title: string, sources: string[], project = PROJECT) =>
  ({ id, type: "decision", title, summary: `${title}: zephyr.`, lifecycle: "reviewed", date: "2026-10-12", assessment: "accepted", projects: [project], sources, created: "2026-10-12", updated: "2026-10-12" });
const memory = (id: string, title: string, sources: string[]) =>
  ({ id, type: "memory", title, summary: `${title}: zephyr.`, lifecycle: "reviewed", scope: "project", projects: [PROJECT], confidence: "verified", origin: "acme-api", sources, created: "2026-10-12", updated: "2026-10-12" });

/** A brain with one active suppression of a pricing call in OTHER_PROJECT, and notes whose provenance names no input beside it. */
async function world(context: TestContext): Promise<World> {
  const parent = await mkdtemp(join(tmpdir(), "brain-lineage-"));
  context.after(() => rm(parent, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const dir = join(parent, "brain");
  const made = await brain(["init", dir, "--owner", "Test Owner", "--no-git", "--now", NOW, "--json"]);
  assert.equal(made.code, 0, made.stdout);
  await put(dir, "areas/consulting.md", { id: AREA, type: "area", title: "Consulting", summary: "Client work.", lifecycle: "reviewed", created: "2026-09-01", updated: "2026-09-01" });
  // The project's facts come from your edit in Notion and from a corrected Review item: neither names an input.
  await put(dir, "projects/acme-api/project.md", {
    id: PROJECT, type: "project", title: "Acme API zephyr", summary: "The zephyr API.", lifecycle: "reviewed", area: AREA, created: "2026-09-01", updated: "2026-10-12",
    facts: { budget: "45000 EUR", launch: "2026-12-01" },
    timeline: [
      { field: "budget", value: "40000 EUR", from: "2026-09-10", until: "2026-10-02", learned: "2026-09-10", source: "src-wr1a3b4c", assessment: "superseded" },
      { field: "budget", value: "45000 EUR", from: "2026-10-02", learned: "2026-10-02", source: "notion-edit", assessment: "accepted" },
      { field: "launch", value: "2026-12-01", from: "2026-10-05", learned: "2026-10-05", source: "user-correction:prp-aaaa0001", assessment: "accepted" },
    ],
  }, "The zephyr API serves the partner portal.\n");
  await put(dir, "projects/other/project.md", { id: OTHER_PROJECT, type: "project", title: "Other", summary: "Another client.", lifecycle: "reviewed", area: AREA, created: "2026-09-01", updated: "2026-09-01" });

  // The suppressed input: version 2 of the pricing call drops paragraph 2.
  await mkdir(join(dir, "sources/notion"), { recursive: true });
  await writeFile(join(dir, "sources/notion/2026-10-10-extract-v1.md"), extract("src-ex1a3b4c", 1, null, [[1, LIVE], [2, SECRET]]));
  await writeFile(join(dir, "sources/notion/2026-10-10-extract-v2.md"), extract("src-ex2a3b4c", 2, "src-ex1a3b4c", [[1, LIVE]]));
  await mkdir(join(dir, "_suppressions"), { recursive: true });
  await writeFile(join(dir, "_suppressions", `${INPUT}.json`), JSON.stringify({ input: INPUT, records: [{ version: 2, passages: [{ extract_of: INPUT, transcript_hash: "a".repeat(64), n: 2 }], full_copies: [], status: "active" }] }));
  // An unrelated web page, and a source whose input cannot be determined (no source_key: a data defect).
  await put(dir, "sources/text/2026-09-10-deploy-guide.md", { id: "src-wr1a3b4c", type: "source", title: "Deploy guide", source_key: "url:https://example.com/deploy-guide", kind: "document", captured: "2026-09-10", content_hash: `sha256:${"c".repeat(64)}` }, "Deploys go through the zephyr pipeline.\n");
  await put(dir, "sources/text/2026-09-11-pasted-note.md", { id: "src-nk1a3b4c", type: "source", title: "Pasted note", kind: "note", captured: "2026-09-11", content_hash: `sha256:${"d".repeat(64)}` }, "Rotate the zephyr vault keys monthly.\n");

  await put(dir, "knowledge/decisions/2026-10-12-deploy-pipeline.md", decision(IDS.liveDecision, "Deploy through the zephyr pipeline", ["src-wr1a3b4c"]), "Deploys go through the zephyr pipeline.\n");
  await put(dir, "knowledge/decisions/2026-10-12-vault-keys.md", decision(IDS.noKeyDecision, "Rotate the zephyr vault keys", ["src-nk1a3b4c"]), "Rotate the zephyr vault keys monthly.\n");
  await put(dir, "knowledge/decisions/2026-10-12-second-year-price.md", decision(IDS.secretDecision, "Second-year zephyr price", ["src-ex1a3b4c"], OTHER_PROJECT), `The zephyr price carries the discount. ${SECRET_REF}\n`);
  await put(dir, "knowledge/decisions/2026-10-12-first-year-price.md", decision(IDS.partlyDecision, "First-year zephyr price", ["src-ex2a3b4c"], OTHER_PROJECT), `The zephyr price holds for year one. ${LIVE_REF}\n\nThe zephyr discount follows. ${SECRET_REF}\n`);
  // Marked independent of the input (Keep), so its heading is not unmapped text; its one claim still cites the suppressed passage.
  await put(dir, "knowledge/decisions/2026-10-12-discount-terms.md", { ...decision(IDS.headingDecision, "Zephyr discount terms", ["src-ex2a3b4c"], OTHER_PROJECT), lineage_cleared: [INPUT] }, `## Terms\n\nThe zephyr discount terms. ${SECRET_REF}\n`);

  await put(dir, "memories/2026/10/2026-10-12-staging-keys.md", memory(IDS.agentMemory, "Ask before rotating the zephyr staging keys", [SESSION]), "Ask before rotating the zephyr staging keys.\n");
  await put(dir, "memories/2026/10/2026-10-12-deploy-by-pipeline.md", memory(IDS.decisionMemory, "Deploy zephyr through the pipeline", [IDS.liveDecision]), "Deploy zephyr through the pipeline, never by hand.\n");
  // Its source is the live version, so memory.md §2 rule 4 keeps it: only §5.1's "nothing eligible left" leaves it out.
  await put(dir, "memories/2026/10/2026-10-12-quote-discount.md", memory(IDS.secretMemory, "Quote the zephyr discount", ["src-ex2a3b4c"]), `Quote the zephyr discount. ${SECRET_REF}\n`);

  const repo = join(parent, "acme-api");
  await mkdir(repo, { recursive: true });
  await writeFile(join(repo, ".brain"), `${JSON.stringify({ repo: "acme-api", project: PROJECT, area: AREA, stacks: [] }, null, 2)}\n`);
  return { dir, repo };
}

async function run(dir: string, ...args: string[]) {
  const result = await brain([...args, "--brain", dir, "--now", NOW, "--json"]);
  // Lint exits 1 on this brain's hand-written fixtures (their hashes and timestamps are not real); its report is what is read.
  if (args[0] !== "lint") assert.equal(result.code, 0, result.stdout);
  return result.json.data;
}

type Candidate = { id: string; [key: string]: unknown };
const candidates = async (dir: string, repo: string): Promise<Map<string, Candidate>> =>
  new Map(((await run(dir, "query", "--candidates", "zephyr", "--types", "project,decision,memory", "--limit", "50", "--repo", repo)).candidates as Candidate[]).map((entry) => [entry.id, entry]));
const recalled = async (dir: string, repo: string): Promise<string[]> =>
  ((await run(dir, "recall", "--search", "zephyr", "--limit", "50", "--repo", repo)).results as Array<{ id: string }>).map((entry) => entry.id).sort();

test("provenance that names no input is live while a suppression is active elsewhere: an agent session, a decision id, notion-edit and user-correction", async (context) => {
  const { dir, repo } = await world(context);
  const found = await candidates(dir, repo);
  for (const id of [IDS.agentMemory, IDS.decisionMemory, IDS.liveDecision, PROJECT]) assert.ok(found.has(id), `${id} is returned by query --candidates`);
  // The candidates carry no facts: the project's eligible form, which query and the views read, keeps both.
  const scanned = await scanNotes(dir);
  const project = eligibleNote(scanned.notes.find((note) => note.id === PROJECT)!, contextFor(scanned.notes, requireSuppressions(dir)));
  assert.deepEqual(project?.attributes.facts, { budget: "45000 EUR", launch: "2026-12-01" }, "the facts from your Notion edit and a corrected Review item stay");
  assert.equal((project?.attributes.timeline as unknown[]).length, 3, "and so do their timeline entries");
  const memories = await recalled(dir, repo);
  assert.ok(memories.includes(IDS.agentMemory), "a memory citing an agent session is recalled");
  assert.ok(memories.includes(IDS.decisionMemory), "a memory citing a decision id is recalled");
});

test("a source whose input cannot be determined still fails closed, and lint and retrieval agree on what is unknown lineage", async (context) => {
  const { dir, repo } = await world(context);
  const found = await candidates(dir, repo);
  assert.ok(!found.has(IDS.noKeyDecision), "a note resting on a source with no source_key is restricted whole");
  const lint = (await run(dir, "lint")).issues as Array<{ rule: string; id: string }>;
  const flagged = lint.filter((issue) => issue.rule === "unknown-lineage").map((issue) => issue.id);
  // The notes whose provenance alone decides: retrieval leaves out exactly those lint flags.
  const lineageOnly = [IDS.agentMemory, IDS.decisionMemory, IDS.liveDecision, IDS.noKeyDecision, PROJECT];
  assert.deepEqual(flagged, [IDS.noKeyDecision], "lint flags only the note whose source has no input");
  assert.deepEqual(lineageOnly.filter((id) => !found.has(id)), flagged, "retrieval leaves out the same notes");
});

test("a note with nothing eligible left is not returned at all; a note with an eligible line left is still returned without the restricted one", async (context) => {
  const { dir, repo } = await world(context);
  const found = await candidates(dir, repo);
  assert.ok(!found.has(IDS.secretDecision), "a decision whose only body line cites the suppressed passage is left out whole");
  assert.ok(!found.has(IDS.headingDecision), "a heading is not eligible content");
  const partly = found.get(IDS.partlyDecision);
  assert.ok(partly !== undefined, "a decision with a live line left is returned");
  assert.ok(!JSON.stringify(partly).includes("discount follows"), "its restricted line is not");
  assert.ok(!(await recalled(dir, repo)).includes(IDS.secretMemory), "a memory whose only line cites the suppressed passage is not recalled");
});

test("a note with nothing eligible left stays listed in the index in its partly restricted form, without its summary", async (context) => {
  const { dir } = await world(context);
  const built = await run(dir, "index");
  const listed = (built.notes as Array<{ id: string; summary: string | null }>).find((entry) => entry.id === IDS.secretDecision);
  assert.ok(listed !== undefined, "the index keeps it listed");
  assert.equal(listed.summary, null, "its summary is not listed");
  assert.ok(!JSON.stringify(built).includes(SECRET), "the excluded text is never listed");
});
