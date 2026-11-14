import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import { installedProduct, SUB_AGENT } from "./skills.ts";
import { competingCopies, competingMessage } from "./skills-competing.ts";
import { checkedNames, incompatibleMessage, LOCK, pinState, skillDrift, type Lock, type Pin } from "./skills-pin.ts";
import { comparePrecedence, satisfies } from "./skills-range.ts";
import { packageSnapshot, type Manifest } from "./skills-snapshot.ts";

import { buildIndex } from "./index-builder.ts";
import { typeIsOn } from "./modules.ts";
import { planStructureText, structureBlock, structureStale } from "./structure.ts";
import { compareCodePoints, type Note, type ScanProblem } from "./notes.ts";
import { rangesProblem, splitParts } from "./parts.ts";
import { sourceFolder } from "./paths.ts";
import { extractPassages, PASSAGE_REF, passageHash } from "./selection.ts";
import { lineageOf } from "./eligibility.ts";
import { reportLinks } from "./report-body.ts";
import { DISMISSALS_PATH, readDismissals } from "./assistant-dismissals.ts";
import { contextFor, eligibleNotes, indexNotes, loadSuppressions, restrictionOf } from "./suppressions.ts";
import { describeErrors, loadSchemas } from "./schemas.ts";
import { deriveView, generatedBlockRange, type ViewKind } from "./views.ts";
import { workflowRecordProblems } from "./workflow-store.ts";
import { decodePath, linkTargets } from "./lint-links.ts";
import { fingerprintProblem, heldFingerprints, holdsWholeText, mergeFingerprint, nearDuplicatePairs, reflectionNotes } from "./reflect.ts";

export type Severity = "error" | "warning" | "info";

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
  /** Current AGENTS.md bytes (null: missing or a symbolic link) for the structure block's index-stale check (cli §5.8.1); undefined skips it. */
  agentsMarkdown?: string | null;
  /** Files that exist in memory but not yet on disk (a write being validated, spec/cli.md §3.6.1). */
  pendingPaths?: ReadonlySet<string>;
  /** Product-owned paths as an upgrade would leave them; undefined reads disk. */
  plannedProductFiles?: ReadonlyMap<string, string | null>;
  /** The skill pin as a write leaves it (upgrade); undefined reads `skills.lock.json` (spec/skills-delivery.md §6.4). */
  skillsLock?: Lock;
  /** `HOME` for the global competing-copy checks (§5.2); undefined skips them. */
  home?: string;
}

const ID = /^(area|dom|gol|prj|per|org|mtg|dec|que|con|ref|src|mem|prp|vw)-[0-9abcdefghjkmnpqrstvwxyz]{8}$/;
/** Frontmatter keys whose values are references (spec/schema.md §3–§11); `relations` and `timeline` are handled by shape. */
const REFERENCE_KEYS = new Set([
  "domain", "area", "goal", "client", "org", "projects", "people", "attendees", "decided_in", "raised_in", "deciders",
  "source", "sources", "decisions", "questions", "answer", "target", "supersedes", "merge_into", "project",
  "generated_from", "facts", "notes", "answer_note", "links", "attached_to", "changes", "replaces", "deferred_from", "promoted_from",
]);

/** Where each kind of view must live (spec/schema.md §2, 0041, 0043). */
const VIEW_FOLDERS: Readonly<Record<string, RegExp>> = {
  area_brief: /^areas\/briefs\/[^/]+\.md$/,
  report: /^reports\/\d{4}-\d{2}-\d{2}-[^/]+\.md$/,
};

