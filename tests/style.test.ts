import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { promisify } from "node:util";

import { buildManifest, serializeManifest } from "../src/lib/skills-snapshot.ts";
import { brain, fixtureCopy } from "./helpers.ts";
import { FORK_META, initBrain, productRoot, run, SNAPSHOTS, snapshotCopy, temp } from "./skills-fixtures.ts";

/**
 * CC-210 (decision 0081 §3–§5): `settings.style` in brain.json (spec/schema.md §12) reaches the agent as the style block in the brain's
 * AGENTS.md and the style paragraph in a linked folder's block (spec/cli.md §5.3, §5.3.1, §5.12, §5.15 steps 1a and 9), and `brain status`
 * reports it (§5.2). Synthetic brains only.
 */

const exec = promisify(execFile);
const NOW = "2026-12-03T10:22:00Z";
const RULES_END = "<!-- ultimate-brain:rules:end -->";

/** cli.md §5.3.1's style lines, normative bytes. */
const LINE = {
  expert: "Don't define terms: the user knows them.",
  plain: "Use plain words and no jargon. When a term is needed, explain it with a short example the first time you use it.",
  short: "Keep answers short: show at most five items at a time, say how many more there are, and show them when the user says \"more\".",
  full: "Give full answers: the details and the reasons, not only the outcome.",
  answerFirst: "Put the answer or the next action on the first line. In work with several steps, say where the user is (\"step 3 of 5\") in every reply.",
};
const SIMPLE = [LINE.plain, LINE.short, LINE.answerFirst];

function styleBlock(lines: readonly string[]): string {
  return "<!-- ultimate-brain:style:start -->\n## How to answer me\n\n"
    + "Written by `brain` from `settings.style` in `brain.json`; edits inside this block are overwritten. To change it, ask in this brain (\"talk to me more simply\", \"shorter answers\", \"go back to normal\"). It shapes your own words only: show text a command returns, such as a report, exactly as it is.\n\n"
    + `${lines.map((line) => `- ${line}`).join("\n")}\n<!-- ultimate-brain:style:end -->`;
}

function styleParagraph(lines: readonly string[]): string {
  return "The user's response style, from the brain's `settings.style`. It shapes your own words only; show text a command returns exactly as it is.\n"
    + lines.map((line) => `- ${line}`).join("\n");
}

/** The brain's AGENTS.md with the style block inserted right after the rules block's end marker (§5.3.1 "Where"). */
function withBlock(original: string, lines: readonly string[]): string {
  const at = original.indexOf(RULES_END) + RULES_END.length;
  return `${original.slice(0, at)}\n\n${styleBlock(lines)}${original.slice(at)}`;
}

function rulesBlock(text: string): string {
  return text.slice(text.search(/<!-- ultimate-brain:rules:start/), text.indexOf(RULES_END) + RULES_END.length);
}

/** A brain made by `brain init` (no Git) with the CLI under test; `cli` runs a command against it with `--json`. */
async function freshBrain(context: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "brain-style-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, "brain");
  const init = await brain(["init", target, "--owner", "Test Owner", "--no-git", "--now", NOW, "--json"], root);
  assert.equal(init.code, 0, init.stderr);
  const cli = (...args: string[]) => brain([...args, "--brain", target, "--now", NOW, "--json"], root);
  const agents = () => readFile(join(target, "AGENTS.md"), "utf8");
  const config = async () => JSON.parse(await readFile(join(target, "brain.json"), "utf8"));
  return { root, target, cli, agents, config, original: await agents() };
}

async function setStyle(cli: (...args: string[]) => ReturnType<typeof brain>, path: string, value: string) {
  const result = await cli("config", "set", path, value);
  assert.equal(result.code, 0, result.stdout || result.stderr);
  return result;
}

// --- brain.json schema (schema §12) ---

