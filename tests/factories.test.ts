// `brain factory`, the Factories module, the rows and the link back (CC-397; spec/cli.md §5.12, §5.14.4, §5.14.6, §5.15, §5.16, §5.20,
// §5.29, §5.39; spec/linked-repos.md §1.1; spec/connected-workflows.md §9.1; spec/schema.md §12; decision 0113 §1, §4, §6).
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";
import { promisify } from "node:util";

import { blockOf, aroundBlock } from "./upgrade-0-12-fixture.ts";
import { committedFixture, tempRepo } from "./fixture-templates.ts";
import { brain, testPackageRoot } from "./helpers.ts";
import { run as product } from "./skills-fixtures.ts";

const exec = promisify(execFile);
const NOW = "2026-12-10T09:00:00Z";
const AREA = "area-2m7c4h8n";
const PROJECT = "prj-9x4t1b7e";
const SECOND = "prj-4k2r8m6t";
const DATABASE = "a1000000-0000-4000-8000-0000000000fa";
const AREA_PAGE = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";
const PAGE = "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b";
const FAC = /^fac-[0-9abcdefghjkmnpqrstvwxyz]{8}$/;
const STATUS_MAP = { todo: "To Do", in_progress: "Doing", waiting: "Waiting On", review: "Doing", done: "Done", dropped: "Won't Do" };
const sha = (text: string) => `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;

type Run = Awaited<ReturnType<typeof brain>>;
interface Setup { modules?: Record<string, boolean>; repos?: unknown[]; factories?: unknown[]; database?: string; asked?: boolean }

/** A committed brain with Factories on (unless `modules` says otherwise). */
async function setup(context: TestContext, options: Setup = {}) {
  const dir = await committedFixture(context, { message: "factories", edit: (config) => {
    config.modules = { domains: false, orgs: true, documents: true, reports: true, tasks: true, planning: true, ...(options.asked === false ? {} : { factories: true }), ...options.modules };
    config.notion.databases.factories = options.database ?? DATABASE;
    config.notion.tasks.properties.factory = "Factory";
    if (options.repos !== undefined) config.repos = options.repos;
    if (options.factories !== undefined) config.factories = options.factories;
  } });
  const call = (args: string[], now = NOW): Promise<Run> => brain([...args, "--brain", dir, "--now", now, "--json"]);
  const ok = async (args: string[], now = NOW) => {
    const result = await call(args, now);
    assert.equal(result.code, 0, `${args.join(" ")}: ${result.stdout}`);
    return result.json.data;
  };
  let counter = 0;
  const file = async (value: unknown) => {
    const path = join(dirname(dir), `input-${counter++}.json`);
    await writeFile(path, typeof value === "string" ? value : JSON.stringify(value));
    return path;
  };
  const config = async () => JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  const git = async (...args: string[]) => (await exec("git", ["-C", dir, ...args])).stdout.trim();
  const commitBrain = async () => { await git("add", "-A"); await git("commit", "-q", "--allow-empty", "-m", "test"); };
  const addProject = async (id: string, area = AREA) => {
    await mkdir(join(dir, "projects", id), { recursive: true });
    await writeFile(join(dir, "projects", id, "project.md"), `---\nid: ${id}\ntype: project\ntitle: Project ${id}\nsummary: One more project.\nlifecycle: reviewed\narea: ${area}\nsources: [notion:2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e]\ncreated: 2026-09-15\nupdated: 2026-09-15\nnotion_fields:\n  as_of: 2026-12-05T08:31:00Z\n  state: Active\n---\n\nOne more project.\n`);
  };
  return { dir, call, ok, file, config, git, commitBrain, addProject, log: () => readFile(join(dir, "log/2026-12.md"), "utf8") };
}

async function folder(context: TestContext): Promise<string> {
  const path = await realpath(await mkdtemp(join(tmpdir(), "brain-factory-")));
  context.after(() => rm(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  return path;
}

const kitOf = (over: Record<string, unknown> = {}) => ({
  kit_version: 1, name: "acme-api", placement: { area: AREA, projects: [PROJECT] }, knowledge: { patterns: ["decisions/**"], never_read: ["secrets/**"] },
  tasks: { mode: "tracked-in-repo", source: { kind: "markdown", path: "TASKS.md", format: "checklist" } }, methodology: { summary: "Small PRs." }, ...over,
});

/** A repo with its kit committed, linked with `repo add --kit`. */
async function linkedRepo(context: TestContext, c: Awaited<ReturnType<typeof setup>>, options: { kit?: any; files?: Record<string, string> } = {}) {
  const repo = await tempRepo(context);
  const kit = options.kit ?? kitOf();
  await repo.commit("2026-11-01T10:00:00Z", { "decisions/0001-one.md": "# One\n", "TASKS.md": "- [ ] Ship it\n", ...options.files, "brain-kit.json": `${JSON.stringify(kit, null, 2)}\n` });
  const data = await c.ok(["repo", "add", kit.name, "--path", repo.root, "--kit"]);
  return { repo, data, kit };
}

const plain = async (context: TestContext, c: Awaited<ReturnType<typeof setup>>, extra: string[] = []) => {
  const path = await folder(context);
  const entry = await c.ok(["factory", "add", "--path", path, "--name", "Workshop kit", "--area", AREA, ...extra]);
  return { path, id: entry.id as string, entry };
};

/** A workflow on the Factory: its record is what `open` reads, so nothing else is needed. */
async function connect(c: Awaited<ReturnType<typeof setup>>, id: string, path: string): Promise<string> {
  await c.commitBrain();
  return (await c.ok(["workflow", "new", "--input", await c.file({ folder_path: path, opted_in: { statement: "Connect it" }, destination: { factory: id }, settings: { work_type: "general", logging: "tasks_only", custom: [] }, status_map: STATUS_MAP })])).id;
}

// ---------------------------------------------------------------- the module (cli §5.20, linked-repos §1.1)

test("modules: factories is off by default; `asked` is false until it is answered; missing names the database and tasks.factory", async (context) => {
  const c = await setup(context, { asked: false, database: "" });
  const config = await c.config();
  delete config.notion.tasks.properties.factory;
  await writeFile(join(c.dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  const item = (await c.ok(["modules"])).modules.find((module: { name: string }) => module.name === "factories");
  assert.deepEqual(item, { name: "factories", on: false, default: false, databases: ["factories"], missing: ["factories", "tasks.factory"], asked: false });
  config.modules.tasks = false;
  await writeFile(join(c.dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  assert.deepEqual((await c.ok(["modules"])).modules.find((module: { name: string }) => module.name === "factories").missing, ["factories"], "with Tasks off there is no relation to map");
});

test("modules off factories records the first no, though it was off, and a second one changes nothing", async (context) => {
  const c = await setup(context, { asked: false });
  const first = await c.ok(["modules", "off", "factories"]);
  assert.deepEqual([first.on, first.changed], [false, true]);
  assert.equal((await c.config()).modules.factories, false);
  assert.match(await c.log(), /modules - "factories" state=off\n$/);
  assert.equal((await c.ok(["modules", "off", "factories"])).changed, false);
  assert.equal((await c.ok(["modules"])).modules.at(-1).asked, true);
});

test("turning another module on or off leaves factories unasked", async (context) => {
  const c = await setup(context, { asked: false });
  await c.ok(["modules", "off", "planning"]);
  assert.equal(Object.hasOwn((await c.config()).modules, "factories"), false);
});

test("modules on factories gives each repos entry a Factory, in repos order; again it makes only the missing ones", async (context) => {
  const c = await setup(context, { asked: false, repos: [
    { name: "acme-web", path: "/work/acme-web", area: AREA, patterns: ["*.md"], commit: "" },
    { name: "acme-api", path: "/work/acme-api", area: AREA, project: PROJECT, patterns: ["*.md"], commit: "" },
  ] });
  const on = await c.ok(["modules", "on", "factories"]);
  const entries = (await c.config()).factories;
  assert.deepEqual(entries.map(({ id: _id, ...entry }: any) => entry), [{ name: "acme-web", repo: "acme-web" }, { name: "acme-api", repo: "acme-api" }]);
  assert.ok(entries.every((entry: { id: string }) => FAC.test(entry.id)));
  assert.deepEqual([on.changed, on.factories], [true, entries.map((entry: { id: string }) => entry.id)]);
  const again = await c.ok(["modules", "on", "factories"]);
  assert.deepEqual([again.changed, again.factories], [false, []]);
  const config = await c.config();
  await writeFile(join(c.dir, "brain.json"), `${JSON.stringify({ ...config, factories: [entries[1]] }, null, 2)}\n`);
  const missing = await c.ok(["modules", "on", "factories"]);
  assert.equal(missing.factories.length, 1);
  assert.deepEqual((await c.config()).factories.map((entry: { repo: string }) => entry.repo), ["acme-api", "acme-web"]);
  // A 0.17.0 entry's `project` is read as a list of one.
  assert.deepEqual((await c.ok(["factory", "list"])).factories.map((entry: any) => [entry.repo, entry.area, entry.projects]), [["acme-api", AREA, [PROJECT]], ["acme-web", AREA, []]]);
});

test("off factories deletes no entry, and every factory command but list refuses with MODULE_OFF", async (context) => {
  const c = await setup(context);
  const { path, id } = await plain(context, c);
  await c.ok(["modules", "off", "factories"]);
  assert.equal((await c.config()).factories.length, 1);
  assert.equal((await c.ok(["factory", "list"])).factories.length, 1);
  const input = await c.file({ by: "session", plan: null });
  for (const args of [["factory", "add", "--path", path, "--name", "x", "--area", AREA], ["factory", "set", id, "--name", "x"], ["factory", "archive", id], ["factory", "read", id], ["factory", "overview", id, "--input", input]]) {
    const result = await c.call(args);
    assert.equal(result.json.error?.code, "MODULE_OFF", args.join(" "));
  }
});

test("status reports the factories database only with the module on", async (context) => {
  const c = await setup(context, { database: "" });
  assert.equal((await c.ok(["status"])).notion.missing.includes("factories"), true);
  await c.ok(["modules", "off", "factories"]);
  const { notion } = await c.ok(["status"]);
  assert.equal([...notion.missing, ...notion.configured].includes("factories"), false);
});

// ---------------------------------------------------------------- the entries (schema §12)

test("brain lint: factory-record names each broken check, and a command that reads the entries refuses with BRAIN_CONFIG_INVALID", async (context) => {
  const base = { id: "fac-7k2m9q4x", name: "Workshop kit", path: "/work/kit", area: AREA, projects: [] };
  const cases: Array<[string, unknown[]]> = [
    ["repeats the name", [base, { ...base, id: "fac-3n6q8v2b", name: "workshop KIT", path: "/work/other" }]],
    ["repeats the path", [base, { ...base, id: "fac-3n6q8v2b", name: "Other" }]],
    ["repeats the id", [base, { ...base, name: "Other", path: "/work/other" }]],
    ["isn't linked", [{ id: "fac-7k2m9q4x", name: "acme-api", repo: "acme-api" }]],
    ["the Area", [{ ...base, area: "area-00000000" }]],
    ["the Project", [{ ...base, projects: ["prj-00000000"] }]],
  ];
  for (const [words, factories] of cases) {
    const c = await setup(context, { factories });
    const lint = await c.call(["lint"]);
    const found = lint.json.data.issues.filter((issue: { rule: string }) => issue.rule === "factory-record");
    assert.equal(found.length, 1, `${words}: ${JSON.stringify(found)}`);
    assert.ok(found[0].message.includes(words), found[0].message);
    const listed = await c.call(["factory", "list"]);
    assert.equal(listed.json.error?.code, "BRAIN_CONFIG_INVALID", words);
  }
  const clean = await setup(context, { factories: [base, { id: "fac-3n6q8v2b", name: "acme-api", repo: "acme-api", archived: true, area: AREA, projects: [PROJECT] }] });
  assert.deepEqual((await clean.call(["lint"])).json.data.issues.filter((issue: { rule: string }) => issue.rule === "factory-record"), [], "an archived entry's repo may be unlinked");
});

test("brain lint: a workflow that isn't ended whose Factory is no entry is named", async (context) => {
  const c = await setup(context);
  const { path, id } = await plain(context, c);
  await connect(c, id, path);
  const config = await c.config();
  await writeFile(join(c.dir, "brain.json"), `${JSON.stringify({ ...config, factories: [] }, null, 2)}\n`);
  const found = (await c.call(["lint"])).json.data.issues.filter((issue: { rule: string }) => issue.rule === "factory-record");
  assert.equal(found.length, 1);
  assert.ok(found[0].message.includes(id), found[0].message);
});

test("brain id new doesn't mint a fac id: entries get theirs from the commands", async (context) => {
  const c = await setup(context);
  assert.notEqual((await c.call(["id", "new", "fac"])).code, 0);
});

// ---------------------------------------------------------------- repo add, refresh, show, unlink (§5.16, §5.29, §5.30)

test("repo add makes the repo's Factory with the module on, and none with it off", async (context) => {
  const c = await setup(context);
  const { data } = await linkedRepo(context, c);
  const [entry] = (await c.config()).factories;
  assert.deepEqual({ ...entry, id: "x" }, { id: "x", name: "acme-api", repo: "acme-api" });
  assert.equal(data.factory, entry.id);
  const off = await setup(context, { modules: { factories: false } });
  const plainLink = await linkedRepo(context, off);
  assert.equal(Object.hasOwn(await off.config(), "factories"), false);
  assert.equal(plainLink.data.factory ?? null, null);
});

test("repo add: a name another entry has gets -2, -3", async (context) => {
  const c = await setup(context, { factories: [{ id: "fac-7k2m9q4x", name: "ACME-api", path: "/work/one", area: AREA, projects: [] }, { id: "fac-3n6q8v2b", name: "acme-api-2", path: "/work/two", area: AREA, projects: [] }] });
  const { data } = await linkedRepo(context, c);
  assert.equal((await c.config()).factories.find((entry: { id: string }) => entry.id === data.factory).name, "acme-api-3");
});

test("a folder connected first and linked later keeps its id; unlinking archives its entry with its Area and Projects; linking again is the same one", async (context) => {
  const c = await setup(context);
  const repo = await tempRepo(context);
  const root = await realpath(repo.root);
  await repo.commit("2026-11-01T10:00:00Z", { "TASKS.md": "- [ ] Ship it\n", "brain-kit.json": `${JSON.stringify(kitOf(), null, 2)}\n` });
  const added = await c.ok(["factory", "add", "--path", root, "--name", "API", "--area", AREA, "--plan", "PLAN.md"]);
  const linked = await c.ok(["repo", "add", "acme-api", "--path", root, "--kit"]);
  assert.equal(linked.factory, added.id);
  assert.deepEqual((await c.config()).factories, [{ id: added.id, name: "API", repo: "acme-api" }]);

  const unlinked = await c.ok(["repo", "unlink", "acme-api"]);
  assert.equal(unlinked.factory, added.id);
  assert.deepEqual((await c.config()).factories, [{ id: added.id, name: "API", repo: "acme-api", area: AREA, projects: [PROJECT], archived: true }]);
  assert.deepEqual((await c.ok(["factory", "list"])).factories[0], { id: added.id, name: "API", repo: "acme-api", area: AREA, projects: [PROJECT], archived: true, workflow: null, overview: null, notion: null });

  const again = await c.ok(["repo", "add", "acme-api", "--path", root, "--kit"]);
  assert.equal(again.factory, added.id);
  assert.deepEqual((await c.config()).factories, [{ id: added.id, name: "API", repo: "acme-api" }]);
});

test("repo unlink archives the Factory with the module off too, and changes nothing else of it", async (context) => {
  const c = await setup(context);
  const { data } = await linkedRepo(context, c);
  const config = await c.config();
  config.factories[0] = { ...config.factories[0], notion: PAGE, published: { Name: "acme-api" }, overview: { as_of: NOW, by: "session", sha256: sha("a"), folder: sha("b"), tasks: sha("c") } };
  config.modules.factories = false;
  await writeFile(join(c.dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  await c.ok(["repo", "unlink", "acme-api"]);
  const [entry] = (await c.config()).factories;
  assert.deepEqual(entry, { ...config.factories[0], id: data.factory, area: AREA, projects: [PROJECT], archived: true });
});

test("repo refresh writes a kit's new Projects, reports placement_changed, and the row's Projects follow it", async (context) => {
  const c = await setup(context);
  await c.addProject(SECOND);
  const { repo } = await linkedRepo(context, c);
  await repo.commit("2026-11-02T10:00:00Z", { "brain-kit.json": `${JSON.stringify(kitOf({ placement: { area: AREA, projects: [SECOND, PROJECT] } }), null, 2)}\n` });
  const data = await c.ok(["repo", "refresh", "acme-api"]);
  assert.deepEqual((await c.config()).repos[0].projects, [SECOND, PROJECT]);
  assert.ok(JSON.stringify(data).includes("placement_changed"));
  assert.deepEqual((await c.ok(["factory", "list"])).factories[0].projects, [SECOND, PROJECT]);
  const changed = await c.ok(["repo", "refresh", "acme-api"]);
  assert.deepEqual((await c.config()).repos[0].projects, [SECOND, PROJECT], JSON.stringify(changed));
});

test("with several Projects the rollup's target is the Area; a kit from 0.17.0 with `project` loads, and its entry stays as it is", async (context) => {
  const c = await setup(context, { modules: { factories: false } });
  await c.addProject(SECOND);
  await linkedRepo(context, c, { kit: kitOf({ placement: { area: AREA, projects: [PROJECT, SECOND] } }) });
  assert.deepEqual((await c.ok(["repo", "tasks", "acme-api"])).target, { area: AREA });

  const old = await setup(context, { modules: { factories: false } });
  const link = await linkedRepo(context, old, { kit: kitOf({ placement: { area: AREA, project: PROJECT } }) });
  const config = await old.config();
  const { projects: _projects, ...entry } = config.repos[0];
  config.repos[0] = { ...entry, project: PROJECT };
  await writeFile(join(old.dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  assert.deepEqual((await old.ok(["repo", "tasks", "acme-api"])).target, { project: PROJECT });
  const health = (await old.ok(["repo", "health", "acme-api"])).repos[0].checks.map((check: { code: string }) => check.code);
  assert.equal(health.some((code: string) => ["KIT_CHANGED", "KIT_INVALID", "PLACEMENT_UNKNOWN"].includes(code)), false, health.join(", "));
  assert.equal((await old.ok(["repo", "refresh", "acme-api"])).changed ?? false, false);
  assert.equal((await old.config()).repos[0].project, PROJECT, "a refresh that writes nothing keeps the 0.17.0 form");
  assert.equal(link.kit.placement.project, PROJECT);
});

test("repo health: PLAN_FILE_MISSING for a plan file that isn't at HEAD; ROLLUP_STALE is skipped with Factories on, and as in 0.17.0 with it off", async (context) => {
  const c = await setup(context);
  const { repo } = await linkedRepo(context, c, { kit: kitOf({ plan: ["docs/roadmap.md"] }) });
  await repo.commit("2026-12-09T10:00:00Z", { "TASKS.md": "- [x] Ship it\n" });
  const checks = async () => (await c.ok(["repo", "health", "acme-api", "--rollup-as-of", "2026-11-04T00:00:00Z"])).repos[0].checks;
  const on = await checks();
  assert.ok(on.some((check: any) => check.code === "PLAN_FILE_MISSING" && check.path === "docs/roadmap.md"), JSON.stringify(on));
  assert.equal(on.some((check: { code: string }) => check.code === "ROLLUP_STALE"), false);
  await c.ok(["modules", "off", "factories"]);
  assert.equal((await checks()).some((check: { code: string }) => check.code === "ROLLUP_STALE"), true);
});

test("repo health: an archived Project of the list is named; .brain is stale only when its Project isn't one of the kit's; a Factory's workflow asks for no mode", async (context) => {
  const c = await setup(context);
  await c.addProject(SECOND);
  const { repo, data } = await linkedRepo(context, c, { kit: kitOf({ placement: { area: AREA, projects: [PROJECT, SECOND] } }) });
  const codes = async () => (await c.ok(["repo", "health", "acme-api"])).repos[0].checks.filter((check: { code: string }) => ["PLACEMENT_ARCHIVED", "BRAIN_LINK_STALE", "WORKFLOW_WITHOUT_CONNECTED"].includes(check.code));
  const brainLink = (value: unknown) => writeFile(join(repo.root, ".brain"), `${JSON.stringify(value, null, 2)}\n`);
  for (const [value, stale] of [[{ repo: "acme-api", area: AREA }, false], [{ repo: "acme-api", area: AREA, project: SECOND }, false], [{ repo: "acme-api", area: AREA, project: "prj-00000000" }, true], [{ repo: "acme-api", area: "area-00000000" }, true]] as const) {
    await brainLink(value);
    assert.equal((await codes()).some((check: { code: string }) => check.code === "BRAIN_LINK_STALE"), stale, JSON.stringify(value));
  }
  await brainLink({ repo: "acme-api", area: AREA });
  const path = join(c.dir, "projects", SECOND, "project.md");
  await writeFile(path, (await readFile(path, "utf8")).replace("lifecycle: reviewed", "lifecycle: archived"));
  await connect(c, data.factory, repo.root);
  const checks = await codes();
  assert.deepEqual(checks.map((check: { code: string }) => check.code), ["PLACEMENT_ARCHIVED"]);
  assert.ok(checks[0].message.includes(SECOND));
});

test("repo show names the Factory and its workflow", async (context) => {
  const c = await setup(context);
  const { repo, data } = await linkedRepo(context, c);
  const before = await c.ok(["repo", "show", "acme-api"]);
  assert.deepEqual([before.factory, before.workflow], [{ id: data.factory, name: "acme-api", repo: "acme-api" }, null]);
  const wf = await connect(c, data.factory, repo.root);
  assert.equal((await c.ok(["repo", "show", "acme-api"])).workflow.id, wf);
});

// ---------------------------------------------------------------- factory add, set, archive, list (§5.39)

test("factory add: the entry, its log line, and every refusal", async (context) => {
  const c = await setup(context);
  await c.addProject(SECOND);
  const { path, id, entry } = await plain(context, c, ["--project", PROJECT, "--project", SECOND, "--plan", "PLAN.md"]);
  assert.match(id, FAC);
  assert.deepEqual(entry, { id, name: "Workshop kit", path, area: AREA, projects: [PROJECT, SECOND], plan: ["PLAN.md"], reused: false });
  assert.match(await c.log(), /factory-add - "Workshop kit"/);
  const other = await folder(context);
  await mkdir(join(c.dir, "inside"), { recursive: true });
  const { repo } = await linkedRepo(context, c);
  const add = (at: string, name: string, extra: string[] = [], area = AREA) => c.call(["factory", "add", "--path", at, "--name", name, "--area", area, ...extra]);
  const refusals: Array<[string, Promise<Run>]> = [
    ["INPUT_INVALID", add("relative/path", "A")],
    ["INPUT_INVALID", add(join(other, "missing"), "A")],
    ["REPO_IS_BRAIN", add(c.dir, "A")],
    ["REPO_IS_BRAIN", add(join(c.dir, "inside"), "A")],
    ["OUTSIDE_ROOT", add(join(import.meta.dirname, ".."), "A")],
    ["UNKNOWN_ID", add(other, "A", [], "area-00000000")],
    ["UNKNOWN_ID", add(other, "A", ["--project", "prj-00000000"])],
    ["INPUT_INVALID", add(other, "A", ["--plan", "../PLAN.md"])],
    ["FACTORY_EXISTS", add(repo.root, "A")],
    ["FACTORY_EXISTS", add(path, "A")],
    ["FACTORY_EXISTS", add(other, "workshop KIT ")],
    ["USAGE", c.call(["factory", "add", "--path", other, "--name", "A"])],
  ];
  for (const [code, result] of refusals) assert.equal((await result).json.error?.code, code, (await result).stdout);
  const taken = await add(other, "workshop kit");
  assert.ok(taken.json.error.message.includes("Workshop kit"), "the message names it");
});

test("factory add: an archived entry of the same folder is the same Factory again, with the given values", async (context) => {
  const c = await setup(context);
  const { path, id } = await plain(context, c, ["--project", PROJECT, "--plan", "PLAN.md"]);
  assert.equal((await c.ok(["factory", "archive", id])).archived, true);
  const again = await c.ok(["factory", "add", "--path", path, "--name", "Kit", "--area", AREA]);
  assert.deepEqual(again, { id, name: "Kit", path, area: AREA, projects: [], reused: true });
  assert.equal((await c.config()).factories.length, 1);
});

test("factory set: a plain folder's values, a given list replacing the whole one; a linked repo's name only", async (context) => {
  const c = await setup(context);
  const { id, path } = await plain(context, c, ["--project", PROJECT, "--plan", "PLAN.md"]);
  const moved = await folder(context);
  const set = await c.ok(["factory", "set", id, "--path", moved, "--no-projects", "--plan", "TODO.md", "--plan", "docs/plan.md"]);
  assert.deepEqual(set, { entry: { id, name: "Workshop kit", path: moved, area: AREA, projects: [], plan: ["TODO.md", "docs/plan.md"] }, changed: true });
  assert.equal((await c.ok(["factory", "set", "workshop KIT", "--no-plan"])).entry.plan, undefined, "found by its name without case");
  assert.equal((await c.ok(["factory", "set", id, "--no-plan"])).changed, false);
  assert.match(await c.log(), /factory-set - "Workshop kit"/);
  const { data } = await linkedRepo(context, c);
  assert.equal((await c.ok(["factory", "set", data.factory, "--name", "The API"])).entry.name, "The API");
  for (const extra of [["--area", AREA], ["--project", PROJECT], ["--plan", "PLAN.md"], ["--path", path], ["--no-projects"], ["--no-plan"]]) assert.equal((await c.call(["factory", "set", data.factory, ...extra])).json.error?.code, "USAGE", extra.join(" "));
  assert.equal((await c.call(["factory", "set", id, "--name", "the api"])).json.error?.code, "FACTORY_EXISTS");
  assert.equal((await c.call(["factory", "set", "nothing", "--name", "x"])).json.error?.code, "FACTORY_NOT_FOUND");
});

test("factory archive: USAGE for a linked repo, DESTINATION_TAKEN with an open workflow, else archived once", async (context) => {
  const c = await setup(context);
  const { data } = await linkedRepo(context, c);
  assert.equal((await c.call(["factory", "archive", data.factory])).json.error?.code, "USAGE");
  const { id, path } = await plain(context, c);
  const wf = await connect(c, id, path);
  assert.equal((await c.call(["factory", "archive", id])).json.error?.code, "DESTINATION_TAKEN");
  assert.deepEqual((await c.ok(["factory", "list"])).factories.find((entry: { id: string }) => entry.id === id).workflow, { id: wf, state: "connected" });
  const second = await folder(context);
  const other = await c.ok(["factory", "add", "--path", second, "--name", "Other", "--area", AREA]);
  assert.equal((await c.ok(["factory", "archive", other.id])).archived, true);
});

// ---------------------------------------------------------------- factory read (§5.39)

test("factory read: a plain folder's plan files on disk, CRLF as LF, links out and folders not found, and no other file", async (context) => {
  const c = await setup(context);
  const { path, id } = await plain(context, c, ["--plan", "PLAN.md", "--plan", "missing.md", "--plan", "docs", "--plan", "binary.md"]);
  await mkdir(join(path, "docs"));
  await writeFile(join(path, "PLAN.md"), "# Plan\r\n- [ ] Print the cards\r\n- [x] Choose the paper\r\n- [/] Draw\r\n- [-] Video\r\n");
  await writeFile(join(path, "binary.md"), new Uint8Array([0xff, 0xfe, 0x80]));
  const data = await c.ok(["factory", "read", id]);
  const text = "# Plan\n- [ ] Print the cards\n- [x] Choose the paper\n- [/] Draw\n- [-] Video\n";
  assert.equal(data.found, true);
  assert.deepEqual([data.plan.where, data.plan.not_found], [["PLAN.md"], ["missing.md", "docs", "binary.md"]]);
  assert.deepEqual(data.plan.files, [{ path: "PLAN.md", text, cut: false }]);
  assert.deepEqual(data.plan.items.map((item: any) => [item.title, item.meaning, item.done_at]).slice(0, 2), [["Print the cards", "todo", null], ["Choose the paper", "done", null]], "a plain folder's tick has no date");
  assert.deepEqual(data.taken, []);
  assert.equal(data.folder, sha(JSON.stringify([["PLAN.md", text], ["missing.md", null], ["docs", null], ["binary.md", null]])));
  assert.equal(data.tasks, sha("[]"));
  assert.equal(data.changed, true, "no overview yet");
  assert.equal(data.factory.id, id);
});

test("factory read: a symbolic link whose real path leaves the folder counts as not found", { skip: process.platform === "win32" ? "making a symbolic link needs a privilege on Windows" : false }, async (context) => {
  const c = await setup(context);
  const { path, id } = await plain(context, c, ["--plan", "PLAN.md", "--plan", "TODO.md"]);
  const outside = await folder(context);
  await writeFile(join(outside, "PLAN.md"), "- [ ] Secret\n");
  await symlink(join(outside, "PLAN.md"), join(path, "PLAN.md"));
  await writeFile(join(path, "real.md"), "- [ ] Mine\n");
  await symlink("real.md", join(path, "TODO.md"));
  const data = await c.ok(["factory", "read", id]);
  assert.deepEqual([data.plan.where, data.plan.not_found], [["TODO.md"], ["PLAN.md"]]);
  assert.equal(JSON.stringify(data).includes("Secret"), false);
});

test("factory read: a linked repo at HEAD, its uncommitted changes named and not read, never_read left out", async (context) => {
  const c = await setup(context);
  const { repo, data: link } = await linkedRepo(context, c, { kit: kitOf({ plan: ["docs/roadmap.md"], knowledge: { patterns: ["decisions/**"], never_read: ["secrets/**"] } }), files: { "docs/roadmap.md": "# Roadmap\n", "TASKS.md": "- [ ] Ship it\n- [x] Plan it\n", "secrets/plan.md": "- [ ] Hidden\n" } });
  await writeFile(join(repo.root, "TASKS.md"), "- [x] Ship it\n");
  const result = await c.call(["factory", "read", link.factory]);
  assert.deepEqual(result.json.warnings.map((warning: any) => [warning.code, warning.path]), [["REPO_DIRTY", "TASKS.md"]]);
  const { plan, folder: before } = result.json.data;
  assert.deepEqual(plan.where, ["docs/roadmap.md", "TASKS.md"]);
  assert.deepEqual(plan.items.map((item: any) => [item.title, item.meaning, item.done_at]), [["Ship it", "todo", null], ["Plan it", "done", "2026-11-01"]]);
  assert.deepEqual([plan.counts.todo, plan.counts.done, plan.percent], [1, 1, 50]);
  await repo.git("checkout", "-q", "--", "TASKS.md");
  await repo.commit("2026-11-03T10:00:00Z", { "src.txt": "no plan\n" });
  assert.equal((await c.ok(["factory", "read", link.factory])).folder, before, "a commit that touches no plan file changes nothing");
  const config = await c.config();
  config.repos[0].never_read = [...config.repos[0].never_read, "docs/**"];
  await writeFile(join(c.dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  assert.deepEqual((await c.ok(["factory", "read", link.factory])).plan.where, ["TASKS.md"]);
});

test("factory read: a repo's issues need --issues, whose closed_at dates the done ones and whose state is in the hash", async (context) => {
  const c = await setup(context);
  const { data: link } = await linkedRepo(context, c, { kit: kitOf({ tasks: { mode: "tracked-in-repo", source: { kind: "github", repo: "acme/acme-api" } } }) });
  assert.equal((await c.call(["factory", "read", link.factory])).json.error?.code, "USAGE");
  const issue = (number: number, title: string, state: string, closed_at: string | null) => ({ number, title, state, ...(state === "closed" ? { state_reason: "completed" } : {}), labels: ["b", "a"], url: `https://github.com/acme/acme-api/issues/${number}`, assignees: [], ...(closed_at === null ? {} : { closed_at }) });
  const input = { source: "github", fetched_at: NOW, items: [issue(2, "Second", "open", null), issue(1, "First", "closed", "2026-12-08T10:00:00Z")] };
  const issues = await c.file(input);
  const read = await c.call(["factory", "read", link.factory, "--issues", issues]);
  assert.equal(read.code, 0, read.stdout);
  assert.deepEqual(read.json.data.plan.where, ["GitHub acme/acme-api"]);
  assert.deepEqual(read.json.data.plan.items.map((item: any) => [item.key, item.meaning, item.done_at]).sort(), [["#1", "done", "2026-12-08"], ["#2", "todo", null]]);
  assert.equal(read.json.data.folder, sha(JSON.stringify([["github:acme/acme-api", [[1, "First", "closed", "completed", ["a", "b"], "2026-12-08T10:00:00Z"], [2, "Second", "open", null, ["a", "b"], null]]]])));
  const bad = await c.file({ ...input, items: [{ ...issue(1, "First", "closed", null), closed_at: "yesterday" }] });
  assert.equal((await c.call(["factory", "read", link.factory, "--issues", bad])).json.error?.code, "INPUT_INVALID");
  const { id } = await plain(context, c);
  assert.equal((await c.call(["factory", "read", id, "--issues", issues])).json.error?.code, "USAGE", "a folder without issues takes none");
});

