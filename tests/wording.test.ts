import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter, serializeFrontmatter } from "../src/lib/frontmatter.ts";
import { gitBodyOf, textHash } from "../src/lib/wording.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T10:05:00Z";
const PAGE = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const SEED = "## Why\n\nBecause the login must be simple.\n";
const ACCEPTED = "> Purpose: decide the login.\n\n## Main content\n\nEmail login only.\n\n## Open questions\n\n- Who owns it?\n\n## Sources\n\n- [Firebase auth](notion-page:abc)\n";

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

/** A promoted Document published to Notion once: its baselines are what Notion served back and what Git held. */
async function promotedDocument(dir: string, body = SEED): Promise<{ id: string; path: string }> {
  const created = await run(dir, ["note", "new"], { notes: [{ type: "reference", title: "Login page", frontmatter: { summary: "The login decision.", origin: "promoted", promoted_from: "dec-2p9f6h1r" }, body }] });
  assert.equal(created.code, 0, created.stdout);
  const { id, path } = created.json.data.created[0];
  const file = join(dir, path);
  const document = parseFrontmatter(await readFile(file, "utf8"));
  const seed = gitBodyOf({ body: document.body } as never);
  document.attributes.notion = PAGE;
  document.attributes.notion_published = { "@content": textHash(seed), "@notion_body": textHash(seed), "@git_body": textHash(seed) };
  await writeFile(file, serializeFrontmatter(document));
  return { id, path };
}

function wording(overrides: Record<string, unknown> = {}) {
  return { accepted: true, accepted_at: "2026-12-10T10:00:00Z", page_edited_at: "2026-12-10T10:00:00Z", body_markdown: ACCEPTED, unconvertible: false, pending_revision: false, pending_refresh: false, ...overrides };
}

async function plan(dir: string, rows: unknown[]) {
  const result = await run(dir, ["sync", "plan"], { as_of: NOW, rows });
  assert.equal(result.code, 0, result.stdout);
  return result.json.data;
}

const documentRow = (w: unknown) => ({ database: "documents", page_id: PAGE, last_edited: "2026-12-10T10:00:00Z", properties: {}, wording: w });

async function bodyOf(dir: string, path: string): Promise<string> {
  return parseFrontmatter(await readFile(join(dir, path), "utf8")).body;
}

test("an accepted Write up goes into the Git Document byte for byte, after the skill verified it", async (context) => {
  const dir = await fixtureCopy(context);
  const document = await promotedDocument(dir);
  const planned = await plan(dir, [documentRow(wording())]);
  assert.equal(planned.accepted_wording.length, 1);
  const item = planned.accepted_wording[0];
  assert.equal(item.note, document.id);
  assert.equal(item.fingerprint, textHash(ACCEPTED));
  assert.equal(item.unattended_ok, true);
  assert.deepEqual(planned.wording_waiting, []);
  // Without the skill's re-read the item is refused and nothing is written.
  const unverified = await run(dir, ["sync", "apply"], planned);
  assert.equal(unverified.json.data.accepted_wording[0].reason, "UNVERIFIED");
  assert.equal(await bodyOf(dir, document.path), `\n${SEED}`);
  // Verified: the text lands exactly, with its provenance and baselines.
  item.verified = { fingerprint: item.fingerprint, page_edited_at: item.page_edited_at };
  const applied = await run(dir, ["sync", "apply"], planned);
  assert.equal(applied.code, 0, applied.stdout);
  assert.equal(applied.json.data.accepted_wording[0].result, "applied");
  assert.equal(await bodyOf(dir, document.path), `\n${ACCEPTED}`);
  const after = parseFrontmatter(await readFile(join(dir, document.path), "utf8")).attributes;
  assert.ok((after.sources as string[]).includes(`notion:${PAGE}`));
  assert.equal((after.notion_published as Record<string, string>)["@notion_body"], textHash(ACCEPTED));
  assert.equal((after.notion_published as Record<string, string>)["@git_body"], textHash(ACCEPTED));
  const lint = await run(dir, ["lint"]);
  assert.equal(lint.code, 0, lint.stdout);
  // The next plan finds Notion and Git level, and asks the skill to clear Accepted.
  const next = await plan(dir, [documentRow(wording())]);
  assert.deepEqual(next.accepted_wording, []);
  assert.deepEqual(next.clear_accepted, [{ page_id: PAGE, note: document.id }]);
});

