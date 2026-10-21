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

export async function newSource(dir: string, item: ReturnType<typeof source>): Promise<{ id: string; path: string }> {
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
