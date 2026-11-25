// skills-pages-check.mjs (CC-392): a Skills database's pages against notion/brain-assistant.md's "Skills". Synthetic
// pages; the last tests run it as a release does, on pages made from the product's own files.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { comparePages, parseSkills } from "../scripts/skills-pages-check.mjs";

const ROOT = join(import.meta.dirname, "..");
const SCRIPT = join(ROOT, "scripts", "skills-pages-check.mjs");

const MINUTES = "# Minutes\n\n```text\nWrite the minutes.\n\n- [ ] Send the slides [q1]\n```\n";
const ASSISTANT = `# Assistant

## Instructions

\`\`\`text
### Not a skill
\`\`\`

## Skills

### Today
**Description:** What's due today.

\`\`\`text
Goal: show today.
Source: the databases inside [@Brain Data] only.

1. Tasks.
   Show name and due.
\`\`\`

### Voice summary
**Description:** Summarize a voice note.

\`\`\`text
Goal: write the summary. See [@How it works].

## [s1] Voice note
### Highlights
\`\`\`

### Write minutes
**Description:** The minutes prompt.

**Text:** the text block of [minutes-format.md](minutes-format.md).

## Other

### Not a skill either
`;
const SKILLS = parseSkills(ASSISTANT, (file) => {
  assert.equal(file, "minutes-format.md");
  return MINUTES;
});
const TODAY = "Goal: show today.\nSource: the databases inside Brain Data only.\n\n1. Tasks.\n   Show name and due.";
const VOICE = "Goal: write the summary. See How it works.\n\n## [s1] Voice note\n### Highlights";
const PROMPT = "Write the minutes.\n\n- [ ] Send the slides [q1]";

const inDescription = () => [
  { name: "Today", description: TODAY, body: "" },
  { name: "Voice summary", description: VOICE, body: "" },
  { name: "Write minutes", description: "The minutes prompt.", body: PROMPT },
];
const inBody = () => [
  { name: "Today", description: "What's due today.", body: TODAY },
  { name: "Voice summary", description: "Summarize a voice note.", body: VOICE },
  { name: "Write minutes", description: "The minutes prompt.", body: PROMPT },
];
const statuses = (pages) => comparePages(SKILLS, pages).map(({ name, status }) => `${name}: ${status}`);
const of = (pages, name) => comparePages(SKILLS, pages).find((result) => result.name === name);

