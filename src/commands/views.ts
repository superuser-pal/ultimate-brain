import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { compareCodePoints } from "../lib/notes.ts";
import { stageViews, viewTargets } from "../lib/views-write.ts";
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
    const check = args.options.check === true;
    const { written, created, unchanged, errors } = stageViews(workspace, viewTargets(projects, areas), now, check);

    if (!check && workspace.changedPaths.length > 0) {
      const invalid = workspace.newErrors();
      if (invalid.length > 0) {
        throw new BrainError("INPUT_INVALID", `Generated views would add lint errors: ${invalid.map((issue) => `${issue.path} ${issue.rule}`).join(", ")}`);
      }
      await workspace.commit();
    }
    const exitCode = errors.length > 0 || (check && (written.length > 0 || created.length > 0)) ? 1 : 0;
    return {
      data: { projects: projects.length, areas: areas.length, written, created, unchanged, errors, check },
      exitCode,
      human: errors.length > 0 ? `${errors.map((error) => `${error.path}: ${error.reason}`).join("\n")}\n` : "Views are current.\n",
    };
  },
};
