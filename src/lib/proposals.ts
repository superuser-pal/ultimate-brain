import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { BrainError } from "./errors.ts";
import { serializeNewFile } from "./frontmatter.ts";
import { generateId, generateItemId } from "./ids.ts";
import { assertNoProblems, isRecord, unknownKeys, type InputProblem } from "./input.ts";
import { assertStagedValid, checkNoteInput, stageNotes, type CreatedNote, type NoteInput } from "./note-new.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { checkNotionChange, defaultTitle, duplicateOf, resolveSetField } from "./notion-change.ts";
import { newNotePath } from "./paths.ts";
import { fingerprintProblem } from "./reflect.ts";
import { loadSchemas } from "./schemas.ts";
import type { Context } from "./eligibility.ts";
import { linkRefs, passageProblems, proposalWithheld } from "./passages.ts";
import { contextFor, requireSuppressions, withheldSupport } from "./suppressions.ts";
import { formatDate } from "./time.ts";
import type { Workspace } from "./workspace.ts";

export const PROPOSAL_KINDS = ["update_fact", "add_to_note", "update_body", "add_link", "supersede", "contradiction", "merge", "new_item", "review_notes", "answer", "notion_change", "set_field"] as const;
export const PROPOSAL_STATUSES = ["pending", "approved", "rejected", "edited", "applied", "closed"] as const;