test("the schema takes a preset and three dials, each optional, and refuses any other key or level", async (context) => {
  const { cli, config, agents, original } = await freshBrain(context);
  for (const value of ['{ "preset": "simple" }', '{ "preset": "standard" }', '{}', '{ "explain": "expert", "length": "full", "directness": "answer-first" }',
    '{ "preset": "simple", "explain": "some", "length": "normal", "directness": "context-first" }']) {
    await setStyle(cli, "settings.style", value);
  }
  await setStyle(cli, "settings.style", "{}");
  const before = await config();
  for (const value of ['{ "preset": "fancy" }', '{ "tone": "warm" }', '{ "length": "long" }', '{ "explain": "plain", "directness": "context" }', '"simple"', "null"]) {
    const result = await cli("config", "set", "settings.style", value);
    assert.equal(result.code, 4, `${value}: ${result.stdout}`);
    assert.equal(result.json.error.code, "INPUT_INVALID", value);
  }
  const dial = await cli("config", "set", "settings.style.explain", '"plainer"');
  assert.equal(dial.json.error.code, "INPUT_INVALID");
  assert.deepEqual(await config(), before, "a refused value writes nothing");
  assert.equal(await agents(), original);
});

// --- brain config set (cli.md §5.3, §5.3.1) ---

test("config set on settings.style writes, replaces and removes the style block, and adding then removing it restores the file's bytes", async (context) => {
  const { cli, agents, original } = await freshBrain(context);

  const simple = await setStyle(cli, "settings.style", '{ "preset": "simple" }');
  assert.deepEqual(simple.json.data, { path: "settings.style", previous: null, value: { preset: "simple" }, files: [{ path: "AGENTS.md", action: "created" }] });
  assert.equal(await agents(), withBlock(original, SIMPLE));
  assert.match(await agents(), /<!-- ultimate-brain:rules:end -->\n\n<!-- ultimate-brain:style:start -->\n[\s\S]*<!-- ultimate-brain:style:end -->\n\n## My rules\n/);
  assert.equal(rulesBlock(await agents()), rulesBlock(original), "the rules block is left byte for byte");

  // A single dial overrides Simple; a path under settings.style rewrites the block too.
  const dial = await setStyle(cli, "settings.style.explain", '"expert"');
  assert.deepEqual(dial.json.data.files, [{ path: "AGENTS.md", action: "updated" }]);
  assert.equal(await agents(), withBlock(original, [LINE.expert, LINE.short, LINE.answerFirst]));
  await setStyle(cli, "settings.style.length", '"full"');
  assert.equal(await agents(), withBlock(original, [LINE.expert, LINE.full, LINE.answerFirst]));

  // The same style again changes nothing.
  const same = await setStyle(cli, "settings.style.length", '"full"');
  assert.deepEqual(same.json.data.files, [{ path: "AGENTS.md", action: "unchanged" }]);

  // Standard writes no block and removes the earlier one.
  const standard = await setStyle(cli, "settings.style", '{ "preset": "standard" }');
  assert.deepEqual(standard.json.data.files, [{ path: "AGENTS.md", action: "removed" }]);
  assert.equal(await agents(), original, "adding then removing the block leaves the file's bytes as they were");
  const again = await setStyle(cli, "settings.style", "{}");
  assert.deepEqual(again.json.data.files, [{ path: "AGENTS.md", action: "unchanged" }]);
  assert.equal(await agents(), original);
});

test("a single dial overrides Simple, dials at Standard's levels write no line, and Custom dials need no preset", async (context) => {
  const { cli, agents, original } = await freshBrain(context);
  const cases: Array<[string, string[]]> = [
    ['{ "preset": "simple", "length": "normal" }', [LINE.plain, LINE.answerFirst]],
    ['{ "preset": "simple", "directness": "context-first" }', [LINE.plain, LINE.short]],
    ['{ "preset": "simple", "explain": "some", "length": "normal", "directness": "context-first" }', []],
    ['{ "explain": "plain", "length": "full", "directness": "context-first" }', [LINE.plain, LINE.full]],
    ['{ "directness": "answer-first" }', [LINE.answerFirst]],
    ['{ "preset": "standard", "explain": "expert" }', [LINE.expert]],
    ['{ "explain": "some", "length": "normal" }', []],
  ];
  for (const [value, lines] of cases) {
    await setStyle(cli, "settings.style", value);
    assert.equal(await agents(), lines.length === 0 ? original : withBlock(original, lines), value);
  }
});

test("config set on settings writes the block; any other path leaves AGENTS.md alone and reports no files", async (context) => {
  const { target, cli, agents, config, original } = await freshBrain(context);
  const settings = { ...(await config()).settings, style: { preset: "simple" } };
  const whole = await setStyle(cli, "settings", JSON.stringify(settings));
  assert.deepEqual(whole.json.data.files, [{ path: "AGENTS.md", action: "created" }]);
  assert.equal(await agents(), withBlock(original, SIMPLE));

  // The user's edit inside the block is overwritten the next time the block is written; another path never writes it.
  const edited = (await agents()).replace("- Keep answers short", "- Keep answers very short");
  await writeFile(join(target, "AGENTS.md"), edited);
  const push = await setStyle(cli, "settings.push", '"remind"');
  assert.equal("files" in push.json.data, false);
  assert.equal(await agents(), edited);
  const rewrite = await setStyle(cli, "settings.style.preset", '"simple"');
  assert.deepEqual(rewrite.json.data.files, [{ path: "AGENTS.md", action: "updated" }]);
  assert.equal(await agents(), withBlock(original, SIMPLE));
});

test("a missing AGENTS.md or damaged style markers: brain.json is written and AGENTS.md skipped with AGENTS_BLOCK_NOT_FOUND", async (context) => {
  const { target, cli, config, original } = await freshBrain(context);
  const damaged: Array<[string, string | null]> = [
    ["missing", null],
    ["no rules end", original.replace(`${RULES_END}\n`, "")],
    ["a lone style start", original.replace("## My rules", "<!-- ultimate-brain:style:start -->\n\n## My rules")],
    ["two style blocks", `${withBlock(original, [LINE.full])}\n${styleBlock([LINE.full])}\n`],
    ["style markers out of order", original.replace("## My rules", "<!-- ultimate-brain:style:end -->\n<!-- ultimate-brain:style:start -->\n## My rules")],
    ["a style block before the rules end", original.replace(RULES_END, `${styleBlock([LINE.full])}\n${RULES_END}`)],
  ];
  for (const [name, text] of damaged) {
    await rm(join(target, "AGENTS.md"), { force: true });
    if (text !== null) await writeFile(join(target, "AGENTS.md"), text);
    const preset = name === "missing" ? "simple" : "standard";
    const result = await setStyle(cli, "settings.style", JSON.stringify({ preset, explain: "expert" }));
    assert.deepEqual(result.json.data.files, [{ path: "AGENTS.md", action: "skipped" }], name);
    assert.deepEqual(result.json.warnings.map((warning: { code: string }) => warning.code), ["AGENTS_BLOCK_NOT_FOUND"], name);
    assert.deepEqual((await config()).settings.style, { preset, explain: "expert" }, `${name}: brain.json is still written`);
    if (text === null) await assert.rejects(readFile(join(target, "AGENTS.md")), name);
    else assert.equal(await readFile(join(target, "AGENTS.md"), "utf8"), text, `${name}: AGENTS.md is left alone`);
  }
});

test("a symbolic AGENTS.md is OUTSIDE_ROOT before any write, brain.json included", async (context) => {
  const { root, target, cli, config } = await freshBrain(context);
  const elsewhere = join(root, "elsewhere.md");
  await writeFile(elsewhere, await readFile(join(target, "AGENTS.md"), "utf8"));
  await rm(join(target, "AGENTS.md"));
  await symlink(elsewhere, join(target, "AGENTS.md"));
  const before = await config();
  const result = await cli("config", "set", "settings.style", '{ "preset": "simple" }');
  assert.equal(result.json.error.code, "OUTSIDE_ROOT", result.stdout);
  assert.deepEqual(await config(), before);
  // Any other path doesn't read AGENTS.md.
  await setStyle(cli, "settings.push", '"remind"');
});

// --- brain status (cli.md §5.2) ---

test("status reports the stored preset and each dial's effective value, Standard when absent", async (context) => {
  const { cli } = await freshBrain(context);
  const absent = await cli("status");
  assert.deepEqual(absent.json.data.settings.style, { preset: "standard", explain: "some", length: "normal", directness: "context-first" });
  await setStyle(cli, "settings.style", '{ "preset": "simple", "length": "normal" }');
  const simple = await cli("status");
  assert.deepEqual(simple.json.data.settings.style, { preset: "simple", explain: "plain", length: "normal", directness: "answer-first" });
  await setStyle(cli, "settings.style", '{ "explain": "expert" }');
  assert.deepEqual((await cli("status")).json.data.settings.style, { preset: "standard", explain: "expert", length: "normal", directness: "context-first" });
});

// --- brain link (cli.md §5.12) ---

type Context = Parameters<typeof temp>[0];
const LINK_START = "<!-- ultimate-brain:start -->\n## Ultimate Brain\n\nManaged by `brain link`; edits inside this block are overwritten.\n\nThis repo is linked to the user's second brain.\n\n"
  + "The brain holds decisions, key facts, people and meeting history that this repo does not.\n\nConsult it before you:\n"
  + "- make or revisit a decision about scope, architecture, vendors or the client;\n- answer why something was decided, who someone is, or a date, budget or owner;\n"
  + "- rely on a fact about the client or project that this repo does not state.\n\n"
  + "How: use the `brain-query` skill, or run `brain query --candidates \"<question>\" --json` and read the notes it returns with `brain query --read <id> --json`, not by opening the brain's files: only these commands leave out what the user excluded or has not approved. Cite each note by its path, or by its `cite` when it has none. Say when a fact is `contested` or `superseded`; read a replaced memory only with `--historical`, for a question about the past.\n\n";
const RECALL = "At the start of substantive work, run `brain recall --pack --json` here and read its `text`: the user's lessons for this repo and where its work stopped. Mention a memory only when it shapes your approach. When the user says \"wrap up\", run the closing review of the `brain-query` skill: the lessons the user approves there are the one write this repo makes to the brain.";
const WORKFLOW = "To track this repo's work, the standard way or connected to a Notion Project or Area, use the `brain-workflow` skill; to take over its existing plans and tasks, use `brain-workflow-adopt`.";
const READ_ONLY = "The brain is read-only from this repo. Never edit its files from here.";
const WORKFLOW_READ_ONLY = `${READ_ONLY} A connected workflow's records change only through \`brain workflow\` commands.`;
const LINK_END = "\n<!-- ultimate-brain:end -->\n";

async function linkProduct(context: Context, workflow: boolean): Promise<string> {
  if (!workflow) return productRoot(context, join(SNAPSHOTS, "a"), "0.9.2");
  const folder = await snapshotCopy(context, "a");
  const linked = ["brain-query", "brain-workflow", "brain-workflow-adopt"];
  for (const name of linked.slice(1)) {
    await mkdir(join(folder, name), { recursive: true });
    await writeFile(join(folder, name, "SKILL.md"), `---\nname: ${name}\ndescription: a synthetic ${name}\n---\n# ${name}\n`);
  }
  await writeFile(join(folder, "snapshot.json"), serializeManifest(buildManifest(folder, { ...FORK_META("1.1.0"), targets: (name) => (linked.includes(name) ? ["brain", "linked_repo"] : ["brain"]) })));
  return productRoot(context, folder, "0.9.2");
}

async function linkSetup(context: Context, workflow = false) {
  const home = await temp(context);
  const product = await linkProduct(context, workflow);
  const target = await initBrain(context, product, home);
  const repo = await temp(context, "style-repo-");
  const cli = (...args: string[]) => run([...args, "--brain", target, "--json"], { product, home });
  const set = async (path: string, value: string) => {
    const result = await cli("config", "set", path, value);
    assert.equal(result.code, 0, result.stdout);
  };
  const link = async () => {
    const result = await cli("link", repo);
    assert.equal(result.code, 0, result.stdout);
    return result;
  };
  const agents = () => readFile(join(repo, "AGENTS.md"), "utf8");
  return { repo, set, link, agents };
}

test("with no style lines, link writes the block exactly as before 0.14.0", async (context) => {
  for (const value of [undefined, '{ "preset": "standard" }', '{ "preset": "simple", "explain": "some", "length": "normal", "directness": "context-first" }']) {
    const { set, link, agents } = await linkSetup(context);
    if (value !== undefined) await set("settings.style", value);
    await link();
    assert.equal(await agents(), `${LINK_START}${READ_ONLY}${LINK_END}`, String(value));
  }
});

test("link writes the style paragraph right before the read-only line, after the recall and workflow paragraphs", async (context) => {
  const plain = await linkSetup(context);
  await plain.set("settings.style", '{ "preset": "simple" }');
  await plain.link();
  assert.equal(await plain.agents(), `${LINK_START}${styleParagraph(SIMPLE)}\n\n${READ_ONLY}${LINK_END}`);

  const all = await linkSetup(context, true);
  await all.set("settings.recall", '"opening"');
  await all.set("settings.style", '{ "preset": "simple", "explain": "expert" }');
  await all.link();
  assert.equal(await all.agents(), `${LINK_START}${RECALL}\n\n${WORKFLOW}\n\n${styleParagraph([LINE.expert, LINE.short, LINE.answerFirst])}\n\n${WORKFLOW_READ_ONLY}${LINK_END}`);
});

test("a link after a style change refreshes the folder's block, and Standard removes the paragraph; a second link changes no bytes", async (context) => {
  const { repo, set, link, agents } = await linkSetup(context);
  await writeFile(join(repo, "AGENTS.md"), "# Local rules\n\nKeep this.\n");
  await writeFile(join(repo, "CLAUDE.md"), "# Claude notes\n");
  await set("settings.style", '{ "preset": "simple" }');
  await link();
  const simple = `${LINK_START}${styleParagraph(SIMPLE)}\n\n${READ_ONLY}${LINK_END}`;
  assert.equal(await agents(), `# Local rules\n\nKeep this.\n\n${simple}`);
  assert.equal(await readFile(join(repo, "CLAUDE.md"), "utf8"), `# Claude notes\n\n${simple}`);

  await set("settings.style.length", '"full"');
  const refreshed = await link();
  assert.deepEqual(refreshed.json.data.files.slice(0, 2), [{ path: "AGENTS.md", action: "updated" }, { path: "CLAUDE.md", action: "updated" }]);
  assert.equal(await agents(), `# Local rules\n\nKeep this.\n\n${LINK_START}${styleParagraph([LINE.plain, LINE.full, LINE.answerFirst])}\n\n${READ_ONLY}${LINK_END}`);

  const read = () => Promise.all([".brain", "AGENTS.md", "CLAUDE.md"].map((path) => readFile(join(repo, path), "utf8")));
  const before = await read();
  const second = await link();
  for (const file of second.json.data.files) assert.equal(file.action, "unchanged", file.path);
  assert.deepEqual(await read(), before);

  await set("settings.style", '{ "preset": "standard" }');
  await link();
  const without = `${LINK_START}${READ_ONLY}${LINK_END}`;
  assert.equal(await agents(), `# Local rules\n\nKeep this.\n\n${without}`);
  assert.equal(await readFile(join(repo, "CLAUDE.md"), "utf8"), `# Claude notes\n\n${without}`);
});

// --- brain upgrade (cli.md §5.15 steps 1a and 9) ---

/** Write brain.json's `settings.style` directly, as a brain whose block was never written (or written for another style) has it. */
async function storeStyle(target: string, style: unknown): Promise<void> {
  const config = JSON.parse(await readFile(join(target, "brain.json"), "utf8"));
  if (style === undefined) delete config.settings.style;
  else config.settings = { ...config.settings, style };
  await writeFile(join(target, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
}

test("upgrade writes the style block from brain.json, replaces a stale one and removes it for Standard, keeping the rest", async (context) => {
  const { target, cli, agents, original } = await freshBrain(context);
  const mine = `${original}Call the client by its short name.\n`;
  await writeFile(join(target, "AGENTS.md"), mine);
  await storeStyle(target, { preset: "simple" });

  const dry = await cli("upgrade", "--dry-run");
  assert.equal(dry.code, 0, dry.stdout);
  assert.deepEqual(dry.json.data.files, [{ path: "AGENTS.md", action: "updated" }]);
  assert.equal(await agents(), mine, "a dry run writes nothing");

  const first = await cli("upgrade");
  assert.equal(first.code, 0, first.stdout);
  assert.deepEqual(first.json.data.files, [{ path: "AGENTS.md", action: "updated" }]);
  assert.equal(await agents(), withBlock(mine, SIMPLE));
  assert.equal(first.json.data.lint.errors, 0, "lint's product-file check reads only the rules block");

  await storeStyle(target, { preset: "simple", directness: "context-first" });
  await cli("upgrade");
  assert.equal(await agents(), withBlock(mine, [LINE.plain, LINE.short]));

  const unchanged = await cli("upgrade");
  assert.deepEqual(unchanged.json.data.files, []);

  await storeStyle(target, undefined);
  const removed = await cli("upgrade");
  assert.deepEqual(removed.json.data.files, [{ path: "AGENTS.md", action: "updated" }]);
  assert.equal(await agents(), mine);
});

test("upgrade replaces an old rules block and adds the style block in one update, and a created AGENTS.md gets the block too", async (context) => {
  const { target, cli, agents, original } = await freshBrain(context);
  await storeStyle(target, { length: "short" });
  const old = original.replace(rulesBlock(original), "<!-- ultimate-brain:rules:start v0 -->\nold rules\n<!-- ultimate-brain:rules:end -->");
  await writeFile(join(target, "AGENTS.md"), old);
  const result = await cli("upgrade");
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data.files, [{ path: "AGENTS.md", action: "updated" }], "AGENTS.md appears once");
  assert.equal(await agents(), withBlock(original, [LINE.short]));
  assert.equal(rulesBlock(await agents()), rulesBlock(original));

  await rm(join(target, "AGENTS.md"));
  const created = await cli("upgrade");
  assert.deepEqual(created.json.data.files, [{ path: "AGENTS.md", action: "created" }]);
  assert.equal(await agents(), withBlock(original, [LINE.short]));
});

test("upgrade leaves an AGENTS.md with damaged style markers alone, and reads an invalid stored style as absent keys", async (context) => {
  const { target, cli, agents, original } = await freshBrain(context);
  await storeStyle(target, { preset: "simple" });
  const damaged = original.replace("## My rules", "<!-- ultimate-brain:style:end -->\n## My rules");
  await writeFile(join(target, "AGENTS.md"), damaged);
  const skipped = await cli("upgrade");
  assert.deepEqual(skipped.json.data.files, [{ path: "AGENTS.md", action: "skipped" }]);
  assert.ok(skipped.json.warnings.some((warning: { code: string }) => warning.code === "AGENTS_BLOCK_NOT_FOUND"));
  assert.equal(await agents(), damaged);

  await writeFile(join(target, "AGENTS.md"), original);
  await storeStyle(target, { preset: "fancy", explain: "plain", tone: "warm" });
  const invalid = await cli("upgrade");
  assert.equal(invalid.code, 0, invalid.stdout);
  assert.equal(await agents(), withBlock(original, [LINE.plain]));
  await storeStyle(target, "simple");
  await cli("upgrade");
  assert.equal(await agents(), original, "a style that isn't an object reads as {}");

  // A brain.json that isn't JSON leaves the style block as it is, while the rules block is still brought up to date.
  await writeFile(join(target, "AGENTS.md"), withBlock(original, [LINE.full]).replace(rulesBlock(original), "<!-- ultimate-brain:rules:start v0 -->\nold rules\n<!-- ultimate-brain:rules:end -->"));
  await writeFile(join(target, "brain.json"), "{ not json\n");
  const unparseable = await cli("upgrade");
  assert.ok(unparseable.json.warnings.some((warning: { code: string }) => warning.code === "BRAIN_JSON_UNPARSEABLE"), unparseable.stdout);
  assert.equal(await agents(), withBlock(original, [LINE.full]));
});

test("upgrade writes the style paragraph in a registered linked project, as brain link would", async (context) => {
  const dir = await fixtureCopy(context);
  const home = join(dir, "..", "home");
  await mkdir(home);
  const repo = join(dir, "..", "projects", "styled");
  await mkdir(repo, { recursive: true });
  await exec("git", ["init", "-q"], { cwd: repo });
  const linked = await brain(["link", repo, "--brain", dir, "--json"], home);
  assert.equal(linked.code, 0, linked.stdout);
  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  config.repos = [{ name: "styled", path: repo, area: "area-2m7c4h8n", patterns: ["docs/**"], commit: "" }];
  config.settings = { ...config.settings, style: { preset: "simple" } };
  await writeFile(join(dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  const before = await readFile(join(repo, "AGENTS.md"), "utf8");
  assert.doesNotMatch(before, /response style/);

  const upgraded = await brain(["upgrade", "--brain", dir, "--now", NOW, "--json"], home);
  assert.equal(upgraded.code, 0, upgraded.stdout);
  const project = upgraded.json.data.projects[0];
  assert.deepEqual([project.state, project.files], ["upgraded", [{ path: "AGENTS.md", action: "updated" }]]);
  const after = await readFile(join(repo, "AGENTS.md"), "utf8");
  assert.equal(after, before.replace(`\n\n${READ_ONLY}`, `\n\n${styleParagraph(SIMPLE)}\n\n${READ_ONLY}`));

  // What `brain link` writes there now is the same bytes.
  const relink = await brain(["link", repo, "--brain", dir, "--json"], home);
  assert.equal(relink.code, 0, relink.stdout);
  assert.equal(await readFile(join(repo, "AGENTS.md"), "utf8"), after);
});
