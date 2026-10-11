import assert from "node:assert/strict";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { loadSchemas } from "../src/lib/schemas.ts";
import { brain, fixtureCopy, FIXTURE_BRAIN } from "./helpers.ts";

test("the fixture brain lints clean: no errors, no warnings", async () => {
  const run = await brain(["lint", "--strict", "--brain", FIXTURE_BRAIN, "--json"]);
  assert.equal(run.code, 0, JSON.stringify(run.json?.data?.issues, null, 2));
  assert.equal(run.json.data.errors, 0);
  assert.equal(run.json.data.warnings, 0);
  assert.equal(run.json.data.files, 21);
});

const SUPABASE = "knowledge/decisions/2026-12-03-use-supabase-for-auth.md";
const FIREBASE = "knowledge/decisions/2026-10-01-use-firebase-for-auth.md";
const SYNC = "knowledge/meetings/2026-12-03-acme-sync.md";
const MARIA = "knowledge/people/maria-lopez.md";
const CARLOS = "knowledge/people/carlos-ruiz.md";
const ACME = "knowledge/orgs/acme.md";

type Mutation = (dir: string) => Promise<void>;
const replace = (file: string, from: string, to: string): Mutation => async (dir) => {
  const path = join(dir, file);
  const text = await readFile(path, "utf8");
  assert.ok(text.includes(from), `${file} contains ${JSON.stringify(from)}`);
  await writeFile(path, text.replace(from, to));
};
const create = (file: string, content: string): Mutation => async (dir) => {
  await mkdir(join(dir, file, ".."), { recursive: true });
  await writeFile(join(dir, file), content);
};

/** One failing case per rule: [rule, severity, file the issue lands in, mutation]. */
const CASES: Array<[string, "error" | "warning", string, Mutation]> = [
  ["not-a-note", "error", "knowledge/concepts/plain.md", create("knowledge/concepts/plain.md", "# no frontmatter\n")],
  ["unparseable", "error", "knowledge/concepts/bad.md", create("knowledge/concepts/bad.md", "---\ntitle: [oops\n---\n")],
  ["schema", "error", CARLOS, replace(CARLOS, "lifecycle: draft\n", "")],
  ["brain-config", "error", "brain.json", replace("brain.json", '"owner": { "name": "Alex Example" },', '"owner": {},')],
  ["id-format", "error", ACME, replace(ACME, "id: org-6d1f9z3k", "id: org-6D1F")],
  ["id-duplicate", "error", "knowledge/concepts/zz-copy.md", async (dir) => {
    await writeFile(join(dir, "knowledge/concepts/zz-copy.md"), await readFile(join(dir, "knowledge/concepts/row-level-security.md"), "utf8"));
  }],
  ["wrong-folder", "error", "knowledge/orgs/carlos-ruiz.md", async (dir) => {
    await writeFile(join(dir, "knowledge/orgs/carlos-ruiz.md"), await readFile(join(dir, CARLOS), "utf8"));
    await rm(join(dir, CARLOS));
  }],
  ["missing-ref", "error", CARLOS, replace(CARLOS, "org: org-6d1f9z3k", "org: org-0000000a")],
  ["broken-link", "error", ACME, replace(ACME, "../people/maria-lopez.md", "../people/nobody.md")],
  ["wikilink", "error", ACME, replace(ACME, "Main contact:", "[[Maria]] Main contact:")],
  ["unknown-marker", "error", ACME, replace(ACME, "Retail client", "Retail client ^[guess]")],
  ["source-hash", "error", "sources/notion/2026-12-03-acme-sync-notion-minutes.md",
    replace("sources/notion/2026-12-03-acme-sync-notion-minutes.md", "February 2027", "March 2027")],
  ["view-cited", "error", CARLOS, replace(CARLOS, "sources: [mtg-5r2k8v3a]", "sources: [mtg-5r2k8v3a, vw-5b2n7q9h]")],
  ["fact-timeline", "error", CARLOS, replace(CARLOS, "  role: Developer\ntimeline", "  role: Lead\ntimeline")],
  ["supersession-pair", "error", FIREBASE, replace(SUPABASE, "  - type: supersedes\n    target: dec-2p9f6h1r\n", "")],
  ["meeting-backref", "error", "knowledge/questions/who-owns-the-acme-mobile-app.md", replace(SYNC, "questions: [que-8n3v5x1d]\n", "")],
  ["superseded-valid-until", "error", FIREBASE, replace(FIREBASE, "valid_until: 2026-12-03\n", "")],
  ["superseded-unlinked", "error", FIREBASE, async (dir) => {
    await replace(FIREBASE, "relations:\n  - type: superseded_by\n    target: dec-7k2m9q4x\n", "")(dir);
    await replace(SUPABASE, "  - type: supersedes\n    target: dec-2p9f6h1r\n", "")(dir);
  }],
  ["decision-sources", "error", SUPABASE, replace(SUPABASE, "sources: [mtg-8c4n2p7w]\n", "")],
  ["memory-scope", "error", "memories/2026/12/2026-12-04-acme-api-shares-the-production-database.md",
    replace("memories/2026/12/2026-12-04-acme-api-shares-the-production-database.md", "scope: project", "scope: general")],
  ["proposal-status", "error", "_proposals/2026-12-03-acme-mobile-app-relaunch.md",
    replace("_proposals/2026-12-03-acme-mobile-app-relaunch.md", "status: pending", "status: approved")],
  ["unknown-key", "warning", CARLOS, replace(CARLOS, "org: org-6d1f9z3k", "org: org-6d1f9z3k\nwhy: not a person field")],
  ["freshness", "warning", ACME, replace(ACME, "Retail client since October 2026.", "Currently the biggest client.")],
  ["summary-length", "warning", ACME, replace(ACME, "summary: Client; mid-size retailer", `summary: ${"x".repeat(220)} Client; mid-size retailer`)],
  ["no-sources", "warning", CARLOS, replace(CARLOS, "sources: [mtg-5r2k8v3a]\n", "")],
  ["index-stale", "warning", "index.md", replace("index.md", "# Index", "# Index (edited)")],
];

