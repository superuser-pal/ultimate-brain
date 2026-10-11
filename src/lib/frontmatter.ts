import { isDeepStrictEqual } from "node:util";

import { isMap, parseDocument } from "yaml";
import type { Document } from "yaml";

export type Frontmatter = Record<string, unknown>;

export interface FrontmatterDocument {
  attributes: Frontmatter;
  body: string;
  readonly originalSource?: string;
  readonly originalAttributes?: Frontmatter;
  readonly originalBody?: string;
}

const parsedDocuments = new WeakMap<FrontmatterDocument, Document>();

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

/** Serialize frontmatter and body, preserving the original bytes when unchanged. */
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

function serializeAttributes(document: FrontmatterDocument): string {
  if (Object.keys(document.attributes).length === 0) return "";

  const original = parsedDocuments.get(document);
  const yamlDocument = original?.clone() ?? parseDocument("", { schema: "core" });
  const current = yamlDocument.contents === null ? {} : yamlDocument.toJS();

  if (!isRecord(current)) {
    throw new Error("YAML frontmatter must contain a top-level mapping");
  }

  for (const key of Object.keys(current)) {
    if (!Object.hasOwn(document.attributes, key)) yamlDocument.delete(key);
  }
  for (const [key, value] of Object.entries(document.attributes)) {
    if (!Object.hasOwn(current, key) || !isDeepStrictEqual(current[key], value)) {
      yamlDocument.set(key, value);
    }
  }

  return yamlDocument.toString({ lineWidth: 0 });
}

function isRecord(value: unknown): value is Frontmatter {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
