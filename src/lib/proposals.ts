import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { BrainError } from "./errors.ts";
import { serializeNewFile } from "./frontmatter.ts";
import { generateId } from "./ids.ts";
import { assertNoProblems, isRecord, unknownKeys, type InputProblem } from "./input.ts";
import { assertStagedValid, checkNoteInput, stageNotes, type CreatedNote, type NoteInput } from "./note-new.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { newNotePath } from "./paths.ts";
import { loadSchemas } from "./schemas.ts";
import { formatDate } from "./time.ts";
import type { Workspace } from "./workspace.ts";

export const PROPOSAL_KINDS = ["update_fact", "add_to_note", "update_body", "add_link", "supersede", "contradiction", "merge", "new_item", "review_notes", "answer"] as const;
export const PROPOSAL_STATUSES = ["pending", "approved", "rejected", "edited", "applied", "closed"] as const;

/** Input keys of `proposal new`: the schema §11 fields the CLI does not set (spec/cli.md §5.6). */
const INPUT_KEYS = ["title", "kind", "target", "field", "notes", "answer", "answer_note", "before", "after", "from", "content", "note", "supersedes", "merge_into", "why", "source"];
const ID = /^[a-z]{2,4}-[0-9a-hjkmnp-tv-z]{8}$/;
const KNOWLEDGE_TYPES = new Set(["area", "goal", "project", "person", "org", "meeting", "decision", "question", "concept", "reference", "memory"]);
const ADD_LINK_FIELDS = new Set(["aliases", "tags", "projects", "people", "attendees", "deciders"]);
/** Kinds a review_notes takes in as `changes`, in the order they are stored (spec/schema.md §11.3, 0045). */
export const CHANGE_KINDS = ["update_fact", "update_body", "add_to_note"];
/** Fields that make two pending proposals the same change (dedupe, spec/cli.md §5.6). */
const DEDUPE_KEYS = ["kind", "target", "field", "after", "content", "note", "supersedes", "merge_into", "answer", "answer_note"];

export interface CreatedProposal {
  id: string;
  kind: string;
  title: string;
  target?: string;
  path: string;
  before?: unknown;
  input_indexes?: number[];
}

export interface SkippedProposal {
  input_index: number;
  reason: "DUPLICATE_PENDING" | "ALREADY_LINKED" | "NOTHING_TO_REVIEW" | "ALREADY_ANSWERED" | "NO_CHANGE";
  existing?: string;
}

/**
 * Stage proposals for `proposal new` (spec/cli.md §5.6) and validate them. Throws INPUT_INVALID,
 * UNKNOWN_ID or BEFORE_MISMATCH for the whole batch; nothing is staged in that case.
 */
