import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { Ajv2020 } from "ajv/dist/2020.js";

// CC-99: the link kit (decision 0066, spec/linked-repos.md) and the connected workflow records (decision 0059, spec/connected-workflows.md).
const SPEC = join(import.meta.dirname, "..", "spec");
const KIT_ID = "https://ultimate-brain.dev/schemas/v1/link-kit.schema.json";
const WORKFLOW_ID = "https://ultimate-brain.dev/schemas/v1/workflow.schema.json";

const ajv = async () => {
  const instance = new Ajv2020({ allErrors: true, strict: false });
  for (const name of ["link-kit.schema.json", "workflow.schema.json"]) {
    instance.addSchema(JSON.parse(await readFile(join(SPEC, "schemas", name), "utf8")));
  }
  return instance;
};

/** The workflow $defs entry a file validates against, from its name's first word (item-planned.json → item). */
const workflowDef = (file: string) => file.replace(/\.json$/, "").split("-")[0];

/** The ```json blocks of a spec file, in order. */
const jsonBlocks = async (file: string) =>
  [...(await readFile(join(SPEC, file), "utf8")).matchAll(/```json\n([\s\S]*?)```/g)].map((match) => JSON.parse(match[1]));

test("every link kit example passes or fails the schema as labelled", async () => {
  const validate = (await ajv()).getSchema(KIT_ID)!;
  for (const kind of ["valid", "invalid"] as const) {
    const files = (await readdir(join(SPEC, "examples", "link-kit", kind))).sort();
    assert.ok(files.length > 0);
    for (const file of files) {
      const kit = JSON.parse(await readFile(join(SPEC, "examples", "link-kit", kind, file), "utf8"));
      assert.equal(validate(kit), kind === "valid", `link-kit/${kind}/${file}: ${JSON.stringify(validate.errors)}`);
    }
  }
});

test("every workflow record example passes or fails its $defs entry as labelled", async () => {
  const schemas = await ajv();
  const defs = new Set<string>();
  for (const kind of ["valid", "invalid"] as const) {
    for (const file of (await readdir(join(SPEC, "examples", "workflow", kind))).sort()) {
      const def = workflowDef(file);
      defs.add(def);
      const validate = schemas.getSchema(`${WORKFLOW_ID}#/$defs/${def}`);
      assert.ok(validate, `no $defs/${def} for workflow/${kind}/${file}`);
      const record = JSON.parse(await readFile(join(SPEC, "examples", "workflow", kind, file), "utf8"));
      assert.equal(validate(record), kind === "valid", `workflow/${kind}/${file}: ${JSON.stringify(validate.errors)}`);
    }
  }
  assert.deepEqual([...defs].sort(), ["adoption", "artifact", "item", "op", "pointer", "snapshot", "workflow"]);
});

test("the JSON examples written in the specs validate", async () => {
  const schemas = await ajv();
  const [kit] = await jsonBlocks("linked-repos.md");
  assert.ok(schemas.getSchema(KIT_ID)!(kit), "linked-repos.md §2.2");
  const [workflow, item] = await jsonBlocks("connected-workflows.md");
  assert.ok(schemas.getSchema(`${WORKFLOW_ID}#/$defs/workflow`)!(workflow), "connected-workflows.md §3.3");
  assert.ok(schemas.getSchema(`${WORKFLOW_ID}#/$defs/item`)!(item), "connected-workflows.md §7.1");
});

test("the starter's default kit (linked-repos.md §7) is a valid kit", async () => {
  const validate = (await ajv()).getSchema(KIT_ID)!;
  const kit = {
    kit_version: 1,
    name: "new-repo",
    placement: { area: "area-2m7c4h8n" },
    knowledge: { patterns: ["decisions/**", "docs/**", "README.md"], never_read: [".env*", "secrets/**"] },
    tasks: { mode: "tracked-in-repo", source: { kind: "markdown", path: "TASKS.md", format: "checklist" } },
    methodology: { summary: "Record decisions in decisions/ before acting on them; plans in docs/; tasks in TASKS.md." },
    starter: { name: "generic", version: "0.9.0" },
  };
  assert.ok(validate(kit), JSON.stringify(validate.errors));
});
