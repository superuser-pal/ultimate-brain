import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter, serializeFrontmatter, serializeNewFile } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const MARIA = "per-3h8w2n6c";
const MARIA_PAGE = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";

async function input(dir: string, name: string, value: unknown): Promise<string> {
  const path = join(dir, "..", name);
  await writeFile(path, JSON.stringify(value));
  return path;
}

test("sync plan detects a Notion fact correction from its published baseline", async (context) => {
  const dir = await fixtureCopy(context);
  const path = "knowledge/people/maria-lopez.md";
  const file = join(dir, path);
  const document = parseFrontmatter(await readFile(file, "utf8"));
  document.attributes.notion_published = { Name: "Maria López", Summary: document.attributes.summary, Role: "Product Manager", Lifecycle: "Reviewed", "Brain ID": MARIA };
  await writeFile(file, serializeFrontmatter(document));
  const snapshot = { as_of: NOW, rows: [{ database: "people", page_id: MARIA_PAGE, last_edited: "2026-12-10T08:00:00Z", properties: { "Brain ID": MARIA, Role: "Product lead" } }] };
  const run = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot.json", snapshot), "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.corrections, [{ target: MARIA, field: "facts.role", value: "Product lead", observed_at: "2026-12-10T08:00:00Z", property: "Role", notion_value: "Product lead" }]);
});

test("sync plan refuses as_of on a row; it belongs at the snapshot's top (#122)", async (context) => {
  const dir = await fixtureCopy(context);
  const snapshot = { as_of: NOW, rows: [{ database: "people", page_id: MARIA_PAGE, last_edited: "2026-12-10T08:00:00Z", as_of: NOW, properties: { "Brain ID": MARIA } }] };
  const run = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot.json", snapshot), "--json"]);
  assert.notEqual(run.code, 0, run.stdout);
  assert.match(run.stdout, /\/rows\/0\/as_of/);
  assert.match(run.stdout, /unknown key/);
});

test("sync plan reads a pre-0.5.0 Edit as Fix: with a Note it is for the skill, without one a conflict", async (context) => {
  const dir = await fixtureCopy(context);
  const linkProposal = "prp-0a1b2c3d";
  const supersedeProposal = "prp-1a1b2c3d";
  await writeFile(join(dir, "_proposals/2026-12-10-add-alias.md"), serializeNewFile({
    id: linkProposal, type: "proposal", title: "Add Mari alias", created: "2026-12-10", updated: "2026-12-10",
    kind: "add_link", target: MARIA, field: "aliases", after: "Mari", status: "pending",
  }, ""));
  await writeFile(join(dir, "_proposals/2026-12-10-supersede.md"), serializeNewFile({
    id: supersedeProposal, type: "proposal", title: "Supersede Firebase", created: "2026-12-10", updated: "2026-12-10",
    kind: "supersede", target: "dec-7k2m9q4x", supersedes: "dec-2p9f6h1r", status: "pending",
  }, ""));
  const snapshot = { as_of: NOW, rows: [[linkProposal, "Mari is a nickname, not an alias"], [supersedeProposal, ""]].map(([proposal, note], index) => ({
    database: "review", page_id: `10000000-0000-4000-8000-0000000000e${index}`, last_edited: "2026-12-10T08:00:00Z", properties: {
      "Brain ID": proposal, Decision: "Edit", Note: note, State: "Pending",
    },
  })) };

  const planned = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot-link-edit.json", snapshot), "--json"]);
  assert.equal(planned.code, 0, planned.stdout);
  assert.deepEqual(planned.json.data.decisions, []);
  assert.deepEqual(planned.json.data.conflicts.map((item: { code: string; brain_id: string; property: string }) => [item.code, item.brain_id, item.property]), [
    ["FIX_TO_READ", linkProposal, "What to fix"],
    ["FIX_WITHOUT_TEXT", supersedeProposal, "What to fix"],
  ]);

  const applied = await brain(["sync", "apply", "--brain", dir, "--now", NOW, "--input", await input(dir, "link-edit-plan.json", planned.json.data), "--json"]);
  assert.equal(applied.code, 0, applied.stdout);
  assert.deepEqual(applied.json.data.decisions, []);
  assert.deepEqual(applied.json.data.conflicts.map((item: { code: string }) => item.code), ["FIX_TO_READ", "FIX_WITHOUT_TEXT"]);
});

test("sync plan leaves an approval Note for the skill to interpret", async (context) => {
  const dir = await fixtureCopy(context);
  const snapshot = { as_of: NOW, rows: [{
    database: "review", page_id: "2f3a4b5c-6d7e-4f8a-9b0c-1d2e3f4a5b6c", last_edited: "2026-12-10T08:00:00Z",
    properties: { "Brain ID": "prp-9d3f7h2k", Decision: "Approve", Note: "all except Carlos", State: "Pending" },
  }] };
  const run = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "review-note.json", snapshot), "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.decisions, []);
  assert.deepEqual(run.json.data.conflicts.map((item: { code: string; property: string; notion_value: string }) => [item.code, item.property, item.notion_value]), [["NOTE_TO_READ", "What to fix", "all except Carlos"]]);
});

test("sync accepts fractional-second timestamps and stores seconds precision", async (context) => {
  const dir = await fixtureCopy(context);
  const snapshot = { as_of: "2026-12-10T09:00:00.000Z", rows: [{ database: "people", page_id: MARIA_PAGE, last_edited: "2026-12-10T08:00:00.123Z", properties: { "Brain ID": MARIA } }] };
  const run = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "fractional-timestamps.json", snapshot), "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.equal(run.json.data.as_of, NOW);
});

