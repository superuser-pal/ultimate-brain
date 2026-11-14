import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { area, meeting, note, project, snapshot, world, type NoteSpec } from "./assistant-world.ts";
import { brain, disableGitAutoMaintenance } from "./helpers.ts";
import { bodies, configure, homeOf, plan, proposalFiles, readText, runWeek, select, withDatabases, type Correct } from "./weekly-world.ts";

// CC-254: targeted correction checks (spec/weekly-review.md §8, §14 "correction"; schema §11 replace_line). Synthetic brains, invented names.

disableGitAutoMaintenance();

const NOW = "2026-11-09T08:00:00Z"; // Monday, 2026-W46
const LATER = "2026-11-09T11:00:00Z"; // the same week
const NEXT = "2026-11-16T08:00:00Z"; // 2026-W47
const HOME = "area-2m7c4h8n";
const QUARRY = "prj-9x4t1b7e";
const QUARRY_PATH = `projects/${QUARRY}/project.md`;
const KICKOFF = "mtg-8c4n2p7w";
const ROWAN = "per-3h8w2n6c";
const MIRA = "per-5k2m8q4t";
const HOSTING = "que-7h3m9q2c";
const PHASES = "que-4c8v2n6x";
const APP = "prj-4k8m2q7t";
const QUOTE = "src-6h2k9m4q";
const STATE = "_weekly/state.json";

const fm = async (root: string, path: string) => parseFrontmatter(await readText(root, path)).attributes as Record<string, any>;
const state = async (root: string) => JSON.parse(await readText(root, STATE));
const question = (id: string, title: string, extra: Record<string, unknown> = {}) => note({ path: `knowledge/questions/${id}.md`, id, type: "question", title, status: "open", projects: [QUARRY], ...extra });
const quarryLink = (from: "people" | "questions" | "project") => `[Quarry website](${from === "project" ? `../${QUARRY}/project.md` : `../../${QUARRY_PATH}`})`;

/** Quarry website's budget changed from 12k to 18k on 5 Nov (an applied update_fact): restated, cited, recorded and doubted around the brain. */
async function corrected(context: TestContext, extra: NoteSpec[] = []): Promise<string> {
  const root = await world(context, [
    area(HOME, "Home"),
    project(QUARRY, "Quarry website", HOME, {
      updated: "2026-11-05", facts: { budget: "18k" },
      timeline: [
        { field: "budget", value: "12k", from: "2026-09", learned: "2026-09-10", source: KICKOFF, assessment: "superseded", until: "2026-11" },
        { field: "budget", value: "18k", from: "2026-11", learned: "2026-11-05", source: KICKOFF, assessment: "accepted" },
      ],
    }),
    project(APP, "Quarry app", HOME),
    note({ id: ROWAN, type: "person", title: "Rowan Vale" }),
    note({ id: MIRA, type: "person", title: "Mira Stone" }),
    question(HOSTING, "Does the budget cover hosting?"),
    question(PHASES, "Was the first phase priced right?"),
    meeting(KICKOFF, "Quarry kickoff", "2026-09-10", { projects: [QUARRY] }),
    note({ id: "dec-2p9f6h1r", type: "decision", title: "Quarry budget set", created: "2026-09-10", date: "2026-09-10", projects: [QUARRY], sources: [KICKOFF] }),
    note({ path: `sources/text/${QUOTE}.md`, id: QUOTE, type: "source", title: "Vendor quote", captured: "2026-09-01", kind: "text", projects: [QUARRY] }),
    ...extra,
  ]);
  await bodies(root, {
    [`knowledge/people/${ROWAN}.md`]: `Rowan holds the ${quarryLink("people")} budget at 12k.`,
    [`knowledge/questions/${HOSTING}.md`]: "Can the 12k budget cover hosting as well?",
    [`projects/${APP}/project.md`]: `Shares the 12k budget of ${quarryLink("project")}.`,
    // Independent: its own cited support, another thing that costs 12k.
    [`knowledge/people/${MIRA}.md`]: `Mira's consulting for ${quarryLink("people")} costs 12k, per the [vendor quote](../../sources/text/${QUOTE}.md).`,
    // Uncertain: a consequential match the skill can't settle.
    [`knowledge/questions/${PHASES}.md`]: "Was 12k ever the real figure for phase one?",
    // A historical record, a decision and an immutable source are never targets.
    [`knowledge/meetings/${KICKOFF}.md`]: "Budget agreed at 12k.",
    "knowledge/decisions/dec-2p9f6h1r.md": "The Quarry budget is 12k.",
    [`sources/text/${QUOTE}.md`]: "Quote: 12k for consulting.",
  });
  await configure(root, withDatabases);
  return root;
}

