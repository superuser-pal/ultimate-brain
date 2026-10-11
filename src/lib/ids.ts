import { randomBytes as nodeRandomBytes } from "node:crypto";

export const ID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export const ID_PREFIXES = [
  "area",
  "gol",
  "prj",
  "per",
  "org",
  "mtg",
  "dec",
  "que",
  "con",
  "src",
  "mem",
  "prp",
  "vw",
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

/** ID prefix of each note type (spec/schema.md §1). */
export const TYPE_PREFIX: Readonly<Record<string, IdPrefix>> = {
  area: "area",
  goal: "gol",
  project: "prj",
  person: "per",
  org: "org",
  meeting: "mtg",
  decision: "dec",
  question: "que",
  concept: "con",
  source: "src",
  memory: "mem",
  proposal: "prp",
  view: "vw",
};
