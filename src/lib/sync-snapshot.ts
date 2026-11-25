import { isDeepStrictEqual } from "node:util";

import { assertNoProblems, escapePointer, isRecord, type InputProblem } from "./input.ts";
import { DATABASES, parseSnapshot } from "./sync.ts";

/**
 * `brain sync snapshot` (cli §5.14.10, CC-269): the snapshot of §5.14.1 built from the Notion query replies the skill saved,
 * with the rows that are no query reply (tracked tasks, wording objects) joined by page. Pure: no file access here.
 */

export interface SnapshotInput {
  /** The path the file came from, for the problems' pointers. */
  path: string;
  value: unknown;
}

export interface SnapshotConfig {
  /** `notion.databases` and, as `tasks`, `notion.tasks.database`. */
  databases: Record<string, string>;
  /** `notion.tasks.properties`: the mapped names (empty = unmapped). */
  taskProperties: Record<string, string>;
  /** The Factories module is on: a task's Factory is read (0114). */
  factories: boolean;
}

export interface BuiltSnapshot {
  snapshot: { as_of: string; rows: Row[] };
  examples_left_out: number;
  databases: Record<string, number>;
  warnings: Array<{ code: string; message: string }>;
}

type Row = Record<string, unknown> & { database: string; page_id: string; last_edited: string | null; properties: Record<string, unknown> };

const EXAMPLE = "Example · ";
const SNAPSHOT_DATABASES = new Set<string>(DATABASES);

const compactId = (id: string): string => id.replaceAll("-", "").toLowerCase();
const blank = (value: unknown): boolean => value === undefined || value === null || (typeof value === "string" && value.trim() === "");

/** The snapshot key of a configured database id; `references` is read as `documents` (0049). */
function databaseKeys(config: SnapshotConfig): Map<string, string> {
  const keys = new Map<string, string>();
  for (const [key, id] of Object.entries(config.databases)) if (typeof id === "string" && id !== "") keys.set(compactId(id), key === "references" ? "documents" : key);
  return keys;
}

const text = (segments: unknown): string | null => {
  if (!Array.isArray(segments)) return null;
  const joined = segments.map((segment) => isRecord(segment) ? (typeof segment.plain_text === "string" ? segment.plain_text : isRecord(segment.text) && typeof segment.text.content === "string" ? segment.text.content : "") : "").join("");
  return joined === "" ? null : joined;
};
const date = (value: unknown): unknown => isRecord(value) && typeof value.start === "string" ? { start: value.start, end: typeof value.end === "string" ? value.end : null } : null;
const optionName = (value: unknown): string | null => isRecord(value) && typeof value.name === "string" && value.name !== "" ? value.name : null;
const stringOrNull = (value: unknown): string | null => typeof value === "string" && value !== "" ? value : null;
const relationIds = (value: unknown): string[] => (Array.isArray(value) ? value : []).filter(isRecord).map((item) => String(item.id));

/** A Notion property value → its normalized value (cli §5.14.1), or undefined: left out, so not compared. */
function normalize(property: Record<string, unknown>, truncated: () => void): unknown {
  const type = property.type;
  switch (type) {
    case "title": case "rich_text": return text(property[type]);
    case "select": case "status": return optionName(property[type]);
    case "url": case "email": return stringOrNull(property[type]);
    case "number": return typeof property.number === "number" ? property.number : null;
    case "checkbox": return property.checkbox === true;
    case "date": return date(property.date);
    case "relation":
      if (property.has_more === true) { truncated(); return undefined; }
      return relationIds(property.relation).sort();
    case "formula": {
      const formula = property.formula; if (!isRecord(formula)) return undefined;
      if (formula.type === "string") return typeof formula.string === "string" ? formula.string : null;
      if (formula.type === "number") return typeof formula.number === "number" ? formula.number : null;
      if (formula.type === "boolean") return typeof formula.boolean === "boolean" ? formula.boolean : null;
      if (formula.type === "date") return date(formula.date);
      return undefined;
    }
    case "rollup": {
      const rollup = property.rollup; if (!isRecord(rollup)) return undefined;
      if (rollup.type === "number") return typeof rollup.number === "number" ? rollup.number : null;
      if (rollup.type === "date") return date(rollup.date);
      if (rollup.type !== "array" || !Array.isArray(rollup.array)) return undefined;
      // A rollup of a relation (Show original, 0105 §1) is a relation; any other array is no scalar, so it is left out.
      if (!rollup.array.every((item) => isRecord(item) && item.type === "relation")) return undefined;
      if (rollup.array.some((item) => (item as Record<string, unknown>).has_more === true)) { truncated(); return undefined; }
      return [...new Set(rollup.array.flatMap((item) => relationIds((item as Record<string, unknown>).relation)))].sort();
    }
    default: return undefined;
  }
}

