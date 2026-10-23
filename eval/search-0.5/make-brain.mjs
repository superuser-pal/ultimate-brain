#!/usr/bin/env node
// Builds a synthetic brain of about 2,000 notes and the known questions for CC-50.
// Usage: node eval/search-0.5/make-brain.mjs <out-dir> <questions.json>
// Deterministic: the same seed gives the same files. Every name is made up.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [out, qfile] = process.argv.slice(2);
if (!out || !qfile) {
  console.error("usage: make-brain.mjs <out-dir> <questions.json>");
  process.exit(2);
}

let seed = 50;
function rand() {
  // mulberry32
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (a) => a[Math.floor(rand() * a.length)];
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
const ALPHA = "0123456789abcdefghjkmnpqrstvwxyz";
const used = new Set();
function id(prefix) {
  for (;;) {
    let s = "";
    for (let i = 0; i < 8; i++) s += ALPHA[Math.floor(rand() * ALPHA.length)];
    if (!used.has(s)) {
      used.add(s);
      return `${prefix}-${s}`;
    }
  }
}
const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const day = (n) => new Date(Date.UTC(2025, 0, 1) + n * 86400000).toISOString().slice(0, 10);

// Made-up client names from syllables, so none is a real company.
const SYL = ["nor", "vik", "tal", "bren", "quo", "zel", "mar", "dun", "ost", "ral", "pex", "lum", "tor", "gav", "sel", "kip"];
const clients = [];
while (clients.length < 20) {
  const n = pick(SYL) + pick(SYL);
  const name = n[0].toUpperCase() + n.slice(1);
  if (!clients.includes(name)) clients.push(name);
}
const FIRST = ["Ana", "Bruno", "Clara", "Diego", "Elena", "Félix", "Gala", "Hugo", "Irene", "Jon", "Kira", "Lucas", "Marta", "Nil", "Olga", "Pau", "Quim", "Rosa", "Sergi", "Tea", "Unai", "Vera", "Xavi", "Yara", "Zoe"];
const LAST = ["Abril", "Bosch", "Cano", "Duran", "Esteve", "Ferrer", "Gil", "Herrero", "Iglesias", "Jové", "Llorens", "Mas", "Nadal", "Ortega", "Pons", "Quer", "Riera", "Soler", "Tous", "Vidal"];
const ROLES = ["designer", "developer", "project manager", "product owner", "data analyst", "QA lead", "account manager", "CTO"];

// Topic → words the notes use, the user's synonyms for it, and the technologies chosen.
const TOPICS = [
  { key: "authentication", alt: ["log in", "sign-in", "login"], tech: ["Supabase Auth", "Auth0", "Firebase Auth", "Keycloak", "Clerk"] },
  { key: "invoicing", alt: ["billing", "bills", "charging customers"], tech: ["Stripe Billing", "Chargebee", "Holded", "Paddle"] },
  { key: "hosting", alt: ["where it runs", "servers", "deploy"], tech: ["Vercel", "Fly.io", "Hetzner", "AWS ECS", "Render"] },
  { key: "analytics", alt: ["tracking visitors", "metrics", "stats"], tech: ["Plausible", "PostHog", "Matomo", "GA4"] },
  { key: "search", alt: ["finding products", "site search", "lookup"], tech: ["Algolia", "Meilisearch", "Typesense", "Postgres full-text"] },
  { key: "email delivery", alt: ["sending mail", "newsletters", "transactional mail"], tech: ["Postmark", "SendGrid", "Resend", "Amazon SES"] },
  { key: "translations", alt: ["languages", "multilingual", "i18n"], tech: ["Lokalise", "Crowdin", "Weblate"] },
  { key: "content management", alt: ["editing pages", "CMS", "blog posts"], tech: ["Sanity", "Strapi", "WordPress", "Contentful"] },
  { key: "mobile app framework", alt: ["phone app", "iOS and Android", "app stack"], tech: ["React Native", "Flutter", "Expo", "native Swift and Kotlin"] },
  { key: "database", alt: ["where the data lives", "storage", "data store"], tech: ["Postgres", "MySQL", "MongoDB", "SQLite"] },
];
const PROJECT_KINDS = ["website", "shop", "mobile app", "CRM migration", "intranet", "booking platform"];
const FILLER = [
  "The team reviewed the open tickets and agreed to keep the weekly cadence.",
  "Most of the call went on the backlog and who picks up the next sprint.",
  "Some time went on the staging environment, which was slow again this week.",
  "We walked through the design review comments one by one.",
  "Nobody raised a blocker; the next check-in stays on the same day.",
  "The client asked for a short written update after each sprint.",
  "Testing on older phones found two layout bugs, both small.",
  "The kickoff deck was shared again for the new people on the team.",
  "Access to the shared drive is still missing for one contractor.",
  "We agreed to move the retro to the end of the month.",
];

const notes = []; // { dir, file, fm, body }
const add = (n) => (notes.push(n), n);
function fmText(fm) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fm)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) lines.push(`${k}: [${v.join(", ")}]`);
    else if (v && typeof v === "object") {
      lines.push(`${k}:`);
      for (const [k2, v2] of Object.entries(v)) lines.push(`  ${k2}: ${v2}`);
    } else lines.push(`${k}: ${typeof v === "string" && /[:#\[\]{}]/.test(v) ? JSON.stringify(v) : v}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

const area = { id: id("area"), title: "Clients" };
add({ dir: "areas", file: "clients.md", fm: { id: area.id, type: "area", title: "Clients", summary: "Client work.", lifecycle: "reviewed", created: day(0), updated: day(0) }, body: "All client projects.\n" });

const orgs = clients.map((name) => {
  const o = { id: id("org"), title: name };
  add({ dir: "knowledge/orgs", file: `${slug(name)}.md`, fm: { id: o.id, type: "org", title: name, summary: `${name} is a client of the studio.`, lifecycle: "reviewed", area: area.id, created: day(1), updated: day(1) }, body: `${name} has worked with us since ${2019 + int(0, 5)}.\n` });
  return o;
});

const people = [];
const usedNames = new Set();
for (let i = 0; i < 300; i++) {
  let name;
  do name = `${pick(FIRST)} ${pick(LAST)}`;
  while (usedNames.has(name) && usedNames.size < FIRST.length * LAST.length);
  if (usedNames.has(name)) name = `${name} ${i}`;
  usedNames.add(name);
  people.push({ id: id("per"), title: name, org: pick(orgs), projects: [], role: pick(ROLES) });
}

const projects = [];
for (const org of orgs) {
  for (const kind of shuffle(PROJECT_KINDS).slice(0, 3)) {
    const p = { id: id("prj"), title: `${org.title} ${kind}`, org, kind, team: shuffle(people.filter((x) => x.org === org)).slice(0, 4) };
    while (p.team.length < 4) p.team.push(pick(people));
    p.budget = int(12, 180);
    for (const m of p.team) m.projects.push(p);
    projects.push(p);
  }
}

// Decisions: each project chooses a technology for 8 topics; some are later replaced.
const decisions = [];
for (const p of projects) {
  for (const t of shuffle(TOPICS).slice(0, 8)) {
    const tech = pick(t.tech);
    const d = { id: id("dec"), title: `Use ${tech} for ${t.key} on the ${p.title}`, p, t, tech, date: day(int(30, 600)) };
    d.reason = pick([
      `it was cheaper than the alternatives at ${p.org.title}'s volume`,
      `the developers already knew it from earlier work`,
      `it keeps the data in the EU`,
      `it was the only option with the integrations ${p.org.title} needed`,
      `it needs the least maintenance for a small team`,
    ]);
    decisions.push(d);
  }
}

