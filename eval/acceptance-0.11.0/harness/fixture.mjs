#!/usr/bin/env node
// CC-67: the reflection world for the 0.11.0 acceptance, written into a brain made by `brain init`. Called by make-sandbox.sh.
//   node --experimental-strip-types fixture.mjs write <brain dir> <as_of> [clean]
// Every date is as_of plus a day offset, so a sandbox made at today's date looks the same to an agent at any date. The planted
// problems are listed in ../planted.json. `clean` writes the same areas, orgs and people with no duplicate, no meeting in the
// window and no decision: a brain where `brain reflect --candidates` finds nothing.
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

import { serializeNewFile } from "../../../src/lib/frontmatter.ts";

const [mode, brainDir, asOf, variant] = process.argv.slice(2);
if (mode !== "write" || brainDir === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(asOf ?? "") || (variant !== undefined && variant !== "clean")) {
  console.error("Usage: fixture.mjs write <brain dir> <as_of YYYY-MM-DD> [clean]");
  process.exit(2);
}
const clean = variant === "clean";
const day = (offset) => new Date(Date.parse(`${asOf}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
const slug = (text) => text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const put = (path, attributes, body) => {
  mkdirSync(dirname(join(brainDir, path)), { recursive: true });
  writeFileSync(join(brainDir, path), serializeNewFile(attributes, body));
};
const fact = (field, value, from, source) => ({ field, value, from, learned: from, source, assessment: "accepted" });
const hash = (body) => `sha256:${createHash("sha256").update(body, "utf8").digest("hex")}`;
const pageOf = (n) => `0b110000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;

// A meeting, its Notion minutes source with it. n 90 and up are before the window.
function meeting(n, offset, title, summary, lines, projectId, areaId) {
  const id = `mtg-0b11e0${String(n).padStart(2, "0")}`, src = `src-0b11c0${String(n).padStart(2, "0")}`;
  const file = `${day(offset)}-${slug(title)}`;
  const notes = lines.map((line) => `- ${line}`).join("\n");
  const minutes = `## Notes\n${notes}\n`;
  put(`sources/notion/${file}-notion-minutes.md`, { id: src, type: "source", title: `${title} (Notion minutes)`, source_key: `notion:${pageOf(n)}`, content_hash: hash(minutes), captured: `${day(offset)}T11:00:00Z`, origin_edited: `${day(offset)}T10:30:00Z`, created: day(offset), updated: day(offset) }, minutes);
  put(`knowledge/meetings/${file}.md`, { id, type: "meeting", title, summary, lifecycle: "reviewed", date: day(offset), attendees: [], source: src, area: areaId, ...(projectId ? { projects: [projectId] } : {}), sources: [src], created: day(offset), updated: day(offset) }, `## Summary\n${summary}\n\n## Notes\n${notes}\n`);
  return id;
}

// Before the window: the kickoff every older note comes from, and the two planning meetings the decisions come from.
const KICKOFF = meeting(90, -150, "Studio kickoff", "Setting up the studio's client list.", ["Robin Example set up the client list."], undefined, "area-0b11a002");

// Areas and orgs.
const AREA = { clients: "area-0b11a001", studio: "area-0b11a002" };
put("areas/clients.md", { id: AREA.clients, type: "area", title: "Clients", summary: "Client work of the studio.", lifecycle: "reviewed", sources: [KICKOFF], created: day(-150), updated: day(-150) }, "Client work of the studio.\n");
put("areas/studio.md", { id: AREA.studio, type: "area", title: "Studio", summary: "Running the studio itself.", lifecycle: "reviewed", sources: [KICKOFF], created: day(-150), updated: day(-150) }, "Running the studio itself.\n");

const ORG = { northwind: "org-0b11f001", bluefin: "org-0b11f002", bluefinDup: "org-0b11f003", quarry: "org-0b11f004" };
const org = (id, title, summary, extra = {}) => put(`knowledge/orgs/${slug(title)}${extra.lifecycle === "draft" ? "-2" : ""}.md`, { id, type: "org", title, summary, lifecycle: "reviewed", area: AREA.clients, sources: [KICKOFF], created: day(-120), updated: day(-120), ...extra }, `${summary}\n`);
org(ORG.northwind, "Northwind", "Logistics client; the Harbor app.");
org(ORG.bluefin, "Bluefin Labs", "Biotech client; brand work.");
org(ORG.quarry, "Quarry Co", "Stone supplier; the Quarry website.");
if (!clean) org(ORG.bluefinDup, "BlueFin Labs", "Biotech company, brand refresh.", { lifecycle: "draft", created: day(-15), updated: day(-15) });

// People: [id, title, role, org, extra].
const PER = { priya: "per-0b11e001", omar: "per-0b11e002", lena: "per-0b11e003", ana: "per-0b11e004", tomas: "per-0b11e005", tomasDup: "per-0b11e006", jin: "per-0b11e007", jinDup: "per-0b11e008" };
const person = (id, title, role, orgId, extra = {}) => {
  const created = extra.created ?? day(-90);
  put(`knowledge/people/${slug(title)}.md`, { id, type: "person", title, summary: `${role}.`, lifecycle: "reviewed", ...(orgId ? { org: orgId } : {}), sources: [KICKOFF], facts: { role }, timeline: [fact("role", role, created, KICKOFF)], created, updated: extra.updated ?? day(-60), ...extra }, `${role}.\n`);
};
person(PER.priya, "Priya Shah", "PM at Northwind", ORG.northwind);
person(PER.omar, "Omar Diaz", "Account manager at Northwind", ORG.northwind);
person(PER.lena, "Lena Ortiz", "Designer at Bluefin Labs", ORG.bluefin);
person(PER.ana, "Ana Costa", "Freelance copywriter", undefined);
person(PER.tomas, "Tomás Reyes", "Developer at Northwind", ORG.northwind);
person(PER.jin, "Jin Park", "Photographer for the studio", undefined);
if (!clean) {
  person(PER.tomasDup, "T. Reyes", "Developer at Northwind", ORG.northwind, { lifecycle: "draft", created: day(-12), updated: day(-12) });
  person(PER.jinDup, "J. Park", "Photographer for the studio", undefined, { lifecycle: "draft", created: day(-16), updated: day(-16) });
}

// Projects.
const PRJ = { harbor: "prj-0b11b001", quarry: "prj-0b11b002", newsletter: "prj-0b11b003" };
const project = (id, title, why, extra, facts) => put(`projects/${slug(title)}/project.md`, {
  id, type: "project", title, summary: why, lifecycle: "reviewed", area: AREA.clients, sources: [KICKOFF],
  ...(facts ? { facts, timeline: Object.entries(facts).map(([field, value]) => fact(field, value, day(-80), KICKOFF)) } : {}),
  created: day(-80), updated: day(-50), ...extra }, `## Why\n${why}\n`);
project(PRJ.harbor, "Harbor app", "A delivery tracking app for Northwind's drivers.", { client: ORG.northwind, people: [PER.priya, PER.tomas] }, { launch_date: "2027-01" });
project(PRJ.quarry, "Quarry website", "A new catalogue website for Quarry Co.", { client: ORG.quarry, people: [PER.ana] }, { launch_date: "2027-04", budget: 20000 });
project(PRJ.newsletter, "Studio newsletter", "A monthly newsletter about the studio's work.", { area: AREA.studio });

if (clean) process.exit(0);

// Decisions in the window that disagree with a project's fact (shared_ground), each from a planning meeting before the window.
const harborPlanning = meeting(91, -40, "Harbor planning", "Planning the Harbor app pilot.", ["The driver pilot runs through the winter."], PRJ.harbor, AREA.clients);
const quarryPlanning = meeting(92, -35, "Quarry planning", "Planning the Quarry catalogue.", ["The product photos arrive in April."], PRJ.quarry, AREA.clients);
put(`knowledge/decisions/${day(-5)}-launch-harbor-app-in-march.md`, { id: "dec-0b11dc01", type: "decision", title: "Launch Harbor app in March", summary: "The Harbor app launches in March 2027.", lifecycle: "reviewed", date: day(-5), assessment: "accepted", area: AREA.clients, projects: [PRJ.harbor], deciders: [PER.priya, PER.tomas], sources: [harborPlanning], created: day(-5), updated: day(-5) }, "## Decision\nThe Harbor app launches in March 2027 (2027-03).\n\n## Context\nThe driver pilot needs two more months.\n");
put(`knowledge/decisions/${day(-3)}-quarry-website-goes-live-in-may.md`, { id: "dec-0b11dc02", type: "decision", title: "Quarry website goes live in May", summary: "The Quarry website goes live in May 2027.", lifecycle: "reviewed", date: day(-3), assessment: "accepted", area: AREA.clients, deciders: [PER.ana], sources: [quarryPlanning], created: day(-3), updated: day(-3) }, "## Decision\nThe Quarry website goes live in May 2027 (2027-05).\n\n## Context\nAgreed with [Quarry Co](../orgs/quarry-co.md): the product photos arrive in April.\n");

// Meetings in the window: [n, offset, title, summary, lines, project].
const meetings = [
  [1, -20, "Pricing workshop", "First pass at what the studio charges.", ["We sketched three pricing tiers for retainers.", "Jin Park will shoot the portfolio pieces."], PRJ.newsletter],
  [2, -14, "Studio planning", "Plans for the next quarter.", ["The pricing tiers need a premium option.", "A design system would speed up client handoffs."], PRJ.newsletter],
  [3, -11, "Harbor release review", "Review of the Harbor app's first release.", ["From now on every Harbor app release needs a security review before it ships.", "T. Reyes fixed the map crash."], PRJ.harbor],
  [4, -10, "Northwind sync", "Status call with Northwind.", ["Priya Shah left Northwind in October; Omar Diaz now runs the account.", "A referral programme could bring in two leads a month."], PRJ.harbor],
  [5, -9, "Quarry sync", "Status call with Quarry Co.", ["The Quarry website budget was raised to 28000 EUR.", "Pricing tiers came up when Quarry Co asked about support."], PRJ.quarry],
  [6, -8, "Bluefin moodboard", "Moodboard review with Bluefin Labs.", ["Lena Ortiz, art director at Bluefin Labs, presented the moodboard.", "BlueFin Labs wants the refresh by spring.", "They liked the onboarding survey idea."], PRJ.newsletter],
  [7, -7, "Clients review", "Monthly look at client work.", ["New rule for Clients: every new client gets a kickoff call within a week of signing.", "Our design system should cover the newsletter too.", "The referral programme needs a simple reward."], PRJ.newsletter],
  [8, -6, "Northwind leadership call", "Call with Northwind's new leads.", ["Omar Diaz was promoted to head of sales at Northwind.", "Northwind might join the referral programme as a partner."], PRJ.harbor],
  [9, -4, "Copy kickoff", "Kickoff for the Quarry copy.", ["Ana Costa joined Quarry Co full-time as content lead.", "An onboarding survey goes to each new reader."], PRJ.quarry],
  [10, -2, "Retainer review", "Review of the retainer offer.", ["The pricing tiers go on the website next month.", "J. Park sent the contact sheets."], PRJ.newsletter],
];
for (const [n, offset, title, summary, lines, projectId] of meetings) meeting(n, offset, title, summary, lines, projectId, projectId === PRJ.newsletter ? AREA.studio : AREA.clients);

// One text source in the window: a design system note (the theme's third input).
const noteBody = "Notes on a design system for the studio: shared colours, type and components.\n";
put(`sources/text/${day(-5)}-design-system-notes.md`, { id: "src-0b11c099", type: "source", kind: "note", title: "Design system notes", source_key: "agent:brain-ingest/20261103T150000Z", content_hash: hash(noteBody), captured: `${day(-5)}T15:00:00Z`, created: day(-5), updated: day(-5) }, noteBody);
