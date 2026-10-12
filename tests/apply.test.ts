import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter, serializeNewFile } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const DECIDED = "2026-12-09T08:00:00Z";
const GOLDEN = join(import.meta.dirname, "fixtures", "apply-golden");

/** Write a proposal file with a fixed id, as `proposal new` would. */
async function proposal(dir: string, id: string, fields: Record<string, unknown>): Promise<string> {
  const path = `_proposals/2026-12-08-${id}.md`;
  const attributes = { id, type: "proposal", title: `Test ${id}`, created: "2026-12-08", updated: "2026-12-08", why: "w", source: "mtg-8c4n2p7w", status: "pending", ...fields };
  await writeFile(join(dir, path), serializeNewFile(attributes, ""));
  return path;
}

async function apply(dir: string, input: unknown | null, ...extra: string[]) {
  const args = ["apply", "--brain", dir, "--now", NOW, "--json", ...extra];
  if (input !== null) {
    const file = join(dir, "..", "input.json");
    await writeFile(file, JSON.stringify(input));
    args.push("--input", file);
  }
  return brain(args);
}

const decide = (id: string, action = "approve", value?: unknown) => ({
  proposal: id, action, ...(value === undefined ? {} : { value }), decided_at: DECIDED, decided_by: "notion",
});

/** Compare brain files with tests/fixtures/apply-golden/<name>/<path>; UPDATE_GOLDEN=1 rewrites them. */
async function assertGolden(dir: string, name: string, paths: readonly string[]): Promise<void> {
  for (const path of paths) {
    const actual = await readFile(join(dir, path), "utf8");
    const golden = join(GOLDEN, name, path);
    if (process.env.UPDATE_GOLDEN === "1") {
      await mkdir(dirname(golden), { recursive: true });
      await writeFile(golden, actual);
    }
    assert.equal(actual, await readFile(golden, "utf8"), `${name}: ${path}`);
  }
}

async function assertLintClean(dir: string): Promise<void> {
  const lint = await brain(["lint", "--brain", dir, "--json"]);
  assert.equal(lint.json.data.errors, 0, JSON.stringify(lint.json.data.issues));
}

const PROJECT = "projects/acme-website/project.md";
const CARLOS = "knowledge/people/carlos-ruiz.md";
const MARIA = "knowledge/people/maria-lopez.md";

const kinds: Array<{ name: string; fields: Record<string, unknown>; action?: string; value?: unknown; changed: string[] }> = [
  {
    name: "update_fact-approve",
    fields: { kind: "update_fact", target: "prj-9x4t1b7e", field: "budget", before: "80000 EUR", after: "95000 EUR", from: "2026-12-08" },
    changed: [PROJECT],
  },
  {
    name: "update_fact-edit",
    fields: { kind: "update_fact", target: "prj-9x4t1b7e", field: "budget", before: "80000 EUR", after: "95000 EUR", from: "2026-12-08" },
    action: "edit", value: "90000 EUR",
    changed: [PROJECT],
  },
  {
    name: "update_fact-new-key",
    fields: { kind: "update_fact", target: "prj-9x4t1b7e", field: "deadline", after: "2027-02-28", from: "2026-12-08" },
    changed: [PROJECT],
  },
  {
    name: "contradiction-approve",
    fields: { kind: "contradiction", target: "per-9t2c6m4a", field: "role", before: "Developer", after: "Tech lead", from: "2026-12-08" },
    changed: [CARLOS],
  },
  {
    name: "contradiction-edit",
    fields: { kind: "contradiction", target: "per-9t2c6m4a", field: "role", before: "Developer", after: "Tech lead", from: "2026-12-08" },
    action: "edit", value: "Lead developer",
    changed: [CARLOS],
  },
  {
    name: "add_to_note-approve",
    fields: { kind: "add_to_note", target: "org-6d1f9z3k", content: "Acme opened a second store in Valencia.", source: "src-7w3c9k5m" },
    changed: ["knowledge/orgs/acme.md"],
  },
  {
    name: "add_link-approve",
    fields: { kind: "add_link", target: "per-3h8w2n6c", field: "aliases", after: "Mari" },
    changed: [MARIA],
  },
  {
    name: "merge-approve",
    fields: { kind: "merge", target: "per-9t2c6m4a", merge_into: "per-3h8w2n6c" },
    changed: [
      "knowledge/decisions/2026-10-01-use-firebase-for-auth.md",
      "knowledge/decisions/2026-12-03-use-supabase-for-auth.md",
      "knowledge/meetings/2026-10-01-acme-kickoff.md",
      "knowledge/meetings/2026-12-03-acme-sync.md",
      CARLOS,
      MARIA,
      "knowledge/questions/who-owns-the-acme-mobile-app.md",
      "projects/acme-website/brief.md",
      PROJECT,
    ],
  },
];