test("a body edited after acceptance gives no import, even when the edit made Notion equal Git", async (context) => {
  const dir = await fixtureCopy(context);
  const document = await promotedDocument(dir);
  const edited = await plan(dir, [documentRow(wording({ page_edited_at: "2026-12-10T10:01:00Z" }))]);
  assert.deepEqual(edited.accepted_wording, []);
  assert.deepEqual(edited.wording_waiting, [{ page_id: PAGE, note: document.id, reason: "EDITED_AFTER_ACCEPTANCE" }]);
  // Validation comes before the shortcut that consumes an acceptance: Notion equal to Git, edited later, is still stale.
  const level = await plan(dir, [documentRow(wording({ body_markdown: SEED, page_edited_at: "2026-12-10T10:01:00Z" }))]);
  assert.equal(level.wording_waiting[0].reason, "EDITED_AFTER_ACCEPTANCE");
  assert.deepEqual(level.clear_accepted, []);
  // The same minute as the click is the known limit of decision 0058: it is not detected.
  const sameMinute = await plan(dir, [documentRow(wording({ page_edited_at: "2026-12-10T10:00:00Z" }))]);
  assert.equal(sameMinute.accepted_wording.length, 1);
});

test("a pending revision blocks the import, accepted or not", async (context) => {
  const dir = await fixtureCopy(context);
  const document = await promotedDocument(dir);
  const accepted = await plan(dir, [documentRow(wording({ pending_revision: true }))]);
  assert.deepEqual(accepted.accepted_wording, []);
  assert.deepEqual(accepted.wording_waiting, [{ page_id: PAGE, note: document.id, reason: "REVISION_PENDING" }]);
  const drafted = await plan(dir, [documentRow(wording({ accepted: false, accepted_at: null, pending_revision: true }))]);
  assert.deepEqual(drafted.wording_waiting, [{ page_id: PAGE, note: document.id, reason: "REVISION_PENDING" }]);
});

test("fail closed: no acceptance time, no baseline, an unconvertible block, an unaccepted draft", async (context) => {
  const dir = await fixtureCopy(context);
  const document = await promotedDocument(dir);
  const undated = await plan(dir, [documentRow(wording({ accepted_at: null }))]);
  assert.equal(undated.wording_waiting[0].reason, "ACCEPTANCE_UNDATED");
  assert.deepEqual(undated.clear_accepted, []);
  const unconvertibleDraft = await plan(dir, [documentRow(wording({ accepted: false, accepted_at: null, body_markdown: null, unconvertible: true }))]);
  assert.deepEqual(unconvertibleDraft.wording_held, [{ page_id: PAGE, note: document.id }]);
  const unconvertibleAccepted = await plan(dir, [documentRow(wording({ body_markdown: null, unconvertible: true }))]);
  assert.equal(unconvertibleAccepted.wording_waiting[0].reason, "UNCONVERTIBLE_BLOCK");
  const draft = await plan(dir, [documentRow(wording({ accepted: false, accepted_at: null }))]);
  assert.deepEqual(draft.wording_held, [{ page_id: PAGE, note: document.id }]);
  assert.deepEqual(draft.accepted_wording, []);
  // No baseline: nothing is imported and nothing is claimed to conflict.
  const file = join(dir, document.path);
  const stored = parseFrontmatter(await readFile(file, "utf8"));
  delete (stored.attributes.notion_published as Record<string, unknown>)["@notion_body"];
  await writeFile(file, serializeFrontmatter(stored));
  const lost = await plan(dir, [documentRow(wording())]);
  assert.equal(lost.wording_waiting[0].reason, "NO_BASELINE");
  assert.deepEqual(lost.accepted_wording, []);
  const lostDraft = await plan(dir, [documentRow(wording({ accepted: false, accepted_at: null }))]);
  assert.equal(lostDraft.wording_held.length, 1);
});

test("Git changing alone is no conflict; both changing is GIT_CHANGED; a Git body that moved after the plan fails the apply", async (context) => {
  const dir = await fixtureCopy(context);
  const document = await promotedDocument(dir);
  const file = join(dir, document.path);
  const append = async (text: string) => { const stored = parseFrontmatter(await readFile(file, "utf8")); stored.body = `${stored.body}\n${text}\n`; await writeFile(file, serializeFrontmatter(stored)); };
  await append("A line added in Git.");
  // Notion unchanged since the last sync (N = SN), Git changed (G ≠ SG): nothing to import.
  const gitOnly = await plan(dir, [documentRow(wording({ body_markdown: SEED }))]);
  assert.deepEqual(gitOnly.wording_waiting, []);
  assert.deepEqual(gitOnly.accepted_wording, []);
  assert.deepEqual(gitOnly.clear_accepted, [{ page_id: PAGE, note: document.id }]);
  const both = await plan(dir, [documentRow(wording())]);
  assert.equal(both.wording_waiting[0].reason, "GIT_CHANGED");
});