for (const [rule, severity, file, mutate] of CASES) {
  test(`lint rule ${rule} (${severity})`, async (context) => {
    const dir = await fixtureCopy(context);
    await mutate(dir);
    const run = await brain(["lint", "--brain", dir, "--json"]);
    const hits = run.json.data.issues.filter((issue: { rule: string }) => issue.rule === rule);
    assert.ok(hits.length > 0, `expected ${rule}; got ${JSON.stringify(run.json.data.issues, null, 1)}`);
    assert.equal(hits[0].severity, severity);
    assert.equal(hits[0].path, file);
    assert.equal(run.code, severity === "error" ? 1 : 0);
  });
}

test("lint reports a usable line number and supports --strict and path filters", async (context) => {
  const dir = await fixtureCopy(context);
  await replace(CARLOS, "org: org-6d1f9z3k", "org: org-0000000a")(dir);
  await replace(ACME, "Retail client since October 2026.", "Currently the biggest client.")(dir);

  const all = await brain(["lint", "--brain", dir, "--json"]);
  const missing = all.json.data.issues.find((issue: { rule: string }) => issue.rule === "missing-ref");
  const lines = (await readFile(join(dir, CARLOS), "utf8")).split("\n");
  assert.equal(lines[missing.line - 1], "org: org-0000000a");

  const onlyAcme = await brain(["lint", ACME, "--brain", dir, "--json"]);
  assert.deepEqual(onlyAcme.json.data.issues.map((issue: { rule: string }) => issue.rule), ["freshness"]);
  assert.equal(onlyAcme.code, 0);
  assert.equal((await brain(["lint", ACME, "--strict", "--brain", dir, "--json"])).code, 1);
});

test("every spec example passes or fails the JSON Schemas as labelled", async () => {
  const schemas = loadSchemas();
  const root = join(import.meta.dirname, "..", "spec", "examples");
  for (const kind of ["valid", "invalid"] as const) {
    for (const file of (await readdir(join(root, kind))).sort()) {
      const { attributes } = parseFrontmatter(await readFile(join(root, kind, file), "utf8"));
      const validate = attributes.type === "proposal" ? schemas.proposal : schemas.note;
      assert.equal(validate(attributes), kind === "valid", `${kind}/${file}`);
    }
  }
});
