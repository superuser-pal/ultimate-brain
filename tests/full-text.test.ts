import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter, serializeFrontmatter } from "../src/lib/frontmatter.ts";
import { fullText, rangesProblem, splitParts } from "../src/lib/parts.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";

/** A 12-slide deck as markitdown writes it, with a line before the first slide. */
export const DECK = `Acme launch deck\n\n${Array.from({ length: 12 }, (_, i) => `<!-- Slide number: ${i + 1} -->\n# Slide ${i + 1}\n\nPoint ${i + 1}.\n\n`).join("")}`;
/** A 5-section document; the H3 and the fenced heading are not parts. */
export const DOCUMENT = "Intro line.\n\n## One\nA.\n\n### Detail\nB.\n\n## Two\n```\n## not a heading\n```\n\n## Three\nC.\n\n## Four\nD.\n\n## Five\nE.\n";

export async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

export function source(title: string, kind: string, body: string, frontmatter: Record<string, unknown> = {}) {
  const key = kind === "document" ? { source_key: `file:sha256:${createHash("sha256").update(title).digest("hex")}`, file_name: `${title.toLowerCase().replace(/\W+/g, "-")}.pdf`, converter: "markitdown 0.1.8" } : { source_key: `agent:claude-code/${title.toLowerCase().replace(/\W+/g, "-")}` };
  return { type: "source", title, file_date: "2026-12-01", frontmatter: { ...key, kind, summary: `${title} in one line.`, digest: `- Key point of ${title}.`, ...frontmatter }, body };
}

export async function newSource(dir: string, item: Record<string, unknown>): Promise<{ id: string; path: string }> {
  const created = await run(dir, ["note", "new"], { notes: [item] });
  assert.equal(created.code, 0, created.stdout);
  return created.json.data.created[0];
}

test("parts: slides by marker, else sections at the smallest heading level outside code", () => {
  const deck = splitParts(DECK);
  assert.equal(deck.kind, "slides");
  assert.equal(deck.parts.length, 12);
  assert.equal(deck.preamble, "Acme launch deck\n\n");
  const document = splitParts(DOCUMENT);
  assert.equal(document.kind, "sections");
  assert.deepEqual(document.parts.map((part) => part.split("\n")[0]), ["## One", "## Two", "## Three", "## Four", "## Five"]);
  assert.equal(splitParts("Just text.\n").parts.length, 1);

  const slides = fullText(DECK, ["3-9"]);
  assert.ok(slides.startsWith("*Slides 3–9 of 12*\n\nAcme launch deck\n\n<!-- Slide number: 3 -->"), slides.slice(0, 80));
  assert.ok(slides.includes("# Slide 9") && !slides.includes("# Slide 10") && !slides.includes("# Slide 2\n"));
  const sections = fullText(DOCUMENT, ["2", "4-5"]);
  assert.ok(sections.startsWith("*Sections 2, 4–5 of 5*\n\nIntro line.\n\n## Two"), sections);
  assert.ok(!sections.includes("## One") && !sections.includes("## Three") && sections.includes("## Five"));
  assert.equal(fullText(DECK, null), DECK);

  assert.equal(rangesProblem(["3-9"], 12), null);
  for (const bad of [["9-3"], ["2-4", "3-5"], ["13"], ["4", "2"], ["3-3"]]) assert.notEqual(rangesProblem(bad, 12), null, JSON.stringify(bad));
});

test("note new writes no notion_text and refuses the retired source keys (0049)", async (context) => {
  const dir = await fixtureCopy(context);
  const email = await newSource(dir, source("Launch thread", "email", "From: Maria\n\nWe launch in February.\n"));
  const doc = await newSource(dir, source("Requirements", "document", DOCUMENT, { only_keep: "the requirements table" }));
  assert.equal(parseFrontmatter(await readFile(join(dir, email.path), "utf8")).attributes.notion_text, undefined);
  const docAttributes = parseFrontmatter(await readFile(join(dir, doc.path), "utf8")).attributes;
  assert.equal(docAttributes.notion_text, undefined);
  assert.equal(docAttributes.only_keep, "the requirements table");

  for (const extra of [{ notion_text: "full" }, { notion_text: "full", notion_parts: ["2"] }, { notion_text_requested: NOW }, { keep: "the deadlines" }]) {
    const refused = await run(dir, ["note", "new"], { notes: [source(`Deck ${Object.keys(extra).join(" ")}`, "document", DECK, extra)] });
    assert.equal(refused.json.error?.code, "INPUT_INVALID", JSON.stringify(extra));
  }
  const minutes = await run(dir, ["note", "new"], { notes: [source("Minutes", "minutes", "Notes.\n", { only_keep: "the decisions" })] });
  assert.equal(minutes.json.error?.code, "INPUT_INVALID", "only_keep is refused on minutes");
  const lint = await run(dir, ["lint"]);
  assert.equal(lint.json.data.errors, 0, JSON.stringify(lint.json.data.issues));
});

