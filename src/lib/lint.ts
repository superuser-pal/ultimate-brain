import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, posix } from "node:path";
import { installedProduct } from "./skills.ts";

import { buildIndex } from "./index-builder.ts";
import { compareCodePoints, type Note, type ScanProblem } from "./notes.ts";
import { rangesProblem, splitParts } from "./parts.ts";
import { sourceFolder } from "./paths.ts";
import { describeErrors, loadSchemas } from "./schemas.ts";
import { deriveView, generatedBlockRange, type ViewKind } from "./views.ts";

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
  /** Current index.md bytes, or null when missing. Undefined skips the index-stale check. */
  indexMarkdown: string | null | undefined;
  /** Files that exist in memory but not yet on disk (a write being validated, spec/cli.md §3.6.1). */
  pendingPaths?: ReadonlySet<string>;
  /** Product-owned paths as an upgrade would leave them; undefined reads disk. */
  plannedProductFiles?: ReadonlyMap<string, string | null>;
}

const ID = /^(area|gol|prj|per|org|mtg|dec|que|con|ref|src|mem|prp|vw)-[0-9abcdefghjkmnpqrstvwxyz]{8}$/;
/** Frontmatter keys whose values are references (spec/schema.md §3–§11); `relations` and `timeline` are handled by shape. */
const REFERENCE_KEYS = new Set([
  "area", "goal", "client", "org", "projects", "people", "attendees", "decided_in", "raised_in", "deciders",
  "source", "sources", "decisions", "questions", "answer", "target", "supersedes", "merge_into", "project",
  "generated_from", "facts", "notes", "answer_note", "links", "attached_to", "changes", "replaces", "deferred_from",
]);

/** Where each kind of view must live (spec/schema.md §2, 0041, 0043). */
const VIEW_FOLDERS: Readonly<Record<string, RegExp>> = {
  area_brief: /^areas\/briefs\/[^/]+\.md$/,
  report: /^reports\/\d{4}-\d{2}-\d{2}-[^/]+\.md$/,
};

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
  reference: /^knowledge\/references\/[^/]+\.md$/,
  source: /^sources\/(notion|files|text)\/\d{4}-\d{2}-\d{2}-[^/]+\.md$/,
  memory: /^memories\/\d{4}\/\d{2}\/\d{4}-\d{2}-\d{2}-[^/]+\.md$/,
  proposal: /^_proposals\/[^/]+\.md$/,
};

