#!/usr/bin/env node
// Builds the synthetic brain and linked repos of the 0.12.0 memory evaluation (CC-165, decision 0074 §6), and writes
// cases.json with every evidence key resolved to its id.
// Usage: node eval/memory-0.12/make-brain.mjs <out-dir> [--cases <file>]
//   <out-dir>/brain        the brain (brain.json, notes, memories, _suppressions)
//   <out-dir>/repos/<name> the linked repos: .brain, brain-kit.json and build/TASKS.md (scratch has none of them)
// Deterministic: no clock, no randomness; ids are hashes of entity keys. Node built-ins only.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CASES } from "./cases.mjs";
import { CASES_0_13 } from "./cases-0.13.mjs";
import { AREAS, DECISIONS as DECISIONS_0_12, EXCLUDED_INPUT, MEMORIES as MEMORIES_0_12, ORGS, OWNER, PROJECTS, REPOS as REPOS_0_12, SOURCES } from "./world.mjs";
import { DECISIONS_0_13, LINK_0_12_HOW, LINK_0_12_SKILLS, MEMORIES_0_13, PROPOSALS, REPORTS, REPOS_0_13, SUPPORT_INPUT, VIEWS } from "./world-0.13.mjs";

// CC-185 (0.13.0) adds to the world of CC-165; every entity of world.mjs keeps its key, so its id, and the 77 cases of
// cases.mjs are written first and unchanged.
const DECISIONS = [...DECISIONS_0_12, ...DECISIONS_0_13];
const MEMORIES = [...MEMORIES_0_12, ...MEMORIES_0_13];
const REPOS = [...REPOS_0_12, ...REPOS_0_13];
const EXCLUDED_INPUTS = [EXCLUDED_INPUT, SUPPORT_INPUT];
// The frontmatter field that names a proposal's passages (0077 §3). TODO(CC-179, CC-182): null until the contract names
// the field and the proposal schema accepts it; then set it here, and the proposals with `passages` carry it.
const PROPOSAL_PASSAGES_FIELD = null;

const here = dirname(fileURLToPath(import.meta.url));
const product = join(here, "../..");
const args = process.argv.slice(2);
const out = args[0];
const casesAt = args.indexOf("--cases");
const casesFile = casesAt >= 0 ? args[casesAt + 1] : join(here, "cases.json");
if (!out || out.startsWith("--") || !casesFile) {
  console.error("usage: make-brain.mjs <out-dir> [--cases <file>]");
  process.exit(2);
}

