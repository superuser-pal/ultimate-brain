import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";

import { serializeNewFile } from "../src/lib/frontmatter.ts";
import { passageHash } from "../src/lib/selection.ts";
import { brain } from "./helpers.ts";

// `brain recall --pack` and `--search` (spec/cli.md §5.33, spec/memory.md §2, §5, §6.1). Synthetic brains and folders only.

const NOW = "2026-11-08T10:00:00Z";
const AREA = "area-2m7c4h8n";
const OTHER_AREA = "area-5h3k8p2r";
const PROJECT = "prj-9x4t1b7e";
const OTHER_PROJECT = "prj-4w7c2n9x";
const TASKS_FIXTURE = join(import.meta.dirname, "fixtures", "recall", "TASKS.md");
const PATTERN = "^### (?<id>[A-Z]+-\\d+) · (?<title>.+) · `(?<status>[^`]+)`$";
const STATUS_MAP = { "in progress": "in_progress", review: "review", done: "done", todo: "todo" };

interface World { dir: string; repo: string; parent: string }

/** A new brain (no Git) with two areas and a project, and an empty folder beside it. */
async function world(context: TestContext): Promise<World> {
  const parent = await mkdtemp(join(tmpdir(), "brain-recall-"));
  context.after(() => rm(parent, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const dir = join(parent, "brain");
  const made = await brain(["init", dir, "--owner", "Test Owner", "--no-git", "--now", NOW, "--json"]);
  assert.equal(made.code, 0, made.stdout);
  await put(dir, "areas/consulting.md", { id: AREA, type: "area", title: "Consulting", summary: "Client work.", lifecycle: "reviewed", created: "2026-09-01", updated: "2026-09-01" });
  await put(dir, "areas/research.md", { id: OTHER_AREA, type: "area", title: "Research", summary: "Reading.", lifecycle: "reviewed", created: "2026-09-01", updated: "2026-09-01" });
  await put(dir, "projects/acme-api/project.md", { id: PROJECT, type: "project", title: "Acme API", summary: "The API.", lifecycle: "reviewed", area: AREA, created: "2026-09-01", updated: "2026-09-01" });
  await put(dir, "projects/other/project.md", { id: OTHER_PROJECT, type: "project", title: "Other", summary: "Another.", lifecycle: "reviewed", area: OTHER_AREA, created: "2026-09-01", updated: "2026-09-01" });
  const repo = join(parent, "acme-api");
  await mkdir(repo, { recursive: true });
  return { dir, repo, parent };
}

async function put(dir: string, path: string, attributes: Record<string, unknown>, body = ""): Promise<void> {
  await mkdir(dirname(join(dir, path)), { recursive: true });
  await writeFile(join(dir, path), serializeNewFile(attributes, body));
}

type Reach = { scope: "general" } | { scope: "project"; projects: string[] } | { scope: "area"; areas: string[] } | { scope: "stack"; stacks: string[] };

/** A memory note under memories/YYYY/MM/ (schema "memory"); reviewed and verified unless `extra` says otherwise. */
async function memory(dir: string, id: string, summary: string, reach: Reach, extra: Record<string, unknown> = {}, body = "Learned in a session.\n"): Promise<string> {
  const updated = (extra.updated as string | undefined) ?? "2026-10-01";
  const path = `memories/${updated.slice(0, 4)}/${updated.slice(5, 7)}/${updated}-${id}.md`;
  const attributes: Record<string, unknown> = { id, type: "memory", title: `Memory ${id}`, summary, lifecycle: "reviewed", ...reach, confidence: "verified", origin: "acme-api", sources: ["agent:claude-code/2026-10-01-session"], created: updated, updated, ...extra };
  if (attributes.summary === undefined) delete attributes.summary;
  await put(dir, path, attributes, body);
  return path;
}

async function marker(repo: string, value: Record<string, unknown>): Promise<void> {
  await writeFile(join(repo, ".brain"), `${JSON.stringify(value, null, 2)}\n`);
}

async function kit(repo: string, tasks: Record<string, unknown> | undefined, extra: Record<string, unknown> = {}): Promise<void> {
  const value = { kit_version: 1, name: "acme-api", placement: { area: AREA, project: PROJECT }, knowledge: { patterns: ["docs/**"] }, ...(tasks === undefined ? {} : { tasks }), methodology: { summary: "Small PRs." }, ...extra };
  await writeFile(join(repo, "brain-kit.json"), `${JSON.stringify(value, null, 2)}\n`);
}

const patternTasks = { mode: "tracked-in-repo", source: { kind: "markdown", path: "TASKS.md", format: "pattern", pattern: PATTERN }, status_map: STATUS_MAP };

async function recall(dir: string, ...args: string[]) {
  const result = await brain(["recall", ...args, "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(result.code, 0, result.stdout);
  return result.json.data;
}

const estimate = (text: string): number => Math.ceil(Buffer.byteLength(text, "utf8") / 3);
const ids = (items: Array<{ id: string }>): string[] => items.map((item) => item.id);

// --- Restricted evidence (capture-and-review §5.1): version 1 of an input holds an excluded paragraph; version 2 doesn't. ---

const INPUT = "11111111-2222-4333-8444-555555555555";
const SECRET = "Pricing was 95k.";

function extract(id: string, version: number, replaces: string | null, paragraphs: Array<[number, string]>): string {
  const body = paragraphs.map(([n, text]) => `<!-- passage ¶${n} item s1 -->\n${text}\n`).join("\n");
  return `---\nid: ${id}\ntype: source\ntitle: Launch extract v${version}\nsource_key: notion:${INPUT}\nkind: minutes\nextract: true\nextract_of: ${INPUT}\nextract_version: ${version}\n${replaces === null ? "" : `replaces: ${replaces}\n`}transcript_hash: ${"a".repeat(64)}\nselection:\n  - id: s1\n    effective: use\npassages:\n${paragraphs.map(([n, text]) => `  - n: ${n}\n    hash: ${passageHash(text)}`).join("\n")}\ncaptured: 2026-10-10\ncontent_hash: ${"b".repeat(64)}\n---\n${body}`;
}

async function excluded(dir: string): Promise<void> {
  await mkdir(join(dir, "sources/notion"), { recursive: true });
  await writeFile(join(dir, "sources/notion/2026-10-10-extract-v1.md"), extract("src-ex1a3b4c", 1, null, [[1, "A live paragraph."], [2, SECRET]]));
  await writeFile(join(dir, "sources/notion/2026-10-10-extract-v2.md"), extract("src-ex2a3b4c", 2, "src-ex1a3b4c", [[1, "A live paragraph."]]));
  await mkdir(join(dir, "_suppressions"), { recursive: true });
  await writeFile(join(dir, "_suppressions", `${INPUT}.json`), JSON.stringify({ input: INPUT, records: [{ version: 2, passages: [{ extract_of: INPUT, transcript_hash: "a".repeat(64), n: 2 }], full_copies: [], status: "active" }] }));
}

/** One memory for each rule of memory.md §2, and the scopes of 0009, for a caller linked to PROJECT in AREA with the stack supabase. */
async function eligibilityBrain(dir: string): Promise<void> {
  await memory(dir, "mem-aaaa0001", "General: prefer small commits.", { scope: "general" });
  await memory(dir, "mem-aaaa0002", "Project: ask before migrations.", { scope: "project", projects: [PROJECT] });
  await memory(dir, "mem-aaaa0003", "Other project: deploy on Fridays.", { scope: "project", projects: [OTHER_PROJECT] });
  await memory(dir, "mem-aaaa0004", "Area: invoices in EUR.", { scope: "area", areas: [AREA] });
  await memory(dir, "mem-aaaa0005", "Other area: cite papers.", { scope: "area", areas: [OTHER_AREA] });
  await memory(dir, "mem-aaaa0006", "Stack: test RLS with the anon key.", { scope: "stack", stacks: ["supabase"] });
  await memory(dir, "mem-aaaa0007", "Other stack: use the app router.", { scope: "stack", stacks: ["nextjs"] });
  await memory(dir, "mem-aaaa0008", "Draft: never approved.", { scope: "general" }, { lifecycle: "draft" });
  await memory(dir, "mem-aaaa0009", "Disputed: in doubt.", { scope: "general" }, { lifecycle: "disputed" });
  await memory(dir, "mem-aaaa0010", "Old rule: run migrations freely.", { scope: "project", projects: [PROJECT] }, { lifecycle: "archived", relations: [{ type: "superseded_by", target: "mem-aaaa0011" }], updated: "2026-09-01" });
  await memory(dir, "mem-aaaa0011", "New rule: run migrations on staging first.", { scope: "project", projects: [PROJECT] }, { relations: [{ type: "supersedes", target: "mem-aaaa0010" }], updated: "2026-10-02" });
  await memory(dir, "mem-aaaa0012", "Superseded but still reviewed.", { scope: "general" }, { relations: [{ type: "superseded_by", target: "mem-aaaa0001" }] });
  await excluded(dir);
  // Restricted whole: it rests on the changed input and has text no passage reference maps (cli.md §5.13).
  await memory(dir, "mem-aaaa0013", "Restricted: pricing lesson.", { scope: "general" }, { sources: ["src-ex1a3b4c"] }, "The pricing lesson.\n");
  // Resolved for the input, but its only source is the older version the rule leaves out: nothing supports it (memory.md §2 rule 4).
  await memory(dir, "mem-aaaa0014", "Unsupported: every source left out.", { scope: "general" }, { sources: ["src-ex1a3b4c"], lineage_cleared: [INPUT] });
  // One of its sources is the live version: it stays.
  await memory(dir, "mem-aaaa0015", "Supported: one live source.", { scope: "general" }, { sources: ["src-ex1a3b4c", "src-ex2a3b4c"], lineage_cleared: [INPUT] });
}

const LINKED = { repo: "acme-api", project: PROJECT, area: AREA, stacks: ["supabase"] };
const ELIGIBLE = ["mem-aaaa0001", "mem-aaaa0002", "mem-aaaa0004", "mem-aaaa0006", "mem-aaaa0011", "mem-aaaa0015"];

test("only eligible memories reach the pack and the search: reviewed, not superseded, in reach, not restricted, supported (memory.md §2)", async (context) => {
  const { dir, repo } = await world(context);
  await eligibilityBrain(dir);
  await marker(repo, LINKED);
  const pack = await recall(dir, "--pack", "--repo", repo);
  assert.deepEqual(pack.caller, LINKED);
  assert.deepEqual(ids(pack.memories).sort(), ELIGIBLE);
  assert.deepEqual(pack.omitted, { memories: 0, work: 0 });
  // Every memory text holds "rule", "lesson" or its scope word; the search for each word finds only eligible ones.
  const search = await recall(dir, "--search", "general project area stack rule supported", "--repo", repo, "--limit", "50");
  assert.deepEqual(ids(search.results).sort(), ELIGIBLE);
  assert.equal(search.results.some((result: Record<string, unknown>) => "superseded_by" in result), false);
});

test("reach follows 0009: a project's area reaches its memories, stacks must share one, and a folder without .brain gets only general memories (memory.md §2.1)", async (context) => {
  const { dir, repo, parent } = await world(context);
  await eligibilityBrain(dir);
  // A .brain with only a project: the project's area reaches the area memory.
  await marker(repo, { project: PROJECT });
  const byProject = await recall(dir, "--pack", "--repo", repo);
  assert.deepEqual(byProject.caller, { repo: "acme-api", project: PROJECT, area: null, stacks: [] });
  assert.deepEqual(ids(byProject.memories).sort(), ["mem-aaaa0001", "mem-aaaa0002", "mem-aaaa0004", "mem-aaaa0011", "mem-aaaa0015"]);
  // A .brain with only stacks.
  await marker(repo, { repo: "tooling", stacks: ["nextjs", "supabase"] });
  const byStack = await recall(dir, "--pack", "--repo", repo);
  assert.deepEqual(ids(byStack.memories).sort(), ["mem-aaaa0001", "mem-aaaa0006", "mem-aaaa0007", "mem-aaaa0015"]);
  // No .brain: no project, area or stacks; only general memories.
  const plain = join(parent, "plain");
  await mkdir(plain);
  const none = await recall(dir, "--pack", "--repo", plain);
  assert.deepEqual(none.caller, { repo: null, project: null, area: null, stacks: [] });
  assert.deepEqual(ids(none.memories).sort(), ["mem-aaaa0001", "mem-aaaa0015"]);
  // The brain itself as the caller: the same.
  const self = await recall(dir, "--pack", "--repo", dir);
  assert.deepEqual(ids(self.memories).sort(), ["mem-aaaa0001", "mem-aaaa0015"]);
});

test("the caller is the current directory when --repo is absent (memory.md §2.1)", async (context) => {
  const { dir, repo } = await world(context);
  await eligibilityBrain(dir);
  await marker(repo, LINKED);
  const before = process.cwd();
  process.chdir(repo);
  try {
    const pack = await recall(dir, "--pack");
    assert.deepEqual(pack.caller, LINKED);
    assert.deepEqual(ids(pack.memories).sort(), ELIGIBLE);
  } finally {
    process.chdir(before);
  }
});

test("memories rank project, area, stack, general, then newest, then id; --task ranks within a level only (0009, memory.md §5.1, §5.4)", async (context) => {
  const { dir, repo } = await world(context);
  await marker(repo, LINKED);
  await memory(dir, "mem-bbbb0001", "General newer lesson about billing.", { scope: "general" }, { updated: "2026-10-20" });
  await memory(dir, "mem-bbbb0002", "General older lesson.", { scope: "general" }, { updated: "2026-10-01" });
  await memory(dir, "mem-bbbb0003", "Stack lesson.", { scope: "stack", stacks: ["supabase"] }, { updated: "2026-10-05" });
  await memory(dir, "mem-bbbb0004", "Area lesson.", { scope: "area", areas: [AREA] }, { updated: "2026-09-01" });
  await memory(dir, "mem-bbbb0005", "Project lesson b.", { scope: "project", projects: [PROJECT] }, { updated: "2026-10-03" });
  await memory(dir, "mem-bbbb0006", "Project lesson a.", { scope: "project", projects: [PROJECT] }, { updated: "2026-10-03" });
  await memory(dir, "mem-bbbb0007", "Project billing invoices lesson.", { scope: "project", projects: [PROJECT] }, { updated: "2026-09-02" });
  const plain = await recall(dir, "--pack", "--repo", repo);
  assert.deepEqual(ids(plain.memories), ["mem-bbbb0005", "mem-bbbb0006", "mem-bbbb0007", "mem-bbbb0004", "mem-bbbb0003", "mem-bbbb0001", "mem-bbbb0002"]);
  // "billing invoices" overlaps two tokens of mem-bbbb0007 and one of mem-bbbb0001: each rises within its level, never across.
  const task = await recall(dir, "--pack", "--repo", repo, "--task", "Fix the billing invoices");
  assert.deepEqual(ids(task.memories), ["mem-bbbb0007", "mem-bbbb0005", "mem-bbbb0006", "mem-bbbb0004", "mem-bbbb0003", "mem-bbbb0001", "mem-bbbb0002"]);
  // Exact tokens only: "bill" is no prefix match.
  const prefix = await recall(dir, "--pack", "--repo", repo, "--task", "bill");
  assert.deepEqual(ids(prefix.memories), ids(plain.memories));
});

test("the text is the framing line, the work lines and the memory lines, byte for byte, with labels (memory.md §5.3)", async (context) => {
  const { dir, repo, parent } = await world(context);
  await marker(repo, LINKED);
  await kit(repo, patternTasks);
  await copyFile(TASKS_FIXTURE, join(repo, "TASKS.md"));
  await memory(dir, "mem-cccc0001", "Ask before migrations.", { scope: "project", projects: [PROJECT] });
  await memory(dir, "mem-cccc0002", "Users prefer short replies.", { scope: "general" }, { confidence: "inferred", updated: "2026-10-02" });
  await memory(dir, "mem-cccc0003", "The staging key may be stale.", { scope: "general" }, { confidence: "unverified" });
  const pack = await recall(dir, "--pack", "--repo", repo);
  assert.equal(pack.text, [
    `Brain context for acme-api (${PROJECT}).`,
    "- Work AB-2 (in progress): Retry the import — stopped: 2026-11-07: parser done; the date test fails on leap years; next: fix it",
    "- Work AB-3 (review): Review the parser",
    "- Work AB-5 (In Progress): Tidy the logs",
    "- Ask before migrations.",
    "- Users prefer short replies. (inferred)",
    "- The staging key may be stale. (unverified)",
  ].join("\n"));
  assert.equal(pack.tokens, estimate(pack.text));
  assert.equal(pack.budget, 800);
  assert.deepEqual(pack.memories[1], { id: "mem-cccc0002", text: "Users prefer short replies.", scope: "general", confidence: "inferred", updated: "2026-10-02", path: "memories/2026/10/2026-10-02-mem-cccc0002.md" });
  // No project in .brain, then no .brain at all.
  await marker(repo, { repo: "acme-api" });
  assert.equal((await recall(dir, "--pack", "--repo", repo)).text.split("\n")[0], "Brain context for acme-api.");
  const plain = join(parent, "plain");
  await mkdir(plain);
  const none = await recall(dir, "--pack", "--repo", plain);
  assert.equal(none.text, "Brain context for this folder.\n- Users prefer short replies. (inferred)\n- The staging key may be stale. (unverified)");
});

test("a memory's text is its summary, else its body's first paragraph, cut at a word boundary within 300 characters (memory.md §5.3)", async (context) => {
  const { dir, repo } = await world(context);
  const long = `${"word ".repeat(70)}tail`;
  await memory(dir, "mem-dddd0001", long, { scope: "general" }, { updated: "2026-10-03" });
  await memory(dir, "mem-dddd0002", undefined as unknown as string, { scope: "general" }, { summary: undefined, updated: "2026-10-02" }, "# A heading\n\nFirst line\nsecond line.\n\nA later paragraph.\n");
  const pack = await recall(dir, "--pack", "--repo", repo);
  const [first, second] = pack.memories;
  assert.ok(first.text.length <= 300);
  assert.equal(first.text, "word ".repeat(60).trim());
  assert.equal(second.text, "First line second line.");
});

test("the budget: work first, then memories, each whole; one that doesn't fit is left out and later ones still tried (memory.md §5.1, §5.2)", async (context) => {
  const { dir, repo } = await world(context);
  await marker(repo, LINKED);
  await memory(dir, "mem-eeee0001", "Small first.", { scope: "project", projects: [PROJECT] }, { updated: "2026-10-05" });
  await memory(dir, "mem-eeee0002", `Large ${"x".repeat(280)}`, { scope: "project", projects: [PROJECT] }, { updated: "2026-10-04" });
  await memory(dir, "mem-eeee0003", `Large too ${"y".repeat(280)}`, { scope: "project", projects: [PROJECT] }, { updated: "2026-10-03" });
  await memory(dir, "mem-eeee0004", "Small last.", { scope: "general" });
  // Each large line is about 100 tokens; at 200 the first large one fits, the second doesn't, and the small last one still does.
  const pack = await recall(dir, "--pack", "--repo", repo, "--budget", "200");
  assert.deepEqual(ids(pack.memories), ["mem-eeee0001", "mem-eeee0002", "mem-eeee0004"]);
  assert.deepEqual(pack.omitted, { memories: 1, work: 0 });
  assert.equal(pack.budget, 200);
  assert.equal(pack.tokens, estimate(pack.text));
  assert.ok(pack.tokens <= 200);
  assert.ok(!pack.text.includes("Large too"));
  // The default budget holds them all; the upper bound is accepted.
  assert.equal((await recall(dir, "--pack", "--repo", repo)).memories.length, 4);
  assert.equal((await recall(dir, "--pack", "--repo", repo, "--budget", "4000")).budget, 4000);
});

test("work is left out whole by the budget too, and a pack where nothing fits is empty (memory.md §5.1, §5.3)", async (context) => {
  const { dir, repo } = await world(context);
  await marker(repo, { repo: "x".repeat(700) });
  await memory(dir, "mem-ffff0001", "A general lesson.", { scope: "general" });
  // The framing line alone is over 200 tokens: nothing fits, and the framing line is never delivered alone.
  const pack = await recall(dir, "--pack", "--repo", repo, "--budget", "200");
  assert.deepEqual({ text: pack.text, tokens: pack.tokens, memories: pack.memories, work: pack.work, omitted: pack.omitted }, { text: "", tokens: 0, memories: [], work: [], omitted: { memories: 1, work: 0 } });
  // A long stopped line is cut to 300 characters.
  await marker(repo, LINKED);
  await kit(repo, patternTasks);
  const fixture = await readFile(TASKS_FIXTURE, "utf8");
  await writeFile(join(repo, "TASKS.md"), fixture.replace("**Stopped:** 2026-11-07: parser done; the date test fails on leap years; next: fix it", `**Stopped:** ${"z".repeat(400)}`));
  assert.equal((await recall(dir, "--pack", "--repo", repo)).work[0].stopped, "z".repeat(300));
  // A work line over the budget is left out whole; the work and the memory after it still fit.
  await writeFile(join(repo, "TASKS.md"), fixture.replace("Retry the import", `Retry ${"r".repeat(900)}`));
  const withWork = await recall(dir, "--pack", "--repo", repo, "--budget", "200");
  assert.deepEqual(withWork.work.map((item: { task: string }) => item.task), ["AB-3", "AB-5"]);
  assert.deepEqual(ids(withWork.memories), ["mem-ffff0001"]);
  assert.deepEqual(withWork.omitted, { memories: 0, work: 1 });
  assert.ok(withWork.tokens <= 200);
  assert.equal(withWork.tokens, estimate(withWork.text));
});

test("the work section: active rows of a tracked-in-repo markdown kit in file order, with their stopped lines (memory.md §5.1)", async (context) => {
  const { dir, repo } = await world(context);
  await marker(repo, LINKED);
  await kit(repo, patternTasks);
  await copyFile(TASKS_FIXTURE, join(repo, "TASKS.md"));
  const pack = await recall(dir, "--pack", "--repo", repo);
  assert.deepEqual(pack.work, [
    { task: "AB-2", title: "Retry the import", status: "in progress", stopped: "2026-11-07: parser done; the date test fails on leap years; next: fix it", source: "TASKS.md" },
    { task: "AB-3", title: "Review the parser", status: "review", stopped: null, source: "TASKS.md" },
    { task: "AB-5", title: "Tidy the logs", status: "In Progress", stopped: null, source: "TASKS.md" },
  ]);
  assert.equal(pack.work_unread, null);
  // A checklist source, with the kit's own map for "/": item keys are line hashes (linked-repos.md §2.4).
  await mkdir(join(repo, "docs"), { recursive: true });
  await writeFile(join(repo, "docs", "todo.md"), "- [x] Done thing\n- [/] Doing thing\n**Stopped:** half done\n- [ ] Next thing\n");
  await kit(repo, { mode: "tracked-in-repo", source: { kind: "markdown", path: "docs/todo.md", format: "checklist" }, status_map: { "/": "in_progress" } });
  const checklist = await recall(dir, "--pack", "--repo", repo);
  assert.equal(checklist.work.length, 1);
  assert.match(checklist.work[0].task, /^line:[0-9a-f]{12}$/);
  assert.deepEqual({ ...checklist.work[0], task: undefined }, { task: undefined, title: "Doing thing", status: "/", stopped: "half done", source: "docs/todo.md" });
});

test("no kit, a connected or GitHub kit gives no work; an invalid kit or an unreadable task file gives work_unread (memory.md §5.1)", async (context) => {
  const { dir, repo } = await world(context);
  await marker(repo, LINKED);
  await memory(dir, "mem-gggg0001", "A general lesson.", { scope: "general" });
  const none = await recall(dir, "--pack", "--repo", repo);
  assert.deepEqual({ work: none.work, work_unread: none.work_unread }, { work: [], work_unread: null });
  await kit(repo, { mode: "connected", source: { kind: "notion" } });
  assert.deepEqual((await recall(dir, "--pack", "--repo", repo)).work_unread, null);
  await kit(repo, { mode: "tracked-in-repo", source: { kind: "github", repo: "acme/api" } });
  assert.deepEqual((await recall(dir, "--pack", "--repo", repo)).work, []);
  // The task file is missing.
  await kit(repo, patternTasks);
  const missing = await recall(dir, "--pack", "--repo", repo);
  assert.deepEqual({ work: missing.work, work_unread: missing.work_unread, memories: ids(missing.memories) }, { work: [], work_unread: "TASKS.md", memories: ["mem-gggg0001"] });
  // Not JSON, an area that isn't in the brain, a task path never_read covers: invalid kits.
  await copyFile(TASKS_FIXTURE, join(repo, "TASKS.md"));
  await writeFile(join(repo, "brain-kit.json"), "{ not json");
  assert.equal((await recall(dir, "--pack", "--repo", repo)).work_unread, "brain-kit.json");
  await kit(repo, patternTasks, { placement: { area: "area-9z9z9z9z" } });
  assert.equal((await recall(dir, "--pack", "--repo", repo)).work_unread, "brain-kit.json");
  await kit(repo, patternTasks, { knowledge: { patterns: ["docs/**"], never_read: ["TASKS.md"] } });
  const neverRead = await recall(dir, "--pack", "--repo", repo);
  assert.deepEqual({ work: neverRead.work, work_unread: neverRead.work_unread }, { work: [], work_unread: "brain-kit.json" });
});

test("with no eligible memory and no active work the pack is empty (memory.md §5.3)", async (context) => {
  const { dir, repo } = await world(context);
  await marker(repo, LINKED);
  await memory(dir, "mem-hhhh0001", "A draft.", { scope: "general" }, { lifecycle: "draft" });
  const pack = await recall(dir, "--pack", "--repo", repo);
  assert.deepEqual(pack, { caller: LINKED, budget: 800, tokens: 0, work: [], memories: [], omitted: { memories: 0, work: 0 }, work_unread: null, text: "" });
});

test("--search ranks eligible memories as query --candidates does, with the boost from the memory's projects and areas (memory.md §6.1)", async (context) => {
  const { dir, repo } = await world(context);
  await marker(repo, { repo: "acme-api", project: PROJECT, stacks: ["supabase"] });
  await memory(dir, "mem-jjjj0001", "Migrations need a backup.", { scope: "general" }, { updated: "2026-10-01" });
  await memory(dir, "mem-jjjj0002", "Migrations go through staging.", { scope: "project", projects: [PROJECT] }, { updated: "2026-09-01" });
  await memory(dir, "mem-jjjj0003", "Migrations are billed hourly.", { scope: "area", areas: [AREA] }, { updated: "2026-09-01" });
  await memory(dir, "mem-jjjj0004", "Unrelated lesson.", { scope: "project", projects: [PROJECT] });
  await memory(dir, "mem-jjjj0005", "A draft about migrations.", { scope: "general" }, { lifecycle: "draft" });
  await memory(dir, "mem-jjjj0006", "Migrations elsewhere.", { scope: "project", projects: [OTHER_PROJECT] });
  const search = await recall(dir, "--search", "migrations", "--repo", repo);
  // Summary +3, body none; project +3, the project's area +2. The unrelated project memory scores 3 from the boost alone, as in query.
  assert.deepEqual(search.results.map((result: { id: string; score: number }) => [result.id, result.score]), [
    ["mem-jjjj0002", 6], ["mem-jjjj0003", 5], ["mem-jjjj0001", 3], ["mem-jjjj0004", 3],
  ]);
  assert.deepEqual(search.results[0], { id: "mem-jjjj0002", text: "Migrations go through staging.", scope: "project", confidence: "verified", updated: "2026-09-01", path: "memories/2026/09/2026-09-01-mem-jjjj0002.md", score: 6 });
  assert.equal(search.query, "migrations");
  assert.deepEqual(search.caller, { repo: "acme-api", project: PROJECT, area: null, stacks: ["supabase"] });
  assert.equal(search.tokens, estimate(search.results.map((result: { text: string }) => result.text).join("\n")));
  assert.equal((await recall(dir, "--search", "migrations", "--repo", repo, "--limit", "1")).results.length, 1);
  assert.deepEqual((await recall(dir, "--search", "nothing-matches-this", "--repo", join(repo, ".."))).results, []);
});

test("--include-superseded adds superseded memories after the eligible ones, marked; drafts and out-of-reach ones never (memory.md §6.1)", async (context) => {
  const { dir, repo } = await world(context);
  await eligibilityBrain(dir);
  await memory(dir, "mem-aaaa0016", "Old draft rule.", { scope: "general" }, { lifecycle: "draft", relations: [{ type: "superseded_by", target: "mem-aaaa0001" }] });
  await memory(dir, "mem-aaaa0017", "Old rule elsewhere.", { scope: "project", projects: [OTHER_PROJECT] }, { lifecycle: "archived", relations: [{ type: "superseded_by", target: "mem-aaaa0003" }] });
  await marker(repo, LINKED);
  // A project memory scores 3 from the boost alone and an area memory 2, as in query.
  const without = await recall(dir, "--search", "rule", "--repo", repo);
  assert.deepEqual(ids(without.results), ["mem-aaaa0011", "mem-aaaa0002", "mem-aaaa0004"]);
  const withOld = await recall(dir, "--search", "rule", "--repo", repo, "--include-superseded");
  assert.deepEqual(withOld.results.map((result: { id: string; superseded_by?: string }) => [result.id, result.superseded_by]), [
    ["mem-aaaa0011", undefined], ["mem-aaaa0002", undefined], ["mem-aaaa0004", undefined], ["mem-aaaa0010", "mem-aaaa0011"],
  ]);
  // A reviewed memory that something supersedes comes back too, and the superseded ones rank among themselves.
  const reviewedOld = await recall(dir, "--search", "superseded", "--repo", repo, "--include-superseded");
  assert.deepEqual(reviewedOld.results.map((result: { id: string; superseded_by?: string }) => [result.id, result.superseded_by]), [
    ["mem-aaaa0011", undefined], ["mem-aaaa0002", undefined], ["mem-aaaa0004", undefined], ["mem-aaaa0012", "mem-aaaa0001"], ["mem-aaaa0010", "mem-aaaa0011"],
  ]);
  // --limit counts the whole list.
  assert.deepEqual(ids((await recall(dir, "--search", "rule", "--repo", repo, "--include-superseded", "--limit", "1")).results), ["mem-aaaa0011"]);
});

test("no cache: a second call sees a supersession and a lifecycle change (memory.md §7)", async (context) => {
  const { dir, repo } = await world(context);
  await marker(repo, LINKED);
  const oldPath = await memory(dir, "mem-kkkk0001", "Deploy on Fridays.", { scope: "project", projects: [PROJECT] });
  const otherPath = await memory(dir, "mem-kkkk0002", "Write tests first.", { scope: "general" });
  assert.deepEqual(ids((await recall(dir, "--pack", "--repo", repo)).memories), ["mem-kkkk0001", "mem-kkkk0002"]);
  await memory(dir, "mem-kkkk0001", "Deploy on Fridays.", { scope: "project", projects: [PROJECT] }, { lifecycle: "archived", relations: [{ type: "superseded_by", target: "mem-kkkk0003" }] });
  await memory(dir, "mem-kkkk0003", "Never deploy on Fridays.", { scope: "project", projects: [PROJECT] }, { relations: [{ type: "supersedes", target: "mem-kkkk0001" }], updated: "2026-10-01" });
  assert.deepEqual(ids((await recall(dir, "--pack", "--repo", repo)).memories), ["mem-kkkk0003", "mem-kkkk0002"]);
  assert.deepEqual(ids((await recall(dir, "--search", "deploy", "--repo", repo)).results), ["mem-kkkk0003"]);
  await writeFile(join(dir, otherPath), (await readFile(join(dir, otherPath), "utf8")).replace("lifecycle: reviewed", "lifecycle: disputed"));
  assert.deepEqual(ids((await recall(dir, "--pack", "--repo", repo)).memories), ["mem-kkkk0003"]);
  assert.ok(oldPath.endsWith("mem-kkkk0001.md"));
});

test("every USAGE case of cli.md §5.33, and SUPPRESSIONS_UNREADABLE", async (context) => {
  const { dir, repo, parent } = await world(context);
  await writeFile(join(parent, "file.txt"), "not a folder");
  const cases: string[][] = [
    [],
    ["--pack", "--search", "x"],
    ["--pack", "extra"],
    ["--search", "x", "extra"],
    ["--pack", "--budget", "199"],
    ["--pack", "--budget", "4001"],
    ["--pack", "--budget", "1.5"],
    ["--pack", "--budget", "abc"],
    ["--search", "x", "--limit", "0"],
    ["--search", "x", "--limit", "51"],
    ["--search", "x", "--limit", "two"],
    ["--search", "x", "--task", "t"],
    ["--search", "x", "--budget", "300"],
    ["--pack", "--limit", "5"],
    ["--pack", "--include-superseded"],
    ["--pack", "--repo", join(parent, "missing")],
    ["--pack", "--repo", join(parent, "file.txt")],
    ["--search", "x", "--repo", join(parent, "missing")],
  ];
  for (const args of cases) {
    const result = await brain(["recall", ...args, "--brain", dir, "--json"]);
    assert.equal(result.code, 2, `${args.join(" ")}: ${result.stdout}`);
    assert.equal(result.json.error.code, "USAGE", args.join(" "));
  }
  await writeFile(join(repo, ".brain"), "{ not json");
  const badJson = await brain(["recall", "--pack", "--repo", repo, "--brain", dir, "--json"]);
  assert.equal(badJson.json.error.code, "USAGE");
  assert.match(badJson.json.error.message, /\.brain in /);
  await writeFile(join(repo, ".brain"), JSON.stringify({ repo: "acme-api", extra: true }));
  assert.equal((await brain(["recall", "--search", "x", "--repo", repo, "--brain", dir, "--json"])).json.error.code, "USAGE");
  await rm(join(repo, ".brain"));
  await mkdir(join(dir, "_suppressions"), { recursive: true });
  await writeFile(join(dir, "_suppressions", "broken.json"), "{ not json");
  for (const args of [["--pack"], ["--search", "x"]]) {
    const result = await brain(["recall", ...args, "--repo", repo, "--brain", dir, "--json"]);
    assert.equal(result.json.error.code, "SUPPRESSIONS_UNREADABLE", args.join(" "));
  }
});
