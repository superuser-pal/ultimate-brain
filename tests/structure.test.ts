import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";

import type { Note } from "../src/lib/notes.ts";
import { STRUCTURE_END, STRUCTURE_START, structureBlock, withStructureBlock } from "../src/lib/structure.ts";
import { deriveView } from "../src/lib/views.ts";
import { brain } from "./helpers.ts";
import { initBrain, productRoot, run, SNAPSHOTS, temp } from "./skills-fixtures.ts";

// The structure block of the brain's AGENTS.md (decision 0089, spec/cli.md §5.8.1). Every name here is synthetic.

const NOW = "2026-12-03T10:22:00Z";
const RULES_END = "<!-- ultimate-brain:rules:end -->";
const INTRO = "Written by `brain index` from your Domain, Area and Project notes (active Projects only); edits inside this block are overwritten. Use it to place what you write. It never authorises a new Domain, Area or Project, and it is not a source for an answer.";
const LOOKUP = "For what belongs to an Area or a Project, read its brief: find it with `brain query --candidates \"<its title>\" --types view --json` and read it with `brain query --read <id> --json`. For its tasks, query the Notion Tasks database filtered by its Notion page id, every time: never act on a task list from an earlier session.";

const DOM_ACME = "dom-3k8m2p4q";
const DOM_HOME = "dom-7h2k9m4p";
const AREA_CLIENTS = "area-2m7c4h8n";
const AREA_HEALTH = "area-5t2v8k1m";
const AREA_SALES = "area-8q3w6e1r";
const PRJ_WEBSITE = "prj-9x4t1b7e";
const PRJ_APP = "prj-4c7v2b9n";
const PRJ_PAUSED = "prj-6m1k8j3h";
const PRJ_LOOSE = "prj-2p5r8t1w";
const NOTION = (n: number) => `1a2b3c4d-0000-4000-8000-00000000000${n}`;

function block(entries: readonly string[]): string {
  return [STRUCTURE_START, "## Your structure", "", INTRO, "", ...entries, "", LOOKUP, STRUCTURE_END].join("\n");
}

function note(type: string, id: string, attributes: Record<string, unknown>, extra: Partial<Note> & { titleWithheld?: boolean } = {}): Note {
  return { path: `${type}/${id}.md`, id, type, attributes: { id, type, lifecycle: "reviewed", ...attributes }, body: "", raw: "", ...extra } as Note;
}

const DOMAINS_ON = { modules: { domains: true } };
const DOMAINS_OFF = { modules: { domains: false } };

// --- the block's content (unit) ---

test("the block nests Domains, Areas and active Projects, with No domain and No area last, sorted by title then id", () => {
  const notes = [
    note("domain", DOM_HOME, { title: "Home" }),
    note("domain", DOM_ACME, { title: "Acme", notion: NOTION(1) }),
    note("area", AREA_CLIENTS, { title: "Clients", domain: DOM_ACME, notion: NOTION(2) }),
    note("area", AREA_SALES, { title: "Sales", domain: DOM_ACME }),
    note("area", AREA_HEALTH, { title: "Health" }),
    note("project", PRJ_WEBSITE, { title: "Website", area: AREA_CLIENTS, notion: NOTION(3), notion_fields: { status: "Active" } }),
    note("project", PRJ_APP, { title: "App", area: AREA_CLIENTS }),
    note("project", PRJ_PAUSED, { title: "Paused work", area: AREA_CLIENTS, notion_fields: { status: "On Hold" } }),
    note("project", PRJ_LOOSE, { title: "Loose ends", notion_fields: { status: "Active" } }),
  ];
  assert.equal(structureBlock(notes, DOMAINS_ON), block([
    `- Acme — ${DOM_ACME} · Notion ${NOTION(1)}`,
    `  - Clients — ${AREA_CLIENTS} · Notion ${NOTION(2)}`,
    `    - App — ${PRJ_APP}`,
    `    - Website — ${PRJ_WEBSITE} · Notion ${NOTION(3)}`,
    `  - Sales — ${AREA_SALES}`,
    `- Home — ${DOM_HOME}`,
    "- No domain",
    `  - Health — ${AREA_HEALTH}`,
    "- No area",
    `  - Loose ends — ${PRJ_LOOSE}`,
  ]));
});