/** Where each type must live (spec/schema.md §2). */
const FOLDERS: Readonly<Record<string, RegExp>> = {
  domain: /^domains\/[^/]+\.md$/,
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

const KNOWLEDGE = new Set(["domain", "area", "goal", "project", "person", "org", "meeting", "decision", "question", "concept", "reference", "memory"]);
const UNDATED = new Set(["domain", "area", "goal", "project", "person", "org", "question", "concept", "reference"]);
const FRESHNESS_WORDS = /\b(currently|now|at the moment|this week|recently|soon)\b/i;
const HAS_DATE = /\b\d{4}-\d{2}(-\d{2})?\b/;
const MEMORY_REACH: Readonly<Record<string, string | null>> = { general: null, area: "areas", project: "projects", stack: "stacks" };

/** Run every lint rule of spec/cli.md §5.10 over the brain. Issues are sorted by path, line, rule, message. */
export function lintBrain(input: LintInput): Issue[] {
  const schemas = loadSchemas();
  const issues: Issue[] = [];
  const add = (severity: Severity, rule: string, path: string, line: number, id: string | null, message: string) =>
    issues.push({ severity, rule, path, line, id, message });

  for (const message of loadSuppressions(input.root).problems) add("error", "suppression-record", "_suppressions", 1, null, message);
  for (const message of readDismissals(input.root).problems) add("error", "assistant-dismissals", DISMISSALS_PATH, 1, null, message);
  for (const problem of workflowRecordProblems(input.root)) add("error", "workflow-record", problem.path, 1, null, `${problem.path} ${problem.message}`);
  for (const problem of input.problems) {
    if (problem.code === "NOT_A_NOTE") add("error", "not-a-note", problem.path, 1, null, problem.message);
    if (problem.code === "UNPARSEABLE" || problem.code === "UNREADABLE") add("error", "unparseable", problem.path, 1, null, problem.message);
  }

  if (!schemas.brain(input.brainConfig)) {
    add("error", "brain-config", "brain.json", 1, null, describeErrors(schemas.brain.errors).join("; "));
  }

  let lineageContext: ReturnType<typeof contextFor> | undefined;
  let reportContext: ReturnType<typeof contextFor> | undefined;
  let viewNotes: Note[] | undefined; // the notes a view may render once suppressions apply (capture-and-review §5.1)
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

    if (note.type === "area" && typeof a.domain === "string" && byId.has(a.domain) && byId.get(a.domain)?.type !== "domain") err("domain-type", lineOfKey(note, "domain"), `${a.domain} is not a Domain`);
    if (note.type === "area" && typeof a.domain === "string") {
      const domain = byId.get(a.domain);
      const fields = domain?.attributes.notion_fields;
      if (domain?.type === "domain" && (domain.attributes.lifecycle === "archived" || record(fields).archived === true)) add("info", "DOMAIN_ARCHIVED", note.path, lineOfKey(note, "domain"), note.id, `${a.domain} is archived`);
    }
    if (note.type === "domain" && typeof a.org === "string" && byId.has(a.org) && byId.get(a.org)?.type !== "org") err("org-type", lineOfKey(note, "org"), `${a.org} is not an Org`);
    if (note.type === "reference" && typeof a.area === "string") {
      const ownDomain = byId.get(a.area)?.attributes.domain;
      for (const id of list(a.projects)) {
        const projectArea = byId.get(String(id))?.attributes.area;
        const projectDomain = byId.get(String(projectArea))?.attributes.domain;
        if (ownDomain !== projectDomain && (ownDomain !== undefined || projectDomain !== undefined)) add("info", "DOCUMENT_DOMAIN_MISMATCH", note.path, lineOfKey(note, "area"), note.id, `Document Area and Project ${String(id)} have different Domains`);
      }
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
    // A source and a whole Document are someone else's text, kept as it is: 0002's checks judge only what the brain writes (0091).
    const keptText = note.type === "source" || (note.type === "reference" && a.origin === "whole");
    for (const [index, raw] of proseLines(note.body)) {
      const line = bodyStart + index;
      if (!keptText && raw.includes("[[")) err("wikilink", line, "use a relative Markdown link, not [[wikilinks]] (0002)");
      if (!keptText) for (const match of raw.matchAll(/\^\[([^\]]*)\]/g)) {
        // `^[src-…#¶n:hash]` is the passage reference of a claim written from an extract (0055, capture-and-review §5.1).
        if (match[1] !== "inferred" && match[1] !== "ambiguous" && !/^src-[0-9a-z]{8}#¶\d+:[0-9a-f]{8}$/.test(match[1] ?? "")) err("unknown-marker", line, `^[${match[1]}] is not a provenance marker (0004)`);
      }
      if (!keptText) for (const target of linkTargets(raw)) {
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
    if (note.type === "concept") err("concept-retired", lineOfKey(note, "type"), "concepts are learned Documents since 0.9.1; run brain upgrade (0071)");
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
        viewNotes ??= eligibleNotes(input.notes, loadSuppressions(input.root));
        const config = typeof input.brainConfig === "object" && input.brainConfig !== null ? input.brainConfig as Record<string, unknown> : {};
        const derived = deriveView(project, a.view_kind as ViewKind, viewNotes, { documents: typeIsOn(config, "reference") });
        const generatedFrom = Array.isArray(a.generated_from) ? a.generated_from : [];
        if (note.body.slice(range.start, range.end) !== derived.generatedBlock || !sameStringList(generatedFrom, derived.generatedFrom)) {
          warn("view-stale", 1, "generated block is out of date; run brain views");
        }
      }
    }
    if (note.type === "view" && a.view_kind === "report") {
      // A line that links a note a suppression restricts rests on excluded evidence: flagged, never edited by the brain (capture-and-review §5.1).
      reportContext ??= contextFor(input.notes, loadSuppressions(input.root));
      const bodyStart = note.raw.split(/\r?\n/).length - note.body.split(/\r?\n/).length;
      note.body.split(/\r?\n/).forEach((text, index) => {
        for (const id of reportLinks({ notes: input.notes }, text, true).linked) {
          const target = byId.get(id);
          const restriction = target === undefined ? undefined : restrictionOf(target, reportContext!);
          if (restriction !== undefined && (restriction.whole || restriction.lines.size > 0 || restriction.timeline.size > 0 || restriction.facts.size > 0)) warn("report-source-excluded", bodyStart + index + 1, `(source excluded): this line links ${id}, which rests on content you excluded; the next refresh leaves it out`);
        }
      });
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
        const others = (reviewedBy.get(String(id)) ?? []).filter((other) => other !== note.id && !deferredPair(note, byId.get(other), String(id), byId));
        if (others.length > 0) err("review-notes", lineOfKey(note, "notes"), `${String(id)} is also listed by ${others.join(", ")}`);
      }
    }
    if (note.type === "proposal") {
      const bodies = [...(a.kind === "update_body" ? [a.target] : []), ...list(a.changes).map(record).filter((change) => change.kind === "update_body").map((change) => change.target)];
      for (const target of bodies) {
        const reference = typeof target === "string" ? byId.get(target) : undefined;
        if (reference !== undefined && reference.type !== "reference") err("update-body", lineOfKey(note, a.kind === "update_body" ? "target" : "changes"), `update_body targets ${reference.id}, a ${reference.type}; only a reference has its body replaced (0045)`);
        if (reference?.type === "reference" && reference.attributes.origin === "promoted") err("update-body", lineOfKey(note, a.kind === "update_body" ? "target" : "changes"), `update_body targets ${reference.id}, a promoted Document, whose body is yours (0049)`);
      }
    }
    if (note.type === "proposal" && a.item_decisions !== undefined && !Array.isArray(a.items)) err("proposal-items", lineOfKey(note, "item_decisions"), "item_decisions without items: a decision needs an item to name");
    if (note.type === "proposal" && Array.isArray(a.items)) {
      // The items of a review_notes: one immutable id per note, link and change, each resolving (capture-and-review §7.2).
      const notes = list(a.notes).map(String), links = list(a.links), changes = list(a.changes);
      const isRecord2 = (value: unknown): boolean => typeof value === "object" && value !== null && !Array.isArray(value);
      const seenIds = new Set<string>(), covered = new Set<string>();
      for (const entry of list(a.items) as Array<{ item_id?: string; kind?: string; ref?: unknown }>) {
        if (typeof entry.item_id !== "string" || seenIds.has(entry.item_id)) err("proposal-items", lineOfKey(note, "items"), `item id ${String(entry.item_id)} is missing or used twice`);
        else seenIds.add(entry.item_id);
        // A grouped link item (0.15.0, schema §11) covers each of its indexes; they share one target and field.
        if (entry.kind === "link" && Array.isArray(entry.ref)) {
          const refs = entry.ref as unknown[];
          const members = refs.map((ref) => (Number.isInteger(ref) ? links[ref as number] : undefined));
          const first = members[0] as Record<string, unknown> | undefined;
          if (refs.length === 0 || members.some((member) => member === undefined || !isRecord2(member) || (member as Record<string, unknown>).target !== first?.target || (member as Record<string, unknown>).field !== first?.field)) err("proposal-items", lineOfKey(note, "items"), `item ${String(entry.item_id)} groups links that are missing or don't share one target and field`);
          for (const ref of refs) { const key = `link:${String(ref)}`; if (covered.has(key)) err("proposal-items", lineOfKey(note, "items"), `${key} has two items`); covered.add(key); }
          continue;
        }
        const key = `${entry.kind}:${String(entry.ref)}${entry.kind === "restore" ? `:${String((entry as { n?: unknown }).n)}` : ""}`;
        const resolves = ["remove", "restore", "independence"].includes(String(entry.kind)) ? isRecord2(a.cleanup) && byId.get(String(entry.ref)) !== undefined : entry.kind === "note" ? notes.includes(String(entry.ref)) : entry.kind === "link" ? Number.isInteger(entry.ref) && (entry.ref as number) < links.length : entry.kind === "change" && Number.isInteger(entry.ref) && (entry.ref as number) < changes.length;
        if (!resolves) err("proposal-items", lineOfKey(note, "items"), `item ${String(entry.item_id)} refers to ${key}, which this proposal does not hold`);
        if (covered.has(key)) err("proposal-items", lineOfKey(note, "items"), `${key} has two items`);
        covered.add(key);
      }
      const expected = [...notes.map((id) => `note:${id}`), ...links.map((_, index) => `link:${index}`), ...changes.map((_, index) => `change:${index}`)];
      for (const key of expected) if (!covered.has(key)) err("proposal-items", lineOfKey(note, "items"), `${key} has no item`);
      const decided = new Set<string>();
      for (const decision of list(a.item_decisions) as Array<{ item_id?: string }>) {
        if (typeof decision.item_id !== "string" || !seenIds.has(decision.item_id)) err("proposal-items", lineOfKey(note, "item_decisions"), `a decision names ${String(decision.item_id)}, which is not an item`);
        else if (decided.has(decision.item_id)) err("proposal-items", lineOfKey(note, "item_decisions"), `${decision.item_id} is decided twice`);
        else decided.add(decision.item_id);
      }
    }
    if (note.type === "reference" && typeof a.promoted_from === "string") {
      const from = byId.get(a.promoted_from);
      // A concept promoted before 0.9.1 is now a learned Document that kept its con- id (0071).
      const formerConcept = from !== undefined && from.id.startsWith("con-") && (from.type === "concept" || (from.type === "reference" && from.attributes.origin === "learned"));
      if (from !== undefined && from.type !== "decision" && !formerConcept) err("promoted-from", lineOfKey(note, "promoted_from"), `promoted_from names ${a.promoted_from}, a ${from.type}, not a decision (0049, 0071)`);
    }
    if (note.type === "source" && typeof a.replaces === "string") {
      const replaced = byId.get(a.replaces);
      if (replaced !== undefined && replaced.type !== "source") err("source-replaces", lineOfKey(note, "replaces"), `replaces ${a.replaces}, a ${replaced.type}, not a source`);
      const others = (replacedBy.get(a.replaces) ?? []).filter((other) => other !== note.id);
      if (others.length > 0) err("source-replaces", lineOfKey(note, "replaces"), `${a.replaces} is also replaced by ${others.join(", ")}`);
    }
    if (note.type === "source" && a.extract === true) {
      // The passages list and the body's markers agree, and each check hash matches its paragraph (capture-and-review §4.5).
      const found = extractPassages(note.body);
      const listed = list(a.passages) as { n?: number; hash?: string }[];
      if (found.map((entry) => entry.n).join() !== listed.map((entry) => entry.n).join()) err("extract-passages", lineOfKey(note, "passages"), "passages does not list the paragraphs of the body, in order");
      for (const entry of found) {
        const hash = listed.find((candidate) => candidate.n === entry.n)?.hash;
        if (hash !== undefined && hash !== passageHash(entry.text)) err("extract-passages", lineOfKey(note, "passages"), `¶${entry.n} no longer matches its hash; extracts are immutable`);
      }
    }
    if (note.type !== "source" && note.type !== "proposal" && note.type !== "view") {
      // A source whose input cannot be determined (a meeting with no source, a source chain with no key) is a data defect:
      // it is never live while any suppression is active (capture-and-review §5.1).
      lineageContext ??= contextFor(input.notes, { suppressions: [] });
      for (const id of list(a.sources).map(String)) {
        const cited = byId.get(id);
        if ((cited?.type === "source" || cited?.type === "meeting") && lineageOf(id, lineageContext.sources) === null) warn("unknown-lineage", lineOfKey(note, "sources"), `${id} has no determinable input (no source_key, extract_of or source)`);
      }
    }
    if (note.type !== "source" && note.type !== "proposal") {
      // A passage reference names an existing extract passage with the right hash; a note citing an extract carries one (§5.1).
      const cited = new Set<string>();
      for (const match of note.body.matchAll(PASSAGE_REF)) {
        const [, id, n, hash] = match;
        cited.add(id ?? "");
        const target = byId.get(id ?? "");
        if (target === undefined) continue; // a missing id is reported as missing-ref where it is declared
        const entry = target.attributes.extract === true ? list(target.attributes.passages).find((candidate) => (candidate as { n?: number }).n === Number(n)) as { hash?: string } | undefined : undefined;
        if (entry === undefined) err("passage-ref", 1, `${id}#¶${n} is not a passage of an extract`);
        else if (entry.hash !== hash) err("passage-ref", 1, `${id}#¶${n} has the hash ${entry.hash}, not ${hash}`);
      }
      for (const source of list(a.sources).map(String)) {
        if (byId.get(source)?.attributes.extract === true && !cited.has(source)) err("passage-ref", lineOfKey(note, "sources"), `${source} is an extract: cite its passages with ^[${source}#¶n:hash]`);
      }
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

  lintReflection(input, byId, add);

  if (input.indexMarkdown !== undefined && input.indexMarkdown !== buildIndex(indexNotes(input.notes, loadSuppressions(input.root))).markdown) {
    add("warning", "index-stale", "index.md", 1, null, "index.md is out of date; run brain index");
  }
  if (input.agentsMarkdown !== undefined) {
    const config = typeof input.brainConfig === "object" && input.brainConfig !== null ? input.brainConfig as Record<string, unknown> : {};
    const block = structureBlock(indexNotes(input.notes, loadSuppressions(input.root)), config);
    if (structureStale(planStructureText(input.agentsMarkdown, block))) {
      add("warning", "index-stale", "AGENTS.md", 1, null, "the structure block of AGENTS.md is out of date; run brain index");
    }
  }

  lintProductFiles(input, add);
  return issues.sort((x, y) =>
    compareCodePoints(x.path, y.path) || x.line - y.line || compareCodePoints(x.rule, y.rule) || compareCodePoints(x.message, y.message));
}

/** The reflection checks (spec/cli.md §5.10, 0052, 0076): proposal-fingerprint, orphan, note-size and near-duplicate. */
function lintReflection(input: LintInput, byId: ReadonlyMap<string, Note>, add: Add): void {
  const knowledge = input.notes.filter((note) => KNOWLEDGE.has(note.type));
  for (const note of input.notes) {
    if (note.type !== "proposal") continue;
    const problem = fingerprintProblem(note.attributes, (id) => byId.get(id));
    if (problem !== null) add("error", "proposal-fingerprint", note.path, lineOfKey(note, problem.key.split("/")[0]!), note.id, `${problem.message} (schema §11.4)`);
  }
  for (const note of knowledge) {
    if (holdsWholeText(note)) continue;
    const bytes = Buffer.byteLength(note.body, "utf8");
    if (bytes > 10_240) add("warning", "note-size", note.path, bodyLineOffset(note), note.id, `body is ${(bytes / 1024).toFixed(1)} KB, over 10 KB`);
  }
  // orphan: what other knowledge notes point at, by an id anywhere in their frontmatter or a body link to the file.
  const byPath = new Map(input.notes.map((note) => [note.path, note]));
  const pointedAt = new Set<string>();
  for (const note of knowledge) {
    for (const id of collectIds(Object.fromEntries(Object.entries(note.attributes).filter(([key]) => key !== "id")))) if (id !== note.id) pointedAt.add(id);
    for (const [, line] of proseLines(note.body)) {
      for (const target of linkTargets(line)) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue;
        const linked = byPath.get(posix.normalize(posix.join(posix.dirname(note.path), decodePath(target.split(/[?#]/)[0]!))));
        if (linked !== undefined && linked.id !== note.id) pointedAt.add(linked.id);
      }
    }
  }
  for (const note of knowledge) {
    if (note.attributes.lifecycle !== "reviewed" || ["domain", "area", "goal", "project", "meeting", "memory"].includes(note.type)) continue;
    const area = note.attributes.area;
    if ((typeof area === "string" && area !== "") || list(note.attributes.projects).length > 0 || pointedAt.has(note.id)) continue;
    add("warning", "orphan", note.path, 1, note.id, "nothing links to it and it has no project or area");
  }
  // near-duplicate: the near_duplicate signal of reflect --candidates, unless the pair's merge is held (waiting or skipped).
  const held = heldFingerprints(input.notes);
  const loaded = loadSuppressions(input.root);
  for (const pair of nearDuplicatePairs(reflectionNotes(input.notes, loaded))) {
    if (held.has(mergeFingerprint(pair.notes[0].id, pair.notes[1].id))) continue;
    const [first, other] = [...pair.notes].sort((a, b) => compareCodePoints(a.path, b.path)) as [Note, Note];
    add("warning", "near-duplicate", first.path, 1, first.id, `may be the same ${first.type} as "${String(other.attributes.title)}" (${other.path})`);
  }
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
function deferredPair(note: Note, other: Note | undefined, id: string, byId: ReadonlyMap<string, Note>): boolean {
  if (other === undefined) return false;
  // Left out of a 0045 approval ("all except c"), or deferred item by item (capture-and-review §7.6): the note moved to the proposal that came from it.
  const excluded = (proposal: Note, to: Note) => list(record(proposal.attributes.decision).exclude).some((entry) => record(entry).note === id)
    || list(proposal.attributes.item_decisions).map(record).some((decision) => decision.state === "deferred" && decision.deferred_to === to.id
      && list(proposal.attributes.items).map(record).some((item) => item.item_id === decision.item_id && item.kind === "note" && item.ref === id));
  // A note can be deferred again from the proposal it was deferred to: follow the chain, every hop having moved this note.
  const descends = (child: Note, ancestor: Note): boolean => {
    for (let current: Note = child, hops = 0; hops < 50; hops += 1) {
      const parent = typeof current.attributes.deferred_from === "string" ? byId.get(current.attributes.deferred_from) : undefined;
      if (parent === undefined || !excluded(parent, current)) return false;
      if (parent === ancestor) return true;
      current = parent;
    }
    return false;
  };
  return descends(note, other) || descends(other, note);
}

/** Every note id a note's frontmatter references, by the fields lint's `missing-ref` checks, plus `relations` targets and `timeline` sources (spec/cli.md §5.14.3). */
export function referencedIds(attributes: Record<string, unknown>): string[] {
  const values: unknown[] = Object.entries(attributes).filter(([key]) => REFERENCE_KEYS.has(key)).map(([, value]) => value);
  for (const relation of list(attributes.relations)) values.push(record(relation).target);
  for (const entry of list(attributes.timeline)) values.push(record(entry).source);
  return values.flatMap((value) => collectIds(value));
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

type Add = (severity: Severity, rule: string, path: string, line: number, id: string | null, message: string) => void;

function lintProductFiles(input: LintInput, add: Add): void {
  const { root, plannedProductFiles: planned } = input;
  let product;
  try { product = installedProduct(); } catch (error) { add("error", "product-file", "AGENTS.md", 1, null, `installed package not found: ${String(error)}`); return; }
  const message = `product files differ from ultimate-brain ${product.version}; run brain upgrade, or file a finding`;
  const template = join(product.root, "templates/brain/AGENTS.md");
  const agentTemplate = join(product.root, "templates/brain", SUB_AGENT);
  if (!existsSync(template) || !existsSync(agentTemplate)) { add("error", "product-file", "AGENTS.md", 1, null, "installed package not found: missing product files"); return; }
  const block = /<!-- ultimate-brain:rules:start\b[^>]*-->[\s\S]*?<!-- ultimate-brain:rules:end -->/.exec(readFileSync(template, "utf8"))?.[0];
  const agents = planned?.get("AGENTS.md") ?? (existsSync(join(root, "AGENTS.md")) ? readFileSync(join(root, "AGENTS.md"), "utf8") : null);
  const actual = agents?.match(/<!-- ultimate-brain:rules:start\b[^>]*-->[\s\S]*?<!-- ultimate-brain:rules:end -->/g) ?? null;
  if (block === undefined || actual?.length !== 1 || actual[0] !== block) add("error", "product-file", "AGENTS.md", 1, null, message);
  // The Ultimate Assistant sub-agent is product-owned as a whole file, always against the package (spec/assistant.md §10).
  const agent = planned?.has(SUB_AGENT) ? planned.get(SUB_AGENT)! : readRegularFile(join(root, SUB_AGENT));
  if (agent !== readFileSync(agentTemplate, "utf8")) add("error", "product-file", SUB_AGENT, 1, null, message);
  lintSkills(input, product, add);
}

function readRegularFile(path: string): string | null {
  try { return statSync(path).isFile() ? readFileSync(path, "utf8") : null; } catch { return null; }
}

/** Skill trees against the pin, or the package while unpinned, and the pin's own rules (spec/skills-delivery.md §6.4). */
function lintSkills(input: LintInput, product: { root: string; version: string }, add: Add): void {
  const { root, plannedProductFiles: planned } = input;
  const pkg = packageSnapshot(product.root, product.version);
  const pin: Pin = input.skillsLock === undefined
    ? pinState(root, () => product.version, { drift: false })
    : { state: satisfies(product.version, input.skillsLock.snapshot.cli) ? "pinned" : "incompatible", lock: input.skillsLock, reason: null, missing: null };
  let against: Manifest | null = null;
  if (pin.state === "invalid") add("error", "skills-lock", LOCK, 1, null, `${LOCK} is invalid (${pin.reason}); run brain upgrade to rewrite it`);
  else if (pin.state === "unpinned") {
    add("info", "skills-unpinned", LOCK, 1, null, "skills are not pinned; run brain upgrade to pin them");
    if (pkg.reason !== null) add("error", "product-file", "AGENTS.md", 1, null, `installed package not found: ${pkg.reason}`);
    else against = pkg.manifest;
  } else {
    const lock = pin.lock!;
    against = lock.snapshot;
    if (pin.state === "incompatible") add("error", "skills-incompatible", LOCK, 1, null, incompatibleMessage(lock, product.version));
    else if (pin.state === "pinned" && pkg.compatible) {
      const shipped = pkg.manifest!;
      if (shipped.name !== lock.snapshot.name || comparePrecedence(shipped.version, lock.snapshot.version) > 0) {
        add("info", "skills-update-available", LOCK, 1, null, `${shipped.name} ${shipped.version} is available (pinned: ${lock.snapshot.name} ${lock.snapshot.version}); run brain upgrade`);
      }
    }
  }
  if (against !== null) {
    const message = `product files differ from ${against.name} ${against.version}; run brain upgrade, or file a finding`;
    for (const path of skillDrift(root, against, planned)) add("error", "product-file", path, 1, null, message);
  }
  const settings = planned?.has(".claude/settings.json") ? planned.get(".claude/settings.json")! : undefined;
  for (const copy of competingCopies({ treeRoot: root, names: checkedNames(pin, pkg), home: input.home, brainRoot: root, brainSettings: settings })) {
    if (copy.kind === "duplicate") add("error", "skill-duplicate", copy.path, 1, null, competingMessage(copy));
    else add("warning", "skill-competing", copy.path, 1, null, competingMessage(copy));
  }
}