test("a heading inside a code fence, or outside Skills, is no skill", () => {
  assert.deepEqual(SKILLS.map((skill) => skill.name), ["Today", "Voice summary", "Write minutes"]);
  assert.match(SKILLS[1].text, /## \[s1\] Voice note\n### Highlights$/);
  assert.throws(() => parseSkills("# Assistant\n", () => ""), /no skill found/);
});

test("both layouts are the same, and each is named", () => {
  for (const [pages, layout] of [[inDescription(), "the text in Description"], [inBody(), "the text in the body"]]) {
    assert.deepEqual(statuses(pages), ["Today: same", "Voice summary: same", "Write minutes: same"]);
    assert.equal(of(pages, "Today").layout, layout);
    assert.equal(of(pages, "Write minutes").layout, "its own places, the text in the body");
  }
});

test("white space, a fence around a body and the mention's form don't count", () => {
  const pages = inBody();
  pages[0].body = "```text\r\nGoal: show  today.\r\n\r\n\r\nSource: the databases inside [@Brain Data] only.\r\n1. Tasks.\r\nShow name and due.  \r\n```\n";
  pages[1].body = VOICE.replace("How it works", "@How it works");
  assert.deepEqual(statuses(pages), ["Today: same", "Voice summary: same", "Write minutes: same"]);
  const other = inDescription();
  other[0].description = TODAY.replace("Brain Data", "Untitled");
  assert.equal(of(other, "Today").status, "differs", "a mention of another page differs");
});

test("a changed sentence differs, at its first line, in either layout", () => {
  const pages = inDescription();
  pages[0].description = TODAY.replace("1. Tasks.", "1. Tasks and meetings.");
  assert.deepEqual(of(pages, "Today"), {
    name: "Today", status: "differs", layout: "the text in Description", where: "Description", line: 4, product: "1. Tasks.", page: "1. Tasks and meetings.",
  });
  const body = inBody();
  body[1].body = VOICE.replace("\n### Highlights", "");
  assert.deepEqual(of(body, "Voice summary"), {
    name: "Voice summary", status: "differs", layout: "the text in the body", where: "the body", line: 4, product: "### Highlights", page: undefined,
  });
  body[0].description = "What's due.";
  assert.equal(of(body, "Today").where, "Description");
});

test("a page that keeps text in both places differs", () => {
  const pages = inDescription();
  pages[0].body = "Goal: an old text.";
  assert.deepEqual(of(pages, "Today"), {
    name: "Today", status: "differs", layout: "the text in Description", where: "the body", product: undefined, page: "Goal: an old text.",
  });
  pages[0].description = "Goal: an old text.";
  pages[0].body = TODAY;
  assert.equal(of(pages, "Today").where, "Description", "old text in Description is the skill the agent runs");
});

test("a missing page, a retired one and a second one of a name", () => {
  const pages = inDescription();
  pages.splice(1, 1);
  pages.push({ name: "Review queue", description: "Goal: review.", body: "" }, { name: "Today ", description: TODAY, body: "" }, { name: "", description: "", body: "" });
  assert.deepEqual(statuses(pages), [
    "Today: same", "Voice summary: missing", "Write minutes: same", "Review queue: extra", "Today: extra", "(no name): extra",
  ]);
  assert.equal(of(pages, "Review queue").why, "no skill of notion/brain-assistant.md");
  assert.equal(comparePages(SKILLS, pages).filter((result) => result.name === "Today")[1].why, "a second page of this name");
});

test("Write minutes is compared in its own places", () => {
  const pages = inDescription();
  pages[2].body = "";
  assert.equal(of(pages, "Write minutes").where, "the body", "an empty body is no prompt");
  pages[2] = { name: "Write minutes", description: PROMPT, body: "" };
  assert.equal(of(pages, "Write minutes").where, "Description", "the prompt in Description isn't its place");
  pages[2] = { name: "Write minutes", description: "The minutes prompt.", body: PROMPT.replace("slides", "deck") };
  assert.deepEqual([of(pages, "Write minutes").where, of(pages, "Write minutes").line], ["the body", 3]);
});

/** The script on a file, as a release runs it. */
function check(t, content) {
  const folder = mkdtempSync(join(tmpdir(), "ub-skills-pages-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const path = join(folder, "pages.json");
  if (content !== undefined) writeFileSync(path, content);
  return spawnSync(process.execPath, [SCRIPT, path], { encoding: "utf8" });
}

/** Pages of the product's own eleven skills, in the template's layout, with the mention as plain_text shows it. */
function productPages() {
  const read = (file) => readFileSync(join(ROOT, "notion", file), "utf8");
  return parseSkills(read("brain-assistant.md"), read).map(({ name, line, text, inBody: body }) => ({
    name, description: body ? line : text.replaceAll("[@Brain Data]", "Brain Data"), body: body ? text : "",
  }));
}

test("run on the product's eleven skills: all the same, exit 0; one changed and one retired, exit 1", (t) => {
  const pages = productPages();
  assert.equal(pages.length, 11);
  assert.deepEqual(pages.filter((page) => page.body !== "").map((page) => page.name), ["Write minutes"]);
  const good = check(t, `﻿${JSON.stringify(pages)}`);
  assert.equal(good.status, 0, good.stderr);
  assert.match(good.stdout, /same {5}Voice summary \(the text in Description\)\n/);
  assert.match(good.stdout, /\n11 same · 0 differs · 0 missing · 0 extra\n$/);

  pages[0].description = pages[0].description.replace("Overdue first", "Overdue last");
  pages.push({ name: "Grill review", description: "Goal: grill.", body: "" });
  const bad = check(t, JSON.stringify(pages));
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /differs {2}Today \(the text in Description\): Description, line 4 of the product's text\n {11}product: .*Overdue first.*\n {11}page: {4}.*Overdue last/);
  assert.match(bad.stdout, /extra {4}Grill review: no skill of notion\/brain-assistant\.md\n10 same · 1 differs · 0 missing · 1 extra\n$/);
});

test("a file it can't read is refused with the usage line", (t) => {
  for (const content of [undefined, "not json", "{}", '[{"name":"Today","description":"Goal"}]', "[null]"]) {
    const result = check(t, content);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /^can't read .*pages\.json: [^\n]+\n\nUsage: node scripts\/skills-pages-check\.mjs <pages\.json>/);
  }
  const none = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(none.status, 1);
  assert.match(none.stderr, /\nUsage: /);
});

test("it opens no socket: it imports node:fs and node:path only", () => {
  const code = readFileSync(SCRIPT, "utf8");
  assert.deepEqual([...code.matchAll(/^import .* from "([^"]+)";$/gm)].map((match) => match[1]), ["node:fs", "node:path"]);
  assert.doesNotMatch(code, /\bimport\s*\(|\brequire\b|\bfetch\b|WebSocket|getBuiltinModule|\bprocess\.env\b/);
});
