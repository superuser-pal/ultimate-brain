import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseLogLine, type ParsedLogLine } from "./log.ts";

export interface UnattendedCatchUp {
  since: string | null;
  runs: number;
  inputs: number;
  failed: number;
  failures: string[];
  left: number;
  skipped: number;
  waiting: number;
  last: string;
}

/**
 * The unattended catch-up runs since the last attended one, read from the log (spec/cli.md §3.9, §5.2; decision 0051).
 * Counts that repeat from run to run (an input still skipped, a Fix still waiting) come from the latest run only.
 */
export async function unattendedRuns(root: string): Promise<{ catch_up: UnattendedCatchUp | null; backlog: boolean }> {
  const lines = await catchUpLines(root);
  const unattended = (line: ParsedLogLine) => line.pairs.mode === "unattended";
  let lastAttended = -1;
  lines.forEach((line, index) => { if (!unattended(line)) lastAttended = index; });
  const since = lines.slice(lastAttended + 1);
  const recent = lines.filter(unattended).slice(-3);
  const backlog = recent.length === 3 && recent.every((line) => count(line, "left") > 0);
  if (since.length === 0) return { catch_up: null, backlog };
  const latest = since.at(-1)!;
  const failures: string[] = [];
  for (const line of since) {
    for (const reason of (line.pairs.failures ?? "").split(";").map((part) => part.trim()).filter(Boolean)) if (!failures.includes(reason)) failures.push(reason);
  }
  return {
    catch_up: {
      since: lastAttended === -1 ? null : lines[lastAttended]!.timestamp,
      runs: since.length,
      inputs: since.reduce((sum, line) => sum + count(line, "inputs"), 0),
      failed: since.reduce((sum, line) => sum + count(line, "failed"), 0),
      failures,
      left: count(latest, "left"),
      skipped: count(latest, "skipped"),
      waiting: count(latest, "waiting"),
      last: latest.timestamp,
    },
    backlog,
  };
}

function count(line: ParsedLogLine, key: string): number {
  const value = Number(line.pairs[key]);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

/** Every `catch-up` line, oldest first, across the month files. An unreadable file is passed over: status is diagnostic. */
async function catchUpLines(root: string): Promise<ParsedLogLine[]> {
  let files: string[];
  try {
    files = (await readdir(join(root, "log"))).filter((entry) => /^\d{4}-\d{2}\.md$/.test(entry)).sort();
  } catch {
    return [];
  }
  const lines: ParsedLogLine[] = [];
  for (const file of files) {
    let text: string;
    try {
      text = await readFile(join(root, "log", file), "utf8");
    } catch {
      continue;
    }
    for (const raw of text.split("\n")) {
      const line = parseLogLine(raw);
      if (line !== null && line.op === "catch-up") lines.push(line);
    }
  }
  return lines;
}