test("sync render creates a project with no Notion page from the Projects template (decision 0068)", async (context) => {
  const dir = await fixtureCopy(context);
  const projectPath = join(dir, "projects/acme-website/project.md");
  const project = await readFile(projectPath, "utf8");
  await writeFile(projectPath, project.replace("notion: 2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e\n", ""));

  const run = await brain(["sync", "render", "--brain", dir, "--ids", "prj-9x4t1b7e", "--now", NOW, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.errors, []);
  const [item] = run.json.data.items;
  assert.equal(item.action, "create");
  assert.equal(item.page_id, null);
  assert.deepEqual(item.template, { type: "default" });
  for (const name of ["Name", "Summary", "Key Facts", "Area", "Brain ID"]) assert.ok(Object.hasOwn(item.properties, name), name);
  assert.equal(Object.hasOwn(item.properties, "Lifecycle"), false, "Projects have no Lifecycle (0070)");
  assert.deepEqual(Object.keys(item.sections), ["Brief", "Decision log"]);
  assert.equal(item.body, null);
  assert.ok(typeof item.published["@content"] === "string");

  const changed = await brain(["sync", "render", "--brain", dir, "--changed", "--now", NOW, "--json"]);
  const selected = changed.json.data.items.find((entry: { id: string }) => entry.id === "prj-9x4t1b7e");
  assert.equal(selected?.action, "create", "--changed selects it like any unpublished note");
  assert.ok(changed.json.data.items.filter((entry: { id: string }) => entry.id !== "prj-9x4t1b7e").every((entry: Record<string, unknown>) => !Object.hasOwn(entry, "template")), "no other item carries a template");
});

test("a project that has its Notion page renders as an update with no template", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await brain(["sync", "render", "--brain", dir, "--ids", "prj-9x4t1b7e", "--now", NOW, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  const [item] = run.json.data.items;
  assert.equal(item.action, "update");
  assert.equal(Object.hasOwn(item, "template"), false);
});

test("sync render creates Inbox and Documents payloads from a document source; a learned Document is Origin Learned (0071)", async (context) => {
  const dir = await fixtureCopy(context);
  const configPath = join(dir, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.notion.databases.inbox = "a1000000-0000-4000-8000-00000000000c";
  config.notion.databases.documents = "a1000000-0000-4000-8000-00000000000d";
  await writeFile(configPath, JSON.stringify(config, null, 2));
  const source = "src-1a2b3c4d";
  const noteInput = { notes: [
    { type: "source", id: source, title: "Architecture brief", file_date: "2026-12-10", frontmatter: { source_key: "agent:test/document", kind: "document", summary: "Explains the deployment model." }, body: "Deployment notes.\n" },
    { type: "reference", id: "ref-2a3b4c5d", title: "Deployment model", frontmatter: { origin: "learned", summary: "A deployment approach.", sources: [source] }, body: "Deploy safely.\n" },
  ] };
  const created = await brain(["note", "new", "--brain", dir, "--now", NOW, "--input", await input(dir, "source-and-concept.json", noteInput), "--json"]);
  assert.equal(created.code, 0, created.stdout);
  const run = await brain(["sync", "render", "--brain", dir, "--ids", `${source},ref-2a3b4c5d`, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  const byId = new Map<string, { database: string; action: string; properties: Record<string, unknown>; pending_relations: Array<Record<string, unknown>> }>(run.json.data.items.map((item: { id: string; database: string; action: string; properties: Record<string, unknown>; pending_relations: Array<Record<string, unknown>> }) => [item.id, item]));
  assert.equal(byId.get(source)?.database, "inbox");
  assert.equal(byId.get(source)?.action, "create");
  assert.equal(byId.get(source)?.properties.Concepts, undefined, "Inbox · Concepts is retired (0071)");
  assert.deepEqual(byId.get(source)?.properties.Documents, { type: "relation", value: [] });
  assert.deepEqual(byId.get(source)?.pending_relations, [{ property: "Documents", ids: ["ref-2a3b4c5d"] }]);
  assert.equal(byId.get("ref-2a3b4c5d")?.database, "documents");
  assert.deepEqual(byId.get("ref-2a3b4c5d")?.properties.Origin, { type: "select", value: "Learned" });
});

test("sync render updates a capture at the Inbox page in its key", async (context) => {
  const dir = await fixtureCopy(context);
  const configPath = join(dir, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.notion.databases.inbox = "a1000000-0000-4000-8000-00000000000c";
  await writeFile(configPath, JSON.stringify(config, null, 2));
  const page = "11111111-0000-4000-8000-000000000010";
  const source = "src-3a4b5c6d";
  const noteInput = { notes: [{ type: "source", id: source, title: "Quick capture", file_date: "2026-12-10", frontmatter: { source_key: `notion:${page}`, kind: "capture" }, body: "Remember this.\n" }] };
  const created = await brain(["note", "new", "--brain", dir, "--now", NOW, "--input", await input(dir, "capture.json", noteInput), "--json"]);
  assert.equal(created.code, 0, created.stdout);
  const run = await brain(["sync", "render", "--brain", dir, "--ids", source, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.equal(run.json.data.items[0].action, "update");
  assert.equal(run.json.data.items[0].page_id, page);
  assert.equal(run.json.data.items[0].properties.Name, undefined);
});

test("sync tasks renders source tasks with an Inbox backlink", async (context) => {
  const dir = await fixtureCopy(context);
  const configPath = join(dir, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.notion.tasks.properties.source = "Source";
  await writeFile(configPath, JSON.stringify(config, null, 2));
  const source = "src-4a5b6c7d";
  const noteInput = { notes: [{ type: "source", id: source, title: "Pasted email", file_date: "2026-12-10", frontmatter: { source_key: "agent:test/email", kind: "email" }, body: "Please send a plan.\n" }] };
  const created = await brain(["note", "new", "--brain", dir, "--now", NOW, "--input", await input(dir, "task-source.json", noteInput), "--json"]);
  assert.equal(created.code, 0, created.stdout);
  const run = await brain(["sync", "tasks", "--brain", dir, "--source", source, "--input", await input(dir, "source-tasks.json", { items: [{ title: "Send plan", projects: ["prj-9x4t1b7e"] }] }), "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.items[0].pending_relations, [{ property: "Source", ids: [source] }]);
  assert.equal(run.json.data.items[0].properties.Owner, undefined);
  assert.equal(run.json.data.items[0].properties["Brain ID"].value, source);
});

test("sync tasks: a waiting_on item carries the Waiting On status and the other person's name; any other status is refused", async (context) => {
  const dir = await fixtureCopy(context);
  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  config.notion.tasks.properties.owner = "Owner";
  await writeFile(join(dir, "brain.json"), JSON.stringify(config, null, 2));
  const source = "src-4a5b6c7d";
  const noteInput = { notes: [{ type: "source", id: source, title: "Pasted email", file_date: "2026-12-10", frontmatter: { source_key: "agent:test/email", kind: "email" }, body: "Maria will send the plan.\n" }] };
  assert.equal((await brain(["note", "new", "--brain", dir, "--now", NOW, "--input", await input(dir, "w-source.json", noteInput), "--json"])).code, 0);
  const run = (items: unknown[], name: string) => brain(["sync", "tasks", "--brain", dir, "--source", source, "--input", await_(name, items), "--json"]);
  const await_ = (name: string, items: unknown[]) => { const file = join(dir, "..", name); writeFileSync(file, JSON.stringify({ items })); return file; };
  const ok = await run([{ title: "Maria sends the plan", status: "waiting_on", owner: "Maria Lopez" }], "w1.json");
  assert.equal(ok.code, 0, ok.stdout);
  const properties = ok.json.data.items[0].properties;
  assert.equal(properties.Status.value, "Waiting On");
  assert.equal(properties.Owner.value, "Maria Lopez");
  assert.equal((await run([{ title: "x", status: "waiting_on" }], "w2.json")).json.error.code, "INPUT_INVALID");
  assert.equal((await run([{ title: "x", status: "done", owner: "A" }], "w3.json")).json.error.code, "INPUT_INVALID");
  const plain = await run([{ title: "My task", owner: "Someone" }], "w4.json");
  assert.equal(plain.json.data.items[0].properties.Owner, undefined, "without the token the owner-only rule holds");
});

test("sync tasks treats an absent source mapping as unmapped", async (context) => {
  const dir = await fixtureCopy(context);
  const configPath = join(dir, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  delete config.notion.tasks.properties.source;
  await writeFile(configPath, JSON.stringify(config, null, 2));
  const source = "src-4a5b6c7d";
  const created = await brain(["note", "new", "--brain", dir, "--now", NOW, "--input", await input(dir, "unmapped-source.json", { notes: [{ type: "source", id: source, title: "Pasted email", file_date: "2026-12-10", frontmatter: { source_key: "agent:test/email", kind: "email" }, body: "Please send a plan.\n" }] }), "--json"]);
  assert.equal(created.code, 0, created.stdout);
  const run = await brain(["sync", "tasks", "--brain", dir, "--source", source, "--input", await input(dir, "unmapped-source-tasks.json", { items: [{ title: "Send plan" }] }), "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.items[0].pending_relations, []);
  assert.equal(run.json.data.items[0].properties.Source, undefined);
});

test("sync tasks rejects a non-meeting, non-source target", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await brain(["sync", "tasks", "--brain", dir, "--source", MARIA, "--input", await input(dir, "person-tasks.json", { items: [{ title: "Nope" }] }), "--json"]);
  assert.equal(run.code, 4);
  assert.equal(run.json.error.code, "INPUT_INVALID");
});

test("sync plan reports learned Document relation edits as not correctable", async (context) => {
  const dir = await fixtureCopy(context);
  const source = "src-1a2b3c4d";
  const concept = "ref-2a3b4c5d";
  const created = await brain(["note", "new", "--brain", dir, "--now", NOW, "--input", await input(dir, "concept-for-plan.json", { notes: [
    { type: "source", id: source, title: "Architecture brief", file_date: "2026-12-10", frontmatter: { source_key: "agent:test/document", kind: "document" }, body: "Deployment notes.\n" },
    { type: "reference", id: concept, title: "Deployment model", frontmatter: { origin: "learned", summary: "A deployment approach.", sources: [source], projects: ["prj-9x4t1b7e"] }, body: "Deploy safely.\n" },
  ] }), "--json"]);
  assert.equal(created.code, 0, created.stdout);
  const conceptPath = join(dir, "knowledge/references/deployment-model.md");
  const document = parseFrontmatter(await readFile(conceptPath, "utf8"));
  document.attributes.notion = "10000000-0000-4000-8000-0000000000c1";
  document.attributes.notion_published = { Project: ["2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e"], Area: [] };
  await writeFile(conceptPath, serializeFrontmatter(document));
  const snapshot = { as_of: NOW, rows: [{ database: "documents", page_id: document.attributes.notion, last_edited: "2026-12-10T08:00:00Z", properties: { "Brain ID": concept, Project: [], Area: ["1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d"] } }] };
  const run = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "concept-relations.json", snapshot), "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.corrections, []);
  assert.deepEqual(run.json.data.ignored.map((item: { property: string; reason: string }) => [item.property, item.reason]), [["Area", "NOT_CORRECTABLE"], ["Project", "NOT_CORRECTABLE"]]);
});

test("sync apply creates a Notion-created note with its lifecycle and applies corrections", async (context) => {
  const dir = await fixtureCopy(context);
  const mariaPath = join(dir, "knowledge/people/maria-lopez.md");
  await writeFile(mariaPath, `${await readFile(mariaPath, "utf8")}\nCurrently coordinating launch work.\n`);
  const plan = {
    as_of: NOW,
    create: [{ type: "org", id: "org-1a2b3c4d", title: "Globex", lifecycle: "reviewed", frontmatter: { summary: "Globex", sources: ["notion:10000000-0000-4000-8000-000000000001"], notion: "10000000-0000-4000-8000-000000000001" }, body: "" }],
    updates: [],
    corrections: [{ target: MARIA, field: "facts.role", value: "Product lead", observed_at: "2026-12-10T08:00:00Z" }],
    decisions: [], conflicts: [], ignored: [],
  };
  const run = await brain(["sync", "apply", "--brain", dir, "--now", NOW, "--input", await input(dir, "plan.json", plan), "--json"]);
  assert.equal(run.code, 0, run.stdout);
  const globex = parseFrontmatter(await readFile(join(dir, "knowledge/orgs/globex.md"), "utf8")).attributes;
  assert.equal(globex.lifecycle, "reviewed");
  const maria = parseFrontmatter(await readFile(join(dir, "knowledge/people/maria-lopez.md"), "utf8")).attributes;
  assert.equal((maria.facts as Record<string, unknown>).role, "Product lead");
  assert.ok(run.json.warnings.some((warning: { code: string; path: string }) => warning.code === "FRESHNESS" && warning.path === "knowledge/people/maria-lopez.md"));
  const log = await readFile(join(dir, "log/2026-12.md"), "utf8");
  assert.match(log, /sync-create org-1a2b3c4d "Globex"/);
});

// --- sync apply runs creates in relation order (cli §5.14.3, CC-113) ---------------------------

const page = (n: number) => `d1130000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const fromNotion = (type: string, id: string, title: string, n: number, frontmatter: Record<string, unknown> = {}) =>
  ({ type, id, title, lifecycle: "draft", frontmatter: { summary: title, notion: page(n), sources: [`notion:${page(n)}`], ...frontmatter }, body: "" });

async function applyCreates(dir: string, create: unknown[]) {
  const plan = { as_of: NOW, create, updates: [], corrections: [], decisions: [], conflicts: [], ignored: [] };
  return brain(["sync", "apply", "--brain", dir, "--now", NOW, "--input", await input(dir, `plan-${Math.random().toString(36).slice(2)}.json`, plan), "--json"]);
}
const results = (run: { json: any }) => run.json.data.create.map((item: any) => [item.id, item.result, item.reason]);

test("sync apply creates a new Area before the new Domain it names, whatever the plan's order (#192)", async (context) => {
  const dir = await fixtureCopy(context);
  assert.equal((await brain(["modules", "on", "domains", "--brain", dir, "--now", NOW, "--json"])).code, 0);
  const area = fromNotion("area", "area-7b3k9m2q", "Billing", 1, { domain: "dom-4n8p2r6t" });
  const domain = fromNotion("domain", "dom-4n8p2r6t", "Operations", 2);
  const run = await applyCreates(dir, [area, domain]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(results(run), [["area-7b3k9m2q", "applied", undefined], ["dom-4n8p2r6t", "applied", undefined]]);
  assert.equal((await brain(["lint", "--brain", dir, "--json"])).json.data.errors, 0);
});

test("sync apply creates a new Project after its new Org and its new Area, whatever the plan's order", async (context) => {
  const dir = await fixtureCopy(context);
  const project = fromNotion("project", "prj-2c6v8x4z", "Portal", 3, { client: "org-8w2e4r6t", area: "area-3j5k7n9p" });
  const org = fromNotion("org", "org-8w2e4r6t", "Initech", 4);
  const area = fromNotion("area", "area-3j5k7n9p", "Partnerships", 5);
  const run = await applyCreates(dir, [project, org, area]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(results(run), [["prj-2c6v8x4z", "applied", undefined], ["org-8w2e4r6t", "applied", undefined], ["area-3j5k7n9p", "applied", undefined]]);
  assert.equal((await brain(["lint", "--brain", dir, "--json"])).json.data.errors, 0);
});

test("sync apply reports creates in a relation cycle and still applies the rest", async (context) => {
  const dir = await fixtureCopy(context);
  const first = fromNotion("org", "org-1q3w5e7r", "Umbrella", 6, { relations: [{ type: "about", target: "org-2a4s6d8f" }] });
  const second = fromNotion("org", "org-2a4s6d8f", "Hooli", 7, { relations: [{ type: "about", target: "org-1q3w5e7r" }] });
  const dependent = fromNotion("person", "per-5g7h9j2k", "Dee Ortiz", 8, { org: "org-1q3w5e7r" });
  const free = fromNotion("org", "org-6z8x2c4v", "Vandelay", 9);
  const self = fromNotion("org", "org-7m9n3b5v", "Soylent", 10, { relations: [{ type: "about", target: "org-7m9n3b5v" }] });
  const run = await applyCreates(dir, [dependent, first, free, second, self]);
  assert.equal(run.code, 1, run.stdout);
  assert.deepEqual(results(run).slice(0, 4), [
    ["per-5g7h9j2k", "failed", "DEPENDENCY_FAILED"],
    ["org-1q3w5e7r", "failed", "RELATION_CYCLE"],
    ["org-6z8x2c4v", "applied", undefined],
    ["org-2a4s6d8f", "failed", "RELATION_CYCLE"],
  ]);
  // A create naming its own id is no cycle: whatever lint says of it, it is not RELATION_CYCLE.
  assert.notEqual(results(run)[4][2], "RELATION_CYCLE");
  const log = await readFile(join(dir, "log/2026-12.md"), "utf8");
  assert.match(log, /sync-create org-6z8x2c4v "Vandelay"/);
  assert.doesNotMatch(log, /sync-create org-1q3w5e7r/);
});

test("sync tasks renders per-item projects, falls back to the meeting, and reports unpublished relations", async (context) => {
  const dir = await fixtureCopy(context);
  const configPath = join(dir, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.notion.tasks.properties.owner = "Owner";
  await writeFile(configPath, JSON.stringify(config, null, 2));
  const meetingPath = join(dir, "knowledge/meetings/2026-12-03-acme-sync.md");
  const meeting = await readFile(meetingPath, "utf8");
  const withoutProjects = meeting.replace("projects: [prj-9x4t1b7e]", "projects: []");
  assert.notEqual(withoutProjects, meeting, "fixture meeting must have a project to override");
  await writeFile(meetingPath, withoutProjects);
  const override = await brain(["sync", "tasks", "--brain", dir, "--meeting", "mtg-8c4n2p7w", "--input", await input(dir, "tasks-override.json", { items: [{ title: "Send plan", owner: "Carlos Ruiz", due: "2026-12-10", projects: ["prj-9x4t1b7e"] }] }), "--json"]);
  assert.equal(override.code, 0, override.stdout);
  assert.equal(override.json.data.items[0].database_id, "a1000000-0000-4000-8000-00000000000b");
  assert.equal(override.json.data.items[0].properties.Name.value, "Send plan");
  assert.deepEqual(override.json.data.items[0].properties.Owner, { type: "person_name", value: "Carlos Ruiz" });
  assert.deepEqual(override.json.data.items[0].properties.Due, { type: "date", value: { start: "2026-12-10", end: null } });
  assert.deepEqual(override.json.data.items[0].properties.Project.value, ["2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e"]);
  assert.deepEqual(override.json.data.items[0].pending_relations, []);

  await writeFile(meetingPath, (await readFile(meetingPath, "utf8")).replace("projects: []", "projects: [prj-9x4t1b7e]"));
  const fallback = await brain(["sync", "tasks", "--brain", dir, "--meeting", "mtg-8c4n2p7w", "--input", await input(dir, "tasks-fallback.json", { items: [{ title: "Use fallback", projects: [] }] }), "--json"]);
  assert.equal(fallback.code, 0, fallback.stdout);
  assert.deepEqual(fallback.json.data.items[0].properties.Project.value, ["2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e"]);

  const projectPath = join(dir, "projects/acme-website/project.md");
  await writeFile(projectPath, (await readFile(projectPath, "utf8")).replace(/notion: .*\n/, ""));
  const unpublished = await brain(["sync", "tasks", "--brain", dir, "--meeting", "mtg-8c4n2p7w", "--input", await input(dir, "tasks-unpublished.json", { items: [{ title: "Wait for project", projects: ["prj-9x4t1b7e"] }] }), "--json"]);
  assert.equal(unpublished.code, 0, unpublished.stdout);
  assert.deepEqual(unpublished.json.data.items[0].properties.Project.value, []);
  assert.deepEqual(unpublished.json.data.items[0].pending_relations, [{ property: "Project", ids: ["prj-9x4t1b7e"] }]);
});

test("sync tasks types the Status value by notion.tasks.status_type (#113)", async (context) => {
  const dir = await fixtureCopy(context);
  const configPath = join(dir, "brain.json");
  const base = JSON.parse(await readFile(configPath, "utf8"));
  assert.equal(base.notion.tasks.status_type, undefined, "fixture must leave status_type absent");
  const run = async (statusType: unknown) => {
    const config = structuredClone(base);
    if (statusType === undefined) delete config.notion.tasks.status_type;
    else config.notion.tasks.status_type = statusType;
    await writeFile(configPath, JSON.stringify(config, null, 2));
    return brain(["sync", "tasks", "--brain", dir, "--meeting", "mtg-8c4n2p7w", "--input", await input(dir, `status-${String(statusType)}.json`, { items: [{ title: "Send plan" }] }), "--json"]);
  };
  for (const [statusType, type] of [[undefined, "select"], ["select", "select"], ["status", "status"]] as const) {
    const result = await run(statusType);
    assert.equal(result.code, 0, result.stdout);
    assert.deepEqual(result.json.data.items[0].properties.Status, { type, value: "To Do" }, `status_type ${String(statusType)}`);
  }
  const invalid = await run("text");
  assert.equal(invalid.json.ok, false);
  assert.equal(invalid.json.error.code, "BRAIN_CONFIG_INVALID");
  const lint = await brain(["lint", "--brain", dir, "--json"]);
  assert.ok(lint.json.data.issues.some((issue: { rule: string; severity: string }) => issue.rule === "brain-config" && issue.severity === "error"), lint.stdout);
});

test("sync tasks rejects missing and non-project item projects", async (context) => {
  const dir = await fixtureCopy(context);
  const missing = await brain(["sync", "tasks", "--brain", dir, "--meeting", "mtg-8c4n2p7w", "--input", await input(dir, "tasks-missing-project.json", { items: [{ title: "Missing", projects: ["prj-00000000"] }] }), "--json"]);
  assert.equal(missing.code, 4);
  assert.equal(missing.json.error.code, "UNKNOWN_ID");
  const invalid = await brain(["sync", "tasks", "--brain", dir, "--meeting", "mtg-8c4n2p7w", "--input", await input(dir, "tasks-non-project.json", { items: [{ title: "Wrong type", projects: [MARIA, 3] }] }), "--json"]);
  assert.equal(invalid.code, 4);
  assert.equal(invalid.json.error.code, "INPUT_INVALID");
  assert.deepEqual(invalid.json.error.details.map((detail: { pointer: string }) => detail.pointer), ["/items/0/projects/0", "/items/0/projects/1"]);
});

test("sync record never changes updated", async (context) => {
  const dir = await fixtureCopy(context);
  const before = parseFrontmatter(await readFile(join(dir, "knowledge/people/maria-lopez.md"), "utf8")).attributes.updated;
  const record = await brain(["sync", "record", "--brain", dir, "--now", NOW, "--input", await input(dir, "record.json", { records: [{ id: MARIA, notion: MARIA_PAGE, synced_at: NOW, published: { Role: "Product Manager" } }] }), "--json"]);
  assert.equal(record.code, 0, record.stdout);
  const after = parseFrontmatter(await readFile(join(dir, "knowledge/people/maria-lopez.md"), "utf8")).attributes;
  assert.equal(after.updated, before);
  assert.equal((after.notion_published as Record<string, unknown>).Role, "Product Manager");
});

test("sync render presents an add_link review with its target title", async (context) => {
  const dir = await fixtureCopy(context);
  await writeFile(join(dir, "_proposals/2026-12-10-add-carlos.md"), serializeNewFile({
    id: "prp-0a1b2c3d", type: "proposal", title: "Add Carlos to Acme website", created: "2026-12-10", updated: "2026-12-10",
    kind: "add_link", target: "prj-9x4t1b7e", field: "people", after: "per-9t2c6m4a", why: "Carlos joins the project.", source: "mtg-8c4n2p7w", status: "pending",
  }, ""));
  const run = await brain(["sync", "render", "--brain", dir, "--ids", "prp-0a1b2c3d", "--json"]);
  assert.equal(run.code, 0, run.stdout);
  const properties = run.json.data.items[0].properties;
  assert.equal(properties.Name.type, "title");
  assert.equal(properties.Kind.value, "Add Link");
  assert.equal(properties.Now.value, null);
  assert.equal(properties.Proposed.value, "People: Carlos Ruiz");
});

test("sync render makes target-relative Review links plain text", async (context) => {
  const dir = await fixtureCopy(context);
  await mkdir(join(dir, "sources/files"), { recursive: true });
  await writeFile(join(dir, "sources/files/x.md"), serializeNewFile({
    id: "src-0a1b2c3d", type: "source", title: "X file", source_key: "file:x", content_hash: "sha256:x", captured: "2026-12-10T09:00:00Z", created: "2026-12-10", updated: "2026-12-10",
  }, "Source text."));
  const decisionPath = join(dir, "knowledge/decisions/2026-12-03-use-supabase-for-auth.md");
  await writeFile(decisionPath, (await readFile(decisionPath, "utf8")).replace("updated: 2026-12-04\n", "updated: 2026-12-04\nnotion: 7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d\n"));
  await writeFile(join(dir, "_proposals/2026-12-10-target-relative-review-links.md"), serializeNewFile({
    id: "prp-0a1b2c3d", type: "proposal", title: "Update Acme website", created: "2026-12-10", updated: "2026-12-10",
    kind: "add_to_note", target: "prj-9x4t1b7e", content: "Read [X file](../../sources/files/x.md) and [Use Supabase for auth](../../knowledge/decisions/2026-12-03-use-supabase-for-auth.md).", why: "See [X file](../../sources/files/x.md).", status: "pending",
  }, ""));
  const run = await brain(["sync", "render", "--brain", dir, "--ids", "prp-0a1b2c3d", "--json"]);
  assert.equal(run.code, 0, run.stdout);
  const properties = run.json.data.items[0].properties;
  assert.equal(properties.Proposed.value, "Read X file and Use Supabase for auth.");
  assert.equal(properties.Why.value, "See X file.");
  assert.equal(properties.Now.value, null);
  assert.doesNotMatch(properties.Proposed.value, /notion\.so|\[[^\]]+\]\([^)]+\)/);
});

test("sync render gives supersede and merge reviews titles and truncates text", async (context) => {
  const dir = await fixtureCopy(context);
  const common = { type: "proposal", created: "2026-12-10", updated: "2026-12-10", why: "w", source: "mtg-8c4n2p7w", status: "pending" };
  await writeFile(join(dir, "_proposals/2026-12-10-supersede.md"), serializeNewFile({ ...common, id: "prp-0a1b2c3d", title: "Supersede auth", kind: "supersede", target: "dec-7k2m9q4x", supersedes: "dec-2p9f6h1r" }, ""));
  await writeFile(join(dir, "_proposals/2026-12-10-merge.md"), serializeNewFile({ ...common, id: "prp-1a1b2c3d", title: "Merge people", kind: "merge", target: "per-9t2c6m4a", merge_into: "per-3h8w2n6c" }, ""));
  await writeFile(join(dir, "_proposals/2026-12-10-long.md"), serializeNewFile({ ...common, id: "prp-2a1b2c3d", title: "Long note", kind: "add_to_note", target: "org-6d1f9z3k", content: "x".repeat(2001) }, ""));
  const run = await brain(["sync", "render", "--brain", dir, "--ids", "prp-0a1b2c3d,prp-1a1b2c3d,prp-2a1b2c3d", "--json"]);
  assert.equal(run.code, 0, run.stdout);
  const byId = new Map<string, Record<string, { value: unknown }>>(run.json.data.items.map((item: { id: string; properties: Record<string, { value: unknown }> }) => [item.id, item.properties]));
  assert.equal(byId.get("prp-0a1b2c3d")!.Now.value, "Use Firebase for auth");
  assert.equal(byId.get("prp-1a1b2c3d")!.Now.value, "Carlos Ruiz");
  assert.equal((byId.get("prp-2a1b2c3d")!.Proposed.value as string).length, 2000);
});

test("sync publishes the brain's values for a Notion-created row whose brain-owned properties are empty", async (context) => {
  const dir = await fixtureCopy(context);
  const page = "10000000-0000-4000-8000-0000000000aa";
  const row = { database: "people", page_id: page, last_edited: "2026-12-10T08:00:00Z", properties: { Name: "Ines Ortega", Summary: null, Lifecycle: null, "Brain ID": null } };
  const plan = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot.json", { as_of: NOW, rows: [row] }), "--json"]);
  assert.equal(plan.code, 0, plan.stdout);
  const planPath = await input(dir, "plan.json", plan.json.data);
  const apply = await brain(["sync", "apply", "--brain", dir, "--now", NOW, "--input", planPath, "--json"]);
  assert.equal(apply.code, 0, apply.stdout);
  const id = apply.json.data.create[0].id;
  const render = await brain(["sync", "render", "--brain", dir, "--now", NOW, "--changed", "--plan", planPath, "--json"]);
  const item = render.json.data.items.find((entry: { id: string }) => entry.id === id);
  assert.equal(item.properties.Summary.value, "Ines Ortega");
  assert.equal(item.properties.Lifecycle.value, "Draft");
  const record = await brain(["sync", "record", "--brain", dir, "--now", NOW, "--input", await input(dir, "record.json", { records: [{ id, notion: page, synced_at: NOW, published: item.published }] }), "--json"]);
  assert.equal(record.code, 0, record.stdout);
  const published = { ...row, properties: { ...row.properties, Summary: "Ines Ortega", Lifecycle: "Draft", "Brain ID": id } };
  const replan = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot2.json", { as_of: NOW, rows: [published] }), "--json"]);
  assert.deepEqual([replan.json.data.updates, replan.json.data.corrections, replan.json.data.conflicts], [[], [], []]);
  const edited = { ...published, properties: { ...published.properties, Lifecycle: "Reviewed" } };
  const edit = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot3.json", { as_of: NOW, rows: [edited] }), "--json"]);
  assert.deepEqual(edit.json.data.conflicts, []);
  assert.equal(edit.json.data.updates[0].lifecycle, "reviewed");
});

test("sync keeps a Notion edit made before the first publish and refuses an emptied Lifecycle", async (context) => {
  const dir = await fixtureCopy(context);
  const page = "10000000-0000-4000-8000-0000000000ab";
  const row = { database: "people", page_id: page, last_edited: "2026-12-10T08:00:00Z", properties: { Name: "Ines Ortega", Summary: null, Lifecycle: null, "Brain ID": null } };
  const plan = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot.json", { as_of: NOW, rows: [row] }), "--json"]);
  const apply = await brain(["sync", "apply", "--brain", dir, "--now", NOW, "--input", await input(dir, "plan.json", plan.json.data), "--json"]);
  const id = apply.json.data.create[0].id;
  const early = { ...row, properties: { ...row.properties, Summary: "Ops" } };
  const replan = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot2.json", { as_of: NOW, rows: [early] }), "--json"]);
  assert.deepEqual(replan.json.data.conflicts.map((item: { code: string; property: string }) => [item.code, item.property]), [["BOTH_CHANGED", "Summary"]]);
  const render = await brain(["sync", "render", "--brain", dir, "--now", NOW, "--changed", "--plan", await input(dir, "plan2.json", replan.json.data), "--json"]);
  const item = render.json.data.items.find((entry: { id: string }) => entry.id === id);
  assert.equal(item.properties.Summary, undefined);
  assert.equal(item.properties.Lifecycle.value, "Draft");
  await brain(["sync", "record", "--brain", dir, "--now", NOW, "--input", await input(dir, "record.json", { records: [{ id, notion: page, synced_at: NOW, published: { Lifecycle: "Draft" } }] }), "--json"]);
  const cleared = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot3.json", { as_of: NOW, rows: [{ ...row, properties: { ...row.properties, Summary: null, Lifecycle: null } }] }), "--json"]);
  assert.deepEqual(cleared.json.data.conflicts.map((item: { code: string; property: string }) => [item.code, item.property]), [["REQUIRED_EMPTY", "Lifecycle"]]);
  const applied = await brain(["sync", "apply", "--brain", dir, "--now", NOW, "--input", await input(dir, "plan3.json", cleared.json.data), "--json"]);
  assert.equal(applied.code, 0, applied.stdout);
  const unknown = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot4.json", { as_of: NOW, rows: [{ ...row, properties: { ...row.properties, Lifecycle: "Foo" } }] }), "--json"]);
  assert.ok(unknown.json.data.ignored.some((entry: { reason: string; property: string }) => entry.reason === "UNKNOWN_OPTION" && entry.property === "Lifecycle"));
});

test("sync settles after one round trip for goals, projects and people created in Notion", async (context) => {
  const dir = await fixtureCopy(context);
  const area = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";
  const acme = "6f7a8b9c-0d1e-4f2a-9b3c-4d5e6f7a8b9c";
  const goal = "10000000-0000-4000-8000-0000000000c1";
  const project = "10000000-0000-4000-8000-0000000000c2";
  const person = "10000000-0000-4000-8000-0000000000c3";
  const rows: Array<{ database: string; page_id: string; last_edited: string; properties: Record<string, unknown> }> = [
    { database: "goals", page_id: goal, last_edited: "2026-12-10T08:00:00Z", properties: { Name: "Grow Acme", Summary: null, Lifecycle: null, "Brain ID": null, Why: "Biggest client", Deadline: { start: "2027-03-31", end: null }, Area: [area] } },
    { database: "projects", page_id: project, last_edited: "2026-12-10T08:00:00Z", properties: { Name: "Acme portal", Summary: null, Lifecycle: null, "Brain ID": null, "Key Facts": null, Area: [area], Goal: [goal], Client: [acme], People: [] } },
    { database: "people", page_id: person, last_edited: "2026-12-10T08:00:00Z", properties: { Name: "Ines Ortega", Summary: null, Lifecycle: null, "Brain ID": null, Role: "Engineer", Org: [acme] } },
  ];
  // One sync: plan, apply, render, write to the simulated Notion, record. Returns the plan.
  const cycle = async (n: number) => {
    const plan = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, `snapshot${n}.json`, { as_of: NOW, rows }), "--json"]);
    assert.equal(plan.code, 0, plan.stdout);
    const planPath = await input(dir, `plan${n}.json`, plan.json.data);
    const apply = await brain(["sync", "apply", "--brain", dir, "--now", NOW, "--input", planPath, "--json"]);
    assert.equal(apply.code, 0, apply.stdout);
    const render = await brain(["sync", "render", "--brain", dir, "--now", NOW, "--changed", "--plan", planPath, "--json"]);
    const items = render.json.data.items.filter((item: { page_id: string }) => rows.some((row) => row.page_id === item.page_id));
    for (const item of items) {
      const row = rows.find((entry) => entry.page_id === item.page_id)!;
      for (const [name, encoded] of Object.entries(item.properties as Record<string, { type: string; value: unknown }>)) {
        if (name === "Last Synced") continue;
        row.properties[name] = encoded.type === "relation" ? [...(encoded.value as string[])].sort() : encoded.value === "" ? null : encoded.value;
      }
    }
    const records = items.map((item: { id: string; page_id: string; published: unknown }) => ({ id: item.id, notion: item.page_id, synced_at: NOW, published: item.published }));
    await brain(["sync", "record", "--brain", dir, "--now", NOW, "--input", await input(dir, `record${n}.json`, { records }), "--json"]);
    return { plan: plan.json.data, items };
  };
  await cycle(1);
  const second = await cycle(2);
  assert.deepEqual({ corrections: second.plan.corrections, conflicts: second.plan.conflicts, updates: second.plan.updates }, { corrections: [], conflicts: [], updates: [] });
  assert.deepEqual(second.items.map((item: { id: string; properties: Record<string, unknown> }) => [item.id, Object.keys(item.properties)]), []);
  rows[1]!.properties.Client = [];
  rows[2]!.properties.Role = "Lead engineer";
  const edits = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot-edits.json", { as_of: NOW, rows }), "--json"]);
  assert.deepEqual(edits.json.data.conflicts, []);
  assert.deepEqual(edits.json.data.corrections.map((item: { field: string; value: unknown }) => [item.field, item.value]), [["client", null], ["facts.role", "Lead engineer"]]);
});

test("sync keeps unpublished links and reports invalid Notion values before comparing", async (context) => {
  const dir = await fixtureCopy(context);
  const projectPage = "2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e";
  const decisionPage = "10000000-0000-4000-8000-0000000000d1";
  const edit = async (path: string, change: (attributes: Record<string, unknown>) => void) => {
    const file = join(dir, path); const document = parseFrontmatter(await readFile(file, "utf8"));
    change(document.attributes); await writeFile(file, serializeFrontmatter(document));
  };
  // Carlos (per-9t2c6m4a) is on the project but has no Notion page; Maria is published.
  await edit("projects/acme-website/project.md", (a) => { a.notion_published = { People: [MARIA_PAGE], Summary: a.summary, Lifecycle: "Draft" }; });
  await edit("knowledge/decisions/2026-12-03-use-supabase-for-auth.md", (a) => { a.notion = decisionPage; a.notion_published = { Assessment: "Accepted" }; });
  const plan = async (name: string, rows: unknown[]) => (await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, name, { as_of: NOW, rows }), "--json"])).json.data;
  const project = (properties: Record<string, unknown>) => ({ database: "projects", page_id: projectPage, last_edited: "2026-12-10T08:00:00Z", properties: { "Brain ID": "prj-9x4t1b7e", ...properties } });
  const codes = (data: { conflicts: Array<{ code: string; property: string }>; ignored: Array<{ reason: string; property: string }>; corrections: unknown[] }) => [data.conflicts.map((item) => [item.code, item.property]), data.ignored.map((item) => [item.reason, item.property]), data.corrections];

  assert.deepEqual(codes(await plan("people.json", [project({ People: [] })])), [[["BOTH_CHANGED", "People"]], [], []]);
  assert.deepEqual(codes(await plan("empty.json", [project({ Summary: "" })])), [[["REQUIRED_EMPTY", "Summary"]], [], []]);
  // A space that still has Lifecycle on Projects: the brain ignores it there (0070).
  assert.deepEqual(codes(await plan("unknown.json", [project({ Lifecycle: "Foo" })])).flat(), []);
  assert.deepEqual(codes(await plan("stale.json", [project({ Lifecycle: null })])).flat(), []);
  const decision = { database: "decisions", page_id: decisionPage, last_edited: "2026-12-10T08:00:00Z", properties: { "Brain ID": "dec-7k2m9q4x", Assessment: null } };
  assert.deepEqual(codes(await plan("assessment.json", [decision])), [[], [["NOT_CORRECTABLE", "Assessment"]], []]);
});

test("Domains, Areas, Goals, Projects and Orgs created in Notion are reviewed and publish no Lifecycle (0070)", async (context) => {
  const dir = await fixtureCopy(context);
  const configPath = join(dir, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.modules = { ...config.modules, domains: true, planning: true };
  config.notion.databases.domains = "a1000000-0000-4000-8000-00000000000d";
  await writeFile(configPath, JSON.stringify(config));
  const area = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";
  const rows = [
    { database: "domains", page_id: page(41), last_edited: NOW, properties: { Name: "Venture", Summary: "Own ventures.", "Brain ID": null, Archived: false } },
    { database: "areas", page_id: page(42), last_edited: NOW, properties: { Name: "Operations", Summary: "Running the company.", "Brain ID": null, Archived: false } },
    { database: "goals", page_id: page(43), last_edited: NOW, properties: { Name: "Grow", Summary: "Grow.", "Brain ID": null, Why: "Runway", Area: [area], Archived: false } },
    { database: "projects", page_id: page(44), last_edited: NOW, properties: { Name: "Portal", Summary: "A portal.", "Brain ID": null, Area: [area], Archived: false } },
    { database: "orgs", page_id: page(45), last_edited: NOW, properties: { Name: "Globex", Summary: "A prospect.", "Brain ID": null, Relationship: "Prospect", Archived: true } },
    { database: "people", page_id: page(46), last_edited: NOW, properties: { Name: "Ines Ortega", Summary: "An engineer.", Lifecycle: null, "Brain ID": null } },
  ];
  const plan = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot.json", { as_of: NOW, rows }), "--json"]);
  assert.equal(plan.code, 0, plan.stdout);
  assert.deepEqual(plan.json.data.create.map((item: { type: string; lifecycle: string }) => [item.type, item.lifecycle]).sort(),
    [["area", "reviewed"], ["domain", "reviewed"], ["goal", "reviewed"], ["org", "reviewed"], ["person", "draft"], ["project", "reviewed"]]);
  assert.equal(plan.json.data.create.find((item: { type: string }) => item.type === "org").frontmatter.notion_fields.archived, true);
  const planPath = await input(dir, "plan.json", plan.json.data);
  assert.equal((await brain(["sync", "apply", "--brain", dir, "--now", NOW, "--input", planPath, "--json"])).code, 0);
  const render = await brain(["sync", "render", "--brain", dir, "--now", NOW, "--changed", "--plan", planPath, "--json"]);
  const pages = new Set(rows.map((row) => row.page_id));
  const published = Object.fromEntries(render.json.data.items.filter((item: { page_id: string }) => pages.has(item.page_id)).map((item: { type: string; published: Record<string, unknown> }) => [item.type, Object.hasOwn(item.published, "Lifecycle")]));
  assert.deepEqual(published, { area: false, domain: false, goal: false, org: false, person: true, project: false });
  assert.equal((await brain(["lint", "--brain", dir, "--json"])).json.data.errors, 0);
});

test("a project the brain retires ticks Archived once, and Archived stays yours afterwards (0070)", async (context) => {
  const dir = await fixtureCopy(context);
  const path = join(dir, "projects/acme-website/project.md");
  const document = parseFrontmatter(await readFile(path, "utf8"));
  document.attributes.lifecycle = "archived";
  await writeFile(path, serializeFrontmatter(document));
  const render = async () => (await brain(["sync", "render", "--brain", dir, "--ids", "prj-9x4t1b7e", "--now", NOW, "--json"])).json.data.items[0];
  const first = await render();
  assert.deepEqual(first.properties.Archived, { type: "checkbox", value: true });
  assert.equal(Object.hasOwn(first.properties, "Lifecycle"), false);
  const record = await brain(["sync", "record", "--brain", dir, "--now", NOW, "--input", await input(dir, "record.json", { records: [{ id: "prj-9x4t1b7e", notion: first.page_id, synced_at: NOW, published: first.published }] }), "--json"]);
  assert.equal(record.code, 0, record.stdout);
  const settled = await render();
  assert.ok(settled === undefined || !Object.hasOwn(settled.properties, "Archived"));
  // You untick it in Notion: the next sync pulls archived false, and the brain doesn't tick it again.
  const unticked = parseFrontmatter(await readFile(path, "utf8"));
  unticked.attributes.notion_fields = { ...(unticked.attributes.notion_fields as Record<string, unknown>), archived: false };
  await writeFile(path, serializeFrontmatter(unticked));
  const after = await render();
  assert.ok(after === undefined || !Object.hasOwn(after.properties, "Archived"));
});

test("note new writes a project as reviewed and a person as draft (0070)", async (context) => {
  const dir = await fixtureCopy(context);
  const notes = [
    { type: "project", id: "prj-4d6f8h2k", title: "Intranet", frontmatter: { summary: "An intranet.", area: "area-2m7c4h8n" }, body: "" },
    { type: "person", id: "per-5g7h9j3k", title: "Dee Ortiz", frontmatter: { summary: "A designer." }, body: "" },
  ];
  const run = await brain(["note", "new", "--brain", dir, "--now", NOW, "--input", await input(dir, "notes.json", { notes }), "--json"]);
  assert.equal(run.code, 0, run.stdout);
  const lifecycle = async (file: string) => parseFrontmatter(await readFile(join(dir, file), "utf8")).attributes.lifecycle;
  const [project, person] = run.json.data.created.map((item: { path: string }) => item.path);
  assert.deepEqual([await lifecycle(project), await lifecycle(person)], ["reviewed", "draft"]);
});
