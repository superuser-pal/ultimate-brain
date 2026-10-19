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

test("sync plan reports an Edit on an add_link review as a conflict", async (context) => {
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
  const snapshot = { as_of: NOW, rows: [linkProposal, supersedeProposal].map((proposal, index) => ({
    database: "review", page_id: `10000000-0000-4000-8000-0000000000e${index}`, last_edited: "2026-12-10T08:00:00Z", properties: {
      "Brain ID": proposal, Decision: "Edit", "Edited Value": "Product manager", State: "Pending",
    },
  })) };

  const planned = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot-link-edit.json", snapshot), "--json"]);
  assert.equal(planned.code, 0, planned.stdout);
  assert.deepEqual(planned.json.data.decisions, []);
  assert.deepEqual(planned.json.data.conflicts.map((item: { code: string; brain_id: string; property: string }) => [item.code, item.brain_id, item.property]), [
    ["EDIT_NOT_ALLOWED", linkProposal, "Decision"],
    ["EDIT_NOT_ALLOWED", supersedeProposal, "Decision"],
  ]);

  const applied = await brain(["sync", "apply", "--brain", dir, "--now", NOW, "--input", await input(dir, "link-edit-plan.json", planned.json.data), "--json"]);
  assert.equal(applied.code, 0, applied.stdout);
  assert.deepEqual(applied.json.data.decisions, []);
  assert.deepEqual(applied.json.data.conflicts.map((item: { code: string }) => item.code), ["EDIT_NOT_ALLOWED", "EDIT_NOT_ALLOWED"]);
});

test("sync accepts fractional-second timestamps and stores seconds precision", async (context) => {
  const dir = await fixtureCopy(context);
  const snapshot = { as_of: "2026-12-10T09:00:00.000Z", rows: [{ database: "people", page_id: MARIA_PAGE, last_edited: "2026-12-10T08:00:00.123Z", properties: { "Brain ID": MARIA } }] };
  const run = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "fractional-timestamps.json", snapshot), "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.equal(run.json.data.as_of, NOW);
});

test("sync render rejects a project that was not created in Notion", async (context) => {
  const dir = await fixtureCopy(context);
  const projectPath = join(dir, "projects/acme-website/project.md");
  const project = await readFile(projectPath, "utf8");
  await writeFile(projectPath, project.replace("notion: 2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e\n", ""));

  const run = await brain(["sync", "render", "--brain", dir, "--ids", "prj-9x4t1b7e", "--json"]);
  assert.equal(run.code, 1, run.stdout);
  assert.deepEqual(run.json.data.items, []);
  assert.deepEqual(run.json.data.errors, [{ id: "prj-9x4t1b7e", reason: "PROJECT_NOT_IN_NOTION" }]);
});

test("sync render derives decision and question Areas from their projects", async (context) => {
  const dir = await fixtureCopy(context);
  const secondArea = "area-3m7c4h8n";
  const secondProject = "prj-3x4t1b7e";
  const noAreaProject = "prj-4x4t1b7e";
  const secondAreaPage = "11111111-0000-4000-8000-000000000001";
  const secondProjectPage = "11111111-0000-4000-8000-000000000002";
  const noAreaProjectPage = "11111111-0000-4000-8000-000000000003";
  const existingArea = await readFile(join(dir, "areas/clients.md"), "utf8");
  const existingProject = await readFile(join(dir, "projects/acme-website/project.md"), "utf8");
  await writeFile(join(dir, "areas/second-client.md"), existingArea
    .replace("area-2m7c4h8n", secondArea).replace("title: Clients", "title: Second client")
    .replaceAll("1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d", secondAreaPage));
  await mkdir(join(dir, "projects/second-client"));
  await writeFile(join(dir, "projects/second-client/project.md"), existingProject
    .replace("prj-9x4t1b7e", secondProject).replace("title: Acme website", "title: Second project")
    .replace("area: area-2m7c4h8n", `area: ${secondArea}`).replace("2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d", secondProjectPage));
  await mkdir(join(dir, "projects/no-area"));
  await writeFile(join(dir, "projects/no-area/project.md"), existingProject
    .replace("prj-9x4t1b7e", noAreaProject).replace("title: Acme website", "title: No-area project")
    .replace("area: area-2m7c4h8n\n", "").replace("2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d", noAreaProjectPage));

  const decisionPath = join(dir, "knowledge/decisions/2026-12-03-use-supabase-for-auth.md");
  await writeFile(decisionPath, (await readFile(decisionPath, "utf8"))
    .replace("area: area-2m7c4h8n\n", "").replace("projects: [prj-9x4t1b7e]", `projects: [prj-9x4t1b7e, ${secondProject}]`));
  const questionPath = join(dir, "knowledge/questions/who-owns-the-acme-mobile-app.md");
  await writeFile(questionPath, (await readFile(questionPath, "utf8"))
    .replace("area: area-2m7c4h8n\n", "").replace("projects: [prj-9x4t1b7e]", `projects: [${noAreaProject}]`));

  const run = await brain(["sync", "render", "--brain", dir, "--ids", `dec-7k2m9q4x,que-8n3v5x1d`, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  const byId = new Map<string, { properties: Record<string, unknown> }>(run.json.data.items.map((item: { id: string; properties: Record<string, unknown> }) => [item.id, item]));
  assert.deepEqual(byId.get("dec-7k2m9q4x")?.properties.Area, { type: "relation", value: ["1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d", secondAreaPage] });
  assert.deepEqual(byId.get("que-8n3v5x1d")?.properties.Area, { type: "relation", value: [] });
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
  assert.equal(properties.Before.value, null);
  assert.equal(properties.After.value, "People: Carlos Ruiz");
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
  assert.equal(properties.After.value, "Read X file and Use Supabase for auth.");
  assert.equal(properties.Why.value, "See X file.");
  assert.equal(properties.Before.value, null);
  assert.doesNotMatch(properties.After.value, /notion\.so|\[[^\]]+\]\([^)]+\)/);
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
  assert.equal(byId.get("prp-0a1b2c3d")!.Before.value, "Use Firebase for auth");
  assert.equal(byId.get("prp-1a1b2c3d")!.Before.value, "Carlos Ruiz");
  assert.equal((byId.get("prp-2a1b2c3d")!.After.value as string).length, 2000);
});