for (const kind of kinds) {
  test(`apply ${kind.name} writes exactly its write set (golden)`, async (context) => {
    const dir = await fixtureCopy(context);
    const id = "prp-0a1b2c3d";
    const proposalPath = await proposal(dir, id, kind.fields);
    const run = await apply(dir, { decisions: [decide(id, kind.action, kind.value)] });
    assert.equal(run.code, 0, run.stdout);
    const [item] = run.json.data.decisions;
    assert.equal(item.result, "applied", JSON.stringify(item));
    assert.deepEqual(item.changed, [...kind.changed, proposalPath].sort());
    await assertGolden(dir, kind.name, [...kind.changed, proposalPath]);
    await assertLintClean(dir);
  });
}

test("apply supersede links both decisions and archives the older one (golden)", async (context) => {
  const dir = await fixtureCopy(context);
  const notes = join(dir, "..", "notes.json");
  await writeFile(notes, JSON.stringify({
    notes: [{
      type: "decision", id: "dec-3f7k9m2q", title: "Use Clerk for auth", body: "## Decision\nUse Clerk.\n",
      frontmatter: { summary: "Auth moves to Clerk.", date: "2026-12-08", assessment: "accepted", valid_from: "2026-12-09", projects: ["prj-9x4t1b7e"], sources: ["mtg-8c4n2p7w"] },
    }],
  }));
  assert.equal((await brain(["note", "new", "--input", notes, "--brain", dir, "--now", NOW, "--json"])).code, 0);
  const proposalPath = await proposal(dir, "prp-0a1b2c3d", { kind: "supersede", target: "dec-3f7k9m2q", supersedes: "dec-7k2m9q4x" });

  const run = await apply(dir, { decisions: [decide("prp-0a1b2c3d")] });
  assert.equal(run.code, 0, run.stdout);
  const changed = [
    "knowledge/decisions/2026-12-03-use-supabase-for-auth.md",
    "knowledge/decisions/2026-12-08-use-clerk-for-auth.md",
    proposalPath,
  ].sort();
  assert.deepEqual(run.json.data.decisions[0].changed, changed);
  await assertGolden(dir, "supersede-approve", changed);
  await assertLintClean(dir);
});

test("apply new_item writes the note and adds it to its meeting", async (context) => {
  const dir = await fixtureCopy(context);
  const note = {
    type: "decision", title: "Keep the blog on the main domain", body: "## Decision\nKeep it.\n",
    frontmatter: { summary: "Blog stays on acme.example.", date: "2026-12-03", assessment: "provisional", decided_in: "mtg-8c4n2p7w", sources: ["mtg-8c4n2p7w"] },
  };
  const proposalPath = await proposal(dir, "prp-0a1b2c3d", { kind: "new_item", note });
  const run = await apply(dir, { decisions: [decide("prp-0a1b2c3d")] });
  assert.equal(run.code, 0, run.stdout);
  const newPath = "knowledge/decisions/2026-12-03-keep-the-blog-on-the-main-domain.md";
  assert.deepEqual(run.json.data.decisions[0].changed, [proposalPath, newPath, "knowledge/meetings/2026-12-03-acme-sync.md"]);
  const created = parseFrontmatter(await readFile(join(dir, newPath), "utf8")).attributes;
  assert.equal(created.lifecycle, "draft");
  const meeting = parseFrontmatter(await readFile(join(dir, "knowledge/meetings/2026-12-03-acme-sync.md"), "utf8")).attributes;
  assert.deepEqual(meeting.decisions, ["dec-7k2m9q4x", created.id]);
  assert.equal(meeting.updated, "2026-12-10");
  await assertLintClean(dir);
});

