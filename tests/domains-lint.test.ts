import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { lintBrain } from "../src/lib/lint.ts";
import { parseNote, type Note } from "../src/lib/notes.ts";
import { fixtureCopy } from "./helpers.ts";

function note(path: string, fields: string): Note {
  const value = parseNote(path, `---\n${fields}\ncreated: 2026-01-01\nupdated: 2026-01-01\n---\n`);
  assert.ok("attributes" in value);
  return value;
}

test("a Document spanning two Domains is informational, and unclassified Areas are valid", async (context) => {
  const root = await fixtureCopy(context);
  const config = JSON.parse(await readFile(join(root, "brain.json"), "utf8"));
  const common = "summary: Synthetic\nlifecycle: reviewed\nsources: [notion:sample]";
  const notes = [
    note("domains/one.md", `id: dom-11111111\ntype: domain\ntitle: One\n${common}`),
    note("domains/two.md", `id: dom-22222222\ntype: domain\ntitle: Two\n${common}`),
    note("areas/one.md", `id: area-11111111\ntype: area\ntitle: One\ndomain: dom-11111111\n${common}`),
    note("areas/two.md", `id: area-22222222\ntype: area\ntitle: Two\ndomain: dom-22222222\n${common}`),
    note("areas/none.md", `id: area-33333333\ntype: area\ntitle: None\n${common}`),
    note("projects/p/project.md", `id: prj-11111111\ntype: project\ntitle: P\narea: area-22222222\n${common}`),
    note("knowledge/references/r.md", `id: ref-11111111\ntype: reference\ntitle: R\narea: area-11111111\nprojects: [prj-11111111]\n${common}`),
  ];
  const issues = lintBrain({ root, notes, problems: [], brainConfig: config, indexMarkdown: undefined });
  assert.equal(issues.find((issue) => issue.rule === "DOCUMENT_DOMAIN_MISMATCH")?.severity, "info");
  assert.equal(issues.some((issue) => issue.path === "areas/none.md" && issue.message.includes("domain")), false);
  notes[0]!.attributes.lifecycle = "archived";
  notes[5]!.attributes.area = "area-33333333";
  const noProjectDomain = lintBrain({ root, notes, problems: [], brainConfig: config, indexMarkdown: undefined });
  assert.equal(noProjectDomain.find((issue) => issue.rule === "DOMAIN_ARCHIVED")?.severity, "info");
  assert.equal(noProjectDomain.find((issue) => issue.rule === "DOCUMENT_DOMAIN_MISMATCH")?.severity, "info");
});
