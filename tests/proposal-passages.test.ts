// CC-179: every proposal names its passages, checked at `proposal new` and before apply; legacy proposals and older-layout Review rows
// (0077 §3, eligibility.md §9, schema §11.5, cli §5.6 and §5.7). Synthetic brain and input only.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter, serializeNewFile } from "../src/lib/frontmatter.ts";
import { passageHash } from "../src/lib/selection.ts";
import { excludableDecision, INPUT } from "./exclusion-fixture.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const SYNC = "mtg-8c4n2p7w";
const PROJECT = "prj-9x4t1b7e";
const SECRET = "Pricing was 95,000.";
const LIVE = "A live paragraph.";
/** ¶2 of the input's first version: excluded once `exclude()` runs. ¶1 stays live in every version. */
const EXCLUDED_P = `src-ex1a3b4c#¶2:${passageHash(SECRET)}`;
const LIVE_P = `src-ex1a3b4c#¶1:${passageHash(LIVE)}`;
const LIVE_P2 = `src-ex2a3b4c#¶1:${passageHash(LIVE)}`;
const TARGET = "dec-7k2m9q4x";
const CONCEPT = "con-1s6t8e2b";

async function run(dir: string, args: string[], input: unknown) {
  const file = join(dir, "..", `in-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(file, JSON.stringify(input));
  return brain([...args, "--input", file, "--brain", dir, "--now", NOW, "--json"]);
}
const approve = (...proposals: string[]) => ({ decisions: proposals.map((proposal) => ({ proposal, action: "approve", decided_at: NOW, decided_by: "chat" })) });
const budget = (passages: unknown, source = "src-ex1a3b4c", after = "95,000 EUR") => ({ kind: "update_fact", title: "Budget", target: PROJECT, field: "budget", after, why: "The call set it.", source, ...(passages === undefined ? {} : { passages }) });

async function attributes(dir: string, path: string): Promise<Record<string, any>> {
  return parseFrontmatter(await readFile(join(dir, path), "utf8")).attributes as Record<string, any>;
}
/** Rewrite a proposal as one written before 0.13.0 (or before 0.8.0, without `items`): the passages field is not there. */
async function legacy(dir: string, path: string, withoutItems = false): Promise<void> {
  const document = parseFrontmatter(await readFile(join(dir, path), "utf8"));
  const a = { ...document.attributes } as Record<string, unknown>;
  delete a.passages;
  if (withoutItems) delete a.items;
  else if (Array.isArray(a.items)) a.items = (a.items as Array<Record<string, unknown>>).map(({ passages: _passages, ...item }) => item);
  await writeFile(join(dir, path), serializeNewFile(a, document.body));
}

test("an update_fact whose value comes from an excluded paragraph is closed on approve, whatever version its source is (CC-179 acceptance)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const staged = await run(dir, ["proposal", "new"], { proposals: [budget([EXCLUDED_P])] });
  assert.equal(staged.code, 0, staged.stdout);
  const fact = staged.json.data.created[0] as { id: string; path: string };
  assert.deepEqual((await attributes(dir, fact.path)).passages, [EXCLUDED_P], "the passages are stored as given");
  await exclude();
  // After the exclusion, the same change sourced on the current version is not written; one on its live paragraph is.
  const again = await run(dir, ["proposal", "new"], { proposals: [budget([EXCLUDED_P], "src-ex2a3b4c", "96,000 EUR"), budget([LIVE_P2], "src-ex2a3b4c", "97,000 EUR")] });
  assert.equal(again.code, 0, again.stdout);
  assert.deepEqual(again.json.data.skipped, [{ input_index: 0, reason: "SOURCE_EXCLUDED" }]);
  const live = again.json.data.created[0] as { id: string };

  const out = await run(dir, ["apply"], approve(fact.id, live.id));
  const [closed, applied] = out.json.data.decisions as Array<Record<string, unknown>>;
  assert.deepEqual([closed!.result, closed!.reason, closed!.input, closed!.legacy], ["closed", "SOURCE_EXCLUDED", INPUT, undefined], out.stdout);
  assert.equal(applied!.result, "applied", out.stdout);
  assert.equal((await attributes(dir, fact.path)).closed_reason, "stale");
  const project = await attributes(dir, "projects/acme-website/project.md");
  assert.equal(project.facts.budget, "97,000 EUR");
  assert.ok(!(project.timeline as Array<Record<string, unknown>>).some((entry) => entry.value === "95,000 EUR"), "the excluded value is not in the history");
});

test("the kinds with no text are judged by their passages: a link, a merge and a contradiction (eligibility §9.1)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const why = "The call said so.";
  const source = "src-ex1a3b4c";
  const staged = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "add_link", title: "link", target: CONCEPT, field: "projects", after: PROJECT, why, source, passages: [EXCLUDED_P] },
    { kind: "merge", title: "merge", target: "per-9t2c6m4a", merge_into: "per-3h8w2n6c", why, source, passages: [LIVE_P, EXCLUDED_P] },
    { kind: "contradiction", title: "contradiction", target: PROJECT, field: "launch_date", after: "2027-05", why, source, passages: [EXCLUDED_P] },
    // Another source, so it is not grouped with the first link into one proposal (0037), which would rest on both.
    { kind: "add_link", title: "live link", target: CONCEPT, field: "tags", after: "pricing", why, source: SYNC, passages: [LIVE_P] },
  ] });
  assert.equal(staged.code, 0, staged.stdout);
  const ids = (staged.json.data.created as Array<{ id: string }>).map((entry) => entry.id);
  await exclude();
  const out = await run(dir, ["apply"], approve(...ids));
  assert.deepEqual((out.json.data.decisions as Array<{ result: string; reason?: string }>).map((entry) => [entry.result, entry.reason ?? null]),
    [["closed", "SOURCE_EXCLUDED"], ["closed", "SOURCE_EXCLUDED"], ["closed", "SOURCE_EXCLUDED"], ["applied", null]], out.stdout);
  const concept = await attributes(dir, "knowledge/references/row-level-security.md");
  assert.ok(!(concept.projects ?? []).includes(PROJECT) && (concept.tags as string[]).includes("pricing"));
  assert.equal((await attributes(dir, "knowledge/people/carlos-ruiz.md")).lifecycle, "draft", "the merge was not applied");
});

test("a fix of a merge's survivor still carries the merge's evidence and is judged (eligibility §9.5)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const staged = await run(dir, ["proposal", "new"], { proposals: [{ kind: "merge", title: "merge", target: "per-9t2c6m4a", merge_into: "per-3h8w2n6c", why: "Same person.", source: "src-ex1a3b4c", passages: [EXCLUDED_P] }] });
  await exclude();
  const out = await run(dir, ["apply"], { decisions: [{ proposal: staged.json.data.created[0].id, action: "fix", note: "into Maria", fixes: [{ value: "per-3h8w2n6c" }], decided_at: NOW, decided_by: "chat" }] });
  assert.deepEqual([out.json.data.decisions[0].result, out.json.data.decisions[0].reason], ["closed", "SOURCE_EXCLUDED"], out.stdout);
});

test("proposal new refuses an item with no passages, and checks the ones it names (cli §5.6, eligibility §9.2)", async (context) => {
  const dir = await fixtureCopy(context);
  await excludableDecision(dir, SYNC, PROJECT);
  const refused = async (item: unknown, code: string, pointer: string) => {
    const out = await run(dir, ["proposal", "new"], { proposals: [item] });
    assert.equal(out.json.error?.code, code, out.stdout);
    assert.ok((out.json.error.details as Array<{ pointer: string }>).some((problem) => problem.pointer.startsWith(pointer)), JSON.stringify(out.json.error.details));
  };
  await refused(budget(undefined), "INPUT_INVALID", "/proposals/0/passages");
  await refused(budget([]), "INPUT_INVALID", "/proposals/0/passages");
  await refused(budget([LIVE_P, LIVE_P]), "INPUT_INVALID", "/proposals/0/passages/1");
  await refused(budget([`src-ex1a3b4c#¶3:${passageHash("No such paragraph.")}`]), "INPUT_INVALID", "/proposals/0/passages/0");
  await refused(budget([`src-zz1a3b4c#¶1:${passageHash(LIVE)}`]), "UNKNOWN_ID", "/proposals/0/passages");
  await refused(budget(["just words"]), "INPUT_INVALID", "/proposals/0/passages/0");
  // The references in the text are among the passages.
  await refused({ kind: "add_to_note", title: "t", target: TARGET, content: `A kept remark. ^[${LIVE_P}]`, why: "w", source: "src-ex1a3b4c", passages: ["src-ex1a3b4c"] }, "INPUT_INVALID", "/proposals/0/passages");
  // A review_notes names its notes' passages in note_passages, one list per note; a notion_change takes none.
  const draft = await run(dir, ["note", "new"], { notes: [{ type: "question", title: "Who pays for hosting", frontmatter: { summary: "Open.", kind: "question", projects: [PROJECT], sources: [SYNC] }, body: "Nobody said.\n" }] });
  const id = draft.json.data.created[0].id as string;
  await refused({ kind: "review_notes", source: SYNC, notes: [id] }, "INPUT_INVALID", "/proposals/0/note_passages");
  await refused({ kind: "review_notes", source: SYNC, notes: [id], note_passages: { [id]: [SYNC], "que-2b2b2b2b": [SYNC] } }, "INPUT_INVALID", "/proposals/0/note_passages/que-2b2b2b2b");
  await refused({ kind: "review_notes", source: SYNC, notes: [id], passages: [SYNC], note_passages: { [id]: [SYNC] } }, "INPUT_INVALID", "/proposals/0/passages");
  // An input with no paragraph identities is its own passage, and an entry that names no input is allowed.
  const ok = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: SYNC, notes: [id], note_passages: { [id]: [SYNC] } },
    { ...budget([SYNC], SYNC), after: "81,000 EUR" },
    { kind: "add_link", title: "tag", target: CONCEPT, field: "tags", after: "hosting", why: "w", source: "agent:brain-reflect/20261210T090000Z", passages: ["agent:brain-reflect/20261210T090000Z", CONCEPT] },
  ] });
  assert.equal(ok.code, 0, ok.stdout);
  const row = await attributes(dir, ok.json.data.created.find((entry: { kind: string }) => entry.kind === "review_notes").path);
  const items = row.items as Array<Record<string, unknown>>;
  assert.deepEqual(items.map((item) => [item.kind, item.passages]), [["change", [SYNC]], ["note", [SYNC]]], "the folded change and the note keep their passages on their items");
  assert.equal(row.passages, undefined);
  const lint = await brain(["lint", "--brain", dir, "--json"]);
  const proposalErrors = (lint.json.data.issues as Array<{ severity: string; path: string }>).filter((issue) => issue.severity === "error" && issue.path.startsWith("_proposals/"));
  assert.deepEqual(proposalErrors, [], "the stored passages pass the proposal schema");
});