// ---- ids ----
const sha = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const ALPHA = "0123456789abcdefghjkmnpqrstvwxyz";
const PREFIX = { area: "area", org: "org", prj: "prj", src: "src", dec: "dec", mem: "mem", vw: "vw", prp: "prp" };
const ids = new Map();
function idOf(key) {
  if (ids.has(key)) return ids.get(key);
  const prefix = PREFIX[key.split(":")[0]];
  if (!prefix) throw new Error(`no id prefix for ${key}`);
  const bytes = createHash("sha256").update(`memory-0.12:${key}`).digest();
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHA[bytes[i] % 32];
  const id = `${prefix}-${s}`;
  if ([...ids.values()].includes(id)) throw new Error(`id collision for ${key}`);
  ids.set(key, id);
  return id;
}
// A Notion page id (UUID shape) for an input, from its key.
function pageId(key) {
  const h = sha(`memory-0.12-page:${key}`);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const normalize = (text) => text.replace(/\s+/g, " ").trim();
const passageHash = (text) => sha(normalize(text)).slice(0, 8);

// Register every entity first, so references resolve whatever the order.
for (const e of [...AREAS, ...ORGS, ...PROJECTS, ...SOURCES, ...EXCLUDED_INPUTS.flatMap((x) => x.versions), ...DECISIONS, ...MEMORIES, ...VIEWS, ...REPORTS, ...PROPOSALS]) idOf(e.key);
const inputOf = new Map(EXCLUDED_INPUTS.flatMap((x) => x.versions.map((v) => [v.key, x])));

// Each note's path from the brain's root, for "{path:@<key>}" in a body.
const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const paths = new Map();
for (const p of PROJECTS) paths.set(p.key, `projects/${p.slug}/project.md`);
for (const o of ORGS) paths.set(o.key, `knowledge/orgs/${slug(o.title)}.md`);
for (const d of DECISIONS) paths.set(d.key, `knowledge/decisions/${d.file ?? `${d.date}-${slug(d.title)}`}.md`);
for (const v of VIEWS) paths.set(v.key, `projects/${PROJECTS.find((p) => p.key === v.project).slug}/decision-log.md`);
for (const r of REPORTS) paths.set(r.key, `reports/${r.date}-${r.slug}.md`);
const pathOf = (key) => {
  if (!paths.has(key)) throw new Error(`no path for ${key}`);
  return paths.get(key);
};

const resolveValue = (v) => {
  if (typeof v === "string" && v.startsWith("@")) return idOf(v.slice(1));
  if (Array.isArray(v)) return v.map(resolveValue);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveValue(x)]));
  return v;
};
const passageRef = (key, n) => {
  const input = inputOf.get(key);
  if (!input) throw new Error(`${key} is not an extract of an excluded input`);
  return `${idOf(key)}#¶${n}:${passageHash(input.paragraphs[Number(n) - 1])}`;
};
const resolveBody = (text) =>
  text
    .replace(/\{¶@([^#}]+)#(\d+)\}/g, (_, key, n) => `^[${passageRef(key, n)}]`)
    .replace(/\{path:@([^}]+)\}/g, (_, key) => pathOf(key))
    .replace(/\{@([^}]+)\}/g, (_, key) => idOf(key));

// ---- YAML frontmatter (a small, fixed writer) ----
const PLAIN = /^[A-Za-z0-9][A-Za-z0-9 ._\/()+-]*$/;
const RESERVED = /^(true|false|null|yes|no|on|off|~|[-+]?(\d[\d_]*(\.\d*)?|\.\d+)([eE][-+]?\d+)?|0x[0-9a-fA-F]+|0o[0-7]+|\.inf|\.nan)$/i;
function scalar(v) {
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v === null) return "null";
  const s = String(v);
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(s)) return s; // dates stay strings under the YAML 1.2 core schema
  if (PLAIN.test(s) && !RESERVED.test(s) && !s.endsWith(" ")) return s;
  return JSON.stringify(s);
}
function yaml(obj, indent = "") {
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      if (v.length > 0 && typeof v[0] === "object") {
        lines.push(`${indent}${k}:`);
        for (const item of v) {
          const inner = yaml(item, `${indent}    `).split("\n");
          lines.push(`${indent}  - ${inner[0].trimStart()}`, ...inner.slice(1));
        }
      } else lines.push(`${indent}${k}: [${v.map(scalar).join(", ")}]`);
    } else if (v && typeof v === "object") {
      lines.push(`${indent}${k}:`, yaml(v, `${indent}  `));
    } else lines.push(`${indent}${k}: ${scalar(v)}`);
  }
  return lines.join("\n");
}
const files = new Map(); // path relative to out → content
const note = (path, fm, body) => files.set(join("brain", path), `---\n${yaml(fm)}\n---\n${body}`);