export function stageProposals(
  workspace: Workspace,
  items: unknown,
  now: Date,
): { created: CreatedProposal[]; skipped: SkippedProposal[] } {
  if (!Array.isArray(items)) assertNoProblems([{ pointer: "/proposals", message: "must be a list" }]);
  const list = items as unknown[];
  const problems: InputProblem[] = [];
  list.forEach((item, index) => problems.push(...checkShape(item, `/proposals/${index}`)));
  assertNoProblems(problems);

  const today = formatDate(now);
  const created: CreatedProposal[] = [];
  const skipped: SkippedProposal[] = [];
  const pointers = new Map<string, string>();
  const links: Array<{ item: Record<string, unknown>; index: number; fields: Record<string, unknown> }> = [];
  const linkKeys = new Map<string, number>();
  const duplicateLinks: Array<{ input_index: number; key: string }> = [];
  // A new_item's note is checked alone first, so errors in other items are never blamed on it.
  (list as Array<Record<string, unknown>>).forEach((item, index) => {
    if (item.kind === "new_item") checkNewItem(workspace, item.note as NoteInput, `/proposals/${index}/note`, today);
  });
  // One review_notes per source; it takes in that source's add_link items and changes (spec/cli.md §5.6, 0043, 0045).
  const reviews = new Map<string, { index: number; item: Record<string, unknown>; links: Array<{ index: number; fields: Record<string, unknown> }>; changes: Array<{ index: number; change: Record<string, unknown> }> }>();
  (list as Array<Record<string, unknown>>).forEach((item, index) => {
    if (item.kind !== "review_notes") return;
    const source = String(item.source);
    if (reviews.has(source)) assertNoProblems([{ pointer: `/proposals/${index}/source`, message: `a second review_notes for ${source} in one input` }]);
    checkReviewNotes(workspace, item, `/proposals/${index}`);
    reviews.set(source, { index, item, links: [], changes: [] });
  });
  const start = workspace.checkpoint();
  try {
    (list as Array<Record<string, unknown>>).forEach((item, index) => {
      const pointer = `/proposals/${index}`;
      if (item.kind === "review_notes") return;
      const fields = resolveFields(workspace, item, pointer, today);
      if (item.kind === "answer" && workspace.get(String(fields.target))!.attributes.answer !== undefined) {
        skipped.push({ input_index: index, reason: "ALREADY_ANSWERED" });
        return;
      }
      if (item.kind === "update_body" && bodyOf(String(fields.content)) === workspace.get(String(fields.target))!.body) {
        skipped.push({ input_index: index, reason: "NO_CHANGE" });
        return;
      }
      const folds = item.kind === "add_link" || CHANGE_KINDS.includes(String(item.kind));
      const review = folds ? reviews.get(String(fields.source)) : undefined;

      if (item.kind === "add_link" && listField(workspace.get(String(fields.target))!, String(fields.field)).some((value) => isDeepStrictEqual(value, fields.after))) {
        skipped.push({ input_index: index, reason: "ALREADY_LINKED" });
        return;
      }

      const duplicate = workspace.notes.find((note) => note.type === "proposal" && note.attributes.status === "pending" &&
        (item.kind === "add_link"
          ? (note.attributes.kind === "review_notes"
            ? review !== undefined && reviewLinks(note.attributes).some((link) => link.target === fields.target && link.field === fields.field && isDeepStrictEqual(link.value, fields.after))
            : note.attributes.target === fields.target && proposalLinks(note.attributes).some((link) => link.field === fields.field && isDeepStrictEqual(link.value, fields.after)))
          : DEDUPE_KEYS.every((key) => isDeepStrictEqual(note.attributes[key], fields[key]))
            || (CHANGE_KINDS.includes(String(item.kind)) && note.attributes.kind === "review_notes" && listOf(note.attributes.changes).some((change) => sameChange(change, fields)))));
      if (duplicate !== undefined) {
        skipped.push({ input_index: index, reason: "DUPLICATE_PENDING", existing: duplicate.id });
        return;
      }
      if (review !== undefined && CHANGE_KINDS.includes(String(item.kind))) {
        if (review.changes.some(({ change }) => sameChange(change, fields))) { skipped.push({ input_index: index, reason: "DUPLICATE_PENDING" }); return; }
        review.changes.push({ index, change: changeEntry(fields) });
        return;
      }

      if (item.kind === "add_link") {
        const key = JSON.stringify([fields.target, fields.source, fields.field, fields.after]);
        if (linkKeys.has(key)) { duplicateLinks.push({ input_index: index, key }); return; }
        linkKeys.set(key, index);
        if (review !== undefined) review.links.push({ index, fields });
        else links.push({ item, index, fields });
        return;
      }

      createProposal(workspace, fields, [index], today, pointer, pointers, created);
    });
    const groups = new Map<string, typeof links>();
    for (const link of links) {
      const key = `${link.fields.target}\u0000${link.fields.source}`;
      groups.set(key, [...(groups.get(key) ?? []), link]);
    }
    const createdLinks = new Map<string, string>();
    for (const group of groups.values()) {
      const first = group[0]!;
      const fields: Record<string, unknown> = { ...first.fields, links: group.map(({ fields }) => ({ field: fields.field, value: fields.after })) };
      delete fields.field; delete fields.after;
      fields.title = group.length === 1 ? first.fields.title : groupedTitle(workspace, workspace.get(String(first.fields.target))!, group);
      fields.why = [...new Set(group.map(({ fields }) => String(fields.why)))].join(" · ");
      const proposal = createProposal(workspace, fields, group.map(({ index }) => index), today, `/proposals/${first.index}`, pointers, created);
      for (const link of group) createdLinks.set(JSON.stringify([link.fields.target, link.fields.source, link.fields.field, link.fields.after]), proposal.id);
    }
    for (const review of reviews.values()) {
      const notes = review.item.notes as string[];
      if (notes.length === 0 && review.links.length === 0 && review.changes.length === 0) {
        skipped.push({ input_index: review.index, reason: "NOTHING_TO_REVIEW" });
        continue;
      }
      const source = String(review.item.source);
      // Changes are stored in render order: every update_fact, then update_body, then add_to_note (spec/schema.md §11.3).
      const changes = [...review.changes].sort((a, b) => CHANGE_KINDS.indexOf(String(a.change.kind)) - CHANGE_KINDS.indexOf(String(b.change.kind)) || a.index - b.index);
      const fields: Record<string, unknown> = {
        kind: "review_notes",
        title: review.item.title ?? reviewTitle(workspace, source, changes.length, notes.length, review.links.length),
        notes,
        links: review.links.map(({ fields }) => ({ target: fields.target, field: fields.field, value: fields.after })),
        ...(changes.length === 0 ? {} : { changes: changes.map(({ change }) => change) }),
        why: review.item.why ?? `What came in from ${sourceTitle(workspace, source)}`,
        source,
      };
      const held = [review.index, ...review.links.map(({ index }) => index), ...changes.map(({ index }) => index)].sort((a, b) => a - b);
      const proposal = createProposal(workspace, fields, held, today, `/proposals/${review.index}`, pointers, created);
      for (const link of review.links) createdLinks.set(JSON.stringify([link.fields.target, link.fields.source, link.fields.field, link.fields.after]), proposal.id);
    }
    for (const duplicate of duplicateLinks) skipped.push({ input_index: duplicate.input_index, reason: "DUPLICATE_PENDING", existing: createdLinks.get(duplicate.key) });
    assertStagedValid(workspace, pointers, "/proposals");
  } catch (error) {
    workspace.restore(start);
    throw error;
  }
  return { created, skipped };
}