const pick = (properties: Record<string, unknown>, names: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(names.filter((name) => name !== "" && Object.hasOwn(properties, name)).map((name) => [name, properties[name]]));

/** A Report row (a `vw-` Brain ID) is passed only when it asks for something, with those properties only (cli §5.14.1, 0045, 0071). */
function reportRow(properties: Record<string, unknown>): Record<string, unknown> | undefined {
  const asks = properties["Refresh asked"] === true || properties.Refresh === true || !blank(properties["What to fix"]);
  return asks ? pick(properties, ["Brain ID", "Refresh asked", "Refresh", "What to fix"]) : undefined;
}

/** The properties a page of `database` is passed with, or undefined when the row is not passed (cli §5.14.10). */
function shape(database: string, properties: Record<string, unknown>, config: SnapshotConfig): Record<string, unknown> | undefined {
  const brainId = properties["Brain ID"];
  const isReport = typeof brainId === "string" && brainId.startsWith("vw-");
  if (database === "inbox") {
    if (blank(brainId)) return undefined;
    if (isReport) { const report = reportRow(properties); if (report !== undefined) return report; }
    return properties["Document asked"] === true ? pick(properties, ["Brain ID", "Document asked", "Only keep"]) : pick(properties, ["Brain ID"]);
  }
  if (database === "documents") return isReport ? reportRow(properties) : properties;
  if (database === "tasks") {
    const name = (key: string): string => config.taskProperties[key] ?? "";
    const filled = (key: string): boolean => { const value = properties[name(key)]; return Array.isArray(value) && value.length > 0; };
    const area = properties[name("area")];
    const keys: string[] = [];
    if (name("document_asked") !== "" && properties[name("document_asked")] === true) keys.push("title", "document_asked", "project", "area");
    // A task with no Area and a Project or a Factory (0.18.0, 0113 §9, 0114).
    if (name("area") !== "" && Array.isArray(area) && area.length === 0 && (filled("project") || (config.factories && filled("factory")))) keys.push("title", "status", "area", "project", ...(config.factories ? ["factory"] : []));
    return keys.length === 0 ? undefined : pick(properties, [...new Set(keys)].map(name));
  }
  return properties;
}

const isReply = (value: unknown): value is { results: unknown[]; has_more?: unknown } => isRecord(value) && value.object === "list" && Array.isArray(value.results);
const isRows = (value: unknown): value is { rows: unknown[] } => isRecord(value) && Object.keys(value).length === 1 && Array.isArray(value.rows);

export function buildSnapshot(inputs: readonly SnapshotInput[], config: SnapshotConfig, asOf: string): BuiltSnapshot {
  const problems: InputProblem[] = [];
  const warnings: BuiltSnapshot["warnings"] = [];
  const keys = databaseKeys(config);
  const fromReplies = new Map<string, Row>();
  const ended = new Map<string, boolean>();
  const extra: Array<{ row: Row; pointer: string }> = [];
  let examples = 0;

  for (const input of inputs) {
    const at = `${input.path}#`;
    if (isRows(input.value)) {
      // The rows that are no query reply, in exactly the row format of §5.14.1, checked as sync plan checks them.
      try { parseSnapshot({ as_of: asOf, rows: structuredClone(input.value.rows) }); }
      catch (error) {
        const details = (error as { details?: unknown }).details;
        if (Array.isArray(details)) problems.push(...(details as InputProblem[]).map((problem) => ({ pointer: `${at}${problem.pointer}`, message: problem.message })));
        else throw error;
        continue;
      }
      input.value.rows.forEach((row, index) => extra.push({ row: structuredClone(row) as Row, pointer: `${at}/rows/${index}` }));
      continue;
    }
    if (!isReply(input.value)) { problems.push({ pointer: at, message: "is neither a Notion query reply (\"object\": \"list\" with results) nor a rows file ({ \"rows\": [...] } only)" }); continue; }
    const more = input.value.has_more === true;
    input.value.results.forEach((page, index) => {
      const p = `${at}/results/${index}`;
      if (!isRecord(page) || page.object !== "page") return problems.push({ pointer: p, message: "must be a page object" });
      if (typeof page.id !== "string" || page.id === "") return problems.push({ pointer: `${p}/id`, message: "must be a non-empty string" });
      if (typeof page.last_edited_time !== "string") return problems.push({ pointer: `${p}/last_edited_time`, message: "must be a timestamp" });
      if (!isRecord(page.properties)) return problems.push({ pointer: `${p}/properties`, message: "must be an object" });
      const parent = isRecord(page.parent) ? page.parent.database_id : undefined;
      if (typeof parent !== "string" || parent === "") return problems.push({ pointer: `${p}/parent`, message: "has no database_id" });
      const database = keys.get(compactId(parent));
      if (database === undefined) return problems.push({ pointer: `${p}/parent/database_id`, message: "is no database in brain.json notion.databases or notion.tasks.database" });
      if (!SNAPSHOT_DATABASES.has(database)) return problems.push({ pointer: `${p}/parent/database_id`, message: `is the ${database} database, which is not a snapshot database` });
      ended.set(database, (ended.get(database) ?? false) || !more);
      if (page.in_trash === true || page.archived === true) return;
      const properties: Record<string, unknown> = {};
      let title: string | null = null;
      for (const [name, value] of Object.entries(page.properties)) {
        if (!isRecord(value)) continue;
        const normalized = normalize(value, () => warnings.push({ code: "RELATION_TRUNCATED", message: `Page ${page.id}: Notion returned only part of ${name}; it is left out and not compared. Read the property in full to compare it.` }));
        if (value.type === "title") title = typeof normalized === "string" ? normalized : null;
        if (normalized !== undefined) properties[name] = normalized;
      }
      // The Notion template's invented rows are never read (0084).
      if (title !== null && title.startsWith(EXAMPLE)) { examples += 1; return; }
      const shaped = shape(database, properties, config);
      if (shaped === undefined) return;
      const row: Row = { database, page_id: page.id, last_edited: page.last_edited_time, properties: shaped };
      const key = compactId(page.id);
      const seen = fromReplies.get(key);
      if (seen === undefined) { fromReplies.set(key, row); return; }
      // A page in two replies is passed once: the later read wins; the same read must give the same row.
      if (seen.database !== database) return problems.push({ pointer: p, message: `page ${page.id} is in two databases` });
      const order = Date.parse(row.last_edited!) - Date.parse(seen.last_edited!);
      if (order > 0) fromReplies.set(key, row);
      else if (order === 0 && !isDeepStrictEqual(seen, row)) problems.push({ pointer: p, message: `page ${page.id} gives two different rows with the same last_edited_time` });
    });
  }

  for (const [database, done] of ended) if (!done) problems.push({ pointer: "", message: `INCOMPLETE_READ: every saved reply of the ${database} database has has_more true: save its last page (follow next_cursor until it is null)` });

  // The rows files: passed as they are, or joined onto a query reply's row only for a tracked task or a wording object (cli §5.14.10).
  const rows = new Map(fromReplies);
  const extraPages = new Set<string>();
  for (const { row, pointer } of extra) {
    if (row.database === "references") row.database = "documents";
    const key = compactId(row.page_id);
    if (extraPages.has(key)) { problems.push({ pointer, message: `page ${row.page_id} is twice in the rows files` }); continue; }
    extraPages.add(key);
    const base = fromReplies.get(key);
    if (base === undefined) { rows.set(key, row); continue; }
    if (base.database !== row.database) { problems.push({ pointer: `${pointer}/database`, message: `page ${row.page_id} is a ${base.database} row in a query reply` }); continue; }
    const joinsTask = row.database === "tasks";
    const joinsWording = (row.database === "documents" || row.database === "inbox") && row.wording !== undefined;
    if (!joinsTask && !joinsWording) { problems.push({ pointer, message: `page ${row.page_id} also came from a query reply: only a tracked task or a wording object joins it` }); continue; }
    if (row.unreadable === true) { problems.push({ pointer: `${pointer}/unreadable`, message: `page ${row.page_id} was read by a query: it can't be unreadable` }); continue; }
    const clashes = Object.keys(row.properties).filter((name) => Object.hasOwn(base.properties, name) && !isDeepStrictEqual(base.properties[name], row.properties[name]));
    if (clashes.length > 0) { problems.push(...clashes.map((name) => ({ pointer: `${pointer}/properties/${escapePointer(name)}`, message: `differs from the value the query reply gives page ${row.page_id}` }))); continue; }
    const later = row.last_edited !== null && Date.parse(row.last_edited) > Date.parse(base.last_edited!) ? row.last_edited : base.last_edited;
    rows.set(key, { ...base, ...row, database: base.database, page_id: base.page_id, last_edited: later, properties: { ...base.properties, ...row.properties } });
  }

  assertNoProblems(problems);
  const sorted = [...rows.values()].sort((a, b) => a.database === b.database ? (a.page_id < b.page_id ? -1 : a.page_id > b.page_id ? 1 : 0) : a.database < b.database ? -1 : 1);
  const snapshot = { as_of: asOf, rows: sorted };
  // What sync plan reads, it accepts: the same check, on the whole file.
  parseSnapshot(structuredClone(snapshot));
  const databases: Record<string, number> = {};
  for (const row of sorted) databases[row.database] = (databases[row.database] ?? 0) + 1;
  return { snapshot, examples_left_out: examples, databases, warnings };
}