test("factory read: a missing folder is found false with PATH_MISSING; a linked repo's kit and Git are checked", async (context) => {
  const c = await setup(context);
  const { path, id } = await plain(context, c);
  await rm(path, { recursive: true });
  const gone = await c.call(["factory", "read", id]);
  assert.deepEqual([gone.code, gone.json.data.found, gone.json.data.plan, gone.json.data.changed], [0, false, null, false]);
  assert.deepEqual(gone.json.warnings.map((warning: { code: string }) => warning.code), ["PATH_MISSING"]);
  const { repo, data } = await linkedRepo(context, c);
  await rm(join(repo.root, "brain-kit.json"));
  assert.equal((await c.call(["factory", "read", data.factory])).json.error?.code, "KIT_MISSING");
  await rm(join(repo.root, ".git"), { recursive: true });
  assert.equal((await c.call(["factory", "read", data.factory])).json.error?.code, "REPO_NOT_FOUND");
});

// ---------------------------------------------------------------- factory overview (§5.39, connected-workflows §9.1)

const overviewOf = async (c: Awaited<ReturnType<typeof setup>>, id: string, input: unknown, now = NOW, extra: string[] = []) => c.ok(["factory", "overview", id, "--input", await c.file(input), ...extra], now);

test("factory overview: the normative text, its hash without the date, and nothing written", async (context) => {
  const c = await setup(context);
  const { data: { factory: id } } = await linkedRepo(context, c, { kit: kitOf({ tasks: { mode: "tracked-in-repo", source: { kind: "markdown", path: "TASKS.md", format: "checklist" }, status_map: { "/": "in_progress", "-": "dropped" } } }), files: { "TASKS.md": "- [ ] Print the cards\n- [/] Draw the cards\n- [x] Choose the paper\n- [-] Film a video\n" } });
  await c.commitBrain();
  const data = await overviewOf(c, id, { by: "session", plan: "A card game for workshops.", building_now: ["Tidy the box"], done: [{ text: "Bought the paper", date: "2026-12-09" }, { text: "Too old", date: "2026-11-25" }] });
  const body = [
    "from the last session",
    "Plan: A card game for workshops. Kept in TASKS.md.",
    "Building now: Draw the cards; Tidy the box",
    "Next: Print the cards",
    "Done lately: Bought the paper (9 Dec)",
    "1 completed · 1 dropped · 2 open (1 in progress, 1 to do) · 33%",
  ].join("\n");
  assert.equal(data.markdown, `As of 10 Dec 2026, 09:00 · ${body}\n`);
  assert.deepEqual([data.heading, data.as_of, data.unchanged, data.sha256], ["Overview", NOW, false, sha(`${body}\n`)]);
  assert.equal(await c.git("status", "--porcelain"), "");
  assert.equal((await overviewOf(c, id, { by: "session", plan: "A card game for workshops.", building_now: ["Tidy the box"], done: [{ text: "Bought the paper", date: "2026-12-09" }] }, "2026-12-10T18:00:00Z")).sha256, data.sha256, "only the date differs");
});

