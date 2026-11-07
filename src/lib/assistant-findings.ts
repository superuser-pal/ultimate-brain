import { DAY_MS, DISMISS_DAYS, type Dismissal } from "./assistant-dismissals.ts";
import { isRecord } from "./input.ts";
import { modulesOf } from "./modules.ts";
import { compareCodePoints, type Note } from "./notes.ts";

// The deterministic half of Ultimate Assistant: signals, recommendations, scope, ranking and the cap (spec/assistant.md §2.1, §3).

export const TASK_OVERDUE_DAYS = 3;
export const TASK_STALLED_DAYS = 14;
export const PROJECT_STALLED_DAYS = 21;
export const MISPLACED_MIN_NOTES = 3;

export const SIGNALS = [
  "task_overdue", "task_stalled", "project_stalled", "project_no_next_step", "project_done_but_open",
  "project_misplaced", "project_duplicate", "task_no_project", "area_no_domain", "area_empty",
] as const;
export type Signal = (typeof SIGNALS)[number];

const CATEGORY: Record<Signal, "overdue" | "stalled" | "no next step" | "structure"> = {
  task_overdue: "overdue", task_stalled: "stalled", project_stalled: "stalled", project_no_next_step: "no next step",
  project_done_but_open: "no next step", project_misplaced: "structure", project_duplicate: "structure",
  task_no_project: "structure", area_no_domain: "structure", area_empty: "structure",
};
const CATEGORY_ORDER = ["overdue", "stalled", "no next step", "structure"];
/** §3.5: the table's order, except project_stalled before task_stalled. */
const RANK_ORDER: readonly Signal[] = [
  "task_overdue", "project_stalled", "task_stalled", "project_no_next_step", "project_done_but_open",
  "project_misplaced", "project_duplicate", "task_no_project", "area_no_domain", "area_empty",
];

export const SIGNAL_LABELS: Record<Signal, string> = {
  task_overdue: "overdue tasks", task_stalled: "stalled tasks", project_stalled: "stalled projects",
  project_no_next_step: "projects with no next step", project_done_but_open: "finished projects still open",
  project_misplaced: "misplaced projects", project_duplicate: "duplicate projects", task_no_project: "tasks with no project",
  area_no_domain: "Areas without a Domain", area_empty: "empty Areas",
};

const STOP_WORDS = new Set("a an and the of for to in on project de del la el los las y en para proyecto".split(" "));
const ACTIVITY_KINDS = ["task_done", "meeting", "note", "source", "project_note"] as const;
type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface TaskRow { page_id: string; title: string; status: string | null; due: string | null; projects: string[]; areas: string[]; created: string; last_edited: string }
export interface ProjectRow { page_id: string; brain_id: string | null; title: string; status: string | null; archived: boolean; last_edited: string }
export interface AreaRow { page_id: string; brain_id: string | null; title: string; archived: boolean }
export interface RepoEntry { name: string; rollup?: { target?: { project?: string; area?: string }; counts?: Record<string, number> }; error?: string }
export interface Snapshot {
  as_of: string;
  notion: "live" | "unreachable";
  task_statuses?: Array<{ name: string; group: string | null }>;
  tasks?: TaskRow[];
  projects?: ProjectRow[];
  areas?: AreaRow[];
  repos: RepoEntry[];
}

export interface Recommendation { letter: string; action: string; value: unknown; label: string }
export interface StatusOffer { action: string; value: string }
export interface Finding {
  rank: number;
  key: string;
  signal: Signal;
  category: string;
  subject: Record<string, unknown>;
  project: string | null;
  area: string | null;
  evidence: Record<string, unknown>;
  recommendations: Recommendation[];
  status_offers: StatusOffer[];
}

/** A finding with what the report needs to word it (assistant.md §4.1); `text` is dropped from the output. */
export interface RankedFinding extends Finding {
  text: { subject: string; evidence: string; title: string; days: number | null };
  /** The ids (and `notion:<page>` for a task) a subject key in `--exclude` names. */
  subjectKeys: string[];
  /** Note ids in the subject's reach (§3.5 scope). */
  reach: Set<string>;
}

export interface SkippedSignal { signal: Signal; reason: "NOTION_UNREACHABLE" | "MODULE_OFF" | "NOT_MAPPED"; property?: "status" | "due" | "project" }

export interface FindingsInput {
  snapshot: Snapshot;
  notes: readonly Note[];
  config: Record<string, unknown>;
  dismissals: readonly Dismissal[];
  scope: Note | null;
  exclude: ReadonlySet<string>;
  limit: number;
  numberFrom: number;
}

