// Synthetic weeks for the `brain weekly` tests (spec/weekly-review.md §14, CC-253). Every name is invented. The skill's model work is played by
// `judge` (a fixed reading of each cluster) and `prose` (one bullet per shown change), so the CLI's half is tested on its own.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { brain, withPassages, type CliRun } from "./helpers.ts";

process.env.TZ = "UTC";

let counter = 0;
async function file(root: string, value: unknown): Promise<string> {
  counter += 1;
  const path = join(dirname(root), `weekly-${counter}.json`);
  await writeFile(path, JSON.stringify(value));
  return path;
}

export async function plan(root: string, snap: unknown, now: string): Promise<CliRun> {
  return brain(["weekly", "plan", "--brain", root, "--snapshot", await file(root, snap), "--now", now, "--json"]);
}
export async function select(root: string, input: unknown, now: string): Promise<CliRun> {
  return brain(["weekly", "select", "--brain", root, "--input", await file(root, input), "--now", now, "--json"]);
}
export async function record(root: string, input: unknown, now: string): Promise<CliRun> {
  return brain(["weekly", "record", "--brain", root, "--input", await file(root, input), "--now", now, "--json"]);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (date: string) => `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;

/** The skill's two sections, written from the plan: one bullet per shown change, the Task analysis from its candidates. */
export function prose(planData: any): { what_changed: string[]; task_analysis: string[] } {
  const label = (kind: string) => kind[0]!.toUpperCase() + kind.slice(1);
  const link = (change: any) => (change.path === null ? `[task](${change.url})` : `[${change.title}](../${change.path})`);
  const bullets = planData.changes.filter((change: any) => change.bullet).map((change: any) => `- **${label(change.kind)}:** ${change.title} (${link(change)}, ${day(change.date)})${change.draft ? " *(not reviewed)*" : ""}.`);
  const ta = planData.task_analysis;
  const cats = [["Overdue", ta.overdue], ["Stalled", ta.stalled], ["Blocked", ta.blocked], ["No next step", ta.no_next_step]] as const;
  const lines = cats.filter(([, subjects]) => subjects.length > 0).map(([name, subjects]) => `- **${name}:** ${subjects.map((subject: any) => `${subject.title}, ${subject.evidence}`).join("; ")}.`);
  const order = ta.order.length > 0 ? ta.order : [...ta.overdue, ...ta.stalled, ...ta.blocked, ...ta.no_next_step].slice(0, 1);
  const task_analysis = lines.length === 0 ? ["- No overdue, stalled or blocked work."] : [...lines, "", "Order of attention:", ...order.map((subject: any, index: number) => `${index + 1}. ${subject.title}: ${subject.evidence}.`)];
  return { what_changed: bullets.length === 0 ? ["- Nothing new this week."] : bullets, task_analysis };
}

export type Judge = (cluster: any) => any | null;

/** The proposal step 8 writes for a new item (weekly-review.md §6.2), all pending. */
function proposalFor(item: any, planData: any, source: string): Record<string, unknown> {
  if (item.stream === "knowledge") {
    const finding = item.finding;
    return { kind: "contradiction", title: finding.subject, target: finding.targets[0], field: finding.field ?? "role", after: finding.after ?? "Lead designer", why: finding.why ?? `${finding.subject} (synthetic)`, source: finding.evidence[0], fingerprint: finding.fingerprint, evidence: finding.evidence, ...finding.proposal };
  }
  const found = planData.findings.find((candidate: any) => candidate.key === item.key);
  const subject = found.subject;
  const rec = item.recommendation;
  const base = { kind: "notion_change", why: `${found.signal} (synthetic)`, source, finding: item.key, ...(found.area === null ? {} : { area: found.area }) };
  if (rec.action === "set_project_status") return { ...base, database: "projects", target: subject.id, page: subject.page_id, page_title: subject.title, property: "status", value_before: subject.current.status, value_after: rec.value };
  if (rec.action === "archive_area") return { ...base, database: "areas", target: subject.id, page: subject.page_id, page_title: subject.title, property: "archived", value_before: false, value_after: true };
  if (rec.action === "set_task_status") return { ...base, database: "tasks", page: subject.page_id, page_title: subject.title, property: "status", value_before: subject.current.status, value_after: rec.value };
  throw new Error(`no synthetic proposal for ${rec.action}`);
}

export interface Week { plan: CliRun; select?: CliRun; record?: CliRun; proposals: string[]; input?: any }

/** Steps 3 to 8 of a run (weekly-review.md §1): plan, the skill's judgments played by `judge`, select, and the new proposals. */
export async function prepare(root: string, snap: any, now: string, options: { judge?: Judge; judgeOnly?: number } = {}): Promise<{ plan: CliRun; select?: CliRun; proposals: Array<{ key: string; proposal: string }> }> {
  const planned = await plan(root, snap, now);
  if (planned.code !== 0) throw new Error(`plan failed: ${planned.stdout}${planned.stderr}`);
  const planData = planned.json.data;
  if (planData.quiet) return { plan: planned, proposals: [] };
  const judged = planData.clusters.slice(0, options.judgeOnly ?? planData.clusters.length);
  const findings = judged.map((cluster: any) => options.judge?.(cluster) ?? null).filter((finding: any) => finding !== null);
  const strip = ({ field: _f, before: _b, after: _a, why: _w, proposal: _p, ...rest }: any) => rest;
  const selectInput = { plan: planData, judged: { clusters: judged.map((cluster: any) => cluster.key), findings: findings.map(strip), corrections: [] } };
  const selected = await select(root, selectInput, now);
  if (selected.code !== 0) throw new Error(`select failed: ${selected.stdout}${selected.stderr}`);
  const proposals: Array<{ key: string; proposal: string }> = [];
  const source = `agent:brain-weekly-review/${now.replace(/[-:]/g, "")}`;
  for (const item of selected.json.data.items.filter((candidate: any) => candidate.write)) {
    const full = item.stream === "knowledge" ? { ...item, finding: findings.find((finding: any) => finding.fingerprint === item.key) } : item;
    const created = await brain(["proposal", "new", "--brain", root, "--input", await file(root, withPassages({ proposals: [proposalFor(full, planData, source)] })), "--now", now, "--json"]);
    if (created.code !== 0) throw new Error(`proposal new failed: ${created.stdout}${created.stderr}`);
    const id = created.json.data.created[0]?.id ?? created.json.data.skipped[0]?.existing;
    if (id === undefined) throw new Error(`no proposal for ${item.key}: ${created.stdout}`);
    proposals.push({ key: item.key, proposal: id });
  }
  return { plan: planned, select: selected, proposals };
}

/** One run of the weekly flow (weekly-review.md §1 steps 3 to 9). */
export async function runWeek(root: string, snap: any, now: string, options: { judge?: Judge; judgeOnly?: number; mode?: "attended" | "unattended"; publish?: boolean; prose?: (planData: any) => { what_changed: string[]; task_analysis: string[] } } = {}): Promise<Week> {
  const prepared = await prepare(root, snap, now, options);
  if (prepared.select === undefined) return { plan: prepared.plan, proposals: [] };
  const planData = prepared.plan.json.data;
  const recordInput = { plan: planData, selection: prepared.select.json.data, proposals: prepared.proposals, ...(options.prose ?? prose)(planData), mode: options.mode ?? "unattended", publish: options.publish ?? false, failures: [], notes_read: 3, seconds: 60 };
  const recorded = await record(root, recordInput, now);
  return { plan: prepared.plan, select: prepared.select, record: recorded, proposals: prepared.proposals.map((entry) => entry.proposal), input: recordInput };
}

/** Decide proposals in chat (`brain apply`): approve or reject. */
export async function decide(root: string, proposal: string, action: "approve" | "reject", at: string): Promise<CliRun> {
  return brain(["apply", "--brain", root, "--input", await file(root, { decisions: [{ proposal, action, decided_at: at, decided_by: "chat" }] }), "--now", at, "--json"]);
}

export async function readText(root: string, path: string): Promise<string> {
  return readFile(join(root, path), "utf8");
}

/** Append a body to notes written by `world` (which writes frontmatter only). */
export async function bodies(root: string, entries: Record<string, string>): Promise<void> {
  for (const [path, text] of Object.entries(entries)) {
    const full = join(root, path);
    await writeFile(full, `${await readFile(full, "utf8")}\n${text}\n`);
  }
}

/** Edit brain.json in place: the Notion databases a notion_change needs, the modules, settings. */
export async function configure(root: string, change: (config: any) => void): Promise<void> {
  const path = join(root, "brain.json");
  const config = JSON.parse(await readFile(path, "utf8"));
  change(config);
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
}

export const withDatabases = (config: any) => {
  config.notion.databases = { ...config.notion.databases, projects: "a1000000-0000-4000-8000-00000000000a", areas: "a1000000-0000-4000-8000-00000000000b" };
};

/** Every file under the brain with a hash of its content: a quiet run leaves it identical. */
export async function tree(root: string): Promise<string[]> {
  const { createHash } = await import("node:crypto");
  const { readdir } = await import("node:fs/promises");
  const { relative } = await import("node:path");
  const out: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    out.push(`${relative(root, path)} ${createHash("sha256").update(await readFile(path)).digest("hex")}`);
  }
  return out.sort();
}

/** The `weekly` log lines of the brain, oldest first. */
export async function weeklyLines(root: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const lines: string[] = [];
  for (const name of (await readdir(join(root, "log")).catch(() => [] as string[])).sort()) {
    lines.push(...(await readFile(join(root, "log", name), "utf8")).split("\n").filter((line) => / weekly - /.test(line)));
  }
  return lines;
}

/** The proposal files of the brain. */
export async function proposalFiles(root: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  return (await readdir(join(root, "_proposals")).catch(() => [] as string[])).filter((name) => name.endsWith(".md")).sort();
}
