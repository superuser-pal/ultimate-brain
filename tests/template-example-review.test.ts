// CC-241: the template's Example Review page is what CC-240's render gives for its synthetic proposal (decisions 0088 §2, 0090;
// notion/template-examples.md, row 13). Synthetic notes only: the Example story's meeting, decision and question.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { passageHash } from "../src/lib/selection.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const MEETING = "mtg-4n7k2w9p";
const SRC = "src-6h3t8q2m";
const DECISION = "dec-5r8m3x1c";
const QUESTION = "que-2w6p9k4n";
const PROJECT = "prj-7v3n8b2k";
const AREA = "area-4t9w2c6h";
/** The Example minutes' subjects, as the extract's paragraphs (template-examples.md, row 6). */
const PASSAGES = [
  "The refresh covers the home, services and contact pages; the blog already works.",
  "Decided: keep the blog as it is.",
  "The launch date depends on when Northwind's brand guidelines arrive.",
  "Open: can the site go live by the end of March?",
];
const P = PASSAGES.map((text, index) => `${SRC}#¶${index + 1}:${passageHash(text)}`);
const EXAMPLES = join(import.meta.dirname, "..", "notion", "template-examples.md");

async function exampleBrain(context: TestContext): Promise<string> {
  const dir = await fixtureCopy(context);
  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  delete config.notion.review_format;
  await writeFile(join(dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  const input = "33333333-4444-4555-8666-777777777777";
  const body = PASSAGES.map((text, index) => `<!-- passage ¶${index + 1} item s${index < 2 ? 1 : 2} -->\n${text}\n`).join("\n");
  await writeFile(join(dir, "sources/notion/2026-12-10-kickoff-with-northwind-extract.md"), `---\nid: ${SRC}\ntype: source\ntitle: Kickoff with Northwind\nsource_key: notion:${input}\nkind: minutes\nextract: true\nextract_of: ${input}\nextract_version: 1\ntranscript_hash: ${"e".repeat(64)}\nselection:\n  - id: s1\n    effective: use\n  - id: s2\n    effective: use\npassages:\n${PASSAGES.map((text, index) => `  - n: ${index + 1}\n    hash: ${passageHash(text)}`).join("\n")}\ncaptured: 2026-12-10\ncontent_hash: ${"f".repeat(64)}\n---\n${body}`);
  await mkdir(join(dir, "projects/website-refresh"), { recursive: true });
  // The Example story's project and area, with no Notion page recorded: the page names them as plain text.
  await writeFile(join(dir, "areas/clients-example.md"), `---\nid: ${AREA}\ntype: area\ntitle: Clients\nsummary: Client work.\nlifecycle: reviewed\nsources: [${SRC}]\ncreated: 2026-12-10\nupdated: 2026-12-10\n---\n`);
  await writeFile(join(dir, "projects/website-refresh/project.md"), `---\nid: ${PROJECT}\ntype: project\ntitle: Website refresh\nsummary: Northwind's website refresh.\nlifecycle: reviewed\narea: ${AREA}\nsources: [${SRC}]\ncreated: 2026-12-10\nupdated: 2026-12-10\n---\n`);
  await writeFile(join(dir, "knowledge/meetings/2026-12-10-kickoff-with-northwind.md"), `---\nid: ${MEETING}\ntype: meeting\ntitle: Kickoff with Northwind\nsummary: Kickoff for the Northwind website refresh.\nlifecycle: draft\ndate: 2026-12-10\nsource: ${SRC}\ndecisions: [${DECISION}]\nquestions: [${QUESTION}]\narea: ${AREA}\nprojects: [${PROJECT}]\nsources: [${SRC}]\ncreated: 2026-12-10\nupdated: 2026-12-10\n---\n\n## Summary\nKickoff for the Northwind website refresh.\n`);
  await writeFile(join(dir, "knowledge/decisions/2026-12-10-keep-the-blog-as-it-is.md"), `---\nid: ${DECISION}\ntype: decision\ntitle: Keep the blog as it is\nsummary: The refresh leaves Northwind's blog as it is.\nlifecycle: draft\ndate: 2026-12-10\nassessment: accepted\ndecided_in: ${MEETING}\narea: ${AREA}\nprojects: [${PROJECT}]\nsources: [${SRC}]\ncreated: 2026-12-10\nupdated: 2026-12-10\n---\n\n## Decision\nKeep Northwind's blog as it is. The refresh covers the home, services and contact pages. ^[${P[1]}]\n`);
  await writeFile(join(dir, "knowledge/questions/can-the-site-go-live-by-the-end-of-march.md"), `---\nid: ${QUESTION}\ntype: question\ntitle: Can the site go live by the end of March?\nsummary: The launch date waits on Northwind's brand guidelines.\nlifecycle: draft\nkind: question\nraised_in: ${MEETING}\narea: ${AREA}\nprojects: [${PROJECT}]\nsources: [${SRC}]\ncreated: 2026-12-10\nupdated: 2026-12-10\n---\n\nCan the new site go live by the end of March? It depends on when Northwind's brand guidelines arrive. ^[${P[3]}]\n`);
  return dir;
}

/** The page as `sync render` writes it for the Example's proposal: one decision and one question from the kickoff. */
async function renderedExample(context: TestContext): Promise<{ body: string; ids: string[] }> {
  const dir = await exampleBrain(context);
  const file = join(dir, "..", "proposal.json");
  await writeFile(file, JSON.stringify({ proposals: [{ kind: "review_notes", source: MEETING, notes: [DECISION, QUESTION], note_passages: { [DECISION]: [P[1]], [QUESTION]: [P[3]] } }] }));
  const created = await brain(["proposal", "new", "--input", file, "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(created.code, 0, created.stdout);
  const id = created.json.data.created[0].id as string;
  const rendered = await brain(["sync", "render", "--ids", id, "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(rendered.code, 0, rendered.stdout);
  const body = rendered.json.data.items[0].body as string;
  return { body, ids: [...body.matchAll(/ref (it-[0-9a-z]{8})</g)].map((match) => match[1]!) };
}

/** The page in template-examples.md, row 13: the fenced block under its heading. */
async function documentedExample(): Promise<string> {
  const text = await readFile(EXAMPLES, "utf8");
  const section = text.slice(text.indexOf("### Row 13: the Review page"));
  const match = /```markdown\n([\s\S]*?)\n```/.exec(section);
  assert.ok(match, "row 13 has a ```markdown block");
  return match[1]!;
}

test("the template's Example Review page is the format-2 page the render gives for its proposal", async (context) => {
  const { body, ids } = await renderedExample(context);
  if (process.env.EXAMPLE_OUT !== undefined) await writeFile(process.env.EXAMPLE_OUT, body);
  const documented = await documentedExample();
  const documentedIds = [...documented.matchAll(/ref (it-[0-9a-z]{8})</g)].map((match) => match[1]!);
  assert.equal(documentedIds.length, ids.length, "one ref line per item");
  // Item ids are random at proposal creation: the documented page uses invented ones in the same order.
  const normalized = ids.reduce((text, itemId, index) => text.split(itemId).join(documentedIds[index]!), body);
  assert.equal(documented, normalized.replace(/\n+$/, ""));
});