const empty = (asOf: string) => snapshot({ as_of: asOf, tasks: [], projects: [], areas: [] });
/** The skill's reading of the targets of §14's correction scenario. */
const correct: Correct = (_claim, target) => (target.note === MIRA ? "independent" : target.note === PHASES ? "uncertain" : "restatement");
const claimOf = (planData: any, key: string) => planData.corrections.find((claim: any) => claim.claim === key);

test("correction: three restatements in one selectable group; the independent, historical and immutable texts untouched; the uncertain match named, not drafted", async (context) => {
  const root = await corrected(context);
  const week = await runWeek(root, empty(NOW), NOW, { correct });
  assert.equal(week.record!.code, 0, week.record!.stdout);
  const claim = claimOf(week.plan.json.data, `${QUARRY}:budget`);
  assert.deepEqual([claim.kind, claim.old, claim.new, claim.date, claim.source, claim.passages], ["fact", ["12k"], "18k", "2026-11-05", KICKOFF, [KICKOFF]]);
  // §8.2: only current notes that reference the claim's note and hold the old value; never the meeting, the decision or the source.
  assert.deepEqual(claim.targets.map((target: any) => target.note).sort(), [APP, ROWAN, MIRA, HOSTING, PHASES].sort());
  const rowan = claim.targets.find((target: any) => target.note === ROWAN);
  assert.equal(rowan.line_after, `Rowan holds the ${quarryLink("people")} budget at 18k.`);
  assert.match(rowan.before_hash, /^sha256:/);

  const selection = week.select!.json.data;
  const [item] = selection.items;
  assert.equal(selection.items.length, 1);
  assert.deepEqual([item.stream, item.kind, item.write, item.new_items, item.targets.length, item.shown_of], ["correction", "Correction", true, 3, 3, { k: 3, size: 4 }]);
  assert.equal(item.subject, "Quarry website budget 12k → 18k");
  assert.deepEqual(selection.counts, { decisions: 1, new_items: 3, targets: 3, queued: 0 });
  assert.deepEqual(selection.corrections, [{ claim: `${QUARRY}:budget`, open: [], clarify: 1 }]);

  // One review_notes for the claim, its three changes each a selectable item with before and after, the uncertain match named only.
  const files = await proposalFiles(root);
  assert.equal(files.length, 1);
  const group = await fm(root, `_proposals/${files[0]}`);
  assert.equal(group.kind, "review_notes");
  assert.equal(group.correction, `${QUARRY}:budget`);
  assert.equal(group.title, "Correction: Quarry website budget: 12k → 18k (4 notes)");
  assert.deepEqual(group.changes.map((change: any) => change.kind), ["replace_line", "replace_line", "replace_line"]);
  assert.deepEqual(group.items.map((entry: any) => [entry.kind, entry.passages]), [["change", [KICKOFF]], ["change", [KICKOFF]], ["change", [KICKOFF]]]);
  for (const change of group.changes) assert.ok(change.line_before.includes("12k") && change.line_after.includes("18k"), JSON.stringify(change));
  assert.deepEqual(group.needs_clarification, [{ note: PHASES, line: "Was 12k ever the real figure for phase one?" }]);
  assert.equal(group.status, "pending");

  const report = await readText(root, "reports/2026-11-09-weekly-review.md");
  assert.match(report, /\n1\. Correction · Quarry website budget 12k → 18k · 4 notes restate 12k \(3 of 4 shown\) → \[Review\]\(\.\.\/_proposals\/.+\.md\)\n/);
  assert.match(report, /\n1 correction match needs clarification: say "weekly review corrections"\.\n/);
  // Nothing applied: every restating note still says 12k.
  assert.match(await readText(root, `knowledge/people/${ROWAN}.md`), /budget at 12k\./);
  // The claim is finished: the cursor moved to the run's date and nothing stays queued.
  assert.deepEqual((await state(root)).corrections, { checked_on: "2026-11-09", done_on_date: [], open: [] });
  const lint = await brain(["lint", "--brain", root, "--json"]);
  assert.deepEqual(lint.json.data.issues.filter((issue: any) => issue.severity === "error" && (issue.path.startsWith("_proposals/") || issue.path.startsWith("_weekly/"))), []);
});

