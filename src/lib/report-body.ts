import { posix } from "node:path";

import type { Workspace } from "./workspace.ts";

/** The six sections of a report, in order (spec/schema.md §16.4). */
export const REPORT_SECTIONS = ["Where it stands", "Timeline", "Decisions in force", "Open questions and risks", "People involved", "Gaps"];

/** The `## ` headings of a Markdown body, outside fenced code. */
export function sectionHeadings(body: string): string[] {
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

/** True when the body is exactly the six report sections, in order, with nothing before the first (cli §5.18). */
export function hasReportShape(body: string): boolean {
  const headings = sectionHeadings(body);
  return body.startsWith("## ") && headings.length === REPORT_SECTIONS.length && headings.every((heading, index) => heading === REPORT_SECTIONS[index]);
}

/** The notes a report body links to (relative links from `reports/`), and the targets that name no note. */
export function reportLinks(workspace: Workspace, body: string, resolveMentions = false): { linked: string[]; broken: string[] } {
  const byPage = new Map(workspace.notes.filter((note) => typeof note.attributes.notion === "string").map((note) => [String(note.attributes.notion).replaceAll("-", "").toLowerCase(), note.id]));
  const byPath = new Map(workspace.notes.map((note) => [note.path, note.id]));
  const linked = new Set<string>();
  const broken: string[] = [];
  for (const match of body.matchAll(/\]\(\s*<?([^)\s>]+)>?\s*\)/g)) {
    const target = match[1]!;
    // A Notion mention converted from a block (cli §5.14.7) names the note published as that page.
    if (resolveMentions && /^notion-page:/i.test(target)) { const id = /^notion-page:([0-9a-f-]+)$/i.exec(target) === null ? undefined : byPage.get(target.slice("notion-page:".length).replaceAll("-", "").toLowerCase()); if (id === undefined) broken.push(target); else linked.add(id); continue; }
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue;
    let decoded = target.split(/[?#]/)[0]!;
    try { decoded = decodeURIComponent(decoded); } catch { /* keep as written */ }
    const id = byPath.get(posix.normalize(posix.join("reports", decoded)));
    if (id === undefined) broken.push(target); else linked.add(id);
  }
  return { linked: [...linked], broken };
}
