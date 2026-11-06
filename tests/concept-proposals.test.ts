import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { planConceptConversion } from "../src/lib/concept-upgrade.ts";
import { parseFrontmatter, serializeNewFile } from "../src/lib/frontmatter.ts";
import { parseNote, type Note } from "../src/lib/notes.ts";
import { bodyHash } from "../src/lib/proposals.ts";

// Links to old concept notes inside proposals (CC-136, dogfood #220, spec/cli.md §5.15 step 5a), planned on notes held in memory:
// every text field of a proposal, the note it is read for, the before_hash rule, and the repair of links a converted brain missed.
async function emptyRoot(context: TestContext): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "brain-plan-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function note(path: string, attributes: Record<string, unknown>, body = ""): Note {
  const parsed = parseNote(path, serializeNewFile(attributes, body));
  if ("code" in parsed) throw new Error(parsed.message);
  return parsed;
}

const day = { created: "2026-12-03", updated: "2026-12-03" };
const prp = (id: string, fields: Record<string, unknown>) => note(`_proposals/2026-12-08-${id}.md`, { id, type: "proposal", title: id, ...day, why: "w", source: "src-6e7f8g9h", status: "pending", ...fields });
const plan = (root: string, notes: Note[]) => {
  const sorted = [...notes].sort((a, b) => (a.path < b.path ? -1 : 1));
  const paths = new Set(sorted.map((item) => item.path));
  return planConceptConversion(root, sorted, (path) => paths.has(path), null);
};
const after = (result: ReturnType<typeof plan>, path: string) => {
  const change = result.changes.find((candidate) => candidate.path === path);
  assert.ok(change?.content, `${path} is rewritten`);
  return parseFrontmatter(change.content).attributes;
};

test("the plan rewrites each text field of a proposal for the note it is written for", async (context) => {
  const root = await emptyRoot(context);
  const idea = note("knowledge/concepts/idea.md", { id: "con-1a1a1a1a", type: "concept", title: "Idea", summary: "s", lifecycle: "draft", sources: ["src-6e7f8g9h"], ...day }, "Idea.\n");
  const table = note("knowledge/references/table.md", { id: "ref-2b2b2b2b", type: "reference", title: "Table", summary: "s", lifecycle: "draft", origin: "part", sources: ["src-6e7f8g9h"], ...day }, "See [idea](../concepts/idea.md).\n");
  const old = table.body;
  const link = "[idea](../concepts/idea.md)";
  const fixed = prp("prp-3c3c3c3c", { kind: "update_body", target: "ref-2b2b2b2b", before_hash: bodyHash(old), content: link, status: "edited",
    decision: { action: "fix", note: "n", fixes: [{ value: link }], decided_at: "2026-12-09T08:00:00Z", decided_by: "notion" } });
  const stale = prp("prp-4d4d4d4d", { kind: "update_body", target: "ref-2b2b2b2b", before_hash: `sha256:${"0".repeat(64)}`, content: link });
  const closed = prp("prp-5e5e5e5e", { kind: "update_body", target: "ref-2b2b2b2b", before_hash: bodyHash(old), content: link, status: "applied", decision: { action: "approve", decided_at: "2026-12-09T08:00:00Z", decided_by: "notion" } });
  const edited = prp("prp-6f6f6f6f", { kind: "add_to_note", target: "ref-2b2b2b2b", content: "x", status: "edited", decision: { action: "edit", value: link, decided_at: "2026-12-09T08:00:00Z", decided_by: "notion" } });
  const review = prp("prp-7g7g7g7g", { kind: "review_notes", notes: [], links: [], status: "pending",
    changes: [{ kind: "update_body", target: "ref-2b2b2b2b", content: link, before_hash: bodyHash(old) }, { kind: "add_to_note", target: "con-1a1a1a1a", content: "[self](../concepts/idea.md)" }],
    items: [{ item_id: "it-1a1a1a1a", kind: "change", ref: 0 }, { item_id: "it-2b2b2b2b", kind: "change", ref: 1 }],
    revisions: [{ item_id: "it-2b2b2b2b", instruction: "i", requested_at: "2026-12-09T08:00:00Z", status: "drafted", previous: "[self](../concepts/idea.md)", drafted_at: "2026-12-09T08:00:00Z" }] });
  const project = prp("prp-8h8h8h8h", { kind: "new_item", note: { type: "project", title: "Web relaunch", frontmatter: {}, body: "[idea](../../knowledge/concepts/idea.md)" } });
  const history = prp("prp-9j9j9j9j", { kind: "new_item", status: "applied", decision: { action: "approve", decided_at: "2026-12-09T08:00:00Z", decided_by: "notion" },
    note: { type: "concept", title: "Older", frontmatter: {}, body: "[idea](idea.md)" } });
  const lost = prp("prp-0k0k0k0k", { kind: "add_to_note", target: "per-9z9z9z9z", content: link });

  const result = plan(root, [idea, table, fixed, stale, closed, edited, review, project, history, lost]);
  const newBody = old.replace("../concepts/idea.md", "idea.md");
  assert.equal(result.notes.find((item) => item.path === "knowledge/references/table.md")!.body, newBody);

  const a = after(result, fixed.path);
  assert.equal(a.content, "[idea](idea.md)");
  assert.equal((a.decision as { fixes: Array<{ value: string }> }).fixes[0]!.value, "[idea](idea.md)");
  assert.equal(a.before_hash, bodyHash(newBody), "an edited proposal's before_hash follows the body");
  const b = after(result, stale.path);
  assert.equal(b.before_hash, `sha256:${"0".repeat(64)}`, "a stale proposal stays stale");
  const c = after(result, closed.path);
  assert.equal(c.content, "[idea](idea.md)");
  assert.equal(c.before_hash, bodyHash(old), "an applied proposal keeps its hash");
  assert.equal((after(result, edited.path).decision as { value: string }).value, "[idea](idea.md)");
  const r = after(result, review.path);
  const changes = r.changes as Array<{ content: string; before_hash?: string }>;
  assert.equal(changes[0]!.content, "[idea](idea.md)");
  assert.equal(changes[0]!.before_hash, bodyHash(newBody));
  // Written for the concept, read from knowledge/concepts/ (from _proposals/ the link would reach no note) and written for knowledge/references/.
  assert.equal(changes[1]!.content, "[self](idea.md)");
  assert.equal((r.revisions as Array<{ previous: string }>)[0]!.previous, "[self](idea.md)");
  assert.equal((after(result, project.path).note as { body: string }).body, "[idea](../../knowledge/references/idea.md)");
  const h = after(result, history.path).note as { type: string; body: string };
  assert.equal(h.type, "concept", "an applied new_item keeps its record");
  assert.equal(h.body, "[idea](../references/idea.md)");
  assert.equal(result.changes.some((change) => change.path === lost.path), false, "a string whose note is missing is left as written");
});

