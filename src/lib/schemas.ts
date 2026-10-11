import { readFileSync } from "node:fs";

import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";

/** The JSON Schemas of spec/schemas/, the single source of truth for file shapes. */
const SCHEMA_DIR = new URL("../../spec/schemas/", import.meta.url);

type JsonObject = Record<string, any>;

export interface SchemaSet {
  note: ValidateFunction;
  proposal: ValidateFunction;
  brain: ValidateFunction;
  /** Frontmatter keys each type declares (core + knowledge + type fields). */
  knownKeys(type: string): ReadonlySet<string> | undefined;
}

const KNOWLEDGE_TYPES = new Set([
  "area", "goal", "project", "person", "org", "meeting", "decision", "question", "concept", "memory",
]);

let cached: SchemaSet | undefined;

export function loadSchemas(): SchemaSet {
  if (cached !== undefined) return cached;
  const read = (name: string): JsonObject => JSON.parse(readFileSync(new URL(name, SCHEMA_DIR), "utf8"));
  const note = read("note.schema.json");
  const proposal = read("proposal.schema.json");
  const brain = read("brain.schema.json");

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ajv.addSchema(note);
  ajv.addSchema(proposal);
  ajv.addSchema(brain);

  const keys = (schema: JsonObject | undefined): string[] => Object.keys(schema?.properties ?? {});
  const known = new Map<string, Set<string>>();
  for (const type of [...KNOWLEDGE_TYPES, "source", "view"]) {
    const set = new Set([...keys(note), ...keys(note.$defs?.[type])]);
    if (KNOWLEDGE_TYPES.has(type)) for (const key of keys(note.$defs?.knowledge)) set.add(key);
    known.set(type, set);
  }
  known.set("proposal", new Set(keys(proposal)));

  cached = {
    note: ajv.getSchema(note.$id)!,
    proposal: ajv.getSchema(proposal.$id)!,
    brain: ajv.getSchema(brain.$id)!,
    knownKeys: (type) => known.get(type),
  };
  return cached;
}

/** Readable messages for the errors that matter (composition keywords are noise). */
export function describeErrors(errors: readonly ErrorObject[] | null | undefined): string[] {
  const messages = (errors ?? [])
    .filter((error) => !["if", "anyOf", "allOf", "oneOf"].includes(error.keyword))
    .map((error) => {
      const where = error.instancePath === "" ? "frontmatter" : error.instancePath.slice(1).replaceAll("/", ".");
      if (error.keyword === "required") return `${where}: missing ${String(error.params.missingProperty)}`;
      if (error.keyword === "not") return `${where}: has a field this type must not have`;
      return `${where}: ${error.message ?? error.keyword}`;
    });
  return [...new Set(messages)];
}