test("a legacy proposal applies when its input has no suppression record, and is withheld and reported when it has one (eligibility §9.3)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const staged = await run(dir, ["proposal", "new"], { proposals: [
    budget([LIVE_P], "src-ex1a3b4c", "90,000 EUR"),
    { kind: "add_to_note", title: "From the sync", target: CONCEPT, content: "The sync agreed on row-level security.", why: "Said.", source: SYNC, passages: [SYNC] },
  ] });
  assert.equal(staged.code, 0, staged.stdout);
  const [onInput, onSync] = staged.json.data.created as Array<{ id: string; path: string }>;
  await legacy(dir, onInput!.path);
  await legacy(dir, onSync!.path);
  await exclude();
  const out = await run(dir, ["apply"], approve(onInput!.id, onSync!.id));
  const [withheld, applied] = out.json.data.decisions as Array<Record<string, unknown>>;
  // The value is live, but a legacy item on an input with a suppression record has no established support: never applied on trust.
  assert.deepEqual([withheld!.result, withheld!.reason, withheld!.input, withheld!.legacy], ["closed", "SOURCE_EXCLUDED", INPUT, true], out.stdout);
  assert.equal(applied!.result, "applied", "a legacy proposal whose input has no suppression record applies normally");
  assert.equal((await attributes(dir, "projects/acme-website/project.md")).facts.budget, "80000 EUR");
  // With no suppression record in the brain at all, nothing is withheld.
  const clean = await fixtureCopy(context);
  const plain = await run(clean, ["proposal", "new"], { proposals: [{ ...budget([SYNC], SYNC), after: "82,000 EUR" }] });
  await legacy(clean, plain.json.data.created[0].path);
  assert.equal((await run(clean, ["apply"], approve(plain.json.data.created[0].id))).json.data.decisions[0].result, "applied");
});

