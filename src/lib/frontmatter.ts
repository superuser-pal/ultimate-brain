import { isDeepStrictEqual } from "node:util";

import { Document, isMap, isScalar, isSeq, parseDocument, visit } from "yaml";
import type { Node } from "yaml";

export type Frontmatter = Record<string, unknown>;

export interface FrontmatterDocument {
  attributes: Frontmatter;
  body: string;
  readonly originalSource?: string;
  readonly originalAttributes?: Frontmatter;
  readonly originalBody?: string;
}

const parsedDocuments = new WeakMap<FrontmatterDocument, Document>();

/** Serialization options of spec/cli.md §3.6.5. */
const TO_STRING = { lineWidth: 0, flowCollectionPadding: false } as const;

const KNOWLEDGE_HEAD = ["id", "type", "title", "summary", "lifecycle"];
const KNOWLEDGE_TAIL = [
  "aliases", "tags", "area", "projects", "sources", "relations", "facts", "timeline",
  "created", "updated", "notion", "last_synced", "notion_fields", "notion_published",
];
/** Each type's own fields, in the order of its table in spec/schema.md §4. */
const TYPE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  goal: ["why", "area"],
  project: ["area", "goal", "client", "people"],
  person: ["org"],
  meeting: ["date", "attendees", "source", "decisions", "questions", "tasks"],
  decision: ["date", "assessment", "decided_in", "deciders", "valid_from", "valid_until"],
  question: ["kind", "raised_in", "answer"],
  source: ["source_key", "content_hash", "captured", "origin_edited"],
  view: ["view_kind", "project", "generated_from", "generated_at"],
  memory: ["scope", "areas", "projects", "stacks", "confidence", "origin"],
};
/** Proposal key order: the spec/schema.md §11 example, then its table. */
const PROPOSAL_ORDER = [
  "id", "type", "title", "created", "updated", "kind", "target", "field", "before", "after", "from",
  "content", "note", "supersedes", "merge_into", "why", "source", "status", "decision", "closed_reason",
  "notion", "notion_published",
];

/** Canonical rank of each key for a type (spec/cli.md §3.6.5); a key listed twice keeps its first position. */
function keyOrder(type: unknown): ReadonlyMap<string, number> {
  const keys = type === "proposal"
    ? PROPOSAL_ORDER
    : [...KNOWLEDGE_HEAD, ...(TYPE_FIELDS[String(type)] ?? []), ...KNOWLEDGE_TAIL];
  const ranks = new Map<string, number>();
  for (const key of keys) if (!ranks.has(key)) ranks.set(key, ranks.size);
  return ranks;
}

/** Parse a Markdown file with a YAML 1.2 core-schema frontmatter mapping. */
export function parseFrontmatter(source: string): FrontmatterDocument {
  const opening = /^---(?:\r\n|\n)/.exec(source);
  if (opening === null) {
    throw new Error("Markdown file must start with a YAML frontmatter delimiter");
  }

  const afterOpening = source.slice(opening[0].length);
  const closing = /^---(?:\r\n|\n|$)/m.exec(afterOpening);
  if (closing === null) {
    throw new Error("YAML frontmatter is missing its closing delimiter");
  }

  const yamlSource = afterOpening.slice(0, closing.index);
  const yamlDocument = parseDocument(yamlSource, {
    schema: "core",
    prettyErrors: true,
    uniqueKeys: true,
  });
  if (yamlDocument.errors.length > 0) {
    throw new Error(`Invalid YAML frontmatter: ${yamlDocument.errors[0]!.message}`);
  }
  if (yamlDocument.contents !== null && !isMap(yamlDocument.contents)) {
    throw new Error("YAML frontmatter must contain a top-level mapping");
  }

  const parsed = yamlDocument.contents === null ? {} : yamlDocument.toJS();
  if (!isRecord(parsed)) {
    throw new Error("YAML frontmatter must contain a top-level mapping");
  }

  const body = afterOpening.slice(closing.index + closing[0].length);
  const document: FrontmatterDocument = {
    attributes: parsed,
    body,
    originalSource: source,
    originalAttributes: structuredClone(parsed),
    originalBody: body,
  };
  parsedDocuments.set(document, yamlDocument);
  return document;
}

