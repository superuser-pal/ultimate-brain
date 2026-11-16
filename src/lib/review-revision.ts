import { isRecord } from "./input.ts";
import type { Note } from "./notes.ts";
import type { ReviewRevision } from "./review-plan.ts";
import type { Workspace } from "./workspace.ts";

// Request revision, read once by the 0.16.0 transition (cli §5.14.8): the request is recorded and the item stays pending; the migration's
// session asks the item's question with the instruction shown and never redrafts it (capture-and-review §7.9).

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

export interface Revision { item_id: string; instruction: string; requested_at: string; status: "requested" | "drafted"; previous?: string; drafted_at?: string }
export const revisionsOf = (proposal: Note): Revision[] => list(proposal.attributes.revisions).filter(isRecord) as unknown as Revision[];

/** Record each `Request revision` the plan read (an attended run only: an unattended run never reads revision text, 0051). The item stays pending. `asOf` is the plan's. */
export function recordRevisionRequests(workspace: Workspace, requests: readonly ReviewRevision[], asOf: string, now: Date, today: string): Array<{ proposal: string; item_id: string; result: "recorded" | "skipped"; reason?: string }> {
  const out: Array<{ proposal: string; item_id: string; result: "recorded" | "skipped"; reason?: string }> = [];
  for (const request of requests) {
    const skip = (reason: string) => out.push({ proposal: request.proposal, item_id: request.item_id, result: "skipped", reason });
    const proposal = workspace.get(request.proposal);
    if (proposal === undefined || proposal.type !== "proposal" || !list(proposal.attributes.items).some((item) => record(item).item_id === request.item_id)) { skip("UNKNOWN_ITEM"); continue; }
    if (request.instruction === null || request.instruction.trim() === "") { skip("NO_INSTRUCTION"); continue; }
    if (proposal.attributes.status !== "pending" || list(proposal.attributes.item_decisions).some((done) => record(done).item_id === request.item_id)) { skip("ALREADY_DECIDED"); continue; }
    const item = record(list(proposal.attributes.items).find((entry) => record(entry).item_id === request.item_id));
    if (["remove", "restore", "independence"].includes(String(item.kind)) || severalLinks(item)) { skip("REVISION_NOT_SUPPORTED"); continue; }
    const existing = revisionsOf(proposal).find((entry) => entry.item_id === request.item_id);
    if (existing?.status === "requested" && existing.instruction === request.instruction) { skip("ALREADY_REQUESTED"); continue; }
    // A plan read before the draft was written cannot be asking about it: replaying it is a no-op (cli §5.27, CC-218).
    if (existing?.status === "drafted" && (existing.drafted_at === undefined || Date.parse(asOf) <= Date.parse(existing.drafted_at))) { skip("STALE_PLAN"); continue; }
    const document = workspace.edit(proposal);
    const entry: Revision = { item_id: request.item_id, instruction: request.instruction.trim(), requested_at: now.toISOString().replace(/\.\d{3}Z$/, "Z"), status: "requested" };
    document.attributes.revisions = [...revisionsOf(proposal).filter((candidate) => candidate.item_id !== request.item_id), entry];
    document.attributes.updated = today;
    workspace.save(proposal.path, document);
    out.push({ proposal: request.proposal, item_id: request.item_id, result: "recorded" });
  }
  return out;
}

/** A grouped link item of more than one value (0088 Q5): the user deletes names on the page; there is no single value to redraft. */
function severalLinks(item: Record<string, unknown>): boolean {
  return item.kind === "link" && Array.isArray(item.ref) && item.ref.length > 1;
}
