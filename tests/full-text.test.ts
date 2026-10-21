import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
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

test("note new sets notion_text by kind and refuses bad parts", async (context) => {
  const dir = await fixtureCopy(context);
  const email = await newSource(dir, source("Launch thread", "email", "From: Maria\n\nWe launch in February.\n"));
  const doc = await newSource(dir, source("Requirements", "document", DOCUMENT));
  assert.equal(parseFrontmatter(await readFile(join(dir, email.path), "utf8")).attributes.notion_text, "full");
  assert.equal(parseFrontmatter(await readFile(join(dir, doc.path), "utf8")).attributes.notion_text, "digest");

  for (const parts of [["9-3"], ["2-4", "3-5"], ["13"]]) {
    const refused = await run(dir, ["note", "new"], { notes: [source(`Deck ${parts.join(" ")}`, "document", DECK, { notion_text: "full", notion_parts: parts })] });
    assert.equal(refused.json.error?.code, "INPUT_INVALID", JSON.stringify(parts));
  }
  const requested = await run(dir, ["note", "new"], { notes: [source("Asked", "note", "Text.\n", { notion_text_requested: NOW })] });
  assert.equal(requested.json.error?.code, "INPUT_INVALID");
  const lint = await run(dir, ["lint"]);
  assert.equal(lint.json.data.errors, 0, JSON.stringify(lint.json.data.issues));
});

