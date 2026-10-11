import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { posix } from "node:path";

import { buildIndex } from "./index-builder.ts";
import { compareCodePoints, type Note, type ScanProblem } from "./notes.ts";
import { describeErrors, loadSchemas } from "./schemas.ts";

export type Severity = "error" | "warning";

export interface Issue {
  severity: Severity;
  rule: string;
  path: string;
  line: number;
  id: string | null;
  message: string;
}

export interface LintInput {
  root: string;
  notes: readonly Note[];
  problems: readonly ScanProblem[];
  brainConfig: unknown;
  /** Current index.md bytes, or null when missing. */
  indexMarkdown: string | null;
}

const ID = /^(area|gol|prj|per|org|mtg|dec|que|con|src|mem|prp|vw)-[0-9abcdefghjkmnpqrstvwxyz]{8}$/;
/** Frontmatter keys whose values are references (spec/schema.md §3–§11); `relations` and `timeline` are handled by shape. */
const REFERENCE_KEYS = new Set([
  "area", "goal", "client", "org", "projects", "people", "attendees", "decided_in", "raised_in", "deciders",
  "source", "sources", "decisions", "questions", "answer", "target", "supersedes", "merge_into", "project",
  "generated_from", "facts",
]);

/** Where each type must live (spec/schema.md §2). */
const FOLDERS: Readonly<Record<string, RegExp>> = {
  area: /^areas\/[^/]+\.md$/,
  goal: /^(archive\/)?goals\/[^/]+\.md$/,
  project: /^(archive\/)?projects\/[^/]+\/project\.md$/,
  view: /^(archive\/)?projects\/[^/]+\/[^/]+\.md$/,
  person: /^knowledge\/people\/[^/]+\.md$/,
  org: /^knowledge\/orgs\/[^/]+\.md$/,
  meeting: /^knowledge\/meetings\/\d{4}-\d{2}-\d{2}-[^/]+\.md$/,
  decision: /^knowledge\/decisions\/\d{4}-\d{2}-\d{2}-[^/]+\.md$/,
  question: /^knowledge\/questions\/[^/]+\.md$/,
  concept: /^knowledge\/concepts\/[^/]+\.md$/,
  source: /^sources\/notion\/\d{4}-\d{2}-\d{2}-[^/]+\.md$/,
  memory: /^memories\/\d{4}\/\d{2}\/\d{4}-\d{2}-\d{2}-[^/]+\.md$/,
  proposal: /^_proposals\/[^/]+\.md$/,
};

const KNOWLEDGE = new Set(["area", "goal", "project", "person", "org", "meeting", "decision", "question", "concept", "memory"]);
const UNDATED = new Set(["area", "goal", "project", "person", "org", "question", "concept"]);
const FRESHNESS_WORDS = /\b(currently|now|at the moment|this week|latest|recently|soon)\b/i;
const HAS_DATE = /\b\d{4}-\d{2}(-\d{2})?\b/;
const MEMORY_REACH: Readonly<Record<string, string | null>> = { general: null, area: "areas", project: "projects", stack: "stacks" };

