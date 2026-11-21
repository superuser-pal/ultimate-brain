import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { meeting, note, snapshot, world, type NoteSpec } from "./assistant-world.ts";
import { brain } from "./helpers.ts";
import { bodies, configure, plan, proposalFiles, readText, runWeek, tree } from "./weekly-world.ts";

// CC-370: `brain cleanup plan | apply | undo | ticks` and the Weekly row's Clean-up (spec/weekly-review.md §15, cli.md §5.38) on a
// synthetic brain that holds one case of each mechanical kind and the cases that must be left alone. Every name is invented.

const NOW = "2026-11-09T08:00:00Z"; // Monday, 2026-W46
const READ = "2026-11-10T07:30:00Z";
const NEXT = "2026-11-16T08:00:00Z"; // 2026-W47
const LATER = "2026-11-23T08:00:00Z"; // 2026-W48
const MEET = "mtg-4k8m2q7t";
const PAIRED = "dec-2p9f6h1r"; // names the meeting in decided_in; the meeting's decisions lacks it: pair_half
const LINKER = "dec-6r2w8k4m"; // links a file Git renamed: moved_link
const LENA = "per-3h8w2n6c"; // repeated alias: repeated_value
const IVO = "per-8d4f2j6k"; // repeated alias: repeated_value
const TILER_OLD = "dec-7j3n6r8x"; // the survivor (older)
const TILER_NEW = "dec-5w9h2k7d"; // its exact duplicate: exact_duplicate
const PAINT_A = "dec-3d8k2w6p"; // a near duplicate pair: never mechanical
const PAINT_B = "dec-8f4m7q2v";
const STALE = "dec-9q3t6w2y"; // a draft 61 days old, never reviewed, unlinked: stale_draft
const YOUNG = "dec-4h7k2m9p"; // a draft 59 days old: left alone
const LINKED = "dec-2c6v8m3q"; // a draft 69 days old that a note links to: left alone
const OLD_REVIEWED = "dec-6t3w8k2p"; // reviewed and old: left alone
const PAGE = "6c5d4e3f-2a1b-4c0d-9e8f-7a6b5c4d3e2f";
const INBOX = "a1000000-0000-4000-8000-00000000000c";
const KINDS = ["pair_half", "moved_link", "repeated_value", "repeated_value", "exact_duplicate", "stale_draft"];

const git = (dir: string, ...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
/** Commit whatever the last step wrote, as the skill does after each write (and a user would after an edit). */
function settle(dir: string, message = "state") {
  if (!existsSync(join(dir, ".git"))) { git(dir, "init", "-q"); git(dir, "config", "user.email", "t@example.com"); git(dir, "config", "user.name", "T"); git(dir, "config", "commit.gpgsign", "false"); }
  git(dir, "add", "-A");
  if (git(dir, "status", "--porcelain").trim() !== "") git(dir, "commit", "-q", "-m", message);
}
let inputs = 0;
async function input(root: string, value: unknown): Promise<string> {
  const path = join(root, "..", `cleanup-${inputs += 1}.json`);
  await writeFile(path, JSON.stringify(value));
  return path;
}
const run = async (root: string, args: string[], now = NOW) => brain([...args, "--brain", root, "--now", now, "--json"]);
const fm = async (root: string, path: string) => parseFrontmatter(await readText(root, path)).attributes as Record<string, any>;
const proposal = async (root: string, id: string) => {
  for (const name of await proposalFiles(root)) { const attributes = await fm(root, `_proposals/${name}`); if (attributes.id === id) return attributes; }
  throw new Error(`no proposal ${id}`);
};
const decision = (id: string, title: string, extra: Record<string, unknown> = {}): NoteSpec => note({ id, type: "decision", title, date: "2026-10-01", ...extra });
const person = (id: string, title: string, extra: Record<string, unknown> = {}): NoteSpec => note({ id, type: "person", title, ...extra });

/** One case of each mechanical kind (two repeated values), a near duplicate, and three drafts the rule leaves alone; committed, with one rename. */
async function fixture(context: TestContext, extra: NoteSpec[] = []): Promise<string> {
  const root = await world(context, [
    meeting(MEET, "Harbor sync", "2026-11-02", { tags: ["harbor", "harbor"] }), // a repeated tag: the meeting's record, never a target
    decision(PAIRED, "Launch in March", { decided_in: MEET }),
    decision(LINKER, "Hire a second tester"),
    person(LENA, "Lena Hart", { path: "knowledge/people/lena-hart.md", aliases: ["Lena", "Lena"] }),
    person(IVO, "Ivo Brand", { aliases: ["Ivo", "Ivo"] }),
    decision(TILER_OLD, "Use the Pinecrest tiler", { created: "2026-10-01" }),
    decision(TILER_NEW, "Use the  pinecrest Tiler", { created: "2026-10-02" }),
    decision(PAINT_A, "Pick the paint", { created: "2026-10-03" }),
    decision(PAINT_B, "Pick the paint", { created: "2026-10-04" }),
    decision(STALE, "Old vendor shortlist", { lifecycle: "draft", created: "2026-09-09" }),
    decision(YOUNG, "New vendor shortlist", { lifecycle: "draft", created: "2026-09-11" }),
    decision(LINKED, "Venue shortlist", { lifecycle: "draft", created: "2026-09-01" }),
    decision(OLD_REVIEWED, "Keep the old supplier", { created: "2026-01-02" }),
    ...extra,
  ]);
  await bodies(root, {
    [`knowledge/decisions/${PAIRED}.md`]: `We launch in March. See [the venue shortlist](${LINKED}.md).`,
    [`knowledge/decisions/${LINKER}.md`]: "Ask [Lena](../people/lena-hart.md) before hiring.",
    [`knowledge/decisions/${TILER_OLD}.md`]: "The Pinecrest tiler does   the bathrooms.",
    [`knowledge/decisions/${TILER_NEW}.md`]: "The Pinecrest tiler does the bathrooms.",
    [`knowledge/decisions/${PAINT_A}.md`]: "Use the blue paint.",
    [`knowledge/decisions/${PAINT_B}.md`]: "Use the blue paint for the hall.",
  });
  settle(root, "the brain");
  // The person's file is renamed in Git: the link in LINKER now points to a path that no longer exists.
  git(root, "mv", "knowledge/people/lena-hart.md", `knowledge/people/${LENA}.md`);
  settle(root, "rename");
  return root;
}

const subjects = (root: string, range: string) => git(root, "log", "--reverse", "--format=%s%x1f%b%x1e", range).split("\x1e").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
  const [subject, body] = entry.split("\x1f") as [string, string];
  return { subject, body };
});