test("sync publishes the brain's values for a Notion-created row whose brain-owned properties are empty", async (context) => {
  const dir = await fixtureCopy(context);
  const page = "10000000-0000-4000-8000-0000000000aa";
  const row = { database: "areas", page_id: page, last_edited: "2026-12-10T08:00:00Z", properties: { Name: "Initech", Summary: null, Lifecycle: null, "Brain ID": null, Archived: false } };
  const plan = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot.json", { as_of: NOW, rows: [row] }), "--json"]);
  assert.equal(plan.code, 0, plan.stdout);
  const planPath = await input(dir, "plan.json", plan.json.data);
  const apply = await brain(["sync", "apply", "--brain", dir, "--now", NOW, "--input", planPath, "--json"]);
  assert.equal(apply.code, 0, apply.stdout);
  const id = apply.json.data.create[0].id;
  const render = await brain(["sync", "render", "--brain", dir, "--now", NOW, "--changed", "--plan", planPath, "--json"]);
  const item = render.json.data.items.find((entry: { id: string }) => entry.id === id);
  assert.equal(item.properties.Summary.value, "Initech");
  assert.equal(item.properties.Lifecycle.value, "Draft");
  const record = await brain(["sync", "record", "--brain", dir, "--now", NOW, "--input", await input(dir, "record.json", { records: [{ id, notion: page, synced_at: NOW, published: item.published }] }), "--json"]);
  assert.equal(record.code, 0, record.stdout);
  const published = { ...row, properties: { ...row.properties, Summary: "Initech", Lifecycle: "Draft", "Brain ID": id } };
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
  const row = { database: "areas", page_id: page, last_edited: "2026-12-10T08:00:00Z", properties: { Name: "Initech", Summary: null, Lifecycle: null, "Brain ID": null, Archived: false } };
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
  const cleared = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot3.json", { as_of: NOW, rows: [{ ...row, properties: { ...row.properties, Summary: null, Lifecycle: null, Archived: true } }] }), "--json"]);
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
  assert.deepEqual(codes(await plan("empty.json", [project({ Lifecycle: null, Summary: "" })])), [[["REQUIRED_EMPTY", "Lifecycle"], ["REQUIRED_EMPTY", "Summary"]], [], []]);
  assert.deepEqual(codes(await plan("unknown.json", [project({ Lifecycle: "Foo" })])), [[], [["UNKNOWN_OPTION", "Lifecycle"]], []]);
  assert.deepEqual(codes(await plan("case.json", [project({ Lifecycle: "draft" })])).flat(), []);
  const decision = { database: "decisions", page_id: decisionPage, last_edited: "2026-12-10T08:00:00Z", properties: { "Brain ID": "dec-7k2m9q4x", Assessment: null } };
  assert.deepEqual(codes(await plan("assessment.json", [decision])), [[], [["NOT_CORRECTABLE", "Assessment"]], []]);
});
