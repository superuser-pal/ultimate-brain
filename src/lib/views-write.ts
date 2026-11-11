import { BrainError } from "./errors.ts";
import { serializeNewFile } from "./frontmatter.ts";
import { generateId } from "./ids.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { formatDate, formatTimestamp } from "./time.ts";
import { eligibleNotes, contextFor, publishableNote, publishedTitle, requireSuppressions, type Loaded } from "./suppressions.ts";
import { areaBriefPath, deriveView, generatedBlockRange, projectViewPath, type ViewKind } from "./views.ts";
import type { Workspace } from "./workspace.ts";

export interface ViewTarget { owner: Note; kind: ViewKind; path: string }
export interface StagedViews { written: string[]; created: string[]; unchanged: string[]; errors: Array<{ path: string; reason: "MARKERS_INVALID" }> }

/** Every view target of the given projects and areas (spec/cli.md §5.9). */
export function viewTargets(projects: Note[], areas: Note[]): ViewTarget[] {
  return [
    ...projects.flatMap((project) => (["brief", "decision_log"] as const).map((kind) => ({ owner: project, kind, path: projectViewPath(project, kind) }))),
    ...areas.map((area) => ({ owner: area, kind: "area_brief" as const, path: areaBriefPath(area) })),
  ];
}

/** Stage the regenerated views; render only eligible evidence, so no derived view shows a restricted claim (capture-and-review §5.1). */
export function stageViews(workspace: Workspace, targets: ViewTarget[], now: Date, check: boolean, loaded?: Loaded): StagedViews {
  const state = loaded ?? requireSuppressions(workspace.root);
  const notes = eligibleNotes(workspace.notes, state);
  const context = contextFor(workspace.notes, state);
  const written: string[] = [];
  const created: string[] = [];
  const unchanged: string[] = [];
  const errors: Array<{ path: string; reason: "MARKERS_INVALID" }> = [];
  const ids = workspace.ids();

  for (const { owner: project, kind, path } of targets) {
    {
      const existing = workspace.notes.find((note) => note.path === path);
      // The owner is rendered from its published form too: a restricted project or area never contributes its facts or, with a restricted
      // claim, its title (cli §5.9).
      const owner = publishableNote(project, context);
      const derived = deriveView(owner, kind, notes);
      if (existing === undefined && workspace.exists(path)) {
        errors.push({ path, reason: "MARKERS_INVALID" });
        continue;
      }
      if (existing === undefined) {
        created.push(path);
        if (!check) {
          const id = generateId("vw", ids);
          ids.add(id);
          workspace.write(path, serializeNewFile(newViewAttributes(id, owner, kind, derived.generatedFrom, now), `${derived.generatedBlock}\n\n<!-- @user:start -->\n<!-- @user:end -->\n`));
        }
        continue;
      }
      const owned = kind === "area_brief" ? existing.attributes.area === project.id : existing.attributes.project === project.id;
      const range = existing.type === "view" && owned && existing.attributes.view_kind === kind
        ? generatedBlockRange(existing.body)
        : undefined;
      if (range === undefined) {
        errors.push({ path, reason: "MARKERS_INVALID" });
        continue;
      }
      const currentFrom = Array.isArray(existing.attributes.generated_from) ? existing.attributes.generated_from : [];
      const unchangedView = existing.body.slice(range.start, range.end) === derived.generatedBlock
        && sameStrings(currentFrom, derived.generatedFrom);
      if (unchangedView) {
        unchanged.push(path);
        continue;
      }
      written.push(path);
      if (!check) {
        const document = workspace.edit(existing);
        document.attributes.generated_from = derived.generatedFrom;
        document.attributes.generated_at = formatTimestamp(now);
        document.attributes.updated = formatDate(now);
        document.body = `${existing.body.slice(0, range.start)}${derived.generatedBlock}${existing.body.slice(range.end)}`;
        workspace.save(path, document);
      }
    }
  }

  written.sort(compareCodePoints);
  created.sort(compareCodePoints);
  unchanged.sort(compareCodePoints);
  errors.sort((left, right) => compareCodePoints(left.path, right.path));
  return { written, created, unchanged, errors };
}

function newViewAttributes(id: string, owner: Note, kind: ViewKind, generatedFrom: string[], now: Date): Record<string, unknown> {
  const suffix = kind === "decision_log" ? "decision log" : "brief";
  return {
    id,
    type: "view",
    title: `${String(publishedTitle(owner))} — ${suffix}`,
    view_kind: kind,
    ...(kind === "area_brief" ? { area: owner.id } : { project: owner.id }),
    generated_from: generatedFrom,
    generated_at: formatTimestamp(now),
    created: formatDate(now),
    updated: formatDate(now),
  };
}

function sameStrings(left: unknown[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
