import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { Ajv2020 } from "ajv/dist/2020.js";

// spec/examples/assistant/ against spec/schemas/assistant.schema.json (spec/assistant.md, cli.md §5.31, CC-143).
// An example's name starts with the `$defs` entry it is an instance of: `snapshot-`, `dismissals-` or `dismissInput-`.
const SPEC = join(import.meta.dirname, "..", "spec");
const EXAMPLES = join(SPEC, "examples", "assistant");
const DEFS = ["snapshot", "dismissals", "dismissInput"] as const;

const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const defOf = (file: string) => {
  const def = file.replace(/\.json$/, "").split("-")[0]!;
  assert.ok((DEFS as readonly string[]).includes(def), `${file}: name must start with ${DEFS.join(", ")}`);
  return def;
};

async function validator() {
  const schema = await readJson(join(SPEC, "schemas", "assistant.schema.json"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ajv.addSchema(schema);
  return (def: string) => ajv.getSchema(`${schema.$id}#/$defs/${def}`)!;
}

test("every assistant example passes or fails its $defs entry as labelled", async () => {
  const validate = await validator();
  for (const label of ["valid", "invalid"] as const) {
    const files = (await readdir(join(EXAMPLES, label))).filter((file) => file.endsWith(".json")).sort();
    assert.ok(files.length > 0, `no ${label} examples`);
    for (const file of files) {
      const check = validate(defOf(file));
      const ok = check(await readJson(join(EXAMPLES, label, file)));
      assert.equal(ok, label === "valid", `${label}/${file}: ${JSON.stringify(check.errors)}`);
    }
  }
});

test("each $defs entry has at least one valid and one invalid example", async () => {
  for (const label of ["valid", "invalid"]) {
    const files = await readdir(join(EXAMPLES, label));
    for (const def of DEFS) assert.ok(files.some((file) => defOf(file) === def), `${def}: no ${label} example`);
  }
});
