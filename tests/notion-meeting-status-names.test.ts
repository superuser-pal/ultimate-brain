// CC-361: Meetings' Brain Status uses the Inbox's names, New → Ready → Done, with Skipped kept (decision 0109). Text checks only.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, sep } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFile(join(root, path), "utf8");
const MIGRATION_FILE = "0029-new-task-on-home-clean-email-and-the-minutes-layout.md";
const OLD_NAME = /Not Reviewed|Reviewed|Ingested(?! At| this week)/;

function section(text: string, start: string, end: string): string {
  const from = text.indexOf(start);
  assert.ok(from >= 0, start);
  const to = text.indexOf(end, from + start.length);
  return text.slice(from, to < 0 ? undefined : to);
}

test("the database prompt, the formula and the views read New, Ready and Done", async () => {
  const databases = await read("notion/prompts/02-databases.md");
  assert.match(databases, /"Meetings": [^\n]*Brain Status \(select: New, Ready, Done, Skipped; default New\)/);
  assert.match(databases, /Brain Status in Meetings defaults to New;/);

  const formula = await read("notion/prompts/04-formula-rollup.md");
  assert.ok(formula.includes('prop("Meetings").filter(current.prop("Brain Status") == "New" and'));
  assert.match(formula, /add a formula property "Meetings to review"/, "the formula keeps its name (0109 §7)");

  const home = await read("notion/prompts/07a-home.md");
  assert.match(home, /"Which minutes need review\?" of "Meetings": filter Brain Status is New and Date/);
  assert.match(home, /"Which meetings did it take in\?": filter Brain Status is Done;/);

  const meetings = await read("notion/prompts/07d-meetings.md");
  assert.match(meetings, /Tab "To review": Table, named "Which minutes need review\?": filter Brain Status is New and/);
  assert.match(meetings, /Tab "Ready": [^\n]*filter Brain Status is Ready;/);
  assert.match(meetings, /Tab "Ingested": [^\n]*filter Brain Status is Done and Ingested At/, "the tab keeps its label; its filter reads Done");

  const templates = await read("notion/prompts/06-templates.md");
  assert.match(templates, /tab "Meetings": Meetings where Area is this page, Brain Status is New and Date/);
});

test("the Meetings template says Before setting Ready, Set Ready again and Set Ready to confirm", async () => {
  const templates = await read("notion/prompts/06-templates.md");
  const meeting = section(templates, "- Meetings:\n", "\n- ");
  assert.ok(meeting.includes('a heading 3 "Before setting Ready"'));
  assert.ok(meeting.includes("then set Brain Status to Ready. Fixed them after the brain took them in? Set Ready again: it reads only what changed."));
  assert.ok(meeting.includes('"All subjects included unless marked Meeting only. Set Ready to confirm."'));
  assert.doesNotMatch(meeting, /Reviewed/);
});

test("the minutes prompt says Set Ready to confirm, and the old sentence is still accepted", async () => {
  const format = await read("notion/minutes-format.md");
  const block = format.slice(format.indexOf("```text"), format.indexOf("```", format.indexOf("```text") + 7));
  assert.ok(block.includes("All subjects included unless marked Meeting only. Set Ready to confirm.\n"));
  assert.doesNotMatch(block, /Reviewed/);
  assert.match(format, /Minutes written before 0\.16\.2 end their sentence with "Mark Reviewed to confirm\.": the brain and Check minutes accept it/);
});

test("Brain Assistant: Today counts New, Check minutes stops on Ready or Done and accepts both sentences, Write minutes is for New", async () => {
  const assistant = await read("notion/brain-assistant.md");
  assert.match(assistant, /4\. Meetings: Brain Status New and Date on or before today\. Show the count\./);
  assert.match(assistant, /the brain's ingest creates a meeting's Tasks, once, when I set the meeting Ready\./);
  const check = section(assistant, "### Check minutes\n", "\n### ");
  assert.match(check, /If Brain Status is Ready or Done: change nothing and tell me\./);
  assert.ok(check.includes('"All subjects included unless marked Meeting only. Set Ready to confirm." (minutes written before 0.16.2 say "Mark Reviewed to confirm." instead: accept it'));
  const write = section(assistant, "### Write minutes\n", "\n### ");
  assert.match(write, /while its Brain Status is New/);
});

