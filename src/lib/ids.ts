import { randomBytes as nodeRandomBytes } from "node:crypto";

export const ID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export const ID_PREFIXES = [
  "area",
  "dom",
  "gol",
  "prj",
  "per",
  "org",
  "mtg",
  "dec",
  "que",
  "con",
  "ref",
  "src",
  "mem",
  "prp",
  "vw",
  // Workflow record ids (spec/connected-workflows.md §1): not note ids.
  "wf",
  "wi",
  "art",
  "op",
] as const;

export type IdPrefix = (typeof ID_PREFIXES)[number];
export type RandomBytes = (size: number) => Uint8Array;

const ID_LENGTH = 8;

/** Generate a stable-format note ID, retrying when the candidate already exists. */
export function generateId(
  prefix: IdPrefix,
  existingIds: ReadonlySet<string>,
  randomBytes: RandomBytes = nodeRandomBytes,
): string {
  while (true) {
    const bytes = randomBytes(ID_LENGTH);
    if (bytes.length !== ID_LENGTH) {
      throw new Error(`ID random source returned ${bytes.length} bytes; expected ${ID_LENGTH}`);
    }

    let suffix = "";
    for (const byte of bytes) {
      suffix += ID_ALPHABET[byte & 31];
    }

    const candidate = `${prefix}-${suffix}`;
    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }
}

/** A Review item id, `it-` and 8 characters of the id alphabet, unique in its proposal and never recomputed (capture-and-review §7.2). */
export function generateItemId(existing: ReadonlySet<string>, randomBytes: RandomBytes = nodeRandomBytes): string {
  return generateId("it" as IdPrefix, existing, randomBytes);
}

/** ID prefix of each note type (spec/schema.md §1). */
export const TYPE_PREFIX: Readonly<Record<string, IdPrefix>> = {
  area: "area",
  domain: "dom",
  goal: "gol",
  project: "prj",
  person: "per",
  org: "org",
  meeting: "mtg",
  decision: "dec",
  question: "que",
  concept: "con",
  reference: "ref",
  source: "src",
  memory: "mem",
  proposal: "prp",
  view: "vw",
};

/** Workflow record prefixes that `brain id new` also takes (spec/connected-workflows.md §1). */
export const RECORD_PREFIX: Readonly<Record<string, IdPrefix>> = { wf: "wf", wi: "wi", art: "art", op: "op" };
