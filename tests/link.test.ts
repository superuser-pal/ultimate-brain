import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { brain, FIXTURE_BRAIN } from "./helpers.ts";

async function repo(context: { after(callback: () => unknown): void }): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "brain-link-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

const BRAIN = ["--brain", FIXTURE_BRAIN, "--json"];
const PACKAGE = JSON.parse(await readFile(join(import.meta.dirname, "..", ".agents", "skills", "snapshot.json"), "utf8"));
/** The package's linked skills (brain-query and, from the 0.9.2 snapshot, the workflow skills; skills-delivery §9.7). */
const LINKED: Array<{ name: string; files: Array<{ path: string }> }> = PACKAGE.skills.filter((skill: { targets: string[] }) => skill.targets.includes("linked_repo"));
/** Every file link writes for them in both trees, sorted as link reports them, with `action`. */
const linkedFiles = (action: string) => [".agents/skills", ".claude/skills"]
  .flatMap((tree) => LINKED.flatMap((skill) => skill.files.map((file) => `${tree}/${skill.name}/${file.path}`)))
  .sort().map((path) => ({ path, action }));

test("link writes a canonical marker and agent instructions, then is byte-idempotent", async (context) => {
  const target = await repo(context);
  const args = [
    "link", target, "--project", "prj-9x4t1b7e", "--stack", "supabase", "--stack", "nextjs",
    "--repo-name", "acme-api", ...BRAIN,
  ];
  const first = await brain(args);
  assert.equal(first.code, 0, first.stdout);
  const { skills, ...value } = first.json.data.marker.value;
  assert.deepEqual({ ...first.json.data.marker, value }, {
    path: ".brain",
    written: true,
    value: { repo: "acme-api", project: "prj-9x4t1b7e", area: "area-2m7c4h8n", stacks: ["nextjs", "supabase"] },
  });
  // An unpinned brain links the package's skills (spec/skills-delivery.md §6.2).
  assert.deepEqual({ name: skills.name, names: skills.names }, { name: PACKAGE.name, names: LINKED.map((skill) => skill.name) });
  assert.deepEqual(Object.keys(first.json.data.marker.value), ["repo", "project", "area", "stacks", "skills"]);
  assert.deepEqual(first.json.warnings.map((warning: { code: string }) => warning.code), ["SKILLS_UNPINNED"]);
  assert.deepEqual(first.json.data.files, [
    { path: "AGENTS.md", action: "created" },
    { path: "CLAUDE.md", action: "created" },
    ...linkedFiles("created"),
  ]);
  assert.deepEqual(JSON.parse(await readFile(join(target, ".brain"), "utf8")), first.json.data.marker.value);
  const agents = await readFile(join(target, "AGENTS.md"), "utf8");
  assert.match(agents, /<!-- ultimate-brain:start -->/);
  assert.match(agents, /- Project: Acme website \(`prj-9x4t1b7e`\)/);
  assert.match(agents, /- Area: Clients \(`area-2m7c4h8n`\)/);
  assert.equal(await readFile(join(target, "CLAUDE.md"), "utf8"), "@AGENTS.md\n");

  const before = await Promise.all([".brain", "AGENTS.md", "CLAUDE.md"].map((path) => readFile(join(target, path), "utf8")));
  const second = await brain(args);
  assert.equal(second.code, 0, second.stdout);
  assert.equal(second.json.data.marker.written, false);
  assert.deepEqual(second.json.data.files, [
    { path: "AGENTS.md", action: "unchanged" },
    { path: "CLAUDE.md", action: "unchanged" },
    ...linkedFiles("unchanged"),
  ]);
  const after = await Promise.all([".brain", "AGENTS.md", "CLAUDE.md"].map((path) => readFile(join(target, path), "utf8")));
  assert.deepEqual(after, before);
});

