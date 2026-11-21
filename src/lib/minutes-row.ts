import { createHash } from "node:crypto";

// `brain minutes row` (spec/cli.md §5.37, capture-and-review §3.4.3, decision 0101 §8.1): the Meetings row of a transcript file in the
// drop folder. Pure: the command reads the file and the log.

/** The extensions read as UTF-8 text without `--text` (cli §5.37). */
export const TEXT_EXTENSIONS = new Set([".txt", ".md", ".vtt", ".srt"]);
const CAPTIONS = new Set([".vtt", ".srt"]);
const NAME_LIMIT = 120;

export interface MeetingRow {
  database: "meetings";
  action: "create";
  hash: string;
  properties: { Name: string; Date: string; "Brain Status": "New" };
  body: string;
}

/** `sha256:<hex>` of the file's bytes: the file's identity in a `meeting-file` log line. */
export function fileHash(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

/** The extension of a file name, lower case, with its dot (`""` when there is none). */
export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot <= 0 ? "" : fileName.slice(dot).toLowerCase();
}

/** A calendar date written `YYYY-MM-DD` that exists (2027-02-30 does not). */
function isDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** A local date `YYYY-MM-DD` of a time (the file's modified time, read in the machine's time zone). */
export function localDate(time: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}`;
}

/**
 * Name and Date from the file name (cli §5.37): a leading existing date gives the Date and is removed with the separators after it; each `_`
 * or `-` between words is a space. Without a leading date, the Date is the modified time's local date. An empty Name is `Meeting <Date>`.
 */
export function nameAndDate(fileName: string, modified: Date): { name: string; date: string } {
  const extension = extensionOf(fileName);
  let stem = extension === "" ? fileName : fileName.slice(0, -extension.length);
  let date = localDate(modified);
  const lead = /^(\d{4}-\d{2}-\d{2})/.exec(stem);
  if (lead !== null && isDate(lead[1]!)) {
    date = lead[1]!;
    stem = stem.slice(lead[0].length).replace(/^[ \-_.]+/, "");
  }
  const name = stem.replace(/(?<=\S)[_-]+(?=\S)/g, " ").replace(/\s+/g, " ").trim();
  const cut = [...(name === "" ? `Meeting ${date}` : name)].slice(0, NAME_LIMIT).join("").trimEnd();
  return { name: cut, date };
}

const TIMING = /-->/;
const VOICE = /<v(?:\.[^\s>]*)?\s+([^>]+)>/i;
const SPEAKER = /^([\p{L}\p{N}][\p{L}\p{N} .'’-]{0,39}):\s+(.*)$/u;

/** A cue's text without its inline tags, with the character references a caption file may hold read as their characters. */
function plainCue(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

/**
 * A caption file's paragraphs (cli §5.37): the header, NOTE, STYLE and REGION blocks, cue identifiers, timing lines and inline tags dropped;
 * a voice tag or a leading `Name:` gives the speaker; consecutive cues of one speaker are one paragraph `Name: text`, and a cue with no
 * speaker continues the paragraph before it.
 */
export function captionParagraphs(text: string): string[] {
  const blocks = text.replace(/^﻿/, "").split(/\n[ \t]*\n/).map((block) => block.split("\n").filter((line) => line.trim() !== "")).filter((block) => block.length > 0);
  const turns: { speaker: string | null; text: string }[] = [];
  blocks.forEach((lines, index) => {
    const first = lines[0]!.trim();
    if ((index === 0 && /^WEBVTT(?:\s|$)/.test(first)) || /^(?:NOTE|STYLE|REGION)(?:\s|$)/.test(first)) return;
    const timing = lines.findIndex((line) => TIMING.test(line));
    const cue = timing === -1 ? lines : lines.slice(timing + 1);
    const raw = cue.join(" ");
    const voice = VOICE.exec(raw);
    let speaker = voice === null ? null : voice[1]!.trim();
    let words = plainCue(raw);
    if (speaker === null) {
      const named = SPEAKER.exec(words);
      if (named !== null) { speaker = named[1]!.trim(); words = named[2]!.trim(); }
    }
    if (words === "") return;
    const last = turns.at(-1);
    if (last !== undefined && (speaker === null || speaker === last.speaker)) last.text = `${last.text} ${words}`;
    else turns.push({ speaker, text: words });
  });
  return turns.map((turn) => (turn.speaker === null ? turn.text : `${turn.speaker}: ${turn.text}`));
}

/** The transcript's paragraphs: a caption file's by its turns, any other text as written (its blank lines kept as paragraph breaks). */
export function transcriptText(fileName: string, text: string): string {
  const plain = text.replace(/\r\n/g, "\n");
  if (CAPTIONS.has(extensionOf(fileName))) return captionParagraphs(plain).join("\n\n");
  return plain.replace(/^(?:[ \t]*\n)+/, "").trimEnd();
}

/** The Meetings row (cli §5.37): Name, Date and Brain Status New; the body one `Transcript` toggle holding the paragraphs. */
export function meetingRow(hash: string, name: string, date: string, transcript: string): MeetingRow {
  return {
    database: "meetings", action: "create", hash,
    properties: { Name: name, Date: date, "Brain Status": "New" },
    body: `<details><summary>Transcript</summary>\n\n${transcript}\n\n</details>`,
  };
}