// ---- brain notes ----
for (const a of AREAS) {
  note(`areas/${slug(a.title)}.md`, { id: idOf(a.key), type: "area", title: a.title, created: "2026-09-01", updated: "2026-09-01", summary: a.summary, lifecycle: "reviewed" }, a.body);
}
for (const o of ORGS) {
  note(pathOf(o.key), { id: idOf(o.key), type: "org", title: o.title, created: "2026-09-01", updated: "2026-09-01", summary: o.summary, lifecycle: "reviewed", area: idOf("area:client-work") }, `${o.title} is a client of the studio.\n`);
}
for (const p of PROJECTS) {
  const fm = { id: idOf(p.key), type: "project", title: p.title, created: "2026-09-01", updated: "2026-10-20", summary: p.summary, lifecycle: "reviewed", area: resolveValue(p.area), client: p.client ? resolveValue(p.client) : undefined, facts: p.facts, timeline: p.timeline ? resolveValue(p.timeline) : undefined };
  note(`projects/${p.slug}/project.md`, fm, p.body);
}
for (const s of SOURCES) {
  const body = s.body;
  note(`sources/notion/${s.date}-${slug(s.title)}.md`, {
    id: idOf(s.key), type: "source", title: s.title, created: s.date, updated: s.date,
    source_key: `notion:${pageId(s.key)}`, kind: s.kind, content_hash: `sha256:${sha(body)}`, captured: `${s.date}T10:00:00Z`,
    area: resolveValue(s.area), projects: s.projects ? resolveValue(s.projects) : undefined, summary: s.summary,
  }, body);
}

// The excluded inputs: two extract versions each and the suppression record of version 2 (0055, capture-and-review §4.5, §5.3).
for (const X of EXCLUDED_INPUTS) {
  const inputPage = pageId(X.key);
  const transcriptHash = sha(X.paragraphs.map(normalize).join("\n\n"));
  for (const v of X.versions) {
    const kept = X.paragraphs.map((text, i) => ({ n: i + 1, text, item: X.items[i] })).filter((p) => v.version === 1 || !X.excluded.includes(p.n));
    const body = kept.map((p) => `<!-- passage ¶${p.n} item ${p.item} -->\n${p.text}\n`).join("\n");
    const excludedNow = (item) => v.version > 1 && X.excluded.includes(X.items.indexOf(item) + 1);
    const previous = X.versions.find((w) => w.version === v.version - 1);
    note(`sources/notion/${v.date}-${slug(X.title)}-extract-v${v.version}.md`, {
      id: idOf(v.key), type: "source", title: `${X.title} (extract v${v.version})`, created: v.date, updated: v.date,
      source_key: `notion:${inputPage}`, kind: "minutes", content_hash: `sha256:${sha(body)}`, captured: `${v.date}T10:00:00Z`,
      extract: true, extract_of: inputPage, extract_version: v.version, replaces: previous ? idOf(previous.key) : undefined,
      transcript_hash: transcriptHash,
      selection: [{ id: "s1", effective: "use", explicit: null }, ...X.items.map((item) => ({ id: item, effective: excludedNow(item) ? "meeting only" : "use", explicit: excludedNow(item) ? "meeting only" : null }))],
      passages: kept.map((p) => ({ n: p.n, hash: passageHash(p.text), items: [p.item] })),
      area: idOf("area:client-work"), projects: [idOf("prj:harbor")],
      summary: v.version === 1 ? `Selected extract of the ${X.title}.` : `Selected extract of the ${X.title}; one item is now Meeting only.`,
    }, body);
  }
  files.set(join("brain", "_suppressions", `${inputPage}.json`), JSON.stringify({
    input: inputPage,
    records: X.versions.filter((v) => v.version > 1).map((v) => ({ version: v.version, passages: X.excluded.map((n) => ({ extract_of: inputPage, transcript_hash: transcriptHash, n })), full_copies: [], status: "active" })),
  }, null, 2) + "\n");
}