test("re-applying the same decisions is a no-op", async (context) => {
  const dir = await fixtureCopy(context);
  await proposal(dir, "prp-0a1b2c3d", kinds[0]!.fields);
  const input = { decisions: [decide("prp-0a1b2c3d"), decide("prp-9d3f7h2k", "reject")] };
  const first = await apply(dir, input);
  assert.deepEqual(first.json.data.summary, { applied: 1, closed: 1, recorded: 0, corrected: 0, skipped: 0, failed: 0 });
  const snapshot = await readFile(join(dir, PROJECT), "utf8");
  const log = await readFile(join(dir, "log/2026-12.md"), "utf8");
  assert.ok(log.endsWith(
    `- ${NOW} apply prp-0a1b2c3d "Test prp-0a1b2c3d" result=applied\n` +
    `- ${NOW} apply prp-9d3f7h2k "Acme: mobile app relaunch planned for 2027" result=closed\n`,
  ));

  const second = await apply(dir, input);
  assert.equal(second.code, 0, second.stdout);
  assert.deepEqual(second.json.data.decisions.map((item: { result: string; reason: string }) => [item.result, item.reason]), [
    ["skipped", "ALREADY_TERMINAL"],
    ["skipped", "ALREADY_TERMINAL"],
  ]);
  assert.equal(await readFile(join(dir, PROJECT), "utf8"), snapshot);
  assert.equal(await readFile(join(dir, "log/2026-12.md"), "utf8"), log);
});

test("a stale proposal is closed, not applied", async (context) => {
  const dir = await fixtureCopy(context);
  await proposal(dir, "prp-0a1b2c3d", { ...kinds[0]!.fields, before: "70000 EUR" });
  const run = await apply(dir, { decisions: [decide("prp-0a1b2c3d")] });
  assert.equal(run.code, 0, run.stdout);
  const [item] = run.json.data.decisions;
  assert.equal(item.result, "closed");
  assert.equal(item.reason, "STALE_PROPOSAL");
  assert.equal(item.message, 'facts.budget is "80000 EUR", proposal expected "70000 EUR"');
  const p = parseFrontmatter(await readFile(join(dir, "_proposals/2026-12-08-prp-0a1b2c3d.md"), "utf8")).attributes;
  assert.equal(p.status, "closed");
  assert.equal(p.closed_reason, "stale");
  await assertLintClean(dir);
});

test("record-only stores decisions; apply without input then applies them, later decisions winning", async (context) => {
  const dir = await fixtureCopy(context);
  await proposal(dir, "prp-0a1b2c3d", kinds[0]!.fields);
  const recorded = await apply(dir, { decisions: [decide("prp-0a1b2c3d", "reject")] }, "--record-only");
  assert.equal(recorded.json.data.decisions[0].result, "recorded");
  assert.equal(parseFrontmatter(await readFile(join(dir, "_proposals/2026-12-08-prp-0a1b2c3d.md"), "utf8")).attributes.status, "rejected");

  // You changed your mind in Notion later: approve wins over the recorded reject.
  const later = { ...decide("prp-0a1b2c3d"), decided_at: "2026-12-09T10:00:00Z" };
  const changed = await apply(dir, { decisions: [later] }, "--record-only");
  assert.equal(changed.json.data.decisions[0].action, "approve");

  // An older decision does not override the recorded one.
  const older = await apply(dir, { decisions: [{ ...decide("prp-0a1b2c3d", "reject"), decided_at: "2026-12-01T00:00:00Z" }] }, "--dry-run");
  assert.equal(older.json.data.decisions[0].action, "approve");
  assert.equal(older.json.data.decisions[0].result, "applied");

  const pending = await apply(dir, null);
  assert.equal(pending.code, 0, pending.stdout);
  assert.deepEqual(pending.json.data.decisions.map((item: { proposal: string; result: string }) => [item.proposal, item.result]), [["prp-0a1b2c3d", "applied"]]);
  assert.deepEqual(parseFrontmatter(await readFile(join(dir, PROJECT), "utf8")).attributes.facts, { launch_date: "2027-02", budget: "95000 EUR" });
});