test("Skipped is explained once in the views guide", async () => {
  const guide = await read("notion/views-guide.md");
  const sentence = "Meetings have one extra state, **Skipped**, for a meeting you keep but don't want in the brain";
  assert.equal(guide.split(sentence).length - 1, 1);
});

test("migration 0029 part D renames the options in place, after part C, and reads them back", async () => {
  const migration = await read(`notion/migrations/${MIGRATION_FILE}`);
  assert.ok(migration.indexOf("## Part C") < migration.indexOf("## Part D") && migration.indexOf("## Part D") < migration.indexOf("## The last steps"));
  const partD = section(migration, "## Part D · Meetings use the Inbox's status names (0109)", "## The last steps");
  assert.match(partD, /\*\*Not Reviewed\*\* → `New`, \*\*Reviewed\*\* → `Ready`, \*\*Ingested\*\* → `Done`\. Don't touch Skipped\./);
  assert.match(partD, /never delete and re-create it/);
  assert.match(partD, /Brain Status reads \*\*New\*\*/);
  assert.match(partD, /\*\*Your own options\.\*\*[^\n]*leave any other option as it is/);
  assert.ok(partD.includes("Before setting Ready"));
  assert.match(partD, /### D6 · Read the names back/);
  assert.match(partD, /\*\*check minutes\*\* on the second test meeting \(Ready\): it changes nothing and says so/);
  const verify = migration.slice(migration.indexOf("## Verify"));
  assert.match(verify, /Part D, Meetings' status names \(decision 0109\):/);

  const readme = await read("notion/migrations/README.md");
  assert.match(readme, /\[0029\][^\n]*Not Reviewed → New, Reviewed → Ready, Ingested → Done[^\n]*CC-361 \(release 0\.16\.2\)/);
});

test("no shipped text outside earlier migrations, history and read-before-0.16.2 notes names an old meeting status", async () => {
  const notionFiles: string[] = [];
  for (const entry of await readdir(join(root, "notion"), { recursive: true })) {
    const path = `notion/${entry.split(sep).join("/")}`; // readdir gives \ on Windows
    if (!path.endsWith(".md")) continue;
    if (/^notion\/migrations\/00(0\d|1\d|2[0-8])-/.test(path)) continue;
    notionFiles.push(path);
  }
  const allowed = [
    /Lifecycle/, // Documents' and People's Lifecycle, a different property (0109 keeps it)
    /arrives Reviewed|and is Reviewed/, // a kept document's Lifecycle
    /0\.16\.2|0109|migration 0029/, // a read-before-0.16.2 note, or the migration itself
    /\*\*History \(retired/, // history
    /\| Ingested \||Tab "Ingested"|Ready, Ingested, Calendar/, // the tab label kept by 0109 §7
  ];
  for (const path of ["README.md", "docs/notion-space-design.md", "docs/setup.md", ...notionFiles]) {
    if (path.endsWith(MIGRATION_FILE) || path === "notion/migrations/README.md") continue;
    const text = await read(path);
    for (const line of text.split("\n").filter((l) => OLD_NAME.test(l))) {
      assert.ok(allowed.some((p) => p.test(line)), `${path}: ${line.slice(0, 160)}`);
    }
  }
});

test("the vendored skills read a meeting's Reviewed as Ready and write Done, never Ingested", async () => {
  const ingest = await read(".agents/skills/brain-ingest/SKILL.md");
  assert.match(ingest, /pages with Brain Status = \*\*Ready\*\* \(or \*\*Reviewed\*\*, its name before 0\.16\.2, decision 0109\)/);
  assert.match(ingest, /set the meeting's Brain Status back to \*\*Done\*\* through the MCP yourself \(never Ingested/);
  const query = await read(".agents/skills/brain-ingest/references/notion.md");
  assert.match(query, /\*\*Brain Status = Ready\*\*[^\n]*still named \*\*Reviewed\*\*: take those too/);
  const selection = await read(".agents/skills/brain-ingest/references/selection.md");
  assert.match(selection, /a meeting's \*\*Reviewed\*\*, its name before 0\.16\.2, counts as Ready/);
  const catchUp = await read(".agents/skills/brain-catch-up/SKILL.md");
  assert.match(catchUp, /a meeting is Ready \(Reviewed, its name before 0\.16\.2, counts as Ready: decision 0109\)/);
  const formats = await read(".agents/skills/brain-sync/references/formats.md");
  assert.match(formats, /A record written before holds `Ingested`: `sync render` reads it as `Done`/);
});