test("with Domains off there is no Domain level, and Domain notes are ignored", () => {
  const notes = [
    note("domain", DOM_ACME, { title: "Acme" }),
    note("area", AREA_CLIENTS, { title: "Clients", domain: DOM_ACME }),
    note("project", PRJ_WEBSITE, { title: "Website", area: AREA_CLIENTS }),
  ];
  assert.equal(structureBlock(notes, DOMAINS_OFF), block([`- Clients — ${AREA_CLIENTS}`, `  - Website — ${PRJ_WEBSITE}`]));
  assert.equal(structureBlock([note("domain", DOM_ACME, { title: "Acme" })], DOMAINS_OFF), undefined, "a Domain alone lists nothing with the module off");
});

test("archived notes, Projects not Active and every other type are left out; nothing listed means no block", () => {
  const notes = [
    note("domain", DOM_ACME, { title: "Acme", lifecycle: "archived" }),
    note("area", AREA_CLIENTS, { title: "Clients", domain: DOM_ACME }),
    note("area", AREA_SALES, { title: "Sales", notion_fields: { archived: true } }),
    note("project", PRJ_WEBSITE, { title: "Website", area: AREA_CLIENTS, notion_fields: { status: "Active", archived: true } }),
    note("project", PRJ_APP, { title: "App", area: AREA_SALES }),
    ...["Planned", "On Hold", "Done"].map((status, index) => note("project", `prj-${index}h${index}k${index}m${index}p`, { title: status, area: AREA_CLIENTS, notion_fields: { status } })),
    note("goal", "gol-4p9r2w6t", { title: "Grow", area: AREA_CLIENTS }),
    note("reference", "ref-4p9r2w6t", { title: "Spec", area: AREA_CLIENTS }),
  ];
  // Clients loses its archived Domain; App loses its archived Area.
  assert.equal(structureBlock(notes, DOMAINS_ON), block(["- No domain", `  - Clients — ${AREA_CLIENTS}`, "- No area", `  - App — ${PRJ_APP}`]));
  assert.equal(structureBlock([note("goal", "gol-4p9r2w6t", { title: "Grow" })], DOMAINS_ON), undefined);
  assert.equal(structureBlock([], DOMAINS_ON), undefined);
});

test("a note in the awaiting-cleanup form is listed by id only and sorts as an empty title; titles go on one line", () => {
  const notes = [
    note("area", AREA_CLIENTS, { title: "Clients" }),
    note("area", AREA_HEALTH, { notion: NOTION(4) }, { titleWithheld: true }),
    note("area", AREA_SALES, { title: "Sales\n  and   marketing" }),
  ];
  assert.equal(structureBlock(notes, DOMAINS_OFF), block([
    `- (title withheld: awaiting cleanup) — ${AREA_HEALTH} · Notion ${NOTION(4)}`,
    `- Clients — ${AREA_CLIENTS}`,
    `- Sales and   marketing — ${AREA_SALES}`,
  ]));
});

// --- placement (unit) ---

const RULES = `<!-- ultimate-brain:rules:start v1 -->\nrules\n${RULES_END}\n\n## My rules\n\nmine\n`;
const STYLE = "<!-- ultimate-brain:style:start -->\n## How to answer me\n\n- short\n<!-- ultimate-brain:style:end -->";
const BLOCK = block([`- Clients — ${AREA_CLIENTS}`]);

test("the block goes after the rules block, after the style block when there is one, and adding then removing it restores the bytes", () => {
  const added = withStructureBlock(RULES, BLOCK)!;
  assert.equal(added.action, "created");
  assert.equal(added.text, `<!-- ultimate-brain:rules:start v1 -->\nrules\n${RULES_END}\n\n${BLOCK}\n\n## My rules\n\nmine\n`);
  assert.deepEqual(withStructureBlock(added.text, BLOCK), { text: added.text, action: "unchanged" });
  assert.deepEqual(withStructureBlock(added.text, undefined), { text: RULES, action: "removed" });

  const styled = RULES.replace(RULES_END, `${RULES_END}\n\n${STYLE}`);
  const both = withStructureBlock(styled, BLOCK)!;
  assert.equal(both.text, RULES.replace(RULES_END, `${RULES_END}\n\n${STYLE}\n\n${BLOCK}`));
  const other = block([`- Health — ${AREA_HEALTH}`]);
  assert.deepEqual(withStructureBlock(both.text, other), { text: RULES.replace(RULES_END, `${RULES_END}\n\n${STYLE}\n\n${other}`), action: "updated" });
  assert.deepEqual(withStructureBlock(RULES, undefined), { text: RULES, action: "unchanged" });
});

