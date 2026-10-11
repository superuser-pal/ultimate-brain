import { isDeepStrictEqual } from "node:util";

export type Frontmatter = Record<string, unknown>;

export interface FrontmatterDocument {
  attributes: Frontmatter;
  body: string;
  readonly originalSource?: string;
  readonly originalAttributes?: Frontmatter;
  readonly originalBody?: string;
}

/** Parse a Markdown file with a YAML frontmatter mapping. */
export function parseFrontmatter(source: string): FrontmatterDocument {
  const lineEnding = source.includes("\r\n") ? "\r\n" : "\n";
  if (!source.startsWith(`---${lineEnding}`)) {
    throw new Error("Markdown file must start with a YAML frontmatter delimiter");
  }

  const closing = `${lineEnding}---${lineEnding}`;
  const closingAt = source.indexOf(closing, 3 + lineEnding.length);
  if (closingAt === -1) {
    throw new Error("YAML frontmatter is missing its closing delimiter");
  }

  const yaml = source.slice(3 + lineEnding.length, closingAt);
  const body = source.slice(closingAt + closing.length);
  const attributes = parseYamlMapping(yaml.replaceAll("\r\n", "\n"));

  return {
    attributes,
    body,
    originalSource: source,
    originalAttributes: structuredClone(attributes),
    originalBody: body,
  };
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

  return `---\n${serializeMapping(document.attributes, 0)}---\n${document.body}`;
}

interface ParsedLine {
  indent: number;
  content: string;
  line: number;
}

function parseYamlMapping(yaml: string): Frontmatter {
  if (yaml.trim() === "") return {};
  const lines = yaml.split("\n").map((raw, index) => {
    if (/\t/.test(raw.match(/^\s*/)?.[0] ?? "")) {
      throw new Error(`Tabs are not allowed for YAML indentation (line ${index + 1})`);
    }
    return {
      indent: raw.length - raw.trimStart().length,
      content: raw.trimStart(),
      line: index + 1,
    };
  });

  const [value, next] = parseBlock(lines, 0, 0);
  if (next < lines.length) {
    throw new Error(`Unexpected YAML content at line ${lines[next]?.line ?? next + 1}`);
  }
  if (!isRecord(value)) {
    throw new Error("YAML frontmatter must contain a top-level mapping");
  }
  return value;
}

function parseBlock(lines: ParsedLine[], start: number, indent: number): [unknown, number] {
  let cursor = skipIgnored(lines, start);
  const first = lines[cursor];
  if (first === undefined || first.indent < indent) return [{}, cursor];
  if (first.indent !== indent) {
    throw new Error(`Unexpected YAML indentation at line ${first.line}`);
  }
  return first.content.startsWith("- ") || first.content === "-"
    ? parseSequence(lines, cursor, indent)
    : parseObject(lines, cursor, indent);
}

function parseObject(lines: ParsedLine[], start: number, indent: number): [Frontmatter, number] {
  const result: Frontmatter = {};
  let cursor = start;

  while (cursor < lines.length) {
    cursor = skipIgnored(lines, cursor);
    const line = lines[cursor];
    if (line === undefined || line.indent < indent) break;
    if (line.indent > indent) {
      throw new Error(`Unexpected YAML indentation at line ${line.line}`);
    }
    if (line.content.startsWith("- ") || line.content === "-") break;

    const pair = splitKeyValue(line.content, line.line);
    const key = parseKey(pair.key);
    if (Object.hasOwn(result, key)) {
      throw new Error(`Duplicate YAML key "${key}" at line ${line.line}`);
    }

    if (isBlockScalarIndicator(pair.value)) {
      const [value, next] = parseBlockScalar(lines, cursor + 1, indent, pair.value);
      result[key] = value;
      cursor = next;
      continue;
    }

    if (pair.value === "") {
      const next = skipIgnored(lines, cursor + 1);
      if (next < lines.length && lines[next]!.indent > indent) {
        [result[key], cursor] = parseBlock(lines, next, lines[next]!.indent);
      } else {
        result[key] = null;
        cursor += 1;
      }
      continue;
    }

    result[key] = parseScalarOrFlow(pair.value);
    cursor += 1;
  }

  return [result, cursor];
}