export interface FindingsResult {
  mode: "live" | "brain_only";
  read: { tasks: number; projects: number; areas: number; projects_not_in_brain: number; areas_not_in_brain: number };
  statuses_as_of: string | null;
  skipped_signals: SkippedSignal[];
  repos_failed: Array<{ name: string; error: string }>;
  total: number;
  dismissed: number;
  excluded: number;
  findings: RankedFinding[];
  tasksOn: boolean;
}

const norm = (value: string): string => value.trim().toLowerCase();
const day = (value: string): number => Date.parse(`${value.slice(0, 10)}T00:00:00Z`) / DAY_MS;
const titleKey = (title: string): string => title.normalize("NFC").toLowerCase();
const byTitle = (a: { title: string; id: string }, b: { title: string; id: string }): number =>
  compareCodePoints(titleKey(a.title), titleKey(b.title)) || compareCodePoints(a.id, b.id);
const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const list = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
const dateOf = (value: unknown): string | null => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null);

interface Thing { id: string; title: string; note: Note; page: string | null; archived: boolean }
interface Project extends Thing { status: string | null; live: boolean; area: string | null; aliases: string[]; created: string }
interface Area extends Thing { domain: string | null }
interface Task { row: TaskRow; state: "done" | "dropped" | "waiting" | "someday" | "open"; projects: Project[] }

const isOpen = (task: Task) => task.state !== "done" && task.state !== "dropped";
const isActive = (task: Task) => task.state === "open";
const isNextStep = (task: Task) => isOpen(task) && task.state !== "someday";

/** Match Notion rows to notes (assistant.md §2.1): by brain_id (the lower page_id wins a shared one), else by a note's `notion`. */
function matchRows<R extends { page_id: string; brain_id: string | null }>(rows: readonly R[], notes: readonly Note[]): { rowOf: Map<string, R>; unmatched: number } {
  const byId = new Map(notes.map((note) => [note.id, note]));
  const rowOf = new Map<string, R>();
  const left: R[] = [];
  let unmatched = 0;
  for (const row of [...rows].sort((a, b) => compareCodePoints(a.page_id, b.page_id))) {
    const named = row.brain_id === null ? undefined : byId.get(row.brain_id);
    if (named !== undefined) {
      if (rowOf.has(named.id)) unmatched += 1;
      else rowOf.set(named.id, row);
    } else left.push(row);
  }
  for (const row of left) {
    const note = notes.find((candidate) => candidate.attributes.notion === row.page_id && !rowOf.has(candidate.id));
    if (note === undefined) unmatched += 1;
    else rowOf.set(note.id, row);
  }
  return { rowOf, unmatched };
}

function archivedInBrain(note: Note, liveArchived: boolean | undefined): boolean {
  const fields = isRecord(note.attributes.notion_fields) ? note.attributes.notion_fields : {};
  const flag = liveArchived ?? fields.archived === true;
  return flag || note.attributes.lifecycle === "archived" || note.path.startsWith("archive/");
}

/** Normalized title tokens (assistant.md §3.1). */
export function titleTokens(title: string): string[] {
  return title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().split(/[^a-z0-9]+/).filter((token) => token !== "" && !STOP_WORDS.has(token));
}

/** The shared spelling step over two forms: a token starting with another of at least 5 characters becomes the shortest such. */
function spell(a: readonly string[], b: readonly string[]): [Set<string>, Set<string>] {
  const all = [...new Set([...a, ...b])];
  const one = (token: string) => {
    const stems = all.filter((other) => other !== token && other.length >= 5 && token.startsWith(other)).sort((x, y) => x.length - y.length || compareCodePoints(x, y));
    return stems[0] ?? token;
  };
  return [new Set(a.map(one)), new Set(b.map(one))];
}
const sortedSet = (set: Set<string>) => [...set].sort(compareCodePoints);
const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((token) => b.has(token));

