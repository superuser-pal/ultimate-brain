import assert from "node:assert/strict";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { initBrain, productRoot, run, SNAPSHOTS, temp } from "./skills-fixtures.ts";

// spec/skills-delivery.md §5 and §6.4; §12.1 test 6.
const A = join(SNAPSHOTS, "a");
const B = join(SNAPSHOTS, "b");
type Issue = { severity: string; rule: string; path: string; message: string };
const skillIssues = (issues: Issue[]) => issues.filter((issue) => /^skill|^product-file/.test(issue.rule));

test("product-file compares the trees against the lock, and a newer compatible package is an update, not drift", async (context) => {
  const home = await temp(context);
  const brain = await initBrain(context, await productRoot(context, A, "0.9.0"), home);
  const newer = await productRoot(context, B, "0.9.1");
  const lint = await run(["lint", "--brain", brain, "--json"], { product: newer, home });
  assert.equal(lint.code, 0, lint.stdout);
  assert.deepEqual(skillIssues(lint.json.data.issues), [{
    severity: "info", rule: "skills-update-available", path: "skills.lock.json", line: 1, id: null,
    message: "ultimate-brain-skills 1.1.0 is available (pinned: ultimate-brain-skills 1.0.0); run brain upgrade",
  }]);

  await writeFile(join(brain, ".agents/skills/brain-old/SKILL.md"), "edited\n");
  await rm(join(brain, ".claude/skills/brain-query/references"), { recursive: true });
  await mkdir(join(brain, ".claude/skills/brain-apply/extra"));
  const drift = await run(["lint", "--brain", brain, "--json"], { product: newer, home });
  assert.equal(drift.code, 1);
  const product = drift.json.data.issues.filter((issue: Issue) => issue.rule === "product-file");
  assert.deepEqual(product.map((issue: Issue) => issue.path), [
    ".agents/skills/brain-old/SKILL.md", ".claude/skills/brain-apply/extra", ".claude/skills/brain-query/references/report.md",
  ]);
  assert.equal(product[0].message, "product files differ from ultimate-brain-skills 1.0.0; run brain upgrade, or file a finding");
  // update-available is for pinned or drift; lint's own state stays "pinned" here since drift is not a guard state.
  assert.ok(drift.json.data.issues.some((issue: Issue) => issue.rule === "skills-update-available"));
});

test("skills-lock, skills-incompatible and skills-unpinned", async (context) => {
  const home = await temp(context);
  const product = await productRoot(context, A, "0.9.0");
  const brain = await initBrain(context, product, home);
  const lint = async (version = product) => (await run(["lint", "--brain", brain, "--json"], { product: version, home })).json.data.issues as Issue[];

  const old = await lint(await productRoot(context, A, "0.8.1"));
  assert.deepEqual(old.filter((issue) => issue.rule === "skills-incompatible").map((issue) => issue.message), [
    "This brain's skills (ultimate-brain-skills 1.0.0) need ultimate-brain >=0.9.0 <0.10.0; this CLI is 0.8.1. Install the version that pinned them: npm install -g ultimate-brain@0.9.0.",
  ]);

  await writeFile(join(brain, "skills.lock.json"), "[]");
  const invalid = await lint();
  assert.deepEqual(invalid.filter((issue) => issue.rule.startsWith("skill") || issue.rule === "product-file").map((issue) => [issue.severity, issue.rule, issue.path]), [
    ["error", "skills-lock", "skills.lock.json"],
  ]);
  assert.match(invalid.find((issue) => issue.rule === "skills-lock")!.message, /^skills\.lock\.json is invalid \(schema: \/ must be object\); run brain upgrade to rewrite it$/);

  await rm(join(brain, "skills.lock.json"));
  const unpinned = await lint();
  assert.deepEqual(skillIssues(unpinned).map((issue) => [issue.severity, issue.rule, issue.message]), [
    ["info", "skills-unpinned", "skills are not pinned; run brain upgrade to pin them"],
  ]);
});

