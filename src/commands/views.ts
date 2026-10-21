import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { serializeNewFile } from "../lib/frontmatter.ts";
import { generateId } from "../lib/ids.ts";
import { compareCodePoints, type Note } from "../lib/notes.ts";
import { formatDate, formatTimestamp } from "../lib/time.ts";
import { areaBriefPath, deriveView, generatedBlockRange, projectViewPath, type ViewKind } from "../lib/views.ts";
import { Workspace } from "../lib/workspace.ts";

/** `brain views [--project <id> | --area <id>] [--check]` (spec/cli.md §5.9). */
export const viewsCommand: Command = {
  name: "views",
  usage: "brain views [--project <id> | --area <id>] [--check] [--json]",
  summary: "Regenerate project briefs, decision logs and area briefs while preserving user blocks.",
  options: { project: "string", area: "string", check: "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const workspace = await Workspace.open(brain!);
    const requested = args.options.project as string | undefined;
    const requestedArea = args.options.area as string | undefined;
    if (requested !== undefined && requestedArea !== undefined) throw new BrainError("USAGE", "Use --project or --area, not both");
    let projects = requestedArea === undefined ? workspace.notes.filter((note) => note.type === "project") : [];
    let areas = requested === undefined ? workspace.notes.filter((note) => note.type === "area") : [];
    if (requested !== undefined) {
      const project = workspace.get(requested);
      if (project?.type !== "project") throw new BrainError("UNKNOWN_ID", `No project with id ${requested}`);
      projects = [project];
    }
    if (requestedArea !== undefined) {
      const area = workspace.get(requestedArea);
      if (area?.type !== "area") throw new BrainError("UNKNOWN_ID", `No area with id ${requestedArea}`);
      areas = [area];
    }
    projects.sort((left, right) => compareCodePoints(left.path, right.path));
    areas.sort((left, right) => compareCodePoints(left.path, right.path));
    const targets = [
      ...projects.flatMap((project) => (["brief", "decision_log"] as const).map((kind) => ({ owner: project, kind, path: projectViewPath(project, kind) }))),
      ...areas.map((area) => ({ owner: area, kind: "area_brief" as const, path: areaBriefPath(area) })),
    ];

    const written: string[] = [];
    const created: string[] = [];
    const unchanged: string[] = [];
    const errors: Array<{ path: string; reason: "MARKERS_INVALID" }> = [];
    const ids = workspace.ids();
    const check = args.options.check === true;

    for (const { owner: project, kind, path } of targets) {
      {
        const existing = workspace.notes.find((note) => note.path === path);
        const derived = deriveView(project, kind, workspace.notes);
        if (existing === undefined && workspace.exists(path)) {
          errors.push({ path, reason: "MARKERS_INVALID" });
          continue;
        }
        if (existing === undefined) {
          created.push(path);
          if (!check) {
            const id = generateId("vw", ids);
            ids.add(id);
            workspace.write(path, serializeNewFile(newViewAttributes(id, project, kind, derived.generatedFrom, now), `${derived.generatedBlock}\n\n<!-- @user:start -->\n<!-- @user:end -->\n`));
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

    if (!check && workspace.changedPaths.length > 0) {
      const invalid = workspace.newErrors();
      if (invalid.length > 0) {
        throw new BrainError("INPUT_INVALID", `Generated views would add lint errors: ${invalid.map((issue) => `${issue.path} ${issue.rule}`).join(", ")}`);
      }
      await workspace.commit();
    }
    written.sort(compareCodePoints);
    created.sort(compareCodePoints);
    unchanged.sort(compareCodePoints);
    errors.sort((left, right) => compareCodePoints(left.path, right.path));
    const exitCode = errors.length > 0 || (check && (written.length > 0 || created.length > 0)) ? 1 : 0;
    return {
      data: { projects: projects.length, areas: areas.length, written, created, unchanged, errors, check },
      exitCode,
      human: errors.length > 0 ? `${errors.map((error) => `${error.path}: ${error.reason}`).join("\n")}\n` : "Views are current.\n",
    };
  },
};

function newViewAttributes(id: string, owner: Note, kind: ViewKind, generatedFrom: string[], now: Date): Record<string, unknown> {
  const suffix = kind === "decision_log" ? "decision log" : "brief";
  return {
    id,
    type: "view",
    title: `${String(owner.attributes.title)} — ${suffix}`,
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
