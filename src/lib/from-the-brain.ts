/**
 * The From the brain section of a Document kept from a task (0.16.0, decision 0100 §3; spec/schema.md §4 reference, capture-and-review §13.6):
 * after the task page's text, word for word, one blank line, the marker line, the heading, a blank line, then one line per item, each citing
 * one knowledge note. Only an applied `add_to_note` with `section: from_the_brain` writes it, and the text above it never changes.
 */
import { posix } from "node:path";

export const FROM_THE_BRAIN_MARKER = "<!-- from-the-brain -->";
const HEADING = "## From the brain";
/** One line of the section: `- <text> ([<title>](<relative link>))`. */
const LINE = /^- (\S.*?) \(\[([^\]\n]+)\]\(([^)\s]+)\)\)$/;

/** A line of the section's form, with the relative link it cites; null when the line isn't of that form. */
export function sectionLine(line: string): { text: string; title: string; link: string } | null {
  const match = LINE.exec(line);
  if (match === null || /^[a-z][a-z0-9+.-]*:/i.test(match[3]!)) return null;
  return { text: match[1]!, title: match[2]!, link: match[3]! };
}

/** The lines of a `content` value: non-empty lines, trailing newlines ignored. */
export function contentLines(content: string): string[] {
  return content.replace(/\n+$/, "").split("\n");
}

/** The body split at the marker line: the text above it (unchanged) and the section's item lines, empty when there is no section. */
export function splitSection(body: string): { above: string; lines: string[]; section: string | null } {
  const at = body.split("\n").indexOf(FROM_THE_BRAIN_MARKER);
  if (at < 0) return { above: body, lines: [], section: null };
  const rows = body.split("\n");
  const above = rows.slice(0, at).join("\n");
  const section = rows.slice(at).join("\n");
  return { above: above === "" ? "" : `${above}\n`, lines: rows.slice(at + 1).filter((row) => row.startsWith("- ")), section };
}

/** The note path a section line's relative link names, from the Document's own path. */
export function linkedPath(documentPath: string, link: string): string {
  const folder = documentPath.includes("/") ? documentPath.slice(0, documentPath.lastIndexOf("/")) : "";
  return posix.normalize(posix.join(folder, decodeURI(link.split("#")[0]!)));
}

/** The body with `lines` added at the end of its section, which is created after the body when it has none; a line already there is skipped. */
export function withSectionLines(body: string, lines: readonly string[]): string {
  const { lines: present, section } = splitSection(body);
  const fresh = lines.filter((line, index) => !present.includes(line) && lines.indexOf(line) === index);
  if (fresh.length === 0) return body;
  if (section === null) {
    const base = body === "" || body.endsWith("\n") ? body : `${body}\n`;
    return `${base}\n${FROM_THE_BRAIN_MARKER}\n${HEADING}\n\n${fresh.join("\n")}\n`;
  }
  return `${body.replace(/\n+$/, "")}\n${fresh.join("\n")}\n`;
}
