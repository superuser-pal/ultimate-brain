import { posix } from "node:path";

import { compareCodePoints, type Note } from "./notes.ts";

export type ViewKind = "brief" | "decision_log" | "area_brief";

export interface DerivedView {
  kind: ViewKind;
  /** The exact marker-delimited block, without a trailing newline. */
  generatedBlock: string;
  /** Project (or area) plus the canonical notes that rendered item lines. */
  generatedFrom: string[];
}

const CURRENT_ASSESSMENTS = new Set(["accepted", "provisional", "contested"]);

/** Render one project view, or an area's brief, from canonical notes only (spec/schema.md §16). */
export function deriveView(project: Note, kind: ViewKind, notes: readonly Note[]): DerivedView {
  const canonical = notes.filter((note) => note.type !== "view");
  const byId = new Map(canonical.map((note) => [note.id, note]));
  const generated = new Set<string>([project.id]);
  const link = (note: Note) => noteLink(kind === "area_brief" ? areaBriefPath(project) : projectViewPath(project, kind), note);
  const title = (note: Note) => text(note.attributes.title);
  const add = (note: Note) => {
    generated.add(note.id);
    return link(note);
  };

  const sections = kind === "brief"
    ? briefSections(project, canonical, byId, title, add)
    : kind === "area_brief"
      ? areaBriefSections(project, canonical, byId, title, add)
      : decisionLogSections(project, canonical, byId, title, add, link);
  const generatedBlock = ["<!-- @generated:start -->", ...sections.flatMap((section, index) => index === 0 ? section : ["", ...section]), "<!-- @generated:end -->"].join("\n");
  return { kind, generatedBlock, generatedFrom: [...generated].sort(compareCodePoints) };
}

/** An area's brief: `areas/briefs/<slug of the area's file name>.md` (spec/schema.md §16.3). */
export function areaBriefPath(area: Note): string {
  return `areas/briefs/${posix.basename(area.path, ".md")}.md`;
}

/** The standard view filename beside a project's `project.md`. */
export function projectViewPath(project: Note, kind: ViewKind): string {
  return `${posix.dirname(project.path)}/${kind === "brief" ? "brief.md" : "decision-log.md"}`;
}

/** Exactly one standalone start/end marker, in order, is required before replacement. */
export function generatedBlockRange(body: string): { start: number; end: number } | undefined {
  const start = markerPositions(body, "<!-- @generated:start -->");
  const end = markerPositions(body, "<!-- @generated:end -->");
  if (start.length !== 1 || end.length !== 1 || start[0]! >= end[0]!) return undefined;
  return { start: start[0]!, end: end[0]! + "<!-- @generated:end -->".length };
}

function briefSections(
  project: Note,
  notes: readonly Note[],
  byId: ReadonlyMap<string, Note>,
  title: (note: Note) => string,
  add: (note: Note) => string,
): string[][] {
  const status: string[] = ["## Status"];
  const notionFields = record(project.attributes.notion_fields);
  const statusValue = scalar(notionFields.status);
  const priority = scalar(notionFields.priority);
  const asOf = scalar(notionFields.as_of);
  if (statusValue !== undefined || priority !== undefined) {
    const parts = [statusValue === undefined ? undefined : `Status: ${statusValue}`, priority === undefined ? undefined : `Priority: ${priority}`]
      .filter((value): value is string => value !== undefined);
    const suffix = asOf === undefined ? "" : ` (as of ${asOf.slice(0, 10)})`;
    status.push(`- ${parts.join(" · ")}${suffix} ([project](project.md))`);
  }
  for (const [key, value] of Object.entries(record(project.attributes.facts)).sort(([left], [right]) => compareCodePoints(left, right))) {
    const person = typeof value === "string" ? byId.get(value) : undefined;
    const rendered = person?.type === "person" ? add(person) : String(value);
    status.push(`- ${formatFactKey(key)}: ${rendered} ([project](project.md))`);
  }
  if (status.length === 1) status.push("- None");

  const goal = typeof project.attributes.goal === "string" ? byId.get(project.attributes.goal) : undefined;
  const goalSection = ["## Goal", goal?.type === "goal" ? `- ${add(goal)}` : "- None"];

  const people = list(project.attributes.people)
    .map((id) => typeof id === "string" ? byId.get(id) : undefined)
    .filter((note): note is Note => note?.type === "person")
    .sort((left, right) => compareCodePoints(title(left), title(right)) || compareCodePoints(left.id, right.id));
  const peopleSection = ["## People", ...(people.length === 0 ? ["- None"] : people.map((person) => {
    const role = scalar(record(person.attributes.facts).role);
    return `- ${add(person)}${role === undefined ? "" : ` — ${role}`}`;
  }))];

  const decisionsSection = recentDecisions(notes, (note) => belongsToProject(note, project), add);
  const questionsSection = openQuestions(notes, (note) => belongsToProject(note, project), add, Infinity);

  const meetings = notes
    .filter((note) => note.type === "meeting" && belongsToProject(note, project))
    .sort(sortDescendingBy("date"))
    .slice(0, 5);
  const meetingsSection = ["## Recent meetings", ...(meetings.length === 0 ? ["- None"] : meetings.map((meeting) =>
    `- ${text(meeting.attributes.date)} — ${add(meeting)}`))];

  return [status, goalSection, peopleSection, decisionsSection, questionsSection, meetingsSection];
}