const supersededBy = new Map([...DECISIONS, ...MEMORIES].filter((e) => e.supersedes).map((e) => [e.supersedes, e]));
for (const d of DECISIONS) {
  const newer = supersededBy.get(d.key);
  const relations = [
    ...(d.supersedes ? [{ type: "supersedes", target: idOf(d.supersedes) }] : []),
    ...(newer ? [{ type: "superseded_by", target: idOf(newer.key) }] : []),
  ];
  note(pathOf(d.key), {
    id: idOf(d.key), type: "decision", title: d.title, created: d.date, updated: newer ? newer.date : d.date,
    summary: d.summary, lifecycle: newer ? "archived" : d.lifecycle ?? "reviewed", aliases: d.aliases, tags: d.tags, date: d.date,
    assessment: newer ? "superseded" : d.assessment ?? "accepted", valid_until: newer ? newer.date : undefined,
    area: d.area ? resolveValue(d.area) : undefined, projects: d.projects ? resolveValue(d.projects) : undefined,
    sources: resolveValue(d.sources), relations: relations.length ? relations : undefined, ...d.custom,
  }, resolveBody(d.body));
}
for (const m of MEMORIES) {
  const newer = supersededBy.get(m.key);
  const [level, ...rest] = m.scope.split(":");
  const target = rest.join(":");
  const relations = [
    ...(m.supersedes ? [{ type: "supersedes", target: idOf(m.supersedes) }] : []),
    ...(newer ? [{ type: "superseded_by", target: idOf(newer.key) }] : []),
  ];
  const [y, mo] = m.date.split("-");
  note(`memories/${y}/${mo}/${m.date}-${slug(m.title)}.md`, {
    id: idOf(m.key), type: "memory", title: m.title, created: m.date, updated: newer ? newer.date : m.date,
    summary: m.summary, lifecycle: newer ? "archived" : m.approved === false ? "draft" : "reviewed",
    scope: level,
    areas: level === "area" ? [idOf(target)] : undefined,
    projects: level === "project" ? [idOf(target)] : undefined,
    stacks: level === "stack" ? [target] : undefined,
    confidence: m.confidence, origin: m.origin,
    sources: m.sources ? resolveValue(m.sources) : undefined, relations: relations.length ? relations : undefined,
  }, resolveBody(m.body));
}

// ---- derived items and proposals (CC-185) ----
const entity = new Map([...PROJECTS, ...DECISIONS, ...VIEWS, ...REPORTS].map((e) => [e.key, e]));
const linkFrom = (folder, key) => `[${entity.get(key).title ?? key}](${folder}${pathOf(key)})`;
// The decision log of schema §16.2, as `brain views` writes it; it lists every decision of the project.
for (const v of VIEWS) {
  const project = entity.get(v.project);
  const up = "../../";
  const own = DECISIONS.filter((d) => (d.projects ?? []).includes(`@${v.project}`));
  const byDateThenId = (field) => (a, b) => (a[field] === b[field] ? (idOf(a.key) < idOf(b.key) ? -1 : 1) : a[field] < b[field] ? 1 : -1);
  const current = own.filter((d) => !supersededBy.has(d.key)).sort(byDateThenId("date"));
  const superseded = own.filter((d) => supersededBy.has(d.key)).map((d) => ({ ...d, until: supersededBy.get(d.key).date })).sort(byDateThenId("until"));
  const lines = (list, render) => (list.length ? list.map(render) : ["- None"]);
  const block = [
    "<!-- @generated:start -->", "## Current",
    ...lines(current, (d) => `- ${d.date} — ${linkFrom(up, d.key)} — ${d.assessment ?? "accepted"}${d.supersedes ? ` — supersedes ${linkFrom(up, d.supersedes)}` : ""}`),
    "", "## Superseded",
    ...lines(superseded, (d) => `- ${d.date} → ${d.until} — ${linkFrom(up, d.key)} — superseded by ${linkFrom(up, supersededBy.get(d.key).key)}`),
    "<!-- @generated:end -->",
  ].join("\n");
  const day = v.generated_at.slice(0, 10);
  note(pathOf(v.key), {
    id: idOf(v.key), type: "view", title: `${project.title} — decision log`, view_kind: v.kind, project: idOf(v.project),
    generated_from: [idOf(v.project), ...own.map((d) => idOf(d.key))].sort(), generated_at: v.generated_at, created: day, updated: day,
  }, `\n${block}\n\n<!-- @user:start -->\n<!-- @user:end -->\n`);
}
// Reports (schema §16.4): the six sections as written; `generated_from` is every note the body links to.
for (const r of REPORTS) {
  const body = Object.entries(r.sections).map(([heading, text]) => `## ${heading}\n\n${resolveBody(text)}\n`).join("\n");
  note(pathOf(r.key), {
    id: idOf(r.key), type: "view", title: r.title, created: r.date, updated: r.date, view_kind: "report", question: r.question,
    projects: resolveValue(r.projects), generated_from: r.links.map(idOf).sort(), generated_at: r.generated_at,
  }, `\n${body}`);
}
// Proposals (schema §11), approved in chat and not yet applied.
for (const p of PROPOSALS) {
  const fm = {
    id: idOf(p.key), type: "proposal", title: p.title, created: p.created, updated: p.decided_at.slice(0, 10), kind: p.kind,
    target: resolveValue(p.target), field: p.field, after: p.after, from: p.from,
    content: p.content === undefined ? undefined : resolveBody(p.content),
    why: p.why, source: resolveValue(p.source), status: "approved",
    decision: { action: "approve", decided_at: p.decided_at, decided_by: "chat" },
  };
  if (PROPOSAL_PASSAGES_FIELD && p.passages) fm[PROPOSAL_PASSAGES_FIELD] = p.passages.map((x) => passageRef(x.source, x.n));
  files.set(join("brain", "_proposals", `${p.created}-${slug(p.title)}.md`), `---\n${yaml(fm)}\n---\n`);
}