test("apply reports item failures and keeps going", async (context) => {
  const dir = await fixtureCopy(context);
  await proposal(dir, "prp-0a1b2c3d", { kind: "supersede", target: "dec-7k2m9q4x", supersedes: "dec-2p9f6h1r" });
  await proposal(dir, "prp-3a1b2c3d", { kind: "add_link", target: "per-3h8w2n6c", field: "aliases", after: "Mari" });
  await proposal(dir, "prp-1a1b2c3d", { ...kinds[0]!.fields });
  await proposal(dir, "prp-2a1b2c3d", { kind: "update_fact", target: "prj-9x4t1b7e", field: "owner", after: "per-00000000", from: "2026-12-08" });
  const run = await apply(dir, {
    decisions: [
      decide("prp-0a1b2c3d", "edit", "x"),
      decide("prp-3a1b2c3d", "edit", "x"),
      decide("prp-00000000"),
      decide("prp-2a1b2c3d"),
      decide("prp-1a1b2c3d"),
    ],
  });
  assert.equal(run.code, 1, run.stdout);
  assert.deepEqual(run.json.data.decisions.map((item: { result: string; reason?: string }) => [item.result, item.reason ?? null]), [
    ["failed", "EDIT_NOT_ALLOWED"],
    ["failed", "EDIT_NOT_ALLOWED"],
    ["failed", "UNKNOWN_ID"],
    ["failed", "INVALID_RESULT"],
    ["applied", null],
  ]);
  assert.match(run.json.data.decisions[3].message, /missing-ref/);
  assert.equal(parseFrontmatter(await readFile(join(dir, "_proposals/2026-12-08-prp-2a1b2c3d.md"), "utf8")).attributes.status, "pending", "a failed item is left unchanged");
  assert.deepEqual(run.json.data.summary, { applied: 1, closed: 0, recorded: 0, corrected: 0, skipped: 0, failed: 4 });
});

test("corrections from Notion edits run first and later decisions see them", async (context) => {
  const dir = await fixtureCopy(context);
  await proposal(dir, "prp-0a1b2c3d", { kind: "update_fact", target: "per-3h8w2n6c", field: "role", before: "Product Manager", after: "Head of Product", from: "2026-12-08" });
  const run = await apply(dir, {
    corrections: [
      { target: "per-3h8w2n6c", field: "facts.role", value: "Product lead", observed_at: "2026-12-07T09:00:00Z" },
      { target: "per-3h8w2n6c", field: "title", value: "Maria López", observed_at: "2026-12-07T09:00:00Z" },
      { target: "prj-9x4t1b7e", field: "summary", value: "Rebuild of Acme's site.", observed_at: "2026-12-07T09:00:00Z" },
      { target: "per-3h8w2n6c", field: "why", value: "x", observed_at: "2026-12-07T09:00:00Z" },
      { target: "prj-9x4t1b7e", field: "area", value: null, observed_at: "2026-12-07T09:00:00Z" },
      { target: "prj-9x4t1b7e", field: "client", value: null, observed_at: "2026-12-07T09:00:00Z" },
    ],
    decisions: [decide("prp-0a1b2c3d")],
  });
  assert.equal(run.code, 1, run.stdout);
  assert.deepEqual(run.json.data.corrections.map((item: { result: string; reason?: string }) => [item.result, item.reason ?? null]), [
    ["applied", null],
    ["skipped", "NO_CHANGE"],
    ["applied", null],
    ["failed", "FIELD_NOT_CORRECTABLE"],
    ["failed", "INVALID_RESULT"],
    ["applied", null],
  ]);
  assert.equal(run.json.data.decisions[0].result, "closed");
  assert.equal(run.json.data.decisions[0].reason, "STALE_PROPOSAL");

  const maria = parseFrontmatter(await readFile(join(dir, MARIA), "utf8")).attributes;
  assert.deepEqual(maria.facts, { role: "Product lead" });
  assert.deepEqual((maria.timeline as unknown[]).at(-1), { field: "role", value: "Product lead", from: "2026-12-07", learned: "2026-12-07", source: "notion-edit", assessment: "accepted" });
  const project = parseFrontmatter(await readFile(join(dir, PROJECT), "utf8")).attributes;
  assert.equal(project.client, undefined);
  assert.equal(project.area, "area-2m7c4h8n");
  const log = await readFile(join(dir, "log/2026-12.md"), "utf8");
  assert.ok(log.includes(`- ${NOW} correct per-3h8w2n6c "Maria López" field=facts.role\n`));
});

