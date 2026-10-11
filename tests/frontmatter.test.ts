import assert from "node:assert/strict";
import { test } from "node:test";

import { parseFrontmatter, serializeFrontmatter } from "../src/lib/frontmatter.ts";

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

test("serialization preserves key order and unknown fields after an edit", () => {
  const document = parseFrontmatter(samples[0]);
  document.attributes.summary = "A newly added summary";
  const serialized = serializeFrontmatter(document);
  const keys = serialized.match(/^(id|type|title|aliases|summary):/gm);

  assert.deepEqual(keys, ["id:", "type:", "title:", "aliases:", "summary:"]);
  assert.equal(parseFrontmatter(serialized).attributes.summary, "A newly added summary");
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