function parseSequence(lines: ParsedLine[], start: number, indent: number): [unknown[], number] {
  const result: unknown[] = [];
  let cursor = start;

  while (cursor < lines.length) {
    cursor = skipIgnored(lines, cursor);
    const line = lines[cursor];
    if (line === undefined || line.indent < indent) break;
    if (line.indent !== indent || (!line.content.startsWith("- ") && line.content !== "-")) break;

    const item = line.content === "-" ? "" : line.content.slice(2).trim();
    if (item === "") {
      const next = skipIgnored(lines, cursor + 1);
      if (next >= lines.length || lines[next]!.indent <= indent) {
        result.push(null);
        cursor += 1;
      } else {
        let parsed: unknown;
        [parsed, cursor] = parseBlock(lines, next, lines[next]!.indent);
        result.push(parsed);
      }
      continue;
    }

    if (looksLikeKeyValue(item)) {
      const synthetic = [{ indent: indent + 2, content: item, line: line.line }, ...lines.slice(cursor + 1)];
      const [object, consumed] = parseObject(synthetic, 0, indent + 2);
      result.push(object);
      cursor += consumed;
      continue;
    }

    result.push(parseScalarOrFlow(item));
    cursor += 1;
  }

  return [result, cursor];
}

function parseBlockScalar(
  lines: ParsedLine[],
  start: number,
  parentIndent: number,
  indicator: string,
): [string, number] {
  let cursor = start;
  const collected: ParsedLine[] = [];
  while (cursor < lines.length) {
    const line = lines[cursor]!;
    if (line.content !== "" && line.indent <= parentIndent) break;
    collected.push(line);
    cursor += 1;
  }

  const contentIndent = Math.min(
    ...collected.filter((line) => line.content !== "").map((line) => line.indent),
    parentIndent + 2,
  );
  const rawLines = collected.map((line) =>
    line.content === "" ? "" : `${" ".repeat(line.indent)}${line.content}`.slice(contentIndent),
  );
  let value = indicator.startsWith(">") ? foldLines(rawLines) : rawLines.join("\n");
  const chomping = indicator.at(-1);
  if (chomping === "+") value += "\n";
  else if (chomping !== "-") value = `${value.replace(/\n+$/, "")}\n`;
  return [value, cursor];
}

function foldLines(lines: string[]): string {
  let result = "";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const next = lines[index + 1];
    result += line;
    if (next !== undefined) result += line === "" || next === "" ? "\n" : " ";
  }
  return result;
}

function parseScalarOrFlow(value: string): unknown {
  const withoutComment = stripComment(value).trim();
  if (withoutComment.startsWith("[") && withoutComment.endsWith("]")) {
    return splitFlow(withoutComment.slice(1, -1)).map(parseScalarOrFlow);
  }
  if (withoutComment.startsWith("{") && withoutComment.endsWith("}")) {
    const object: Frontmatter = {};
    for (const entry of splitFlow(withoutComment.slice(1, -1))) {
      const pair = splitKeyValue(entry, 0);
      object[parseKey(pair.key)] = parseScalarOrFlow(pair.value);
    }
    return object;
  }
  if (withoutComment.startsWith('"') && withoutComment.endsWith('"')) {
    return JSON.parse(withoutComment) as unknown;
  }
  if (withoutComment.startsWith("'") && withoutComment.endsWith("'")) {
    return withoutComment.slice(1, -1).replaceAll("''", "'");
  }
  if (/^(?:null|~)$/i.test(withoutComment)) return null;
  if (/^(?:true|false)$/i.test(withoutComment)) return withoutComment.toLowerCase() === "true";
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(withoutComment)) return Number(withoutComment);
  return withoutComment;
}

function serializeMapping(mapping: Frontmatter, indent: number): string {
  return Object.entries(mapping)
    .map(([key, value]) => serializePair(key, value, indent))
    .join("");
}

function serializePair(key: string, value: unknown, indent: number): string {
  const prefix = `${" ".repeat(indent)}${serializeKey(key)}:`;
  if (typeof value === "string" && value.includes("\n")) {
    const trailingNewline = value.endsWith("\n");
    const content = trailingNewline ? value.slice(0, -1) : value;
    const lines = content.split("\n").map((line) => `${" ".repeat(indent + 2)}${line}\n`).join("");
    return `${prefix} |${trailingNewline ? "" : "-"}\n${lines}`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return `${prefix} []\n`;
    return `${prefix}\n${serializeSequence(value, indent + 2)}`;
  }
  if (isRecord(value)) {
    if (Object.keys(value).length === 0) return `${prefix} {}\n`;
    return `${prefix}\n${serializeMapping(value, indent + 2)}`;
  }
  return `${prefix} ${serializeScalar(value)}\n`;
}