test("a legacy proposal on the current version is withheld by its input; a stored text citing a passage outside its list is still judged (schema §11.5)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const listed = await run(dir, ["proposal", "new"], { proposals: [{ kind: "add_to_note", title: "Kept", target: CONCEPT, content: `A kept remark. ^[${LIVE_P}]`, why: "Kept.", source: "src-ex1a3b4c", passages: [LIVE_P] }] });
  assert.equal(listed.code, 0, listed.stdout);
  const edited = listed.json.data.created[0] as { id: string; path: string };
  // The file now cites an excluded passage its list does not name (written by hand, or by an older skill): the cited line is judged too.
  const document = parseFrontmatter(await readFile(join(dir, edited.path), "utf8"));
  await writeFile(join(dir, edited.path), serializeNewFile({ ...document.attributes, content: `A kept remark. ^[${LIVE_P}]\n\nThe price was 95,000. ^[${EXCLUDED_P}]` }, document.body));
  await exclude();
  // Written on the current version after the exclusion, then read as legacy: no cited passage, so its input decides.
  const current = await run(dir, ["proposal", "new"], { proposals: [budget([LIVE_P2], "src-ex2a3b4c", "91,000 EUR")] });
  assert.equal(current.code, 0, current.stdout);
  const onCurrent = current.json.data.created[0] as { id: string; path: string };
  await legacy(dir, onCurrent.path);
  const out = await run(dir, ["apply"], approve(edited.id, onCurrent.id));
  const [text, fact] = out.json.data.decisions as Array<Record<string, unknown>>;
  assert.deepEqual([text!.result, text!.reason, text!.legacy], ["closed", "SOURCE_EXCLUDED", undefined], out.stdout);
  assert.deepEqual([fact!.result, fact!.reason, fact!.legacy], ["closed", "SOURCE_EXCLUDED", true], out.stdout);
  assert.equal((await attributes(dir, "projects/acme-website/project.md")).facts.budget, "80000 EUR");
});