// Meetings: 10 per project; one of them states the budget in its body only.
const meetings = [];
for (const p of projects) {
  const ds = decisions.filter((d) => d.p === p);
  for (let i = 0; i < 10; i++) {
    const m = { id: id("mtg"), p, date: day(int(20, 640)), attendees: shuffle(p.team).slice(0, 3) };
    m.title = `${p.org.title} ${pick(["sync", "weekly", "check-in", "review"])}`;
    m.decs = i < ds.length ? [ds[i]] : [];
    m.budget = i === 9;
    meetings.push(m);
  }
}

// Concepts and references: generic, many share topic words.
const concepts = [];
for (let i = 0; i < 300; i++) {
  const t = pick(TOPICS);
  const tech = pick(t.tech);
  concepts.push({ id: id("con"), title: `${tech} ${pick(["pricing", "limits", "setup notes", "migration steps", "pitfalls", "rate limits", "data residency"])} ${i}`, t, tech });
}
const references = [];
for (let i = 0; i < 151; i++) {
  const p = pick(projects);
  references.push({ id: id("ref"), title: `${p.title}: ${pick(["requirements", "contract", "style guide", "API spec", "handover notes"])} v${int(1, 4)} (${i})`, p });
}
const questionsN = [];
for (let i = 0; i < 70; i++) {
  const p = pick(projects);
  const t = pick(TOPICS);
  questionsN.push({ id: id("que"), title: `Should the ${p.title} revisit ${t.key}? (${i})`, p, t });
}

