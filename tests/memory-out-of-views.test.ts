// CC-345: a view never rests on a memory, the derived-content rule holds in a brain with no suppression record, and reflection leaves
// memories out (spec/eligibility.md §8 rule 1; cli.md §5.13.1 "Views", §5.18, §5.32 "No memories"). Synthetic fixture brain only.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const PROJECT = "prj-9x4t1b7e";
const OTHER_PROJECT = "prj-0other00";
const LIVE_PATH = "knowledge/decisions/2026-12-03-use-supabase-for-auth.md";
const SECRET = "Acme gets a 20 percent discount";

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) { const file = join(dir, "..", `in-${Math.random().toString(36).slice(2)}.json`); await writeFile(file, JSON.stringify(input)); extra.push("--input", file); }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

const read = async (dir: string, id: string) => (await run(dir, ["query", "--read", id])).json.data.notes[0];

const reportBody = (first: string, links: string[]) => `## Where it stands\n\n${first}\n\n## Timeline\n\n${links.map((link) => `- 2026-12-03 · ${link}`).join("\n")}\n\n## Decisions in force\n\n- None\n\n## Open questions and risks\n\n- None\n\n## People involved\n\n- None\n\n## Gaps\n\n- None\n`;

/** A memory under memories/2026/12/, reviewed and scoped to `projects` unless `lifecycle` says otherwise. */
async function memory(dir: string, id: string, title: string, projects: string[], lifecycle = "reviewed"): Promise<string> {
  const path = `memories/2026/12/2026-12-05-${id}.md`;
  await mkdir(join(dir, "memories/2026/12"), { recursive: true });
  await writeFile(join(dir, path), `---\nid: ${id}\ntype: memory\ntitle: ${title}\nsummary: ${SECRET}.\nlifecycle: ${lifecycle}\nscope: project\nprojects: [${projects.join(", ")}]\nconfidence: verified\norigin: acme-api\nsources: [agent:claude-code/2026-12-05-session]\ncreated: 2026-12-05\nupdated: 2026-12-05\n---\n\n${SECRET}.\n`);
  return path;
}

/** A report written straight to reports/, as one written before 0.16.1 could be: `report new` refuses its memory link now. */
async function handReport(dir: string, id: string, generatedFrom: string[], first: string, links: string[] = []): Promise<void> {
  await mkdir(join(dir, "reports"), { recursive: true });
  await writeFile(join(dir, `reports/2026-12-10-${id}.md`), `---\nid: ${id}\ntype: view\ntitle: Discounts ${id}\nview_kind: report\nquestion: What discounts apply?\ngenerated_from: [${generatedFrom.join(", ")}]\ngenerated_at: 2026-12-10T08:00:00Z\ncreated: 2026-12-10\nupdated: 2026-12-10\n---\n\n${reportBody(first, links)}`);
}