test("apply validates its input as a whole", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await apply(dir, {
    decisions: [{ proposal: "prp-0a1b2c3d", action: "edit", decided_at: "yesterday", decided_by: "email", extra: 1 }],
    corrections: [{ target: "per-3h8w2n6c", field: "title" }],
  });
  assert.equal(run.code, 4);
  assert.deepEqual(run.json.error.details.map((detail: { pointer: string }) => detail.pointer), [
    "/corrections/0/value",
    "/corrections/0/observed_at",
    "/decisions/0/extra",
    "/decisions/0/value",
    "/decisions/0/decided_at",
    "/decisions/0/decided_by",
  ]);
  const empty = await apply(dir, { decisions: [] });
  assert.equal(empty.json.error.code, "INPUT_INVALID");
});

test("apply --dry-run reports without writing", async (context) => {
  const dir = await fixtureCopy(context);
  await proposal(dir, "prp-0a1b2c3d", kinds[0]!.fields);
  const before = await readFile(join(dir, PROJECT), "utf8");
  const run = await apply(dir, { decisions: [decide("prp-0a1b2c3d")] }, "--dry-run");
  assert.equal(run.json.data.dry_run, true);
  assert.equal(run.json.data.decisions[0].result, "applied");
  assert.equal(await readFile(join(dir, PROJECT), "utf8"), before);
});

test("a new_item that cannot be written fails only that item", async (context) => {
  const dir = await fixtureCopy(context);
  await proposal(dir, "prp-0a1b2c3d", { kind: "new_item", note: { type: "banana", title: "x", frontmatter: {}, body: "" } });
  await proposal(dir, "prp-1a1b2c3d", kinds[0]!.fields);
  const run = await apply(dir, { decisions: [decide("prp-1a1b2c3d"), decide("prp-0a1b2c3d")] });
  assert.equal(run.code, 1, run.stdout);
  assert.deepEqual(run.json.data.decisions.map((item: { result: string; reason?: string }) => [item.result, item.reason ?? null]), [["applied", null], ["failed", "INVALID_RESULT"]]);
});

