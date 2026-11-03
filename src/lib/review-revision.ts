import { isRecord } from "./input.ts";
import type { Note } from "./notes.ts";
import { bodyOf } from "./proposals.ts";
import type { ReviewRevision } from "./review-plan.ts";
import { linkValue, Skip, typed } from "./review-apply.ts";
import type { Workspace } from "./workspace.ts";

// Request revision (capture-and-review §7.8): the request is recorded, the new draft replaces the stored proposal, and the user's earlier wording is kept.

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

export interface Revision { item_id: string; instruction: string; requested_at: string; status: "requested" | "drafted"; previous?: string; drafted_at?: string }
export const revisionsOf = (proposal: Note): Revision[] => list(proposal.attributes.revisions).filter(isRecord) as unknown as Revision[];

/** Record each `Request revision` the plan read (an attended run only: an unattended run never reads revision text, 0051). The item stays pending. */
export function recordRevisionRequests(workspace: Workspace, requests: readonly ReviewRevision[], now: Date, today: string): Array<{ proposal: string; item_id: string; result: "recorded" | "skipped"; reason?: string }> {
  const out: Array<{ proposal: string; item_id: string; result: "recorded" | "skipped"; reason?: string }> = [];
  for (const request of requests) {
    const skip = (reason: string) => out.push({ proposal: request.proposal, item_id: request.item_id, result: "skipped", reason });
    const proposal = workspace.get(request.proposal);
    if (proposal === undefined || proposal.type !== "proposal" || !list(proposal.attributes.items).some((item) => record(item).item_id === request.item_id)) { skip("UNKNOWN_ITEM"); continue; }
    if (request.instruction === null || request.instruction.trim() === "") { skip("NO_INSTRUCTION"); continue; }
    if (proposal.attributes.status !== "pending" || list(proposal.attributes.item_decisions).some((done) => record(done).item_id === request.item_id)) { skip("ALREADY_DECIDED"); continue; }
    if (["remove", "restore", "independence"].includes(String(record(list(proposal.attributes.items).find((item) => record(item).item_id === request.item_id)).kind))) { skip("REVISION_NOT_SUPPORTED"); continue; }
    const existing = revisionsOf(proposal).find((entry) => entry.item_id === request.item_id);
    if (existing?.status === "requested" && existing.instruction === request.instruction) { skip("ALREADY_REQUESTED"); continue; }
    const document = workspace.edit(proposal);
    const entry: Revision = { item_id: request.item_id, instruction: request.instruction.trim(), requested_at: now.toISOString().replace(/\.\d{3}Z$/, "Z"), status: "requested" };
    document.attributes.revisions = [...revisionsOf(proposal).filter((candidate) => candidate.item_id !== request.item_id), entry];
    document.attributes.updated = today;
    workspace.save(proposal.path, document);
    out.push({ proposal: request.proposal, item_id: request.item_id, result: "recorded" });
  }
  return out;
}

export interface Revised { proposal: string; item_id: string; kind: string }

/** Replace the stored proposal of a revision-requested item with the new draft, keeping the previous wording (`brain proposal revise`). Nothing is accepted. */
export function reviseItem(workspace: Workspace, input: { proposal: string; item_id: string; proposed: string; previous: string }, now: Date, today: string): Revised {
  const proposal = workspace.get(input.proposal);
  if (proposal === undefined || proposal.type !== "proposal") throw new Skip("UNKNOWN_ID", `No proposal ${input.proposal}`);
  const a = proposal.attributes;
  if (a.status !== "pending") throw new Skip("ALREADY_TERMINAL");
  const entry = list(a.items).map(record).find((item) => item.item_id === input.item_id);
  if (entry === undefined) throw new Skip("UNKNOWN_ITEM");
  const request = revisionsOf(proposal).find((candidate) => candidate.item_id === input.item_id);
  if (request === undefined || request.status !== "requested") throw new Skip("NO_REVISION_REQUESTED", "the user has not asked for a revision of this item");
  if (list(a.item_decisions).some((done) => record(done).item_id === input.item_id)) throw new Skip("ALREADY_DECIDED");
  if (input.proposed.trim() === "") throw new Skip("UNREADABLE_PROPOSED", "a revision cannot be empty");
  const document = workspace.edit(proposal);
  if (entry.kind === "note") {
    const note = workspace.get(String(entry.ref));
    if (note === undefined || note.attributes.lifecycle !== "draft") throw new Skip("NOT_A_DRAFT", `${String(entry.ref)} is not a draft`);
    const draft = workspace.edit(note);
    draft.body = bodyOf(input.proposed);
    workspace.save(note.path, draft);
  } else if (entry.kind === "link") {
    const links = list(document.attributes.links).map(record);
    const link = links[Number(entry.ref)];
    if (link === undefined) throw new Skip("UNKNOWN_ITEM");
    link.value = linkValue(workspace, input.proposed, link.value);
    document.attributes.links = links;
  } else {
    const changes = list(document.attributes.changes).map(record);
    const change = changes[Number(entry.ref)];
    if (change === undefined) throw new Skip("UNKNOWN_ITEM");
    if (change.kind === "update_fact") change.after = typed(input.proposed, change.after);
    else if (change.kind === "update_body" || change.kind === "add_to_note") change.content = input.proposed;
    else throw new Skip("REVISION_NOT_SUPPORTED", `${String(change.kind)} has no editable wording`);
    document.attributes.changes = changes;
  }
  document.attributes.revisions = revisionsOf(proposal).map((candidate) => (candidate.item_id === input.item_id ? { ...candidate, status: "drafted", previous: input.previous, drafted_at: now.toISOString().replace(/\.\d{3}Z$/, "Z") } : candidate));
  document.attributes.updated = today;
  workspace.save(proposal.path, document);
  return { proposal: proposal.id, item_id: input.item_id, kind: String(entry.kind) };
}