test("link updates fenced instructions in place and retains content outside them", async (context) => {
  const target = await repo(context);
  const existing = [
    "# Local rules",
    "Keep this intro.",
    "",
    "<!-- ultimate-brain:start -->",
    "old block",
    "<!-- ultimate-brain:end -->",
    "",
    "Keep this footer.",
    "",
  ].join("\n");
  await writeFile(join(target, "AGENTS.md"), existing);
  await writeFile(join(target, "CLAUDE.md"), "# Claude rules\n");

  const run = await brain(["link", target, "--area", "area-2m7c4h8n", ...BRAIN]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.files, [
    { path: "AGENTS.md", action: "updated" },
    { path: "CLAUDE.md", action: "updated" },
    ...linkedFiles("created"),
  ]);
  const agents = await readFile(join(target, "AGENTS.md"), "utf8");
  assert.equal(agents.startsWith("# Local rules\nKeep this intro.\n\n"), true);
  assert.equal(agents.endsWith("\n\nKeep this footer.\n"), true);
  assert.match(agents, /- Area: Clients \(`area-2m7c4h8n`\)/);
  const claude = await readFile(join(target, "CLAUDE.md"), "utf8");
  assert.equal(claude.startsWith("# Claude rules\n\n"), true);
  assert.match(claude, /<!-- ultimate-brain:start -->/);
});

test("link preserves unspecified marker fields and validates its target and options", async (context) => {
  const target = await repo(context);
  await writeFile(join(target, ".brain"), `${JSON.stringify({ repo: "old", project: "prj-9x4t1b7e", area: "area-2m7c4h8n", stacks: ["typescript"] })}\n`);
  await writeFile(join(target, "CLAUDE.md"), "@AGENTS.md\n");

  const run = await brain(["link", target, "--repo-name", "new-repo", ...BRAIN]);
  assert.equal(run.code, 0, run.stdout);
  const { skills: _skills, ...kept } = run.json.data.marker.value;
  assert.deepEqual(kept, {
    repo: "new-repo", project: "prj-9x4t1b7e", area: "area-2m7c4h8n", stacks: ["typescript"],
  });
  assert.equal(run.json.data.files[1].action, "unchanged", "CLAUDE.md already imports AGENTS.md");

  const stack = await brain(["link", target, "--stack", "Next JS", ...BRAIN]);
  assert.equal(stack.code, 2);
  assert.equal(stack.json.error.code, "USAGE");
  const unknown = await brain(["link", target, "--project", "prj-00000000", ...BRAIN]);
  assert.equal(unknown.code, 4);
  assert.equal(unknown.json.error.code, "UNKNOWN_ID");
  const brainTarget = await brain(["link", FIXTURE_BRAIN, ...BRAIN]);
  assert.equal(brainTarget.code, 5);
  assert.equal(brainTarget.json.error.code, "OUTSIDE_ROOT");
});

test("link refuses malformed instruction markers without touching the repository", async (context) => {
  const target = await repo(context);
  const bad = "# Rules\n<!-- ultimate-brain:start -->\nunfinished\n";
  await writeFile(join(target, "AGENTS.md"), bad);
  const run = await brain(["link", target, ...BRAIN]);
  assert.equal(run.code, 4);
  assert.equal(run.json.error.code, "INPUT_INVALID");
  assert.equal(await readFile(join(target, "AGENTS.md"), "utf8"), bad);
});

test("link installs only the linked skills, refreshes them, removes stale files and leaves other .agents content", async (context) => {
  const target = await repo(context);
  const skill = join(target, ".agents", "skills", "brain-query");
  const shipped = await readFile(join(import.meta.dirname, "..", ".agents", "skills", "brain-query", "SKILL.md"), "utf8");
  await mkdir(skill, { recursive: true });
  await mkdir(join(target, ".agents", "skills", "mine"), { recursive: true });
  await writeFile(join(skill, "SKILL.md"), "old\n");
  await writeFile(join(skill, "stale.md"), "stale\n");
  await writeFile(join(target, ".agents", "skills", "mine", "SKILL.md"), "keep\n");

  const first = await brain(["link", target, ...BRAIN]);
  assert.equal(first.code, 0, first.stdout);
  assert.deepEqual(first.json.data.files.filter((file: any) => file.path.startsWith(".agents/")), linkedFiles("created")
    .filter((file) => file.path.startsWith(".agents/"))
    .map((file) => (file.path === ".agents/skills/brain-query/SKILL.md" ? { ...file, action: "updated" } : file))
    .concat({ path: ".agents/skills/brain-query/stale.md", action: "removed" })
    .sort((a, b) => (a.path < b.path ? -1 : 1)));
  assert.equal(await readFile(join(skill, "SKILL.md"), "utf8"), shipped);
  await assert.rejects(readFile(join(skill, "stale.md")));
  assert.equal(await readFile(join(target, ".agents", "skills", "mine", "SKILL.md"), "utf8"), "keep\n");
  await assert.rejects(readFile(join(target, ".agents", "skills", "brain-ingest", "SKILL.md")));

  const second = await brain(["link", target, ...BRAIN]);
  assert.deepEqual(second.json.data.files.filter((file: any) => file.path.startsWith(".agents/")), linkedFiles("unchanged").filter((file) => file.path.startsWith(".agents/")));
});