test("the plan repairs missed links by file name, and names the ones it cannot place", async (context) => {
  const root = await emptyRoot(context);
  const learned = (path: string, id: string) => note(path, { id, type: "reference", title: id, summary: "s", lifecycle: "draft", origin: "learned", ...day }, "x\n");
  const notes = [
    learned("knowledge/references/idea.md", "con-1a1a1a1a"),
    learned("knowledge/references/other-2.md", "con-2b2b2b2b"),
    note("knowledge/references/other.md", { id: "ref-3c3c3c3c", type: "reference", title: "Other", summary: "s", lifecycle: "draft", origin: "part", sources: ["src-6e7f8g9h"], ...day }, "x\n"),
    learned("knowledge/references/dup-2.md", "con-4d4d4d4d"),
    learned("knowledge/references/dup-3.md", "con-5e5e5e5e"),
    learned("knowledge/references/plain.md", "ref-6f6f6f6f"),
    // A conversion numbers from -2, so -1 is no former concept's file.
    learned("knowledge/references/solo-1.md", "con-7g7g7g7g"),
  ];
  const quiet = plan(root, notes);
  assert.deepEqual(quiet.changes, [], "nothing to repair changes nothing");
  assert.deepEqual(quiet.unresolved, []);

  const content = "[a](../concepts/idea.md) [b](../concepts/sub/other.md) [c](../concepts/dup.md) [d](../concepts/plain.md) [e](../concepts/solo.md)";
  const missed = prp("prp-7g7g7g7g", { kind: "add_to_note", target: "ref-3c3c3c3c", content });
  const result = plan(root, [...notes, missed]);
  assert.deepEqual(result.changes.map((change) => change.path), [missed.path], "index.md is not rebuilt without a conversion");
  assert.equal(after(result, missed.path).content, "[a](idea.md) [b](other-2.md) [c](../concepts/dup.md) [d](../concepts/plain.md) [e](../concepts/solo.md)");
  assert.deepEqual(result.unresolved, [{ path: missed.path, links: ["../concepts/dup.md", "../concepts/plain.md", "../concepts/solo.md"] }]);
});