test("factory overview: no plan found, the parenthesis only with named files, and lists of five", async (context) => {
  const c = await setup(context);
  const { path, id } = await plain(context, c);
  const bare = await overviewOf(c, id, { by: "catch-up", plan: null });
  assert.equal(bare.markdown, "As of 10 Dec 2026, 09:00 · from the catch-up\nPlan: not found. Say where it is in a session here.\n");
  await c.ok(["factory", "set", id, "--plan", "TASKS.md"]);
  assert.ok((await overviewOf(c, id, { by: "catch-up", plan: null })).markdown.includes("Plan: not found (looked for TASKS.md). Say where it is in a session here."));
  const long = "A".repeat(81);
  await writeFile(join(path, "TASKS.md"), [...[1, 2, 3, 4, 5, 6, 7].map((n) => `- [ ] Item ${n}`), "- [ ] item 1", "- [/] Unmapped"].join("\n"));
  const markdown = (await overviewOf(c, id, { by: "session", plan: "Seven things.", building_now: [long, "One; two"] })).markdown;
  assert.ok(markdown.includes("Next: Item 1; Item 2; Item 3; Item 4; Item 5; and 2 more\n"), markdown);
  assert.ok(markdown.includes(`Building now: ${"A".repeat(79)}…; One, two\n`), markdown);
  assert.equal(markdown.includes("Unmapped"), false, "an unmapped item is in no list");
});