test("plan finds each mechanical kind once, in §15.2's order, and leaves the near duplicate and the young, reviewed and linked drafts alone", async (context) => {
  const root = await fixture(context);
  const before = await tree(root);
  const planned = await run(root, ["cleanup", "plan"]);
  assert.equal(planned.code, 0, planned.stdout);
  const { items, held } = planned.json.data;
  assert.deepEqual(items.map((item: any) => item.tidy), KINDS);
  assert.equal(held, 0);
  assert.deepEqual(items.map((item: any) => item.targets[0]), [MEET, LINKER, LENA, IVO, TILER_NEW, STALE]);
  const byKind = Object.fromEntries(items.map((item: any) => [`${item.tidy}:${item.targets[0]}`, item]));
  assert.deepEqual(byKind[`pair_half:${MEET}`].proposal_input.after, [PAIRED]);
  assert.equal(byKind[`moved_link:${LINKER}`].proposal_input.line_after, `Ask [Lena](../people/${LENA}.md) before hiring.`);
  assert.deepEqual(byKind[`repeated_value:${LENA}`].proposal_input.after, ["Lena"]);
  assert.deepEqual([byKind[`exact_duplicate:${TILER_NEW}`].proposal_input.kind, byKind[`exact_duplicate:${TILER_NEW}`].proposal_input.merge_into], ["merge", TILER_OLD]);
  assert.equal(byKind[`stale_draft:${STALE}`].proposal_input.kind, "archive_draft");
  for (const item of items) assert.match(item.proposal_input.source, /^agent:brain-weekly-review\/20261109T080000Z$/);
  const all = JSON.stringify(items);
  for (const id of [PAINT_A, PAINT_B, YOUNG, LINKED, OLD_REVIEWED]) assert.equal(all.includes(id), false, `${id} is no mechanical item`);
  assert.equal(items.some((item: any) => item.tidy === "repeated_value" && item.targets[0] === MEET), false, "a meeting's lists other than decisions and questions are never cleaned up");
  assert.deepEqual(await tree(root), before, "plan writes nothing");
});