/** Run every lint rule of spec/cli.md §5.10 over the brain. Issues are sorted by path, line, rule, message. */
export function lintBrain(input: LintInput): Issue[] {
  const schemas = loadSchemas();
  const issues: Issue[] = [];
  const add = (severity: Severity, rule: string, path: string, line: number, id: string | null, message: string) =>
    issues.push({ severity, rule, path, line, id, message });

  for (const problem of input.problems) {
    if (problem.code === "NOT_A_NOTE") add("error", "not-a-note", problem.path, 1, null, problem.message);
    if (problem.code === "UNPARSEABLE" || problem.code === "UNREADABLE") add("error", "unparseable", problem.path, 1, null, problem.message);
  }

  if (!schemas.brain(input.brainConfig)) {
    add("error", "brain-config", "brain.json", 1, null, describeErrors(schemas.brain.errors).join("; "));
  }

  const byId = new Map<string, Note>();
  const pathsById = new Map<string, string[]>();
  for (const note of input.notes) {
    if (!byId.has(note.id)) byId.set(note.id, note);
    pathsById.set(note.id, [...(pathsById.get(note.id) ?? []), note.path]);
  }
  for (const note of input.notes) {
    const others = pathsById.get(note.id)!.filter((path) => path !== note.path);
    if (others.length > 0) add("error", "id-duplicate", note.path, lineOfKey(note, "id"), note.id, `${note.id} is also used by ${others.join(", ")}`);
  }
  const exists = caseSensitiveExists(input.root);

  for (const note of input.notes) {
    const a = note.attributes;
    const err = (rule: string, line: number, message: string) => add("error", rule, note.path, line, note.id, message);
    const warn = (rule: string, line: number, message: string) => add("warning", rule, note.path, line, note.id, message);

    // Shape
    const validate = note.type === "proposal" ? schemas.proposal : schemas.note;
    if (!validate(a)) {
      const firstKey = validate.errors?.find((error) => error.instancePath !== "")?.instancePath.split("/")[1];
      err("schema", firstKey === undefined ? 1 : lineOfKey(note, firstKey), describeErrors(validate.errors).join("; "));
    }
    if (!ID.test(note.id)) err("id-format", lineOfKey(note, "id"), `"${note.id}" is not <prefix>-<8 chars> with a schema prefix`);
    const folder = FOLDERS[note.type];
    if (folder !== undefined && !folder.test(note.path)) err("wrong-folder", 1, `a ${note.type} must live in its folder (spec/schema.md §2)`);
    const known = schemas.knownKeys(note.type);
    if (known !== undefined) {
      for (const key of Object.keys(a)) if (!known.has(key)) warn("unknown-key", lineOfKey(note, key), `${note.type} does not declare "${key}"`);
    }

    // References and links
    const references: Array<[string, unknown]> = Object.entries(a).filter(([key]) => REFERENCE_KEYS.has(key));
    for (const relation of list(a.relations)) references.push(["relations", record(relation).target]);
    for (const entry of list(a.timeline)) references.push(["timeline", record(entry).source]);
    for (const [key, value] of references) {
      for (const ref of collectIds(value)) {
        if (!byId.has(ref)) err("missing-ref", lineOfKey(note, key), `${key} references ${ref}, which does not exist`);
      }
    }
    const bodyStart = bodyLineOffset(note);
    for (const [index, raw] of proseLines(note.body)) {
      const line = bodyStart + index;
      if (raw.includes("[[")) err("wikilink", line, "use a relative Markdown link, not [[wikilinks]] (0002)");
      for (const match of raw.matchAll(/\^\[([^\]]*)\]/g)) {
        if (match[1] !== "inferred" && match[1] !== "ambiguous") err("unknown-marker", line, `^[${match[1]}] is not a provenance marker (0004)`);
      }
      for (const target of linkTargets(raw)) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue;
        const resolved = posix.normalize(posix.join(posix.dirname(note.path), decodePath(target.split("#")[0]!)));
        if (resolved.startsWith("../") || !exists(resolved)) err("broken-link", line, `link target ${target} does not exist`);
      }
      const prose = raw.replace(/\]\([^)]*\)/g, "]");
      if (UNDATED.has(note.type) && FRESHNESS_WORDS.test(prose) && !HAS_DATE.test(prose)) {
        warn("freshness", line, `"${prose.match(FRESHNESS_WORDS)![0]}" in an undated note without a date; write (as of YYYY-MM-DD) (0011)`);
      }
    }

    // Type rules
    if (note.type === "source") {
      const hash = `sha256:${createHash("sha256").update(note.body, "utf8").digest("hex")}`;
      if (a.content_hash !== hash) err("source-hash", lineOfKey(note, "content_hash"), "the body no longer matches content_hash; sources are immutable");
    }
    for (const source of list(a.sources)) {
      if (typeof source === "string" && byId.get(source)?.type === "view") err("view-cited", lineOfKey(note, "sources"), `${source} is a derived view and can't be evidence`);
    }
    const facts = record(a.facts);
    for (const [key, value] of Object.entries(facts)) {
      const entries = list(a.timeline).map(record).filter((entry) => entry.field === key);
      const accepted = entries.some((entry) => entry.assessment === "accepted" && entry.value === value);
      // Unless contested (schema §5): when the latest entry is contested, facts may keep the earlier value.
      const contested = entries.at(-1)?.assessment === "contested" && entries.some((entry) => entry.value === value);
      if (!accepted && !contested) err("fact-timeline", lineOfKey(note, "facts"), `facts.${key} has no accepted timeline entry with value ${JSON.stringify(value)}`);
    }
    for (const relation of list(a.relations)) {
      const { type, target } = record(relation);
      const inverse = type === "supersedes" ? "superseded_by" : type === "superseded_by" ? "supersedes" : undefined;
      if (inverse === undefined || typeof target !== "string" || !byId.has(target)) continue;
      const paired = list(byId.get(target)!.attributes.relations).some((other) => record(other).type === inverse && record(other).target === note.id);
      if (!paired) err("supersession-pair", lineOfKey(note, "relations"), `${type} ${target}, but ${target} has no ${inverse} ${note.id}`);
    }
    for (const [field, list_, label] of [["decided_in", "decisions", "decision"], ["raised_in", "questions", "question"]] as const) {
      const meeting = typeof a[field] === "string" ? byId.get(a[field] as string) : undefined;
      if (meeting !== undefined && !list(meeting.attributes[list_]).includes(note.id)) {
        err("meeting-backref", lineOfKey(note, field), `${field} ${meeting.id}, but that meeting's ${list_} does not list this ${label}`);
      }
    }
    if (note.type === "meeting") {
      for (const [list_, field] of [["decisions", "decided_in"], ["questions", "raised_in"]] as const) {
        for (const ref of list(a[list_])) {
          const other = typeof ref === "string" ? byId.get(ref) : undefined;
          if (other !== undefined && other.attributes[field] !== note.id) {
            err("meeting-backref", lineOfKey(note, list_), `${list_} lists ${ref}, whose ${field} is not this meeting`);
          }
        }
      }
    }
    if (note.type === "decision") {
      if (a.assessment === "superseded" && a.valid_until === undefined) err("superseded-valid-until", lineOfKey(note, "assessment"), "a superseded decision needs valid_until");
      if (a.assessment === "superseded" && !list(a.relations).some((relation) => record(relation).type === "superseded_by")) {
        err("superseded-unlinked", lineOfKey(note, "assessment"), "a superseded decision needs a superseded_by relation (0005)");
      }
      if (list(a.sources).length === 0) err("decision-sources", lineOfKey(note, "sources"), "a decision needs sources (0005)");
    }
    if (note.type === "memory") {
      const reach = MEMORY_REACH[String(a.scope)];
      const present = ["areas", "projects", "stacks"].filter((key) => a[key] !== undefined);
      if (reach === undefined) {
        err("memory-scope", lineOfKey(note, "scope"), `scope ${String(a.scope)} is not general, area, project or stack (0009)`);
      } else if (reach === null ? present.length > 0 : present.length !== 1 || present[0] !== reach || list(a[reach]).length === 0) {
        err("memory-scope", lineOfKey(note, "scope"), `scope ${String(a.scope)} must have ${reach === null ? "no reach lists" : `only a non-empty ${reach}`} (0009)`);
      }
    }
    if (note.type === "proposal") {
      const problem = proposalStatusProblem(a);
      if (problem !== null) err("proposal-status", lineOfKey(note, "status"), problem);
    }

    // Quality warnings
    if (KNOWLEDGE.has(note.type)) {
      if (typeof a.summary === "string" && a.summary.length > 200) warn("summary-length", lineOfKey(note, "summary"), `summary is ${a.summary.length} characters; aim for 200`);
      if (!["area", "goal", "project", "decision"].includes(note.type) && list(a.sources).length === 0) {
        warn("no-sources", 1, "knowledge without sources can't be traced");
      }
    }
  }

  if (input.indexMarkdown !== buildIndex(input.notes).markdown) {
    add("warning", "index-stale", "index.md", 1, null, "index.md is out of date; run brain index");
  }

  return issues.sort((x, y) =>
    compareCodePoints(x.path, y.path) || x.line - y.line || compareCodePoints(x.rule, y.rule) || compareCodePoints(x.message, y.message));
}

