import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { DATABASES } from "../src/lib/sync.ts";

// Every database `sync plan` accepts must be read by the brain-sync skill and named in its formats and in the spec: a database the
// skill leaves out is never pulled, and its edits are lost to the brain (U-18; #216, where Domains was missed).
const NAMES: Record<string, string> = {
  domains: "Domains", areas: "Areas", goals: "Goals", key_results: "Key Results", projects: "Projects", people: "People", orgs: "Orgs",
  decisions: "Decisions", questions: "Questions", documents: "Documents", review: "Review", inbox: "Inbox",
};

test("brain-sync step 2 reads every database sync plan accepts (CC-131)", async () => {
  const skill = await readFile("skills/brain-sync/SKILL.md", "utf8");
  const step2 = skill.slice(skill.indexOf("2. **Read**"), skill.indexOf("Meetings are not read here"));
  const table = step2.split("\n").filter((line) => /^\s*\| /.test(line) && !line.includes("Read when") && !/^\s*\|---/.test(line)).map((line) => line.split("|")[1]!);
  for (const database of DATABASES) {
    if (database === "inbox") { assert.match(skill, /Of the Inbox, read only:/); continue; }
    assert.ok(table.some((cell) => new RegExp(`\\b${NAMES[database]}\\b`).test(cell)), `step 2's table has no row for ${NAMES[database]}`);
  }
});

test("brain-sync formats.md and spec/cli.md §5.14.1 list every snapshot database key (CC-131)", async () => {
  const formats = (await readFile("skills/brain-sync/references/formats.md", "utf8")).split("\n").find((line) => line.startsWith("- `database`:"))!;
  const spec = (await readFile("spec/cli.md", "utf8")).split("\n").find((line) => line.startsWith("- `database`: a key of `brain.json` `notion.databases`"))!;
  for (const database of DATABASES) {
    assert.ok(formats.includes(`\`${database}\``), `formats.md doesn't list ${database}`);
    assert.ok(spec.includes(`\`${database}\``), `spec/cli.md §5.14.1 doesn't list ${database}`);
  }
});