test("factory overview: every refusal names its pointer", async (context) => {
  const c = await setup(context);
  const { path, id } = await plain(context, c, ["--plan", "PLAN.md"]);
  const pointer = async (input: unknown) => {
    const result = await c.call(["factory", "overview", id, "--input", await c.file(input)]);
    assert.equal(result.json.error?.code, "INPUT_INVALID", result.stdout);
    return result.json.error.details[0].pointer;
  };
  assert.equal(await pointer({ by: "session", plan: "text though none was found" }), "/plan");
  await writeFile(join(path, "PLAN.md"), "- [ ] One\n");
  for (const plan of ["", "two\nlines", "x".repeat(401), null, 7]) assert.equal(await pointer({ by: "session", plan }), "/plan", String(plan));
  assert.equal(await pointer({ by: "someone", plan: "A plan." }), "/by");
  assert.equal(await pointer({ by: "catch-up", plan: "A plan.", building_now: ["x"] }), "/building_now");
  assert.equal(await pointer({ by: "catch-up", plan: "A plan.", done: [] }), "/done");
  assert.equal(await pointer({ by: "session", plan: "A plan.", done: [{ text: "x", date: "2026-12-11" }] }), "/done/0/date");
  assert.equal(await pointer({ by: "session", plan: "A plan.", done: [{ text: "x", date: "2026-02-30" }] }), "/done/0/date");
  assert.equal(await pointer({ by: "session", plan: "A plan.", other: 1 }), "/other");
  await rm(path, { recursive: true });
  const gone = await c.call(["factory", "overview", id, "--input", await c.file({ by: "session", plan: null })]);
  assert.deepEqual([gone.json.error.code, gone.json.error.details[0]], ["INPUT_INVALID", { pointer: "", message: "the folder isn't on this machine" }]);
});