/** Input keys of `proposal new`: the schema §11 fields the CLI does not set (spec/cli.md §5.6). */
const INPUT_KEYS = ["title", "kind", "target", "field", "notes", "answer", "answer_note", "before", "after", "from", "content", "note", "supersedes", "merge_into", "why", "source", "database", "page", "page_title", "property", "value_before", "value_after", "area", "finding", "fingerprint", "evidence", "passages", "note_passages", "note_flags", "unsure", "repeat"];
const ID = /^[a-z]{2,4}-[0-9a-hjkmnp-tv-z]{8}$/;
const KNOWLEDGE_TYPES = new Set(["domain", "area", "goal", "project", "person", "org", "meeting", "decision", "question", "concept", "reference", "memory"]);
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
  reason: "DUPLICATE_PENDING" | "ALREADY_LINKED" | "NOTHING_TO_REVIEW" | "ALREADY_ANSWERED" | "NO_CHANGE" | "SOURCE_EXCLUDED";
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
  // Every change names the passages it rests on; one without them is refused (eligibility.md §9.1, §9.2; cli §5.6).
  (list as Array<Record<string, unknown>>).forEach((item, index) => checkPassages(workspace, item, `/proposals/${index}`));
  // One review_notes per source; it takes in that source's add_link items and changes (spec/cli.md §5.6, 0043, 0045).
  const reviews = new Map<string, { index: number; item: Record<string, unknown>; links: Array<{ index: number; fields: Record<string, unknown>; flags: Flags }>; changes: Array<{ index: number; change: Record<string, unknown>; passages: unknown; flags: Flags }> }>();
  (list as Array<Record<string, unknown>>).forEach((item, index) => {
    if (item.kind !== "review_notes") return;
    const source = String(item.source);
    // A theme's review_notes is a row of its own: nothing folds into it, and it doesn't take another review_notes' place (§5.6).
    const key = typeof item.fingerprint === "string" ? `\u0000${item.fingerprint}` : source;
    if (reviews.has(key)) assertNoProblems([{ pointer: `/proposals/${index}/source`, message: typeof item.fingerprint === "string" ? `a second review_notes for ${item.fingerprint} in one input` : `a second review_notes for ${source} in one input` }]);
    checkReviewNotes(workspace, item, `/proposals/${index}`);
    if (typeof item.fingerprint === "string") checkFingerprint(workspace, item, `/proposals/${index}`);
    reviews.set(key, { index, item, links: [], changes: [] });
  });
  const excluded = contextFor(workspace.notes, requireSuppressions(workspace.root));
  const start = workspace.checkpoint();
  try {
    (list as Array<Record<string, unknown>>).forEach((item, index) => {
      const pointer = `/proposals/${index}`;
      if (item.kind === "review_notes") return;
      // A change any of whose passages is not live, even beside a live one, is not written (eligibility.md §4.2, §9.2): it could never be applied.
      const text = [item.content, item.answer, isRecord(item.note) ? item.note.body : undefined].find((value): value is string => typeof value === "string") ?? null;
      if (item.kind !== "notion_change" && withheldSupport({ source: item.source, passages: item.passages, text }, excluded)) { skipped.push({ input_index: index, reason: "SOURCE_EXCLUDED" }); return; }
      const fields = resolveFields(workspace, item, pointer, today);
      // A reflection answer: checked against its item, deduped on its fingerprint, never folded into a review_notes (§5.6).
      if (typeof item.fingerprint === "string") {
        checkFingerprint(workspace, item, pointer);
        const held = fingerprintDuplicate(workspace, item.fingerprint);
        if (held !== undefined) { skipped.push({ input_index: index, reason: "DUPLICATE_PENDING", existing: held.id }); return; }
        createProposal(workspace, fields, [index], today, pointer, pointers, created);
        return;
      }
      // Ultimate Assistant's kinds (spec/cli.md §5.6, 0072): their own no-change and dedupe rules, and a default title.
      if (item.kind === "notion_change" || item.kind === "set_field") {
        if (fields.noChange === true) { skipped.push({ input_index: index, reason: "NO_CHANGE" }); return; }
        delete fields.noChange;
        const duplicate = duplicateOf(workspace, fields);
        if (duplicate !== undefined) { skipped.push({ input_index: index, reason: "DUPLICATE_PENDING", existing: duplicate.id }); return; }
        if (fields.title === undefined) fields.title = defaultTitle(workspace, fields);
        createProposal(workspace, fields, [index], today, pointer, pointers, created);
        return;
      }
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
      // Flags and repeats live on a Review page's items: only an item a review_notes folds takes them (cli §5.6, capture-and-review §7.12.8).
      if (review === undefined && (item.unsure !== undefined || item.repeat !== undefined)) assertNoProblems([{ pointer: `${pointer}/${item.unsure !== undefined ? "unsure" : "repeat"}`, message: "is only allowed on an item a review_notes of the same input folds" }]);
      const flags = flagsOf(item);

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
        review.changes.push({ index, change: changeEntry(fields), passages: fields.passages, flags });
        return;
      }

      if (item.kind === "add_link") {
        const key = JSON.stringify([fields.target, fields.source, fields.field, fields.after]);
        if (linkKeys.has(key)) { duplicateLinks.push({ input_index: index, key }); return; }
        linkKeys.set(key, index);
        if (review !== undefined) review.links.push({ index, fields, flags });
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
      // One proposal for the group: it rests on every passage its links name (eligibility.md §9.1).
      fields.passages = [...new Set(group.flatMap(({ fields }) => fields.passages as string[]))];
      const proposal = createProposal(workspace, fields, group.map(({ index }) => index), today, `/proposals/${first.index}`, pointers, created);
      for (const link of group) createdLinks.set(JSON.stringify([link.fields.target, link.fields.source, link.fields.field, link.fields.after]), proposal.id);
    }
    for (const review of reviews.values()) {
      const notes = review.item.notes as string[];
      if (typeof review.item.fingerprint === "string") {
        const held = fingerprintDuplicate(workspace, review.item.fingerprint);
        if (held !== undefined) { skipped.push({ input_index: review.index, reason: "DUPLICATE_PENDING", existing: held.id }); continue; }
      }
      if (notes.length === 0 && review.links.length === 0 && review.changes.length === 0) {
        skipped.push({ input_index: review.index, reason: "NOTHING_TO_REVIEW" });
        continue;
      }
      const source = String(review.item.source);
      // Changes are stored in render order: every update_fact, then update_body, then add_to_note (spec/schema.md §11.3).
      const changes = [...review.changes].sort((a, b) => CHANGE_KINDS.indexOf(String(a.change.kind)) - CHANGE_KINDS.indexOf(String(b.change.kind)) || a.index - b.index);
      // Every independently decidable item gets an immutable id now, in the order the row lists them: changes, notes, links (spec/schema.md §11.3).
      const taken = new Set<string>();
      const links = review.links.map(({ fields }) => ({ target: fields.target, field: fields.field, value: fields.after }));
      const fresh = () => { const id = generateItemId(taken); taken.add(id); return id; };
      // Each item keeps the passages it rests on (schema §11.5): a change's and a link's from its own input item, a note's from note_passages.
      const notePassages = review.item.note_passages as Record<string, unknown>;
      const noteFlags = (isRecord(review.item.note_flags) ? review.item.note_flags : {}) as Record<string, Flags>;
      // The links of one target and field are one item, decided together (0088 Q5, schema §11): its ref lists their indexes.
      const linkGroups = new Map<string, number[]>();
      review.links.forEach(({ fields }, index) => { const key = JSON.stringify([fields.target, fields.field]); linkGroups.set(key, [...(linkGroups.get(key) ?? []), index]); });
      const items = [
        ...changes.map(({ passages, flags }, index) => ({ item_id: fresh(), kind: "change", ref: index, passages, ...flags })),
        ...notes.map((note) => ({ item_id: fresh(), kind: "note", ref: note, passages: notePassages[note], ...flagsOf(noteFlags[note] ?? {}) })),
        ...[...linkGroups.values()].map((indexes) => {
          const members = indexes.map((index) => review.links[index]!);
          const passages = [...new Set(members.flatMap(({ fields }) => (Array.isArray(fields.passages) ? fields.passages : []) as string[]))];
          const unsure = members.flatMap(({ flags }) => flags.unsure ?? []);
          const repeat = members.find(({ flags }) => flags.repeat !== undefined)?.flags.repeat;
          return { item_id: fresh(), kind: "link", ref: indexes, passages, ...(unsure.length === 0 ? {} : { unsure }), ...(repeat === undefined ? {} : { repeat }) };
        }),
      ];
      const fields: Record<string, unknown> = {
        kind: "review_notes",
        title: review.item.title ?? reviewTitle(workspace, source, changes.length, notes.length, review.links.length),
        notes,
        links,
        ...(changes.length === 0 ? {} : { changes: changes.map(({ change }) => change) }),
        items,
        why: review.item.why ?? `What came in from ${sourceTitle(workspace, source)}`,
        source,
        ...(typeof review.item.fingerprint === "string" ? { fingerprint: review.item.fingerprint, evidence: review.item.evidence } : {}),
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

/** A reflection item's fingerprint matches it, and its evidence names meetings and sources that exist (spec/cli.md §5.6, schema §11.4). */
function checkFingerprint(workspace: Workspace, item: Record<string, unknown>, pointer: string): void {
  const allowed = ["contradiction", "update_fact", "merge", "add_to_note", "review_notes", "new_item"];
  if (!allowed.includes(String(item.kind))) assertNoProblems([{ pointer: `${pointer}/fingerprint`, message: `a fingerprint goes on ${allowed.join(", ")}` }]);
  for (const [index, id] of (item.evidence as string[]).entries()) {
    if (workspace.get(id) === undefined) throw new BrainError("UNKNOWN_ID", `${pointer}/evidence/${index}: no note with id ${id}`, [{ pointer: `${pointer}/evidence/${index}`, message: "does not exist" }]);
  }
  const problem = fingerprintProblem(item, (id) => workspace.get(id));
  if (problem !== null) assertNoProblems([{ pointer: `${pointer}/${problem.key}`, message: problem.message }]);
}

/** A proposal with this fingerprint that is still waiting: pending, approved or edited (§5.6). */
function fingerprintDuplicate(workspace: Workspace, fingerprint: string): Note | undefined {
  return workspace.notes.find((note) => note.type === "proposal" && note.attributes.fingerprint === fingerprint && ["pending", "approved", "edited"].includes(String(note.attributes.status)));
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

/**
 * The passages of one input item (cli §5.6, eligibility.md §9.1): required on every kind but `review_notes` (its notes' in `note_passages`,
 * one list per listed note) and `notion_change` (none). Throws INPUT_INVALID or UNKNOWN_ID for the whole batch.
 */
function checkPassages(workspace: Workspace, item: Record<string, unknown>, pointer: string): void {
  // An unknown source is reported as such first, not as a passage that names it.
  if (typeof item.source === "string" && ID.test(item.source) && workspace.get(item.source) === undefined) {
    throw new BrainError("UNKNOWN_ID", `${pointer}/source: no note with id ${item.source}`, [{ pointer: `${pointer}/source`, message: "does not exist" }]);
  }
  const problems: InputProblem[] = [];
  const unknown: Array<{ pointer: string; id: string }> = [];
  const check = (value: unknown, at: string, text: string | null) => {
    const found = passageProblems(workspace, value, at, text);
    problems.push(...found.problems);
    unknown.push(...found.unknown.map((id) => ({ pointer: at, id })));
  };
  if (item.kind === "notion_change") {
    if (item.passages !== undefined) problems.push({ pointer: `${pointer}/passages`, message: "a notion_change changes Notion, not the brain: it takes no passages" });
  } else if (item.kind === "review_notes") {
    if (item.passages !== undefined) problems.push({ pointer: `${pointer}/passages`, message: "a review_notes names its notes' passages in note_passages" });
    const notes = Array.isArray(item.notes) ? item.notes.map(String) : [];
    const given = item.note_passages;
    if (notes.length > 0 && !isRecord(given)) problems.push({ pointer: `${pointer}/note_passages`, message: "is required: one list of passages per listed note (eligibility.md §9.1)" });
    else if (given !== undefined && !isRecord(given)) problems.push({ pointer: `${pointer}/note_passages`, message: "must be an object: note id → passages" });
    else {
      const map = (given ?? {}) as Record<string, unknown>;
      for (const key of Object.keys(map)) if (!notes.includes(key)) problems.push({ pointer: `${pointer}/note_passages/${key}`, message: "is not a note of notes" });
      for (const note of notes) check(map[note], `${pointer}/note_passages/${note}`, null);
    }
  } else {
    const text = [item.content, item.answer, isRecord(item.note) ? item.note.body : undefined].find((value): value is string => typeof value === "string") ?? null;
    check(item.passages, `${pointer}/passages`, text);
  }
  assertNoProblems(problems);
  const first = unknown[0];
  if (first !== undefined) throw new BrainError("UNKNOWN_ID", `${first.pointer}: no note with id ${first.id}`, [{ pointer: first.pointer, message: `${first.id} does not exist` }]);
}

/** An item's flags (capture-and-review §7.12.8): `unsure`, one-line strings, and `repeat`, a one-line key; empty when absent. */
type Flags = { unsure?: string[]; repeat?: string };
function flagsOf(item: Record<string, unknown>): Flags {
  return { ...(Array.isArray(item.unsure) ? { unsure: item.unsure.map(String) } : {}), ...(typeof item.repeat === "string" ? { repeat: item.repeat } : {}) };
}
const oneLine = (value: unknown): boolean => typeof value === "string" && value.trim() !== "" && !value.includes("\n");
function flagProblems(value: Record<string, unknown>, pointer: string): InputProblem[] {
  const problems: InputProblem[] = [];
  if (value.unsure !== undefined && (!Array.isArray(value.unsure) || value.unsure.length === 0 || !value.unsure.every(oneLine))) problems.push({ pointer: `${pointer}/unsure`, message: "must be a non-empty list of one-line strings" });
  if (value.repeat !== undefined && !oneLine(value.repeat)) problems.push({ pointer: `${pointer}/repeat`, message: "must be a one-line string" });
  return problems;
}

function checkShape(item: unknown, pointer: string): InputProblem[] {
  if (!isRecord(item)) return [{ pointer, message: "must be an object" }];
  const problems = unknownKeys(item, INPUT_KEYS, pointer);
  const at = (key: string, message: string) => problems.push({ pointer: `${pointer}/${key}`, message });
  if (!(PROPOSAL_KINDS as readonly unknown[]).includes(item.kind)) at("kind", `must be one of ${PROPOSAL_KINDS.join(", ")}`);
  const titled = item.kind !== "review_notes" && item.kind !== "notion_change" && item.kind !== "set_field";
  for (const key of titled ? ["title", "why", "source"] : item.kind === "review_notes" ? ["source"] : ["why", "source"]) {
    if (typeof item[key] !== "string" || item[key] === "") at(key, "must be a non-empty string");
  }
  for (const key of item.kind === "review_notes" ? ["title", "why"] : titled ? [] : ["title"]) {
    if (item[key] !== undefined && (typeof item[key] !== "string" || item[key] === "")) at(key, "must be a non-empty string");
  }
  if (item.kind === "review_notes") {
    if (item.target !== undefined) at("target", "a review_notes has no target");
    if (!Array.isArray(item.notes)) at("notes", "must be a list of note ids");
  } else if (item.notes !== undefined) {
    at("notes", "is only allowed on review_notes");
  }
  if (item.kind !== "review_notes" && item.note_passages !== undefined) at("note_passages", "is only allowed on review_notes");
  if (item.kind !== "review_notes" && item.note_flags !== undefined) at("note_flags", "is only allowed on review_notes");
  if (item.unsure !== undefined || item.repeat !== undefined) {
    if (item.kind !== "add_link" && !CHANGE_KINDS.includes(String(item.kind))) at(item.unsure !== undefined ? "unsure" : "repeat", "is only allowed on an item a review_notes folds");
    else problems.push(...flagProblems(item, pointer));
  }
  if (item.kind === "review_notes" && item.note_flags !== undefined) {
    if (!isRecord(item.note_flags)) at("note_flags", "must be an object: note id → { unsure?, repeat? }");
    else for (const [note, flags] of Object.entries(item.note_flags)) {
      const at2 = `${pointer}/note_flags/${note}`;
      if (!Array.isArray(item.notes) || !item.notes.includes(note)) problems.push({ pointer: at2, message: "is not a note of notes" });
      else if (!isRecord(flags)) problems.push({ pointer: at2, message: "must be an object" });
      else problems.push(...unknownKeys(flags, ["unsure", "repeat"], at2), ...flagProblems(flags, at2));
    }
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
  } else if (item.kind === "notion_change") {
    // Checked against the brain in checkNotionChange: a task has no target, a project or an Area does.
  } else if (typeof item.target !== "string") {
    at("target", "must be the id of an existing note");
  }
  for (const key of ["supersedes", "merge_into"]) {
    if (item[key] !== undefined && typeof item[key] !== "string") at(key, "must be a note id");
  }
  // A reflection answer (spec/cli.md §5.6, schema §11.4): fingerprint and evidence together, never with an assistant finding.
  if ((item.fingerprint === undefined) !== (item.evidence === undefined)) at(item.fingerprint === undefined ? "evidence" : "fingerprint", "fingerprint and evidence are given together");
  if (item.fingerprint !== undefined && item.finding !== undefined) at("finding", "is never given with a fingerprint");
  if (item.fingerprint !== undefined && typeof item.fingerprint !== "string") at("fingerprint", "must be a string");
  if (item.evidence !== undefined && (!Array.isArray(item.evidence) || item.evidence.some((id) => typeof id !== "string"))) at("evidence", "must be a list of meeting and source ids");
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
  if (kind === "notion_change") return { ...fields, noChange: checkNotionChange(workspace, item, pointer).noChange };
  if (kind === "set_field") {
    const { noChange } = resolveSetField(workspace, item, fields, pointer);
    return { ...fields, noChange };
  }
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
    if (target.attributes.origin === "promoted") invalid("target", `is a promoted Document; its body is yours, edited in Notion (0049)`);
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
  lifecycle?: string,
): { note: CreatedNote; meetingPath?: string; pointers: Map<string, string> } {
  const staged = stageNotes(workspace, [note], () => pointer, { now, ...(lifecycle === undefined ? {} : { lifecycle }) });
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
  let loaded: Context | undefined;
  const context = () => (loaded ??= contextFor(workspace.notes, requireSuppressions(workspace.root)));
  return workspace.notes
    .filter((note) => note.type === "proposal")
    .filter((note) => statuses.length === 0 || statuses.includes(String(note.attributes.status)))
    .filter((note) => target === undefined || note.attributes.target === target
      || (note.attributes.kind === "review_notes" && ((Array.isArray(note.attributes.notes) && note.attributes.notes.includes(target)) || reviewLinks(note.attributes).some((link) => link.target === target) || listOf(note.attributes.changes).some((change) => isRecord(change) && change.target === target))))
    // A held proposal's path is made from its title, so it goes with the title (cli §5.6).
    .map((note): Record<string, unknown> => { const form = heldForm(note, workspace, context()); return form.held === true || (Array.isArray(form.held) && form.title === undefined) ? form : { ...form, path: note.path }; })
    .sort((a, b) => compareCodePoints(String(a.created), String(b.created)) || compareCodePoints(String(a.id), String(b.id)));
}

/** What a held proposal is listed without: its wording, values and the metadata written from them (cli §5.6, eligibility.md §4.3, §9.4). */
const HELD_WITHOUT = ["title", "why", "before", "after", "from", "content", "answer", "answer_note", "note", "links", "supersedes", "merge_into", "fingerprint", "notion_published", "revisions"];

/** A proposal as `proposal list` shows it: whole, or, when withheld by cli §5.7's rule with the suppression records as they are now, marked
 *  `held` without its wording; on a review_notes, each held item without its wording, and the row's title and why when every item is held. */
function heldForm(note: Note, workspace: Workspace, context: Context): Record<string, unknown> {
  const a = note.attributes;
  const found = proposalWithheld(note, workspace, context);
  if (a.kind !== "review_notes") {
    if (!found.whole) return { ...a };
    return { ...Object.fromEntries(Object.entries(a).filter(([key]) => !HELD_WITHOUT.includes(key))), held: true };
  }
  const changes = listOf(a.changes);
  const links = listOf(a.links);
  const notes = listOf(a.notes).map(String);
  const heldChange = (index: number) => found.changes.has(index);
  const heldNote = (id: string) => found.notes.has(id);
  const heldLink = (index: number) => found.links.has(index);
  const held = [
    ...changes.flatMap((_change, index) => heldChange(index) ? [{ change: index }] : []),
    ...notes.flatMap((id) => heldNote(id) ? [{ note: id }] : []),
    ...links.flatMap((_link, index) => heldLink(index) ? [{ link: index }] : []),
  ];
  if (held.length === 0) return { ...a };
  const out: Record<string, unknown> = { ...a, held };
  out.changes = changes.map((change, index) => heldChange(index) && isRecord(change) ? Object.fromEntries(Object.entries(change).filter(([key]) => ["kind", "target", "field"].includes(key))) : change);
  if (Array.isArray(a.links)) out.links = links.map((link, index) => heldLink(index) && isRecord(link) ? { target: link.target, field: link.field } : link);
  if (a.changes === undefined) delete out.changes;
  const itemIds = new Set(listOf(a.items).filter(isRecord).filter((item) => (item.kind === "change" && heldChange(Number(item.ref))) || (item.kind === "note" && heldNote(String(item.ref))) || (item.kind === "link" && linkRefs(item.ref).some(heldLink))).map((item) => String(item.item_id)));
  if (Array.isArray(a.revisions)) out.revisions = a.revisions.filter((revision) => !(isRecord(revision) && itemIds.has(String(revision.item_id))));
  delete out.notion_published;
  if (held.length === changes.length + notes.length + links.length) { delete out.title; delete out.why; delete out.fingerprint; }
  return out;
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