function createProposal(workspace: Workspace, fields: Record<string, unknown>, inputIndexes: number[], today: string, pointer: string, pointers: Map<string, string>, created: CreatedProposal[]): CreatedProposal {
  const id = generateId("prp", workspace.ids());
  const attributes = { id, type: "proposal", created: today, updated: today, ...fields, status: "pending" };
  const path = newNotePath("proposal", String(fields.title), today, (candidate) => workspace.exists(candidate));
  workspace.write(path, serializeNewFile(attributes, ""));
  pointers.set(path, pointer);
  const proposal = { id, kind: String(fields.kind), title: String(fields.title), ...(fields.target === undefined ? {} : { target: String(fields.target) }), path, ...(fields.before === undefined ? {} : { before: fields.before }), input_indexes: inputIndexes };
  created.push(proposal);
  return proposal;
}

/** Write a new pending proposal with these fields (apply's deferred row, spec/schema.md §11.3). Not validated. */
export function writeProposal(workspace: Workspace, fields: Record<string, unknown>, today: string): { id: string; path: string } {
  const { id, path } = createProposal(workspace, fields, [], today, "", new Map(), []);
  return { id, path };
}

/** The `{target, field, value}` links of a review_notes proposal. */
function reviewLinks(attributes: Record<string, unknown>): Array<{ target: unknown; field: unknown; value: unknown }> {
  return Array.isArray(attributes.links) ? attributes.links.filter(isRecord).map((link) => ({ target: link.target, field: link.field, value: link.value })) : [];
}

/** Ids listed by every review_notes proposal, any status (spec/cli.md §5.6). */
function reviewedIds(workspace: Workspace): Map<string, string> {
  const listed = new Map<string, string>();
  for (const note of workspace.notes) {
    if (note.type !== "proposal" || note.attributes.kind !== "review_notes" || !Array.isArray(note.attributes.notes)) continue;
    for (const id of note.attributes.notes) if (typeof id === "string" && !listed.has(id)) listed.set(id, note.id);
  }
  return listed;
}

/** The meeting's title for a meeting id, else the source's (spec/cli.md §5.6). */
export function sourceTitle(workspace: Workspace, source: string): string {
  return String(workspace.get(source)?.attributes.title ?? source);
}

