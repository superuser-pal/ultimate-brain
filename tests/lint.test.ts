import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { loadSchemas } from "../src/lib/schemas.ts";
import { brain, fixtureCopy, FIXTURE_BRAIN } from "./helpers.ts";

const exec = promisify(execFile);

test("the fixture brain lints clean: no errors, no warnings", async (context) => {
  const fixture = await fixtureCopy(context);
  const run = await brain(["lint", "--strict", "--brain", fixture, "--json"]);
  assert.equal(run.code, 0, JSON.stringify(run.json?.data?.issues, null, 2));
  assert.equal(run.json.data.errors, 0);
  assert.equal(run.json.data.warnings, 0);
  assert.equal(run.json.data.files, 21);
});

test("product-file covers missing, changed, extra, malformed, and fresh product files", async (context) => {
  const fixture = await fixtureCopy(context);
  await rm(join(fixture, ".agents/skills/brain-query"), { recursive: true });
  await rm(join(fixture, ".claude/skills/brain-ingest/SKILL.md"));
  await writeFile(join(fixture, ".agents/skills/brain-ingest/references/extraction.md"), "drift\n");
  await writeFile(join(fixture, ".claude/skills/brain-ingest/extra.md"), "extra\n");
  await writeFile(join(fixture, "AGENTS.md"), "<!-- ultimate-brain:rules:start -->\nx\n<!-- ultimate-brain:rules:end -->\n<!-- ultimate-brain:rules:start -->\nx\n<!-- ultimate-brain:rules:end -->\n");
  const run = await brain(["lint", "--brain", fixture, "--json"]);
  assert.equal(run.code, 1);
  assert.ok(run.json.data.issues.some((issue: { rule: string; path: string }) => issue.rule === "product-file" && issue.path.endsWith("references/extraction.md")));
  assert.ok(run.json.data.issues.some((issue: { rule: string; path: string }) => issue.rule === "product-file" && issue.path.endsWith("extra.md")));
  assert.ok(run.json.data.issues.some((issue: { path: string }) => issue.path === ".agents/skills/brain-query"));
  assert.ok(run.json.data.issues.some((issue: { path: string }) => issue.path === ".claude/skills/brain-ingest/SKILL.md"));
  assert.ok(run.json.data.issues.some((issue: { path: string }) => issue.path === "AGENTS.md"));

  const root = join(fixture, "fresh");
  const init = await brain(["init", root, "--no-git", "--json"]);
  const clean = await brain(["lint", "--brain", root, "--json"]);
  assert.equal(init.code, 0);
  assert.equal(clean.code, 0, JSON.stringify(clean.json.data.issues));
});