// ---- write notes ----
for (const pe of people) {
  const role = pe.role;
  add({
    dir: "knowledge/people", file: `${slug(pe.title)}.md`,
    fm: { id: pe.id, type: "person", title: pe.title, summary: `${role[0].toUpperCase() + role.slice(1)} at ${pe.org.title}.`, lifecycle: "reviewed", org: pe.org.id, projects: pe.projects.map((p) => p.id), facts: { role }, created: day(2), updated: day(2) },
    body: `Works on ${pe.projects.map((p) => p.title).join(", ") || "no current project"}. Prefers ${pick(["email", "calls", "short written updates", "the shared channel"])}.\n`,
  });
}
for (const p of projects) {
  add({
    dir: `projects/${slug(p.title)}`, file: "project.md",
    fm: { id: p.id, type: "project", title: p.title, summary: `The ${p.kind} for ${p.org.title}.`, lifecycle: "reviewed", area: area.id, created: day(3), updated: day(3) },
    body: `Team: ${p.team.map((m) => m.title).join(", ")}.\n`,
  });
}
for (const d of decisions) {
  add({
    dir: "knowledge/decisions", file: `${d.date}-${slug(d.title)}.md`,
    fm: { id: d.id, type: "decision", title: d.title, summary: `${d.p.org.title} chose ${d.tech} for ${d.t.key}.`, lifecycle: "reviewed", date: d.date, assessment: "accepted", area: area.id, projects: [d.p.id], created: d.date, updated: d.date },
    body: `## Decision\nUse ${d.tech} for ${d.t.key}.\n\n## Context\nChosen because ${d.reason}.\n\n## Consequences\n${pick(FILLER)}\n`,
  });
}
for (const m of meetings) {
  const lines = [pick(FILLER), pick(FILLER)];
  if (m.decs.length) lines.push(`The team agreed: ${m.decs[0].title.replace(/ on the .*$/, "")}.`);
  if (m.budget) lines.push(`${m.attendees[0].title} confirmed the money for the rest of the year: €${m.p.budget}k, signed off by the client.`);
  lines.push(pick(FILLER));
  add({
    dir: "knowledge/meetings", file: `${m.date}-${slug(m.title)}-${m.id.slice(4)}.md`,
    fm: { id: m.id, type: "meeting", title: m.title, summary: `${m.title} on the ${m.p.kind}.`, lifecycle: "reviewed", date: m.date, attendees: m.attendees.map((a) => a.id), decisions: m.decs.map((d) => d.id), area: area.id, projects: [m.p.id], created: m.date, updated: m.date },
    body: `## Summary\n${lines.join(" ")}\n`,
  });
}
for (const c of concepts) {
  add({
    dir: "knowledge/concepts", file: `${slug(c.title)}.md`,
    fm: { id: c.id, type: "concept", title: c.title, summary: `Notes on ${c.tech} for ${c.t.key}.`, lifecycle: "reviewed", created: day(5), updated: day(5) },
    body: `${c.tech} is one option for ${c.t.key}. ${pick(FILLER)}\n`,
  });
}
for (const r of references) {
  add({
    dir: "knowledge/references", file: `${slug(r.title)}.md`,
    fm: { id: r.id, type: "reference", title: r.title, summary: `Reference document for the ${r.p.title}.`, lifecycle: "reviewed", projects: [r.p.id], created: day(6), updated: day(6) },
    body: `${pick(FILLER)} ${pick(FILLER)}\n`,
  });
}
for (const q of questionsN) {
  add({
    dir: "knowledge/questions", file: `${slug(q.title)}.md`,
    fm: { id: q.id, type: "question", title: q.title, summary: `Open question on ${q.t.key} for ${q.p.org.title}.`, lifecycle: "draft", projects: [q.p.id], created: day(7), updated: day(7) },
    body: `Raised when ${q.p.org.title} asked about ${q.t.alt[0]}.\n`,
  });
}

for (const n of notes) {
  mkdirSync(join(out, n.dir), { recursive: true });
  writeFileSync(join(out, n.dir, n.file), fmText(n.fm) + n.body);
}

// ---- known questions, written before any retriever ran ----
// Five kinds, 10 each. `answer` is the note that holds the answer.
const qs = [];
const ds = shuffle(decisions);
for (const d of ds.slice(0, 10)) qs.push({ kind: "decision-by-topic", q: `What did we decide about ${d.t.key} for ${d.p.title}?`, answer: d.id });
for (const d of ds.slice(10, 20)) qs.push({ kind: "paraphrase", q: `How do we handle ${pick(d.t.alt)} on the ${d.p.title}?`, answer: d.id });
for (const d of ds.slice(20, 30)) qs.push({ kind: "why", q: `Why did ${d.p.org.title} pick ${d.tech} for the ${d.p.kind}?`, answer: d.id });
for (const p of shuffle(projects).slice(0, 10)) {
  const m = meetings.find((x) => x.p === p && x.budget);
  qs.push({ kind: "fact-in-body", q: `What is the budget for the ${p.title}?`, answer: m.id });
}
const ps = shuffle(projects);
for (let i = 0, k = 0; k < 10 && i < ps.length; i++) {
  const p = ps[i];
  const m = p.team.find((x) => p.team.filter((y) => y.role === x.role).length === 1);
  if (!m) continue;
  qs.push({ kind: "person-role", q: `Who is the ${m.role} on the ${p.title}?`, answer: m.id });
  k++;
}
mkdirSync(out, { recursive: true });
writeFileSync(qfile, JSON.stringify(qs, null, 2) + "\n");
console.log(JSON.stringify({ notes: notes.length, questions: qs.length }));
