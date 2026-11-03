import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { isRecord } from "./input.ts";

// Workflow records in the brain (spec/connected-workflows.md §3.2): `_workflows/<wf-id>/`.

export const WORKFLOWS_DIR = "_workflows";

export interface WorkflowSummary { id: string; state: string; folder: { name: string; repo?: string }; destination: { project?: string; area?: string } }

/** Every `workflow.json` that parses, ordered by id. Unreadable records are left to lint's `workflow-record`. */
export function listWorkflows(root: string): WorkflowSummary[] {
  const dir = join(root, WORKFLOWS_DIR);
  if (!existsSync(dir)) return [];
  const out: WorkflowSummary[] = [];
  for (const name of readdirSync(dir).sort()) {
    try {
      const value = JSON.parse(readFileSync(join(dir, name, "workflow.json"), "utf8"));
      if (isRecord(value) && typeof value.id === "string") out.push(value as unknown as WorkflowSummary);
    } catch { /* not a record */ }
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The open (connected or paused) workflow whose `folder.repo` is this repo, as `{ id, state }`, or null (§3.1 allows at most one). */
export function openWorkflowForRepo(root: string, repo: string): { id: string; state: string } | null {
  const found = listWorkflows(root).find((workflow) => workflow.folder?.repo === repo && (workflow.state === "connected" || workflow.state === "paused"));
  return found === undefined ? null : { id: found.id, state: found.state };
}
