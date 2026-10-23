import { posix } from "node:path";

import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { serializeNewFile } from "../lib/frontmatter.ts";
import { generateId } from "../lib/ids.ts";
import { assertNoProblems, isRecord, readJsonInput, unknownKeys, type InputProblem } from "../lib/input.ts";
import { compareCodePoints } from "../lib/notes.ts";
import { slugify } from "../lib/paths.ts";
import { formatDate, formatTimestamp } from "../lib/time.ts";
import { Workspace } from "../lib/workspace.ts";

/** The six sections of a report, in order (spec/schema.md §16.4). */
const SECTIONS = ["Where it stands", "Timeline", "Decisions in force", "Open questions and risks", "People involved", "Gaps"];

/** `brain report new --input <file|->` (spec/cli.md §5.18, 0043). */
export const reportNewCommand: Command = {
  name: "report new",
  usage: "brain report new --input <file|-> [--json]",
  summary: "Store a report the query skill wrote, as a dated view in reports/, or rewrite one in place with \"refresh\".",
  options: { input: "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const input = await readJsonInput(args.options.input as string | undefined, "report new");
    if (!isRecord(input)) assertNoProblems([{ pointer: "", message: "must be an object" }]);
    const item = input as Record<string, unknown>;
    const problems: InputProblem[] = unknownKeys(item, ["title", "question", "asked_in", "projects", "area", "body", "refresh"], "");
    const refresh = item.refresh;
    if (refresh !== undefined && typeof refresh !== "string") problems.push({ pointer: "/refresh", message: "must be a report id" });
    // A refresh keeps the report's question and, unless given, its title (0045).
    for (const key of refresh === undefined ? ["title", "question", "body"] : ["body", ...["title", "question"].filter((key) => item[key] !== undefined)]) if (typeof item[key] !== "string" || (item[key] as string).trim() === "") problems.push({ pointer: `/${key}`, message: "must be a non-empty string" });
    if (item.asked_in !== undefined && (typeof item.asked_in !== "string" || item.asked_in === "")) problems.push({ pointer: "/asked_in", message: "must be the Ask row's page id" });
    if (item.projects !== undefined && (!Array.isArray(item.projects) || item.projects.some((id) => typeof id !== "string"))) problems.push({ pointer: "/projects", message: "must be a list of project ids" });
    if (item.area !== undefined && typeof item.area !== "string") problems.push({ pointer: "/area", message: "must be an area id" });
    assertNoProblems(problems);

    const body = `${(item.body as string).replace(/\r\n?/g, "\n").replace(/^\n+/, "").replace(/\n*$/, "")}\n`;
    const headings = sectionHeadings(body);
    if (!body.startsWith("## ") || headings.length !== SECTIONS.length || headings.some((heading, index) => heading !== SECTIONS[index])) {
      assertNoProblems([{ pointer: "/body", message: `must be exactly the ## sections ${SECTIONS.join(", ")}, in order, with nothing before the first` }]);
    }

    const workspace = await Workspace.open(brain!);
    const report = typeof refresh === "string" ? workspace.get(refresh) : undefined;
    if (typeof refresh === "string" && (report === undefined || report.type !== "view" || report.attributes.view_kind !== "report")) assertNoProblems([{ pointer: "/refresh", message: `${refresh} is not a report` }]);
    const known = (pointer: string, id: string, type: string) => {
      const note = workspace.get(id);
      if (note === undefined) throw new BrainError("UNKNOWN_ID", `${pointer}: no note with id ${id}`, [{ pointer, message: "does not exist" }]);
      if (note.type !== type) assertNoProblems([{ pointer, message: `${id} is a ${note.type}, not a ${type}` }]);
    };
    (item.projects as string[] | undefined)?.forEach((id, index) => known(`/projects/${index}`, id, "project"));
    if (typeof item.area === "string") known("/area", item.area, "area");

    // Every relative link must name a note; generated_from lists them (spec/schema.md §16.4).
    const byPath = new Map(workspace.notes.map((note) => [note.path, note.id]));
    const linked = new Set<string>();
    const broken: InputProblem[] = [];
    for (const match of body.matchAll(/\]\(\s*<?([^)\s>]+)>?\s*\)/g)) {
      const target = match[1]!;
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue;
      let decoded = target.split(/[?#]/)[0]!;
      try { decoded = decodeURIComponent(decoded); } catch { /* keep as written */ }
      const id = byPath.get(posix.normalize(posix.join("reports", decoded)));
      if (id === undefined) broken.push({ pointer: "/body", message: `link ${target} doesn't resolve to a note` });
      else linked.add(id);
    }
    assertNoProblems(broken);

    const date = formatDate(now);
    if (report !== undefined) {
      // Refresh (0045): the same file, id, question and notion; the new body and its sources.
      const document = workspace.edit(report);
      const a = document.attributes;
      if (item.title !== undefined) a.title = item.title;
      if (item.projects !== undefined) { if ((item.projects as string[]).length === 0) delete a.projects; else a.projects = item.projects; }
      if (item.area !== undefined) a.area = item.area;
      if (item.asked_in !== undefined) {
        const asked = a.asked_in === undefined ? [] : Array.isArray(a.asked_in) ? a.asked_in : [a.asked_in];
        const all = asked.includes(item.asked_in) ? asked : [...asked, item.asked_in];
        a.asked_in = all.length === 1 ? all[0] : all;
      }
      a.generated_from = [...linked].sort(compareCodePoints);
      a.generated_at = formatTimestamp(now);
      a.updated = date;
      document.body = `\n${body}`;
      workspace.save(report.path, document);
      const errors = workspace.newErrors();
      if (errors.length > 0) assertNoProblems(errors.map((issue) => ({ pointer: "", message: `${issue.path}: ${issue.rule}: ${issue.message}` })));
      await workspace.commit([{ op: "report-refresh", id: report.id, title: String(a.title) }], now);
      return { data: { id: report.id, path: report.path, generated_from: a.generated_from }, human: `refreshed ${report.path}\n` };
    }
    const id = generateId("vw", workspace.ids());
    let path = `reports/${date}-${slugify(item.title as string)}.md`;
    for (let n = 2; workspace.exists(path); n += 1) path = `reports/${date}-${slugify(item.title as string)}-${n}.md`;
    const attributes: Record<string, unknown> = {
      id, type: "view", title: item.title, view_kind: "report",
      ...(item.area === undefined ? {} : { area: item.area }),
      ...(item.projects === undefined || (item.projects as string[]).length === 0 ? {} : { projects: item.projects }),
      question: item.question,
      ...(item.asked_in === undefined ? {} : { asked_in: item.asked_in }),
      generated_from: [...linked].sort(compareCodePoints),
      generated_at: formatTimestamp(now),
      created: date, updated: date,
    };
    workspace.write(path, serializeNewFile(attributes, body));
    const errors = workspace.newErrors();
    if (errors.length > 0) assertNoProblems(errors.map((issue) => ({ pointer: "", message: `${issue.path}: ${issue.rule}: ${issue.message}` })));
    await workspace.commit([{ op: "report-new", id, title: item.title as string }], now);
    return { data: { id, path, generated_from: attributes.generated_from }, human: `created ${path}\n` };
  },
};

