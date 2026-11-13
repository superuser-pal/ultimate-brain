// CC-240: the Review page of format 2 (decisions 0088 §2 and 0090; capture-and-review §7.12, cli §5.6 and §5.14). Synthetic brain and input only.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { holdsValue, parseReviewPage2, valueForms } from "../src/lib/review-format2.ts";
import { UNCONVERTIBLE } from "../src/lib/review-body.ts";
import { passageHash } from "../src/lib/selection.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const AFTER = "2026-12-10T09:10:00Z";
const SYNC = "mtg-8c4n2p7w";
const PROJECT = "prj-9x4t1b7e";
const CONCEPT = "con-1s6t8e2b";
const DECISION = "dec-7k2m9q4x";
const PAGE = "6a7b0000-0000-4000-8000-0000000000bb";
const NEW_PAGE = "6a7b0000-0000-4000-8000-0000000000cc";
const SRC = "src-pf1a2b3c";
const PASSAGES = [
  "Launch moves to April 2027, Maria said.",
  "Carlos would rather launch in May 2027.",
  "Supabase handles auth for the site.",
  "Ana listed eleven candidate depots from the survey.",
  "Lee said the pilot itself starts with nine depots.",
];
const P = PASSAGES.map((text, index) => `${SRC}#¶${index + 1}:${passageHash(text)}`);

const git = (dir: string, ...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
/** A review apply is journaled and committed: it needs a Git brain with a clean tree. */
function settle(dir: string) {
  if (!existsSync(join(dir, ".git"))) { git(dir, "init", "-q"); git(dir, "config", "user.email", "t@example.com"); git(dir, "config", "user.name", "T"); }
  git(dir, "add", "-A");
  if (git(dir, "status", "--porcelain").trim() !== "") git(dir, "commit", "-q", "-m", "state");
}

async function run(dir: string, args: string[], input?: unknown, now = NOW) {
  if (args[0] === "sync" && args[1] === "apply") settle(dir);
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push(args[0] === "sync" && args[1] === "render" ? "--plan" : "--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", now, "--json"]);
}