// ---- linked repos and brain.json ----
// The managed block 0.12.0's `brain link` wrote (src/commands/link.ts at v0.12.0, cli.md §5.12 of that release).
function linkBlock012(project, area) {
  const workflow = LINK_0_12_SKILLS.includes("brain-workflow");
  const adopt = LINK_0_12_SKILLS.includes("brain-workflow-adopt") ? "; to take over its existing plans and tasks, use `brain-workflow-adopt`." : ".";
  return [
    "<!-- ultimate-brain:start -->", "## Ultimate Brain", "", "Managed by `brain link`; edits inside this block are overwritten.", "",
    `This repo is linked to the user's second brain${project || area ? ":" : "."}`,
    ...(project ? [`- Project: ${project.title} (\`${idOf(project.key)}\`)`] : []),
    ...(area ? [`- Area: ${area.title} (\`${idOf(area.key)}\`)`] : []),
    "", "The brain holds decisions, key facts, people and meeting history that this repo does not.", "",
    "Consult it before you:",
    "- make or revisit a decision about scope, architecture, vendors or the client;",
    "- answer why something was decided, who someone is, or a date, budget or owner;",
    "- rely on a fact about the client or project that this repo does not state.",
    "", LINK_0_12_HOW,
    ...(workflow ? ["", `To track this repo's work, the standard way or connected to a Notion Project or Area, use the \`brain-workflow\` skill${adopt}`] : []),
    "", `The brain is read-only from this repo. Never edit its files from here.${workflow ? " A connected workflow's records change only through `brain workflow` commands." : ""}`,
    "<!-- ultimate-brain:end -->",
  ].join("\n");
}
const STATUS_MAP = { "in progress": "in_progress", review: "review", todo: "todo", done: "done" };
const TASK_PATTERN = "^### (?<id>[A-Z]+-\\d+) · (?<title>.+) · `(?<status>[^`]+)`$";
const repoEntries = [];
for (const r of REPOS) {
  const dir = join("repos", r.name);
  if (!r.marker) {
    files.set(join(dir, "README.md"), "A working folder with no link to the brain.\n");
    continue;
  }
  const project = r.marker.project ? idOf(r.marker.project) : undefined;
  const area = idOf(r.marker.area);
  files.set(join(dir, ".brain"), JSON.stringify({ repo: r.name, project, area, stacks: [...r.marker.stacks].sort() }, null, 2) + "\n");
  const kit = {
    kit_version: 1, name: r.name, placement: { area, project },
    knowledge: { patterns: ["docs/**"], never_read: [".env*"] },
    tasks: { mode: "tracked-in-repo", source: { kind: "markdown", path: "build/TASKS.md", format: "pattern", pattern: TASK_PATTERN }, status_map: STATUS_MAP },
    methodology: { summary: "Each task is a row in build/TASKS.md; where work stopped is one Stopped line under the row." },
  };
  const kitText = JSON.stringify(kit, null, 2) + "\n";
  files.set(join(dir, "brain-kit.json"), kitText);
  const rows = r.tasks.map((t) => `### ${t.id} · ${t.title} · \`${t.status}\`\n${t.stopped ? `**Stopped:** ${t.stopped}\n` : ""}`);
  files.set(join(dir, "build", "TASKS.md"), `# Tasks\n\n${rows.join("\n")}`);
  // A repo linked by 0.12.0's `brain link` (CC-185): its managed block between project-owned text, CLAUDE.md importing AGENTS.md.
  if (r.linkedBy === "0.12.0") {
    const block = linkBlock012(project && entity.get(r.marker.project), AREAS.find((a) => a.key === r.marker.area));
    files.set(join(dir, "AGENTS.md"), `${r.ownedBefore}${block}${r.ownedAfter}`);
    files.set(join(dir, "CLAUDE.md"), "@AGENTS.md\n");
  }
  repoEntries.push({ name: r.name, path: `~/memory-0.12-eval/repos/${r.name}`, area, ...(project ? { project } : {}), patterns: kit.knowledge.patterns, never_read: kit.knowledge.never_read, commit: "", kit: { sha256: `sha256:${sha(kitText)}` } });
}
// brain.json: the template's, with a synthetic owner and the linked repos.
const template = JSON.parse(readFileSync(join(product, "templates/brain/brain.json"), "utf8"));
files.set(join("brain", "brain.json"), JSON.stringify({ ...template, owner: { name: OWNER }, repos: repoEntries }, null, 2) + "\n");