/** An area's brief (spec/schema.md §16.3). */
function areaBriefSections(
  area: Note,
  notes: readonly Note[],
  byId: ReadonlyMap<string, Note>,
  title: (note: Note) => string,
  add: (note: Note) => string,
): string[][] {
  const projects = notes
    .filter((note) => note.type === "project" && note.attributes.area === area.id && record(note.attributes.notion_fields).archived !== true)
    .sort((left, right) => compareCodePoints(title(left), title(right)) || compareCodePoints(left.id, right.id));
  const projectsSection = ["## Projects", ...(projects.length === 0 ? ["- None"] : projects.map((project) => {
    const status = scalar(record(project.attributes.notion_fields).status);
    return `- ${add(project)}${status === undefined ? "" : ` — ${status}`}`;
  }))];
  // A note belongs to the area through its own area or the area of one of its projects.
  const belongs = (note: Note) => note.attributes.area === area.id
    || list(note.attributes.projects).some((id) => typeof id === "string" && byId.get(id)?.attributes.area === area.id);
  return [projectsSection, recentDecisions(notes, belongs, add), openQuestions(notes, belongs, add, 10)];
}

/** `## Recent decisions`: reviewed current decisions, newest first, at most 5 (spec/schema.md §16.1 item 4). */
function recentDecisions(notes: readonly Note[], belongs: (note: Note) => boolean, add: (note: Note) => string): string[] {
  const candidates = notes
    .filter((note) => note.type === "decision" && belongs(note) && CURRENT_ASSESSMENTS.has(String(note.attributes.assessment)))
    .sort(sortDescendingBy("date"));
  return reviewedSection("## Recent decisions", candidates, 5, (decision) =>
    `- ${text(decision.attributes.date)} — ${add(decision)} (${text(decision.attributes.assessment)})`);
}

/** `## Open questions`: reviewed, unanswered questions still Open, newest first (spec/schema.md §16.1 item 5). */
function openQuestions(notes: readonly Note[], belongs: (note: Note) => boolean, add: (note: Note) => string, limit: number): string[] {
  const candidates = notes
    .filter((note) => note.type === "question" && belongs(note) && note.attributes.answer === undefined)
    .filter((note) => {
      const status = record(note.attributes.notion_fields).status;
      return status === undefined || status === "Open";
    })
    .sort(sortDescendingBy("created"));
  return reviewedSection("## Open questions", candidates, limit, (question) => `- ${add(question)} (${text(question.attributes.kind)})`);
}

/**
 * Only `reviewed` notes make item lines (0041). With none, the drafts that would qualify are
 * counted in a waiting line, and produce no item line.
 */
function reviewedSection(heading: string, candidates: readonly Note[], limit: number, line: (note: Note) => string): string[] {
  const reviewed = candidates.filter((note) => note.attributes.lifecycle === "reviewed").slice(0, limit);
  if (reviewed.length > 0) return [heading, ...reviewed.map(line)];
  const waiting = candidates.filter((note) => note.attributes.lifecycle === "draft").length;
  return [heading, waiting === 0 ? "- None" : `- Nothing reviewed yet: ${waiting} note${waiting === 1 ? "" : "s"} waiting in Review`];
}

function decisionLogSections(
  project: Note,
  notes: readonly Note[],
  byId: ReadonlyMap<string, Note>,
  _title: (note: Note) => string,
  add: (note: Note) => string,
  link: (note: Note) => string,
): string[][] {
  const decisions = notes.filter((note) => note.type === "decision" && belongsToProject(note, project));
  const current = decisions.filter((note) => CURRENT_ASSESSMENTS.has(String(note.attributes.assessment))).sort(sortDescendingBy("date"));
  const superseded = decisions.filter((note) => note.attributes.assessment === "superseded").sort(sortDescendingBy("valid_until"));

  const currentSection = ["## Current", ...(current.length === 0 ? ["- None"] : current.map((decision) => {
    const older = relationTarget(decision, "supersedes", byId);
    return `- ${text(decision.attributes.date)} — ${add(decision)} — ${text(decision.attributes.assessment)}${older === undefined ? "" : ` — supersedes ${link(older)}`}`;
  }))];
  const supersededSection = ["## Superseded", ...(superseded.length === 0 ? ["- None"] : superseded.map((decision) => {
    const replacement = relationTarget(decision, "superseded_by", byId);
    const from = scalar(decision.attributes.valid_from) ?? text(decision.attributes.date);
    const until = text(decision.attributes.valid_until);
    return `- ${from} → ${until} — ${add(decision)} — superseded by ${replacement === undefined ? "(unknown)" : link(replacement)}`;
  }))];
  return [currentSection, supersededSection];
}

function relationTarget(note: Note, type: string, byId: ReadonlyMap<string, Note>): Note | undefined {
  for (const relation of list(note.attributes.relations)) {
    const recordValue = record(relation);
    if (recordValue.type === type && typeof recordValue.target === "string") return byId.get(recordValue.target);
  }
  return undefined;
}

function belongsToProject(note: Note, project: Note): boolean {
  return list(note.attributes.projects).includes(project.id);
}

function sortDescendingBy(field: string): (left: Note, right: Note) => number {
  return (left, right) => compareCodePoints(text(right.attributes[field]), text(left.attributes[field])) || compareCodePoints(left.id, right.id);
}

function noteLink(fromPath: string, note: Note): string {
  const title = text(note.attributes.title).replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]");
  return `[${title}](${posix.relative(posix.dirname(fromPath), note.path)})`;
}

function markerPositions(body: string, marker: string): number[] {
  const expression = new RegExp(`(?:^|\\n)${escapeRegExp(marker)}(?=\\n|$)`, "g");
  return [...body.matchAll(expression)].map((match) => match.index! + (match[0]!.startsWith("\n") ? 1 : 0));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatFactKey(key: string): string {
  return key.replaceAll("_", " ").replace(/^./, (first) => first.toUpperCase());
}

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function scalar(value: unknown): string | undefined {
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
