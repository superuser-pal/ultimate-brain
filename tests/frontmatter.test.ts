import assert from "node:assert/strict";
import { test } from "node:test";

import { parseFrontmatter, serializeFrontmatter, serializeNewFile } from "../src/lib/frontmatter.ts";

const samples = [
  `---\nid: dec-7k2m9q4x\ntype: decision\ntitle: Use Supabase\naliases: [auth choice, backend]\n---\n## Decision\nUse Supabase.\n`,
  `---\nid: per-7k2m9q4x\ntype: person\ntitle: "María José 🚀"\nsummary: Works with Acme in São Paulo.\n---\nHola, 世界.\n`,
  `---\nid: con-7k2m9q4x\ntype: concept\ntitle: Event sourcing\nsummary: |-\n  First line.\n  Second line with é.\n---\nBody without a trailing newline.`,
  `---\nid: dec-7k2m9q4x\ntype: decision\ntitle: Switch auth\nrelations:\n  - type: supersedes\n    target: dec-11111111\nmetadata:\n  nested: true\n  count: 2\n---\nNested values.\n`,
  "---\r\nid: prj-7k2m9q4x\r\ntype: project\r\n# Preserve this comment and line endings\r\ncustom_field: 'unknown value'\r\n---\r\nWindows body\r\n",
] as const;

samples.forEach((source, index) => {
  test(`frontmatter sample ${index + 1} round-trips byte-for-byte`, () => {
    const document = parseFrontmatter(source);
    assert.equal(serializeFrontmatter(document), source);
  });
});

test("frontmatter parses unicode, block scalars, sequences, and unknown keys", () => {
  const unicode = parseFrontmatter(samples[1]);
  assert.equal(unicode.attributes.title, "María José 🚀");

  const multiline = parseFrontmatter(samples[2]);
  assert.equal(multiline.attributes.summary, "First line.\nSecond line with é.");

  const nested = parseFrontmatter(samples[3]);
  assert.deepEqual(nested.attributes.relations, [
    { type: "supersedes", target: "dec-11111111" },
  ]);
  assert.deepEqual(nested.attributes.metadata, { nested: true, count: 2 });

  const unknown = parseFrontmatter(samples[4]);
  assert.equal(unknown.attributes.custom_field, "unknown value");
});

test("an added key goes before the first present key ranked after it; existing and unknown keys stay put", () => {
  const document = parseFrontmatter(
    "---\nid: dec-7k2m9q4x\ntype: decision\ntitle: Use Supabase\ncustom: kept\naliases: [auth choice]\ncreated: 2026-12-03\n---\nBody\n",
  );
  document.attributes.summary = "A newly added summary";
  document.attributes.sources = ["mtg-8c4n2p7w"];
  document.attributes.notion_published = { Name: "Use Supabase" };
  const serialized = serializeFrontmatter(document);

  assert.equal(
    serialized,
    "---\nid: dec-7k2m9q4x\ntype: decision\ntitle: Use Supabase\ncustom: kept\nsummary: A newly added summary\n" +
      "aliases: [auth choice]\nsources: [mtg-8c4n2p7w]\ncreated: 2026-12-03\nnotion_published:\n  Name: Use Supabase\n---\nBody\n",
  );
});

test("edited values use flow style for scalar lists and block style for mappings", () => {
  const document = parseFrontmatter("---\nid: prj-7k2m9q4x\ntype: project\ntitle: Site\npeople:\n  - per-11111111\n---\n");
  document.attributes.people = ["per-11111111", "per-22222222"];
  document.attributes.tags = [];
  document.attributes.timeline = [{ field: "budget", value: "80000", from: "2026-10", learned: "2026-10-01", source: "mtg-5r2k8v3a", assessment: "accepted" }];
  assert.equal(
    serializeFrontmatter(document),
    "---\nid: prj-7k2m9q4x\ntype: project\ntitle: Site\npeople: [per-11111111, per-22222222]\ntags: []\ntimeline:\n" +
      "  - field: budget\n    value: \"80000\"\n    from: 2026-10\n    learned: 2026-10-01\n    source: mtg-5r2k8v3a\n    assessment: accepted\n---\n",
  );
});

test("new files follow the canonical key order and body separator", () => {
  const decision = serializeNewFile(
    { updated: "2026-12-03", created: "2026-12-03", projects: ["prj-9x4t1b7e"], extra: 1, assessment: "provisional", date: "2026-12-03", lifecycle: "draft", summary: "S", title: "T", type: "decision", id: "dec-3f7k9m2q" },
    "## Decision\n",
  );
  assert.equal(
    decision,
    "---\nid: dec-3f7k9m2q\ntype: decision\ntitle: T\nsummary: S\nlifecycle: draft\ndate: 2026-12-03\nassessment: provisional\n" +
      "projects: [prj-9x4t1b7e]\ncreated: 2026-12-03\nupdated: 2026-12-03\nextra: 1\n---\n\n## Decision\n",
  );
  const source = serializeNewFile({ id: "src-4m9q2x7c", type: "source", title: "Minutes" }, "Body\n");
  assert.equal(source, "---\nid: src-4m9q2x7c\ntype: source\ntitle: Minutes\n---\nBody\n");
  const proposal = serializeNewFile({ status: "pending", kind: "add_to_note", created: "2026-12-03", title: "P", type: "proposal", id: "prp-3c8v1n5x" }, "");
  assert.equal(proposal, "---\nid: prp-3c8v1n5x\ntype: proposal\ntitle: P\ncreated: 2026-12-03\nkind: add_to_note\nstatus: pending\n---\n");
});

test("serialization emits YAML-safe strings under the core schema", () => {
  const values = [
    "Acme: kickoff",
    "Ends with colon:",
    "- not a list",
    "@handle",
    "1e3",
    ".5",
    "0x1F",
  ];

  for (const value of values) {
    const serialized = serializeFrontmatter({ attributes: { title: value }, body: "" });
    assert.equal(parseFrontmatter(serialized).attributes.title, value);
  }
});

test("frontmatter uses YAML 1.2 core parsing semantics", () => {
  const continued = parseFrontmatter(
    "---\nsummary: long text\n  continued here\nbudget: 1e3\n---\n",
  );

  assert.equal(continued.attributes.summary, "long text continued here");
  assert.equal(continued.attributes.budget, 1000);
});

test("frontmatter accepts an empty mapping", () => {
  const document = parseFrontmatter("---\n---\nBody\n");

  assert.deepEqual(document.attributes, {});
  assert.equal(document.body, "Body\n");
  assert.equal(serializeFrontmatter(document), "---\n---\nBody\n");
});

test("serialization retains comments on unchanged keys after an edit", () => {
  const document = parseFrontmatter("---\nid: dec-7k2m9q4x # permanent\ntitle: Old\n---\n");
  document.attributes.title = "Acme: kickoff";

  const serialized = serializeFrontmatter(document);
  assert.match(serialized, /id: dec-7k2m9q4x # permanent/);
  assert.equal(parseFrontmatter(serialized).attributes.title, "Acme: kickoff");
});

test("frontmatter rejects missing delimiters", () => {
  assert.throws(() => parseFrontmatter("# No frontmatter\n"), /must start/);
  assert.throws(() => parseFrontmatter("---\nid: dec-7k2m9q4x\n"), /closing delimiter/);
});