async function setFormat(dir: string, format: 1 | undefined): Promise<void> {
  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  if (format === undefined) delete config.notion.review_format; else config.notion.review_format = format;
  await writeFile(join(dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
}

/** A brain whose new Review rows are format 2 (no `notion.review_format`), with a synthetic extract of three passages. */
async function format2Brain(context: TestContext, format: 1 | undefined = undefined): Promise<string> {
  const dir = await fixtureCopy(context);
  await setFormat(dir, format);
  const body = PASSAGES.map((text, index) => `<!-- passage ¶${index + 1} item s1 -->\n${text}\n`).join("\n");
  const input = "22222222-3333-4444-8555-666666666666";
  await writeFile(join(dir, "sources/notion/2026-12-10-pilot-extract.md"), `---\nid: ${SRC}\ntype: source\ntitle: Acme sync extract\nsource_key: notion:${input}\nkind: minutes\nextract: true\nextract_of: ${input}\nextract_version: 1\ntranscript_hash: ${"c".repeat(64)}\nselection:\n  - id: s1\n    effective: use\npassages:\n${PASSAGES.map((text, index) => `  - n: ${index + 1}\n    hash: ${passageHash(text)}`).join("\n")}\ncaptured: 2026-12-10\ncontent_hash: ${"d".repeat(64)}\n---\n${body}`);
  return dir;
}

const fact = (extra: Record<string, unknown> = {}) => ({ kind: "update_fact", title: "Launch", target: PROJECT, field: "launch_date", after: "2027-04", why: "Maria moved it.", source: SYNC, passages: [P[0]], ...extra });
const addition = { kind: "add_to_note", title: "Auth", target: CONCEPT, content: `Supabase handles auth. ^[${P[2]}]`, why: "Carlos said it in the sync.", source: SYNC, passages: [P[2]] };
const alias = (after: string) => ({ kind: "add_link", title: "alias", target: DECISION, field: "aliases", after, why: "Said.", source: SYNC, passages: [P[2]] });
const projectLink = { kind: "add_link", title: "link", target: CONCEPT, field: "projects", after: PROJECT, why: "Said.", source: SYNC, passages: [P[2]] };

async function attributes(dir: string, path: string): Promise<Record<string, any>> {
  return parseFrontmatter(await readFile(join(dir, path), "utf8")).attributes as Record<string, any>;
}
const DECISION_PATH = "knowledge/decisions/2026-12-03-use-supabase-for-auth.md";
const CONCEPT_PATH = "knowledge/references/row-level-security.md";

/** Create one review_notes row from these inputs, render it and record it as published on PAGE. */
async function published(dir: string, inputs: unknown[]) {
  const created = await run(dir, ["proposal", "new"], { proposals: [{ kind: "review_notes", source: SYNC, notes: [], note_passages: {} }, ...inputs] });
  assert.equal(created.code, 0, created.stdout);
  const { id, path } = created.json.data.created[0] as { id: string; path: string };
  const [item] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  const recorded = await run(dir, ["sync", "record"], { records: [{ id, notion: PAGE, synced_at: NOW, published: item.published }] });
  assert.equal(recorded.json.data.records[0].result, "recorded", recorded.stdout);
  const proposal = parseFrontmatter(await readFile(join(dir, path), "utf8")).attributes as Record<string, any>;
  return { id, path, item, body: item.body as string, items: proposal.items as Array<{ item_id: string; kind: string; ref: unknown }> };
}

const row = (id: string, body: string, props: Record<string, unknown> = {}) => ({
  database: "review", page_id: PAGE, last_edited: NOW, properties: { "Brain ID": id, State: "Pending", ...props },
  review: { decided: false, decided_at: null, accept_all: false, page_edited_at: NOW, body_markdown: body },
});
/** The plan, with each decided item verified as the skill does after re-reading the page (capture-and-review §7.3). */
const plan = async (dir: string, rows: unknown[]) => {
  const out = (await run(dir, ["sync", "plan"], { as_of: AFTER, rows }, AFTER)).json.data;
  for (const decision of out.review_decisions) for (const item of decision.items) item.verified = { snapshot_hash: item.snapshot_hash, proposed_hash: item.proposed_hash };
  return out;
};
/** The section of one item: from its heading to the next heading. */
const sectionOf = (body: string, itemId: string): string => body.split(/\n(?=#{2,3} )/).find((part) => part.includes(`ref ${itemId}<`))!;
/** Edit only the section of one item. */
const inSection = (body: string, itemId: string, edit: (section: string) => string): string => body.replace(sectionOf(body, itemId), edit(sectionOf(body, itemId)));
const decide = (body: string, itemId: string, token: string) => inSection(body, itemId, (section) => section.replace("Decision: Pending", `Decision: ${token}`));

test("a new row is a format-2 page: top, summary, groups, ref lines, short markers and the brain-context toggle (§7.12.2)", async (context) => {
  const dir = await format2Brain(context);
  const { item, body, items } = await published(dir, [fact({ unsure: ["Carlos named May"] }), addition, projectLink, alias("Supabase auth")]);
  assert.equal(item.published["@review"].format, 2);
  assert.match(body, /^\*\*From Acme sync:\*\* 2 changes and 2 links\. ⚠ marks a change to something you already know and ⚑ something the brain is unsure about/);
  assert.match(body, /\n## Review summary\n\*\*Status:\*\* waiting for you: 2 changes and 2 links\.\n/);
  const headings = [...body.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
  assert.deepEqual(headings, ["Review summary", "Changes to what you know", "Links", 'For Brain Assistant (brain context) {toggle="true"}']);
  assert.match(sectionOf(body, items[0]!.item_id), /^### ⚑ ⚠ Launch date on Acme website: 2027-02 → 2027-04\n> Now: 2027-02\n\n2027-04 \[¶1\]\n\*Why: Maria moved it\.\*\n<span color="gray">ref it-[0-9a-z]{8}<\/span>\nDecision: Pending/);
  assert.match(sectionOf(body, items[2]!.item_id), /\\\+ Acme website\n/, "a link value is one line, escaped from a list");
  assert.ok(!body.includes("^["), "no full passage reference is shown");
  assert.match(body, /\n\t- \[¶1\] Launch moves to April 2027, Maria said\.\n/, "the toggle's children are indented and list the passages");
  assert.match(item.sections["For Brain Assistant (brain context)"], /\*\*Where the brain is unsure\*\*\n- Launch date on Acme website: 2027-02 → 2027-04 \(it-[0-9a-z]{8}\): Carlos named May/);
  assert.equal(typeof item.sections["Review summary"], "string");

  // With notion.review_format 1, a new row keeps the page of 0.8.0 to 0.14.0.
  const old = await format2Brain(context, 1);
  const kept = await published(old, [fact()]);
  assert.equal(kept.item.published["@review"].format, undefined);
  assert.match(kept.body, /^## \[[a-z]+ · it-[0-9a-z]{8}\]/m);
});

test("the ingest's unsure flags and repeats ride on folded items only, and links group by target and field (0088 Q5)", async (context) => {
  const dir = await format2Brain(context);
  const refused = await run(dir, ["proposal", "new"], { proposals: [fact({ unsure: ["Carlos named May"] })] });
  assert.equal(refused.json.error.code, "INPUT_INVALID", "an item that isn't folded into a review_notes can't carry flags");
  const created = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: SYNC, notes: [], note_passages: {} },
    alias("Supabase auth"), alias("Auth on Supabase"), projectLink, fact({ repeat: "launch" }),
  ] });
  assert.equal(created.code, 0, created.stdout);
  const proposal = parseFrontmatter(await readFile(join(dir, created.json.data.created[0].path), "utf8")).attributes as Record<string, any>;
  const items = proposal.items as Array<{ kind: string; ref: unknown; repeat?: string }>;
  assert.deepEqual(items.map((item) => [item.kind, item.ref]), [["change", 0], ["link", [0, 1]], ["link", [2]]], "two aliases of one note are one item");
  assert.equal(items[0]!.repeat, "launch");
  const lint = await run(dir, ["lint"]);
  assert.deepEqual(lint.json.data.issues.filter((issue: { severity: string; path: string }) => issue.severity === "error" && issue.path.startsWith("_proposals/")), []);
});

test("an untouched page holds nothing in Notion; an edited wording or a typed token does, and an edited heading is never read", async (context) => {
  const dir = await format2Brain(context);
  const { id, body, items } = await published(dir, [fact(), addition]);
  assert.deepEqual((await plan(dir, [row(id, body)])).review_pending, []);
  const heading = body.replace("### Adds to Row-level security", "### Something else entirely");
  const out = await plan(dir, [row(id, heading)]);
  assert.deepEqual(out.review_pending, [], "headings are derived and never read");
  assert.deepEqual((await plan(dir, [row(id, decide(body, items[1]!.item_id, "Accept"))])).review_pending, [{ proposal: id, page_id: PAGE }]);
  assert.deepEqual((await plan(dir, [row(id, body.replace("Supabase handles auth. [¶3]", "Supabase handles all auth. [¶3]"))])).review_pending, [{ proposal: id, page_id: PAGE }]);
  // A pending row still gets its two brain-owned sections, never its body, properties or item sections (cli §5.14.4).
  await writeFile(join(dir, CONCEPT_PATH), (await readFile(join(dir, CONCEPT_PATH), "utf8")).replace("title: Row-level security", "title: Row-level access"));
  const pending = await plan(dir, [row(id, decide(body, items[1]!.item_id, "Accept"))]);
  const rendered = await run(dir, ["sync", "render", "--ids", id], pending);
  const [again] = rendered.json.data.items;
  assert.equal(again.action, "update");
  assert.equal(again.body, null);
  assert.deepEqual(again.properties, {});
  assert.equal(again.item_updates, undefined);
  assert.match(again.sections["For Brain Assistant (brain context)"], /Adds to Row-level access/);
  assert.deepEqual(Object.keys(again.published), ["@content"]);
});

test("Approve accepts what is Pending, except a ⚠ fact change or a flagged item; an edited wording is applied and bound by its hash", async (context) => {
  const dir = await format2Brain(context);
  const { id, path, body, items } = await published(dir, [fact(), addition, alias("Supabase auth")]);
  const [factItem, addItem, linkItem] = items.map((item) => item.item_id);
  let page = body.replace("Supabase handles auth. [¶3]", "Supabase handles auth for the site. [¶3]");
  page = inSection(page, addItem!, (section) => section.replace("Decision: Pending", "Decision: Pending\nAgreed in review: wider wording, the passage says the site"));
  const out = await plan(dir, [row(id, page, { "Your call": "Approve" })]);
  assert.deepEqual(out.review_held.map((held: { item_id: string; reason: string }) => [held.item_id, held.reason]), [[factItem, "NEEDS_EXPLICIT_ACCEPT"]]);
  const [decision] = out.review_decisions;
  assert.equal(decision.format, 2);
  assert.equal(decision.call, "approve");
  const added = decision.items.find((entry: { item_id: string }) => entry.item_id === addItem);
  assert.equal(added.decision, "accept");
  assert.equal(added.edited, true);
  assert.equal(added.proposed, `Supabase handles auth for the site. ^[${P[2]}]`, "the short marker is expanded on read");
  assert.equal(added.agreed, "wider wording, the passage says the site");
  const plain = (await plan(dir, [row(id, body.replace("Supabase handles auth. [¶3]", "Supabase handles auth for the site. [¶3]"), { "Your call": "Approve" })])).review_decisions[0].items.find((entry: { item_id: string }) => entry.item_id === addItem);
  assert.equal(plain.proposed_hash, added.proposed_hash, "an Agreed in review line is never hashed");
  assert.equal(decision.items.find((entry: { item_id: string }) => entry.item_id === linkItem).decision, "accept");

  const applied = await run(dir, ["sync", "apply"], out, AFTER);
  assert.equal(applied.code, 0, applied.stdout);
  assert.deepEqual(applied.json.data.review_clear, [{ proposal: id, page_id: PAGE, properties: ["Your call", "What to fix"] }]);
  assert.match(await readFile(join(dir, CONCEPT_PATH), "utf8"), /Supabase handles auth for the site\./);
  assert.match(await readFile(join(dir, DECISION_PATH), "utf8"), /Supabase auth/);
  const after = await attributes(dir, path);
  const recorded = (after.item_decisions as Array<{ item_id: string; agreed?: string }>).find((entry) => entry.item_id === addItem);
  assert.equal(recorded?.agreed, "wider wording, the passage says the site");
  assert.ok(!(after.item_decisions as Array<{ item_id: string }>).some((entry) => entry.item_id === factItem), "the ⚠ fact is still pending");

  // The same fact with Accept on its line is accepted by Approve.
  const explicit = await plan(dir, [row(id, decide(body, factItem!, "Accept"), { "Your call": "Approve" })]);
  assert.equal(explicit.review_decisions[0].items.find((entry: { item_id: string }) => entry.item_id === factItem).decision, "accept");
});

test("a flagged item is never accepted by Approve alone (0090 §5)", async (context) => {
  const dir = await format2Brain(context);
  const { id, body, items } = await published(dir, [{ ...addition, unsure: ["Carlos may have meant the app"] }]);
  const out = await plan(dir, [row(id, body, { "Your call": "Approve" })]);
  assert.deepEqual(out.review_held.map((held: { item_id: string; reason: string }) => [held.item_id, held.reason]), [[items[0]!.item_id, "NEEDS_EXPLICIT_ACCEPT"]]);
  assert.match(body, /### ⚑ Adds to Row-level security/);
});

test("Reject reads Pending as Reject and leaves the field unchanged; the call is cleared", async (context) => {
  const dir = await format2Brain(context);
  const { id, body } = await published(dir, [fact(), addition]);
  const out = await plan(dir, [row(id, body, { "Your call": "Reject" })]);
  assert.deepEqual(out.review_decisions[0].items.map((entry: { decision: string }) => entry.decision), ["reject", "reject"]);
  const applied = await run(dir, ["sync", "apply"], out, AFTER);
  assert.equal(applied.code, 0, applied.stdout);
  assert.match(await readFile(join(dir, "projects/acme-website/project.md"), "utf8"), /launch_date: 2027-02/);
  assert.equal(applied.json.data.review_clear.length, 1);
});

test("an accepted fact's value must be in a passage it cites: by digits, words or a date form, else VALUE_NOT_IN_PASSAGE names the passage that has it", async (context) => {
  const dir = await format2Brain(context);
  const { id, body, items } = await published(dir, [fact()]);
  const factItem = items[0]!.item_id;
  const accepted = await plan(dir, [row(id, decide(body, factItem, "Accept"), { "Your call": "Approve" })]);
  assert.equal(accepted.review_decisions[0].items[0].decision, "accept", "2027-04 is in ¶1 as April 2027");
  const wrong = decide(body.replace("2027-04 [¶1]", "2027-05 [¶1]"), factItem, "Accept");
  const held = await plan(dir, [row(id, wrong, { "Your call": "Approve" })]);
  assert.equal(held.review_held[0].reason, "VALUE_NOT_IN_PASSAGE");
  // ¶2 is not on this page (the item cites only ¶1), so the detail says the value is in none of its passages.
  assert.match(held.review_held[0].detail, /2027-05/);
  // A marker swapped to a passage the page doesn't list is unreadable, never a guess.
  const unknown = await plan(dir, [row(id, decide(body.replace("2027-04 [¶1]", "2027-05 [¶2]"), factItem, "Accept"), { "Your call": "Approve" })]);
  assert.deepEqual(unknown.review_held.map((entry: { reason: string }) => entry.reason), ["UNKNOWN_MARKER"]);
});

test("a swapped marker is accepted from the page's passages, and the detail names the passage that holds the value", async (context) => {
  const dir = await format2Brain(context);
  const { id, body, items } = await published(dir, [fact({ passages: [P[0], P[1]] })]);
  const factItem = items[0]!.item_id;
  assert.match(body, /\n2027-04 \[¶1\] \[¶2\]\n/, "the wording cites both passages");
  const swapped = await plan(dir, [row(id, decide(body.replace("2027-04 [¶1] [¶2]", "2027-05 [¶2]"), factItem, "Accept"), { "Your call": "Approve" })]);
  assert.deepEqual(swapped.review_held, []);
  assert.equal(swapped.review_decisions[0].items[0].proposed, `2027-05 ^[${P[1]}]`);
  const wrong = await plan(dir, [row(id, decide(body.replace("2027-04 [¶1] [¶2]", "2027-05 [¶1]"), factItem, "Accept"), { "Your call": "Approve" })]);
  assert.deepEqual(wrong.review_held, [{ proposal: id, page_id: PAGE, item_id: factItem, reason: "VALUE_NOT_IN_PASSAGE", detail: "¶2 says 2027-05" }]);
  // The summary the render sends with this plan says why the item waits.
  const rendered = await run(dir, ["sync", "render", "--ids", id], wrong);
  assert.match(rendered.json.data.items[0].sections["Review summary"], /^\*\*Status:\*\* 0 of 1 decided: 0 applied, 0 closed, 1 waiting for you\.\n\n- .+ — Held: .*¶2 says 2027-05/);
});

test("the value forms by type: number words, dates, a name's aliases, a status, never digits inside a longer number", () => {
  assert.ok(holdsValue("The pilot starts with nine depots.", valueForms("9")));
  assert.ok(holdsValue("Twenty-one people came.", valueForms("21")));
  assert.ok(!holdsValue("The pilot starts with 19 depots.", valueForms("9")));
  assert.ok(!holdsValue("It costs 9.5 thousand.", valueForms("9")));
  assert.ok(holdsValue("We launch on 3 March.", valueForms("2027-03-03")));
  assert.ok(holdsValue("Launch moves to April 2027.", valueForms("2027-04")));
  assert.ok(!holdsValue("Launch moves to May 2027.", valueForms("2027-04")));
  assert.ok(holdsValue("Ask Maria about it.", valueForms("Maria Lopez", ["Maria"])));
  assert.ok(holdsValue("The project is on hold for now.", valueForms("On hold")));
  assert.ok(holdsValue("Budget is 80,000 EUR.", valueForms("80000")));
});

test("a grouped link item adds only the names still in its wording; a name it never held is refused", async (context) => {
  const dir = await format2Brain(context);
  const { id, body, items } = await published(dir, [alias("Supabase auth"), alias("Auth on Supabase")]);
  const linkItem = items[0]!.item_id;
  assert.match(sectionOf(body, linkItem), /\\\+ Supabase auth\n\\\+ Auth on Supabase\n/);
  const removed = body.replace("\\+ Auth on Supabase\n", "");
  const out = await plan(dir, [row(id, removed, { "Your call": "Approve" })]);
  const [entry] = out.review_decisions[0].items;
  assert.deepEqual(entry.values, [0]);
  // Its names are deleted on the page: a revision of a link item of several values is not supported.
  const revise = await run(dir, ["sync", "apply", "--dry-run"], { ...(await plan(dir, [row(id, body)])), review_revisions: [{ proposal: id, page_id: PAGE, item_id: linkItem, instruction: "Use the other name" }] }, AFTER);
  assert.deepEqual(revise.json.data.revision_results.map((entry: { reason: string }) => entry.reason), ["REVISION_NOT_SUPPORTED"]);
  // Editing never adds a name the item didn't hold (0088 Q5).
  const invented = await plan(dir, [row(id, body.replace("\\+ Auth on Supabase", "\\+ Firebase auth"), { "Your call": "Approve" })]);
  assert.deepEqual(invented.review_held.map((held: { reason: string }) => held.reason), ["LINK_VALUE_UNKNOWN"]);
  const applied = await run(dir, ["sync", "apply"], out, AFTER);
  assert.equal(applied.code, 0, applied.stdout);
  const decision = await readFile(join(dir, DECISION_PATH), "utf8");
  assert.match(decision, /aliases: .*Supabase auth/);
  assert.doesNotMatch(decision, /Auth on Supabase/);
});

test("Request revision needs What to fix; an attended run that drafts it clears the call, an unattended one leaves the row", async (context) => {
  const dir = await format2Brain(context);
  const { id, body, items } = await published(dir, [addition]);
  const bare = await plan(dir, [row(id, body, { "Your call": "Request revision" })]);
  assert.deepEqual(bare.conflicts.map((conflict: { code: string }) => conflict.code), ["REVISION_WITHOUT_TEXT"]);
  assert.deepEqual(bare.review_row_revisions, []);
  const asked = await plan(dir, [row(id, body, { "Your call": "Request revision", "What to fix": "Say it's for the site only" })]);
  assert.deepEqual(asked.review_row_revisions, [{ proposal: id, page_id: PAGE, instruction: "Say it's for the site only" }]);
  assert.deepEqual(asked.review_pending, [{ proposal: id, page_id: PAGE }], "a call waits in Notion");
  // Unattended: the plan goes to apply as it is, so nothing is drafted and Your call stays.
  const unattended = await run(dir, ["sync", "apply", "--dry-run"], asked, AFTER);
  assert.deepEqual(unattended.json.data.review_clear, []);
  // Attended: the skill turns the row's text into a revision of the item it names.
  const attended = { ...asked, review_revisions: [{ proposal: id, page_id: PAGE, item_id: items[0]!.item_id, instruction: "Say it's for the site only" }] };
  const applied = await run(dir, ["sync", "apply"], attended, AFTER);
  assert.equal(applied.code, 0, applied.stdout);
  assert.deepEqual(applied.json.data.review_clear, [{ proposal: id, page_id: PAGE, properties: ["Your call", "What to fix"] }]);
  // The redraft comes back as a format-2 section the skill finds by its ref line.
  const revised = await run(dir, ["proposal", "revise"], { proposal: id, item_id: items[0]!.item_id, proposed: `Supabase handles auth for the site only. ^[${P[2]}]`, previous: `Supabase handles auth. ^[${P[2]}]` });
  assert.equal(revised.code, 0, revised.stdout);
  const [update] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  assert.equal(update.body, null);
  assert.deepEqual(update.item_updates.map((entry: { item_id: string; reason: string }) => [entry.item_id, entry.reason]), [[items[0]!.item_id, "revision_drafted"]]);
  const section = update.item_updates[0].section as string;
  assert.match(section, /^### Adds to Row-level security\nSupabase handles auth for the site only\. \[¶3\]\n/);
  assert.match(section, new RegExp(`<span color="gray">ref ${items[0]!.item_id}</span>\nDecision: Pending`));
  assert.match(section, /<summary>Previous proposal<\/summary>/);
});

test("an untouched format-1 row is rebuilt once as a format-2 page; a touched one keeps format 1", async (context) => {
  const dir = await format2Brain(context, 1);
  const { id, path, body } = await published(dir, [fact(), addition]);
  await setFormat(dir, undefined);
  const untouched = await plan(dir, [row(id, body)]);
  assert.deepEqual(untouched.review_untouched, [{ proposal: id, page_id: PAGE }]);
  const rendered = await run(dir, ["sync", "render", "--ids", id], untouched);
  assert.equal(rendered.code, 0, rendered.stdout);
  const [item] = rendered.json.data.items;
  assert.equal(item.action, "rebuild");
  assert.equal(item.replaces, PAGE);
  assert.equal(item.page_id, null);
  assert.equal(item.published["@review"].format, 2);
  assert.equal(rendered.json.data.rebuilt, 1);
  const recorded = await run(dir, ["sync", "record"], { records: [{ id, notion: NEW_PAGE, replaces: PAGE, synced_at: AFTER, published: item.published }] }, AFTER);
  assert.equal(recorded.json.data.records[0].result, "recorded", recorded.stdout);
  const after = await attributes(dir, path);
  assert.equal(after.notion, NEW_PAGE);
  assert.equal(after.notion_published["@review"].format, 2);
  const twice = await run(dir, ["sync", "record"], { records: [{ id, notion: NEW_PAGE, replaces: PAGE, synced_at: AFTER, published: item.published }] }, AFTER);
  assert.equal(twice.json.data.records[0].result, "recorded", "the same record again is a no-op");

  // A touched row is never listed.
  const other = await format2Brain(context, 1);
  const touched = await published(other, [fact(), addition]);
  await setFormat(other, undefined);
  const typed = touched.body.replace(/(## \[[a-z]+ · it-[0-9a-z]{8}\][\s\S]*?\nDecision: )Pending/, "$1Accept");
  assert.deepEqual((await plan(other, [row(touched.id, typed)])).review_untouched, []);
  // With notion.review_format 1 nothing is rebuilt.
  await setFormat(other, 1);
  assert.deepEqual((await plan(other, [row(touched.id, touched.body)])).review_untouched, []);
});

test("the parser finds items by their ref line, reads the note toggle and ignores the brain-context toggle", () => {
  const page = [
    "## New notes", "### A heading the user changed", "<details>", "<summary>Read or edit the note</summary>", "\tThe body of the note.", "</details>",
    '<span color="gray">ref it-aaaaaaaa</span>', "Decision: Accept", "Agreed in review: kept it short", "",
    '## For Brain Assistant (brain context) {toggle="true"}', '\t<span color="gray">ref it-bbbbbbbb</span>', "\tDecision: Accept",
  ].join("\n");
  const sections = parseReviewPage2(page, UNCONVERTIBLE);
  assert.deepEqual([...sections.keys()], ["it-aaaaaaaa"]);
  const section = sections.get("it-aaaaaaaa")!;
  assert.equal(section.wording, "The body of the note.");
  assert.equal(section.decision_text, "Accept");
  assert.equal(section.agreed, "kept it short");
});

/**
 * The page as Notion's markdown read returns it (capture-and-review §9.5, observed 2026-11-13): brackets escaped (`\[¶1\]`, a backslash as `\\`),
 * blank lines gone, `\+` read as `+`, and a toggle's children indented by a tab. Lines of page structure (headings, tags, spans) are left as they are.
 */
function asNotionReads(body: string): string {
  let inToggle = false;
  return body.split("\n").filter((line) => line !== "").map((line) => {
    if (/^<details>/.test(line)) { inToggle = true; return line; }
    if (/^<\/details>/.test(line)) { inToggle = false; return line; }
    if (/^(#|<summary|<span|\t)/.test(line)) return line;
    // Notion stores the markdown's text (its escapes undone), then writes that text back with `\`, `[` and `]` escaped.
    const stored = line.replace(/\\([\\[\]+])/g, "$1");
    const text = stored.replace(/[\\[\]]/g, (char) => `\\${char}`);
    return inToggle ? `\t${text}` : text;
  }).join("\n");
}

test("a page read back as Notion returns it is not an edit: escaped markers, no blank lines, + lines, indented toggles (§9.5)", async (context) => {
  const dir = await format2Brain(context);
  const literal = { ...addition, content: `Section [¶9] of the contract stays. ^[${P[2]}]` };
  const { id, body, items } = await published(dir, [fact(), literal, alias("Supabase auth"), alias("Auth on Supabase")]);
  assert.match(body, /Section \\\\\[¶9\] of the contract stays\. \[¶3\]/, "a literal [¶ is sent with an escaped backslash");
  const notion = asNotionReads(body);
  assert.match(notion, /2027-04 \\\[¶1\\\]/);
  assert.deepEqual((await plan(dir, [row(id, notion)])).review_pending, [], "the read-back is not an edit");
  const out = await plan(dir, [row(id, decide(notion, items[0]!.item_id, "Accept"), { "Your call": "Approve" })]);
  assert.deepEqual(out.review_held, []);
  const decided = out.review_decisions[0].items as Array<{ item_id: string; proposed: string; edited: boolean; proposed_hash: string; rendered_proposed_hash: string }>;
  for (const item of decided) { assert.equal(item.edited, false, item.item_id); assert.equal(item.proposed_hash, item.rendered_proposed_hash, item.item_id); }
  assert.equal(decided[1]!.proposed, `Section [¶9] of the contract stays. ^[${P[2]}]`, "the literal stays text, the marker expands");
});

test("VALUE_NOT_IN_PASSAGE on the live run's case: 9 cited on the passage of eleven candidates names the passage that says nine (0090 §4)", async (context) => {
  const dir = await format2Brain(context);
  const depots = { kind: "update_fact", title: "Depots", target: PROJECT, field: "pilot_depots", after: "11", why: "Ana listed the candidates.", source: SYNC, passages: [P[3], P[4]], unsure: ["¶4 says eleven candidates, ¶5 says the pilot starts with nine"] };
  const { id, body, items } = await published(dir, [depots]);
  const factItem = items[0]!.item_id;
  assert.match(body, /\n11 \[¶4\] \[¶5\]\n/);
  const wrong = await plan(dir, [row(id, decide(body.replace("11 [¶4] [¶5]", "9 [¶4]"), factItem, "Accept"), { "Your call": "Approve" })]);
  assert.deepEqual(wrong.review_held, [{ proposal: id, page_id: PAGE, item_id: factItem, reason: "VALUE_NOT_IN_PASSAGE", detail: "¶5 says 9" }]);
  const right = await plan(dir, [row(id, decide(body.replace("11 [¶4] [¶5]", "9 [¶5]"), factItem, "Accept"), { "Your call": "Approve" })]);
  assert.deepEqual(right.review_held, []);
  assert.equal(right.review_decisions[0].items[0].proposed, `9 ^[${P[4]}]`);
  // Approve alone never accepts it: the item is flagged.
  assert.deepEqual((await plan(dir, [row(id, body, { "Your call": "Approve" })])).review_held.map((held: { reason: string }) => held.reason), ["NEEDS_EXPLICIT_ACCEPT"]);
});
