import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { Ajv2020 } from "ajv/dist/2020.js";

// The skills-delivery contract's schemas and examples (spec/skills-delivery.md, decision 0059, CC-98).
const SPEC = join(import.meta.dirname, "..", "spec");
const EXAMPLES = join(SPEC, "examples", "skills");
const SCHEMAS = { snapshot: "skills-snapshot.schema.json", lock: "skills-lock.schema.json", integration: "skills-integration.schema.json" } as const;

const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));

async function validators() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const ids: Record<string, string> = {};
  for (const [kind, file] of Object.entries(SCHEMAS)) {
    const schema = await readJson(join(SPEC, "schemas", file));
    ajv.addSchema(schema);
    ids[kind] = schema.$id;
  }
  return (kind: string) => ajv.getSchema(ids[kind])!;
}

/** The integrity of skills-delivery §2.2, recomputed from a manifest's own file hashes. */
function integrity(skills: Array<{ name: string; files: Array<{ path: string; sha256: string }> }>): string {
  const lines = skills
    .flatMap((skill) => skill.files.map((file) => [`${skill.name}/${file.path}`, `${file.sha256}  ${skill.name}/${file.path}\n`]))
    .sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
    .map(([, line]) => line);
  return `sha256-${createHash("sha256").update(lines.join(""), "utf8").digest("hex")}`;
}

const kindOf = (file: string) => {
  const kind = file.split("-")[0].replace(/\.json$/, "");
  assert.ok(kind in SCHEMAS, `${file}: name must start with snapshot-, lock- or integration-`);
  return kind;
};

test("every skills-delivery example passes or fails its JSON Schema as labelled", async () => {
  const validator = await validators();
  for (const label of ["valid", "invalid"] as const) {
    const files = (await readdir(join(EXAMPLES, label))).sort();
    assert.ok(files.length > 0, `no ${label} examples`);
    for (const file of files) {
      const validate = validator(kindOf(file));
      const ok = validate(await readJson(join(EXAMPLES, label, file)));
      assert.equal(ok, label === "valid", `${label}/${file}: ${JSON.stringify(validate.errors)}`);
    }
  }
});

test("every schema has at least one valid and one invalid example", async () => {
  for (const kind of Object.keys(SCHEMAS)) {
    for (const label of ["valid", "invalid"]) {
      const files = await readdir(join(EXAMPLES, label));
      assert.ok(files.some((file) => kindOf(file) === kind), `${kind}: no ${label} example`);
    }
  }
});

test("valid snapshot and lock examples carry the integrity §2.2 computes, with sorted unique names and paths", async () => {
  for (const file of (await readdir(join(EXAMPLES, "valid"))).sort()) {
    const kind = kindOf(file);
    if (kind === "integration") continue;
    const value = await readJson(join(EXAMPLES, "valid", file));
    const snapshot = kind === "lock" ? value.snapshot : value;
    assert.equal(snapshot.integrity, integrity(snapshot.skills), file);
    const names = snapshot.skills.map((skill: { name: string }) => skill.name);
    assert.deepEqual(names, [...new Set(names)].sort(), `${file}: skill names sorted and unique`);
    for (const skill of snapshot.skills) {
      const paths = skill.files.map((entry: { path: string }) => entry.path);
      assert.deepEqual(paths, [...new Set(paths)].sort(), `${file}: ${skill.name} paths sorted and unique`);
    }
  }
});

test("a lock example holds its snapshot field for field (skills-delivery §3)", async () => {
  const lock = await readJson(join(EXAMPLES, "valid", "lock.json"));
  const snapshot = await readJson(join(EXAMPLES, "valid", "snapshot-fork.json"));
  assert.deepEqual(lock.snapshot, snapshot);
  assert.deepEqual(Object.keys(lock), ["format", "installed_by", "snapshot"]);
});