test("corrections refuse sources and proposals; a merge rewrites memory areas", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await apply(dir, {
    corrections: [
      { target: "src-7w3c9k5m", field: "title", value: "Edited", observed_at: "2026-12-07T09:00:00Z" },
      { target: "prp-9d3f7h2k", field: "title", value: "Edited", observed_at: "2026-12-07T09:00:00Z" },
    ],
  });
  assert.deepEqual(run.json.data.corrections.map((item: { reason: string }) => item.reason), ["FIELD_NOT_CORRECTABLE", "FIELD_NOT_CORRECTABLE"]);

  const second = (await readFile(join(dir, "areas/clients.md"), "utf8")).replace("id: area-2m7c4h8n", "id: area-3n8d5j9p").replace("title: Clients", "title: Clients old");
  await writeFile(join(dir, "areas/clients-old.md"), second);
  const [memoryFile] = await readdir(join(dir, "memories/2026/12"));
  const memoryPath = join(dir, "memories/2026/12", memoryFile!);
  const original = await readFile(memoryPath, "utf8");
  await writeFile(memoryPath, original.replace(/^scope: .*$/m, "scope: area").replace(/^(projects|stacks): .*\n/m, "").replace(/^origin:/m, "areas: [area-3n8d5j9p]\norigin:"));
  await proposal(dir, "prp-0a1b2c3d", { kind: "merge", target: "area-3n8d5j9p", merge_into: "area-2m7c4h8n" });
  const merged = await apply(dir, { decisions: [decide("prp-0a1b2c3d")] });
  assert.equal(merged.json.data.decisions[0].result, "applied", JSON.stringify(merged.json.data.decisions[0]));
  assert.match(await readFile(memoryPath, "utf8"), /areas: \[area-2m7c4h8n\]/);
});

test("a merge rewrites inline, reference and autolinks while retaining query fragments and fenced code", async (context) => {
  const dir = await fixtureCopy(context);
  const project = join(dir, PROJECT);
  const original = await readFile(project, "utf8");
  await writeFile(project, `${original}\n[inline](../../knowledge/people/carlos-ruiz.md?source=merge#bio)\n[ref]: ../../knowledge/people/carlos-ruiz.md?source=merge#bio\n<../../knowledge/people/carlos-ruiz.md?source=merge#bio>\n\`[inline](../../knowledge/people/carlos-ruiz.md?source=merge#bio)\`\n\`\`\`md\n[fenced](../../knowledge/people/carlos-ruiz.md?source=merge#bio)\n[code-ref]: ../../knowledge/people/carlos-ruiz.md?source=merge#bio\n<../../knowledge/people/carlos-ruiz.md?source=merge#bio>\n\`\`\`\n`);
  await proposal(dir, "prp-0a1b2c3d", { kind: "merge", target: "per-9t2c6m4a", merge_into: "per-3h8w2n6c" });

  const run = await apply(dir, { decisions: [decide("prp-0a1b2c3d")] });
  assert.equal(run.code, 0, run.stdout);
  const updated = await readFile(project, "utf8");
  assert.match(updated, /\[inline\]\(\.\.\/\.\.\/knowledge\/people\/maria-lopez\.md\?source=merge#bio\)/);
  assert.match(updated, /^\[ref\]: \.\.\/\.\.\/knowledge\/people\/maria-lopez\.md\?source=merge#bio$/m);
  assert.match(updated, /<\.\.\/\.\.\/knowledge\/people\/maria-lopez\.md\?source=merge#bio>/);
  assert.match(updated, /`\[inline\]\(\.\.\/\.\.\/knowledge\/people\/carlos-ruiz\.md\?source=merge#bio\)`/);
  assert.match(updated, /\[fenced\]\(\.\.\/\.\.\/knowledge\/people\/carlos-ruiz\.md\?source=merge#bio\)/);
  assert.match(updated, /^\[code-ref\]: \.\.\/\.\.\/knowledge\/people\/carlos-ruiz\.md\?source=merge#bio$/m);
});

test("apply returns lint warnings for notes it writes", async (context) => {
  const dir = await fixtureCopy(context);
  const org = join(dir, "knowledge/orgs/acme.md");
  await writeFile(org, `${await readFile(org, "utf8")}\nCurrently expanding.\n`);
  await proposal(dir, "prp-0a1b2c3d", { kind: "add_to_note", target: "org-6d1f9z3k", content: "More context.", source: "mtg-8c4n2p7w" });

  const run = await apply(dir, { decisions: [decide("prp-0a1b2c3d")] });
  assert.equal(run.code, 0, run.stdout);
  assert.ok(run.json.warnings.some((warning: { code: string; path: string }) => warning.code === "FRESHNESS" && warning.path === "knowledge/orgs/acme.md"));
});
