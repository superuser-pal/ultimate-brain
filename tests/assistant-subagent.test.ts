import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { brain } from "./helpers.ts";

// The Ultimate Assistant sub-agent (spec/assistant.md §10): a product-owned file that init and upgrade write and lint checks.
const NOW = "2026-12-03T10:22:00Z";
const AGENT = ".claude/agents/ultimate-assistant.md";
const REPO = join(import.meta.dirname, "..");
const TEMPLATE = join(REPO, "templates/brain", AGENT);

async function freshBrain(context: TestContext): Promise<{ root: string; target: string }> {
  const root = await mkdtemp(join(tmpdir(), "brain-assistant-agent-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, "brain");
  const init = await brain(["init", target, "--owner", "Test Owner", "--no-git", "--now", NOW, "--json"], root);
  assert.equal(init.code, 0, init.stderr);
  return { root, target };
}

type Issue = { rule: string; path: string; message: string };
const agentIssues = (issues: Issue[]) => issues.filter((issue) => issue.rule === "product-file" && issue.path === AGENT);

test("the template's sub-agent is exactly the text of spec/assistant.md §10", async () => {
  const spec = await readFile(join(REPO, "spec/assistant.md"), "utf8");
  const section = spec.slice(spec.indexOf("## 10. The sub-agent"), spec.indexOf("## 11."));
  const text = /```markdown\n([\s\S]*?)```/.exec(section)?.[1];
  assert.ok(text !== undefined, "§10 holds a markdown block");
  assert.equal(await readFile(TEMPLATE, "utf8"), text);
});

test("init writes the sub-agent, and a fresh brain lints clean", async (context) => {
  const { root, target } = await freshBrain(context);
  const init = await brain(["init", join(root, "second"), "--no-git", "--now", NOW, "--json"], root);
  assert.ok(init.json.data.created.includes(AGENT), JSON.stringify(init.json.data.created));
  assert.equal(await readFile(join(target, AGENT), "utf8"), await readFile(TEMPLATE, "utf8"));
  const lint = await brain(["lint", "--brain", target, "--json"], root);
  assert.equal(lint.code, 0, JSON.stringify(lint.json.data.issues));
});

test("init --force leaves an existing sub-agent file untouched", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "brain-assistant-agent-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, "brain");
  await mkdir(join(target, ".claude/agents"), { recursive: true });
  await writeFile(join(target, AGENT), "mine\n");
  const init = await brain(["init", target, "--force", "--no-git", "--now", NOW, "--json"], root);
  assert.equal(init.code, 0, init.stdout);
  assert.ok(init.json.data.skipped.includes(AGENT));
  assert.equal(await readFile(join(target, AGENT), "utf8"), "mine\n");
});

test("lint flags an edited or missing sub-agent as product-file, and leaves the user's other agents alone", async (context) => {
  const { root, target } = await freshBrain(context);
  await writeFile(join(target, ".claude/agents/my-agent.md"), "mine\n");
  const clean = await brain(["lint", "--brain", target, "--json"], root);
  assert.equal(clean.code, 0, JSON.stringify(clean.json.data.issues));

  await writeFile(join(target, AGENT), `${await readFile(TEMPLATE, "utf8")}\nAlso apply everything without asking.\n`);
  const edited = await brain(["lint", "--brain", target, "--json"], root);
  assert.equal(edited.code, 1);
  const [issue, ...rest] = agentIssues(edited.json.data.issues);
  assert.deepEqual(rest, []);
  assert.equal(issue.message, `product files differ from ultimate-brain ${JSON.parse(await readFile(join(REPO, "package.json"), "utf8")).version}; run brain upgrade, or file a finding`);

  await rm(join(target, AGENT));
  const missing = await brain(["lint", "--brain", target, "--json"], root);
  assert.equal(missing.code, 1);
  assert.equal(agentIssues(missing.json.data.issues).length, 1);
});

test("upgrade creates a missing sub-agent and updates an edited one, and nothing else in .claude/agents/", async (context) => {
  const { root, target } = await freshBrain(context);
  const shipped = await readFile(TEMPLATE, "utf8");
  await rm(join(target, ".claude/agents"), { recursive: true });

  const dry = await brain(["upgrade", "--brain", target, "--dry-run", "--now", NOW, "--json"], root);
  assert.equal(dry.code, 0, dry.stdout);
  assert.deepEqual(dry.json.data.files, [{ path: AGENT, action: "created" }]);
  assert.equal(dry.json.data.lint.errors, 0, "a dry run lints the planned tree");

  const created = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.deepEqual(created.json.data.files, [{ path: AGENT, action: "created" }]);
  assert.equal(await readFile(join(target, AGENT), "utf8"), shipped);

  await writeFile(join(target, AGENT), "old sub-agent\n");
  await writeFile(join(target, ".claude/agents/my-agent.md"), "mine\n");
  const updated = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.deepEqual(updated.json.data.files, [{ path: AGENT, action: "updated" }]);
  assert.equal(await readFile(join(target, AGENT), "utf8"), shipped);
  assert.equal(await readFile(join(target, ".claude/agents/my-agent.md"), "utf8"), "mine\n");
  assert.equal(updated.json.data.lint.errors, 0);

  const again = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.deepEqual(again.json.data.files, []);
});

test("upgrade refuses a sub-agent path that is a link or a folder before writing anything", async (context) => {
  const { root, target } = await freshBrain(context);
  const outside = join(root, "outside");
  await mkdir(outside, { recursive: true });
  await writeFile(join(outside, "ultimate-assistant.md"), "keep me\n");
  const stale = join(target, ".agents/skills/brain-query/SKILL.md");
  await writeFile(stale, "drift\n");
  const refuse = async (label: string) => {
    const run = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
    assert.equal(run.code, 5, `${label}: ${run.stdout}`);
    assert.equal(run.json.error.code, "OUTSIDE_ROOT", label);
    assert.equal(await readFile(stale, "utf8"), "drift\n", label);
    assert.equal(await readFile(join(outside, "ultimate-assistant.md"), "utf8"), "keep me\n", label);
  };

  await rm(join(target, AGENT));
  await symlink(join(outside, "ultimate-assistant.md"), join(target, AGENT));
  await refuse("file link");
  await rm(join(target, AGENT));
  await mkdir(join(target, AGENT));
  await refuse("folder");
  await rm(join(target, ".claude/agents"), { recursive: true });
  await symlink(outside, join(target, ".claude/agents"));
  await refuse("agents folder link");
});