test("lint: notion-parts above the part count and a note listed by two review_notes", async (context) => {
  const dir = await fixtureCopy(context);
  const deck = await newSource(dir, source("Deck", "document", DECK, { notion_text: "full", notion_parts: ["3-9"] }));
  const file = join(dir, deck.path);
  await writeFile(file, (await readFile(file, "utf8")).replace("notion_parts: [3-9]", "notion_parts: [3-13]"));
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

test("render: a document gets its digest only, an email its digest and Full text, once; a capture no body", async (context) => {
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
  assert.deepEqual(emailItem!.sections, { "Full text": "From: Maria\nDate: 2026-12-01\n\nWe launch in February.\n" });
  assert.deepEqual(emailItem!.published["@full_text"], { text: "full", parts: null, requested: null });

  assert.equal(await renderAndRecord(dir, doc.id), undefined, "a second render writes no digest again");
  assert.equal(await renderAndRecord(dir, email.id), undefined, "nor the Full text");

  const capture = await newSource(dir, { type: "source", title: "Call Acme", file_date: "2026-12-02", frontmatter: { source_key: "notion:c3000000-0000-4000-8000-000000000001", kind: "capture", summary: "Call Acme." }, body: "Call Acme about the launch.\n" });
  const captureItem = (await run(dir, ["sync", "render", "--ids", capture.id])).json.data.items[0];
  assert.deepEqual([captureItem.body, captureItem.sections], [null, null]);
  await assertLintClean(dir);
});

test("render: chosen parts only, in order, under a line naming them", async (context) => {
  const dir = await inboxBrain(context);
  const deck = await newSource(dir, source("Launch deck", "document", DECK, { notion_text: "full", notion_parts: ["3-9"] }));
  const doc = await newSource(dir, source("Spec", "document", DOCUMENT, { notion_text: "full", notion_parts: ["2", "4-5"] }));
  const deckText = (await renderAndRecord(dir, deck.id))!.sections["Full text"] as string;
  assert.ok(deckText.startsWith("*Slides 3–9 of 12*\n\nAcme launch deck\n\n<!-- Slide number: 3 -->"));
  assert.deepEqual([...deckText.matchAll(/^# Slide (\d+)$/gm)].map((match) => Number(match[1])), [3, 4, 5, 6, 7, 8, 9]);
  assert.ok((await renderAndRecord(dir, deck.id)) === undefined);
  const docText = (await renderAndRecord(dir, doc.id))!.sections["Full text"] as string;
  assert.ok(docText.startsWith("*Sections 2, 4–5 of 5*\n\nIntro line.\n\n## Two"));
  assert.deepEqual([...docText.matchAll(/^## (\w+)$/gm)].map((match) => match[1]), ["Two", "Four", "Five"]);
  await assertLintClean(dir);
});

test("source full-text: the text goes out once with the box cleared; a re-tick clears the box only", async (context) => {
  const dir = await inboxBrain(context);
  const doc = await newSource(dir, source("Requirements", "document", DOCUMENT));
  await renderAndRecord(dir, doc.id);

  const asked = await run(dir, ["source", "full-text", doc.id]);
  assert.equal(asked.code, 0, asked.stdout);
  assert.deepEqual(asked.json.data, { id: doc.id, path: doc.path, parts: 5, notion_text: "full", notion_parts: null, notion_text_requested: NOW });
  const second = await renderAndRecord(dir, doc.id);
  assert.equal(second!.action, "update");
  assert.equal(second!.sections["Full text"], DOCUMENT);
  assert.deepEqual(second!.properties["Full text"], { type: "checkbox", value: false });
  assert.equal(await renderAndRecord(dir, doc.id), undefined, "after its record, a third render emits nothing");

  const retick = await brain(["source", "full-text", doc.id, "--brain", dir, "--now", "2026-12-11T09:00:00Z", "--json"]);
  assert.equal(retick.code, 0, retick.stdout);
  const cleared = await renderAndRecord(dir, doc.id);
  assert.equal(cleared!.sections, null, "no text is written twice");
  assert.deepEqual(cleared!.properties["Full text"], { type: "checkbox", value: false });
  assert.equal(await renderAndRecord(dir, doc.id), undefined);
  await assertLintClean(dir);
  const log = await readFile(join(dir, "log/2026-12.md"), "utf8");
  assert.ok(log.includes(`full-text ${doc.id} "Requirements" parts=all`), log);
});

test("source full-text: --parts stores the list, all parts replace it, bad lists are refused", async (context) => {
  const dir = await inboxBrain(context);
  const deck = await newSource(dir, source("Launch deck", "document", DECK));
  const sources = await newSource(dir, source("Spec", "document", DOCUMENT));
  await renderAndRecord(dir, deck.id);

  const partial = await run(dir, ["source", "full-text", deck.id, "--parts", "3-9"]);
  assert.deepEqual(partial.json.data.notion_parts, ["3-9"]);
  await renderAndRecord(dir, deck.id);
  await run(dir, ["source", "full-text", deck.id]);
  const all = await renderAndRecord(dir, deck.id);
  assert.equal(all!.sections["Full text"], DECK, "full-text without --parts renders all 12 slides");
  assert.equal(parseFrontmatter(await readFile(join(dir, deck.path), "utf8")).attributes.notion_parts, undefined);

  const listed = await run(dir, ["source", "full-text", sources.id, "--parts", "2,4-5"]);
  assert.deepEqual(listed.json.data.notion_parts, ["2", "4-5"]);
  assert.deepEqual(parseFrontmatter(await readFile(join(dir, sources.path), "utf8")).attributes.notion_parts, ["2", "4-5"]);
  for (const parts of ["2,,4", "9-3", "2-4,3-5", "13"]) {
    const refused = await run(dir, ["source", "full-text", deck.id, "--parts", parts]);
    assert.equal(refused.json.error?.code, "INPUT_INVALID", parts);
  }
  const minutes = await run(dir, ["source", "full-text", "src-7w3c9k5m"]);
  assert.equal(minutes.json.error?.code, "INPUT_INVALID", "minutes have no Inbox body");
  assert.equal((await run(dir, ["source", "full-text", "src-00000000"])).json.error?.code, "UNKNOWN_ID");
  await assertLintClean(dir);
});

test("sync plan reports a ticked Full text box for a source with an Inbox body, and ignores the rest", async (context) => {
  const dir = await inboxBrain(context);
  const doc = await newSource(dir, source("Requirements", "document", DOCUMENT));
  const row = (page: string, brainId: string | null) => ({ database: "inbox", page_id: page, last_edited: NOW, properties: { "Full text": true, "Brain ID": brainId } });
  const plan = await run(dir, ["sync", "plan"], { as_of: NOW, rows: [
    row("d1000000-0000-4000-8000-000000000001", doc.id),
    row("d1000000-0000-4000-8000-000000000002", null),
    row("d1000000-0000-4000-8000-000000000003", "src-7w3c9k5m"),
    row("d1000000-0000-4000-8000-000000000004", "src-00000000"),
    { database: "inbox", page_id: "d1000000-0000-4000-8000-000000000005", last_edited: NOW, properties: { "Full text": false, "Brain ID": doc.id } },
  ] });
  assert.equal(plan.code, 0, plan.stdout);
  assert.deepEqual(plan.json.data.full_text_requests, [{ page_id: "d1000000-0000-4000-8000-000000000001", source: doc.id }]);
  assert.deepEqual(plan.json.data.ignored.map((item: { reason: string; brain_id: string | null }) => [item.reason, item.brain_id]), [["NO_FULL_TEXT", null], ["NO_FULL_TEXT", "src-7w3c9k5m"]]);
  assert.deepEqual(plan.json.data.conflicts.map((item: { code: string }) => item.code), ["UNKNOWN_BRAIN_ID"]);
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
  assert.deepEqual([p.Name.value, p.Kind.value, p["Brain Status"].value, p["Brain ID"].value], ["Acme launch: where we stand", "Report", "Processed", created.json.data.id]);
  assert.deepEqual(p.Ask, { type: "relation", value: [ask] });
  assert.deepEqual(p.Project, { type: "relation", value: ["2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e"] });
  assert.deepEqual(p.Area, { type: "relation", value: ["1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d"] });
  assert.ok(item!.body.startsWith("## Where it stands\n\nLaunch is set for February, per the auth decision."), item!.body);
  assert.equal(await renderAndRecord(dir, created.json.data.id), undefined, "a published report is never rendered again");
  await assertLintClean(dir);
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
