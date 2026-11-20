import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { checkMinutes, neededFor } from "../src/lib/minutes-check.ts";
import { captionParagraphs, localDate, nameAndDate } from "../src/lib/minutes-row.ts";
import { brain, fixtureCopy } from "./helpers.ts";

// CC-327 (decision 0101 §8.1, §8.3): `brain minutes check` and `brain minutes row` (spec/cli.md §5.36, §5.37; capture-and-review §3.4.2,
// §3.4.3). Synthetic minutes, transcripts and files only.

const FIXTURES = join(import.meta.dirname, "fixtures", "minutes-0079");
const fixture = (name: string): string => readFileSync(join(FIXTURES, name), "utf8");
const LEAN = fixture("lean-summary.md");
const DIVIDED = fixture("divided-summary.md");
const TRANSCRIPT = fixture("transcript.md");
const PAGE = "0a0b0c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
const OTHER_PAGE = "0a0b0c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0e";
const NOW = "2027-03-10T09:00:00Z";

const swap = (text: string, from: string, to: string): string => {
  assert.ok(text.includes(from), `the fixture holds ${from}`);
  return text.replace(from, to);
};

async function scratch(context: TestContext): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "minutes-"));
  context.after(() => rm(folder, { recursive: true, force: true }));
  return folder;
}

async function check(context: TestContext, minutes: string, options: { transcript?: string; again?: boolean; dir?: string; log?: string[] } = {}) {
  const dir = options.dir ?? await fixtureCopy(context);
  const folder = await scratch(context);
  await writeFile(join(folder, "minutes.md"), minutes);
  await writeFile(join(folder, "transcript.md"), options.transcript ?? TRANSCRIPT);
  for (const pairs of options.log ?? []) {
    const logged = await brain(["log", "minutes-written", "-", ...pairs.split(" "), "--brain", dir, "--now", NOW, "--json"]);
    assert.equal(logged.code, 0, logged.stdout);
  }
  const args = ["minutes", "check", "--page", PAGE, "--minutes", join(folder, "minutes.md"), "--transcript", join(folder, "transcript.md"), "--brain", dir, "--now", NOW];
  if (options.again === true) args.push("--again");
  const json = await brain([...args, "--json"]);
  const human = await brain(args);
  return { code: json.code, data: json.json.data, error: json.json.error, human: human.stdout };
}

// --- brain minutes check (cli §5.36) ---

test("minutes whose quotes all occur once pass: ok, every item counted, exit 0", async (context) => {
  const { code, data, human } = await check(context, LEAN);
  assert.equal(code, 0);
  assert.deepEqual(data, { ok: true, shape: "lean", items: 11, passing: 11, needed: 10, failures: [], follow_ups: 3, problems: [] });
  assert.equal(human, "Minutes check: 11 of 11 items pass (10 needed) · 3 follow-ups\nok\n");
  // The divided layout (0106 §13) reads the same.
  assert.deepEqual(checkMinutes(DIVIDED, TRANSCRIPT, false), data);
});

test("a paraphrased quote fails its item and is named; above the bar the minutes still pass", async (context) => {
  const paraphrased = swap(LEAN, "“We agreed to move the spring planting day”", "“We decided to move the spring planting day”");
  const { code, data, human } = await check(context, paraphrased);
  assert.equal(code, 0, "10 of 11 meets the bar");
  assert.equal(data.ok, true);
  assert.deepEqual([data.items, data.passing, data.needed], [11, 10, 10]);
  assert.deepEqual(data.failures, [{ id: "s1.i2", reason: "not-found", quote: "We decided to move the spring planting day" }]);
  assert.equal(human.split("\n")[2], "[s1.i2] not-found: “We decided to move the spring planting day”");
  // A stretch doesn't pass: extract-plan would place this quote by rule 2, the check doesn't.
  const joined = swap(LEAN, "“We agreed to move the spring planting day”", "“We agreed to move the spring planting day to the second Saturday of April, as Ben said he will confirm”");
  assert.deepEqual(checkMinutes(joined, TRANSCRIPT, false).failures.map((failure) => [failure.id, failure.reason]), [["s1.i2", "not-found"]]);
});

test("minutes under the bar are refused: ok false, exit 1, each failure named", async (context) => {
  let under = swap(LEAN, "“We agreed to move the spring planting day”", "“We chose to move the planting day”");
  under = swap(under, "“the water tap near the north beds still leaks”", "“planting day”");
  const { code, data, human } = await check(context, under);
  assert.equal(code, 1);
  assert.equal(data.ok, false);
  assert.deepEqual([data.items, data.passing, data.needed], [11, 9, 10]);
  assert.deepEqual(data.failures, [
    { id: "s1.i2", reason: "not-found", quote: "We chose to move the planting day" },
    { id: "s3.i1", reason: "not-unique", quote: "planting day" },
  ]);
  assert.deepEqual(data.problems, [], "the bar is not a problem code");
  assert.deepEqual(human.split("\n").slice(0, 2), ["Minutes check: 9 of 11 items pass (10 needed) · 3 follow-ups", "not ok"]);
});

