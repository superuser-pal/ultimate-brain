import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Tests provide UB_ROOT to exercise the scripts against an isolated repository.
export const ROOT = process.env.UB_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function command(command, args, options = {}) {
  return String(execFileSync(command, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }) ?? "").trim();
}

export function tryCommand(commandName, args, options = {}) {
  try { return { ok: true, stdout: command(commandName, args, options) }; }
  catch (error) { return { ok: false, message: String(error.stderr ?? error.message).trim() }; }
}

export function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

export function taskEntries(tasks = readFileSync(resolve(ROOT, "build/TASKS.md"), "utf8")) {
  const entries = [];
  const pattern = /^### ((?:CC|CX)-\d+) · (.+?) · `([^`]+)`(?: \([^\n]*\))?\n\*\*Release:\*\* ([^\n]+)$/gm;
  for (const match of tasks.matchAll(pattern)) entries.push({ id: match[1], title: match[2], status: match[3], release: match[4], offset: match.index });
  return entries;
}

export function slug(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function isPrerelease(version) { return version.includes("-"); }

/** CI passed when every check run completed as success, skipped or neutral, and at least one succeeded (a job that doesn't apply to the event is skipped). */
export function checksPassed(tsv) {
  const runs = tsv.split("\n").filter(Boolean).map((line) => line.split("\t"));
  return runs.some(([, conclusion]) => conclusion === "success")
    && runs.every(([status, conclusion]) => status === "completed" && ["success", "skipped", "neutral"].includes(conclusion));
}

export function packageVersion() {
  const file = resolve(ROOT, "package.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).version : undefined;
}