export function computeFindings(input: FindingsInput): FindingsResult {
  const { snapshot, notes, config } = input;
  const live = snapshot.notion === "live";
  const modules = modulesOf(config);
  const tasksOn = modules.tasks;
  const notion = isRecord(config.notion) ? config.notion : {};
  const taskConfig = isRecord(notion.tasks) ? notion.tasks : {};
  const properties = isRecord(taskConfig.properties) ? taskConfig.properties : {};
  const mapped = (property: string) => typeof properties[property] === "string" && properties[property] !== "";
  const wontDo = str(taskConfig.wont_do_status) ?? "Won't Do";
  const waitingOn = str(taskConfig.waiting_on_status) ?? "Waiting On";
  const asOfDay = day(snapshot.as_of);
  const age = (value: string) => asOfDay - day(value);

  // ---- the brain
  const projectNotes = notes.filter((note) => note.type === "project");
  const areaNotes = notes.filter((note) => note.type === "area");
  const domainNotes = notes.filter((note) => note.type === "domain");
  const projectRows = live ? snapshot.projects ?? [] : [];
  const areaRows = live ? snapshot.areas ?? [] : [];
  const projectMatch = matchRows(projectRows, projectNotes);
  const areaMatch = matchRows(areaRows, areaNotes);

  const projects = new Map<string, Project>();
  for (const note of projectNotes) {
    const row = projectMatch.rowOf.get(note.id);
    const fields = isRecord(note.attributes.notion_fields) ? note.attributes.notion_fields : {};
    const archived = archivedInBrain(note, row?.archived);
    const status = live ? row?.status ?? null : str(fields.status);
    projects.set(note.id, {
      id: note.id, title: String(note.attributes.title ?? note.id), note, page: str(note.attributes.notion) ?? row?.page_id ?? null,
      archived, status, live: !archived && status !== "Done", area: str(note.attributes.area), aliases: list(note.attributes.aliases),
      created: String(note.attributes.created ?? ""),
    });
  }
  const areas = new Map<string, Area>();
  for (const note of areaNotes) {
    const row = areaMatch.rowOf.get(note.id);
    areas.set(note.id, { id: note.id, title: String(note.attributes.title ?? note.id), note, page: str(note.attributes.notion) ?? row?.page_id ?? null, archived: archivedInBrain(note, row?.archived), domain: str(note.attributes.domain) });
  }
  const domains = new Map(domainNotes.map((note) => [note.id, { id: note.id, title: String(note.attributes.title ?? note.id), archived: archivedInBrain(note, undefined) }]));
  const projectByPage = new Map<string, Project>();
  for (const project of projects.values()) if (project.page !== null && !projectByPage.has(project.page)) projectByPage.set(project.page, project);
  const areaByPage = new Map<string, Area>();
  for (const area of areas.values()) if (area.page !== null && !areaByPage.has(area.page)) areaByPage.set(area.page, area);
  const projectRowByPage = new Map(projectRows.map((row) => [row.page_id, row]));
  const titleOf = (id: string | null): string => (id === null ? "" : projects.get(id)?.title ?? areas.get(id)?.title ?? domains.get(id)?.title ?? notes.find((note) => note.id === id)?.attributes.title as string ?? id);

  // ---- tasks (live, Tasks on)
  const statusGroups = new Map((snapshot.task_statuses ?? []).map((option) => [norm(option.name), option.group]));
  const optionNames = (snapshot.task_statuses ?? []).map((option) => option.name);
  const option = (name: string): string | null => optionNames.find((candidate) => norm(candidate) === norm(name)) ?? null;
  const stateOf = (status: string | null): Task["state"] => {
    if (status === null || status.trim() === "") return "open";
    const key = norm(status);
    if (key === norm(wontDo)) return "dropped";
    const group = statusGroups.get(key) ?? null;
    if (group === "complete" || (group === null && key === "done")) return "done";
    if (key === norm(waitingOn)) return "waiting";
    if (key === "someday") return "someday";
    return "open";
  };
  const tasks: Task[] = live && tasksOn ? (snapshot.tasks ?? []).map((row) => ({
    row, state: stateOf(row.status),
    projects: row.projects.map((pageId) => projectByPage.get(pageId)).filter((project): project is Project => project !== undefined),
  })) : [];
  const tasksOfProject = (project: Project) => (project.page === null ? [] : tasks.filter((task) => task.row.projects.includes(project.page!)));
  const doneStatus = option("Done") ?? (snapshot.task_statuses ?? []).find((o) => o.group === "complete" && norm(o.name) !== norm(wontDo))?.name ?? null;
  const droppedStatus = option(wontDo);
  const waitingStatus = option(waitingOn);
  const somedayStatus = option("Someday");

  /** The Areas a task belongs to (§3.1), as ids. */
  const taskAreas = (task: Task): string[] => {
    const ids = new Set<string>();
    for (const pageId of task.row.areas) { const area = areaByPage.get(pageId); if (area !== undefined) ids.add(area.id); }
    for (const project of task.projects) if (project.live && project.area !== null) ids.add(project.area);
    return [...ids];
  };

  // ---- repo rollups with open items (§2.2)
  const openRollups = snapshot.repos.filter((repo) => {
    const counts = repo.rollup?.counts ?? {};
    return (counts.todo ?? 0) + (counts.in_progress ?? 0) + (counts.waiting ?? 0) + (counts.review ?? 0) > 0;
  });
  const rollupTargetsProject = (project: Project) => openRollups.some((repo) => {
    const target = repo.rollup?.target ?? {};
    return target.project !== undefined ? target.project === project.id : target.area !== undefined && target.area === project.area;
  });
  const rollupTargetsArea = (area: Area) => openRollups.some((repo) => {
    const target = repo.rollup?.target ?? {};
    return target.project !== undefined ? projects.get(target.project)?.area === area.id : target.area === area.id;
  });

  // ---- mentions (§3.1)
  const repoProject = new Map<string, string>();
  for (const repo of Array.isArray(config.repos) ? config.repos : []) if (isRecord(repo) && typeof repo.name === "string" && typeof repo.project === "string") repoProject.set(repo.name, repo.project);
  interface Mention { note: Note; date: string; kind: ActivityKind }
  const mentions = new Map<string, Mention[]>();
  for (const note of notes) {
    if (["view", "proposal", "memory"].includes(note.type)) continue;
    const listed = new Set(list(note.attributes.projects));
    if (note.type === "source") {
      const repo = typeof note.attributes.repo === "string" ? repoProject.get(note.attributes.repo) : undefined;
      if (repo !== undefined) listed.add(repo);
    }
    for (const projectId of listed) {
      if (projectId === note.id || !projects.has(projectId)) continue;
      const date = note.type === "meeting" ? dateOf(note.attributes.date) : note.type === "source" ? dateOf(note.attributes.captured) : dateOf(note.attributes.created);
      if (date === null) continue;
      const kind: ActivityKind = note.type === "meeting" ? "meeting" : note.type === "source" ? "source" : "note";
      mentions.set(projectId, [...(mentions.get(projectId) ?? []), { note, date, kind }]);
    }
  }
  const mentionCount = (project: Project) => new Set((mentions.get(project.id) ?? []).map((mention) => mention.note.id)).size;

  // ---- needs (§3.3)
  const skipped = new Map<Signal, SkippedSignal>();
  const need = (signal: Signal, wants: { live?: boolean; tasks?: boolean; domains?: boolean; props?: Array<"status" | "due" | "project"> }) => {
    if (wants.live === true && !live) skipped.set(signal, { signal, reason: "NOTION_UNREACHABLE" });
    else if ((wants.tasks === true && !tasksOn) || (wants.domains === true && !modules.domains)) skipped.set(signal, { signal, reason: "MODULE_OFF" });
    else {
      const missing = (["status", "due", "project"] as const).find((property) => wants.props?.includes(property) && !mapped(property));
      if (missing !== undefined) skipped.set(signal, { signal, reason: "NOT_MAPPED", property: missing });
    }
  };
  need("task_overdue", { live: true, tasks: true, props: ["status", "due"] });
  need("task_stalled", { live: true, tasks: true, props: ["status"] });
  need("project_no_next_step", { live: true, tasks: true, props: ["status", "project"] });
  need("project_done_but_open", { live: true, tasks: true, props: ["status", "project"] });
  need("task_no_project", { live: true, tasks: true, props: ["project"] });
  need("area_no_domain", { domains: true });
  need("area_empty", { live: true, props: tasksOn ? ["status", "project"] : [] });
  const runs = (signal: Signal) => !skipped.has(signal);
  const doneTasksCount = live && tasksOn && mapped("status") && mapped("project");

  // ---- recommendations (§3.4)
  type Draft = { action: string; value: unknown; label: string; notionOwned: boolean; needsPage?: boolean; keep?: boolean };
  const finish = (drafts: Draft[]): Recommendation[] => drafts
    .filter((draft) => draft.keep !== false && !(draft.notionOwned && !live))
    .map((draft, index) => ({ letter: String.fromCharCode(97 + index), action: draft.action, value: draft.value, label: draft.label }));
  const taskStatus = (value: string | null): Draft => ({ action: "set_task_status", value, label: `mark it ${value}`, notionOwned: true, keep: value !== null });
  const projectStatus = (project: Project, value: string): Draft => ({ action: "set_project_status", value, label: `set Status to ${value}`, notionOwned: true, keep: project.page !== null });
  const addTask = (project: Project): Draft => ({ action: "add_task", value: { project: project.id }, label: "add a next step", notionOwned: true, keep: tasksOn });
  const taskOffers = (): StatusOffer[] => (live ? [waitingStatus, somedayStatus].filter((value): value is string => value !== null).map((value) => ({ action: "set_task_status", value })) : []);
  const projectOffers = (project: Project): StatusOffer[] => (live && project.page !== null ? [{ action: "set_project_status", value: "On Hold" }] : []);

  // ---- placement and reach
  const firstProject = (list: Project[]) => [...list].sort(byTitle)[0];
  const domainOf = (areaId: string | null) => (areaId === null ? null : areas.get(areaId)?.domain ?? null);
  const reachOfProject = (project: Project) => [project.id, project.area, domainOf(project.area)].filter((id): id is string => id !== null);
  const reachOfArea = (area: Area) => [area.id, area.domain].filter((id): id is string => id !== null);

  const raw: Array<Omit<RankedFinding, "rank">> = [];
  const add = (finding: Omit<RankedFinding, "rank" | "category">) => raw.push({ ...finding, category: CATEGORY[finding.signal] });

  const taskFinding = (task: Task, signal: Signal, evidence: Record<string, unknown>, evidenceText: string, recommendations: Recommendation[], offers: StatusOffer[], days: number | null) => {
    const liveProjects = task.projects.filter((project) => project.live);
    const placed = firstProject(liveProjects) ?? firstProject(task.projects);
    const ownArea = [...task.row.areas].map((pageId) => areaByPage.get(pageId)).filter((area): area is Area => area !== undefined).sort(byTitle)[0];
    const areaIds = taskAreas(task);
    add({
      key: `${signal}:notion:${task.row.page_id}`, signal,
      subject: { kind: "task", id: null, page_id: task.row.page_id, title: task.row.title, current: { status: task.row.status, due: task.row.due, projects: task.row.projects, areas: task.row.areas } },
      project: placed?.id ?? null, area: placed !== undefined ? placed.area : ownArea?.id ?? null,
      evidence, recommendations, status_offers: offers,
      text: { subject: `"${task.row.title}" (task${placed === undefined ? "" : ` in ${placed.title}`})`, evidence: evidenceText, title: task.row.title, days },
      subjectKeys: [`notion:${task.row.page_id}`],
      reach: new Set([...task.projects.map((project) => project.id), ...areaIds, ...areaIds.map(domainOf).filter((id): id is string => id !== null)]),
    });
  };
  const projectFinding = (project: Project, signal: Signal, evidence: Record<string, unknown>, evidenceText: string, recommendations: Recommendation[], offers: StatusOffer[], days: number | null) => add({
    key: `${signal}:${project.id}`, signal,
    subject: { kind: "project", id: project.id, page_id: project.page, title: project.title, current: { status: project.status, archived: project.archived, area: project.area } },
    project: project.id, area: project.area, evidence, recommendations, status_offers: offers,
    text: { subject: `${project.title} (project)`, evidence: evidenceText, title: project.title, days },
    subjectKeys: [project.id], reach: new Set(reachOfProject(project)),
  });
  const areaFinding = (area: Area, signal: Signal, evidence: Record<string, unknown>, evidenceText: string, recommendations: Recommendation[]) => add({
    key: `${signal}:${area.id}`, signal,
    subject: { kind: "area", id: area.id, page_id: area.page, title: area.title, current: { archived: area.archived, domain: area.domain } },
    project: null, area: area.id, evidence, recommendations, status_offers: [],
    text: { subject: `${area.title} (area)`, evidence: evidenceText, title: area.title, days: null },
    subjectKeys: [area.id], reach: new Set(reachOfArea(area)),
  });

  const taskRecommendations = () => finish([
    { action: "set_task_due", value: null, label: "give it a new due date", notionOwned: true },
    taskStatus(doneStatus), taskStatus(droppedStatus),
  ]);

  // ---- task signals
  for (const task of tasks) {
    const overdue = runs("task_overdue") && isActive(task) && task.row.due !== null && age(task.row.due) >= TASK_OVERDUE_DAYS;
    if (overdue) {
      const late = age(task.row.due!);
      taskFinding(task, "task_overdue", { due: task.row.due, days_late: late, status: task.row.status }, `due ${dayMonth(task.row.due!)}, ${count(late, "day")} late`, taskRecommendations(), taskOffers(), late);
    } else if (runs("task_stalled") && isActive(task) && age(task.row.last_edited) >= TASK_STALLED_DAYS) {
      const idle = age(task.row.last_edited);
      taskFinding(task, "task_stalled", { last_edited: task.row.last_edited, days_idle: idle, status: task.row.status }, `no edit for ${count(idle, "day")} (status ${task.row.status ?? "empty"})`, taskRecommendations(), taskOffers(), idle);
    }
    if (runs("task_no_project") && isOpen(task)) {
      const closed: string[] = [];
      for (const pageId of task.row.projects) {
        const project = projectByPage.get(pageId);
        if (project !== undefined) { if (!project.live) closed.push(pageId); continue; }
        const row = projectRowByPage.get(pageId);
        if (row !== undefined && (row.status === "Done" || row.archived)) closed.push(pageId);
      }
      if (task.row.projects.length === 0 || closed.length === task.row.projects.length) {
        // The task's Area: the one live Area note its `areas` names; only when it names no page, the one Area of its closed projects.
        let areaId: string | null = null;
        if (task.row.areas.length > 0) {
          const named = task.row.areas.map((pageId) => areaByPage.get(pageId)).filter((area): area is Area => area !== undefined && !area.archived);
          areaId = named.length === 1 ? named[0]!.id : null;
        } else {
          const fromProjects = new Set(closed.map((pageId) => projectByPage.get(pageId)?.area ?? null).filter((id): id is string => id !== null));
          areaId = fromProjects.size === 1 ? [...fromProjects][0]! : null;
        }
        const candidates = areaId === null ? [] : [...projects.values()].filter((project) => project.area === areaId && project.live && project.status === "Active");
        const target = candidates.length === 1 ? candidates[0]! : null;
        const recommendations = finish([
          { action: "set_task_project", value: target?.id ?? null, label: target === null ? "put it in a project" : `put it in ${target.title}`, notionOwned: true, keep: target === null || target.page !== null },
          taskStatus(droppedStatus),
        ]);
        taskFinding(task, "task_no_project", { projects: closed }, task.row.projects.length === 0 ? "no project" : "its project is closed", recommendations, [], null);
      }
    }
  }

  // ---- project signals
  const liveProjects = [...projects.values()].filter((project) => project.live);
  for (const project of projects.values()) {
    const own = tasksOfProject(project);
    const doneOrDropped = own.length > 0 && own.every((task) => !isOpen(task)) && own.some((task) => task.state === "done");
    const doneButOpen = runs("project_done_but_open") && project.live && doneOrDropped && !rollupTargetsProject(project);
    const active = project.live && project.status === "Active";

    let stalled = false;
    if (active && !doneButOpen) {
      const activity: Array<{ date: string; kind: ActivityKind; ref: string; title: string }> = [];
      for (const mention of mentions.get(project.id) ?? []) activity.push({ date: mention.date, kind: mention.kind, ref: mention.note.id, title: String(mention.note.attributes.title ?? mention.note.id) });
      for (const field of ["created", "updated"]) {
        const date = dateOf(project.note.attributes[field]);
        if (date !== null) activity.push({ date, kind: "project_note", ref: project.id, title: project.title });
      }
      if (doneTasksCount) for (const task of own) if (task.state === "done") activity.push({ date: task.row.last_edited.slice(0, 10), kind: "task_done", ref: task.row.page_id, title: task.row.title });
      activity.sort((a, b) => compareCodePoints(b.date, a.date) || ACTIVITY_KINDS.indexOf(a.kind) - ACTIVITY_KINDS.indexOf(b.kind) || compareCodePoints(a.ref, b.ref));
      const last = activity[0];
      if (last !== undefined && age(last.date) >= PROJECT_STALLED_DAYS) {
        stalled = true;
        const idle = age(last.date);
        const kindLabel = { task_done: "task done", meeting: "meeting", note: "note", source: "source", project_note: "project note" }[last.kind];
        projectFinding(project, "project_stalled", { last_activity: { date: last.date, kind: last.kind, ref: last.ref }, days_idle: idle },
          `nothing done or mentioned for ${count(idle, "day")} (last: ${kindLabel} ${last.title}, ${dayMonth(last.date)})`,
          finish([projectStatus(project, "On Hold"), addTask(project), projectStatus(project, "Done")]), projectOffers(project), idle);
      }
    }
    if (runs("project_no_next_step") && active && !doneButOpen && !stalled && !own.some(isNextStep) && !rollupTargetsProject(project)) {
      const evidence = { tasks_someday: own.filter((task) => task.state === "someday").length, tasks_done: own.filter((task) => task.state === "done").length, tasks_dropped: own.filter((task) => task.state === "dropped").length };
      projectFinding(project, "project_no_next_step", evidence, "Active with no next step", finish([addTask(project), projectStatus(project, "On Hold"), projectStatus(project, "Done")]), projectOffers(project), null);
    }
    if (doneButOpen) {
      const done = own.filter((task) => task.state === "done").length;
      const dropped = own.filter((task) => task.state === "dropped").length;
      projectFinding(project, "project_done_but_open", { tasks_done: done, tasks_dropped: dropped },
        `every task done (${done} done${dropped > 0 ? `, ${dropped} dropped` : ""}), Status still ${project.status ?? "empty"}`,
        finish([projectStatus(project, "Done"), addTask(project)]), [], null);
    }
    if (project.live) {
      const placed = (mentions.get(project.id) ?? []).filter((mention) => typeof mention.note.attributes.area === "string");
      const distinct = new Map(placed.map((mention) => [mention.note.id, String(mention.note.attributes.area)]));
      const total = distinct.size;
      if (total >= MISPLACED_MIN_NOTES) {
        const counts = new Map<string, number>();
        for (const areaId of distinct.values()) counts.set(areaId, (counts.get(areaId) ?? 0) + 1);
        const suggested = [...counts.entries()].find(([areaId, n]) => areaId !== project.area && areas.has(areaId) && !areas.get(areaId)!.archived && 3 * n >= 2 * total);
        if (suggested !== undefined) {
          const [areaId, n] = suggested;
          const oldPage = project.area === null ? null : areas.get(project.area)?.page ?? null;
          const moving = oldPage === null ? 0 : own.filter((task) => isOpen(task) && task.row.areas.includes(oldPage)).length;
          const label = `move it to ${titleOf(areaId)}${moving > 0 ? ` (and its ${count(moving, "open task")} that ${moving === 1 ? "names" : "name"} ${titleOf(project.area)})` : ""}`;
          projectFinding(project, "project_misplaced", { area: project.area, suggested_area: areaId, notes: n, of: total },
            `in ${titleOf(project.area)}, but ${n} of its ${total} notes are in ${titleOf(areaId)}`,
            finish([{ action: "move_project", value: areaId, label, notionOwned: false }]), [], null);
        }
      }
    }
  }

  // ---- duplicates
  const sortedLive = [...liveProjects].sort((a, b) => compareCodePoints(a.id, b.id));
  for (let i = 0; i < sortedLive.length; i += 1) {
    for (let j = i + 1; j < sortedLive.length; j += 1) {
      const p = sortedLive[i]!, q = sortedLive[j]!;
      const [survivor, duplicate] = [p, q].sort((a, b) => mentionCount(b) - mentionCount(a) || compareCodePoints(a.created, b.created) || compareCodePoints(a.id, b.id)) as [Project, Project];
      const shared = duplicateTokens(survivor, duplicate);
      if (shared === null) continue;
      const moving = tasksOfProject(duplicate).filter(isOpen).length;
      const key = `project_duplicate:${p.id}+${q.id}`;
      add({
        key, signal: "project_duplicate",
        subject: { kind: "project_pair", ids: [duplicate.id, survivor.id], titles: [duplicate.title, survivor.title] },
        project: survivor.id, area: survivor.area,
        evidence: { survivor: survivor.id, duplicate: duplicate.id, shared_tokens: shared },
        recommendations: finish([{ action: "merge_projects", value: { target: duplicate.id, merge_into: survivor.id }, label: `merge ${duplicate.title} into ${survivor.title}${moving > 0 ? ` (and move its ${count(moving, "open task")})` : ""}`, notionOwned: false }]),
        status_offers: [],
        text: { subject: `${duplicate.title} and ${survivor.title} (projects)`, evidence: "look like the same project", title: `${duplicate.title} and ${survivor.title}`, days: null },
        subjectKeys: [p.id, q.id], reach: new Set([...reachOfProject(p), ...reachOfProject(q)]),
      });
    }
  }

  // ---- task_no_project etc. done above; Areas
  const openDomains = [...domains.values()].filter((domain) => !domain.archived);
  for (const area of areas.values()) {
    if (area.archived) continue;
    if (runs("area_no_domain") && area.domain === null) {
      const only = openDomains.length === 1 ? openDomains[0]! : null;
      areaFinding(area, "area_no_domain", {}, "no Domain", finish([
        { action: "set_area_domain", value: only?.id ?? null, label: only === null ? "put it in a Domain" : `put it in ${only.title}`, notionOwned: false, keep: openDomains.length > 0 },
      ]));
    }
    if (runs("area_empty")) {
      const own = [...projects.values()].filter((project) => project.area === area.id);
      const busy = own.some((project) => project.live && (project.status === "Active" || project.status === "Planned"))
        || tasks.some((task) => isOpen(task) && taskAreas(task).includes(area.id))
        || rollupTargetsArea(area);
      if (!busy) {
        const kept = own.filter((project) => !project.archived);
        areaFinding(area, "area_empty", { projects_on_hold: kept.filter((project) => project.status === "On Hold").length, projects_done: kept.filter((project) => project.status === "Done").length },
          "nothing active", finish([{ action: "archive_area", value: true, label: "archive it", notionOwned: true, keep: area.page !== null }]));
      }
    }
  }

  // ---- scope, dismissals, exclusions, ranking, the cap (§3.5)
  const inScope = raw.filter((finding) => input.scope === null || finding.reach.has(input.scope.id));
  const asOfMs = Date.parse(snapshot.as_of);
  const active = new Set(input.dismissals.filter((entry) => Date.parse(entry.until) > asOfMs).map((entry) => entry.key));
  for (const note of notes) {
    if (note.type !== "proposal" || typeof note.attributes.finding !== "string") continue;
    const decision = isRecord(note.attributes.decision) ? note.attributes.decision : null;
    if (decision?.action !== "reject" || typeof decision.decided_at !== "string") continue;
    if (asOfMs - Date.parse(decision.decided_at) < DISMISS_DAYS * DAY_MS) active.add(note.attributes.finding);
  }
  const kept = inScope.filter((finding) => !active.has(finding.key));
  const listed = kept.filter((finding) => !input.exclude.has(finding.key) && !finding.subjectKeys.some((key) => input.exclude.has(key)));
  listed.sort(compareFindings);
  const findings = listed.slice(0, input.limit).map((finding, index) => ({ ...finding, rank: input.numberFrom + index }));

  return {
    mode: live ? "live" : "brain_only",
    read: live
      ? { tasks: tasksOn ? (snapshot.tasks ?? []).length : 0, projects: projectRows.length, areas: areaRows.length, projects_not_in_brain: projectMatch.unmatched, areas_not_in_brain: areaMatch.unmatched }
      : { tasks: 0, projects: 0, areas: 0, projects_not_in_brain: 0, areas_not_in_brain: 0 },
    statuses_as_of: live ? null : oldestStatuses([...projectNotes, ...areaNotes]),
    skipped_signals: SIGNALS.filter((signal) => skipped.has(signal)).map((signal) => skipped.get(signal)!),
    repos_failed: snapshot.repos.filter((repo) => typeof repo.error === "string").map((repo) => ({ name: repo.name, error: repo.error! })),
    total: listed.length,
    dismissed: inScope.length - kept.length,
    excluded: kept.length - listed.length,
    findings,
    tasksOn,
  };
}

