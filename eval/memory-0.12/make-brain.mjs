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
import { AREAS, DECISIONS, EXCLUDED_INPUT, MEMORIES, ORGS, OWNER, PROJECTS, REPOS, SOURCES } from "./world.mjs";

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
const PREFIX = { area: "area", org: "org", prj: "prj", src: "src", dec: "dec", mem: "mem" };
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
for (const e of [...AREAS, ...ORGS, ...PROJECTS, ...SOURCES, ...EXCLUDED_INPUT.versions, ...DECISIONS, ...MEMORIES]) idOf(e.key);

const resolveValue = (v) => {
  if (typeof v === "string" && v.startsWith("@")) return idOf(v.slice(1));
  if (Array.isArray(v)) return v.map(resolveValue);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveValue(x)]));
  return v;
};
const resolveBody = (text) =>
  text
    .replace(/\{¶@([^#}]+)#(\d+)\}/g, (_, key, n) => `^[${idOf(key)}#¶${n}:${passageHash(EXCLUDED_INPUT.paragraphs[Number(n) - 1])}]`)
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
const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---- brain notes ----
for (const a of AREAS) {
  note(`areas/${slug(a.title)}.md`, { id: idOf(a.key), type: "area", title: a.title, created: "2026-09-01", updated: "2026-09-01", summary: a.summary, lifecycle: "reviewed" }, a.body);
}
for (const o of ORGS) {
  note(`knowledge/orgs/${slug(o.title)}.md`, { id: idOf(o.key), type: "org", title: o.title, created: "2026-09-01", updated: "2026-09-01", summary: o.summary, lifecycle: "reviewed", area: idOf("area:client-work") }, `${o.title} is a client of the studio.\n`);
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

// The excluded input: two extract versions and the suppression record of version 2 (0055, capture-and-review §4.5, §5.3).
const X = EXCLUDED_INPUT;
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
    summary: v.version === 1 ? "Selected extract of the Harbor pricing call." : "Selected extract of the Harbor pricing call; one item is now Meeting only.",
  }, body);
}
files.set(join("brain", "_suppressions", `${inputPage}.json`), JSON.stringify({
  input: inputPage,
  records: X.versions.filter((v) => v.version > 1).map((v) => ({ version: v.version, passages: X.excluded.map((n) => ({ extract_of: inputPage, transcript_hash: transcriptHash, n })), full_copies: [], status: "active" })),
}, null, 2) + "\n");

const supersededBy = new Map([...DECISIONS, ...MEMORIES].filter((e) => e.supersedes).map((e) => [e.supersedes, e]));
for (const d of DECISIONS) {
  const newer = supersededBy.get(d.key);
  const relations = [
    ...(d.supersedes ? [{ type: "supersedes", target: idOf(d.supersedes) }] : []),
    ...(newer ? [{ type: "superseded_by", target: idOf(newer.key) }] : []),
  ];
  note(`knowledge/decisions/${d.date}-${slug(d.title)}.md`, {
    id: idOf(d.key), type: "decision", title: d.title, created: d.date, updated: newer ? newer.date : d.date,
    summary: d.summary, lifecycle: newer ? "archived" : "reviewed", date: d.date,
    assessment: newer ? "superseded" : d.assessment ?? "accepted", valid_until: newer ? newer.date : undefined,
    area: d.area ? resolveValue(d.area) : undefined, projects: d.projects ? resolveValue(d.projects) : undefined,
    sources: resolveValue(d.sources), relations: relations.length ? relations : undefined,
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

// ---- linked repos and brain.json ----
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
const cases = CASES.map((c) => {
  if (seen.has(c.id)) throw new Error(`duplicate case ${c.id}`);
  seen.add(c.id);
  if (!REPOS.some((r) => r.name === c.caller)) throw new Error(`${c.id}: unknown caller ${c.caller}`);
  const resolved = {
    id: c.id, kind: c.kind, category: c.category, question: c.question,
    caller: { repo: c.caller, ...(c.task ? { task: c.task } : {}), ...(c.agent ? { agent: c.agent } : {}) },
    ...(c.handover ? { handover: c.handover } : {}),
    expected_evidence: (c.expected ?? []).map(evidenceId),
    forbidden_evidence: (c.forbidden ?? []).map(evidenceId),
    labelled_evidence: (c.labelled ?? []).map(([key, label]) => ({ id: evidenceId(key), label })),
    rank_above: (c.rankAbove ?? []).map(([a, b]) => [evidenceId(a), evidenceId(b)]),
    facts: c.facts ?? [],
    forbidden_facts: c.forbiddenFacts ?? [],
    abstain: c.abstain === true,
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
