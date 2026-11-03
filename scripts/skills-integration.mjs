// The skills-integration check (spec/skills-delivery.md §11, decision 0059, CC-106). It compares the product's tested skill snapshot
// with the fork's releases and main head, keeps the classified changes in one issue labelled `skills-integration`, and reports
// `unknown` whenever it cannot tell. Run with `node --experimental-strip-types`: it reuses the CLI's snapshot validation.
//
//   node --experimental-strip-types scripts/skills-integration.mjs [--dry-run] [--json] [--repo <owner/name>] [--root <dir>] [--release <version>]
//
// --dry-run reads but writes no issue (task.mjs start, release.mjs --dry-run). --release adds the release gate of §11.3. Exit 1 when the
// status is unknown or, with --release, when the gate refuses. Tests point UB_GITHUB_API at a mock server; the token comes from GH_TOKEN,
// GITHUB_TOKEN or `gh auth token`, and is never printed.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Ajv2020 } from "ajv/dist/2020.js";

import { validateSnapshot } from "../src/lib/skills-snapshot.ts";
import { comparePrecedence, satisfies } from "../src/lib/skills-range.ts";

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const LABEL = "skills-integration";
export const FORK_NAME = "ultimate-brain-skills";
const BLOCK = /<!-- skills-integration\n([\s\S]*?)\n-->/g;
const TAG = /^brain-v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$/;
const PRODUCT_LINK = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/([0-9]+)$/;
const COMMIT_LINK = /^https:\/\/github\.com\/[^/]+\/[^/]+\/commit\/[0-9a-f]{40}$/;
const STRENGTH = { none: 0, compatible: 1, coordinated: 2 };

/** A failure that makes the status `unknown` (§11.3); its message is the reported error. */
class Unknown extends Error {}

let validator;
/** The block's schema with the snapshot schema it references. */
function validateBlock(value) {
  if (validator === undefined) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    for (const name of ["skills-snapshot.schema.json", "skills-integration.schema.json"]) ajv.addSchema(JSON.parse(readFileSync(join(SOURCE, "spec", "schemas", name), "utf8")));
    validator = ajv.getSchema("https://ultimate-brain.dev/schemas/v1/skills-integration.schema.json");
  }
  if (validator(value)) return null;
  const error = validator.errors?.find((entry) => !["if", "oneOf", "allOf"].includes(entry.keyword)) ?? validator.errors?.[0];
  return `${error?.instancePath || "/"} ${error?.message ?? "invalid"}`;
}

/** The last block in an issue body: its JSON, or undefined when the body has none. Throws Unknown when it doesn't parse or validate. */
export function parseBlock(body, number) {
  const blocks = [...(body ?? "").replace(/\r\n?/g, "\n").matchAll(BLOCK)];
  if (blocks.length === 0) return undefined;
  let value;
  try { value = JSON.parse(blocks.at(-1)[1]); } catch { throw new Unknown(`integration block in #${number} is not JSON`); }
  const problem = validateBlock(value);
  if (problem !== null) throw new Unknown(`integration block in #${number} is invalid: ${problem}`);
  return value;
}

/** The body with its last block replaced (text above kept), or the text plus a new block. */
export function withBlock(body, block) {
  const text = `<!-- skills-integration\n${JSON.stringify(block, null, 2)}\n-->`;
  const normalised = (body ?? "").replace(/\r\n?/g, "\n");
  const blocks = [...normalised.matchAll(BLOCK)];
  if (blocks.length === 0) return `${normalised.replace(/\n*$/, "")}${normalised.trim() === "" ? "" : "\n\n"}${text}\n`;
  const last = blocks.at(-1);
  return `${normalised.slice(0, last.index)}${text}${normalised.slice(last.index + last[0].length)}`;
}