/** Status/decision agreement (spec/schema.md §11.1). */
function proposalStatusProblem(a: Record<string, unknown>): string | null {
  const status = a.status;
  const action = record(a.decision).action;
  const stale = a.closed_reason === "stale";
  if (a.closed_reason !== undefined && status !== "closed") return "closed_reason is only allowed on a closed proposal";
  const expected: Record<string, unknown[]> = {
    pending: [undefined],
    approved: ["approve"],
    edited: ["edit"],
    rejected: ["reject"],
    applied: ["approve", "edit"],
    closed: stale ? ["approve", "edit"] : ["reject"],
  };
  const allowed = expected[String(status)];
  if (allowed === undefined) return null; // the schema reports unknown statuses
  if (!allowed.includes(action)) {
    return `status ${String(status)}${stale ? " (stale)" : ""} needs decision ${allowed.map((value) => value ?? "absent").join(" or ")}, found ${action === undefined ? "none" : String(action)}`;
  }
  return null;
}

function collectIds(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    if (ID.test(value)) out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectIds(item, out);
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) collectIds(item, out);
  }
  return out;
}

/** Body lines outside fenced code blocks, with inline code removed: [index, text]. */
function proseLines(body: string): Array<[number, string]> {
  const out: Array<[number, string]> = [];
  let fence: string | null = null;
  body.split("\n").forEach((line, index) => {
    const marker = /^\s*(```|~~~)/.exec(line)?.[1];
    if (marker !== undefined) {
      fence = fence === null ? marker : fence === marker ? null : fence;
      return;
    }
    if (fence === null) out.push([index, line.replace(/`[^`]*`/g, "")]);
  });
  return out;
}