test("link refuses a brain-query skill folder that links out of the repo", async (context) => {
  const target = await repo(context);
  const outside = await repo(context);
  await writeFile(join(outside, "A-precious.md"), "keep me\n");
  await mkdir(join(target, ".agents/skills"), { recursive: true });
  await symlink(outside, join(target, ".agents/skills/brain-query"));
  const run = await brain(["link", target, "--project", "prj-9x4t1b7e", ...BRAIN]);
  assert.equal(run.code, 5, run.stdout);
  assert.equal(run.json.error.code, "OUTSIDE_ROOT");
  assert.equal(await readFile(join(outside, "A-precious.md"), "utf8"), "keep me\n");
});

test("link writes the block in AGENTS.md and leaves a CLAUDE.md symlink to it alone (CC-132)", async (context) => {
  const target = await repo(context);
  await writeFile(join(target, "AGENTS.md"), "# Rules\n");
  await symlink("AGENTS.md", join(target, "CLAUDE.md"));
  const result = await brain(["link", target, "--repo-name", "acme-api", "--area", "area-2m7c4h8n", ...BRAIN]);
  assert.equal(result.code, 0, result.stdout);
  const files = result.json.data.files.filter((file: { path: string }) => !file.path.includes("skills"));
  assert.deepEqual(files, [{ path: "AGENTS.md", action: "updated" }, { path: "CLAUDE.md", action: "unchanged" }]);
  assert.equal((await lstat(join(target, "CLAUDE.md"))).isSymbolicLink(), true);
  assert.equal(await readlink(join(target, "CLAUDE.md")), "AGENTS.md");
  const agents = await readFile(join(target, "AGENTS.md"), "utf8");
  assert.ok(agents.startsWith("# Rules\n") && agents.includes("<!-- ultimate-brain:start -->"));
  const again = await brain(["link", target, "--repo-name", "acme-api", "--area", "area-2m7c4h8n", ...BRAIN]);
  assert.equal(again.code, 0, again.stdout);
  assert.equal(await readFile(join(target, "AGENTS.md"), "utf8"), agents);
});

test("link refuses a CLAUDE.md symlink to anything but the repo's AGENTS.md with INSTRUCTIONS_SYMLINK and writes nothing (CC-132)", async (context) => {
  const outside = await repo(context);
  await writeFile(join(outside, "AGENTS.md"), "# Elsewhere\n");
  for (const [name, link] of [["other file", "NOTES.md"], ["outside the repo", join(outside, "AGENTS.md")], ["dangling", "missing.md"]] as const) {
    const target = await repo(context);
    await writeFile(join(target, "AGENTS.md"), "# Rules\n");
    await writeFile(join(target, "NOTES.md"), "notes\n");
    await symlink(link, join(target, "CLAUDE.md"));
    const result = await brain(["link", target, "--repo-name", "acme-api", "--area", "area-2m7c4h8n", ...BRAIN]);
    assert.equal(result.code, 4, `${name}: ${result.stdout}`);
    assert.equal(result.json.error.code, "INSTRUCTIONS_SYMLINK", name);
    assert.ok(result.json.error.message.includes("@AGENTS.md"), name);
    assert.equal(await readFile(join(target, "AGENTS.md"), "utf8"), "# Rules\n", name);
    await assert.rejects(readFile(join(target, ".brain")), name);
  }
});

test("link still refuses a symbolic AGENTS.md with OUTSIDE_ROOT, even when CLAUDE.md links to it (CC-132)", async (context) => {
  const target = await repo(context);
  await writeFile(join(target, "RULES.md"), "# Rules\n");
  await symlink("RULES.md", join(target, "AGENTS.md"));
  await symlink("AGENTS.md", join(target, "CLAUDE.md"));
  const result = await brain(["link", target, "--repo-name", "acme-api", "--area", "area-2m7c4h8n", ...BRAIN]);
  assert.equal(result.code, 5, result.stdout);
  assert.equal(result.json.error.code, "OUTSIDE_ROOT");
  assert.equal(await readFile(join(target, "RULES.md"), "utf8"), "# Rules\n");
});