test("a same-week rerun reuses the group; an item rejected since is not proposed again", async (context) => {
  const root = await corrected(context);
  const first = await runWeek(root, empty(NOW), NOW, { correct });
  assert.equal(first.record!.code, 0, first.record!.stdout);
  const [groupFile] = await proposalFiles(root);
  const group = await fm(root, `_proposals/${groupFile}`);
  // Unchanged inputs: the rerun is quiet, whatever the new Review row added (§9.1).
  assert.equal((await plan(root, empty(LATER), LATER)).json.data.quiet, true);

  // The user rejects the Quarry app item in Review; a new question makes the rerun not quiet.
  const rejected = group.items.find((entry: any) => group.changes[entry.ref].target === APP);
  const path = join(root, "_proposals", groupFile!);
  const text = await readFile(path, "utf8");
  await writeFile(path, text.replace(/\nstatus: pending\n/, `\nitem_decisions:\n  - item_id: ${rejected.item_id}\n    decision: reject\n    decided_at: 2026-11-09T10:00:00Z\n    decided_by: notion\n    state: closed\nstatus: pending\n`));
  await writeFile(join(root, "knowledge/questions/que-9d3f7h2k.md"), `---\nid: que-9d3f7h2k\ntype: question\ntitle: Who hosts the site?\nsummary: Synthetic.\nlifecycle: reviewed\nstatus: open\nprojects: [${QUARRY}]\ncreated: 2026-11-09\nupdated: 2026-11-09\n---\n`);

  const rerun = await runWeek(root, empty(LATER), LATER, { correct });
  assert.equal(rerun.record!.code, 0, rerun.record!.stdout);
  const claim = claimOf(rerun.plan.json.data, `${QUARRY}:budget`);
  assert.ok(claim !== undefined, "the rerun lists the week's claims again (corrections_from)");
  assert.equal(claim.targets.some((target: any) => target.note === APP), false, "a rejected target is never proposed again for the claim");
  assert.deepEqual(claim.targets.filter((target: any) => target.pending !== null).map((target: any) => target.note).sort(), [ROWAN, HOSTING].sort());
  const [item] = rerun.select!.json.data.items;
  assert.deepEqual([item.key, item.write, item.proposal, item.new_items], [`correction:${QUARRY}:budget`, false, group.id, 0]);
  assert.equal((await proposalFiles(root)).length, 1, "no second group");
  assert.deepEqual(rerun.select!.json.data.counts, first.select!.json.data.counts, "the week's counts are kept");
});

