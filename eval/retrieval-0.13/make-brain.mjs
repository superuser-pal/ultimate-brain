#!/usr/bin/env node
// Builds the brains and caller folders of the 0.13.0 English retrieval evaluation (CC-203, decision 0080,
// spec/retrieval.md §5), and writes cases.json and reference-answers.json with every key resolved to its id.
// Usage: node eval/retrieval-0.13/make-brain.mjs <out-dir> [--cases <file>] [--answers <file>]
//   <out-dir>/original     eval/search-0.5's brain, unchanged: the 50 original questions run here
//   <out-dir>/brain        the same brain plus the retrieval layer of world.mjs: the 80 cases run here
//   <out-dir>/repos/<name> the caller folders: a `.brain` naming a project or an area (`scratch` has none)
// Deterministic: the original brain comes from eval/search-0.5/make-brain.mjs (seeded); the layer's ids are hashes of
// its keys. Fails when eval/search-0.5 would write different questions, or a layer note would replace an original one.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";

import { CASES } from "./cases.mjs";
import { AREAS, CALLERS, DECISIONS, MEETINGS, ORGS, PEOPLE, PROJECTS } from "./world.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const product = join(here, "../..");
const cli = join(product, "src/cli.ts");
const args = process.argv.slice(2);
const out = args[0];
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const casesFile = option("--cases", join(here, "cases.json"));
const answersFile = option("--answers", join(here, "reference-answers.json"));
if (!out || out.startsWith("--")) {
  console.error("usage: make-brain.mjs <out-dir> [--cases <file>] [--answers <file>]");
  process.exit(2);
}
const sha = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const brainAt = (dir) => (...a) => execFileSync("node", [cli, ...a], { env: { ...process.env, BRAIN_DIR: dir }, stdio: ["ignore", "ignore", "inherit"] });

// ---- 1. The original brain, unchanged ----
const original = join(out, "original");
const brain = join(out, "brain");
for (const dir of [original, brain, join(out, "repos")]) if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const scratchDir = mkdtempSync(join(tmpdir(), "retrieval-0.13-"));
const questionsAt = join(scratchDir, "questions.json");
execFileSync("node", [join(product, "eval/search-0.5/make-brain.mjs"), original, questionsAt], { stdio: ["ignore", "ignore", "inherit"] });
const committedQuestions = readFileSync(join(product, "eval/search-0.5/questions.json"));
if (!readFileSync(questionsAt).equals(committedQuestions)) {
  console.error("eval/search-0.5/make-brain.mjs wrote questions that differ from eval/search-0.5/questions.json: the original set changed");
  process.exit(1);
}
rmSync(scratchDir, { recursive: true, force: true });
cpSync(original, brain, { recursive: true });

// ---- 2. The retrieval layer ----
const walk = (dir) => readdirSync(dir).sort().flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)).map((p) => join(name, p)) : [name]));
const takenIds = new Set(walk(original).filter((p) => p.endsWith(".md")).map((p) => /^id: (\S+)$/m.exec(readFileSync(join(original, p), "utf8"))?.[1]).filter(Boolean));
const ALPHA = "0123456789abcdefghjkmnpqrstvwxyz";
const PREFIX = { area: "area", org: "org", per: "per", prj: "prj", mtg: "mtg", src: "src", dec: "dec", ref: "ref", que: "que" };
const ids = new Map();
function idOf(key) {
  if (ids.has(key)) return ids.get(key);
  const prefix = PREFIX[key.split(":")[0]];
  if (!prefix) throw new Error(`no id prefix for ${key}`);
  const bytes = createHash("sha256").update(`retrieval-0.13:${key}`).digest();
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHA[bytes[i] % 32];
  const id = `${prefix}-${s}`;
  if (takenIds.has(id) || [...ids.values()].includes(id)) throw new Error(`id collision for ${key}`);
  ids.set(key, id);
  return id;
}
const meetingKey = (m) => `mtg:${m.key}`;
const sourceKey = (m) => `src:${m.key}`;
const meetingByKey = new Map(MEETINGS.map((m) => [m.key, m]));
for (const e of [...AREAS, ...ORGS, ...PEOPLE, ...PROJECTS, ...DECISIONS]) idOf(e.key);
for (const m of MEETINGS) { idOf(meetingKey(m)); idOf(sourceKey(m)); }

const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const files = new Map();
function note(path, fm, body) {
  if (existsSync(join(original, path)) || files.has(path)) throw new Error(`layer note would replace ${path}`);
  files.set(path, `---\n${stringify(fm, { lineWidth: 0 })}---\n${body}`);
}
const projectOf = new Map(PROJECTS.map((p) => [p.key, p]));
const dated = (m) => ({ created: m.date, updated: m.date });
const minutesBody = (m) => `${m.minutes.join("\n\n")}\n`;
const timelineEntry = ([field, value, from, meeting, assessment, until]) => ({
  field, value, from, ...(until ? { until } : {}), learned: from, source: idOf(sourceKey(meetingByKey.get(meeting))), assessment,
});

