import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { ROOT, command, fail } from "./common.mjs";

const UUID = /\b(?:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|[0-9a-f]{32})\b/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@([A-Z0-9-]+(?:\.[A-Z0-9-]+)+|example)\b/gi;
const staged = process.argv.slice(2).join(" ") === "--staged";

if (process.argv.length > 3 && !staged) {
  fail("Usage: node scripts/leak-check.mjs [--staged]");
} else {
  const allow = readAllowlist();
  const denied = staged ? readDenylist() : [];
  const findings = [];
  for (const path of filesToScan()) findings.push(...scan(path, allow, denied));
  for (const finding of findings) process.stderr.write(`${finding.path}:${finding.line}: ${finding.rule}\n`);
  if (findings.length > 0) process.exitCode = 1;
}

function filesToScan() {
  const args = staged ? ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"] : ["ls-files", "-z"];
  return command("git", args).split("\0").filter((path) => path !== "" && !excluded(path));
}

function excluded(path) {
  return path.startsWith("tests/") || path === "sources" || path.startsWith("sources/") || path === "node_modules" || path.startsWith("node_modules/");
}

function scan(path, allow, denied) {
  const content = staged ? stagedContent(path) : readFileSync(resolve(ROOT, path), "utf8");
  const lines = content.split(/\r?\n/);
  const findings = [];
  for (const [index, line] of lines.entries()) {
    UUID.lastIndex = 0;
    if (UUID.test(line) && !allowed(path, line, allow)) findings.push({ path, line: index + 1, rule: "UUID" });
    EMAIL.lastIndex = 0;
    const email = EMAIL.exec(line);
    if (email !== null && !email[1].toLowerCase().endsWith(".example") && email[1].toLowerCase() !== "example" && !allowed(path, line, allow)) {
      findings.push({ path, line: index + 1, rule: "EMAIL" });
    }
    if (denied.some((term) => wholeWord(line, term)) && !allowed(path, line, allow)) findings.push({ path, line: index + 1, rule: "DENYLIST" });
  }
  return findings;
}

function stagedContent(path) {
  try {
    return command("git", ["show", `:${path}`]);
  } catch {
    return "";
  }
}

function readAllowlist() {
  const path = resolve(ROOT, "scripts/leak-allow.txt");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split(/\r?\n/).flatMap((line) => {
    if (line === "" || line.startsWith("#")) return [];
    const colon = line.indexOf(":");
    if (colon === -1) throw new Error(`Invalid leak allowlist entry: ${line}`);
    return [{ path: line.slice(0, colon), pattern: new RegExp(line.slice(colon + 1), "i") }];
  });
}

function readDenylist() {
  const path = resolve(process.env.HOME ?? homedir(), ".config/ultimate-brain/denylist");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split(/\r?\n/).filter((line) => line !== "" && !line.startsWith("#"));
}

function allowed(path, line, allow) {
  return allow.some((entry) => entry.path === path && entry.pattern.test(line));
}

function wholeWord(line, term) {
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(term)}($|[^\\p{L}\\p{N}_])`, "iu").test(line);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