test("a group larger than the targets left: its first targets by note id are shown, the rest queued under the claim and proposed the next week", async (context) => {
  const people = ["per-2a4c6e8g", "per-3b5d7f9h", "per-4c6e8g2j", "per-5d7f9h3k", "per-6e8g2j4m", "per-7f9h3k5n"];
  const root = await corrected(context, people.map((id, index) => note({ id, type: "person", title: `Helper ${index + 1}` })));
  await bodies(root, Object.fromEntries(people.map((id, index) => [`knowledge/people/${id}.md`, `Helper ${index + 1} plans within the ${quarryLink("people")} budget of 12k.`])));
  const onlyPeople: Correct = (_claim, target) => (people.includes(target.note) ? "restatement" : "independent");
  const first = await runWeek(root, empty(NOW), NOW, { correct: onlyPeople });
  assert.equal(first.record!.code, 0, first.record!.stdout);
  const [item] = first.select!.json.data.items;
  assert.deepEqual(item.targets, people.slice(0, 5));
  assert.deepEqual(item.shown_of, { k: 5, size: 6 });
  assert.deepEqual(first.select!.json.data.counts, { decisions: 1, new_items: 5, targets: 5, queued: 0 });
  const after = (await state(root)).corrections;
  assert.deepEqual(after.open, [{ claim: `${QUARRY}:budget`, targets: [people[5]], old: ["12k"], new: "18k", date: "2026-11-05", source: KICKOFF }]);
  assert.match(await readText(root, "reports/2026-11-09-weekly-review.md"), /\(5 of 6 shown\)/);

  // Next week: the claim is no longer new, but its queued target is listed alone, and proposed as a new group for the same claim.
  const second = await runWeek(root, empty(NEXT), NEXT, { correct: onlyPeople });
  assert.equal(second.record!.code, 0, second.record!.stdout);
  const claim = claimOf(second.plan.json.data, `${QUARRY}:budget`);
  assert.deepEqual([claim.open, claim.targets.map((target: any) => target.note)], [true, [people[5]]]);
  const [next] = second.select!.json.data.items;
  assert.deepEqual([next.write, next.targets, next.because], [true, [people[5]], "evidence"], "shown again: its targets changed");
  assert.equal((await proposalFiles(root)).length, 2);
  assert.deepEqual((await state(root)).corrections.open, []);
});

test("a correction applied on the cursor's own day is neither missed nor checked twice", async (context) => {
  const root = await corrected(context);
  // The fact changed on the run's own day, before the run.
  const quarry = join(root, QUARRY_PATH);
  await writeFile(quarry, (await readFile(quarry, "utf8")).replaceAll("2026-11-05", "2026-11-09"));
  const first = await runWeek(root, empty(NOW), NOW, { correct });
  assert.equal(first.record!.code, 0, first.record!.stdout);
  assert.deepEqual((await state(root)).corrections, { checked_on: "2026-11-09", done_on_date: [`${QUARRY}:budget`], open: [] });

  // Later that day, another correction: Rowan's role. A note restates the old role.
  const rowan = join(root, `knowledge/people/${ROWAN}.md`);
  await writeFile(rowan, (await readFile(rowan, "utf8")).replace("type: person\n", "type: person\nfacts:\n  role: Lead\ntimeline:\n  - field: role\n    value: Helper\n    from: 2026-01\n    learned: 2026-01-10\n    source: mtg-8c4n2p7w\n    assessment: superseded\n    until: 2026-11\n  - field: role\n    value: Lead\n    from: 2026-11\n    learned: 2026-11-09\n    source: mtg-8c4n2p7w\n    assessment: accepted\n"));
  await bodies(root, { [`projects/${APP}/project.md`]: `[Rowan Vale](../../knowledge/people/${ROWAN}.md) is the Helper on this app.` });
  const next = await plan(root, empty(NEXT), NEXT);
  const keys = next.json.data.corrections.map((claim: any) => claim.claim);
  assert.deepEqual(keys, [`${ROWAN}:role`], "the later correction of that day is found, the one the run finished is not checked again");
});

test("a claim that changed twice since the cursor is one check against the latest value, finding both old values", async (context) => {
  const root = await corrected(context);
  const quarry = join(root, QUARRY_PATH);
  await writeFile(quarry, (await readFile(quarry, "utf8"))
    .replace("budget: 18k", "budget: 20k")
    .replace(/  - field: budget\n    value: 18k\n([\s\S]*?)assessment: accepted\n/, "  - field: budget\n    value: 18k\n$1assessment: superseded\n    until: 2026-11\n  - field: budget\n    value: 20k\n    from: 2026-11\n    learned: 2026-11-07\n    source: mtg-8c4n2p7w\n    assessment: accepted\n"));
  await bodies(root, { [`knowledge/questions/${PHASES}.md`]: "The 18k figure was agreed in the last call." });
  const planned = await plan(root, empty(NOW), NOW);
  const [claim] = planned.json.data.corrections;
  assert.deepEqual([claim.claim, claim.old, claim.new, claim.date], [`${QUARRY}:budget`, ["18k", "12k"], "20k", "2026-11-07"]);
  const lines = Object.fromEntries(claim.targets.map((target: any) => [target.note, target.line_after]));
  assert.equal(lines[ROWAN], `Rowan holds the ${quarryLink("people")} budget at 20k.`);
  assert.equal(lines[PHASES], null, "a line holding two old values has no one-for-one fix");
});