test("an older-layout review_notes approved whole drops only its unsupported items and applies the rest (eligibility §4.1, §9.3)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const draft = await run(dir, ["note", "new"], { notes: [{ type: "question", title: "Who pays for hosting", frontmatter: { summary: "Open.", kind: "question", projects: [PROJECT], sources: [SYNC] }, body: "Nobody said.\n" }] });
  const note = draft.json.data.created[0].id as string;
  const staged = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: SYNC, notes: [note], note_passages: { [note]: [SYNC] } },
    { kind: "add_to_note", title: "price", target: CONCEPT, content: `The price was 95,000. ^[${EXCLUDED_P}]`, why: "Said.", source: SYNC, passages: [EXCLUDED_P] },
    { kind: "add_to_note", title: "sync", target: CONCEPT, content: "The sync agreed on row-level security.", why: "Said.", source: SYNC, passages: [SYNC] },
    { kind: "add_link", title: "link", target: CONCEPT, field: "projects", after: PROJECT, why: "Said.", source: SYNC, passages: [SYNC] },
  ] });
  assert.equal(staged.code, 0, staged.stdout);
  const row = staged.json.data.created[0] as { id: string; path: string };
  await legacy(dir, row.path, true);
  await exclude();
  const out = await run(dir, ["apply"], approve(row.id));
  const [result] = out.json.data.decisions as Array<Record<string, any>>;
  assert.equal(result!.result, "applied", out.stdout);
  assert.deepEqual(result!.changes.map((entry: Record<string, unknown>) => [entry.result, entry.reason ?? null]), [["dropped", "SOURCE_EXCLUDED"], ["applied", null]]);
  assert.deepEqual(result!.notes.map((entry: Record<string, unknown>) => entry.result), ["reviewed"]);
  assert.deepEqual(result!.withheld, [{ change: 0 }]);
  const stored = await attributes(dir, row.path);
  assert.deepEqual(stored.dropped, [{ change: 0, reason: "source_excluded" }]);
  const concept = await readFile(join(dir, "knowledge/references/row-level-security.md"), "utf8");
  assert.ok(concept.includes("The sync agreed") && concept.includes(PROJECT) && !concept.includes("was 95,000"));
  const lint = await brain(["lint", "--brain", dir, "--json"]);
  assert.deepEqual((lint.json.data.issues as Array<{ severity: string; path: string }>).filter((issue) => issue.severity === "error" && issue.path.startsWith("_proposals/")), [], "dropped's source_excluded entry passes the schema");
});

// Three drafts on the excluded input, each judged by its own claims (the user's choice of 2026-11-11, reading eligibility.md §9.3 for note items).
async function drafts(dir: string): Promise<string[]> {
  const draft = (title: string, body: string) => ({ type: "question", title, frontmatter: { summary: "Open.", kind: "question", projects: [PROJECT], sources: ["src-ex1a3b4c"] }, body });
  const made = await run(dir, ["note", "new"], { notes: [
    draft("Who pays for hosting", `Nobody said. ^[${LIVE_P}]\n`),
    draft("What the price was", `The price was set. ^[${EXCLUDED_P}]\n`),
    draft("Who runs support", `Support stays in house. ^[${LIVE_P}]\n`),
  ] });
  assert.equal(made.code, 0, made.stdout);
  return (made.json.data.created as Array<{ id: string }>).map((entry) => entry.id);
}