/** Targets of inline links (`[x](t)`, `[x](t "title")`, `[x](<t>)`) and reference definitions (`[x]: t`). */
function linkTargets(line: string): string[] {
  const targets: string[] = [];
  for (const match of line.matchAll(/\]\(\s*(?:<([^>]*)>|([^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g)) {
    targets.push(match[1] ?? match[2]!);
  }
  const definition = /^\s{0,3}\[[^\]]+\]:\s*(?:<([^>]*)>|(\S+))/.exec(line);
  if (definition !== null) targets.push(definition[1] ?? definition[2]!);
  return targets;
}

/** Percent-decode each path segment; a segment that is not valid encoding is kept as written. */
function decodePath(path: string): string {
  return path.split("/").map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  }).join("/");
}

/** File existence with exact case on every segment, so macOS and Linux agree. */
function caseSensitiveExists(root: string): (relative: string) => boolean {
  const listings = new Map<string, Set<string> | null>();
  const entries = (dir: string): Set<string> | null => {
    if (!listings.has(dir)) {
      try {
        listings.set(dir, new Set(readdirSync(`${root}/${dir}`)));
      } catch {
        listings.set(dir, null);
      }
    }
    return listings.get(dir)!;
  };
  return (relative) => {
    const parts = relative.split("/").filter((part) => part !== "" && part !== ".");
    let dir = "";
    for (const part of parts) {
      if (!entries(dir === "" ? "." : dir)?.has(part)) return false;
      dir = dir === "" ? part : `${dir}/${part}`;
    }
    return parts.length > 0;
  };
}

/** 1-based line of a top-level frontmatter key, or 1. */
function lineOfKey(note: Note, key: string): number {
  const lines = note.raw.split("\n");
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line === "---" || line === "---\r") break;
    if (line.startsWith(`${key}:`)) return index + 1;
  }
  return 1;
}

/** 1-based line number of the first body line. */
function bodyLineOffset(note: Note): number {
  const head = note.raw.slice(0, note.raw.length - note.body.length);
  return head.split("\n").length;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