test("lint: notion-parts above the part count and a note listed by two review_notes", async (context) => {
  const dir = await fixtureCopy(context);
  const deck = await newSource(dir, source("Deck", "document", DECK));
  // A source from before 0.6.0, whose parts were chosen with source full-text.
  const file = join(dir, deck.path);
  await writeFile(file, (await readFile(file, "utf8")).replace("\ncontent_hash:", "\nnotion_text: full\nnotion_parts: [3-13]\ncontent_hash:"));
  const created = await run(dir, ["proposal", "new"], { proposals: [{ kind: "review_notes", source: "mtg-8c4n2p7w", notes: ["dec-7k2m9q4x"] }] });
  const path = join(dir, created.json.data.created[0].path);
  const copy = (await readFile(path, "utf8")).replace(/^id: prp-\w+$/m, "id: prp-2b3c4d5e");
  await writeFile(join(dir, "_proposals/2026-12-10-copy.md"), copy);
  const lint = await run(dir, ["lint"]);
  const rules = lint.json.data.issues.filter((issue: { severity: string }) => issue.severity === "error").map((issue: { rule: string; path: string }) => `${issue.rule} ${issue.path}`);
  assert.ok(rules.includes(`notion-parts ${deck.path}`), JSON.stringify(rules));
  assert.equal(rules.filter((rule: string) => rule.startsWith("review-notes")).length, 2, JSON.stringify(rules));
});

const INBOX = "a1000000-0000-4000-8000-00000000000c";