/** The shared tokens when two live projects look like duplicates (§3.3), in the clause order; null when they don't. */
function duplicateTokens(survivor: Project, duplicate: Project): string[] | null {
  const a = titleTokens(survivor.title), b = titleTokens(duplicate.title);
  const [sa, sb] = spell(a, b);
  if (sa.size > 0 && sameSet(sa, sb)) return sortedSet(sa);
  if (sa.size >= 2 && sb.size >= 2) {
    const both = new Set([...sa].filter((token) => sb.has(token)));
    const union = new Set([...sa, ...sb]);
    if (3 * both.size >= 2 * union.size) return sortedSet(both);
  }
  for (const [title, other] of [[a, duplicate], [b, survivor]] as const) {
    for (const alias of other.aliases) {
      const [st, sl] = spell(title, titleTokens(alias));
      if (st.size > 0 && sameSet(st, sl)) return sortedSet(st);
    }
  }
  return null;
}

function compareFindings(a: Omit<RankedFinding, "rank">, b: Omit<RankedFinding, "rank">): number {
  const category = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  if (category !== 0) return category;
  const signal = RANK_ORDER.indexOf(a.signal) - RANK_ORDER.indexOf(b.signal);
  if (signal !== 0) return signal;
  if (a.text.days !== null && b.text.days !== null && a.text.days !== b.text.days) return b.text.days - a.text.days;
  return compareCodePoints(titleKey(a.text.title), titleKey(b.text.title)) || compareCodePoints(a.key, b.key);
}

/** Brain only: the oldest `notion_fields.as_of` over project and Area notes that aren't archived (cli.md §5.31). */
function oldestStatuses(notes: readonly Note[]): string | null {
  const dates = notes
    .filter((note) => note.attributes.lifecycle !== "archived" && !note.path.startsWith("archive/"))
    .map((note) => (isRecord(note.attributes.notion_fields) ? note.attributes.notion_fields.as_of : undefined))
    .filter((value): value is string => typeof value === "string")
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  return dates[0] ?? null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** `29 Oct` from a date or timestamp. */
export function dayMonth(value: string): string {
  return `${Number(value.slice(8, 10))} ${MONTHS[Number(value.slice(5, 7)) - 1]}`;
}
/** `6 Nov 2026`. */
export function dayMonthYear(value: string): string {
  return `${dayMonth(value)} ${value.slice(0, 4)}`;
}
/** `1 day`, `8 days`: the singular for 1 (assistant.md §4.1). */
export function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