/** `From <source title>: 1 change, 3 new notes and 2 links` (spec/cli.md §5.6, 0045); a deferred row starts `Deferred from`. */
export function reviewTitle(workspace: Workspace, source: string, changes: number, notes: number, links: number, lead = "From"): string {
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const parts = [[changes, "change", "changes"], [notes, "new note", "new notes"], [links, "link", "links"]] as const;
  const counts = parts.filter(([n]) => n > 0).map(([n, one, many]) => count(n, one, many));
  const joined = counts.length <= 1 ? counts.join("") : `${counts.slice(0, -1).join(", ")} and ${counts.at(-1)}`;
  const title = `${lead} ${sourceTitle(workspace, source)}: ${joined}`;
  return title.length > 120 ? `${title.slice(0, 119)}…` : title;
}

/** A change entry of a review_notes: the item's kind, target, why and that kind's fields (spec/schema.md §11). */
function changeEntry(fields: Record<string, unknown>): Record<string, unknown> {
  const keys = ["kind", "target", "why", "field", "before", "after", "from", "content", "before_hash"];
  return Object.fromEntries(keys.filter((key) => fields[key] !== undefined).map((key) => [key, fields[key]]));
}

function sameChange(change: unknown, fields: Record<string, unknown>): boolean {
  return isRecord(change) && ["kind", "target", "field", "after", "content"].every((key) => isDeepStrictEqual(change[key], fields[key]));
}

/** A reference's body as stored, for `content`: one blank line after the frontmatter, LF endings, a final newline. */
export function bodyOf(content: string): string {
  const text = content.replace(/\r\n?/g, "\n").replace(/^\n+/, "");
  return `\n${text.endsWith("\n") ? text : `${text}\n`}`;
}

/** The body hash an update_body is checked against (the source hash rule, spec/schema.md §4). */
export function bodyHash(body: string): string {
  return `sha256:${createHash("sha256").update(body, "utf8").digest("hex")}`;
}

function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** A review_notes item's notes: existing knowledge notes, listed once here and by no other review_notes. */
function checkReviewNotes(workspace: Workspace, item: Record<string, unknown>, pointer: string): void {
  const source = workspace.get(String(item.source));
  if (source === undefined) throw new BrainError("UNKNOWN_ID", `${pointer}/source: no note with id ${String(item.source)}`, [{ pointer: `${pointer}/source`, message: "does not exist" }]);
  if (source.type !== "meeting" && source.type !== "source") assertNoProblems([{ pointer: `${pointer}/source`, message: "must be a meeting or a source" }]);
  const listed = reviewedIds(workspace);
  const seen = new Set<string>();
  const problems: InputProblem[] = [];
  (item.notes as unknown[]).forEach((id, index) => {
    const at = `${pointer}/notes/${index}`;
    const note = typeof id === "string" ? workspace.get(id) : undefined;
    if (note === undefined) problems.push({ pointer: at, message: `no note with id ${String(id)}` });
    else if (!KNOWLEDGE_TYPES.has(note.type)) problems.push({ pointer: at, message: `is a ${note.type}, not a knowledge note` });
    else if (seen.has(note.id)) problems.push({ pointer: at, message: "is listed twice" });
    else if (listed.has(note.id)) problems.push({ pointer: at, message: `is already listed by ${listed.get(note.id)}` });
    if (typeof id === "string") seen.add(id);
  });
  assertNoProblems(problems);
}

function proposalLinks(attributes: Record<string, unknown>): Array<{ field: unknown; value: unknown }> {
  if (Array.isArray(attributes.links)) return attributes.links.filter(isRecord).map((link) => ({ field: link.field, value: link.value }));
  return attributes.field === undefined ? [] : [{ field: attributes.field, value: attributes.after }];
}