test("an item with no quote entry, or an entry with no quote, fails; an orphan entry is a failure and not an item", () => {
  const noEntry = swap(LEAN, "[s1.i5] → “whether the school group can join on the planting day” (depends on [s1.i1])\n", "");
  let data = checkMinutes(noEntry, TRANSCRIPT, false);
  assert.deepEqual(data.failures, [{ id: "s1.i5", reason: "no-quote-entry" }]);
  assert.deepEqual([data.items, data.passing, data.ok], [11, 10, true]);
  const empty = swap(LEAN, "[s1.i5] → “whether the school group can join on the planting day” (depends on [s1.i1])", "[s1.i5] →");
  assert.deepEqual(checkMinutes(empty, TRANSCRIPT, false).failures, [{ id: "s1.i5", reason: "no-quote-entry" }]);
  const orphan = swap(LEAN, "[s4.i2] → Use in brain:", "[s4.i9] → “the long drive to get there”\n[s4.i2] → Use in brain:");
  data = checkMinutes(orphan, TRANSCRIPT, false);
  assert.deepEqual(data.failures, [{ id: "s4.i9", reason: "orphan" }]);
  assert.deepEqual([data.items, data.passing, data.ok], [11, 11, true]);
});

test("every to-do of Quick follow-ups needs its own q id", () => {
  let data = checkMinutes(swap(LEAN, "- [ ] Ask Carla for the shed key `[q3]`", "- [ ] Ask Carla for the shed key"), TRANSCRIPT, false);
  assert.equal(data.ok, false);
  assert.deepEqual(data.problems, [{ code: "FOLLOW_UP_WITHOUT_ID", text: "Ask Carla for the shed key", reason: "a to-do of Quick follow-ups with no q id" }]);
  assert.equal(data.follow_ups, 2);
  data = checkMinutes(swap(LEAN, "`[q3]`", "[q1]"), TRANSCRIPT, false);
  assert.equal(data.ok, false);
  assert.deepEqual(data.problems.map((problem) => [problem.code, problem.id]), [["DUPLICATE_FOLLOW_UP", "q1"]]);
  // A plain bullet in the group is not a to-do: no q id needed.
  data = checkMinutes(swap(LEAN, "- [ ] Ask Carla for the shed key `[q3]`", "- Ask Carla for the shed key"), TRANSCRIPT, false);
  assert.deepEqual([data.ok, data.problems, data.follow_ups], [true, [], 2]);
});

test("minutes not in the lean shape are NOT_LEAN and nothing is counted", async (context) => {
  const { code, data } = await check(context, fixture("inline-summary.md"));
  assert.equal(code, 1);
  assert.deepEqual(data, { ok: false, shape: "inline-quote", items: 0, passing: 0, needed: 0, failures: [], follow_ups: 0, problems: [{ code: "NOT_LEAN", reason: "the minutes are in the inline-quote shape, not the lean shape with a For the brain toggle" }] });
  assert.equal(checkMinutes(fixture("legacy-summary.md"), TRANSCRIPT, false).shape, "legacy");
});

test("extract-plan's blockers are problems here, and minutes with no item are NO_ITEMS", () => {
  const data = checkMinutes(swap(LEAN, "- Open: whether the school group can join [s1.i5]", "- Open: whether the school group can join [s1.i5]\n- The shed needs a new lock"), TRANSCRIPT, false);
  assert.equal(data.ok, false);
  assert.deepEqual(data.problems.map((problem) => problem.code), ["UNNUMBERED_LINE"]);
  assert.equal(data.passing, 11, "items are still counted");
  const none = "## Quick follow-ups\n- [ ] Send the notes [q1]\n\n<details>\n<summary>For the brain</summary>\nAll subjects included unless marked Meeting only. Set Ready to confirm.\n</details>\n";
  const empty = checkMinutes(none, TRANSCRIPT, false);
  assert.deepEqual([empty.ok, empty.items, empty.needed, empty.problems.map((problem) => problem.code)], [false, 0, 0, ["NO_ITEMS"]]);
  assert.deepEqual([1, 9, 10, 11, 19, 20].map(neededFor), [1, 9, 9, 10, 18, 18]);
});