test("Git moving between plan and apply writes nothing", async (context) => {
  const dir = await fixtureCopy(context);
  const document = await promotedDocument(dir);
  const planned = await plan(dir, [documentRow(wording())]);
  const item = planned.accepted_wording[0];
  item.verified = { fingerprint: item.fingerprint, page_edited_at: item.page_edited_at };
  const file = join(dir, document.path);
  const stored = parseFrontmatter(await readFile(file, "utf8"));
  stored.body = `${stored.body}\nEdited in Git meanwhile.\n`;
  await writeFile(file, serializeFrontmatter(stored));
  const applied = await run(dir, ["sync", "apply"], planned);
  assert.equal(applied.code, 1);
  assert.equal(applied.json.data.accepted_wording[0].reason, "GIT_CHANGED");
  assert.match(await bodyOf(dir, document.path), /Edited in Git meanwhile/);
  assert.doesNotMatch(await bodyOf(dir, document.path), /Email login only/);
});

test("an approved Related knowledge appendix goes after the accepted wording, which stays unchanged", async (context) => {
  const dir = await fixtureCopy(context);
  const document = await promotedDocument(dir);
  const planned = await plan(dir, [documentRow(wording())]);
  const item = planned.accepted_wording[0];
  item.verified = { fingerprint: item.fingerprint, page_edited_at: item.page_edited_at };
  assert.equal((await run(dir, ["sync", "apply"], planned)).code, 0);
  const appendix = "## Related knowledge\n\n- [Firebase auth](../decisions/2026-10-01-use-firebase-for-auth.md): the earlier decision this builds on.";
  const proposal = await run(dir, ["proposal", "new"], { proposals: [{ kind: "add_to_note", title: "Related knowledge for the login page", target: document.id, content: appendix, source: "src-7w3c9k5m", why: "Related knowledge for the accepted write-up" }] });
  assert.equal(proposal.code, 0, proposal.stdout);
  const id = proposal.json.data.created[0].id;
  const applied = await run(dir, ["apply"], { decisions: [{ proposal: id, action: "approve", decided_at: NOW, decided_by: "chat" }] });
  assert.equal(applied.code, 0, applied.stdout);
  const body = await bodyOf(dir, document.path);
  assert.ok(body.startsWith(`\n${ACCEPTED}`), "the accepted wording is unchanged and first");
  assert.match(body.slice(ACCEPTED.length + 1), /## Related knowledge/);
  const lint = await run(dir, ["lint"]);
  assert.equal(lint.code, 0, lint.stdout);
});

const REPORT = "## Where it stands\n\nOn track.\n\n## Timeline\n\n- Dec 1: kickoff\n\n## Decisions in force\n\nNone.\n\n## Open questions and risks\n\nNone.\n\n## People involved\n\nAlex.\n\n## Gaps\n\nNone.\n";

async function publishedReport(dir: string): Promise<{ id: string; path: string }> {
  // The Inbox database must be configured for a report to be rendered (cli §5.14.4).
  const configPath = join(dir, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.notion.databases.inbox = "a1000000-0000-4000-8000-00000000000c";
  await writeFile(configPath, JSON.stringify(config, null, 2));
  const created = await run(dir, ["report", "new"], { title: "Login: where we stand", question: "Where does the login stand?", body: REPORT });
  assert.equal(created.code, 0, created.stdout);
  const { id, path } = created.json.data;
  const file = join(dir, path);
  const document = parseFrontmatter(await readFile(file, "utf8"));
  const body = gitBodyOf({ body: document.body } as never);
  document.attributes.notion = "5c4d3e2f-1a0b-4c9d-8e7f-6a5b4c3d2e1f";
  document.attributes.notion_published = { "@content": "sha256:old", "@fixes": 0, "@notion_body": textHash(body), "@git_body": textHash(body) };
  await writeFile(file, serializeFrontmatter(document));
  return { id, path };
}

const reportRow = (page: string, w: unknown, properties: Record<string, unknown> = {}) => ({ database: "inbox", page_id: page, last_edited: "2026-12-10T10:00:00Z", properties: { "Brain ID": undefined, ...properties }, wording: w });

test("a publish keeps a pending proposed refresh and an unaccepted report draft; the Refresh report button queues no full refresh", async (context) => {
  const dir = await fixtureCopy(context);
  const report = await publishedReport(dir);
  const page = "5c4d3e2f-1a0b-4c9d-8e7f-6a5b4c3d2e1f";
  // Git moves on (a refresh in Git), so render would send the body.
  const stored = parseFrontmatter(await readFile(join(dir, report.path), "utf8"));
  stored.body = `\n${REPORT.replace("On track.", "Slipping.")}`;
  await writeFile(join(dir, report.path), serializeFrontmatter(stored));
  const sent = await run(dir, ["sync", "render", "--ids", report.id]);
  assert.equal(sent.json.data.items.length, 1);

  const button = await plan(dir, [reportRow(page, wording({ accepted: false, accepted_at: null, pending_refresh: true, body_markdown: REPORT }), { "Brain ID": report.id })]);
  assert.deepEqual(button.refresh_requests, [], "the button ticks no Refresh asked, so no full refresh is queued");
  assert.deepEqual(button.wording_waiting, [{ page_id: page, note: report.id, reason: "REFRESH_PENDING" }]);
  const planFile = join(dir, "..", "plan.json");
  await writeFile(planFile, JSON.stringify(button));
  const held = await run(dir, ["sync", "render", "--ids", report.id, "--plan", planFile]);
  assert.deepEqual(held.json.data.items, []);
  assert.deepEqual(held.json.data.skipped, [{ id: report.id, reason: "WORDING_PENDING" }]);

  const draft = await plan(dir, [reportRow(page, wording({ accepted: false, accepted_at: null, body_markdown: REPORT.replace("On track.", "A draft of mine.") }), { "Brain ID": report.id })]);
  assert.deepEqual(draft.wording_held, [{ page_id: page, note: report.id }]);
  await writeFile(planFile, JSON.stringify(draft));
  const kept = await run(dir, ["sync", "render", "--ids", report.id, "--plan", planFile]);
  assert.deepEqual(kept.json.data.skipped, [{ id: report.id, reason: "WORDING_PENDING" }]);

  // A queued full refresh waits while Notion text for that report is unresolved.
  const queued = await plan(dir, [reportRow(page, wording({ accepted: false, accepted_at: null, body_markdown: REPORT.replace("On track.", "A draft of mine.") }), { "Brain ID": report.id, "Refresh asked": true })]);
  assert.equal(queued.refresh_requests[0].wording_blocked, true);
});

test("an accepted refreshed report is imported exactly and keeps its six sections; one that lost them is refused", async (context) => {
  const dir = await fixtureCopy(context);
  const report = await publishedReport(dir);
  const page = "5c4d3e2f-1a0b-4c9d-8e7f-6a5b4c3d2e1f";
  const refreshed = REPORT.replace("On track.", "Done and shipped.");
  const planned = await plan(dir, [reportRow(page, wording({ body_markdown: refreshed }), { "Brain ID": report.id })]);
  assert.equal(planned.accepted_wording.length, 1);
  assert.equal(planned.accepted_wording[0].kind, "report");
  const item = planned.accepted_wording[0];
  item.verified = { fingerprint: item.fingerprint, page_edited_at: item.page_edited_at };
  const applied = await run(dir, ["sync", "apply"], planned);
  assert.equal(applied.code, 0, applied.stdout);
  assert.equal(await bodyOf(dir, report.path), `\n${refreshed}`);
  assert.equal((await run(dir, ["lint"])).code, 0);

  const broken = await plan(dir, [reportRow(page, wording({ body_markdown: "## Where it stands\n\nOnly this.\n" }), { "Brain ID": report.id })]);
  assert.equal(broken.wording_waiting[0].reason, "INVALID_REPORT_SHAPE");
  assert.deepEqual(broken.accepted_wording, []);
});

test("a snapshot row with a malformed wording object is refused", async (context) => {
  const dir = await fixtureCopy(context);
  await promotedDocument(dir);
  const bad = await run(dir, ["sync", "plan"], { as_of: NOW, rows: [documentRow({ accepted: "yes", accepted_at: "tomorrow", page_edited_at: "now" })] });
  assert.notEqual(bad.code, 0);
  assert.match(bad.stdout, /wording/);
});