// Product files, copied from this checkout as `brain init` installs them, so the brain lints clean (0038):
// the AGENTS.md rules block, CLAUDE.md, the assistant sub-agent and each vendored skill under .agents/skills and .claude/skills.
for (const path of ["AGENTS.md", "CLAUDE.md", ".claude/agents/ultimate-assistant.md"]) files.set(join("brain", path), readFileSync(join(product, "templates/brain", path), "utf8"));
const walk = (dir) => readdirSync(dir).sort().flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)).map((p) => join(name, p)) : [name]));
const skills = join(product, ".agents/skills");
for (const skill of readdirSync(skills).sort().filter((name) => statSync(join(skills, name)).isDirectory())) {
  for (const path of walk(join(skills, skill))) {
    const text = readFileSync(join(skills, skill, path), "utf8");
    files.set(join("brain", ".agents/skills", skill, path), text);
    files.set(join("brain", ".claude/skills", skill, path), text);
  }
}

// ---- cases ----
function evidenceId(key) {
  const task = /^task:([a-z0-9-]+)\/([A-Z]+-\d+)$/.exec(key);
  if (task) {
    const repo = REPOS.find((r) => r.name === task[1]);
    if (!repo?.tasks.some((t) => t.id === task[2])) throw new Error(`unknown task ${key}`);
    return `repo:${task[1]}/build/TASKS.md#${task[2]}`;
  }
  if (!ids.has(key)) throw new Error(`unknown evidence key ${key}`);
  return ids.get(key);
}
const writerOf = new Map(MEMORIES.map((m) => [m.key, m.writer]));
const seen = new Set();
// "{<key>}" in a question of CASES_0_13 names a note or proposal by its id (a full read, a proposal to apply).
const questionOf = (text) => text.replace(/\{([a-z]+:[a-z0-9-]+)\}/g, (_, key) => evidenceId(key));
const repoOf = new Map(REPOS.map((r) => [r.name, r]));
// The fields CC-185 adds (cases-0.13.mjs); a case of cases.mjs has none of them, so its entry is as CC-165 wrote it.
const added = (c) => ({
  ...(c.gap ? { gap: c.gap } : {}),
  ...(c.historical ? { historical: true } : {}),
  ...(c.read ? { read: c.read.map(evidenceId) } : {}),
  ...(c.forbiddenText ? { forbidden_text: c.forbiddenText } : {}),
  ...(c.outcomes ? { outcomes: c.outcomes.map((o) => ({
    proposal: evidenceId(o.proposal), expect: o.expect, target: evidenceId(o.target), target_path: pathOf(o.target),
    written: o.written ?? [], forbidden_written: o.forbiddenWritten ?? [], ...(o.reason !== undefined ? { reason: o.reason } : {}),
  })) } : {}),
  ...(c.createdForbidden ? { created_forbidden: c.createdForbidden } : {}),
  ...(c.upgrade ? { upgrade: (() => {
    const r = repoOf.get(c.upgrade.repo);
    if (!r?.linkedBy) throw new Error(`${c.id}: ${c.upgrade.repo} was not linked by an older release`);
    return { repo: r.name, linked_by: r.linkedBy, managed_block: "current", project_text_sha256: `sha256:${sha(r.ownedBefore + r.ownedAfter)}` };
  })() } : {}),
  ...(c.todo ? { todo: c.todo } : {}),
});
const cases = [...CASES, ...CASES_0_13].map((c) => {
  if (seen.has(c.id)) throw new Error(`duplicate case ${c.id}`);
  seen.add(c.id);
  if (!REPOS.some((r) => r.name === c.caller)) throw new Error(`${c.id}: unknown caller ${c.caller}`);
  const resolved = {
    id: c.id, kind: c.kind, category: c.category, question: questionOf(c.question),
    caller: { repo: c.caller, ...(c.task ? { task: c.task } : {}), ...(c.agent ? { agent: c.agent } : {}) },
    ...(c.handover ? { handover: c.handover } : {}),
    expected_evidence: (c.expected ?? []).map(evidenceId),
    forbidden_evidence: (c.forbidden ?? []).map(evidenceId),
    labelled_evidence: (c.labelled ?? []).map(([key, label]) => ({ id: evidenceId(key), label })),
    rank_above: (c.rankAbove ?? []).map(([a, b]) => [evidenceId(a), evidenceId(b)]),
    facts: c.facts ?? [],
    forbidden_facts: c.forbiddenFacts ?? [],
    abstain: c.abstain === true,
    ...added(c),
    ...(c.why ? { why: c.why } : {}),
  };
  // Who wrote each expected memory, so agent-switch cases can be checked (case metadata, never a note field).
  const writers = (c.expected ?? []).filter((k) => writerOf.has(k)).map((k) => ({ id: evidenceId(k), writer: writerOf.get(k) }));
  if (writers.length) resolved.memory_writers = writers;
  return resolved;
});

// ---- write ----
rmSync(join(out, "brain"), { recursive: true, force: true });
rmSync(join(out, "repos"), { recursive: true, force: true });
for (const [path, text] of [...files].sort(([a], [b]) => (a < b ? -1 : 1))) {
  mkdirSync(dirname(join(out, path)), { recursive: true });
  writeFileSync(join(out, path), text);
}
mkdirSync(dirname(casesFile), { recursive: true });
writeFileSync(casesFile, JSON.stringify({ version: 1, decision: "0074 §6", cases }, null, 2) + "\n");
const count = (k) => cases.filter((c) => c.kind === k).length;
console.log(JSON.stringify({ files: files.size, memories: MEMORIES.length, cases: { trust: count("trust"), answerable: count("answerable"), unknown: count("unknown") } }));