test("skill-duplicate and skill-competing, and no global checks without HOME", async (context) => {
  const home = await temp(context);
  const product = await productRoot(context, A, "0.9.0");
  const brain = await initBrain(context, product, home);
  await mkdir(join(brain, ".claude/skills/old-query"), { recursive: true });
  await writeFile(join(brain, ".claude/skills/old-query/SKILL.md"), "---\nname: brain-query\ndescription: an old copy\n---\nold\n");
  await mkdir(join(brain, ".agents/skills/unparseable"), { recursive: true });
  await writeFile(join(brain, ".agents/skills/unparseable/SKILL.md"), "---\nname: [\n---\n");
  await mkdir(join(home, ".claude/skills/brain-query"), { recursive: true });
  await mkdir(join(home, ".agents/skills"), { recursive: true });
  await writeFile(join(home, ".agents/skills/brain-apply"), "a file\n");
  await mkdir(join(home, ".codex/skills"), { recursive: true });
  await symlink(join(home, "nowhere"), join(home, ".codex/skills/brain-old"));
  await writeFile(join(home, ".claude/settings.json"), JSON.stringify({ enabledPlugins: { "ultimate-brain@ultimate-brain": true } }));
  await mkdir(join(brain, ".claude"), { recursive: true });
  await writeFile(join(brain, ".claude/settings.json"), JSON.stringify({ enabledPlugins: { "ultimate-brain@ultimate-brain": true } }));

  const lint = await run(["lint", "--brain", brain, "--json"], { product, home });
  assert.equal(lint.code, 1);
  assert.deepEqual(skillIssues(lint.json.data.issues).map((issue: Issue) => [issue.severity, issue.rule, issue.path, issue.message]), [
    ["warning", "skill-competing", ".claude/settings.json", "the retired ultimate-brain plugin is enabled in .claude/settings.json; disable it"],
    ["error", "skill-duplicate", ".claude/skills/old-query", ".claude/skills/old-query also defines skill brain-query; remove it, the pinned copy is .claude/skills/brain-query"],
    ["warning", "skill-competing", "~/.agents/skills/brain-apply", "~/.agents/skills/brain-apply competes with the pinned skill brain-apply; remove it"],
    ["warning", "skill-competing", "~/.claude/settings.json", "the retired ultimate-brain plugin is enabled in ~/.claude/settings.json; disable it"],
    ["warning", "skill-competing", "~/.claude/skills/brain-query", "~/.claude/skills/brain-query competes with the pinned skill brain-query; remove it"],
    ["warning", "skill-competing", "~/.codex/skills/brain-old", "~/.codex/skills/brain-old competes with the pinned skill brain-old; remove it"],
  ]);
  // No machine path appears anywhere in the output.
  assert.ok(!lint.stdout.includes(home));

  const status = await run(["status", "--brain", brain, "--json"], { product, home });
  assert.deepEqual(status.json.data.skills.competing.map((copy: { kind: string; path: string }) => `${copy.kind} ${copy.path}`), [
    "plugin .claude/settings.json", "duplicate .claude/skills/old-query", "global ~/.agents/skills/brain-apply", "plugin ~/.claude/settings.json",
    "global ~/.claude/skills/brain-query", "global ~/.codex/skills/brain-old",
  ]);

  const noHome = await run(["lint", "--brain", brain, "--json"], { product, home: "" });
  assert.deepEqual(skillIssues(noHome.json.data.issues).map((issue: Issue) => issue.path), [".claude/settings.json", ".claude/skills/old-query"]);
});

test("while unpinned, a broken package is one product-file error", async (context) => {
  const home = await temp(context);
  const brain = await initBrain(context, await productRoot(context, A, "0.9.0"), home);
  await rm(join(brain, "skills.lock.json"));
  const empty = await temp(context);
  await mkdir(join(empty, "x"));
  const broken = await productRoot(context, join(empty, "x"), "0.9.0");
  const lint = await run(["lint", "--brain", brain, "--json"], { product: broken, home });
  assert.deepEqual(skillIssues(lint.json.data.issues).map((issue: Issue) => [issue.rule, issue.path, issue.message]), [
    ["product-file", "AGENTS.md", "installed package not found: manifest-missing"],
    ["skills-unpinned", "skills.lock.json", "skills are not pinned; run brain upgrade to pin them"],
  ]);
});