test("omitted correction targets make the run partial and stay queued", async (context) => {
  const root = await corrected(context);
  const week = await runWeek(root, empty(NOW), NOW, { correct: (_claim, target) => (target.note === ROWAN ? "restatement" : null) });
  assert.equal(week.record!.code, 0, week.record!.stdout);
  const selection = week.select!.json.data;
  assert.deepEqual([selection.coverage, selection.omitted.correction_targets], ["partial", 4]);
  assert.deepEqual((await state(root)).corrections.open[0].targets, [APP, MIRA, HOSTING, PHASES].sort());
  assert.match(await readText(root, "reports/2026-11-09-weekly-review.md"), /Partial: 4 checks not done \(budget\); they come first next week\./);
});

test("select refuses a restatement with no one-for-one fix, a target judged twice, and one already in Review", async (context) => {
  const root = await corrected(context);
  await bodies(root, { [`knowledge/questions/${PHASES}.md`]: "Second line: the 12k figure again." });
  const planned = await plan(root, empty(NOW), NOW);
  const hash = planned.json.data.input_hash;
  const claim = `${QUARRY}:budget`;
  const refused = await select(root, { input_hash: hash, judged: { clusters: [], findings: [], corrections: [{ claim, note: PHASES, verdict: "restatement" }, { claim, note: ROWAN, verdict: "restatement" }, { claim, note: ROWAN, verdict: "independent" }] } }, NOW);
  assert.equal(refused.json.error.code, "INPUT_INVALID");
  const messages = refused.json.error.details.map((detail: any) => detail.message).join(" | ");
  assert.match(messages, /no one-for-one fix/);
  assert.match(messages, /judged twice/);
});