test("apply: each item in its own commit with its trailers, decided by the clean-up; each undo leaves the brain as it was; an undone item is never applied alone again", async (context) => {
  const root = await fixture(context);
  const base = git(root, "rev-parse", "HEAD").trim();
  const applied = await run(root, ["cleanup", "apply"]);
  assert.equal(applied.code, 0, applied.stdout);
  const data = applied.json.data;
  assert.deepEqual([data.applied.map((item: any) => item.tidy), data.failed, data.deferred, data.left], [KINDS, [], 0, 0]);
  assert.equal(git(root, "status", "--porcelain").trim(), "", "every write is committed");

  const commits = subjects(root, `${base}..HEAD`);
  assert.equal(commits.length, KINDS.length, "one commit per item");
  for (const [index, item] of data.applied.entries()) {
    assert.equal(commits[index]!.subject, `Clean-up: ${item.title}`);
    assert.match(commits[index]!.body, /^Op: op-[0-9a-f]{8}$/m);
    assert.match(commits[index]!.body, new RegExp(`^Cleanup: ${item.proposal}$`, "m"));
    const attributes = await proposal(root, item.proposal);
    assert.deepEqual([attributes.status, attributes.tidy, attributes.decision.decided_by, attributes.decision.action], ["applied", item.tidy, "cleanup", "approve"]);
  }
  assert.deepEqual((await fm(root, `knowledge/meetings/${MEET}.md`)).decisions, [PAIRED]);
  assert.match(await readText(root, `knowledge/decisions/${LINKER}.md`), new RegExp(`\\[Lena\\]\\(\\.\\./people/${LENA}\\.md\\)`));
  assert.deepEqual((await fm(root, `knowledge/people/${LENA}.md`)).aliases, ["Lena"]);
  assert.equal((await fm(root, `knowledge/decisions/${STALE}.md`)).lifecycle, "archived");
  const log = await readText(root, "log/2026-11.md");
  assert.equal(log.match(/ tidy prp-/g)?.length, KINDS.length, log);
  assert.deepEqual((await run(root, ["cleanup", "plan"])).json.data, { items: [], held: 0 }, "nothing left to find");

  // Every undo restores its files from the item's parent, in its own commit.
  for (const item of [...data.applied].reverse()) {
    const undone = await run(root, ["cleanup", "undo", item.proposal]);
    assert.equal(undone.code, 0, undone.stdout);
    assert.ok(undone.json.data.restored.length >= 1);
    const attributes = await proposal(root, item.proposal);
    assert.deepEqual([attributes.status, attributes.closed_reason, attributes.undone_at], ["closed", "undone", NOW]);
    const last = subjects(root, "HEAD~1..HEAD")[0]!;
    assert.equal(last.subject, `Undo clean-up: ${item.title}`);
    assert.match(last.body, new RegExp(`^Cleanup-undo: ${item.proposal}$`, "m"));
  }
  assert.equal(git(root, "diff", base, "HEAD", "--", ".", ":(exclude)_proposals", ":(exclude)log").trim(), "", "the brain is as it was");
  assert.equal(git(root, "status", "--porcelain").trim(), "");
  assert.deepEqual((await run(root, ["cleanup", "plan"])).json.data, { items: [], held: KINDS.length }, "undone: held, not found again");
  const again = await run(root, ["cleanup", "undo", data.applied[0].proposal]);
  assert.equal(again.json.error.code, "ALREADY_UNDONE");
});

test("undo refuses an item whose file changed since (UNDO_STALE) and writes nothing; a proposal the clean-up didn't apply is NOT_A_CLEANUP", async (context) => {
  const root = await fixture(context);
  const applied = (await run(root, ["cleanup", "apply"])).json.data.applied;
  const pair = applied.find((item: any) => item.tidy === "pair_half");
  const path = `knowledge/meetings/${MEET}.md`;
  await writeFile(join(root, path), `${await readText(root, path)}\nThe user added a line.\n`);
  settle(root, "an edit");
  const before = await tree(root);
  const head = git(root, "rev-parse", "HEAD").trim();
  const stale = await run(root, ["cleanup", "undo", pair.proposal]);
  assert.equal(stale.json.error.code, "UNDO_STALE", stale.stdout);
  assert.equal(stale.code, 5);
  assert.deepEqual(stale.json.error.details.map((detail: any) => detail.path), [path]);
  assert.deepEqual([await tree(root), git(root, "rev-parse", "HEAD").trim()], [before, head], "nothing written");
  assert.equal((await proposal(root, pair.proposal)).status, "applied");

  const missing = await run(root, ["cleanup", "undo", "prp-0000zzzz"]);
  assert.equal(missing.json.error.code, "UNKNOWN_ID");
  const proposed = await brain(["proposal", "new", "--brain", root, "--input", await input(root, { proposals: [{ kind: "archive_draft", tidy: "stale_draft", title: "Archive the draft \"New vendor shortlist\"", why: "A test of the refusal.", target: YOUNG, source: "agent:brain-weekly-review/20261109T080000Z", passages: ["agent:brain-weekly-review/20261109T080000Z"], fingerprint: `tidy:stale_draft:${YOUNG}`, evidence: [] }] }), "--now", NOW, "--json"]);
  assert.equal(proposed.code, 0, proposed.stdout);
  const notCleanup = await run(root, ["cleanup", "undo", proposed.json.data.created[0].id]);
  assert.equal(notCleanup.json.error.code, "NOT_A_CLEANUP");
});

