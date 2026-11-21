import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";

import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { checkMinutes, minutesCheckText, samePage } from "../lib/minutes-check.ts";
import { extensionOf, fileHash, meetingRow, nameAndDate, TEXT_EXTENSIONS, transcriptText } from "../lib/minutes-row.ts";
import { logLinesOf } from "../lib/runs.ts";

const invalid = (message: string): never => { throw new BrainError("INPUT_INVALID", message, [{ pointer: "", message }]); };

/** A text file read as `extract-plan` reads its files: `\r\n` as `\n`; unreadable or empty is INPUT_INVALID (cli §5.36). */
async function readText(path: string, what: string): Promise<string> {
  let text: string;
  try { text = (await readFile(path, "utf8")).replace(/\r\n/g, "\n"); } catch { return invalid(`Cannot read the ${what} file ${path}`); }
  if (text.trim() === "") invalid(`The ${what} file ${path} is empty`);
  return text;
}

/** `brain minutes check` (spec/cli.md §5.36, capture-and-review §3.4.2): proposed minutes checked against the transcript. Read-only. */
export const minutesCheckCommand: Command = {
  name: "minutes check",
  usage: "brain minutes check --page <notion-page-id> --minutes <file> --transcript <file> [--again] [--json]",
  summary: "Check minutes the agent proposes against the meeting's transcript before they are written. Read-only.",
  options: { page: "string", minutes: "string", transcript: "string", again: "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain }) {
    const opt = (name: string) => args.options[name] as string | undefined;
    const [page, minutesPath, transcriptPath] = [opt("page"), opt("minutes"), opt("transcript")];
    if (page === undefined || page.trim() === "" || minutesPath === undefined || transcriptPath === undefined) throw new BrainError("USAGE", "Give --page <id>, --minutes <file> and --transcript <file>");
    const minutes = await readText(minutesPath, "minutes");
    const transcript = await readText(transcriptPath, "transcript");
    const written = args.options.again !== true && (await logLinesOf(brain!.root, "minutes-written")).some((line) => line.pairs.page !== undefined && samePage(line.pairs.page, page));
    const data = checkMinutes(minutes, transcript, written);
    return { data, human: minutesCheckText(data), exitCode: data.ok ? 0 : 1 };
  },
};

/** `brain minutes row` (spec/cli.md §5.37, capture-and-review §3.4.3): the Meetings row of a transcript file in the drop folder. Writes nothing. */
export const minutesRowCommand: Command = {
  name: "minutes row",
  usage: "brain minutes row --file <path> [--text <file>] [--json]",
  summary: "Render the Meetings row of a transcript file in the drop folder, for the skill to create. Writes nothing.",
  options: { file: "string", text: "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain }) {
    const file = args.options.file as string | undefined;
    const textPath = args.options.text as string | undefined;
    if (file === undefined || file.trim() === "") throw new BrainError("USAGE", "Give --file <path>");
    let bytes: Buffer;
    let modified: Date;
    try {
      bytes = await readFile(file);
      modified = (await stat(file)).mtime;
    } catch {
      return invalid(`Cannot read the file ${file}`);
    }
    const name = basename(file);
    if (textPath === undefined && !TEXT_EXTENSIONS.has(extensionOf(name))) invalid(`${name} is not a .txt, .md, .vtt or .srt file: give its text with --text`);
    let text: string;
    if (textPath !== undefined) text = await readText(textPath, "text");
    else {
      const decoded = new TextDecoder("utf-8", { fatal: true });
      try { text = decoded.decode(bytes); } catch { return invalid(`${name} is not UTF-8 text`); }
    }
    const transcript = transcriptText(name, text);
    if (transcript.trim() === "") invalid(`${name} has no text once read`);

    const hash = fileHash(bytes);
    const earlier = (await logLinesOf(brain!.root, "meeting-file")).find((line) => line.pairs.hash === hash);
    if (earlier !== undefined) {
      const page = earlier.pairs.page ?? null;
      throw new BrainError("FILE_ALREADY_A_ROW", `${name} was made a row before${page === null ? "" : ` (${page})`}: move it to processed/ without a second row`, { page });
    }
    const { name: title, date } = nameAndDate(name, modified);
    const data = meetingRow(hash, title, date, transcript);
    return { data, human: `meeting row: ${title} (${date})\n` };
  },
};