test("replace_line: proposal new checks the target and line; apply replaces one line; a stale base or a line changed twice closes it", async (context) => {
  const root = await corrected(context);
  const run = async (args: string[], input: unknown) => {
    const file = join(homeOf(root), `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    return brain([...args, "--brain", root, "--input", file, "--now", NOW, "--json"]);
  };
  const line = `Rowan holds the ${quarryLink("people")} budget at 12k.`;
  const base = { kind: "replace_line", title: "Rowan: 12k → 18k", target: ROWAN, line_before: line, why: "Budget raised.", source: KICKOFF, passages: [KICKOFF] };
  for (const [input, pointer] of [
    [{ ...base, target: KICKOFF, line_before: "Budget agreed at 12k.", line_after: "Budget agreed at 18k." }, "/proposals/0/target"],
    [{ ...base, target: "dec-2p9f6h1r", line_before: "The Quarry budget is 12k.", line_after: "The Quarry budget is 18k." }, "/proposals/0/target"],
    [{ ...base, line_before: "Not a line of the note.", line_after: "x" }, "/proposals/0/line_before"],
    [{ ...base, line_after: "two\nlines" }, "/proposals/0/line_after"],
    [{ ...base, line_after: line }, "/proposals/0/line_after"],
    [{ ...base, line_after: "x", correction: `${QUARRY}:budget` }, "/proposals/0/correction"],
  ] as const) {
    const refused = await run(["proposal", "new"], { proposals: [input] });
    assert.equal(refused.json.error.code, "INPUT_INVALID", JSON.stringify(input));
    assert.ok(refused.json.error.details.some((detail: any) => detail.pointer === pointer), `${pointer}: ${refused.stdout}`);
  }
  const to18 = await run(["proposal", "new"], { proposals: [{ ...base, line_after: line.replace("12k", "18k") }, { ...base, title: "Rowan: 12k → 19k", line_after: line.replace("12k", "19k") }] });
  assert.equal(to18.code, 0, to18.stdout);
  const [a, b] = to18.json.data.created;
  const again = await run(["proposal", "new"], { proposals: [{ ...base, line_after: line.replace("12k", "18k") }] });
  assert.deepEqual(again.json.data.skipped.map((entry: any) => [entry.reason, entry.existing]), [["DUPLICATE_PENDING", a.id]]);
  const decide = (proposal: string, extra: Record<string, unknown> = {}) => run(["apply"], { decisions: [{ proposal, action: "approve", decided_at: NOW, decided_by: "chat", ...extra }] });
  // The first replaces the one line; the second, proposed against the same line, is stale now.
  assert.equal((await decide(a.id)).json.data.decisions[0].result, "applied");
  const body = await readText(root, `knowledge/people/${ROWAN}.md`);
  assert.match(body, /budget at 18k\.\n$/);
  assert.equal((body.match(/12k/g) ?? []).length, 0);
  const second = await decide(b.id);
  assert.deepEqual([second.json.data.decisions[0].result, second.json.data.decisions[0].reason], ["closed", "STALE_PROPOSAL"]);
  assert.equal((await fm(root, b.path)).closed_reason, "stale");

  // A stale base: the note changed elsewhere after the proposal; an edit is one line, the user's.
  const question = `knowledge/questions/${HOSTING}.md`;
  const made = await run(["proposal", "new"], { proposals: [{ ...base, title: "Hosting", target: HOSTING, line_before: "Can the 12k budget cover hosting as well?", line_after: "Can the 18k budget cover hosting as well?" }] });
  const edited = made.json.data.created[0];
  const multi = await decide(edited.id, { action: "edit", value: "one\ntwo" });
  assert.deepEqual([multi.json.data.decisions[0].result, multi.json.data.decisions[0].reason], ["failed", "INVALID_RESULT"]);
  await writeFile(join(root, question), `${await readText(root, question)}Another line.\n`);
  const stale = await decide(edited.id, { action: "edit", value: "Can 18k cover hosting?" });
  assert.deepEqual([stale.json.data.decisions[0].result, stale.json.data.decisions[0].reason], ["closed", "STALE_PROPOSAL"]);
});

test("a correction group in apply: changes folded by claim, a stale one dropped alone, an excluded one deferred with its claim", async (context) => {
  const root = await corrected(context);
  const week = await runWeek(root, empty(NOW), NOW, { correct });
  const [groupFile] = await proposalFiles(root);
  const group = await fm(root, `_proposals/${groupFile}`);
  const index = (target: string) => group.changes.findIndex((change: any) => change.target === target);
  // Rowan's note changes before the decision: its change is stale; the question's is left out and deferred.
  await writeFile(join(root, `knowledge/people/${ROWAN}.md`), `${await readText(root, `knowledge/people/${ROWAN}.md`)}Also on the board.\n`);
  const file = join(homeOf(root), "decide.json");
  await writeFile(file, JSON.stringify({ decisions: [{ proposal: group.id, action: "approve", exclude: [{ change: index(HOSTING) }], decided_at: LATER, decided_by: "chat" }] }));
  const applied = await brain(["apply", "--brain", root, "--input", file, "--now", LATER, "--json"]);
  assert.equal(applied.code, 0, applied.stdout);
  assert.match(await readText(root, `projects/${APP}/project.md`), /Shares the 18k budget/);
  assert.match(await readText(root, `knowledge/people/${ROWAN}.md`), /budget at 12k\./);
  const after = await fm(root, `_proposals/${groupFile}`);
  assert.deepEqual(after.dropped, [{ change: index(ROWAN), reason: "stale" }]);
  const files = await proposalFiles(root);
  const deferred = await fm(root, `_proposals/${files.find((name) => name !== groupFile)}`);
  assert.deepEqual([deferred.deferred_from, deferred.correction, deferred.changes.map((change: any) => change.target)], [group.id, `${QUARRY}:budget`, [HOSTING]]);
  assert.ok(week.record!.code === 0);
});

test("a title changed in Git queues a check: a line still naming the old title is a restatement", async (context) => {
  const root = await corrected(context);
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
  git("init", "-q"); git("config", "user.email", "t@example.com"); git("config", "user.name", "T");
  await bodies(root, { [`projects/${APP}/project.md`]: "Filed under the [Home](../../areas/area-2m7c4h8n.md) Area." });
  const at = (date: string) => ({ env: { ...process.env, GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date } });
  git("add", "-A");
  execFileSync("git", ["-C", root, "commit", "-q", "-m", "brain"], at("2026-10-01T09:00:00Z"));
  const areaPath = join(root, `areas/${HOME}.md`);
  await writeFile(areaPath, (await readFile(areaPath, "utf8")).replace("title: Home", "title: House"));
  git("add", "-A");
  execFileSync("git", ["-C", root, "commit", "-q", "-m", "rename"], at("2026-11-06T09:00:00Z"));
  const planned = await plan(root, empty(NOW), NOW);
  const claim = claimOf(planned.json.data, `${HOME}:title`);
  assert.deepEqual([claim.kind, claim.old, claim.new, claim.date, claim.source], ["title", ["Home"], "House", "2026-11-06", "notion-edit"]);
  const target = claim.targets.find((entry: any) => entry.note === APP);
  assert.equal(target.line_after, "Filed under the [House](../../areas/area-2m7c4h8n.md) Area.");
});

test("weekly corrections list and done: the queue on demand, the cursor moved for what was finished, the rest kept", async (context) => {
  const root = await corrected(context);
  const list = await brain(["weekly", "corrections", "list", "--brain", root, "--now", NOW, "--json"], homeOf(root));
  assert.equal(list.code, 0, list.stdout);
  assert.deepEqual([list.json.data.total, list.json.data.offset, list.json.data.next_offset, list.json.data.claims[0].claim], [1, 0, null, `${QUARRY}:budget`]);
  const file = join(homeOf(root), "done.json");
  await writeFile(file, JSON.stringify({ claims: [{ claim: `${QUARRY}:budget`, open: [PHASES] }] }));
  const done = await brain(["weekly", "corrections", "done", "--brain", root, "--input", file, "--now", NOW, "--json"], homeOf(root));
  assert.equal(done.code, 0, done.stdout);
  assert.deepEqual(done.json.data, { finished: [], open: [`${QUARRY}:budget`], checked_on: "2026-11-09" });
  const saved = await state(root);
  assert.deepEqual(saved.corrections.open.map((entry: any) => [entry.claim, entry.targets]), [[`${QUARRY}:budget`, [PHASES]]]);
  assert.deepEqual([saved.last_success, saved.weeks], [null, {}], "only the cursor is written");
  // The queue now holds only the target left for later; finishing it empties the queue.
  const again = await brain(["weekly", "corrections", "list", "--brain", root, "--now", NOW, "--json"], homeOf(root));
  assert.deepEqual(again.json.data.claims[0].targets.map((target: any) => target.note), [PHASES]);
  await writeFile(file, JSON.stringify({ claims: [{ claim: `${QUARRY}:budget`, open: [] }] }));
  const finished = await brain(["weekly", "corrections", "done", "--brain", root, "--input", file, "--now", NOW, "--json"], homeOf(root));
  assert.deepEqual(finished.json.data.finished, [`${QUARRY}:budget`]);
  assert.equal((await brain(["weekly", "corrections", "list", "--brain", root, "--now", NOW, "--json"], homeOf(root))).json.data.total, 0);
  await writeFile(file, JSON.stringify({ claims: [{ claim: `${ROWAN}:role`, open: [] }] }));
  assert.equal((await brain(["weekly", "corrections", "done", "--brain", root, "--input", file, "--now", NOW, "--json"], homeOf(root))).json.error.code, "INPUT_INVALID");
  const log = await readFile(join(root, "log", "2026-11.md"), "utf8").catch(() => "");
  assert.match(log, /weekly-corrections - "" finished=0 open=1/);
});