function groupedTitle(workspace: Workspace, target: Note, group: Array<{ fields: Record<string, unknown> }>): string {
  const order = ["people", "projects", "attendees", "deciders", "aliases", "tags"];
  const nouns: Record<string, [string, string]> = { people: ["person", "people"], projects: ["project", "projects"], attendees: ["attendee", "attendees"], deciders: ["decider", "deciders"], aliases: ["alias", "aliases"], tags: ["tag", "tags"] };
  const parts = order.flatMap((field) => {
    const values = group.filter(({ fields }) => fields.field === field).map(({ fields }) => fields.after);
    if (values.length === 0) return [];
    const shown = values.slice(0, 3).map((value) => ["people", "projects", "attendees", "deciders"].includes(field) ? String(workspace.get(String(value))?.attributes.title ?? value) : String(value));
    if (values.length > 3) shown.push("…");
    return [`${values.length} ${nouns[field]![values.length === 1 ? 0 : 1]} (${shown.join(", ")})`];
  });
  const title = `${String(target.attributes.title)}: add ${parts.join(", ")}`;
  return title.length > 120 ? `${title.slice(0, 119)}…` : title;
}


function checkShape(item: unknown, pointer: string): InputProblem[] {
  if (!isRecord(item)) return [{ pointer, message: "must be an object" }];
  const problems = unknownKeys(item, INPUT_KEYS, pointer);
  const at = (key: string, message: string) => problems.push({ pointer: `${pointer}/${key}`, message });
  if (!(PROPOSAL_KINDS as readonly unknown[]).includes(item.kind)) at("kind", `must be one of ${PROPOSAL_KINDS.join(", ")}`);
  for (const key of item.kind === "review_notes" ? ["source"] : ["title", "why", "source"]) {
    if (typeof item[key] !== "string" || item[key] === "") at(key, "must be a non-empty string");
  }
  for (const key of item.kind === "review_notes" ? ["title", "why"] : []) {
    if (item[key] !== undefined && (typeof item[key] !== "string" || item[key] === "")) at(key, "must be a non-empty string");
  }
  if (item.kind === "review_notes") {
    if (item.target !== undefined) at("target", "a review_notes has no target");
    if (!Array.isArray(item.notes)) at("notes", "must be a list of note ids");
  } else if (item.notes !== undefined) {
    at("notes", "is only allowed on review_notes");
  }
  if (item.kind === "answer" && (typeof item.answer !== "string" || item.answer.trim() === "")) at("answer", "must be a non-empty string");
  if (item.kind === "update_body" && (typeof item.content !== "string" || item.content.trim() === "")) at("content", "must be the whole new body");
  if (item.kind !== "answer") {
    for (const key of ["answer", "answer_note"]) if (item[key] !== undefined) at(key, "is only allowed on answer");
  }
  if (item.kind === "review_notes") {
    // Checked against the brain in checkReviewNotes.
  } else if (item.kind === "new_item") {
    if (item.target !== undefined) at("target", "a new_item has no target");
    problems.push(...checkNoteInput(item.note, `${pointer}/note`, false));
  } else if (typeof item.target !== "string") {
    at("target", "must be the id of an existing note");
  }
  for (const key of ["supersedes", "merge_into"]) {
    if (item[key] !== undefined && typeof item[key] !== "string") at(key, "must be a note id");
  }
  // Everything else (field names, value shapes, required keys per kind) is checked by the proposal schema.
  return problems;
}

