import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { serializeNewFile } from "../lib/frontmatter.ts";
import { generateId } from "../lib/ids.ts";
import { compareCodePoints, type Note } from "../lib/notes.ts";
import { formatDate, formatTimestamp } from "../lib/time.ts";
import { deriveView, generatedBlockRange, projectViewPath, type ViewKind } from "../lib/views.ts";
import { Workspace } from "../lib/workspace.ts";

/** `brain views [--project <id>] [--check]` (spec/cli.md §5.9). */
export const viewsCommand: Command = {
  name: "views",
  usage: "brain views [--project <id>] [--check] [--json]",
  summary: "Regenerate project briefs and decision logs while preserving user blocks.",
  options: { project: "string", check: "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const workspace = await Workspace.open(brain!);
    const requested = args.options.project as string | undefined;
    let projects = workspace.notes.filter((note) => note.type === "project");
    if (requested !== undefined) {
      const project = workspace.get(requested);
      if (project?.type !== "project") throw new BrainError("UNKNOWN_ID", `No project with id ${requested}`);
      projects = [project];
    }
    projects.sort((left, right) => compareCodePoints(left.path, right.path));

    const written: string[] = [];
    const created: string[] = [];
    const unchanged: string[] = [];
    const errors: Array<{ path: string; reason: "MARKERS_INVALID" }> = [];
    const ids = workspace.ids();
    const check = args.options.check === true;

    for (const project of projects) {
      for (const kind of ["brief", "decision_log"] as const) {
        const path = projectViewPath(project, kind);
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
        const range = existing.type === "view" && existing.attributes.project === project.id && existing.attributes.view_kind === kind
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
      data: { projects: projects.length, written, created, unchanged, errors, check },
      exitCode,
      human: errors.length > 0 ? `${errors.map((error) => `${error.path}: ${error.reason}`).join("\n")}\n` : "Views are current.\n",
    };
  },
};

function newViewAttributes(id: string, project: Note, kind: ViewKind, generatedFrom: string[], now: Date): Record<string, unknown> {
  const suffix = kind === "brief" ? "brief" : "decision log";
  return {
    id,
    type: "view",
    title: `${String(project.attributes.title)} — ${suffix}`,
    view_kind: kind,
    project: project.id,
    generated_from: generatedFrom,
    generated_at: formatTimestamp(now),
    created: formatDate(now),
    updated: formatDate(now),
  };
}

function sameStrings(left: unknown[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