for (const a of AREAS) note(`areas/${slug(a.title)}.md`, { id: idOf(a.key), type: "area", title: a.title, summary: a.summary, lifecycle: "reviewed", created: "2025-06-01", updated: "2025-06-01" }, `${a.summary}\n`);
for (const o of ORGS) note(`knowledge/orgs/${slug(o.title)}.md`, { id: idOf(o.key), type: "org", title: o.title, summary: o.summary, lifecycle: "reviewed", area: idOf(o.area), created: "2025-06-01", updated: "2025-06-01" }, `${o.body}\n`);
for (const p of PROJECTS) {
  note(`projects/${p.slug}/project.md`, {
    id: idOf(p.key), type: "project", title: p.title, summary: p.summary, lifecycle: "reviewed", area: idOf(p.area),
    ...(p.org ? { client: idOf(p.org) } : {}), ...(p.people.length ? { people: p.people.map(idOf) } : {}),
    facts: p.facts, timeline: p.timeline.map(timelineEntry), created: "2025-06-01", updated: "2026-07-02",
  }, `${p.body}\n`);
}
for (const pe of PEOPLE) {
  const learnedAt = meetingByKey.get(pe.learned.slice(4));
  note(`knowledge/people/${slug(pe.title)}.md`, {
    id: idOf(pe.key), type: "person", title: pe.title, summary: `${pe.role[0].toUpperCase()}${pe.role.slice(1)}${pe.org ? ` at ${ORGS.find((o) => o.key === pe.org).title}` : " at the studio"}.`,
    lifecycle: "reviewed", ...(pe.org ? { org: idOf(pe.org) } : {}), projects: pe.projects.map(idOf), facts: { role: pe.role },
    timeline: [{ field: "role", value: pe.role, from: learnedAt.date, learned: learnedAt.date, source: idOf(pe.learned), assessment: "accepted" }],
    created: learnedAt.date, updated: learnedAt.date,
  }, `${pe.body}\n`);
}
for (const m of MEETINGS) {
  const body = minutesBody(m);
  note(`sources/notion/${m.date}-minutes-${slug(m.title)}.md`, {
    id: idOf(sourceKey(m)), type: "source", title: `${m.title} (Notion minutes)`, source_key: `notion:${sha(`retrieval-0.13:${m.key}`).slice(0, 32)}`,
    content_hash: `sha256:${sha(body)}`, captured: `${m.date}T18:00:00Z`, ...dated(m),
  }, body);
  const project = projectOf.get(m.project);
  note(`knowledge/meetings/${m.date}-${slug(m.title)}.md`, {
    id: idOf(meetingKey(m)), type: "meeting", title: m.title, summary: `${m.title} on ${m.date}.`, lifecycle: "reviewed", date: m.date,
    attendees: m.attendees.map(idOf), source: idOf(sourceKey(m)), decisions: (m.decisions ?? []).map(idOf), area: idOf(project.area), projects: [idOf(project.key)],
    sources: [idOf(sourceKey(m))], ...dated(m),
  }, `## Summary\n${body}`);
}
for (const d of DECISIONS) {
  const m = meetingByKey.get(d.meeting);
  const project = projectOf.get(m.project);
  note(`knowledge/decisions/${m.date}-${slug(d.title)}.md`, {
    id: idOf(d.key), type: "decision", title: d.title, summary: d.decision, lifecycle: "reviewed", date: m.date, assessment: "accepted",
    decided_in: idOf(meetingKey(m)), area: idOf(project.area), projects: [idOf(project.key)], sources: [idOf(sourceKey(m))], ...dated(m),
  }, `## Decision\n${d.decision}\n\n## Context\n${d.context}\n`);
}
// ---- 2b. Companion notes: the original brain's density ----
// In eval/search-0.5 every project has 8 decisions, 10 meetings, references and open questions that all name it, so the
// note that answers competes with many notes about the same subject. Each layer project gets the same shape from a seeded
// stream: 5 decisions, 8 meetings, 4 references and 2 questions, written from neutral topics and filler that hold none of
// the cases' facts (the audit checks every unknown case against them). Without them each subject's few notes all fit in
// the first ten, which no real brain's project does.
function mulberry32(start) {
  let seed = start;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(203);
const pick = (a) => a[Math.floor(rand() * a.length)];
const shuffled = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const COMPANION_TOPICS = [
  { key: "translations", alt: "languages on the pages", tech: ["Lokalise", "Crowdin", "Weblate"] },
  { key: "content management", alt: "editing pages", tech: ["Sanity", "Strapi", "WordPress", "Contentful"] },
  { key: "search", alt: "site search", tech: ["Algolia", "Meilisearch", "Typesense", "Postgres full-text"] },
  { key: "email delivery", alt: "sending mail", tech: ["Postmark", "SendGrid", "Resend", "Amazon SES"] },
  { key: "database", alt: "where the data lives", tech: ["Postgres", "MySQL", "SQLite"] },
  { key: "authentication", alt: "sign-in", tech: ["Auth0", "Keycloak", "Clerk", "Supabase Auth"] },
];
const COMPANION_REASONS = [
  "the developers already knew it from earlier work", "it keeps the data in the EU", "it had the integrations the client needed",
  "it needs the least maintenance for a small team", "it was the simplest option for the first release",
];
const COMPANION_FILLER = [
  "The team reviewed the open tickets and agreed to keep the weekly cadence.",
  "Most of the call went on the backlog and who picks up the next sprint.",
  "Some time went on the staging environment, which was slow again.",
  "We walked through the review comments one by one.",
  "Nobody raised a blocker; the next check-in stays on the same day.",
  "The client asked for a short written update after each sprint.",
  "Access to the shared drive is still missing for one contractor.",
  "Two small bugs from testing were fixed and closed.",
  "The accessibility checklist was shared with the client.",
  "The kickoff deck was shared again for the new people on the team.",
];
const shortName = (p) => (p.org ? ORGS.find((o) => o.key === p.org).title : "Studio");
const companionDay = (n) => new Date(Date.UTC(2025, 6, 1) + n * 86400000).toISOString().slice(0, 10);
let companions = 0;
for (const p of PROJECTS) {
  const project = { id: idOf(p.key), area: idOf(p.area) };
  const people = p.people.length ? p.people : ["per:ines"];
  const decisions = shuffled(COMPANION_TOPICS).slice(0, 5).map((t, i) => {
    const tech = pick(t.tech);
    return { key: `dec:${p.key.slice(4)}-c${i}`, t, tech, title: `Use ${tech} for ${t.key} on the ${p.title}`, reason: pick(COMPANION_REASONS) };
  });
  const meetings = Array.from({ length: 8 }, (_, i) => ({
    key: `mtg:${p.key.slice(4)}-c${i}`, date: companionDay(Math.floor(rand() * 400)), title: `${shortName(p)} ${pick(["sync", "weekly", "check-in", "review"])}`,
    attendees: shuffled(people).slice(0, 2), decision: decisions[i],
  }));
  for (const m of meetings) {
    idOf(m.key); idOf(`src:${m.key.slice(4)}`);
    const lines = [pick(COMPANION_FILLER), ...(m.decision ? [`The team agreed: ${m.decision.title.replace(/ on the .*$/, "")}.`] : []), pick(COMPANION_FILLER)];
    const body = `${lines.join("\n\n")}\n`;
    note(`sources/notion/${m.date}-minutes-${m.key.slice(4)}.md`, {
      id: idOf(`src:${m.key.slice(4)}`), type: "source", title: `${m.title} (Notion minutes)`, source_key: `notion:${sha(`retrieval-0.13:${m.key}`).slice(0, 32)}`,
      content_hash: `sha256:${sha(body)}`, captured: `${m.date}T18:00:00Z`, created: m.date, updated: m.date,
    }, body);
    note(`knowledge/meetings/${m.date}-${slug(m.title)}-${m.key.slice(4)}.md`, {
      id: idOf(m.key), type: "meeting", title: m.title, summary: `${m.title} on the ${p.title}.`, lifecycle: "reviewed", date: m.date,
      attendees: m.attendees.map(idOf), source: idOf(`src:${m.key.slice(4)}`), decisions: m.decision ? [idOf(m.decision.key)] : [], area: project.area,
      projects: [project.id], sources: [idOf(`src:${m.key.slice(4)}`)], created: m.date, updated: m.date,
    }, `## Summary\n${body}`);
    companions += 2;
  }
  for (const [i, d] of decisions.entries()) {
    const m = meetings[i];
    note(`knowledge/decisions/${m.date}-${slug(d.title)}.md`, {
      id: idOf(d.key), type: "decision", title: d.title, summary: `${shortName(p)} chose ${d.tech} for ${d.t.key}.`, lifecycle: "reviewed", date: m.date,
      assessment: "accepted", decided_in: idOf(m.key), area: project.area, projects: [project.id], sources: [idOf(`src:${m.key.slice(4)}`)], created: m.date, updated: m.date,
    }, `## Decision\nUse ${d.tech} for ${d.t.key}.\n\n## Context\nChosen because ${d.reason}.\n\n## Consequences\n${pick(COMPANION_FILLER)}\n`);
    companions++;
  }
  for (const [i, kind] of shuffled(["requirements", "contract", "style guide", "API spec", "handover notes"]).slice(0, 4).entries()) {
    const title = `${p.title}: ${kind} v${1 + Math.floor(rand() * 3)}`;
    note(`knowledge/references/${slug(title)}.md`, {
      id: idOf(`ref:${p.key.slice(4)}-c${i}`), type: "reference", title, summary: `Reference document for the ${p.title}.`, lifecycle: "reviewed", origin: "part",
      projects: [project.id], sources: [idOf(`src:${meetings[0].key.slice(4)}`)], created: meetings[0].date, updated: meetings[0].date,
    }, `${pick(COMPANION_FILLER)} ${pick(COMPANION_FILLER)}\n`);
    companions++;
  }
  for (const [i, t] of shuffled(COMPANION_TOPICS).slice(0, 2).entries()) {
    const title = `Should the ${p.title} revisit ${t.key}?`;
    note(`knowledge/questions/${slug(title)}.md`, {
      id: idOf(`que:${p.key.slice(4)}-c${i}`), type: "question", title, summary: `Open question on ${t.key} for ${shortName(p)}.`, lifecycle: "draft", kind: "question",
      projects: [project.id], created: meetings[1].date, updated: meetings[1].date,
    }, `Raised when ${shortName(p)} asked about ${t.alt}.\n`);
    companions++;
  }
}

for (const [path, text] of files) {
  mkdirSync(dirname(join(brain, path)), { recursive: true });
  writeFileSync(join(brain, path), text);
}
brainAt(brain)("index");

// ---- 3. Caller folders ----
for (const c of CALLERS) {
  const dir = join(out, "repos", c.name);
  mkdirSync(dir, { recursive: true });
  if (c.project || c.area) writeFileSync(join(dir, ".brain"), `${JSON.stringify({ repo: c.name, ...(c.project ? { project: idOf(c.project) } : {}), ...(c.area ? { area: idOf(c.area) } : {}) }, null, 2)}\n`);
}

// ---- 4. cases.json and reference-answers.json ----
const resolveRef = (text) => text.replace(/\{([a-z]+:[a-z0-9-]+)\}/g, (_, key) => `[${idOf(key)}]`);
const cases = CASES.map((c) => ({
  id: c.id, kind: c.kind, split: c.split, caller: c.caller, question: c.question,
  ...(c.sets ? { evidence_sets: c.sets.map((set) => set.map(idOf)) } : {}),
  facts: c.facts ?? [],
  ...(c.as_of ? { as_of: c.as_of } : {}),
  ...(c.subjects ? { subjects: c.subjects.map((s) => ({ id: idOf(s.key), name: s.name, value: s.value, evidence: s.evidence.map(idOf) })) } : {}),
  ...(c.absent ? { absent: c.absent.map((a) => ({ about: idOf(a.about), none: a.none })) } : {}),
  forbidden_facts: c.subjects ? c.subjects.map((s) => s.stated ?? s.value) : [],
  forbidden_evidence: [],
  audit: c.audit,
}));
const answers = Object.fromEntries(CASES.map((c) => {
  const text = resolveRef(c.ref);
  return [c.id, { text, citations: [...text.matchAll(/\[([a-z]+-[0-9a-z]{8})\]/g)].map((m) => m[1]) }];
}));
const callers = Object.fromEntries(CALLERS.map((c) => [c.name, { ...(c.project ? { project: idOf(c.project) } : {}), ...(c.area ? { area: idOf(c.area) } : {}) }]));
const areaOf = Object.fromEntries(PROJECTS.map((p) => [idOf(p.key), idOf(p.area)]));
const titles = Object.fromEntries(PROJECTS.map((p) => [idOf(p.key), p.title]));
writeFileSync(casesFile, `${JSON.stringify({
  note: "Generated by eval/retrieval-0.13/make-brain.mjs from cases.mjs and world.mjs; never edit by hand.",
  original_questions_sha256: sha(committedQuestions.toString("utf8")), callers, project_area: areaOf, project_titles: titles, cases,
}, null, 2)}\n`);
writeFileSync(answersFile, `${JSON.stringify(answers, null, 2)}\n`);
const count = (k) => cases.filter((c) => c.kind === k).length;
console.log(JSON.stringify({ layer_notes: files.size, companions, cases: cases.length, fact: count("fact"), paraphrase: count("paraphrase"), clarify: count("clarify"), unknown: count("unknown"), held: cases.filter((c) => c.split === "held").length }));