/** The `##` headings outside fenced code, in order. */
function sectionHeadings(body: string): string[] {
  const headings: string[] = [];
  let fence: string | undefined;
  for (const line of body.split("\n")) {
    const open = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence !== undefined) { if (open !== undefined && open[0] === fence[0] && open.length >= fence.length) fence = undefined; continue; }
    if (open !== undefined) { fence = open; continue; }
    const heading = /^## (.+?)\s*$/.exec(line)?.[1];
    if (heading !== undefined) headings.push(heading);
  }
  return headings;
}

/** `brain report fix <vw-id> --text <text> --proposals <ids>` (spec/cli.md §5.18, 0045). */
export const reportFixCommand: Command = {
  name: "report fix",
  usage: "brain report fix <vw-id> --text <text> --proposals <prp-id>[,<prp-id>…] [--json]",
  summary: "Record a What to fix written on a Report row, with the proposals it became.",
  options: { text: "string", proposals: "string" },
  maxPositionals: 1,
  needsBrain: true,
  async run({ args, brain, now }) {
    const [id] = args.positionals;
    if (id === undefined) throw new BrainError("USAGE", "Name the report: brain report fix <vw-id> --text <text> --proposals <ids>");
    const text = args.options.text as string | undefined;
    const listed = args.options.proposals as string | undefined;
    if (text === undefined || text.trim() === "") throw new BrainError("USAGE", "--text is the What to fix you read on the Report row");
    if (listed === undefined) throw new BrainError("USAGE", "--proposals lists the proposals the fix became (an empty value when none)");
    const workspace = await Workspace.open(brain!);
    const report = workspace.get(id);
    if (report === undefined) throw new BrainError("UNKNOWN_ID", `No note with id ${id}`);
    if (report.type !== "view" || report.attributes.view_kind !== "report") assertNoProblems([{ pointer: "", message: `${id} is not a report` }]);
    const proposals = listed.split(",").map((value) => value.trim()).filter((value) => value !== "");
    for (const proposal of proposals) if (workspace.get(proposal)?.type !== "proposal") throw new BrainError("UNKNOWN_ID", `No proposal with id ${proposal}`);
    const document = workspace.edit(report);
    const fixes = [...(Array.isArray(document.attributes.fixes) ? document.attributes.fixes : []), { text, received: formatTimestamp(now), proposals }];
    document.attributes.fixes = fixes;
    document.attributes.updated = formatDate(now);
    workspace.save(report.path, document);
    const errors = workspace.newErrors();
    if (errors.length > 0) assertNoProblems(errors.map((issue) => ({ pointer: "", message: `${issue.path}: ${issue.rule}: ${issue.message}` })));
    await workspace.commit([{ op: "report-fix", id: report.id, title: String(document.attributes.title) }], now);
    return { data: { id: report.id, fixes: fixes.length }, human: `recorded fix ${fixes.length} on ${report.path}\n` };
  },
};