test("a symlinked compiled entry resolves its package root", async (context) => {
  const fixture = await fixtureCopy(context);
  const root = join(fixture, "fresh");
  const init = await brain(["init", root, "--no-git", "--json"]);
  assert.equal(init.code, 0);

  const packageRoot = join(fixture, "published-package");
  const productRoot = join(import.meta.dirname, "..");
  await exec("npm", ["run", "build"], { cwd: productRoot });
  await cp(join(productRoot, "dist"), join(packageRoot, "dist"), { recursive: true });
  await cp(join(productRoot, ".agents"), join(packageRoot, ".agents"), { recursive: true });
  await cp(join(productRoot, "spec"), join(packageRoot, "spec"), { recursive: true });
  await cp(join(productRoot, "templates"), join(packageRoot, "templates"), { recursive: true });
  await cp(join(productRoot, "package.json"), join(packageRoot, "package.json"));
  await symlink(join(productRoot, "node_modules"), join(packageRoot, "node_modules"));
  const bin = join(fixture, "brain");
  await symlink(join(packageRoot, "dist", "cli.js"), bin);
  const result = await exec(process.execPath, [bin, "upgrade", "--brain", root, "--now", "2026-12-03T10:22:00Z", "--json"]);
  assert.match(result.stdout, /"version"/);
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
    const hit = hits.find((issue: { path: string }) => issue.path === file);
    assert.ok(hit !== undefined, `expected ${rule} in ${file}; got ${JSON.stringify(run.json.data.issues, null, 1)}`);
    assert.equal(hit.severity, severity);
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

test("lint requires each source key's folder", async (context) => {
  const dir = await fixtureCopy(context);
  const source = "sources/notion/2026-12-03-acme-sync-notion-minutes.md";
  await replace(source, "source_key: notion:3c4d5e6f-7a8b-4c0d-9e2f-3a4b5c6d7e8f", `source_key: file:sha256:${"a".repeat(64)}\nkind: document\nfile_name: acme.pdf\nconverter: markitdown 0.1.8`)(dir);
  const run = await brain(["lint", "--brain", dir, "--json"]);
  const wrongFolder = run.json.data.issues.find((issue: { rule: string; path: string }) => issue.rule === "wrong-folder" && issue.path === source);
  assert.ok(wrongFolder, JSON.stringify(run.json.data.issues));
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

const issuesFor = async (dir: string, extra: string[] = []) =>
  (await brain(["lint", ...extra, "--brain", dir, "--json"])).json.data.issues as Array<{ rule: string; path: string; line: number }>;

test("links: stray % never crashes; encoded names, titles, <angle> and reference links are checked", async (context) => {
  const dir = await fixtureCopy(context);
  await writeFile(join(dir, "knowledge/orgs/c#.md"), "x");
  await writeFile(join(dir, "knowledge/orgs/q&a notes.md"), "x");
  await replace(ACME, "Retail client since October 2026.", [
    "Growth [100%](growth-100%.md).",
    "[ok](c%23.md) [ok2](<q&a notes.md>) [ok3](q%26a%20notes.md \"title\")",
    "[bad](<missing file.md>) [bad2](missing2.md \"t\")",
    "[ref]: missing3.md",
    "[case](../People/maria-lopez.md)",
  ].join("\n"))(dir);
  const run = await brain(["lint", "--brain", dir, "--json"]);
  assert.equal(run.code, 1, run.stdout);
  const broken = run.json.data.issues.filter((issue: { rule: string }) => issue.rule === "broken-link").map((issue: { message: string }) => issue.message);
  assert.deepEqual(broken.sort(), [
    "link target ../People/maria-lopez.md does not exist",
    "link target growth-100%.md does not exist",
    "link target missing file.md does not exist",
    "link target missing2.md does not exist",
    "link target missing3.md does not exist",
  ]);
});

test("code blocks and inline code are not linted as prose", async (context) => {
  const dir = await fixtureCopy(context);
  await replace(ACME, "Retail client since October 2026.", "Run `[[ -f x ]]` and `^[a-z]`.\n\n```sh\n[[ -f x ]] && echo [x](missing.md) ^[a-z0-9]\n```\n")(dir);
  const rules = (await issuesFor(dir)).map((issue) => issue.rule);
  assert.deepEqual(rules, []);
});

test("only reference fields are checked for ids: tags and proposal values are free text", async (context) => {
  const dir = await fixtureCopy(context);
  await replace("knowledge/concepts/row-level-security.md", "tags: [security, supabase]", "tags: [security, org-partners]")(dir);
  assert.deepEqual((await issuesFor(dir)).map((issue) => issue.rule), []);
});

test("fact-timeline accepts a contested fact that keeps its earlier value", async (context) => {
  const dir = await fixtureCopy(context);
  await replace(CARLOS, "    assessment: accepted\n", "    assessment: contested\n  - field: role\n    value: Lead\n    from: 2026-12-03\n    learned: 2026-12-03\n    source: mtg-8c4n2p7w\n    assessment: contested\n")(dir);
  assert.deepEqual((await issuesFor(dir)).map((issue) => issue.rule), []);
});

test("id-duplicate is reported on every file that shares the id", async (context) => {
  const dir = await fixtureCopy(context);
  await writeFile(join(dir, "knowledge/concepts/zz-copy.md"), await readFile(join(dir, "knowledge/concepts/row-level-security.md"), "utf8"));
  const run = await brain(["lint", "knowledge/concepts/row-level-security.md", "--brain", dir, "--json"]);
  assert.equal(run.code, 1);
  assert.deepEqual(run.json.data.issues.map((issue: { rule: string }) => issue.rule), ["id-duplicate"]);
});

test("path filters keep brain.json issues, accept folders, and reject unknown paths", async (context) => {
  const dir = await fixtureCopy(context);
  await replace("brain.json", '"owner": { "name": "Alex Example" },', '"owner": {},')(dir);
  const filtered = await brain(["lint", ACME, "--brain", dir, "--json"]);
  assert.equal(filtered.code, 1);
  assert.deepEqual(filtered.json.data.issues.map((issue: { rule: string }) => issue.rule), ["brain-config"]);

  assert.equal((await brain(["lint", "knowledge/orgs/", "--brain", FIXTURE_BRAIN, "--json"])).code, 0);
  const typo = await brain(["lint", "knowledge/orgz/acme.md", "--brain", FIXTURE_BRAIN, "--json"]);
  assert.equal(typo.code, 2);
});

test("schema issues point at the offending key; a numeric id is an id-format error", async (context) => {
  const dir = await fixtureCopy(context);
  await replace(CARLOS, "org: org-6d1f9z3k", "org: 42")(dir);
  await replace("knowledge/concepts/row-level-security.md", "id: con-1s6t8e2b", "id: 12345678")(dir);
  const issues = await issuesFor(dir);
  const schema = issues.find((issue) => issue.rule === "schema" && issue.path === CARLOS)!;
  const lines = (await readFile(join(dir, CARLOS), "utf8")).split("\n");
  assert.equal(lines[schema.line - 1], "org: 42");
  assert.ok(issues.some((issue) => issue.rule === "id-format" && issue.path === "knowledge/concepts/row-level-security.md"));
});

test("freshness ignores words inside link targets", async (context) => {
  const dir = await fixtureCopy(context);
  await replace(ACME, "Retail client since October 2026.", "See [the deck](https://example.com/latest-now).")(dir);
  assert.deepEqual((await issuesFor(dir)).map((issue) => issue.rule), []);
});

test("freshness ignores latest", async (context) => {
  const dir = await fixtureCopy(context);
  await replace(ACME, "Retail client since October 2026.", "The retailer of the latest maintenance.")(dir);
  assert.deepEqual((await issuesFor(dir)).map((issue) => issue.rule), []);
});