test("missing, duplicated or out-of-order markers refuse the write", () => {
  assert.equal(withStructureBlock("no rules here\n", BLOCK), undefined);
  const added = withStructureBlock(RULES, BLOCK)!.text;
  assert.equal(withStructureBlock(`${added}\n${STRUCTURE_START}\n`, BLOCK), undefined, "a second start marker");
  assert.equal(withStructureBlock(added.replace(STRUCTURE_END, ""), BLOCK), undefined, "no end marker");
  assert.equal(withStructureBlock(RULES.replace(`${RULES_END}\n`, `${BLOCK}\n${RULES_END}\n`), BLOCK), undefined, "a block inside the rules block");
  const styled = RULES.replace(RULES_END, `${RULES_END}\n\n${BLOCK}\n\n${STYLE}`);
  assert.equal(withStructureBlock(styled, BLOCK), undefined, "a block before the style block");
});

// --- brain index, lint, status, upgrade, config (CLI) ---

async function freshBrain(context: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "brain-structure-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, "brain");
  const init = await brain(["init", target, "--owner", "Test Owner", "--no-git", "--now", NOW, "--json"], root);
  assert.equal(init.code, 0, init.stderr);
  const cli = (...args: string[]) => brain([...args, "--brain", target, "--now", NOW, "--json"], root);
  const agents = () => readFile(join(target, "AGENTS.md"), "utf8");
  const write = async (path: string, frontmatter: Record<string, unknown>) => {
    await mkdir(dirname(join(target, path)), { recursive: true });
    // A notion_fields snapshot is dated (schema §4).
    const dated = frontmatter.notion_fields === undefined ? frontmatter : { ...frontmatter, notion_fields: { ...frontmatter.notion_fields as object, as_of: "2026-12-01T00:00:00Z" } };
    const yaml = Object.entries({ lifecycle: "reviewed", created: "2026-12-01", updated: "2026-12-01", ...dated })
      .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`).join("\n");
    await writeFile(join(target, path), `---\n${yaml}\n---\n\nBody.\n`);
  };
  const config = async (change: (value: Record<string, any>) => void) => {
    const path = join(target, "brain.json");
    const value = JSON.parse(await readFile(path, "utf8"));
    change(value);
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
  };
  return { root, target, cli, agents, write, config, original: await agents() };
}

async function seed(write: Awaited<ReturnType<typeof freshBrain>>["write"]) {
  await write("domains/acme.md", { id: DOM_ACME, type: "domain", title: "Acme", summary: "Acme work." });
  await write("areas/clients.md", { id: AREA_CLIENTS, type: "area", title: "Clients", summary: "Client work.", domain: DOM_ACME });
  await write("projects/website/project.md", { id: PRJ_WEBSITE, type: "project", title: "Website", summary: "The site.", area: AREA_CLIENTS, notion_fields: { status: "Active" } });
}

test("brain index writes, refreshes and removes the block; --check, lint and status see it stale", async (context) => {
  const { cli, agents, write, config, original } = await freshBrain(context);
  await config((value) => { value.modules.domains = true; });

  const empty = await cli("index");
  assert.equal(empty.code, 0, empty.stdout);
  assert.deepEqual(empty.json.data.structure, { path: "AGENTS.md", action: "unchanged" });
  assert.equal(await agents(), original, "a brain with no structure has no block");

  await seed(write);
  const check = await cli("index", "--check");
  assert.equal(check.code, 1);
  assert.equal(check.json.data.stale, true);
  assert.deepEqual(check.json.data.structure, { path: "AGENTS.md", action: "created" });
  assert.equal(await agents(), original, "--check writes nothing");
  const lint = await cli("lint");
  assert.ok(lint.json.data.issues.some((issue: any) => issue.rule === "index-stale" && issue.path === "AGENTS.md"), JSON.stringify(lint.json.data.issues));
  assert.equal((await cli("status")).json.data.index_stale, true);

  const created = await cli("index");
  assert.equal(created.code, 0, created.stdout);
  assert.deepEqual(created.json.data.structure, { path: "AGENTS.md", action: "created" });
  assert.deepEqual(created.json.warnings, []);
  const expected = block([`- Acme — ${DOM_ACME}`, `  - Clients — ${AREA_CLIENTS}`, `    - Website — ${PRJ_WEBSITE}`]);
  assert.equal(await agents(), original.replace(RULES_END, `${RULES_END}\n\n${expected}`));
  assert.equal((await cli("index", "--check")).code, 0);
  assert.ok(!(await cli("lint")).json.data.issues.some((issue: any) => issue.rule === "index-stale"));
  assert.equal((await cli("status")).json.data.index_stale, false);

  // A rename, a new Area, a Project put on hold and an Area moved out of its Domain each change the block at the next index.
  await write("areas/clients.md", { id: AREA_CLIENTS, type: "area", title: "Customers", summary: "Client work.", domain: DOM_ACME });
  await write("areas/health.md", { id: AREA_HEALTH, type: "area", title: "Health", summary: "Health." });
  await write("projects/website/project.md", { id: PRJ_WEBSITE, type: "project", title: "Website", summary: "The site.", area: AREA_CLIENTS, notion_fields: { status: "On Hold" } });
  const updated = await cli("index");
  assert.deepEqual(updated.json.data.structure, { path: "AGENTS.md", action: "updated" });
  assert.equal(await agents(), original.replace(RULES_END, `${RULES_END}\n\n${block([`- Acme — ${DOM_ACME}`, `  - Customers — ${AREA_CLIENTS}`, "- No domain", `  - Health — ${AREA_HEALTH}`])}`));

  // Archiving everything removes the block and restores the bytes.
  for (const [path, id, type, title] of [["domains/acme.md", DOM_ACME, "domain", "Acme"], ["areas/clients.md", AREA_CLIENTS, "area", "Customers"], ["areas/health.md", AREA_HEALTH, "area", "Health"]]) {
    await write(path!, { id, type, title, summary: "Gone.", notion_fields: { archived: true } });
  }
  const removed = await cli("index");
  assert.deepEqual(removed.json.data.structure, { path: "AGENTS.md", action: "removed" });
  assert.equal(await agents(), original);
});

test("bad markers or a symbolic link skip the block with AGENTS_BLOCK_NOT_FOUND; a missing AGENTS.md is skipped quietly; index.md is still written", async (context) => {
  const { target, cli, agents, write } = await freshBrain(context);
  await seed(write);
  const broken = `${await agents()}\n${STRUCTURE_START}\n`;
  await writeFile(join(target, "AGENTS.md"), broken);
  const skipped = await cli("index");
  assert.equal(skipped.code, 0);
  assert.deepEqual(skipped.json.data.structure, { path: "AGENTS.md", action: "skipped" });
  assert.deepEqual(skipped.json.warnings.map((warning: any) => warning.code), ["AGENTS_BLOCK_NOT_FOUND"]);
  assert.equal(await agents(), broken, "nothing outside the markers changes");
  assert.equal(skipped.json.data.written, true, "index.md is still written");
  assert.equal((await cli("index", "--check")).code, 0, "a file the index would skip is not stale");

  await writeFile(join(target, "AGENTS-real.md"), broken);
  await unlink(join(target, "AGENTS.md"));
  await symlink("AGENTS-real.md", join(target, "AGENTS.md"));
  const linked = await cli("index");
  assert.deepEqual(linked.json.data.structure, { path: "AGENTS.md", action: "skipped" });
  assert.deepEqual(linked.json.warnings.map((warning: any) => warning.code), ["AGENTS_BLOCK_NOT_FOUND"]);

  await unlink(join(target, "AGENTS.md"));
  const missing = await cli("index");
  assert.deepEqual(missing.json.data.structure, { path: "AGENTS.md", action: "skipped" });
  assert.deepEqual(missing.json.warnings, []);
});

test("the style block and the structure block keep their order whichever is written first", async (context) => {
  const { cli, agents, write, original } = await freshBrain(context);
  await seed(write);
  const structure = block([`- Clients — ${AREA_CLIENTS}`, `  - Website — ${PRJ_WEBSITE}`]);

  // Structure first, then a style: the style block goes between the rules block and the structure block.
  assert.equal((await cli("index")).code, 0);
  assert.equal((await cli("config", "set", "settings.style", '{ "length": "short" }')).code, 0);
  const text = await agents();
  assert.match(text, new RegExp(`${RULES_END}\\n\\n<!-- ultimate-brain:style:start -->[\\s\\S]*<!-- ultimate-brain:style:end -->\\n\\n${STRUCTURE_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.ok(text.includes(structure));
  assert.equal((await cli("index", "--check")).code, 0, "the structure block is still current after the style write");

  // Removing the style leaves the structure block right after the rules block; removing the structure restores the bytes.
  assert.equal((await cli("config", "set", "settings.style", "{}")).code, 0);
  assert.equal(await agents(), original.replace(RULES_END, `${RULES_END}\n\n${structure}`));
});

test("upgrade writes the structure block after the rules and style blocks, and its lint finds nothing stale", async (context) => {
  const { target, cli, agents, write, original } = await freshBrain(context);
  await seed(write);
  const mine = `${original}Call the client by its short name.\n`;
  await writeFile(join(target, "AGENTS.md"), mine);
  const structure = block([`- Clients — ${AREA_CLIENTS}`, `  - Website — ${PRJ_WEBSITE}`]);

  const dry = await cli("upgrade", "--dry-run");
  assert.equal(dry.code, 0, dry.stdout);
  assert.deepEqual(dry.json.data.files, [{ path: "AGENTS.md", action: "updated" }]);
  assert.equal(await agents(), mine, "a dry run writes nothing");

  const first = await cli("upgrade");
  assert.equal(first.code, 0, first.stdout);
  assert.deepEqual(first.json.data.files, [{ path: "AGENTS.md", action: "updated" }]);
  assert.equal(await agents(), mine.replace(RULES_END, `${RULES_END}\n\n${structure}`));
  assert.equal(first.json.data.lint.errors, 0);
  const lint = await cli("lint");
  assert.ok(!lint.json.data.issues.some((issue: any) => issue.path === "AGENTS.md"), JSON.stringify(lint.json.data.issues));
  assert.equal((await cli("index", "--check")).json.data.structure.action, "unchanged");
  assert.deepEqual((await cli("upgrade")).json.data.files, [], "a second upgrade changes nothing");

  // Bad structure markers: the rules and style blocks are still written, the structure block is left as it is.
  const damaged = `${await agents()}\n${STRUCTURE_END}\n`;
  await writeFile(join(target, "AGENTS.md"), damaged);
  const skipped = await cli("upgrade");
  assert.equal(skipped.code, 0, skipped.stdout);
  assert.ok(skipped.json.warnings.some((warning: any) => warning.code === "AGENTS_BLOCK_NOT_FOUND"));
  assert.equal(await agents(), damaged);
});

async function linkSetup(context: TestContext) {
  const home = await temp(context);
  const product = await productRoot(context, join(SNAPSHOTS, "a"), "0.9.2");
  const target = await initBrain(context, product, home);
  const repo = await temp(context, "structure-repo-");
  const cli = (...args: string[]) => run([...args, "--brain", target, "--json"], { product, home });
  const write = async (path: string, text: string) => {
    await mkdir(dirname(join(target, path)), { recursive: true });
    await writeFile(join(target, path), text);
  };
  await write("domains/acme.md", `---\nid: ${DOM_ACME}\ntype: domain\ntitle: Acme\nsummary: Acme work.\nlifecycle: reviewed\n---\n`);
  await write("domains/home.md", `---\nid: ${DOM_HOME}\ntype: domain\ntitle: Home\nsummary: Home.\nlifecycle: reviewed\n---\n`);
  await write("areas/clients.md", `---\nid: ${AREA_CLIENTS}\ntype: area\ntitle: Clients\nsummary: Client work.\nlifecycle: reviewed\ndomain: ${DOM_ACME}\n---\n`);
  await write("areas/health.md", `---\nid: ${AREA_HEALTH}\ntype: area\ntitle: Health\nsummary: Health.\nlifecycle: reviewed\ndomain: ${DOM_HOME}\n---\n`);
  const domains = async (on: boolean) => {
    const path = join(target, "brain.json");
    const config = JSON.parse(await readFile(path, "utf8"));
    config.modules.domains = on;
    await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
  };
  const link = async (...args: string[]) => {
    const result = await cli("link", repo, ...args);
    assert.equal(result.code, 0, result.stdout);
    return readFile(join(repo, "AGENTS.md"), "utf8");
  };
  return { target, write, domains, link };
}

test("a linked folder shows its own Domain under its Area, never the rest of the structure, and only with Domains on", async (context) => {
  const { write, domains, link } = await linkSetup(context);
  const own = `- Area: Clients (\`${AREA_CLIENTS}\`)\n- Domain: Acme (\`${DOM_ACME}\`)\n\nThe brain holds`;

  await domains(true);
  const on = await link("--area", AREA_CLIENTS);
  assert.ok(on.includes(`This repo is linked to the user's second brain:\n${own}`), on);
  for (const other of ["Home", "Health", DOM_HOME, AREA_HEALTH]) assert.ok(!on.includes(other), `${other} stays out of the linked folder`);

  await domains(false);
  const off = await link();
  assert.ok(off.includes(`- Area: Clients (\`${AREA_CLIENTS}\`)\n\nThe brain holds`), off);
  assert.ok(!off.includes("- Domain:"));

  await domains(true);
  await write("domains/acme.md", `---\nid: ${DOM_ACME}\ntype: domain\ntitle: Acme\nsummary: Acme work.\nlifecycle: reviewed\nnotion_fields:\n  archived: true\n---\n`);
  assert.ok(!(await link()).includes("- Domain:"), "an archived Domain is not shown");
});

// --- the briefs' Documents section (schema §16.1 item 7, §16.3 item 4) ---

function documentNote(n: number, attributes: Record<string, unknown>): Note {
  const id = `ref-${String(n).padStart(2, "0")}k8m2p4q`.slice(0, 12);
  return { path: `knowledge/documents/doc-${n}.md`, id, type: "reference", attributes: { id, type: "reference", title: `Doc ${n}`, lifecycle: "reviewed", updated: `2026-11-${String(10 + n).padStart(2, "0")}`, ...attributes }, body: "", raw: "" } as Note;
}

function section(view: string): string {
  return view.slice(view.indexOf("## Documents"), view.indexOf("\n<!-- @generated:end -->"));
}

test("each brief lists its reviewed Documents, last updated first, at most 10 then a count; drafts make the waiting line; off with the module", () => {
  const area = { path: "areas/clients.md", id: AREA_CLIENTS, type: "area", attributes: { id: AREA_CLIENTS, type: "area", title: "Clients", lifecycle: "reviewed" }, body: "", raw: "" } as Note;
  const project = { path: "projects/website/project.md", id: PRJ_WEBSITE, type: "project", attributes: { id: PRJ_WEBSITE, type: "project", title: "Website", lifecycle: "reviewed", area: AREA_CLIENTS }, body: "", raw: "" } as Note;
  const documents = [
    ...Array.from({ length: 12 }, (_, index) => documentNote(index + 1, { projects: [PRJ_WEBSITE], ...(index === 11 ? { origin: "learned" } : {}) })),
    documentNote(13, { projects: [PRJ_WEBSITE], lifecycle: "archived", updated: "2026-12-30" }),
    documentNote(14, { area: AREA_CLIENTS, lifecycle: "draft" }),
    documentNote(15, { projects: ["prj-0000zzzz"] }),
  ];
  const brief = deriveView(project, "brief", [area, project, ...documents], { documents: true }).generatedBlock;
  assert.equal(section(brief), [
    "## Documents",
    "- [Doc 12](../../knowledge/documents/doc-12.md) — learned",
    ...Array.from({ length: 9 }, (_, index) => `- [Doc ${11 - index}](../../knowledge/documents/doc-${11 - index}.md)`),
    "- 2 more",
  ].join("\n"));
  assert.ok(!brief.includes("Doc 13") && !brief.includes("Doc 14") && !brief.includes("Doc 15"), "archived, draft and other projects' Documents are left out");

  // The area's brief: its own Documents and its projects'; with only a draft, the waiting line.
  const areaBrief = deriveView(area, "area_brief", [area, project, ...documents], { documents: true }).generatedBlock;
  assert.ok(section(areaBrief).startsWith("## Documents\n- [Doc 12](../../knowledge/documents/doc-12.md) — learned"), areaBrief);
  const onlyDraft = deriveView(area, "area_brief", [area, documents[13]!], { documents: true }).generatedBlock;
  assert.equal(section(onlyDraft), "## Documents\n- Nothing reviewed yet: 1 note waiting in Review");
  assert.equal(section(deriveView(area, "area_brief", [area], { documents: true }).generatedBlock), "## Documents\n- None");

  // Documents off: no section; the decision log never has one.
  assert.ok(!deriveView(project, "brief", [area, project, ...documents], { documents: false }).generatedBlock.includes("## Documents"));
  assert.ok(!deriveView(project, "decision_log", [area, project, ...documents], { documents: true }).generatedBlock.includes("## Documents"));
});