/** The fixture with an Inbox database set, so sources render. */
export async function inboxBrain(context: Parameters<typeof fixtureCopy>[0]): Promise<string> {
  const dir = await fixtureCopy(context);
  const configPath = join(dir, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.notion.databases.inbox = INBOX;
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return dir;
}

let pages = 0;
/** Render one note and record what was sent, as the skill does after writing the page. */
export async function renderAndRecord(dir: string, id: string): Promise<Record<string, any> | undefined> {
  const rendered = await run(dir, ["sync", "render", "--ids", id]);
  assert.equal(rendered.code, 0, rendered.stdout);
  const item = rendered.json.data.items.find((candidate: { id: string }) => candidate.id === id);
  if (item === undefined) return undefined;
  pages += 1;
  const notion = item.page_id ?? `b2000000-0000-4000-8000-${String(pages).padStart(12, "0")}`;
  const recorded = await run(dir, ["sync", "record"], { records: [{ id, notion, synced_at: NOW, published: item.published }] });
  assert.equal(recorded.code, 0, recorded.stdout);
  return item;
}

async function assertLintClean(dir: string): Promise<void> {
  const lint = await run(dir, ["lint"]);
  assert.equal(lint.json.data.errors, 0, JSON.stringify(lint.json.data.issues));
}

test("render: a document and an email get their digest only, once; a capture no body; no Full text (0049)", async (context) => {
  const dir = await inboxBrain(context);
  const doc = await newSource(dir, source("Requirements", "document", DOCUMENT));
  const email = await newSource(dir, source("Launch thread", "email", "From: Maria\nDate: 2026-12-01\n\nWe launch in February.\n"));

  const docItem = await renderAndRecord(dir, doc.id);
  assert.equal(docItem!.action, "create");
  assert.equal(docItem!.body, "*Document · requirements.pdf · 2026-12-01 · 25 words*\n\nRequirements in one line.\n\n- Key point of Requirements.");
  assert.equal(docItem!.sections, null);
  assert.equal(docItem!.properties["Full text"], undefined);

  const emailItem = await renderAndRecord(dir, email.id);
  assert.ok(emailItem!.body.startsWith("*Email · pasted text · 2026-12-01 · "), emailItem!.body);
  assert.equal(emailItem!.sections, null);
  assert.equal(emailItem!.published["@full_text"], undefined);

  assert.equal(await renderAndRecord(dir, doc.id), undefined, "a second render writes no digest again");
  assert.equal(await renderAndRecord(dir, email.id), undefined);

  const capture = await newSource(dir, { type: "source", title: "Call Acme", file_date: "2026-12-02", frontmatter: { source_key: "notion:c3000000-0000-4000-8000-000000000001", kind: "capture", summary: "Call Acme." }, body: "Call Acme about the launch.\n" });
  const captureItem = (await run(dir, ["sync", "render", "--ids", capture.id])).json.data.items[0];
  assert.deepEqual([captureItem.body, captureItem.sections], [null, null]);
  await assertLintClean(dir);
});

test("render: a source from before 0.6.0 with notion_text full sends no Full text and keeps its @full_text", async (context) => {
  const dir = await inboxBrain(context);
  const deck = await newSource(dir, source("Launch deck", "document", DECK));
  await renderAndRecord(dir, deck.id);
  const file = join(dir, deck.path);
  const document = parseFrontmatter(await readFile(file, "utf8"));
  const stored = { text: "full", parts: ["3-9"], requested: null };
  Object.assign(document.attributes, { notion_text: "full", notion_parts: ["3-9"], notion_published: { ...(document.attributes.notion_published as object), "@full_text": stored } });
  await writeFile(file, serializeFrontmatter(document));
  assert.equal(await renderAndRecord(dir, deck.id), undefined, "nothing is due");
  assert.deepEqual((parseFrontmatter(await readFile(file, "utf8")).attributes.notion_published as Record<string, unknown>)["@full_text"], stored);
  await assertLintClean(dir);
});

test("source full-text is retired: it writes nothing and fails with RETIRED (0049)", async (context) => {
  const dir = await inboxBrain(context);
  const doc = await newSource(dir, source("Requirements", "document", DOCUMENT));
  const before = await readFile(join(dir, doc.path), "utf8");
  for (const args of [["source", "full-text", doc.id], ["source", "full-text", doc.id, "--parts", "2"]]) {
    const refused = await run(dir, args);
    assert.equal(refused.code, 2, refused.stdout);
    assert.equal(refused.json.error.code, "RETIRED");
    assert.match(refused.json.error.message, /retired in 0\.6\.0: use Keep as document/);
  }
  assert.equal(await readFile(join(dir, doc.path), "utf8"), before);
});

test("sync plan ignores a Full text box as RETIRED (0049)", async (context) => {
  const dir = await inboxBrain(context);
  const doc = await newSource(dir, source("Requirements", "document", DOCUMENT));
  const plan = await run(dir, ["sync", "plan"], { as_of: NOW, rows: [
    { database: "inbox", page_id: "d1000000-0000-4000-8000-000000000001", last_edited: NOW, properties: { "Full text": true, "Brain ID": doc.id } },
  ] });
  assert.equal(plan.code, 0, plan.stdout);
  assert.equal(plan.json.data.full_text_requests, undefined);
  assert.deepEqual(plan.json.data.document_requests, []);
  assert.deepEqual(plan.json.data.ignored, [{ database: "inbox", page_id: "d1000000-0000-4000-8000-000000000001", brain_id: doc.id, property: "Full text", reason: "RETIRED" }]);
});

test("render: an area page gets its Brief section from the area Brief, with links to published pages", async (context) => {
  const dir = await inboxBrain(context);
  const result = await run(dir, ["sync", "render", "--ids", "area-2m7c4h8n"]);
  const [item] = result.json.data.items;
  assert.equal(item.body, null);
  assert.deepEqual(item.sections, { Brief: "## Projects\n- [Acme website](https://www.notion.so/2b3c4d5e6f7a4b9c8d1e2f3a4b5c6d7e) — Active\n\n## Recent decisions\n- Nothing reviewed yet: 1 note waiting in Review\n\n## Open questions\n- Nothing reviewed yet: 1 note waiting in Review" });
});

const REPORT_BODY = [
  "## Where it stands", "Launch is set for February, per [the auth decision](../knowledge/decisions/2026-12-03-use-supabase-for-auth.md).",
  "## Timeline", "- 2026-12-03: auth chosen.",
  "## Decisions in force", "- [Use Supabase for auth](../knowledge/decisions/2026-12-03-use-supabase-for-auth.md)",
  "## Open questions and risks", "- None",
  "## People involved", "- None",
  "## Gaps", "- Nothing on pricing.",
].join("\n\n");

test("report new stores a dated report view; render creates its Inbox row once, linked to the Ask row", async (context) => {
  const dir = await inboxBrain(context);
  const ask = "f1000000-0000-4000-8000-000000000001";
  const input = { title: "Acme launch: where we stand", question: "Everything about the Acme launch", asked_in: ask, projects: ["prj-9x4t1b7e"], area: "area-2m7c4h8n", body: REPORT_BODY };
  const created = await run(dir, ["report", "new"], input);
  assert.equal(created.code, 0, created.stdout);
  assert.equal(created.json.data.path, "reports/2026-12-10-acme-launch-where-we-stand.md");
  assert.deepEqual(created.json.data.generated_from, ["dec-7k2m9q4x"]);
  const view = parseFrontmatter(await readFile(join(dir, created.json.data.path), "utf8")).attributes;
  assert.deepEqual([view.type, view.view_kind, view.question, view.asked_in, view.generated_at], ["view", "report", input.question, ask, NOW]);
  assert.ok((await readFile(join(dir, "log/2026-12.md"), "utf8")).includes(`report-new ${created.json.data.id} "Acme launch: where we stand"`));
  await assertLintClean(dir);

  const again = await run(dir, ["report", "new"], input);
  assert.equal(again.json.data.path, "reports/2026-12-10-acme-launch-where-we-stand-2.md", "a second report the same day gets its own file");

  const item = await renderAndRecord(dir, created.json.data.id);
  assert.equal(item!.action, "create");
  assert.equal(item!.database, "inbox");
  const p = item!.properties;
  assert.deepEqual([p.Name.value, p.Kind.value, p["Brain Status"].value, p["Brain ID"].value], ["Acme launch: where we stand", "Report", "Done", created.json.data.id]);
  assert.deepEqual(p.Ask, { type: "relation", value: [ask] });
  assert.deepEqual(p.Project, { type: "relation", value: ["2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e"] });
  assert.deepEqual(p.Area, { type: "relation", value: ["1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d"] });
  assert.ok(item!.body.startsWith("## Where it stands\n\nLaunch is set for February, per the auth decision."), item!.body);
  assert.equal(await renderAndRecord(dir, created.json.data.id), undefined, "a published report is never rendered again");
  await assertLintClean(dir);
});

test("render skips reports while Reports is off, and names one asked for by id MODULE_OFF (0048)", async (context) => {
  const dir = await inboxBrain(context);
  const input = { title: "Acme launch: where we stand", question: "Everything about the Acme launch", asked_in: "f1000000-0000-4000-8000-000000000002", projects: ["prj-9x4t1b7e"], area: "area-2m7c4h8n", body: REPORT_BODY };
  const created = await run(dir, ["report", "new"], input);
  assert.equal(created.code, 0, created.stdout);
  assert.equal((await run(dir, ["modules", "off", "reports"])).code, 0);
  const changed = await run(dir, ["sync", "render", "--changed"]);
  assert.equal(changed.json.data.items.some((item: { id: string }) => item.id === created.json.data.id), false);
  const named = await run(dir, ["sync", "render", "--ids", created.json.data.id]);
  assert.deepEqual(named.json.data.errors, [{ id: created.json.data.id, reason: "MODULE_OFF" }]);
});

test("report new refuses wrong sections, broken links and unknown ids", async (context) => {
  const dir = await inboxBrain(context);
  const base = { title: "Where we stand", question: "Everything", body: REPORT_BODY };
  const code = async (input: unknown) => (await run(dir, ["report", "new"], input)).json.error?.code;
  assert.equal(await code({ ...base, body: REPORT_BODY.replace("## Gaps", "## Next steps") }), "INPUT_INVALID");
  assert.equal(await code({ ...base, body: `Intro.\n\n${REPORT_BODY}` }), "INPUT_INVALID");
  assert.equal(await code({ ...base, body: `${REPORT_BODY}\n\n[x](../knowledge/decisions/missing.md)` }), "INPUT_INVALID");
  assert.equal(await code({ ...base, projects: ["prj-00000000"] }), "UNKNOWN_ID");
  assert.equal(await code({ ...base, area: "prj-9x4t1b7e" }), "INPUT_INVALID");
  assert.equal(await code({ ...base, extra: 1 }), "INPUT_INVALID");
});

test("a Report row: What to fix becomes a report fix, and a refresh keeps the id and Notion row and clears Refresh (0045)", async (context) => {
  const dir = await inboxBrain(context);
  const [ask, ask2] = ["f1000000-0000-4000-8000-000000000001", "f1000000-0000-4000-8000-000000000002"];
  const created = await run(dir, ["report", "new"], { title: "Acme launch: where we stand", question: "Everything about the Acme launch", asked_in: ask, projects: ["prj-9x4t1b7e"], body: REPORT_BODY });
  const id = created.json.data.id as string;
  await renderAndRecord(dir, id);
  const path = join(dir, created.json.data.path);
  const page = parseFrontmatter(await readFile(path, "utf8")).attributes.notion as string;

  const snapshot = (fix: string) => ({ as_of: NOW, rows: [{ database: "inbox", page_id: page, last_edited: NOW, properties: { "Brain ID": id, "Refresh asked": true, "What to fix": fix } }] });
  const plan = async (fix: string) => (await run(dir, ["sync", "plan"], snapshot(fix))).json.data;
  const first = await plan("Lucía left Acme in June");
  assert.deepEqual(first.refresh_requests, [{ page_id: page, report: id }]);
  assert.deepEqual(first.report_fixes, [{ page_id: page, report: id, text: "Lucía left Acme in June" }]);
  // A space before migration 0010 still has the Refresh checkbox.
  const legacy = await run(dir, ["sync", "plan"], { as_of: NOW, rows: [{ database: "inbox", page_id: page, last_edited: NOW, properties: { "Brain ID": id, Refresh: true } }] });
  assert.deepEqual(legacy.json.data.refresh_requests, [{ page_id: page, report: id }]);

  const proposal = await run(dir, ["proposal", "new"], { proposals: [{ kind: "update_fact", title: "Launch: March", target: "prj-9x4t1b7e", field: "launch_date", after: "2027-03", why: "The report was wrong.", source: "mtg-8c4n2p7w" }] });
  const prp = proposal.json.data.created[0].id as string;
  assert.equal((await run(dir, ["report", "fix", id, "--text", "Lucía left Acme in June", "--proposals", "prp-00000000"])).json.error?.code, "UNKNOWN_ID");
  const fixed = await run(dir, ["report", "fix", id, "--text", "Lucía left Acme in June", "--proposals", prp]);
  assert.deepEqual(fixed.json.data, { id, fixes: 1 });
  assert.deepEqual(parseFrontmatter(await readFile(path, "utf8")).attributes.fixes, [{ text: "Lucía left Acme in June", received: NOW, proposals: [prp] }]);
  assert.deepEqual((await plan("Lucía left Acme in June")).report_fixes, [], "a fix already recorded is not read again");

  const cleared = await renderAndRecord(dir, id);
  assert.equal(cleared!.action, "update");
  assert.deepEqual(cleared!.properties["What to fix"], { type: "rich_text", value: null });
  assert.equal(cleared!.properties.Refresh, undefined);
  assert.equal(cleared!.body, null, "the body goes out only on a refresh");
  assert.equal(cleared!.published["@fixes"], 1);

  const later = "2026-12-17T09:00:00Z";
  const input = join(dir, "..", "refresh.json");
  await writeFile(input, JSON.stringify({ refresh: id, asked_in: ask2, body: REPORT_BODY.replace("Launch is set for February", "Launch is set for March") }));
  const refreshed = await brain(["report", "new", "--input", input, "--brain", dir, "--now", later, "--json"]);
  assert.equal(refreshed.code, 0, refreshed.stdout);
  assert.equal(refreshed.json.data.id, id);
  assert.equal(refreshed.json.data.path, created.json.data.path);
  const view = parseFrontmatter(await readFile(path, "utf8")).attributes;
  assert.deepEqual([view.notion, view.question, view.generated_at, view.asked_in], [page, "Everything about the Acme launch", later, [ask, ask2]]);
  assert.ok((await readFile(join(dir, "log/2026-12.md"), "utf8")).includes(`report-refresh ${id} "Acme launch: where we stand"`));

  const sent = await renderAndRecord(dir, id);
  assert.equal(sent!.action, "update");
  assert.equal(sent!.page_id, page);
  assert.ok(sent!.body.startsWith("## Where it stands\n\nLaunch is set for March"), sent!.body);
  assert.deepEqual(sent!.properties.Refresh, { type: "checkbox", value: false });
  assert.deepEqual(sent!.properties.Ask, { type: "relation", value: [ask, ask2] });
  assert.equal(await renderAndRecord(dir, id), undefined, "nothing changed since");
  assert.equal((await run(dir, ["report", "new"], { refresh: "dec-7k2m9q4x", body: REPORT_BODY })).json.error?.code, "INPUT_INVALID");
  await assertLintClean(dir);
});

test("render: an attached source has no Inbox row; its notes go on the parent's Produced relations", async (context) => {
  const dir = await inboxBrain(context);
  const parent = await newSource(dir, source("Launch thread", "email", "From: Maria\n\nSee the attached plan.\n"));
  const plan = source("Launch plan", "document", DOCUMENT, { attached_to: parent.id });
  delete (plan.frontmatter as Record<string, unknown>).digest;
  const attached = await newSource(dir, plan);
  const made = await run(dir, ["note", "new"], { notes: [{ type: "decision", title: "Launch in February", frontmatter: { summary: "Launch in February.", date: "2026-12-01", assessment: "accepted", projects: ["prj-9x4t1b7e"], sources: [attached.id] }, body: "Launch in February.\n" }] });
  assert.equal(made.code, 0, made.stdout);
  const decision = made.json.data.created[0].id;

  const byId = await run(dir, ["sync", "render", "--ids", attached.id]);
  assert.deepEqual(byId.json.data?.items, [], byId.stdout);
  const all = await run(dir, ["sync", "render", "--changed"]);
  assert.equal(all.code, 0, all.stdout.slice(0, 600));
  const items = all.json.data.items;
  assert.equal(items.some((item: { id: string }) => item.id === attached.id), false);
  const row = items.find((item: { id: string }) => item.id === parent.id);
  assert.deepEqual(row.pending_relations.find((relation: { property: string }) => relation.property === "Decisions"), { property: "Decisions", ids: [decision] });
  await assertLintClean(dir);
});

test("note new: attached_to must name a source, existing or earlier in the batch, that isn't attached itself", async (context) => {
  const dir = await inboxBrain(context);
  const parent = await newSource(dir, source("Launch thread", "email", "From: Maria\n\nPlan attached.\n"));
  const attach = (title: string, to: string) => {
    const item = source(title, "document", `${title} body.\n`, { attached_to: to });
    delete (item.frontmatter as Record<string, unknown>).digest;
    return item;
  };
  const child = await newSource(dir, attach("Launch plan", parent.id));
  const nested = await run(dir, ["note", "new"], { notes: [attach("Plan annex", child.id)] });
  assert.equal(nested.json.error?.code, "INPUT_INVALID");
  assert.equal(nested.json.error.details[0].pointer, "/notes/0/frontmatter/attached_to");
  assert.equal((await run(dir, ["note", "new"], { notes: [attach("Annex", "dec-7k2m9q4x")] })).json.error?.code, "INPUT_INVALID", "not a source");
  assert.equal((await run(dir, ["note", "new"], { notes: [attach("Annex", "src-00000000")] })).json.error?.code, "INPUT_INVALID", "missing");

  const ids = (await run(dir, ["id", "new", "source", "--count", "2"])).json.data.ids as string[];
  const batch = [{ ...source("Second thread", "email", "From: Ana\n\nTwo files.\n"), id: ids[0] }, { ...attach("Second plan", ids[0]!), id: ids[1] }];
  assert.equal((await run(dir, ["note", "new"], { notes: batch })).code, 0, "a parent earlier in the batch is fine");
  const chained = (await run(dir, ["id", "new", "source", "--count", "2"])).json.data.ids as string[];
  const chain = [{ ...attach("Third plan", parent.id), id: chained[0] }, { ...attach("Third annex", chained[0]!), id: chained[1] }];
  assert.equal((await run(dir, ["note", "new"], { notes: chain })).json.error?.code, "INPUT_INVALID", "nor attached earlier in the batch");
  await assertLintClean(dir);
});