const KNOWLEDGE = new Set(["area", "goal", "project", "person", "org", "meeting", "decision", "question", "concept", "reference", "memory"]);
const UNDATED = new Set(["area", "goal", "project", "person", "org", "question", "concept", "reference"]);
const FRESHNESS_WORDS = /\b(currently|now|at the moment|this week|recently|soon)\b/i;
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
  // Every review_notes proposal listing each note id (rule review-notes, 0041).
  const reviewedBy = new Map<string, string[]>();
  for (const note of input.notes) {
    if (note.type !== "proposal" || note.attributes.kind !== "review_notes") continue;
    for (const id of new Set(list(note.attributes.notes).map(String))) reviewedBy.set(id, [...(reviewedBy.get(id) ?? []), note.id]);
  }
  // Every source replacing each source id (rule source-replaces, 0045).
  const replacedBy = new Map<string, string[]>();
  for (const note of input.notes) {
    if (note.type === "source" && typeof note.attributes.replaces === "string") replacedBy.set(note.attributes.replaces, [...(replacedBy.get(note.attributes.replaces) ?? []), note.id]);
  }
  const onDisk = caseSensitiveExists(input.root);
  const exists = (path: string) => input.pendingPaths?.has(path) === true || onDisk(path);

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
    const folder = note.type === "view" ? VIEW_FOLDERS[String(a.view_kind)] ?? FOLDERS.view : FOLDERS[note.type];
    const correctFolder = note.type === "source"
      ? new RegExp(`^sources/${sourceFolder(a.source_key)}/\\d{4}-\\d{2}-\\d{2}-[^/]+\\.md$`)
      : folder;
    if (correctFolder !== undefined && !correctFolder.test(note.path)) err("wrong-folder", 1, `a ${note.type} must live in its folder (spec/schema.md §2)`);
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
        const resolved = posix.normalize(posix.join(posix.dirname(note.path), decodePath(target.split(/[?#]/)[0]!)));
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
    if (note.type === "view" && (a.view_kind === "brief" || a.view_kind === "decision_log" || a.view_kind === "area_brief")) {
      const project = byId.get(String(a.view_kind === "area_brief" ? a.area : a.project));
      const range = generatedBlockRange(note.body);
      if (project?.type === (a.view_kind === "area_brief" ? "area" : "project") && range !== undefined) {
        const derived = deriveView(project, a.view_kind as ViewKind, input.notes);
        const generatedFrom = Array.isArray(a.generated_from) ? a.generated_from : [];
        if (note.body.slice(range.start, range.end) !== derived.generatedBlock || !sameStringList(generatedFrom, derived.generatedFrom)) {
          warn("view-stale", 1, "generated block is out of date; run brain views");
        }
      }
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
    if (note.type === "proposal" && a.kind === "review_notes") {
      for (const id of list(a.notes)) {
        const listed = byId.get(String(id));
        if (listed !== undefined && !KNOWLEDGE.has(listed.type)) err("review-notes", lineOfKey(note, "notes"), `${String(id)} is a ${listed.type}, not a knowledge note`);
        // A deferred row lists again the notes the row it came from excluded (0045).
        const others = (reviewedBy.get(String(id)) ?? []).filter((other) => other !== note.id && !deferredPair(note, byId.get(other), String(id)));
        if (others.length > 0) err("review-notes", lineOfKey(note, "notes"), `${String(id)} is also listed by ${others.join(", ")}`);
      }
    }
    if (note.type === "proposal") {
      const bodies = [...(a.kind === "update_body" ? [a.target] : []), ...list(a.changes).map(record).filter((change) => change.kind === "update_body").map((change) => change.target)];
      for (const target of bodies) {
        const reference = typeof target === "string" ? byId.get(target) : undefined;
        if (reference !== undefined && reference.type !== "reference") err("update-body", lineOfKey(note, a.kind === "update_body" ? "target" : "changes"), `update_body targets ${reference.id}, a ${reference.type}; only a reference has its body replaced (0045)`);
      }
    }
    if (note.type === "source" && typeof a.replaces === "string") {
      const replaced = byId.get(a.replaces);
      if (replaced !== undefined && replaced.type !== "source") err("source-replaces", lineOfKey(note, "replaces"), `replaces ${a.replaces}, a ${replaced.type}, not a source`);
      const others = (replacedBy.get(a.replaces) ?? []).filter((other) => other !== note.id);
      if (others.length > 0) err("source-replaces", lineOfKey(note, "replaces"), `${a.replaces} is also replaced by ${others.join(", ")}`);
    }
    if (note.type === "source" && Array.isArray(a.notion_parts)) {
      const problem = rangesProblem(a.notion_parts, splitParts(note.body).parts.length);
      if (problem !== null) err("notion-parts", lineOfKey(note, "notion_parts"), problem);
    }

    // Quality warnings
    if (KNOWLEDGE.has(note.type)) {
      if (typeof a.summary === "string" && a.summary.length > 200) warn("summary-length", lineOfKey(note, "summary"), `summary is ${a.summary.length} characters; aim for 200`);
      if (!["area", "goal", "project", "decision"].includes(note.type) && list(a.sources).length === 0) {
        warn("no-sources", 1, "knowledge without sources can't be traced");
      }
    }
  }

  if (input.indexMarkdown !== undefined && input.indexMarkdown !== buildIndex(input.notes).markdown) {
    add("warning", "index-stale", "index.md", 1, null, "index.md is out of date; run brain index");
  }

  lintProductFiles(input.root, add, input.plannedProductFiles);
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
    edited: ["fix", "edit"],
    rejected: ["reject"],
    applied: ["approve", "fix", "edit"],
    closed: stale ? ["approve", "fix", "edit"] : ["reject"],
  };
  const allowed = expected[String(status)];
  if (allowed === undefined) return null; // the schema reports unknown statuses
  if (!allowed.includes(action)) {
    return `status ${String(status)}${stale ? " (stale)" : ""} needs decision ${allowed.map((value) => value ?? "absent").join(" or ")}, found ${action === undefined ? "none" : String(action)}`;
  }
  return null;
}

/** A deferred row and the row whose excluded note it took over (spec/schema.md §15, 0045). */
function deferredPair(note: Note, other: Note | undefined, id: string): boolean {
  if (other === undefined) return false;
  const excluded = (proposal: Note) => list(record(proposal.attributes.decision).exclude).some((entry) => record(entry).note === id);
  return (note.attributes.deferred_from === other.id && excluded(other)) || (other.attributes.deferred_from === note.id && excluded(note));
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

function sameStringList(left: unknown[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function lintProductFiles(root: string, add: (severity: Severity, rule: string, path: string, line: number, id: string | null, message: string) => void, planned?: ReadonlyMap<string, string | null>): void {
  let product;
  try { product = installedProduct(); } catch (error) { add("error", "product-file", "AGENTS.md", 1, null, `installed package not found: ${String(error)}`); return; }
  const message = `product files differ from ultimate-brain ${product.version}; run brain upgrade, or file a finding`;
  const skills = join(product.root, ".agents/skills"); const template = join(product.root, "templates/brain/AGENTS.md");
  if (!existsSync(skills) || !existsSync(template)) { add("error", "product-file", "AGENTS.md", 1, null, "installed package not found: missing product files"); return; }
  const block = /<!-- ultimate-brain:rules:start\b[^>]*-->[\s\S]*?<!-- ultimate-brain:rules:end -->/.exec(readFileSync(template, "utf8"))?.[0];
  const agents = planned?.get("AGENTS.md") ?? (existsSync(join(root, "AGENTS.md")) ? readFileSync(join(root, "AGENTS.md"), "utf8") : null);
  const actual = agents?.match(/<!-- ultimate-brain:rules:start\b[^>]*-->[\s\S]*?<!-- ultimate-brain:rules:end -->/g) ?? null;
  if (block === undefined || actual?.length !== 1 || actual[0] !== block) add("error", "product-file", "AGENTS.md", 1, null, message);
  for (const prefix of [".agents/skills", ".claude/skills"]) for (const skill of readdirSync(skills, { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync(join(skills, entry.name, "SKILL.md")))) {
    const target = join(root, prefix, skill.name);
    if (!existsSync(target)) { add("error", "product-file", `${prefix}/${skill.name}`, 1, null, message); continue; }
    const expected = productFiles(join(skills, skill.name));
    const actual = productFiles(target).filter((file) => planned?.get(`${prefix}/${skill.name}/${file}`) !== null);
    for (const file of expected) {
      const path = `${prefix}/${skill.name}/${file}`;
      const bytes = planned?.has(path) ? planned.get(path) ?? null : existsSync(join(target, file)) ? readFileSync(join(target, file), "utf8") : null;
      if (bytes === null || Buffer.from(bytes).compare(readFileSync(join(skills, skill.name, file))) !== 0) add("error", "product-file", path, 1, null, message);
    }
    for (const file of actual) if (!expected.includes(file)) add("error", "product-file", `${prefix}/${skill.name}/${file}`, 1, null, message);
  }
}

function productFiles(folder: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.isDirectory()) for (const nested of productFiles(join(folder, entry.name))) out.push(`${entry.name}/${nested}`);
    else if (entry.isFile()) out.push(entry.name);
  }
  return out.sort();
}
