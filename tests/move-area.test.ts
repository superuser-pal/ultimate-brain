import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { parseFrontmatter, serializeFrontmatter } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy, withPassages } from "./helpers.ts";

// CC-251, decision 0092: set_field moves a decision, question, Document or source to another Area (spec/cli.md §5.6, §5.7; schema §4 source, §11.2).
const NOW = "2026-12-10T09:00:00Z";
const DECIDED = "2026-12-10T09:05:00Z";
const AGENT = "agent:ultimate-assistant/20261210T090000Z";
const PROJECT = "prj-9x4t1b7e";
const PRODUCT = "area-2m7c4h8n"; // the fixture's Clients Area, where the ingest files everything
const GTM = "area-6p3r8t2w";
const GTM_PAGE = "5d4c3b2a-1908-4f7e-8d6c-5b4a39281706";
const BODY = "## Pricing\n\n- Three tiers\n- Annual discount of 15%\n";

let counter = 0;
async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `move-input-${counter += 1}.json`);
    await writeFile(file, JSON.stringify(args[0] === "proposal" && args[1] === "new" ? withPassages(input) : input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

async function attributes(dir: string, path: string): Promise<Record<string, any>> {
  return parseFrontmatter(await readFile(join(dir, path), "utf8")).attributes;
}

async function lintClean(dir: string): Promise<void> {
  const lint = await brain(["lint", "--brain", dir, "--json"]);
  assert.equal(lint.json.data.errors, 0, JSON.stringify(lint.json.data.issues));
}

const approve = (...proposals: string[]) => ({ decisions: proposals.map((proposal) => ({ proposal, action: "approve", decided_at: DECIDED, decided_by: "chat" })) });
const move = (target: string, after = GTM, extra: Record<string, unknown> = {}) => ({ kind: "set_field", target, field: "area", after, why: "the user made Go-to-market for these", source: AGENT, ...extra });

interface Ingested { dir: string; source: { id: string; path: string }; whole: { id: string; path: string }; learned: { id: string; path: string }; part: { id: string; path: string }; decision: { id: string; path: string }; question: { id: string; path: string }; review: { id: string; path: string } }

/** A synthetic brain after an ingest of one pricing document into Clients, plus a new Area, Go-to-market. */
async function ingested(context: TestContext): Promise<Ingested> {
  const dir = await fixtureCopy(context);
  await writeFile(join(dir, "areas/go-to-market.md"), `---\nid: ${GTM}\ntype: area\ntitle: Go-to-market\nsummary: Go-to-market.\nlifecycle: reviewed\nsources: [notion:${GTM_PAGE}]\ncreated: 2026-12-10\nupdated: 2026-12-10\nnotion: ${GTM_PAGE}\n---\n`);
  const key = `file:sha256:${createHash("sha256").update("pricing").digest("hex")}`;
  const created = await run(dir, ["note", "new"], { notes: [{ type: "source", title: "Pricing memo", file_date: "2026-12-01", frontmatter: { source_key: key, file_name: "pricing-memo.pdf", converter: "markitdown 0.1.8", kind: "document", area: PRODUCT, summary: "Pricing in one line.", digest: "- Three tiers." }, body: BODY }] });
  assert.equal(created.code, 0, created.stdout);
  const source = created.json.data.created[0];
  const notes = await run(dir, ["note", "new"], { notes: [
    { type: "reference", title: "Pricing memo (whole)", frontmatter: { summary: "The memo, whole.", origin: "whole", area: PRODUCT, sources: [source.id] }, body: BODY },
    { type: "reference", title: "Tiered pricing", frontmatter: { summary: "What tiered pricing is.", origin: "learned", area: PRODUCT, sources: [source.id] }, body: "Tiers group features by price.\n" },
    { type: "reference", title: "Pricing tiers table", frontmatter: { summary: "The tiers.", origin: "part", area: PRODUCT, sources: [source.id] }, body: "- Three tiers\n" },
    { type: "decision", title: "Offer three pricing tiers", frontmatter: { summary: "Three tiers.", date: "2026-12-01", assessment: "accepted", area: PRODUCT, sources: [source.id] }, body: "## Decision\nThree tiers.\n" },
    { type: "question", title: "Should the annual discount be 15%?", frontmatter: { summary: "The discount.", kind: "question", area: PRODUCT, sources: [source.id] }, body: "Open.\n" },
  ] });
  assert.equal(notes.code, 0, notes.stdout);
  const [whole, learned, part, decision, question] = notes.json.data.created;
  const review = await run(dir, ["proposal", "new"], { proposals: [{ kind: "review_notes", source: source.id, notes: [learned.id, part.id, decision.id, question.id] }] });
  assert.equal(review.code, 0, review.stdout);
  return { dir, source, whole, learned, part, decision, question, review: review.json.data.created[0] };
}

test("set_field area on a draft decision, a draft question and a learned Document applies; views and the next publish show it (0092 §1)", async (context) => {
  const brainDir = await ingested(context);
  const { dir } = brainDir;
  const created = await run(dir, ["proposal", "new"], { proposals: [move(brainDir.decision.id), move(brainDir.question.id), move(brainDir.learned.id)] });
  assert.equal(created.code, 0, created.stdout);
  const ids = created.json.data.created.map((entry: { id: string }) => entry.id);
  assert.deepEqual(created.json.data.created.map((entry: { title: string }) => entry.title), ["Offer three pricing tiers: Area → Go-to-market", "Should the annual discount be 15%?: Area → Go-to-market", "Tiered pricing: Area → Go-to-market"]);
  assert.ok(created.json.data.created.every((entry: { before: string }) => entry.before === PRODUCT));
  for (const entry of created.json.data.created) assert.equal((await attributes(dir, entry.path)).area, PRODUCT, "the Review row's Area is the note's own Area");

  // Many moves, one yes in chat (0092 §5): one apply with every decision.
  const applied = await run(dir, ["apply"], approve(...ids));
  assert.equal(applied.code, 0, applied.stdout);
  assert.deepEqual(applied.json.data.decisions.map((entry: { result: string }) => entry.result), ["applied", "applied", "applied"]);
  for (const note of [brainDir.decision, brainDir.question, brainDir.learned]) {
    const a = await attributes(dir, note.path);
    assert.equal(a.area, GTM);
    assert.equal(a.lifecycle, "draft", "a move leaves a draft a draft");
    assert.equal(a.updated, "2026-12-10");
  }
  assert.equal((await attributes(dir, brainDir.part.path)).area, PRODUCT, "a part Document moves only when named");
  assert.equal((await attributes(dir, brainDir.source.path)).area, PRODUCT, "a learned Document doesn't move its source");

  // Views: the Go-to-market brief lists them, the Clients brief no longer does.
  assert.equal((await run(dir, ["views"])).code, 0);
  const gtm = await readFile(join(dir, "areas/briefs/go-to-market.md"), "utf8");
  // Drafts show as waiting in Review (schema §16.1): one each under decisions, questions and Documents.
  assert.equal(gtm.match(/1 note waiting in Review/g)?.length, 3, gtm);
  // Once reviewed, the decision is listed by title in Go-to-market and not in Clients.
  await writeFile(join(dir, brainDir.decision.path), (await readFile(join(dir, brainDir.decision.path), "utf8")).replace(/^lifecycle: draft$/m, "lifecycle: reviewed"));
  assert.equal((await run(dir, ["views"])).code, 0);
  assert.ok((await readFile(join(dir, "areas/briefs/go-to-market.md"), "utf8")).includes("Offer three pricing tiers"));
  assert.equal((await readFile(join(dir, "areas/briefs/clients.md"), "utf8")).includes("Offer three pricing tiers"), false);

  // The next publish: the learned Document, once reviewed, goes out with Area Go-to-market.
  await writeFile(join(dir, brainDir.learned.path), (await readFile(join(dir, brainDir.learned.path), "utf8")).replace(/^lifecycle: draft$/m, "lifecycle: reviewed"));
  await setDocuments(dir);
  const rendered = await run(dir, ["sync", "render", "--ids", brainDir.learned.id]);
  assert.equal(rendered.code, 0, rendered.stdout);
  assert.deepEqual(rendered.json.data.items[0].properties.Area, { type: "relation", value: [GTM_PAGE] });
  await lintClean(dir);
});

async function setDocuments(dir: string): Promise<void> {
  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  config.modules = { ...config.modules, documents: true };
  config.notion.databases.documents = config.notion.databases.documents || "a1000000-0000-4000-8000-00000000000d";
  await writeFile(join(dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
}

test("a source and its whole Document move together, whichever is named; the source's snapshot is unchanged and lint passes (0092 §3, §4)", async (context) => {
  const brainDir = await ingested(context);
  const { dir } = brainDir;
  const before = await readFile(join(dir, brainDir.source.path), "utf8");

  const bySource = await run(dir, ["proposal", "new"], { proposals: [move(brainDir.source.id)] });
  assert.equal(bySource.code, 0, bySource.stdout);
  const proposal = bySource.json.data.created[0];
  assert.equal(proposal.title, "Pricing memo: Area → Go-to-market");
  const applied = await run(dir, ["apply"], approve(proposal.id));
  assert.equal(applied.json.data.decisions[0].result, "applied");
  assert.deepEqual([...applied.json.data.decisions[0].changed].sort(), [proposal.path, brainDir.source.path, brainDir.whole.path].sort(), "write set: the proposal, the source and its whole Document");
  assert.equal((await attributes(dir, brainDir.whole.path)).area, GTM);
  for (const note of [brainDir.learned, brainDir.part, brainDir.decision, brainDir.question]) assert.equal((await attributes(dir, note.path)).area, PRODUCT, "only the group moves");

  // Only `area` and `updated` changed on the source: body, content_hash and every other field are as they were.
  const after = parseFrontmatter(await readFile(join(dir, brainDir.source.path), "utf8"));
  const old = parseFrontmatter(before);
  assert.equal(after.body, old.body);
  assert.deepEqual({ ...after.attributes, area: undefined, updated: undefined }, { ...old.attributes, area: undefined, updated: undefined });
  assert.equal(after.attributes.area, GTM);
  await lintClean(dir);

  // The Review row of the source's review_notes follows the source's Area.
  const row = await run(dir, ["sync", "render", "--ids", brainDir.review.id]);
  assert.equal(row.code, 0, row.stdout);
  assert.deepEqual(row.json.data.items[0].properties.Area, { type: "relation", value: [GTM_PAGE] });
  // The whole Document (reviewed at creation) goes out with Area Go-to-market at the next publish.
  await setDocuments(dir);
  const document = await run(dir, ["sync", "render", "--ids", brainDir.whole.id]);
  assert.equal(document.code, 0, document.stdout);
  assert.deepEqual(document.json.data.items[0].properties.Area, { type: "relation", value: [GTM_PAGE] });

  // The reverse: naming the whole Document moves the source back with it.
  const byWhole = await run(dir, ["proposal", "new"], { proposals: [move(brainDir.whole.id, PRODUCT)] });
  assert.equal(byWhole.code, 0, byWhole.stdout);
  const back = await run(dir, ["apply"], approve(byWhole.json.data.created[0].id));
  assert.equal(back.json.data.decisions[0].result, "applied");
  assert.equal((await attributes(dir, brainDir.whole.path)).area, PRODUCT);
  assert.equal((await attributes(dir, brainDir.source.path)).area, PRODUCT);
  await lintClean(dir);
});

test("a decision or question with projects is refused, naming the project; a later project closes the proposal stale (0092 §2)", async (context) => {
  const brainDir = await ingested(context);
  const { dir } = brainDir;
  const refused = await run(dir, ["proposal", "new"], { proposals: [move("dec-7k2m9q4x")] });
  assert.equal(refused.json.error?.code, "INPUT_INVALID", refused.stdout);
  assert.equal(refused.json.error.details[0].pointer, "/proposals/0/target");
  assert.match(refused.json.error.message, /Acme website \(prj-9x4t1b7e\)/);

  // Written while the question had no project; it gains one before the apply.
  const written = await run(dir, ["proposal", "new"], { proposals: [move(brainDir.question.id)] });
  const path = join(dir, brainDir.question.path);
  const document = parseFrontmatter(await readFile(path, "utf8"));
  document.attributes.projects = [PROJECT];
  await writeFile(path, serializeFrontmatter(document));
  const stale = await run(dir, ["apply"], approve(written.json.data.created[0].id));
  assert.equal(stale.json.data.decisions[0].result, "closed");
  assert.equal(stale.json.data.decisions[0].reason, "STALE_PROPOSAL");
  assert.equal((await attributes(dir, brainDir.question.path)).area, PRODUCT);
});

test("BEFORE_MISMATCH, NO_CHANGE, DUPLICATE_PENDING, STALE_PROPOSAL and fix hold for the new targets; other types are refused", async (context) => {
  const brainDir = await ingested(context);
  const { dir } = brainDir;
  const mismatch = await run(dir, ["proposal", "new"], { proposals: [move(brainDir.decision.id, GTM, { before: GTM })] });
  assert.equal(mismatch.json.error?.code, "BEFORE_MISMATCH", mismatch.stdout);
  const same = await run(dir, ["proposal", "new"], { proposals: [move(brainDir.part.id, PRODUCT)] });
  assert.deepEqual(same.json.data.skipped, [{ input_index: 0, reason: "NO_CHANGE" }]);

  const first = await run(dir, ["proposal", "new"], { proposals: [move(brainDir.source.id)] });
  const id = first.json.data.created[0].id;
  const duplicate = await run(dir, ["proposal", "new"], { proposals: [move(brainDir.source.id)] });
  assert.deepEqual(duplicate.json.data.skipped, [{ input_index: 0, reason: "DUPLICATE_PENDING", existing: id }]);

  // A group already in the Area is NO_CHANGE; one with a member elsewhere is not.
  await run(dir, ["apply"], approve(id));
  const moved = await run(dir, ["proposal", "new"], { proposals: [move(brainDir.whole.id)] });
  assert.deepEqual(moved.json.data.skipped, [{ input_index: 0, reason: "NO_CHANGE" }]);

  // Stale: the decision moved after the proposal was written.
  const decision = await run(dir, ["proposal", "new"], { proposals: [move(brainDir.decision.id)] });
  const path = join(dir, brainDir.decision.path);
  const document = parseFrontmatter(await readFile(path, "utf8"));
  document.attributes.area = GTM;
  await writeFile(path, serializeFrontmatter(document));
  const stale = await run(dir, ["apply"], approve(decision.json.data.created[0].id));
  assert.equal(stale.json.data.decisions[0].reason, "STALE_PROPOSAL");
  document.attributes.area = PRODUCT;
  await writeFile(path, serializeFrontmatter(document));

  // Fix: another Area, never another kind of note.
  const fixable = await run(dir, ["proposal", "new"], { proposals: [move(brainDir.learned.id)] });
  const fixId = fixable.json.data.created[0].id;
  const wrong = await run(dir, ["apply"], { decisions: [{ proposal: fixId, action: "fix", note: "the project", fixes: [{ value: PROJECT }], decided_at: DECIDED, decided_by: "chat" }] });
  assert.equal(wrong.json.data.decisions[0].reason, "INVALID_RESULT");

  for (const target of ["per-3h8w2n6c", "mtg-8c4n2p7w"]) {
    const result = await run(dir, ["proposal", "new"], { proposals: [move(target)] });
    assert.equal(result.json.error?.code, "INPUT_INVALID", result.stdout);
  }
  await lintClean(dir);
});