/**
 * Serialize an edited file, preserving the original bytes when unchanged. Existing keys keep
 * their place and unknown keys are kept; a new key goes where the canonical order puts it among
 * the keys present (spec/cli.md §3.6.5).
 */
export function serializeFrontmatter(document: FrontmatterDocument): string {
  if (
    document.originalSource !== undefined &&
    document.originalAttributes !== undefined &&
    document.originalBody !== undefined &&
    isDeepStrictEqual(document.attributes, document.originalAttributes) &&
    document.body === document.originalBody
  ) {
    return document.originalSource;
  }

  const yaml = serializeAttributes(document);
  return `---\n${yaml}---\n${document.body}`;
}

/**
 * Serialize a new file (spec/cli.md §3.6.5): keys in canonical order (unknown keys last, in
 * input order), one blank line before the body (none for a source), nothing after the closing
 * `---` when the body is empty.
 */
export function serializeNewFile(attributes: Frontmatter, body: string): string {
  const ranks = keyOrder(attributes.type);
  const rank = (key: string) => ranks.get(key) ?? Number.MAX_SAFE_INTEGER;
  const ordered = Object.fromEntries(
    Object.entries(attributes).sort(([a], [b]) => rank(a) - rank(b)),
  );
  const yamlDocument = new Document(ordered, { schema: "core" });
  applyCollectionStyle(yamlDocument.contents);
  const yaml = yamlDocument.toString(TO_STRING);
  if (body === "") return `---\n${yaml}---\n`;
  return `---\n${yaml}---\n${attributes.type === "source" ? "" : "\n"}${body}`;
}

function serializeAttributes(document: FrontmatterDocument): string {
  if (Object.keys(document.attributes).length === 0) return "";

  const original = parsedDocuments.get(document);
  const yamlDocument = original?.clone() ?? new Document({}, { schema: "core" });
  if (yamlDocument.contents === null) yamlDocument.contents = yamlDocument.createNode({});
  const map = yamlDocument.contents;
  if (!isMap(map)) {
    throw new Error("YAML frontmatter must contain a top-level mapping");
  }
  const current = yamlDocument.toJS() as Frontmatter;

  for (const key of Object.keys(current)) {
    if (!Object.hasOwn(document.attributes, key)) yamlDocument.delete(key);
  }

  const ranks = keyOrder(document.attributes.type);
  for (const [key, value] of Object.entries(document.attributes)) {
    if (Object.hasOwn(current, key) && isDeepStrictEqual(current[key], value)) continue;
    const node = yamlDocument.createNode(value);
    applyCollectionStyle(node);
    if (Object.hasOwn(current, key)) {
      yamlDocument.set(key, node);
      continue;
    }
    // Insert before the first present key that the canonical order puts after this one.
    const pair = yamlDocument.createPair(key, node);
    const rank = ranks.get(key);
    const index = rank === undefined
      ? -1
      : map.items.findIndex((item) => {
        const other = ranks.get(String(isScalar(item.key) ? item.key.value : item.key));
        return other !== undefined && other > rank;
      });
    if (index === -1) map.items.push(pair);
    else map.items.splice(index, 0, pair);
  }

  return yamlDocument.toString(TO_STRING);
}

/** Lists of scalars in flow style (`[a, b]`, `[]`); mappings and lists of mappings in block style. */
function applyCollectionStyle(node: unknown): void {
  if (isSeq(node)) node.flow = node.items.every((item) => isScalar(item));
  if (isMap(node)) node.flow = false;
  if (!isSeq(node) && !isMap(node)) return;
  visit(node as Node, {
    Map(_, map) {
      map.flow = false;
    },
    Seq(_, seq) {
      seq.flow = seq.items.every((item) => isScalar(item));
    },
  });
}

function isRecord(value: unknown): value is Frontmatter {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