/** The proposal's own fields, with `before` and `from` filled in and per-kind rules checked. */
function resolveFields(workspace: Workspace, item: Record<string, unknown>, pointer: string, today: string): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const key of INPUT_KEYS) if (item[key] !== undefined) fields[key] = item[key];
  const kind = item.kind as string;
  const invalid = (key: string, message: string): never => {
    throw new BrainError("INPUT_INVALID", `${pointer}/${key} ${message}`, [{ pointer: `${pointer}/${key}`, message }]);
  };
  const existing = (key: string): Note => {
    const id = item[key];
    const note = typeof id === "string" ? workspace.get(id) : undefined;
    if (note === undefined) {
      throw new BrainError("UNKNOWN_ID", `${pointer}/${key}: no note with id ${String(id)}`, [{ pointer: `${pointer}/${key}`, message: "does not exist" }]);
    }
    return note;
  };

  if (typeof item.source === "string" && ID.test(item.source)) existing("source");
  if (kind === "new_item") return fields;
  const target = existing("target");
  if (!KNOWLEDGE_TYPES.has(target.type)) invalid("target", `is a ${target.type}; proposals change knowledge notes only`);
  if (kind === "answer") {
    if (target.type !== "question") invalid("target", `is a ${target.type}; an answer targets a question`);
    if (item.answer_note !== undefined) {
      const note = existing("answer_note");
      if (!KNOWLEDGE_TYPES.has(note.type)) invalid("answer_note", `is a ${note.type}, not a knowledge note`);
    }
  }

  if (kind === "update_fact" || kind === "contradiction") {
    if (typeof item.field !== "string") invalid("field", "is required for this kind");
    const facts = isRecord(target.attributes.facts) ? target.attributes.facts : {};
    const current = Object.hasOwn(facts, item.field as string) ? facts[item.field as string] : undefined;
    if (kind === "contradiction" && current === undefined) invalid("field", `${target.id} has no current facts.${String(item.field)} to contradict`);
    if (item.before !== undefined && !isDeepStrictEqual(item.before, current)) {
      throw new BrainError(
        "BEFORE_MISMATCH",
        `${pointer}/before is ${JSON.stringify(item.before)}, but ${target.id} facts.${String(item.field)} is ${current === undefined ? "absent" : JSON.stringify(current)}`,
        [{ pointer: `${pointer}/before`, message: "differs from the note's current value" }],
      );
    }
    if (current === undefined) delete fields.before;
    else fields.before = current;
    if (fields.from === undefined) {
      const meeting = typeof item.source === "string" && item.source.startsWith("mtg-") ? workspace.get(item.source) : undefined;
      fields.from = typeof meeting?.attributes.date === "string" ? meeting.attributes.date : today;
    }
  }
  if (kind === "update_body") {
    if (target.type !== "reference") invalid("target", `is a ${target.type}; update_body replaces the body of a reference`);
    fields.before_hash = bodyHash(target.body);
  }
  if (kind === "add_link") {
    const field = typeof item.field === "string" ? item.field : "";
    if (!ADD_LINK_FIELDS.has(field)) invalid("field", "must be aliases, tags, projects, people, attendees or deciders");
    if (!loadSchemas().knownKeys(target.type)?.has(field)) invalid("field", `is not declared by ${target.type}`);
    if (["projects", "people", "attendees", "deciders"].includes(field)) {
      const linked = existing("after");
      const prefix = field === "projects" ? "prj-" : "per-";
      if (!linked.id.startsWith(prefix)) invalid("after", `must be an existing ${prefix} id for ${field}`);
    }
  }
  if (kind === "supersede") {
    const older = existing("supersedes");
    if (older.id === target.id) invalid("supersedes", "must differ from target");
    if (older.type !== target.type) invalid("supersedes", `is a ${older.type}, target is a ${target.type}`);
    const relations = Array.isArray(older.attributes.relations) ? older.attributes.relations : [];
    if (relations.some((relation) => isRecord(relation) && relation.type === "superseded_by")) invalid("supersedes", `${older.id} is already superseded`);
  }
  if (kind === "merge") {
    const survivor = existing("merge_into");
    if (survivor.id === target.id) invalid("merge_into", "must differ from target");
    if (survivor.type !== target.type) invalid("merge_into", `is a ${survivor.type}, target is a ${target.type}`);
  }
  return fields;
}

function listField(note: Note, field: string): unknown[] {
  return Array.isArray(note.attributes[field]) ? note.attributes[field] : [];
}

/** A new_item's note must pass `note new` validation as apply would write it (spec/cli.md §5.6). */
function checkNewItem(workspace: Workspace, note: NoteInput, pointer: string, today: string): void {
  const before = workspace.checkpoint();
  try {
    const staged = stageNewItem(workspace, note, pointer, new Date(`${today}T00:00:00Z`));
    assertStagedValid(workspace, staged.pointers, pointer);
  } finally {
    workspace.restore(before);
  }
}

/**
 * Stage a new_item's note as a new note and add it to its meeting's `decisions` or `questions`
 * (spec/schema.md §11.2). Not validated: the caller does that.
 */