test("minutes read through Notion's markdown export, escapes and all, are checked like the same minutes without them", () => {
  const data = checkMinutes(fixture("notion-export-summary.md"), fixture("notion-export-transcript.md"), false);
  assert.equal(data.shape, "lean");
  assert.ok(data.items > 0 && data.passing === data.items, JSON.stringify(data.failures));
});

test("a page the brain wrote minutes on before is ALREADY_WRITTEN unless --again; another page is not", async (context) => {
  const dir = await fixtureCopy(context);
  // The page id as the MCP may give it, without dashes and in upper case.
  let result = await check(context, LEAN, { dir, log: [`page=${PAGE.replace(/-/g, "").toUpperCase()} items=11 passing=11 mode=attended`] });
  assert.equal(result.code, 1);
  assert.deepEqual(result.data, { ok: false, shape: null, items: 0, passing: 0, needed: 0, failures: [], follow_ups: 0, problems: [{ code: "ALREADY_WRITTEN", reason: "the brain wrote minutes on this page before: only the user's ask writes them again (--again)" }] });
  const logged = await readFile(join(dir, "log", "2027-03.md"), "utf8");
  result = await check(context, LEAN, { dir, again: true });
  assert.equal(result.code, 0);
  assert.equal(result.data.ok, true);
  const other = await check(context, LEAN, { dir: await fixtureCopy(context), log: [`page=${OTHER_PAGE} items=11 passing=11 mode=unattended`] });
  assert.equal(other.data.ok, true);
  assert.equal(await readFile(join(dir, "log", "2027-03.md"), "utf8"), logged, "the check never writes the minutes-written line itself");
});

test("an unreadable or empty file is INPUT_INVALID; a missing option is a usage error", async (context) => {
  const dir = await fixtureCopy(context);
  const folder = await scratch(context);
  await writeFile(join(folder, "minutes.md"), LEAN);
  await writeFile(join(folder, "empty.md"), "\n \n");
  const run = (args: string[]) => brain(["minutes", "check", ...args, "--brain", dir, "--json"]);
  let result = await run(["--page", PAGE, "--minutes", join(folder, "minutes.md"), "--transcript", join(folder, "empty.md")]);
  assert.deepEqual([result.code, result.json.error.code], [4, "INPUT_INVALID"]);
  result = await run(["--page", PAGE, "--minutes", join(folder, "missing.md"), "--transcript", join(folder, "minutes.md")]);
  assert.deepEqual([result.code, result.json.error.code], [4, "INPUT_INVALID"]);
  result = await run(["--minutes", join(folder, "minutes.md"), "--transcript", join(folder, "minutes.md")]);
  assert.deepEqual([result.code, result.json.error.code], [2, "USAGE"]);
});

// --- brain minutes row (cli §5.37) ---

const VTT = `WEBVTT
Kind: captions
Language: en

NOTE This file was exported by a notetaker.

STYLE
::cue { color: white }

intro-1
00:00:01.000 --> 00:00:03.500 align:start
<v Ana>Thanks for joining, everyone.

00:00:03.500 --> 00:00:06.000
<v Ana>We have <b>two</b> things to cover &amp; little time.

00:00:06.000 --> 00:00:09.000
<v.loud Ben>I'll confirm the soil date
by Wednesday.

00:00:09.000 --> 00:00:10.000
<00:00:09.200>with the supplier.

00:00:10.000 --> 00:00:12.000
<v Ana>Good, then the planting day moves.</v>
`;

async function row(context: TestContext, name: string, content: string | Buffer, options: { dir?: string; text?: string; mtime?: Date } = {}) {
  const dir = options.dir ?? await fixtureCopy(context);
  const folder = await scratch(context);
  const file = join(folder, name);
  await writeFile(file, content);
  if (options.mtime !== undefined) await utimes(file, options.mtime, options.mtime);
  const args = ["minutes", "row", "--file", file, "--brain", dir, "--now", NOW, "--json"];
  if (options.text !== undefined) { await writeFile(join(folder, "text.txt"), options.text); args.push("--text", join(folder, "text.txt")); }
  const result = await brain(args);
  return { code: result.code, data: result.json.data, error: result.json.error, dir };
}