test("an older-layout row on an excluded input: only the draft citing the excluded paragraph is withheld; its folded change and link keep the legacy rule (eligibility §9.3)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const [live, excluded, other] = await drafts(dir);
  const staged = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: "src-ex1a3b4c", notes: [live, excluded, other], note_passages: { [live!]: [LIVE_P], [excluded!]: [EXCLUDED_P], [other!]: [LIVE_P] } },
    budget([LIVE_P]),
    { kind: "add_link", title: "link", target: CONCEPT, field: "projects", after: PROJECT, why: "Said.", source: "src-ex1a3b4c", passages: [LIVE_P] },
  ] });
  assert.equal(staged.code, 0, staged.stdout);
  assert.equal(staged.json.data.created.length, 1, "the change and the link fold into the row");
  const row = staged.json.data.created[0] as { id: string; path: string };
  await legacy(dir, row.path, true);
  await exclude();
  const out = await run(dir, ["apply"], approve(row.id));
  const [result] = out.json.data.decisions as Array<Record<string, any>>;
  assert.deepEqual([result!.result, result!.input, result!.legacy], ["applied", INPUT, true], out.stdout);
  // The drafts whose own claims are live stay reviewable; the folded change and the link have no claims of their own and are withheld.
  assert.deepEqual(result!.withheld, [{ change: 0 }, { note: excluded }, { link: 0 }]);
  const notes = Object.fromEntries(result!.notes.map((entry: Record<string, unknown>) => [entry.id, entry.result]));
  assert.equal(notes[excluded!], "archived");
  assert.notEqual(notes[live!], "archived");
  assert.notEqual(notes[other!], "archived");
  assert.equal(notes[live!], notes[other!]);
  const stored = await attributes(dir, row.path);
  assert.deepEqual(stored.dropped, [{ change: 0, reason: "source_excluded" }, { note: excluded, reason: "source_excluded" }, { link: 0, reason: "source_excluded" }]);
  assert.equal((await attributes(dir, "projects/acme-website/project.md")).facts.budget, "80000 EUR");
});

test("a 0.8.0-layout row with legacy items: a legacy draft is judged by its own claims, a legacy link by the row's input (eligibility §9.3)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const [live, excluded] = await drafts(dir);
  const staged = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: "src-ex1a3b4c", notes: [live, excluded], note_passages: { [live!]: [LIVE_P], [excluded!]: [EXCLUDED_P] } },
    { kind: "add_link", title: "link", target: CONCEPT, field: "projects", after: PROJECT, why: "Said.", source: "src-ex1a3b4c", passages: [LIVE_P] },
  ] });
  const row = staged.json.data.created[0] as { id: string; path: string };
  await legacy(dir, row.path);
  await exclude();
  const out = await run(dir, ["apply"], approve(row.id));
  const [result] = out.json.data.decisions as Array<Record<string, any>>;
  assert.equal(result!.result, "applied", out.stdout);
  const notes = Object.fromEntries(result!.notes.map((entry: Record<string, unknown>) => [entry.id, entry.result]));
  assert.equal(notes[excluded!], "archived");
  assert.notEqual(notes[live!], "archived");
  const decided = ((await attributes(dir, row.path)).item_decisions as Array<Record<string, unknown>>).filter((entry) => entry.reason === "source_excluded");
  assert.equal(decided.length, 2, "the excluded draft and the legacy link");
});