function serializeSequence(values: unknown[], indent: number): string {
  return values.map((value) => {
    const prefix = `${" ".repeat(indent)}-`;
    if (Array.isArray(value)) {
      return value.length === 0 ? `${prefix} []\n` : `${prefix}\n${serializeSequence(value, indent + 2)}`;
    }
    if (isRecord(value)) {
      const entries = Object.entries(value);
      if (entries.length === 0) return `${prefix} {}\n`;
      const [[firstKey, firstValue], ...rest] = entries;
      const first = serializePair(firstKey, firstValue, indent + 2).slice(indent + 2);
      return `${prefix} ${first}${serializeMapping(Object.fromEntries(rest), indent + 2)}`;
    }
    return `${prefix} ${serializeScalar(value)}\n`;
  }).join("");
}

function serializeScalar(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value !== "string") {
    throw new Error(`Unsupported YAML value: ${String(value)}`);
  }
  if (
    value !== "" &&
    /^[\p{L}\p{N}_./@-][\p{L}\p{N} _./@:+-]*$/u.test(value) &&
    !/^(?:null|true|false|~|-?(?:0|[1-9]\d*)(?:\.\d+)?)$/i.test(value) &&
    !value.includes(" #")
  ) {
    return value;
  }
  return JSON.stringify(value);
}

function serializeKey(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : JSON.stringify(key);
}

function splitKeyValue(content: string, line: number): { key: string; value: string } {
  const separator = findMappingSeparator(content);
  if (separator <= 0) {
    throw new Error(`Expected a YAML key/value pair${line === 0 ? "" : ` at line ${line}`}`);
  }
  return { key: content.slice(0, separator).trim(), value: content.slice(separator + 1).trim() };
}

function looksLikeKeyValue(value: string): boolean {
  return findMappingSeparator(value) > 0;
}

function parseKey(key: string): string {
  const parsed = parseScalarOrFlow(key);
  if (typeof parsed !== "string") throw new Error(`YAML mapping key must be a string: ${key}`);
  return parsed;
}

function splitFlow(content: string): string[] {
  if (content.trim() === "") return [];
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: "'" | '"' | undefined;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]!;
    if (quote !== undefined) {
      if (character === quote && content[index - 1] !== "\\") quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === "[" || character === "{") depth += 1;
    else if (character === "]" || character === "}") depth -= 1;
    else if (character === "," && depth === 0) {
      parts.push(content.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(content.slice(start).trim());
  return parts;
}

function findTopLevelCharacter(content: string, wanted: string): number {
  let depth = 0;
  let quote: "'" | '"' | undefined;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]!;
    if (quote !== undefined) {
      if (character === quote && content[index - 1] !== "\\") quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === "[" || character === "{") depth += 1;
    else if (character === "]" || character === "}") depth -= 1;
    else if (character === wanted && depth === 0) return index;
  }
  return -1;
}

function findMappingSeparator(content: string): number {
  let start = 0;
  while (start < content.length) {
    const relative = findTopLevelCharacter(content.slice(start), ":");
    if (relative === -1) return -1;
    const index = start + relative;
    const next = content[index + 1];
    if (next === undefined || /\s/.test(next)) return index;
    start = index + 1;
  }
  return -1;
}

function stripComment(value: string): string {
  let quote: "'" | '"' | undefined;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (quote !== undefined) {
      if (character === quote && value[index - 1] !== "\\") quote = undefined;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (character === "#" && (index === 0 || /\s/.test(value[index - 1]!))) {
      return value.slice(0, index);
    }
  }
  return value;
}

function isBlockScalarIndicator(value: string): boolean {
  return /^[|>][+-]?$/.test(value);
}

function skipIgnored(lines: ParsedLine[], start: number): number {
  let cursor = start;
  while (cursor < lines.length) {
    const content = lines[cursor]!.content;
    if (content !== "" && !content.startsWith("#")) break;
    cursor += 1;
  }
  return cursor;
}

function isRecord(value: unknown): value is Frontmatter {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