test("apply: --max holds the rest for next week; with settings.cleanup.auto off nothing is applied alone (CLEANUP_OFF); a dirty tree is refused", async (context) => {
  const root = await fixture(context);
  for (const max of ["0", "21", "two"]) assert.equal((await run(root, ["cleanup", "apply", "--max", max])).json.error.code, "USAGE", max);
  const two = await run(root, ["cleanup", "apply", "--max", "2"]);
  assert.deepEqual([two.json.data.applied.length, two.json.data.left], [2, KINDS.length - 2]);

  await writeFile(join(root, "scratch.md"), "uncommitted\n");
  assert.equal((await run(root, ["cleanup", "apply"])).json.error.code, "DIRTY_TREE");
  git(root, "clean", "-fq");

  await configure(root, (config) => { config.settings = { ...config.settings, cleanup: { auto: "off" } }; });
  settle(root, "auto off");
  const before = await tree(root);
  const off = await run(root, ["cleanup", "apply"]);
  assert.equal(off.json.error.code, "CLEANUP_OFF", off.stdout);
  assert.deepEqual(await tree(root), before, "nothing written");
});

/** A brain publishing its weekly row to the Inbox (Kind Weekly), with the clean-up on or off. */
async function publishing(context: TestContext, auto: "on" | "off", extra: NoteSpec[] = []): Promise<string> {
  const root = await fixture(context, extra);
  await configure(root, (config) => {
    config.notion.databases = { ...config.notion.databases, inbox: INBOX };
    config.settings = { ...config.settings, publish: "auto", cleanup: { auto } };
  });
  settle(root, "configured");
  return root;
}

/** The skill's publish: render the week's row and record its page (cli.md §5.34). */
async function publish(root: string, id: string, now: string, rowState?: unknown): Promise<any> {
  const args = ["sync", "render", "--ids", id, ...(rowState === undefined ? [] : ["--row-state", await input(root, rowState)])];
  const rendered = (await run(root, args, now)).json.data;
  const item = rendered.items[0];
  if (item !== undefined) assert.equal((await run(root, ["sync", "record", "--input", await input(root, { records: [{ id, notion: PAGE, synced_at: now, published: item.published }] })], now)).code, 0);
  settle(root, "published");
  return { rendered, item };
}

const rowOf = async (root: string, week: string) => JSON.parse(await readText(root, "_weekly/state.json")).weeks[week].row as Record<string, { proposal: string; base: Array<{ path: string; hash: string }> }>;

