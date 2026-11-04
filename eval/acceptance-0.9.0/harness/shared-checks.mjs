// Usage: node shared-checks.mjs <sandbox> (a fresh `make-sandbox.sh … general-area` sandbox). The CLI-level shared checks of
// spec/connected-workflows.md §14 and the version behaviour of spec/skills-delivery.md §7, run once against the installed
// package (CC-107). The skill-level ones (an interrupted create, a failed operation retried) are blind runs (RESULTS.md, R1).
// Prints one JSON report; exit 1 when a check fails.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const sandbox = process.argv[2];
const envFile = readFileSync(join(sandbox, "env.sh"), "utf8");
const env = { ...process.env };
for (const m of envFile.matchAll(/([A-Za-z_]+)=([^\s]+)/g)) env[m[1]] = m[2].replace(/\$PATH/, env.PATH);
const brain = env.BRAIN_DIR, folder = join(sandbox, "acme-workshop"), tmp = join(sandbox, "tmp");
mkdirSync(tmp, { recursive: true });
let n = 0;
const file = (value) => { const p = join(tmp, `in-${++n}.json`); writeFileSync(p, JSON.stringify(value)); return p; };
const call = (args, now) => {
  const full = [...args, "--brain", brain, "--json", ...(now ? ["--now", now] : [])];
  try { const out = execFileSync("brain", full, { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); return { code: 0, json: JSON.parse(out) }; }
  catch (e) { return { code: e.status, json: JSON.parse(e.stdout || "{}") }; }
};
const ok = (args, now) => { const r = call(args, now); if (r.code !== 0) throw new Error(`${args.join(" ")} → ${r.code} ${JSON.stringify(r.json.error)}`); return r.json.data; };
const checks = {}, evidence = {};
const check = (name, pass, data) => { checks[name] = Boolean(pass); evidence[name] = data; };

const index = ok(["index"]);
const area = index.notes.find((x) => x.type === "area");
const STATUS = { todo: "To Do", in_progress: "Doing", waiting: "Waiting On", review: "Doing", done: "Done", dropped: "Won't Do" };
const wf = ok(["workflow", "new", "--input", file({ folder_path: folder, opted_in: { statement: "Yes, connect it." }, destination: { area: area.id }, settings: { work_type: "general", logging: "tasks_and_finals", custom: [] }, status_map: STATUS })]).id;
const show = () => ok(["workflow", "show", wf]);
const item = (id) => show().items.find((i) => i.id === id);
const snapshot = (tasks, read_at) => file({ read_at, destination: { page: area.notion, workflow: "Connected", work_type: "General", logging_level: "Tasks + final outputs", log_artifacts: ["Final deliverables"] }, tasks, documents: [], artifacts: [] });

// One approved item, published as the skill would: reconcile opens create_task, in_flight, done with the page.
ok(["workflow", "item", "put", wf, "--input", file({ title: "Draft the agenda", scope: "A half-day agenda.", acceptance: [{ text: "The agenda fits in half a day" }], approve: true })], "2026-11-04T09:00:00Z");
const wi = show().items[0].id;
const r1 = ok(["workflow", "reconcile", wf, "--start", "--input", snapshot([], "2026-11-04T09:01:00Z")], "2026-11-04T09:01:00Z");
const op = r1.ops[0];
ok(["workflow", "op", "state", wf, op, "--state", "in_flight"], "2026-11-04T09:01:10Z");
const page = randomUUID();
ok(["workflow", "op", "state", wf, op, "--state", "done", "--page", page], "2026-11-04T09:01:20Z");

// Both places changed: the title locally and in Notion (asked), the status locally and in Notion (Notion's kept).
const rev = item(wi).rev;
ok(["workflow", "item", "put", wf, "--rev", String(rev), "--input", file({ id: wi, title: "Draft the workshop agenda", status: "in_progress" })], "2026-11-04T09:10:00Z");
const r2 = ok(["workflow", "reconcile", wf, "--input", snapshot([{ page, brain_id: wi, title: "Agenda for the Acme workshop", status: "Waiting On", archived: false, in_trash: false, edited: "2026-11-04T09:12:00Z" }], "2026-11-04T09:15:00Z")], "2026-11-04T09:15:00Z");
const after = item(wi);
check("a title changed in both places is asked", r2.needs_you.some((e) => e.kind === "BOTH_CHANGED" && e.target === wi && e.value === "Agenda for the Acme workshop"), { needs_you: r2.needs_you.map((e) => ({ kind: e.kind, value: e.value, choices: e.choices })) });
check("a status changed in both places keeps Notion's", after.status === "waiting" && r2.routine.some((x) => x.kind === "status_adopted" && x.target === wi) && !r2.ops.length, { status: after.status, routine: r2.routine, ops: r2.ops, title_kept: after.title });

// A stale record revision is refused.
const stale = call(["workflow", "item", "put", wf, "--rev", String(rev), "--input", file({ id: wi, scope: "Changed with an old revision." })], "2026-11-04T09:20:00Z");
check("a stale record revision is refused", stale.code === 4 && stale.json.error?.code === "STALE_RECORD", { code: stale.code, error: stale.json.error?.code, message: stale.json.error?.message });

// Two sessions can't claim one item.
const a = call(["workflow", "item", "claim", wf, wi, "--by", "session-a"], "2026-11-04T09:30:00Z");
const b = call(["workflow", "item", "claim", wf, wi, "--by", "session-b"], "2026-11-04T09:31:00Z");
check("two sessions can't claim one item", a.code === 0 && b.code === 4 && b.json.error?.code === "CLAIMED", { first: a.code, second: b.json.error?.code, message: b.json.error?.message });

// Version behaviour (spec/skills-delivery.md §5, §7): pinned; a competing global copy; a missing pinned skill stops a write; an incompatible pin stops it.
const status = ok(["status"]);
check("the brain is pinned to the phase A snapshot", status.skills.state === "pinned" && status.skills.name === "ultimate-brain" && status.skills.version === "0.9.0", { skills: { state: status.skills.state, name: status.skills.name, version: status.skills.version, installed_by: status.skills.installed_by } });
const home = env.HOME;
cpSync(join(brain, ".claude", "skills", "brain-query"), join(home, ".claude", "skills", "brain-query"), { recursive: true });
const lintCompeting = call(["lint"]);
rmSync(join(home, ".claude", "skills", "brain-query"), { recursive: true, force: true });
const competing = (lintCompeting.json.data?.issues ?? []).filter((i) => i.rule === "skill-competing");
check("a global copy of a pinned skill is reported as competing", competing.some((i) => i.path === "~/.claude/skills/brain-query"), { issues: competing.map((i) => ({ rule: i.rule, severity: i.severity, path: i.path })) });
const skill = join(brain, ".agents", "skills", "brain-howto", "SKILL.md"), saved = readFileSync(skill);
rmSync(skill);
const missing = call(["note", "new", "--input", file({ notes: [] })]);
writeFileSync(skill, saved);
check("a missing pinned skill stops a write before it writes", missing.json.error?.code === "SKILLS_SNAPSHOT_MISSING", { code: missing.code, error: missing.json.error?.code, message: missing.json.error?.message });
const lockFile = join(brain, "skills.lock.json"), lock = readFileSync(lockFile, "utf8");
const changed = JSON.parse(lock); changed.snapshot.cli = ">=0.10.0 <0.11.0"; writeFileSync(lockFile, `${JSON.stringify(changed, null, 2)}\n`);
const incompatible = call(["note", "new", "--input", file({ notes: [] })]);
writeFileSync(lockFile, lock);
check("an incompatible pin stops a write, with the upgrade to run", incompatible.json.error?.code === "SKILLS_INCOMPATIBLE" || incompatible.json.error?.code === "SKILLS_PIN_INVALID", { code: incompatible.code, error: incompatible.json.error?.code, message: incompatible.json.error?.message });
const final = ok(["status"]);
check("the brain is pinned again after the checks", final.skills.state === "pinned", { state: final.skills.state });

rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify({ checks, evidence }, null, 2));
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