test("factory overview --written: one commit of brain.json and the log; only the date changed rewrites nothing; a content or state change does", async (context) => {
  const c = await setup(context);
  const { path, id } = await plain(context, c, ["--plan", "PLAN.md"]);
  await writeFile(join(path, "PLAN.md"), "- [ ] One\n");
  const config = await c.config();
  config.factories[0] = { ...config.factories[0], notion: PAGE, last_synced: NOW, published: { Name: "Workshop kit" } };
  await writeFile(join(c.dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  await c.commitBrain();
  const input = { by: "session", plan: "One thing." };
  const first = await overviewOf(c, id, input);
  const { entry } = await overviewOf(c, id, input, NOW, ["--written", first.sha256]);
  assert.deepEqual(entry.overview, { as_of: NOW, by: "session", sha256: first.sha256, folder: first.folder, tasks: first.tasks });
  assert.deepEqual(entry.published["Overview as of"], { start: NOW, end: null });
  assert.deepEqual((await c.config()).factories[0], entry);
  assert.match(await c.git("log", "-1", "--format=%B"), new RegExp(`^factory: overview ${id}\\n\\nOp: op-`));
  assert.deepEqual((await c.git("show", "--name-only", "--format=", "HEAD")).split("\n").filter(Boolean).sort(), ["brain.json", "log/2026-12.md"]);
  assert.equal(await c.git("status", "--porcelain"), "");
  assert.deepEqual((await c.ok(["sync", "render", "--ids", id])).items.map((item: any) => Object.keys(item.properties)), [["Area", "Projects", "Archived", "Brain ID", "Last Synced"]], "Overview as of isn't sent again");
  assert.deepEqual(Object.keys((await c.config()).factories[0].overview), ["as_of", "by", "sha256", "folder", "tasks"], "Git keeps no text of it");

  const later = "2026-12-11T09:00:00Z";
  const head = await c.git("rev-parse", "HEAD");
  const same = await overviewOf(c, id, input, later);
  assert.deepEqual([same.unchanged, same.sha256], [true, first.sha256]);
  await overviewOf(c, id, input, later, ["--written", same.sha256]);
  assert.equal(await c.git("rev-parse", "HEAD"), head, "only the date differs: nothing is written");
  assert.equal((await c.ok(["factory", "read", id], later)).changed, false);

  await writeFile(join(path, "PLAN.md"), "Words the overview doesn't show.\n- [ ] One\n");
  assert.equal((await c.ok(["factory", "read", id], later)).changed, true, "the folder's version changed");
  const moved = await overviewOf(c, id, input, later);
  assert.equal(moved.unchanged, true);
  const kept = (await overviewOf(c, id, input, later, ["--written", moved.sha256])).entry.overview;
  assert.deepEqual(kept, { ...entry.overview, folder: moved.folder }, "the same text: only folder and tasks");

  await writeFile(join(path, "PLAN.md"), "- [x] One\n");
  const stale = await c.call(["factory", "overview", id, "--input", await c.file(input), "--written", moved.sha256], later);
  assert.equal(stale.json.error?.code, "STALE_RECORD");
  const changed = await overviewOf(c, id, input, later);
  assert.equal(changed.unchanged, false);
  assert.equal((await overviewOf(c, id, input, later, ["--written", changed.sha256])).entry.overview.as_of, later);
});

test("factory overview --written refuses a brain with uncommitted changes (DIRTY_TREE) and a hash that isn't this one's, and writes nothing", async (context) => {
  const c = await setup(context);
  const { path, id } = await plain(context, c, ["--plan", "PLAN.md"]);
  await writeFile(join(path, "PLAN.md"), "- [ ] One\n");
  await c.commitBrain();
  const input = { by: "catch-up", plan: "One thing." };
  const { sha256 } = await overviewOf(c, id, input);
  const written = async (hash: string) => c.call(["factory", "overview", id, "--input", await c.file(input), "--written", hash]);
  assert.equal((await written(sha("other"))).json.error?.code, "STALE_RECORD");
  await writeFile(join(c.dir, "index.md"), "changed by hand\n");
  const dirty = await written(sha256);
  assert.deepEqual([dirty.code, dirty.json.error?.code], [5, "DIRTY_TREE"]);
  assert.equal((await c.config()).factories[0].overview, undefined);
});

test("factory overview: taken tasks come first, their state changes the hash, and an item done 14 days ago is the last one shown", async (context) => {
  const c = await setup(context);
  const { path, id } = await plain(context, c, ["--plan", "PLAN.md"]);
  await writeFile(join(path, "PLAN.md"), "- [ ] Draw\n- [ ] speed up login\n");
  const wf = await connect(c, id, path);
  await c.ok(["workflow", "item", "put", wf, "--input", await c.file({ title: "Speed up login", scope: "Cache it", acceptance: [{ text: "fast", met_at: null, evidence: null }], approve: true, status: "in_progress", task: { page: PAGE, title: "Speed up login", status: "To Do", brain_id: null } })]);
  const before = await overviewOf(c, id, { by: "session", plan: "Login." });
  assert.ok(before.markdown.includes("Building now: Speed up login\nNext: Draw\n"), before.markdown);
  const [item] = (await c.ok(["workflow", "show", wf])).items;
  await c.ok(["workflow", "item", "put", wf, "--input", await c.file({ id: item.id, status: "done", accepted: { statement: "Good" } }), "--rev", String(item.rev)]);
  await writeFile(join(path, "PLAN.md"), "- [ ] Draw\n- [x] speed up login\n");
  const read = await c.ok(["factory", "read", id]);
  assert.deepEqual(read.taken, [{ item: item.id, title: "Speed up login", meaning: "done", done_at: "2026-12-10" }]);
  assert.equal(read.tasks, sha(JSON.stringify([[item.id, "Speed up login", "done", "2026-12-10"]])));
  const after = await overviewOf(c, id, { by: "session", plan: "Login." });
  assert.notEqual(after.sha256, before.sha256);
  assert.ok(after.markdown.includes("Done lately: Speed up login (10 Dec)\n"), after.markdown);
  assert.ok((await overviewOf(c, id, { by: "session", plan: "Login." }, "2026-12-24T09:00:00Z")).markdown.includes("Done lately"));
  assert.equal((await overviewOf(c, id, { by: "session", plan: "Login." }, "2026-12-25T09:00:00Z")).markdown.includes("Done lately"), false);
});

test("factory read: changed is true when only a taken task's status or title changed, and false again once the overview is written", async (context) => {
  const c = await setup(context);
  const { path, id } = await plain(context, c, ["--plan", "PLAN.md"]);
  await writeFile(join(path, "PLAN.md"), "- [ ] Draw\n");
  const wf = await connect(c, id, path);
  const changed = async () => (await c.ok(["factory", "read", id])).changed;
  const write = async () => {
    const input = { by: "catch-up", plan: "Cards." };
    const { sha256, folder: version } = await overviewOf(c, id, input);
    await overviewOf(c, id, input, NOW, ["--written", sha256]);
    return version;
  };
  const before = await write();
  assert.equal(await changed(), false);
  await c.ok(["workflow", "item", "put", wf, "--input", await c.file({ title: "Speed up login", scope: "Cache it", acceptance: [], approve: true, task: { page: PAGE, title: "Speed up login", status: "To Do", brain_id: null } })]);
  assert.equal(await changed(), true, "a task was taken");
  await write();
  for (const patch of [{ status: "in_progress" }, { title: "Speed up the login" }]) {
    assert.equal(await changed(), false);
    const [item] = (await c.ok(["workflow", "show", wf])).items;
    await c.ok(["workflow", "item", "put", wf, "--input", await c.file({ id: item.id, ...patch }), "--rev", String(item.rev)]);
    assert.equal(await changed(), true, JSON.stringify(patch));
    assert.equal(await write(), before, "the plan files are the same");
  }
  assert.equal(await changed(), false);
});

// ---------------------------------------------------------------- the rows (§5.14.4, §5.14.6)

const render = async (c: Awaited<ReturnType<typeof setup>>, args: string[] = ["--changed"]) => c.ok(["sync", "render", ...args]);
const rows = (data: any) => data.items.filter((item: { type: string }) => item.type === "factory");

test("sync render: a Factory's row on create, after the notes, from a repos entry and from a plain folder, in brain.json order", async (context) => {
  const c = await setup(context);
  const { data: link } = await linkedRepo(context, c);
  const { id } = await plain(context, c);
  const data = await render(c);
  assert.deepEqual(data.items.slice(-2).map((item: { id: string }) => item.id), [link.factory, id]);
  const [row, second] = rows(data);
  assert.deepEqual([row.type, row.database, row.database_id, row.page_id, row.action, row.template, row.body, row.sections], ["factory", "factories", DATABASE, null, "create", { type: "default" }, null, null]);
  assert.deepEqual(Object.keys(row.properties), ["Name", "Area", "Projects", "Archived", "Brain ID"]);
  assert.deepEqual([row.properties.Name, row.properties.Archived, row.properties["Brain ID"]], [{ type: "title", value: "acme-api" }, { type: "checkbox", value: false }, { type: "rich_text", value: link.factory }]);
  const project = /^notion: (.+)$/m.exec(await readFile(join(c.dir, "projects/acme-website/project.md"), "utf8"))![1]!;
  assert.deepEqual([row.properties.Projects, row.published.Projects], [{ type: "relation", value: [project] }, [project]]);
  assert.equal(Object.hasOwn(row.published, "@content"), false);
  assert.deepEqual(second.properties.Projects.value, []);
  assert.deepEqual([row.properties.Area, second.properties.Area], [{ type: "relation", value: [AREA_PAGE] }, { type: "relation", value: [AREA_PAGE] }]);
});

test("sync render: an unpublished Project waits in pending_relations; an update sends only what changed, and Last Synced", async (context) => {
  const c = await setup(context);
  await c.addProject(SECOND);
  const { id } = await plain(context, c, ["--project", SECOND]);
  const [created] = rows(await render(c, ["--ids", id]));
  assert.deepEqual(created.pending_relations.find((entry: any) => entry.property === "Projects"), { property: "Projects", ids: [SECOND] });
  const records = { records: [{ id, notion: PAGE, synced_at: NOW, published: created.published }] };
  const recorded = await c.ok(["sync", "record", "--input", await c.file(records)]);
  assert.deepEqual(recorded.records, [{ id, result: "recorded", changed: ["brain.json"] }]);
  const [entry] = (await c.config()).factories;
  assert.deepEqual([entry.notion, entry.last_synced, entry.published], [PAGE, NOW, created.published]);
  assert.deepEqual(rows(await render(c, ["--ids", id])), [], "nothing differs from what was last sent");

  await c.ok(["factory", "set", id, "--name", "Kit", "--no-projects"]);
  const [update] = rows(await render(c));
  assert.deepEqual([update.action, update.page_id, Object.keys(update.properties), update.template], ["update", PAGE, ["Name", "Last Synced"], undefined]);
  await c.ok(["sync", "record", "--input", await c.file({ records: [{ id, notion: PAGE, synced_at: NOW, published: update.published }] })]);
  assert.deepEqual(rows(await render(c)), []);

  await c.ok(["factory", "archive", id]);
  const [archived] = rows(await render(c));
  assert.deepEqual(archived.properties.Archived, { type: "checkbox", value: true });
});

test("sync render: an archived entry with no row gets none; module off selects none and --ids is MODULE_OFF; no database is a warning; an unknown id UNKNOWN_ID", async (context) => {
  const c = await setup(context);
  const { id } = await plain(context, c);
  await c.ok(["factory", "archive", id]);
  assert.deepEqual(rows(await render(c)), []);
  assert.equal((await c.call(["sync", "render", "--ids", "fac-00000000"])).json.error?.code, "UNKNOWN_ID");
  const other = await folder(context);
  const { id: open } = await c.ok(["factory", "add", "--path", other, "--name", "Open", "--area", AREA]);
  const config = await c.config();
  config.notion.databases.factories = "";
  await writeFile(join(c.dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  const unset = await c.call(["sync", "render", "--ids", open]);
  assert.deepEqual([unset.json.data.items, unset.json.warnings.map((warning: any) => [warning.code, warning.id])], [[], [["DATABASE_NOT_CONFIGURED", open]]]);
  await c.ok(["modules", "off", "factories"]);
  assert.deepEqual(rows(await render(c)), []);
  const named = await c.call(["sync", "render", "--ids", open]);
  assert.deepEqual([named.code, named.json.data.errors], [1, [{ id: open, reason: "MODULE_OFF" }]]);
});

test("sync render: Overview as of is a date from the last overview, and left out with none", async (context) => {
  const c = await setup(context, { factories: [{ id: "fac-7k2m9q4x", name: "Kit", path: "/work/kit", area: AREA, projects: [], overview: { as_of: "2026-12-09T18:40:00Z", by: "session", sha256: sha("a"), folder: sha("b"), tasks: sha("c") } }] });
  const [row] = rows(await render(c));
  assert.deepEqual(row.properties["Overview as of"], { type: "date", value: { start: "2026-12-09T18:40:00Z", end: null } });
});

test("sync record: another page is NOTION_ID_MISMATCH, another key INVALID_RESULT, an id that is no entry UNKNOWN_ID, and --dry-run writes nothing", async (context) => {
  const c = await setup(context);
  const { id } = await plain(context, c);
  const record = async (entry: Record<string, unknown>, extra: string[] = []) => (await c.call(["sync", "record", "--input", await c.file({ records: [{ id, synced_at: NOW, ...entry }] }), ...extra])).json.data.records[0];
  assert.equal((await record({ notion: "not a page id" })).reason, "INVALID_RESULT");
  assert.equal((await record({ notion: PAGE }, ["--dry-run"])).result, "recorded");
  assert.equal((await c.config()).factories[0].notion, undefined);
  await record({ notion: PAGE, published: { Name: "Workshop kit" } });
  await record({ published: { Archived: false } });
  assert.deepEqual((await c.config()).factories[0].published, { Name: "Workshop kit", Archived: false }, "merged key by key");
  assert.equal((await record({ notion: PAGE.replace(/b$/, "c") })).reason, "NOTION_ID_MISMATCH");
  assert.equal((await record({ tasks: [] })).reason, "INVALID_RESULT");
  assert.equal((await record({ id: "fac-00000000" })).reason, "UNKNOWN_ID");
});

// ---------------------------------------------------------------- the link back (§5.12) and brain upgrade (§5.15 step 9)

const PARAGRAPH = (name: string) => `This folder is the Factory **${name}** in Notion. Start a session here with the \`brain-workflow\` skill, which reads this Factory's open tasks (To Do and Doing). With no request from the user, list them and ask which one before you plan anything; with a request, stop only if one of them might be it. Agree how to do a task before you build it. At the end set its status and write the Factory's overview.`;
const READ_ONLY = " Its overview changes only through `brain factory overview`.";
const link = async (c: Awaited<ReturnType<typeof setup>>, path: string, extra: string[] = []) => product(["link", path, "--area", AREA, "--brain", c.dir, "--now", NOW, ...extra, "--json"], { product: await testPackageRoot(), home: dirname(c.dir) });
const agents = (path: string) => readFile(join(path, "AGENTS.md"), "utf8");

test("brain link: the Factory paragraph before the workflow paragraph, the read-only sentence, and the user's own lines kept", async (context) => {
  const c = await setup(context);
  const { path, id } = await plain(context, c);
  await writeFile(join(path, "AGENTS.md"), "# My rules\n\nKeep this line.\n");
  const before = await link(c, path);
  assert.equal(before.code, 0, before.stdout);
  assert.equal((await agents(path)).includes("is the Factory"), false, "no workflow yet");
  await connect(c, id, path);
  assert.equal((await link(c, path)).code, 0);
  const text = await agents(path);
  assert.ok(text.includes(`\n\n${PARAGRAPH("Workshop kit")}\n`), text);
  const block = blockOf(text) ?? "";
  assert.ok(block.indexOf("is the Factory") < block.indexOf("To track this repo's work"), "before the workflow paragraph");
  assert.ok(block.includes(`A connected workflow's records change only through \`brain workflow\` commands.${READ_ONLY}`), block);
  assert.ok(text.startsWith("# My rules\n\nKeep this line.\n"));
  await writeFile(join(path, "AGENTS.md"), `${text}\nA line of mine after the block.\n`);
  const around = aroundBlock(await agents(path));
  await c.ok(["factory", "set", id, "--name", "Card kit"]);
  assert.equal((await link(c, path)).code, 0);
  assert.ok((await agents(path)).includes(PARAGRAPH("Card kit")));
  assert.deepEqual(aroundBlock(await agents(path)), around, "the user's lines around the block are byte for byte the same");
  const again = await agents(path);
  assert.equal((await link(c, path)).code, 0);
  assert.equal(await agents(path), again);
});

test("brain link: no paragraph with the module off, for an ended workflow, for a workflow on a Project, or for another folder", async (context) => {
  const c = await setup(context);
  const { path, id } = await plain(context, c);
  const wf = await connect(c, id, path);
  const other = await folder(context);
  assert.equal((await link(c, other)).code, 0);
  assert.equal((await agents(other)).includes("is the Factory"), false);
  const onProject = await folder(context);
  await c.ok(["factory", "add", "--path", onProject, "--name", "On a Project", "--area", AREA]);
  await c.commitBrain();
  await c.ok(["workflow", "new", "--input", await c.file({ folder_path: onProject, opted_in: { statement: "Connect it" }, destination: { project: PROJECT }, settings: { work_type: "general", logging: "tasks_only", custom: [] }, status_map: STATUS_MAP })]);
  assert.equal((await link(c, onProject)).code, 0);
  assert.equal((await agents(onProject)).includes("is the Factory"), false);
  await c.ok(["modules", "off", "factories"]);
  assert.equal((await link(c, path)).code, 0);
  assert.equal((await agents(path)).includes("is the Factory"), false);
  await c.ok(["modules", "on", "factories"]);
  await c.commitBrain();
  const { workflow } = await c.ok(["workflow", "show", wf]);
  await c.ok(["workflow", "set", wf, "--rev", String(workflow.rev), "--input", await c.file({ state: "ended" })]);
  assert.equal((await link(c, path)).code, 0);
  assert.equal((await agents(path)).includes("is the Factory"), false);
});

test("brain upgrade refreshes what link wrote in a plain folder's Factory, after the repos entries, with the module off too and without the paragraph (2026-11-25, answer 1 B)", async (context) => {
  const c = await setup(context);
  const { path, id } = await plain(context, c);
  await connect(c, id, path);
  assert.equal((await link(c, path)).code, 0);
  const good = await agents(path);
  await writeFile(join(path, "AGENTS.md"), good.replace(PARAGRAPH("Workshop kit"), "An old paragraph."));
  await c.commitBrain();
  const upgrade = async () => (await product(["upgrade", "--brain", c.dir, "--now", NOW, "--json"], { product: await testPackageRoot(), home: dirname(c.dir) })).json;
  const first = await upgrade();
  const project = first.data.projects.find((entry: { path: string }) => entry.path === path);
  assert.ok(project !== undefined, JSON.stringify(first.data.projects));
  assert.equal((await agents(path)).includes(PARAGRAPH("Workshop kit")), true);
  await c.ok(["modules", "off", "factories"]);
  await c.commitBrain();
  await upgrade();
  assert.equal((await agents(path)).includes("is the Factory"), false);
  await c.ok(["modules", "on", "factories"]);
  await c.commitBrain();
  const { workflow } = (await c.ok(["workflow", "show", (await c.ok(["factory", "list"])).factories[0].workflow.id]));
  await c.ok(["workflow", "set", workflow.id, "--rev", String(workflow.rev), "--input", await c.file({ state: "ended" })]);
  const last = await upgrade();
  assert.equal(last.data.projects.some((entry: { path: string }) => entry.path === path), false, "an archived Factory isn't covered");
});