test("busy week with clean-up (§14): the mechanical items applied alone under Already cleaned as U lines, each its own commit; nothing else applied", async (context) => {
  const root = await publishing(context, "on");
  const base = git(root, "rev-parse", "HEAD").trim();
  const cleaned = (await run(root, ["cleanup", "apply"])).json.data.applied;
  const week = await runWeek(root, snapshot({ as_of: NOW }), NOW, { cleaned, mode: "unattended", publish: true });
  assert.equal(week.record!.code, 0, week.record!.stdout);
  assert.deepEqual(week.plan.json.data.cleanup, [], "applied already: nothing for the plan to offer");
  assert.equal(week.record!.json.data.counts.cleaned, KINDS.length);
  const body = await readText(root, "reports/2026-11-09-weekly-review.md");
  const lines = body.split("\n").filter((line) => line.startsWith("- [ ] U"));
  assert.deepEqual(lines.map((line) => line.split(" · ")[0]), KINDS.map((_, index) => `- [ ] U${index + 1}`));
  for (const [index, line] of lines.entries()) {
    assert.ok(line.endsWith(" · tick to undo"), line);
    assert.ok(line.length <= 200, line);
    assert.ok(line.includes(cleaned[index].title.replace(/^(Add|Link|Point|Remove|Merge|Archive)/, (verb: string) => `${verb === "Add" ? "Added" : verb === "Link" ? "Linked" : verb === "Point" ? "Pointed" : verb === "Remove" ? "Removed" : verb === "Merge" ? "Merged" : "Archived"}`)), line);
  }
  assert.match(body, /## Clean-up\n\*\*Already cleaned\*\*\n/);
  assert.equal(body.includes("For you to tick"), false);
  const row = await rowOf(root, "2026-W46");
  assert.deepEqual(Object.keys(row), KINDS.map((_, index) => `U${index + 1}`));
  assert.deepEqual(Object.values(row).map((slot) => slot.proposal), cleaned.map((item: any) => item.proposal));
  assert.match((await readText(root, "log/2026-11.md")), / weekly - "" mode=unattended week=2026-W46 coverage=complete actions=0 doubtful=0 cleaned=6 targets=0 queued=0 /);
  // Only the clean-up's own commits came before the run's write; no other proposal was applied.
  assert.equal(subjects(root, `${base}..HEAD`).filter((commit) => commit.subject.startsWith("Clean-up: ")).length, KINDS.length);
  for (const name of await proposalFiles(root)) {
    const attributes = await fm(root, `_proposals/${name}`);
    assert.equal(attributes.decision?.decided_by, "cleanup", name);
  }
});

test("settings.cleanup.auto off (§14): nothing applied alone; the mechanical items are offered as C items, each a pending proposal of the row with Show the change", async (context) => {
  const root = await publishing(context, "off");
  const week = await runWeek(root, snapshot({ as_of: NOW }), NOW, { mode: "unattended", publish: true });
  assert.equal(week.record!.code, 0, week.record!.stdout);
  assert.equal(week.plan.json.data.cleanup_auto, false);
  const items = week.select!.json.data.items;
  assert.deepEqual(items.map((item: any) => [item.part, item.stream]), KINDS.map(() => ["C", "cleanup"]));
  const row = await rowOf(root, "2026-W46");
  assert.deepEqual(Object.keys(row), KINDS.map((_, index) => `C${index + 1}`));
  for (const slot of Object.values(row)) {
    const attributes = await proposal(root, slot.proposal);
    assert.deepEqual([attributes.status, attributes.weekly], ["pending", "2026-W46"]);
    assert.ok(slot.base.length >= 1 && slot.base.every((entry) => /^sha256:[0-9a-f]{64}$/.test(entry.hash)), JSON.stringify(slot.base));
  }
  assert.equal(git(root, "log", "--format=%s").split("\n").some((subject) => subject.startsWith("Clean-up: ")), false, "nothing applied alone");
  const { item } = await publish(root, week.record!.json.data.id, NOW);
  assert.equal(item.body.match(/<summary>Show the change<\/summary>/g)?.length, KINDS.length);
  assert.equal(item.body.match(/^\tYour note:$/gm)?.length, KINDS.length);
  // The session leaves them out: they are the row's.
  const waiting = await run(root, ["proposal", "list", "--waiting"]);
  assert.equal(waiting.json.data.counts.in_weekly_row, KINDS.length, waiting.stdout);
});

test("a Ready row read by a scheduled catch-up, then by an attended one (§14): plain ticks applied, a note waits, a stale tick is closed, unticked items wait until nothing else does", async (context) => {
  const root = await publishing(context, "off");
  const week = await runWeek(root, snapshot({ as_of: NOW }), NOW, { mode: "unattended", publish: true });
  assert.equal(week.record!.code, 0, week.record!.stdout);
  await publish(root, week.record!.json.data.id, NOW);
  const row = await rowOf(root, "2026-W46");
  const label = async (tidy: string, target: string) => {
    for (const [name, slot] of Object.entries(row)) { const attributes = await proposal(root, slot.proposal); if (attributes.tidy === tidy && attributes.target === target) return name; }
    throw new Error(`no ${tidy} for ${target}`);
  };
  const [pair, link, lena, ivo, dup, stale] = [await label("pair_half", MEET), await label("moved_link", LINKER), await label("repeated_value", LENA), await label("repeated_value", IVO), await label("exact_duplicate", TILER_NEW), await label("stale_draft", STALE)];
  // Ivo's note changed after the row was written: its tick is stale.
  await writeFile(join(root, `knowledge/people/${IVO}.md`), (await readText(root, `knowledge/people/${IVO}.md`)).replace("summary: Synthetic.", "summary: Synthetic, edited."));
  settle(root, "an edit");

  const items = (ticked: Record<string, boolean>, notes: Record<string, string> = {}) => Object.keys(row).map((name) => ({ label: name, ticked: ticked[name] ?? false, note: notes[name] ?? "" }));
  const scheduled = { week: "2026-W46", page: PAGE, read_at: READ, items: [...items({ [pair]: true, [lena]: true, [link]: true, [ivo]: true }, { [link]: "only the first link" }), { label: "C99", ticked: true, note: "" }] };
  const first = await run(root, ["cleanup", "ticks", "--input", await input(root, scheduled)], READ);
  assert.equal(first.code, 0, first.stdout);
  const results = (run: any) => Object.fromEntries(run.json.data.results.map((entry: any) => [entry.label, [entry.result, entry.reason ?? null]]));
  assert.deepEqual(results(first), {
    [pair]: ["applied", null], [lena]: ["applied", null], [link]: ["waiting", null], [ivo]: ["stale", "STALE_PROPOSAL"],
    [dup]: ["open", null], [stale]: ["open", null], C99: ["skipped", "UNKNOWN_LABEL"],
  });
  assert.equal(first.json.data.done, false);
  assert.deepEqual([(await proposal(root, row[pair]!.proposal)).decision.decided_by, (await proposal(root, row[pair]!.proposal)).decision.decided_at], ["tick", READ]);
  assert.deepEqual([(await proposal(root, row[ivo]!.proposal)).status, (await proposal(root, row[ivo]!.proposal)).closed_reason], ["closed", "stale"]);
  assert.equal((await proposal(root, row[link]!.proposal)).status, "pending");
  assert.deepEqual((await fm(root, `knowledge/meetings/${MEET}.md`)).decisions, [PAIRED], "the plain tick is applied");
  assert.match(await readText(root, "log/2026-11.md"), / weekly-ticks - "" week=2026-W46 applied=2 declined=0 open=2 stale=1 waiting=1 undone=0 skipped=1/);
  settle(root, "the scheduled catch-up");
  const again = await run(root, ["cleanup", "ticks", "--input", await input(root, scheduled)], READ);
  assert.deepEqual([results(again)[pair], results(again)[ivo]], [["already", null], ["already", null]], "reading the same row twice applies nothing twice");
  settle(root, "read again");

  // The user ticks the duplicate before the attended catch-up; the noted item is asked; the draft stays unticked.
  const attendedInput = { ...scheduled, items: items({ [pair]: true, [lena]: true, [link]: true, [ivo]: true, [dup]: true }, { [link]: "only the first link" }) };
  const attended = await run(root, ["cleanup", "ticks", "--attended", "--input", await input(root, attendedInput)], READ);
  assert.deepEqual([results(attended)[dup], results(attended)[link], results(attended)[stale]], [["applied", null], ["ask", null], ["open", null]]);
  assert.equal(attended.json.data.results.find((entry: any) => entry.label === link).note, "only the first link");
  settle(root, "the attended catch-up");
  const answered = await brain(["apply", "--brain", root, "--now", READ, "--json", "--input", await input(root, { decisions: [{ proposal: row[link]!.proposal, action: "approve", decided_at: READ, decided_by: "chat", note: "only the first link; yes" }] })]);
  assert.equal(answered.code, 0, answered.stdout);
  settle(root, "answered");
  const last = await run(root, ["cleanup", "ticks", "--attended", "--input", await input(root, attendedInput)], READ);
  assert.deepEqual([results(last)[link], results(last)[stale]], [["already", null], ["declined", null]]);
  assert.equal(last.json.data.done, true);
  const declined = await proposal(root, row[stale]!.proposal);
  assert.deepEqual([declined.status, declined.decision.action, declined.decision.decided_by, declined.decision.note], ["closed", "reject", "tick", "unticked when the row was set Ready"]);
  settle(root, "done");
  const { item } = await publish(root, week.record!.json.data.id, READ);
  assert.deepEqual(item.properties["Brain Status"], { type: "select", value: "Done" });
  // Declined: not offered again while its fingerprint is unchanged (§7, §15.2).
  const replanned = (await run(root, ["cleanup", "plan"], NEXT)).json.data;
  assert.equal(replanned.items.some((entry: any) => entry.targets.includes(STALE)), false);
  assert.ok(replanned.held >= 1);
});

test("an undo by a tick (§14): U1 ticked restores its files and closes it undone; a U item whose file changed since is stale and nothing is restored", async (context) => {
  const root = await publishing(context, "on");
  const base = git(root, "rev-parse", "HEAD").trim();
  const cleaned = (await run(root, ["cleanup", "apply"])).json.data.applied;
  const week = await runWeek(root, snapshot({ as_of: NOW }), NOW, { cleaned, mode: "unattended", publish: true });
  assert.equal(week.record!.code, 0, week.record!.stdout);
  await publish(root, week.record!.json.data.id, NOW);
  // U2 (the moved link) is edited by the user after the clean-up.
  const linker = `knowledge/decisions/${LINKER}.md`;
  await writeFile(join(root, linker), `${await readText(root, linker)}\nA later line.\n`);
  settle(root, "an edit");
  const ticks = { week: "2026-W46", page: PAGE, read_at: READ, items: [{ label: "U1", ticked: true, note: "" }, { label: "U2", ticked: true, note: "" }, { label: "U3", ticked: false, note: "" }] };
  const read = await run(root, ["cleanup", "ticks", "--input", await input(root, ticks)], READ);
  assert.equal(read.code, 0, read.stdout);
  assert.deepEqual(read.json.data.results.map((entry: any) => [entry.label, entry.result, entry.reason ?? null]), [["U1", "undone", null], ["U2", "stale", "UNDO_STALE"], ["U3", "kept", null]]);
  assert.equal(read.json.data.done, true, "U items don't hold the row open");
  settle(root, "ticks");
  const meetingPath = `knowledge/meetings/${MEET}.md`;
  assert.equal(git(root, "diff", base, "HEAD", "--", meetingPath).trim(), "", "U1's file is as before the clean-up");
  assert.match(await readText(root, linker), new RegExp(`people/${LENA}\\.md`), "U2 is not undone");
  const u1 = await proposal(root, cleaned[0].proposal);
  assert.deepEqual([u1.status, u1.closed_reason], ["closed", "undone"]);
  assert.match(await readText(root, "log/2026-11.md"), new RegExp(` tidy-undo ${cleaned[0].proposal} .* restored=1`));
  const replanned = (await run(root, ["cleanup", "plan"], NEXT)).json.data;
  assert.equal(replanned.items.some((entry: any) => entry.targets.includes(MEET)), false, "undone: never applied alone again");
});

test("a row never set Ready (§14): its items carry into next week's row first, once; the earlier report says where they went and its row turns Done; a Ready row is not carried", async (context) => {
  const root = await publishing(context, "off");
  const week1 = await runWeek(root, snapshot({ as_of: NOW }), NOW, { mode: "unattended", publish: true });
  assert.equal(week1.record!.code, 0, week1.record!.stdout);
  await publish(root, week1.record!.json.data.id, NOW);
  const row1 = await rowOf(root, "2026-W46");
  const proposalsBefore = await proposalFiles(root);

  const snap2 = { ...snapshot({ as_of: NEXT }), weekly_rows: [{ page: PAGE, week: "2026-W46", brain_status: "New" }] };
  const week2 = await runWeek(root, snap2, NEXT, { mode: "unattended", publish: true });
  assert.equal(week2.record!.code, 0, week2.record!.stdout);
  assert.deepEqual(week2.plan.json.data.carry.map((entry: any) => entry.label), Object.keys(row1));
  // First the carried items, in their order; then this week's own (the 59-day draft is 66 days old now).
  const items = week2.select!.json.data.items;
  const carried = Object.values(row1).map((slot) => ["C", "carried", "2026-W46", slot.proposal]);
  assert.deepEqual(items.slice(0, carried.length).map((item: any) => [item.part, item.because, item.carried_from, item.proposal]), carried);
  assert.deepEqual(items.slice(carried.length).map((item: any) => [item.because, item.targets]), [["new", [YOUNG]]]);
  assert.equal((await proposalFiles(root)).filter((name) => !proposalsBefore.includes(name)).length, 1, "no duplicate proposal: only the new item's");
  const row2 = await rowOf(root, "2026-W47");
  assert.deepEqual(Object.values(row2).slice(0, carried.length).map((slot) => slot.proposal), Object.values(row1).map((slot) => slot.proposal), "each item once, first");
  assert.equal(new Set(Object.values(row2).map((slot) => slot.proposal)).size, Object.keys(row2).length);
  for (const slot of Object.values(row2)) assert.equal((await proposal(root, slot.proposal)).weekly, "2026-W47");

  const earlier = await readText(root, "reports/2026-11-09-weekly-review.md");
  assert.match(earlier, /^Moved to Week of 16 Nov 2026: 0 actions and 6 clean-up items\.$/m);
  assert.equal(/^- \[ \] C\d/m.test(earlier), false, "the moved to-dos are gone");
  assert.deepEqual(week2.record!.json.data.moved.map((entry: any) => entry.week), ["2026-W46"]);
  const state = JSON.parse(await readText(root, "_weekly/state.json"));
  assert.equal(state.weeks["2026-W46"].carried_to, "2026-W47");
  const rendered = (await run(root, ["sync", "render", "--ids", week1.record!.json.data.id, "--row-state", await input(root, { page: PAGE, items: [] })], NEXT)).json.data;
  assert.deepEqual(rendered.items[0]?.properties["Brain Status"], { type: "select", value: "Done" }, "the earlier row is Done");
  settle(root, "week 2");

  // Week 2's row was set Ready: its items wait for the catch-up and are not carried again.
  const snap3 = { ...snapshot({ as_of: LATER }), weekly_rows: [{ page: PAGE, week: "2026-W46", brain_status: "Done" }, { page: "7c5d4e3f-2a1b-4c0d-9e8f-7a6b5c4d3e2f", week: "2026-W47", brain_status: "Ready" }] };
  const week3 = await runWeek(root, snap3, LATER, { mode: "unattended" });
  assert.equal(((week3.plan as { summary?: any }).summary ?? week3.plan.json.data).counts.carry, 0);
});

test("a same-week rerun (§14): one row, the ticks and notes kept on their labels, a new item numbered after the highest", async (context) => {
  const root = await publishing(context, "off");
  const week = await runWeek(root, snapshot({ as_of: NOW }), NOW, { mode: "unattended", publish: true });
  assert.equal(week.record!.code, 0, week.record!.stdout);
  const id = week.record!.json.data.id;
  await publish(root, id, NOW);
  const before = await rowOf(root, "2026-W46");

  // New input: one more repeated value.
  const extra = person("per-5j8r3x6m", "Mira Lund", { aliases: ["Mira", "Mira"] });
  const { path, ...attributes } = extra;
  const { stringify } = await import("yaml");
  await writeFile(join(root, path), `---\n${stringify(attributes, { lineWidth: 0, flowCollectionPadding: false })}---\n`);
  settle(root, "new input");
  const later = "2026-11-09T10:00:00Z";
  const rerun = await runWeek(root, snapshot({ as_of: later }), later, { mode: "unattended", publish: true });
  assert.equal(rerun.record!.code, 0, rerun.record!.stdout);
  assert.equal(rerun.record!.json.data.id, id, "the same report");
  const after = await rowOf(root, "2026-W46");
  for (const [label, slot] of Object.entries(before)) assert.equal(after[label]?.proposal, slot.proposal, `${label} keeps its item`);
  assert.deepEqual(Object.keys(after).filter((label) => before[label] === undefined), ["C7"]);

  const rowState = { page: PAGE, items: [{ label: "C1", ticked: true, note: "" }, { label: "C2", ticked: false, note: "keep both aliases" }] };
  const { item } = await publish(root, id, later, rowState);
  assert.equal(item.action, "update");
  assert.match(item.body, /^- \[x\] C1 · /m);
  assert.match(item.body, /^- \[ \] C2 · [^\n]+\n(?:\t[^\n]*\n)*\tYour note: keep both aliases$/m);
  assert.match(item.body, /^- \[ \] C7 · /m);
});

test("the caps hold: at most 10 doubtful items, the rest queued with the clean-up off; a quiet week writes nothing", async (context) => {
  const ids = ["2b7d4f9h", "3c8f5g2j", "4d9g6h3k", "5f2h7j4m", "6g3j8k5n", "7h4k9m6p"];
  const extra = ids.map((id, index) => person(`per-${id}`, `Extra person ${index + 1}`, { aliases: [`Alias ${index + 1}`, `Alias ${index + 1}`] }));
  const root = await publishing(context, "off", extra);
  const week = await runWeek(root, snapshot({ as_of: NOW }), NOW, { mode: "unattended" });
  assert.equal(week.record!.code, 0, week.record!.stdout);
  const selection = week.select!.json.data;
  assert.equal(selection.counts.doubtful, 10);
  assert.equal(selection.items.filter((item: any) => item.part === "C").length, 10);
  assert.equal(selection.queued.length, KINDS.length + ids.length - 10);

  const quiet = await world(context, [meeting(MEET, "Harbor sync", "2026-10-02", { decisions: [] })]);
  settle(quiet, "a quiet brain");
  const before = await tree(quiet);
  const planned = await plan(quiet, snapshot({ as_of: NOW }), NOW);
  assert.equal(planned.code, 0, planned.stdout);
  assert.equal(planned.json.data.quiet, true);
  assert.deepEqual(await tree(quiet), before);
});

test("sync render keeps a Ready row Ready, needs the row's state to update a 0.17.0 row, and sets Done once nothing waits", async (context) => {
  const root = await publishing(context, "off");
  const week = await runWeek(root, snapshot({ as_of: NOW }), NOW, { mode: "unattended", publish: true });
  const id = week.record!.json.data.id;
  const first = await publish(root, id, NOW);
  assert.deepEqual(first.item.properties["Brain Status"], { type: "select", value: "New" });
  // The user set Ready; the brain's next publish (a rerun with a new item) must not set it back.
  await writeFile(join(root, `knowledge/people/per-5j8r3x6m.md`), "---\nid: per-5j8r3x6m\ntype: person\ntitle: Mira Lund\nsummary: Synthetic.\nlifecycle: reviewed\naliases: [Mira, Mira]\ncreated: 2026-01-01\nupdated: 2026-01-01\n---\n");
  settle(root, "new input");
  const later = "2026-11-09T10:00:00Z";
  await runWeek(root, snapshot({ as_of: later }), later, { mode: "unattended", publish: true });
  settle(root, "rerun");
  const blind = (await run(root, ["sync", "render", "--ids", id], later)).json.data;
  assert.deepEqual([blind.items, blind.skipped], [[], [{ id, reason: "ROW_STATE_REQUIRED" }]]);
  const withState = (await run(root, ["sync", "render", "--ids", id, "--row-state", await input(root, { page: PAGE, items: [] })], later)).json.data;
  assert.equal(withState.items[0].properties["Brain Status"], undefined, "Brain Status is left as the user set it");
});

test("the hand-off: weekly plan carries the clean-up's items, settings.cleanup.auto, and the source the skill writes them with", async (context) => {
  const root = await fixture(context);
  const planned = await plan(root, snapshot({ as_of: NOW }), NOW);
  assert.equal(planned.code, 0, planned.stdout);
  const data = planned.json.data;
  assert.deepEqual([data.cleanup.map((item: any) => item.tidy), data.cleanup_auto, data.source], [KINDS, true, "agent:brain-weekly-review/20261109T080000Z"]);
  assert.equal(data.quiet, false);
  assert.equal((await readFile(join(root, "brain.json"), "utf8")).includes("cleanup"), false, "absent means on");
});
