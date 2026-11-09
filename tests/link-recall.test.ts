import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { buildManifest, serializeManifest } from "../src/lib/skills-snapshot.ts";
import { FORK_META, initBrain, productRoot, run, SNAPSHOTS, snapshotCopy, temp } from "./skills-fixtures.ts";

// spec/cli.md §5.12 "Recall paragraph", §5.3; spec/schema.md §12 `settings.recall`; spec/memory.md §7.
type Context = Parameters<typeof temp>[0];

const RECALL = "At the start of substantive work, run `brain recall --pack --json` here and read its `text`: the user's lessons for this repo and where its work stopped. Mention a memory only when it shapes your approach. When the user says \"wrap up\", run the closing review of the `brain-query` skill: the lessons the user approves there are the one write this repo makes to the brain.";

const BLOCK_START = "<!-- ultimate-brain:start -->\n## Ultimate Brain\n\nManaged by `brain link`; edits inside this block are overwritten.\n\nThis repo is linked to the user's second brain.\n\n"
  + "The brain holds decisions, key facts, people and meeting history that this repo does not.\n\nConsult it before you:\n"
  + "- make or revisit a decision about scope, architecture, vendors or the client;\n- answer why something was decided, who someone is, or a date, budget or owner;\n"
  + "- rely on a fact about the client or project that this repo does not state.\n\n"
  + "How: use the `brain-query` skill, or run `brain query --candidates \"<question>\" --json` and read the notes it returns. Cite the note paths. Say when a fact is `contested` or `superseded`.\n\n";
const READ_ONLY = "The brain is read-only from this repo. Never edit its files from here.";
const END = "\n<!-- ultimate-brain:end -->\n";
const WORKFLOW = "To track this repo's work, the standard way or connected to a Notion Project or Area, use the `brain-workflow` skill; to take over its existing plans and tasks, use `brain-workflow-adopt`.\n\n";
const WORKFLOW_READ_ONLY = `${READ_ONLY} A connected workflow's records change only through \`brain workflow\` commands.`;

/** Snapshot A (brain-query only linked) or one that also links both workflow skills (skills-delivery §9.7). */
async function product(context: Context, workflow: boolean): Promise<string> {
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

/** A fresh brain from `init`, a linked folder, and helpers that run `config set` and `link` against them. */
async function setup(context: Context, workflow = false) {
  const home = await temp(context);
  const productPath = await product(context, workflow);
  const brain = await initBrain(context, productPath, home);
  const repo = await temp(context, "recall-repo-");
  const cli = (args: string[]) => run([...args, "--brain", brain, "--json"], { product: productPath, home });
  const setRecall = async (value: string) => {
    const result = await cli(["config", "set", "settings.recall", value]);
    assert.equal(result.code, 0, result.stdout);
    return result;
  };
  const link = async () => {
    const result = await cli(["link", repo]);
    assert.equal(result.code, 0, result.stdout);
    return result;
  };
  const agents = () => readFile(join(repo, "AGENTS.md"), "utf8");
  return { brain, repo, cli, setRecall, link, agents };
}

test("with settings.recall opening, link writes the recall paragraph byte for byte right after the How: paragraph", async (context) => {
  const { setRecall, link, agents } = await setup(context);
  await setRecall('"opening"');
  await link();
  assert.equal(await agents(), `${BLOCK_START}${RECALL}\n\n${READ_ONLY}${END}`);
});

test("with the workflow lines, the recall paragraph comes after How: and before the workflow paragraph", async (context) => {
  const { setRecall, link, agents } = await setup(context, true);
  await setRecall('"opening"');
  await link();
  assert.equal(await agents(), `${BLOCK_START}${RECALL}\n\n${WORKFLOW}${WORKFLOW_READ_ONLY}${END}`);
});

test("with settings.recall off or absent, the block has no recall paragraph", async (context) => {
  for (const workflow of [false, true]) {
    const expected = workflow ? `${BLOCK_START}${WORKFLOW}${WORKFLOW_READ_ONLY}${END}` : `${BLOCK_START}${READ_ONLY}${END}`;
    const absent = await setup(context, workflow);
    const config = JSON.parse(await readFile(join(absent.brain, "brain.json"), "utf8"));
    assert.equal(config.settings?.recall, undefined, "a new brain leaves settings.recall absent");
    await absent.link();
    assert.equal(await absent.agents(), expected, `absent, workflow ${workflow}`);

    const off = await setup(context, workflow);
    await off.setRecall('"off"');
    await off.link();
    assert.equal(await off.agents(), expected, `off, workflow ${workflow}`);
  }
});

test("a second link with recall opening changes no bytes", async (context) => {
  const { repo, setRecall, link } = await setup(context, true);
  await setRecall('"opening"');
  await link();
  const read = () => Promise.all([".brain", "AGENTS.md", "CLAUDE.md"].map((path) => readFile(join(repo, path), "utf8")));
  const before = await read();
  const second = await link();
  assert.equal(second.json.data.marker.written, false);
  for (const file of second.json.data.files) assert.equal(file.action, "unchanged", file.path);
  assert.deepEqual(await read(), before);
});

test("turning recall off and linking again removes the paragraph from AGENTS.md and CLAUDE.md, leaving the rest as it was", async (context) => {
  const { repo, setRecall, link, agents } = await setup(context);
  await writeFile(join(repo, "AGENTS.md"), "# Local rules\n\nKeep this.\n");
  await writeFile(join(repo, "CLAUDE.md"), "# Claude notes\n");
  await setRecall('"opening"');
  await link();
  const withRecall = `${BLOCK_START}${RECALL}\n\n${READ_ONLY}${END}`;
  assert.equal(await agents(), `# Local rules\n\nKeep this.\n\n${withRecall}`);
  assert.equal(await readFile(join(repo, "CLAUDE.md"), "utf8"), `# Claude notes\n\n${withRecall}`);

  await setRecall('"off"');
  const relink = await link();
  const without = `${BLOCK_START}${READ_ONLY}${END}`;
  assert.equal(await agents(), `# Local rules\n\nKeep this.\n\n${without}`);
  assert.equal(await readFile(join(repo, "CLAUDE.md"), "utf8"), `# Claude notes\n\n${without}`);
  assert.deepEqual(relink.json.data.files.slice(0, 2), [{ path: "AGENTS.md", action: "updated" }, { path: "CLAUDE.md", action: "updated" }]);

  await setRecall('"opening"');
  await link();
  assert.equal(await agents(), `# Local rules\n\nKeep this.\n\n${withRecall}`, "turning it back on adds it again");
});

test("config set settings.recall accepts \"off\" and \"opening\" and refuses anything else", async (context) => {
  const { brain, cli, setRecall } = await setup(context);
  const opening = await setRecall('"opening"');
  assert.deepEqual(opening.json.data, { path: "settings.recall", previous: null, value: "opening" });
  const off = await setRecall('"off"');
  assert.deepEqual(off.json.data, { path: "settings.recall", previous: "opening", value: "off" });
  const before = await readFile(join(brain, "brain.json"), "utf8");
  for (const value of ['"on"', "true", '"Opening"']) {
    const refused = await cli(["config", "set", "settings.recall", value]);
    assert.equal(refused.code, 4, `${value}: ${refused.stdout}`);
    assert.equal(refused.json.error.code, "INPUT_INVALID", value);
  }
  assert.equal(await readFile(join(brain, "brain.json"), "utf8"), before, "a refused value writes nothing");
});
