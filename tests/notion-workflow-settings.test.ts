import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFile(join(root, path), "utf8");

/** The Workflow settings of spec/connected-workflows.md §4 (decision 0059), options in order. */
const settings = [
  { name: "Workflow", type: "select", options: ["Standard", "Connected"] },
  { name: "Work type", type: "select", options: ["Software", "General"] },
  { name: "Logging level", type: "select", options: ["Tasks only", "Tasks + final outputs", "Full durable record", "Custom"] },
  { name: "Log artifacts", type: "multi-select", options: ["Briefs", "Plans", "Specifications", "Decisions", "Final deliverables"] },
] as const;

const promptForm = (s: (typeof settings)[number]) => `${s.name} (${s.type}: ${s.options.join(", ")})`;

function section(text: string, start: RegExp, end: RegExp): string {
  const from = text.search(start);
  assert.ok(from >= 0, `missing ${start}`);
  const rest = text.slice(from);
  const body = rest.indexOf("\n") + 1;
  const to = rest.slice(body).search(end);
  return to < 0 ? rest : rest.slice(0, body + to);
}

test("spec §4 lists the settings with these options in this order", async () => {
  const spec = section(await read("spec/connected-workflows.md"), /^## 4\. /m, /^## 5\. /m);
  for (const s of settings) {
    const row = spec.split("\n").find((line) => line.startsWith(`| ${s.name} |`));
    assert.ok(row, `spec §4 has no row for ${s.name}`);
    const labels = [...row.split("|")[3].matchAll(/([^,→]+?) → `/g)].map((m) => m[1].trim());
    assert.deepEqual(labels, [...s.options], `spec §4 options of ${s.name}`);
  }
});

test("design §3.19, §3.1 and §3.4 agree with the settings", async () => {
  const design = await read("docs/notion-space-design.md");
  const own = section(design, /^### 3\.19 /m, /^##+ /m);
  for (const s of settings) {
    assert.ok(own.includes(`| ${s.name} | ${s.type === "select" ? "Select" : "Multi-select"} | ${s.options.join(", ")} |`), `§3.19 row of ${s.name}`);
  }
  for (const heading of [/^### 3\.1 Areas/m, /^### 3\.4 Projects/m]) {
    const table = section(design, heading, /^###? /m);
    for (const s of settings) {
      const row = table.split("\n").find((line) => line.startsWith(`| ${s.name} |`));
      assert.ok(row, `${heading} has no row for ${s.name}`);
      assert.ok(row.includes(`${s.type === "select" ? "Select" : "Multi-select"}: ${s.options.join(", ")}`), `${heading} options of ${s.name}`);
      assert.ok(row.split("|")[3].trim().startsWith("You"), `${heading} owner of ${s.name}`);
    }
  }
});

test("Prompt 2 builds the settings on Areas and Projects", async () => {
  const prompt = await read("notion/prompts/02-databases.md");
  for (const database of ["Areas", "Projects"]) {
    const line = prompt.split("\n").find((l) => l.includes(`"${database}": Name (title)`));
    assert.ok(line, `Prompt 2 has no ${database} line`);
    for (const s of settings) assert.ok(line.includes(promptForm(s)), `Prompt 2 ${database}: ${promptForm(s)}`);
  }
});

test("Prompt 5, the views guide, migration 0015 and brain-connect-notion name the same settings", async () => {
  const ownership = await read("notion/prompts/05-ownership.md");
  assert.ok(ownership.includes(`for ${settings.map((s) => s.name).slice(0, -1).join(", ")} and Log artifacts in "Projects" and "Areas"`));

  const layouts = section(await read("notion/views-guide.md"), /^## 9\. /m, /^## 10\. /m);
  for (const database of ["Areas", "Projects"]) {
    const row = layouts.split("\n").find((l) => l.startsWith(`| ${database} |`));
    assert.ok(row?.includes(settings.map((s) => s.name).join(", ")), `views guide §9 ${database} panel`);
  }

  const migration = await read("notion/migrations/0015-workflow-settings-on-projects-and-areas.md");
  for (const s of settings) {
    assert.ok(migration.includes(`| **${s.name}** (${s.type}): ${s.options.join(", ")} | agent |`), `migration 0015 step 1: ${s.name}`);
  }
  assert.match(migration, /^## Verify$/m);
  assert.match(migration, /^Who does each step:$/m);
  const readme = await read("notion/migrations/README.md");
  assert.ok(readme.includes("[0015](0015-workflow-settings-on-projects-and-areas.md)"));

  const skill = await read(".agents/skills/brain-connect-notion/SKILL.md");
  for (const s of settings) assert.ok(skill.includes(`**${s.name}** (${s.type}: ${s.options.join(", ")})`), `brain-connect-notion: ${s.name}`);
  assert.ok(skill.includes("notion/migrations/0015-workflow-settings-on-projects-and-areas.md"));
});

test("the Projects template line is the same in the design, Prompt 6 and migration 0015", async () => {
  const line = "The brain writes only inside its toggles: Brief and Decision log, and Workflow or Repo tasks when you connect work or link a repo. Add your own notes in My notes.";
  for (const path of ["docs/notion-space-design.md", "notion/prompts/06-templates.md", "notion/migrations/0015-workflow-settings-on-projects-and-areas.md"]) {
    assert.ok((await read(path)).includes(line), path);
  }
});