test("a .vtt with voice tags renders one Meetings row, one paragraph per speaker turn", async (context) => {
  const { code, data, dir } = await row(context, "2027-03-10_garden-call.vtt", VTT);
  assert.equal(code, 0);
  assert.equal(data.database, "meetings");
  assert.equal(data.action, "create");
  assert.match(data.hash, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(data.properties, { Name: "garden call", Date: "2027-03-10", "Brain Status": "New" });
  assert.equal(data.body, [
    "<details><summary>Transcript</summary>",
    "",
    "Ana: Thanks for joining, everyone. We have two things to cover & little time.",
    "",
    "Ben: I'll confirm the soil date by Wednesday. with the supplier.",
    "",
    "Ana: Good, then the planting day moves.",
    "",
    "</details>",
  ].join("\n"));
  assert.equal(await readFile(join(dir, "log", "2026-12.md"), "utf8"), await readFile(join(import.meta.dirname, "fixtures", "brain-acme", "log", "2026-12.md"), "utf8"), "nothing is logged");
});

test("an .srt reads `Name:` as the speaker; a cue with no speaker continues the paragraph before it", () => {
  const srt = "1\r\n00:00:01,000 --> 00:00:02,000\r\nCarla: The tap still leaks.\r\n\r\n2\r\n00:00:02,000 --> 00:00:03,000\r\nAfter the repair, too.\r\n\r\n3\r\n00:00:03,000 --> 00:00:04,000\r\nSpeaker 2: I will email the council.\r\n";
  assert.deepEqual(captionParagraphs(srt.replace(/\r\n/g, "\n")), ["Carla: The tap still leaks. After the repair, too.", "Speaker 2: I will email the council."]);
  assert.deepEqual(captionParagraphs("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nno speaker yet\n\n00:00:02.000 --> 00:00:03.000\nstill none\n"), ["no speaker yet still none"]);
});

test("Name and Date come from the file name, else the file's modified date; an empty Name is Meeting <Date>", async (context) => {
  const modified = new Date(2027, 2, 14, 15, 30);
  assert.deepEqual(nameAndDate("2027-03-10 - Weekly sync.md", modified), { name: "Weekly sync", date: "2027-03-10" });
  assert.deepEqual(nameAndDate("2027-03-10.txt", modified), { name: "Meeting 2027-03-10", date: "2027-03-10" });
  assert.deepEqual(nameAndDate("2027-02-30 board.txt", modified), { name: "2027 02 30 board", date: "2027-03-14" }, "a date that doesn't exist is part of the name");
  assert.deepEqual(nameAndDate("q3_planning-call.final.txt", modified), { name: "q3 planning call.final", date: "2027-03-14" });
  assert.equal(nameAndDate(`${"x".repeat(130)}.txt`, modified).name.length, 120);
  const { code, data } = await row(context, "garden_call.txt", "\n\nFirst paragraph.\nSame paragraph.\n\nSecond paragraph.\n", { mtime: modified });
  assert.equal(code, 0);
  assert.deepEqual(data.properties, { Name: "garden call", Date: localDate(modified), "Brain Status": "New" });
  assert.equal(data.body, "<details><summary>Transcript</summary>\n\nFirst paragraph.\nSame paragraph.\n\nSecond paragraph.\n\n</details>");
});

test("another file type needs its text given with --text; an empty or unreadable file is INPUT_INVALID", async (context) => {
  const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0x00]);
  let result = await row(context, "2027-03-10 call.docx", bytes);
  assert.deepEqual([result.code, result.error.code], [4, "INPUT_INVALID"]);
  result = await row(context, "2027-03-10 call.docx", bytes, { text: "Ana: The text the skill converted." });
  assert.equal(result.code, 0);
  assert.equal(result.data.properties.Name, "call");
  assert.match(result.data.body, /Ana: The text the skill converted\./);
  result = await row(context, "empty.vtt", "WEBVTT\n\nNOTE nothing here\n");
  assert.deepEqual([result.code, result.error.code], [4, "INPUT_INVALID"]);
  result = await row(context, "latin1.txt", Buffer.from([0x63, 0x61, 0x66, 0xe9]));
  assert.deepEqual([result.code, result.error.code], [4, "INPUT_INVALID"]);
});

test("a file already made a row is refused with FILE_ALREADY_A_ROW, naming its page", async (context) => {
  const first = await row(context, "2027-03-10_garden-call.vtt", VTT);
  const rowPage = "0a0b0c0d-1e2f-4a3b-8c4d-5e6f7a8b9c11";
  const logged = await brain(["log", "meeting-file", "-", `page=${rowPage}`, `hash=${first.data.hash}`, "--brain", first.dir, "--now", NOW, "--json"]);
  assert.equal(logged.code, 0, logged.stdout);
  // The same bytes under another name are the same file.
  const again = await row(context, "renamed.vtt", VTT, { dir: first.dir });
  assert.equal(again.code, 4);
  assert.equal(again.error.code, "FILE_ALREADY_A_ROW");
  assert.deepEqual(again.error.details, { page: rowPage });
  const changed = await row(context, "2027-03-10_garden-call.vtt", `${VTT}\n00:00:12.000 --> 00:00:13.000\n<v Ben>One more thing.\n`, { dir: first.dir });
  assert.equal(changed.code, 0, "a changed file is another file");
});