test("with no suppression record, a report resting on a memory, a gone note or a proposal is withheld on every surface; one on eligible notes is read (eligibility.md §8 rule 1, CC-345)", async (context) => {
  const dir = await fixtureCopy(context);
  assert.ok(!existsSync(join(dir, "_suppressions")), "the brain has no suppression record");
  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  config.notion.databases.documents = "a1000000-0000-4000-8000-00000000000d";
  await writeFile(join(dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);

  const memPath = await memory(dir, "mem-cc345a01", "Discount rule", [PROJECT]);
  await handReport(dir, "vw-mem0a1b2", ["mem-cc345a01"], `${SECRET}.`, [`Rule ([Discount rule](../${memPath}))`]);
  await handReport(dir, "vw-gone0a1b", ["dec-zzzzzzzz"], "On track.");
  const proposal = /^id: (prp-[0-9a-z]{8})$/m.exec(await readFile(join(dir, "_proposals/2026-12-03-acme-launch-jan-feb.md"), "utf8"))![1]!;
  await handReport(dir, "vw-prp1a2b3", [proposal], "On track.");
  await handReport(dir, "vw-live0a1b", ["dec-7k2m9q4x"], "Auth is Supabase.", [`Auth ([Use Supabase for auth](../${LIVE_PATH}))`]);

  const withheld = (id: string) => ({ id, status: "withheld", reason: "restricted", cause: "dependency", rebuild: "refresh" });
  assert.deepEqual(await read(dir, "vw-mem0a1b2"), withheld("vw-mem0a1b2"), "a report resting on a reviewed memory, even one in reach");
  assert.deepEqual(await read(dir, "vw-gone0a1b"), withheld("vw-gone0a1b"), "a report resting on a note that is gone");
  assert.deepEqual(await read(dir, "vw-prp1a2b3"), withheld("vw-prp1a2b3"), "a report resting on a proposal");
  assert.equal((await read(dir, "vw-live0a1b")).status, "ok", "a report resting on eligible notes is read");

  const candidates = (await run(dir, ["query", "--candidates", "discount rule percent", "--types", "view"])).json.data.candidates;
  assert.ok(!JSON.stringify(candidates).includes("20 percent"), "no snippet quotes the memory");
  assert.ok(!candidates.some((candidate: { id: string }) => candidate.id === "vw-mem0a1b2"), "the report is no candidate");

  const rendered = (await run(dir, ["sync", "render", "--ids", "vw-mem0a1b2"])).json.data.items[0];
  assert.ok(!JSON.stringify(rendered).includes("20 percent"), "the memory's text isn't published to Notion (0008)");
  assert.match(String(rendered.body), /^Withheld:/);

  const index = (await run(dir, ["index", "--check"])).json.data.notes.find((entry: { id: string }) => entry.id === "vw-mem0a1b2");
  assert.equal(index.title, null, "the JSON index keeps no title for the withheld report");
});

test("report new and a refresh refuse a body that links a memory (cli.md §5.18, CC-345)", async (context) => {
  const dir = await fixtureCopy(context);
  const memPath = await memory(dir, "mem-cc345a02", "Discount rule", [PROJECT]);
  const linked = reportBody("See the rule.", [`Rule ([Discount rule](../${memPath}))`]);
  const created = await run(dir, ["report", "new"], { title: "Discounts", question: "What discounts apply?", body: linked });
  assert.notEqual(created.code, 0, created.stdout);
  assert.equal(created.json.error.code, "INPUT_INVALID");
  assert.match(JSON.stringify(created.json.error), /is a memory: a report cites knowledge notes, never a memory/);
  assert.ok(!existsSync(join(dir, "reports")), "nothing is written");

  const live = await run(dir, ["report", "new"], { title: "Auth", question: "Auth?", body: reportBody("Supabase.", [`Auth ([Use Supabase for auth](../${LIVE_PATH}))`]) });
  assert.equal(live.code, 0, live.stdout);
  const refreshed = await run(dir, ["report", "new"], { refresh: live.json.data.id, body: linked });
  assert.equal(refreshed.json.error.code, "INPUT_INVALID", "a refresh is checked the same way");
});

test("reflect --candidates and the near-duplicate lint leave memories out, draft and other-project ones included (cli.md §5.32 \"No memories\", CC-345)", async (context) => {
  const dir = await fixtureCopy(context);
  // Two memories whose names match: once a near_duplicate pair with summaries from the brain root.
  await memory(dir, "mem-cc345b01", "Discount rule for Acme", [PROJECT], "draft");
  await memory(dir, "mem-cc345b02", "Discount rule for ACME", [OTHER_PROJECT]);
  const result = await run(dir, ["reflect", "--candidates", "--limit", "100"]);
  assert.equal(result.code, 0, result.stdout);
  const text = JSON.stringify(result.json.data);
  assert.ok(!/mem-[0-9a-z]{8}/.test(text), "no memory is a member, an input or a reference");
  assert.ok(!text.includes("20 percent"), "and no memory summary is shown");

  const lint = await run(dir, ["lint"]);
  const issues = JSON.stringify(lint.json.data);
  assert.ok(!/near-duplicate[^}]*mem-cc345b0/.test(issues) && !issues.includes("Discount rule for ACME"), "no near-duplicate warning for two memories");
});
