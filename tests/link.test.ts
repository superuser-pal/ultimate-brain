import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

test("link writes a canonical marker and agent instructions, then is byte-idempotent", async (context) => {
  const target = await repo(context);
  const args = [
    "link", target, "--project", "prj-9x4t1b7e", "--stack", "supabase", "--stack", "nextjs",
    "--repo-name", "acme-api", ...BRAIN,
  ];
  const first = await brain(args);
  assert.equal(first.code, 0, first.stdout);
  assert.deepEqual(first.json.data.marker, {
    path: ".brain",
    written: true,
    value: { repo: "acme-api", project: "prj-9x4t1b7e", area: "area-2m7c4h8n", stacks: ["nextjs", "supabase"] },
  });
  assert.deepEqual(first.json.data.files, [
    { path: "AGENTS.md", action: "created" },
    { path: "CLAUDE.md", action: "created" },
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
  assert.deepEqual(run.json.data.marker.value, {
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