/** §10.4: the `Brain impact:` value of a PR body, or `undeclared`; and its `Product:` links. */
export function declaration(body) {
  const lines = [];
  let fence = null;
  let comment = false;
  for (const raw of (body ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    let line = raw.replace(/\s+$/, "");
    if (fence !== null) { if (new RegExp(`^ {0,3}${fence[0]}{${fence.length},}$`).test(line)) fence = null; continue; }
    if (!comment) { const open = /^ {0,3}(`{3,}|~{3,})/.exec(line); if (open !== null) { fence = open[1]; continue; } }
    let kept = "";
    while (line !== "") {
      if (comment) { const end = line.indexOf("-->"); if (end === -1) { line = ""; break; } line = line.slice(end + 3); comment = false; }
      else { const start = line.indexOf("<!--"); if (start === -1) { kept += line; line = ""; } else { kept += line.slice(0, start); line = line.slice(start + 4); comment = true; } }
    }
    lines.push(kept.replace(/\s+$/, ""));
  }
  const impacts = lines.filter((line) => /^Brain impact: /.test(line));
  const value = impacts.length === 1 ? /^Brain impact: (none|compatible|coordinated)$/.exec(impacts[0])?.[1] : undefined;
  const links = lines.filter((line) => /^Product: https:\/\/github\.com\/[^/]+\/ultimate-brain\/(issues|pull)\/[0-9]+$/.test(line)).map((line) => line.slice("Product: ".length));
  return { impact: value ?? "undeclared", links };
}

/** The package snapshot as the tested revision (§11.1); throws Unknown when it is not a valid snapshot. */
export function testedRevision(root) {
  const check = validateSnapshot(join(root, ".agents", "skills"));
  if (check.reason !== null) throw new Unknown(`package snapshot invalid (${check.reason})`);
  const { name, version, source, integrity } = check.manifest;
  return { manifest: check.manifest, tested: { name, version, ...(source.commit === undefined ? {} : { commit: source.commit }), integrity } };
}

/** The release gate's snapshot rule (§11.3): null, or why the package snapshot can't ship `version`. */
export function releaseSnapshotProblem(root, version) {
  const check = validateSnapshot(join(root, ".agents", "skills"));
  if (check.reason !== null) return `the package snapshot is invalid (${check.reason})`;
  // Phase A (§9): prepack regenerates the manifest with the released version and the range of that version, which always contains it.
  if (check.manifest.name === "ultimate-brain") return null;
  return satisfies(version, check.manifest.cli) ? null : `the package snapshot ${check.manifest.name} ${check.manifest.version} excludes ${version} (${check.manifest.cli})`;
}

/** A small GitHub REST client over fetch. */
export function github({ api = process.env.UB_GITHUB_API ?? "https://api.github.com", token, timeoutMs = 15000 }) {
  return async function request(path, { method = "GET", body, allow404 = false } = {}) {
    let response;
    try {
      response = await fetch(`${api}${path}`, {
        method,
        headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "x-github-api-version": "2022-11-28", ...(body === undefined ? {} : { "content-type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new Unknown(`GitHub unreachable (${error.cause?.code ?? error.cause?.message ?? error.name})`);
    }
    if (response.status === 404 && allow404) return null;
    if (response.status === 401) throw new Unknown("credential rejected (HTTP 401)");
    if (!response.ok) throw new Unknown(`${method} ${path.split("?")[0]}: HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
}

/** Today's time in the schema's format. */
const stamp = (date) => date.toISOString().replace(/\.\d{3}Z$/, "Z");

/**
 * Runs the check (§11.2, §11.3). Returns `{ status, error?, block, issue, written }`; `block` is null when no issue holds one and the
 * check failed before computing one.
 */
export async function runCheck({ root, repo, request, write = true, now = new Date() }) {
  const at = stamp(now);
  let open = [];
  let prior;
  let block = null;
  try {
    if (!/^[^/\s]+\/[^/\s]+$/.test(repo ?? "")) throw new Unknown("cannot tell the product repository");
    const issues = (await request(`/repos/${repo}/issues?labels=${LABEL}&state=open&per_page=100`)).filter((issue) => issue.pull_request === undefined);
    open = issues;
    if (open.length > 1) throw new Unknown("two integration issues");
    if (open.length === 1) prior = parseBlock(open[0].body, open[0].number);
    else {
      const closed = (await request(`/repos/${repo}/issues?labels=${LABEL}&state=closed&sort=updated&direction=desc&per_page=10`)).filter((issue) => issue.pull_request === undefined);
      prior = closed.length === 0 ? undefined : parseBlock(closed[0].body, closed[0].number);
    }
    const { tested } = testedRevision(root);
    block = await compute({ root, repo, request, tested, prior, at });
  } catch (error) {
    if (!(error instanceof Unknown)) throw error;
    const failed = { at, status: "unknown", error: error.message };
    // Two open issues: change nothing. One: record the failure in it and keep the rest of its block.
    if (open.length === 1 && prior !== undefined && write && error.message !== "two integration issues") {
      const kept = { ...prior, last_check: failed };
      try { await request(`/repos/${repo}/issues/${open[0].number}`, { method: "PATCH", body: { body: withBlock(open[0].body, kept) } }); } catch { /* the failure is already reported */ }
      return { status: "unknown", error: error.message, block: kept, issue: open[0].number, written: true };
    }
    return { status: "unknown", error: error.message, block: prior === undefined ? null : { ...prior, last_check: failed }, issue: open[0]?.number ?? null, written: false };
  }
  if (!write) return { status: "ok", block, issue: open[0]?.number ?? null, written: false };
  try {
    const issue = await save({ repo, request, open: open[0], block });
    return { status: "ok", block, issue, written: true };
  } catch (error) {
    if (!(error instanceof Unknown)) throw error;
    return { status: "unknown", error: `cannot write the integration issue: ${error.message}`, block, issue: open[0]?.number ?? null, written: false };
  }
}

/** Opens, updates or closes the one issue; returns its number, or null when none is needed. */
async function save({ repo, request, open, block }) {
  const title = `Skills integration: ${block.changes.length} open change(s)`;
  if (open !== undefined) {
    await request(`/repos/${repo}/issues/${open.number}`, { method: "PATCH", body: { title, body: withBlock(open.body, block), ...(block.changes.length === 0 ? { state: "closed", state_reason: "completed" } : {}) } });
    return open.number;
  }
  if (block.changes.length === 0) return null;
  const intro = "Opened by the daily skills-integration check (spec/skills-delivery.md §11.2). Classify each change in the block below: "
    + "`ready`, `brain-work` (with links) or `no-action`; move `assessed` forward once every change up to it is classified.";
  const created = await request(`/repos/${repo}/issues`, { method: "POST", body: { title, labels: [LABEL], body: withBlock(intro, block) } });
  return created.number;
}

/** The new block from the prior one and the fork's state (§11.2). */
async function compute({ root, repo, request, tested, prior, at }) {
  const owner = repo.split("/")[0];
  const fork = `/repos/${owner}/${FORK_NAME}`;
  const assessed = prior?.assessed ?? null;
  const head = (await request(`${fork}/commits/main`)).sha;
  const releases = [];
  for (const release of await request(`${fork}/releases?per_page=100`)) {
    const version = TAG.exec(release.tag_name ?? "")?.[1];
    if (release.draft || version === undefined) continue;
    releases.push({ version, commit: (await request(`${fork}/commits/${encodeURIComponent(release.tag_name)}`)).sha });
  }
  releases.sort((a, b) => comparePrecedence(a.version, b.version));

  // `a` at or before `b`: equal, or an ancestor (the compare API says `b` is ahead of `a`).
  const ancestry = new Map();
  const atOrBefore = async (a, b) => {
    if (a === b) return true;
    const key = `${a}...${b}`;
    if (!ancestry.has(key)) ancestry.set(key, ["ahead", "identical"].includes((await request(`${fork}/compare/${a}...${b}`)).status));
    return ancestry.get(key);
  };

  // Segments after `assessed`: one per release, then the commits after the latest release.
  const segments = [];
  let previous = assessed?.commit;
  for (const release of releases) {
    if (previous !== undefined && await atOrBefore(release.commit, previous)) continue;
    segments.push({ kind: "release", release: release.version, ...(previous === undefined ? {} : { from: previous }), to: release.commit });
    previous = release.commit;
  }
  if (previous === undefined || !(await atOrBefore(head, previous))) segments.push({ kind: "unreleased", ...(previous === undefined ? {} : { from: previous }), to: head });

  const priorChanges = prior?.changes ?? [];
  const after = [];
  const before = [];
  for (const change of priorChanges) (assessed !== null && await atOrBefore(change.to, assessed.commit) ? before : after).push(change);
  const used = new Set();
  const changes = [...before];
  for (const segment of segments) {
    const exact = after.find((change) => change.from === segment.from && change.to === segment.to);
    const extended = exact ?? after.find((change) => change.from === segment.from && !used.has(change));
    const entry = { ...segment, productLinks: [] };
    if (segment.from !== undefined) Object.assign(entry, await impactOf(request, fork, segment));
    if (extended !== undefined) {
      used.add(extended);
      if (extended.links !== undefined) entry.links = [...extended.links];
      if (extended.note !== undefined) entry.note = extended.note;
    }
    // Same commits keep their classification; any new commit needs a new one (§11.2: seeing a change never dismisses it).
    entry.classification = exact?.classification ?? "unclassified";
    if (entry.productLinks.length > 0) entry.links = [...new Set([...(entry.links ?? []), ...entry.productLinks])];
    delete entry.productLinks;
    changes.push(entry);
  }
  // A classified change these segments no longer cover stays visible as it was.
  for (const change of after) if (!used.has(change) && ["ready", "brain-work"].includes(change.classification)) changes.push(change);

  // Errors are recomputed on every run: a dead link, and the vendored schema.
  const resolved = new Map();
  const resolve = async (link) => {
    if (COMMIT_LINK.test(link)) return { exists: true, done: true };
    const match = PRODUCT_LINK.exec(link);
    if (match === null) return { exists: true, done: false };
    if (`${match[1]}/${match[2]}`.toLowerCase() !== repo.toLowerCase()) return { exists: false, done: false };
    if (!resolved.has(link)) {
      const issue = await request(`/repos/${repo}/issues/${match[4]}`, { allow404: true });
      const done = issue === null ? false : issue.pull_request !== undefined ? issue.pull_request.merged_at != null : issue.state === "closed";
      resolved.set(link, { exists: issue !== null, done });
    }
    return resolved.get(link);
  };
  for (const change of changes) {
    delete change.error;
    const dead = [];
    for (const link of change.links ?? []) if (!(await resolve(link)).exists) dead.push(link);
    if (dead.length > 0) {
      change.error = `dead link ${dead.join(", ")}`;
      if (change.classification === "unclassified") change.classification = "brain-work";
    }
  }
  const theirs = await request(`${fork}/contents/schemas/skills-snapshot.schema.json?ref=${head}`, { allow404: true });
  const ours = readFileSync(join(root, "spec", "schemas", "skills-snapshot.schema.json"), "utf8");
  if (theirs === null || !sameJson(Buffer.from(theirs.content ?? "", "base64").toString("utf8"), ours)) {
    let target = changes.find((change) => change.to === head && !before.includes(change));
    if (target === undefined) { target = { kind: "unreleased", from: head, to: head, classification: "unclassified" }; changes.push(target); }
    const commits = await request(`/repos/${repo}/commits?path=spec/schemas/skills-snapshot.schema.json&per_page=1`);
    const link = commits[0]?.html_url;
    if (link !== undefined) target.links = [...new Set([...(target.links ?? []), link])];
    target.error = target.error === undefined ? "vendored schema differs" : `${target.error}; vendored schema differs`;
    if (target.classification === "unclassified" && target.links !== undefined) target.classification = "brain-work";
  }

  // Pruning (§11.2): no-action once assessed passes it; ready once tested includes it; brain-work also needs its linked work done.
  const kept = [];
  for (const change of changes) {
    const included = tested.commit !== undefined && await atOrBefore(change.to, tested.commit);
    if (change.classification === "no-action" && assessed !== null && await atOrBefore(change.to, assessed.commit)) continue;
    if (change.classification === "ready" && included) continue;
    if (change.classification === "brain-work" && included && change.error === undefined && (await Promise.all(change.links.map(resolve))).every((link) => link.done)) continue;
    kept.push(order(change));
  }
  const latest = releases.at(-1);
  const block = { format: 1, tested, seen: { head, release: latest?.version ?? null }, assessed, changes: kept, last_check: { at, status: "ok" } };
  const problem = validateBlock(block);
  if (problem !== null) throw new Unknown(`computed block is invalid: ${problem}`);
  return block;
}

/** The impact of a segment's merged PRs and the `Product:` links of its coordinated ones. */
async function impactOf(request, fork, segment) {
  // The compare API pages its commits; a segment read only in part would miss PRs, so it is unknown instead.
  const commits = [];
  for (let page = 1; ; page += 1) {
    const compared = await request(`${fork}/compare/${segment.from}...${segment.to}?per_page=100&page=${page}`);
    const listed = compared.commits ?? [];
    commits.push(...listed);
    if (commits.length >= (compared.total_commits ?? 0)) break;
    if (listed.length === 0 || page === 50) throw new Unknown(`compare ${segment.from.slice(0, 7)}...${segment.to.slice(0, 7)} listed ${commits.length} of ${compared.total_commits} commits`);
  }
  const pulls = new Map();
  for (const commit of commits) {
    if ((commit.parents ?? []).length < 2) continue; // the fork merges PRs with merge commits only (§10.3)
    for (const pull of await request(`${fork}/commits/${commit.sha}/pulls`)) if (pull.merged_at != null) pulls.set(pull.number, pull);
  }
  if (pulls.size === 0) return { impact: "undeclared", productLinks: [] };
  let impact = "none";
  const productLinks = [];
  for (const pull of pulls.values()) {
    const declared = declaration(pull.body);
    if (declared.impact === "undeclared") impact = "undeclared";
    else if (impact !== "undeclared" && STRENGTH[declared.impact] > STRENGTH[impact]) impact = declared.impact;
    if (declared.impact === "coordinated") productLinks.push(...declared.links);
  }
  return { impact, productLinks };
}

function sameJson(a, b) {
  try { return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b)); } catch { return false; }
}

/** A change's keys in the schema's order. */
function order(change) {
  const keys = ["kind", "release", "from", "to", "impact", "classification", "links", "note", "error"];
  return Object.fromEntries(keys.filter((key) => change[key] !== undefined).map((key) => [key, change[key]]));
}

/** The counts the start-of-work line and the release gate use. */
export function summary(result) {
  if (result.status !== "ok") return `skills integration: status unknown (${result.error})`;
  const changes = result.block.changes;
  return `skills integration: ${changes.length} open, ${changes.filter((change) => change.classification === "unclassified").length} unclassified`;
}

/**
 * §11.3's release rules, from a check result and the package snapshot: `{ problems, warnings }`. Only a change that may be incompatible blocks
 * while unclassified (0059); an unclassified `compatible` or `none` change is a warning.
 */
export function releaseRules(result, snapshotProblem) {
  const problems = [];
  const warnings = [];
  if (snapshotProblem !== null) problems.push(snapshotProblem);
  if (result.status !== "ok") return { problems: [...problems, `skills integration status unknown (${result.error})`], warnings };
  const where = result.issue === null ? "" : ` in issue #${result.issue}`;
  const unclassified = result.block.changes.filter((change) => change.classification === "unclassified");
  const harmless = unclassified.filter((change) => change.impact === "compatible" || change.impact === "none");
  const blocking = unclassified.length - harmless.length;
  const errors = result.block.changes.filter((change) => change.error !== undefined);
  if (blocking > 0) problems.push(`${blocking} skills change(s) that may be incompatible are unclassified${where}`);
  if (errors.length > 0) problems.push(`skills change(s) with an error${where}: ${errors.map((change) => change.error).join("; ")}`);
  if (harmless.length > 0) warnings.push(`${harmless.length} compatible skills change(s) unclassified${where}; classify them in a planning session`);
  return { problems, warnings };
}

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

/** `owner/name` from GITHUB_REPOSITORY or the origin remote. */
function productRepo(root) {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(url)?.[1];
  } catch { return undefined; }
}

function credential() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try { return execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined; } catch { return undefined; }
}

async function main(args) {
  const root = resolve(option(args, "--root") ?? process.env.UB_ROOT ?? SOURCE);
  const repo = option(args, "--repo") ?? productRepo(root);
  const release = option(args, "--release");
  const token = credential();
  const result = token === undefined
    ? { status: "unknown", error: "no credential (set GH_TOKEN or run gh auth login)", block: null, issue: null, written: false }
    : await runCheck({ root, repo, request: github({ token }), write: !args.includes("--dry-run") });
  const { problems, warnings } = release === undefined ? { problems: [], warnings: [] } : releaseRules(result, releaseSnapshotProblem(root, release));
  if (args.includes("--json")) process.stdout.write(`${JSON.stringify({ ...result, summary: summary(result), problems, warnings })}\n`);
  else process.stdout.write(`${summary(result)}\n${problems.map((problem) => `refused: ${problem}\n`).join("")}${warnings.map((warning) => `warning: ${warning}\n`).join("")}`);
  if (result.status !== "ok" || problems.length > 0) process.exitCode = 1;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