export function stageNewItem(
  workspace: Workspace,
  note: NoteInput,
  pointer: string,
  now: Date,
): { note: CreatedNote; meetingPath?: string; pointers: Map<string, string> } {
  const staged = stageNotes(workspace, [note], () => pointer, { now });
  const created = staged.created[0];
  if (created === undefined) {
    const existingId = staged.skipped[0]?.existing;
    throw new BrainError("INPUT_INVALID", `${pointer} duplicates source ${String(existingId)}`, [{ pointer, message: `same content as existing source ${String(existingId)}` }]);
  }
  const pointers = new Map(staged.pointers);
  const link = note.type === "decision" ? ["decided_in", "decisions"] : note.type === "question" ? ["raised_in", "questions"] : undefined;
  const meetingId = link === undefined ? undefined : note.frontmatter[link[0]!];
  const meeting = typeof meetingId === "string" ? workspace.get(meetingId) : undefined;
  if (link === undefined || meeting === undefined || meeting.type !== "meeting") return { note: created, pointers };

  const document = workspace.edit(meeting);
  const ids = Array.isArray(document.attributes[link[1]!]) ? (document.attributes[link[1]!] as unknown[]) : [];
  if (!ids.includes(created.id)) {
    document.attributes[link[1]!] = [...ids, created.id];
    document.attributes.updated = formatDate(now);
    workspace.save(meeting.path, document);
  }
  pointers.set(meeting.path, pointer);
  return { note: created, meetingPath: meeting.path, pointers };
}

/** Proposals with these statuses and target, sorted by `created` then id (spec/cli.md §5.6). */
export function listProposals(workspace: Workspace, statuses: readonly string[], target: string | undefined): Array<Record<string, unknown>> {
  return workspace.notes
    .filter((note) => note.type === "proposal")
    .filter((note) => statuses.length === 0 || statuses.includes(String(note.attributes.status)))
    .filter((note) => target === undefined || note.attributes.target === target
      || (note.attributes.kind === "review_notes" && ((Array.isArray(note.attributes.notes) && note.attributes.notes.includes(target)) || reviewLinks(note.attributes).some((link) => link.target === target) || listOf(note.attributes.changes).some((change) => isRecord(change) && change.target === target))))
    .map((note): Record<string, unknown> => ({ ...note.attributes, path: note.path }))
    .sort((a, b) => compareCodePoints(String(a.created), String(b.created)) || compareCodePoints(String(a.id), String(b.id)));
}

/**
 * `proposal backlog` (spec/cli.md §5.6, 0041): one review_notes per source over the `draft`
 * notes nobody has accepted yet, for a brain made before 0.4.0. A second run writes nothing.
 */
export function stageBacklog(workspace: Workspace, now: Date): CreatedProposal[] {
  const today = formatDate(now);
  const listed = reviewedIds(workspace);
  const claimed = new Set<string>();
  const created: CreatedProposal[] = [];
  const pointers = new Map<string, string>();
  const sources = workspace.notes
    .filter((note) => note.type === "source")
    .sort((a, b) => compareCodePoints(String(a.attributes.captured ?? ""), String(b.attributes.captured ?? "")) || compareCodePoints(a.id, b.id));
  const start = workspace.checkpoint();
  try {
    for (const source of sources) {
      const minutes = (source.attributes.kind ?? "minutes") === "minutes";
      const meeting = minutes ? workspace.notes.find((note) => note.type === "meeting" && note.attributes.source === source.id) : undefined;
      const provenance = meeting?.id ?? source.id;
      const notes = workspace.notes
        .filter((note) => KNOWLEDGE_TYPES.has(note.type) && note.attributes.lifecycle === "draft" && !listed.has(note.id) && !claimed.has(note.id)
          && (note.id === meeting?.id || (Array.isArray(note.attributes.sources) && note.attributes.sources.includes(provenance))))
        .sort((a, b) => compareCodePoints(String(a.attributes.created), String(b.attributes.created)) || compareCodePoints(a.id, b.id));
      if (notes.length === 0) continue;
      for (const note of notes) claimed.add(note.id);
      const fields = {
        kind: "review_notes",
        title: reviewTitle(workspace, provenance, 0, notes.length, 0),
        notes: notes.map((note) => note.id),
        links: [],
        why: `Notes from ${sourceTitle(workspace, provenance)} waiting for your review`,
        source: provenance,
      };
      const { input_indexes: _unused, ...proposal } = createProposal(workspace, fields, [], today, "", pointers, []);
      created.push(proposal);
    }
    assertStagedValid(workspace, pointers, "");
  } catch (error) {
    workspace.restore(start);
    throw error;
  }
  return created;
}