test("a 0.8.0-layout row: an item with live passages applies, a legacy item on the excluded input is withheld (schema §11.5)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const staged = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: "src-ex1a3b4c", notes: [] },
    { kind: "add_link", title: "live", target: CONCEPT, field: "tags", after: "pricing", why: "Said.", source: "src-ex1a3b4c", passages: [LIVE_P] },
    { kind: "add_link", title: "excluded", target: CONCEPT, field: "projects", after: PROJECT, why: "Said.", source: "src-ex1a3b4c", passages: [EXCLUDED_P] },
  ] });
  assert.equal(staged.code, 0, staged.stdout);
  const row = staged.json.data.created[0] as { id: string; path: string };
  const legacyRow = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "add_link", title: "legacy", target: CONCEPT, field: "tags", after: "hosting", why: "Said.", source: "src-ex1a3b4c", passages: [LIVE_P] },
    { kind: "review_notes", source: "src-ex1a3b4c", notes: [] },
  ] });
  const old = legacyRow.json.data.created[0] as { id: string; path: string };
  await legacy(dir, old.path);
  await exclude();
  const out = await run(dir, ["apply"], approve(row.id, old.id));
  const [first, second] = out.json.data.decisions as Array<Record<string, any>>;
  assert.equal(first!.result, "applied", out.stdout);
  assert.equal(first!.withheld.length, 1);
  assert.deepEqual([second!.result, second!.reason], ["closed", "SOURCE_EXCLUDED"]);
  const concept = await attributes(dir, "knowledge/references/row-level-security.md");
  assert.ok((concept.tags as string[]).includes("pricing") && !(concept.tags as string[]).includes("hosting") && !(concept.projects ?? []).includes(PROJECT));
});

test("proposal list marks a held item without its wording; a proposal that is not held is listed whole (eligibility §4.3, §9.4)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const staged = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "add_to_note", title: "Price: 95,000", target: TARGET, content: `The price was 95,000. ^[${EXCLUDED_P}]`, why: "The price was 95,000.", source: "src-ex1a3b4c", passages: [EXCLUDED_P] },
    { kind: "add_to_note", title: "Kept remark", target: TARGET, content: `A kept remark. ^[${LIVE_P}]`, why: "Kept.", source: "src-ex1a3b4c", passages: [LIVE_P] },
    { kind: "review_notes", source: SYNC, notes: [] },
    { kind: "update_fact", title: "Budget 95,000", target: PROJECT, field: "budget", after: "95,000", why: "95,000.", source: SYNC, passages: [EXCLUDED_P] },
    { kind: "add_to_note", title: "sync", target: CONCEPT, content: "The sync agreed on row-level security.", why: "Said.", source: SYNC, passages: [SYNC] },
  ] });
  assert.equal(staged.code, 0, staged.stdout);
  await exclude();
  const list = await brain(["proposal", "list", "--status", "pending", "--brain", dir, "--json"]);
  assert.equal(list.code, 0, list.stdout);
  const proposals = list.json.data.proposals as Array<Record<string, any>>;
  const held = proposals.find((entry) => entry.kind === "add_to_note" && entry.held === true)!;
  assert.deepEqual([held.title, held.why, held.content, held.passages], [undefined, undefined, undefined, [EXCLUDED_P]]);
  assert.ok(proposals.some((entry) => entry.title === "Kept remark" && entry.held === undefined));
  const row = proposals.find((entry) => entry.kind === "review_notes")!;
  assert.deepEqual(row.held, [{ change: 0 }]);
  assert.deepEqual(row.changes[0], { kind: "update_fact", target: PROJECT, field: "budget" });
  assert.equal(row.changes[1].content, "The sync agreed on row-level security.");
  assert.ok(typeof row.title === "string", "one item is not held, so the row keeps its title");
  // The held wording itself is looked for, and the slug its title would give.
  for (const wording of ["The price was 95,000", "Price: 95,000", "Budget 95,000", "95,000.", "price-95-000"]) assert.ok(!list.stdout.includes(wording), `no held wording in the listing: ${wording}`);
  const human = await brain(["proposal", "list", "--status", "pending", "--brain", dir]);
  assert.match(human.stdout, /held: rests on content you excluded from the brain/);
  assert.ok(!human.stdout.includes("Price: 95,000") && !human.stdout.includes("Budget 95,000"));
});

test("sync render publishes a held standalone proposal with no title, wording or why (eligibility §9.4, cli §5.14.4)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const staged = await run(dir, ["proposal", "new"], { proposals: [{ ...budget([EXCLUDED_P], SYNC, "95,000"), title: "Budget: 95,000", why: "Pricing was 95,000." }] });
  const id = staged.json.data.created[0].id as string;
  await exclude();
  const render = await brain(["sync", "render", "--ids", id, "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(render.code, 0, render.stdout);
  const item = (render.json.data.items as Array<Record<string, any>>).find((entry) => entry.id === id)!;
  const values = Object.fromEntries(Object.entries(item.properties as Record<string, any>).map(([name, value]) => [name, JSON.stringify(value)]));
  assert.match(values.Name!, new RegExp(`Held: ${id}`));
  for (const wording of ["Budget: 95,000", "Pricing was 95,000", "\"95,000\""]) assert.ok(!JSON.stringify(item).includes(wording), JSON.stringify(item.properties));
});
