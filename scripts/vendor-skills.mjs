// Vendoring the fork's released brain skills (spec/skills-delivery.md §9.2, §9.3, decisions 0059 and 0069, CC-105). The skills are written
// in the ultimate-brain-skills fork; this repo's `.agents/skills/` holds one released snapshot of them, written only by this script and
// never edited. Run with `node --experimental-strip-types`: it reuses the CLI's snapshot validator and range functions.
//
//   node --experimental-strip-types scripts/vendor-skills.mjs <version> [--repo <owner/name>]
//   node --experimental-strip-types scripts/vendor-skills.mjs --local <fork checkout> [--commit <ref>]
//   node --experimental-strip-types scripts/vendor-skills.mjs --check [--online] [--repo <owner/name>]
//
// Exit 0 on success, 1 on a refusal or a failed check (the reason on stderr), 2 on a usage error. Tests point UB_ROOT at a temporary
// product checkout and UB_GITHUB_API at a mock server; the token comes from GH_TOKEN, GITHUB_TOKEN or `gh auth token`, else none (the
// fork is public), and is never printed.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { byteOrder, validateSnapshot } from "../src/lib/skills-snapshot.ts";
import { parseRange, parseVersion, satisfies } from "../src/lib/skills-range.ts";
import { credential, FORK_NAME, github, productRepo } from "./skills-integration.mjs";

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_VERSION = "0.0.0-local";
const NOTES = { Integrity: /^Integrity: (sha256-[0-9a-f]{64})$/, "Tarball-SHA256": /^Tarball-SHA256: ([0-9a-f]{64})$/, CLI: /^CLI: (.+)$/ };
const USAGE = "Usage: node --experimental-strip-types scripts/vendor-skills.mjs <version> [--repo <owner/name>] | --local <fork checkout> [--commit <ref>] | --check [--online] [--repo <owner/name>]";

/** A refusal: its message is the reason printed on stderr. */
class Refusal extends Error {}

const isFile = (path) => { try { return lstatSync(path).isFile(); } catch { return false; } };
const isFolder = (path) => { try { return lstatSync(path).isDirectory(); } catch { return false; } };
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function packageVersion(root) {
  try { return JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version; } catch { return undefined; }
}

/** `<owner>/ultimate-brain-skills`, from the product repo `--repo`, else GITHUB_REPOSITORY, else the origin remote (§9.2, §11.3). */
export function forkOf(root, repo) {
  const product = repo || productRepo(root);
  return /^[^/\s]+\/[^/\s]+$/.test(product ?? "") ? `${product.split("/")[0]}/${FORK_NAME}` : undefined;
}

/** The commit a tag names: its ref, then the tag object when the tag is annotated (§9.2 step 2). */
async function tagCommit(request, fork, tag) {
  const ref = await request(`/repos/${fork}/git/ref/tags/${tag}`);
  if (ref?.object?.type !== "tag") return ref?.object?.sha;
  return (await request(`/repos/${fork}/git/tags/${ref.object.sha}`))?.object?.sha;
}

/** The values of the notes lines of §10.2; a key whose line is missing or appears twice maps to undefined. */
function notesLines(body) {
  const lines = (body ?? "").replace(/\r\n?/g, "\n").split("\n");
  const values = {};
  for (const [key, pattern] of Object.entries(NOTES)) {
    const found = lines.map((line) => pattern.exec(line)?.[1]).filter((value) => value !== undefined);
    values[key] = found.length === 1 ? found[0] : undefined;
  }
  return values;
}

/**
 * §9.3's check of `<root>/.agents/skills`: `null` when it passes, else the reason. Offline it reads only the repo; `online` also compares it
 * with its fork release through `request` (a client of the shape skills-integration.mjs's `github()` returns). Never throws for a failed check.
 */
export async function checkVendored({ root, fork, online = false, request }) {
  const folder = join(root, ".agents", "skills");
  const check = validateSnapshot(folder);
  if (check.reason !== null) return check.reason;
  const manifest = check.manifest;
  if (manifest.name !== FORK_NAME) return `name ${manifest.name}`;
  if (manifest.source.commit === undefined) return "no source commit";
  if (!isFile(join(folder, "LICENSE"))) return "no LICENSE";
  if (!isFile(join(folder, "NOTICE.md"))) return "no NOTICE.md";
  const version = packageVersion(root);
  if (parseVersion(version ?? "") === undefined || !satisfies(version, manifest.cli)) return `not compatible with ${version ?? "an unreadable package.json"} (${manifest.cli})`;
  if (!online) return null;
  try {
    if (fork === undefined) throw new Error("cannot tell the product repository");
    const tag = `brain-v${manifest.version}`;
    const release = await request(`/repos/${fork}/releases/tags/${tag}`, { allow404: true });
    if (release === null || release.draft) return `no release ${tag}`;
    const lines = notesLines(release.body);
    const commit = await tagCommit(request, fork, tag);
    if (lines.Integrity !== manifest.integrity) return `differs from ${tag}: integrity`;
    if (lines.CLI !== manifest.cli) return `differs from ${tag}: cli`;
    if (commit !== manifest.source.commit) return `differs from ${tag}: commit`;
    return null;
  } catch (error) {
    return `status unknown (${error.message})`;
  }
}

/** §9.3's message for a failed check. */
export const checkMessage = (reason) => `.agents/skills is not a released ultimate-brain-skills snapshot (${reason}). Skills are written in the fork; restore with git checkout -- .agents/skills and git clean -fdx .agents/skills, or vendor a release: node scripts/vendor-skills.mjs <version>`;

/** A JSON request that turns a network or API failure into the refusal `status unknown (<error>)`. */
function guarded(request) {
  return async (path, options) => {
    try { return await request(path, options); } catch (error) { throw new Refusal(`status unknown (${error.message})`); }
  };
}

async function fetchOrUnknown(url, options) {
  try { return await fetch(url, { ...options, signal: AbortSignal.timeout(60000) }); } catch (error) {
    throw new Refusal(`status unknown (GitHub unreachable (${error.cause?.code ?? error.cause?.message ?? error.name}))`);
  }
}

/** §9.2 step 3: the asset's bytes. A 200 answer is the tarball; a redirect's Location is a signed URL, fetched without the token. */
async function download({ api, token, fork, id }) {
  const headers = { accept: "application/octet-stream", "x-github-api-version": "2022-11-28", ...(token === undefined ? {} : { authorization: `Bearer ${token}` }) };
  let response = await fetchOrUnknown(`${api}/repos/${fork}/releases/assets/${id}`, { headers, redirect: "manual" });
  if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.get("location")) {
    response = await fetchOrUnknown(response.headers.get("location"), { headers: { accept: "application/octet-stream" }, redirect: "follow" });
  }
  if (response.status !== 200) throw new Refusal(`status unknown (release asset ${id}: HTTP ${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

function tar(args) {
  try { return execFileSync("tar", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }); } catch (error) {
    throw new Refusal(`tarball: unreadable (${String(error.stderr ?? error.message).trim().split("\n")[0]})`);
  }
}

/** §9.2 step 4: lists, checks and unpacks the tarball into a new temporary folder; nothing outside it is written. */
function unpack(bytes, work) {
  const file = join(work, "release.tar.gz");
  writeFileSync(file, bytes);
  const lines = (text) => { const list = text.split("\n"); if (list.at(-1) === "") list.pop(); return list; };
  const names = lines(tar(["-tzf", file]));
  const verbose = lines(tar(["-tvzf", file]));
  if (names.length !== verbose.length) throw new Refusal("member path: unreadable listing");
  for (let index = 0; index < names.length; index += 1) {
    const listed = names[index].startsWith("./") ? names[index].slice(2) : names[index];
    // A folder member ends with `/`; that marks its type and is not an empty segment.
    const path = listed.endsWith("/") ? listed.slice(0, -1) : listed;
    if (path === "" || path === ".") continue;
    if (path.startsWith("/") || path.split("/").some((part) => part === "" || part === "..")) throw new Refusal(`member path: ${listed}`);
    if (!["-", "d"].includes(verbose[index][0])) throw new Refusal(`member type: ${path}`);
  }
  const out = join(work, "snapshot");
  mkdirSync(out);
  tar(["-xzf", file, "-C", out]);
  const visit = (relative) => {
    for (const name of readdirSync(join(out, relative)).sort(byteOrder)) {
      const path = relative === "" ? name : `${relative}/${name}`;
      const metadata = lstatSync(join(out, path));
      if (metadata.isDirectory()) visit(path);
      else if (!metadata.isFile() || metadata.nlink !== 1) throw new Refusal(`member type: ${path}`);
    }
  };
  visit("");
  return out;
}

/** §9.2 step 5 on the unpacked folder; `expected` holds what a release adds to the local checks (validity, name, version). */
function checkSnapshot(folder, expected) {
  const check = validateSnapshot(folder);
  if (check.reason !== null) throw new Refusal(`snapshot: ${check.reason}`);
  const manifest = check.manifest;
  if (manifest.name !== FORK_NAME) throw new Refusal(`snapshot name is ${manifest.name}, not ${FORK_NAME}`);
  if (manifest.version !== expected.version) throw new Refusal(`snapshot version is ${manifest.version}, not ${expected.version}`);
  if (expected.release) {
    if (manifest.integrity !== expected.integrity) throw new Refusal("snapshot integrity differs from the Integrity: line");
    if (manifest.cli !== expected.cli) throw new Refusal("snapshot cli differs from the CLI: line");
    if (manifest.source.repository !== expected.repository) throw new Refusal(`snapshot source.repository is ${manifest.source.repository}, not ${expected.repository}`);
    if (manifest.source.commit !== expected.commit) throw new Refusal(`snapshot source.commit is ${manifest.source.commit ?? "none"}, not the tag's commit ${expected.commit}`);
    for (const name of ["LICENSE", "NOTICE.md"]) if (!isFile(join(folder, name))) throw new Refusal(`snapshot has no ${name}`);
  }
  return manifest;
}

/** §9.2 step 6, with §9.4's advice: the release the snapshot lands in is its range's lower bound without its prerelease part. */
function checkProductVersion(root, manifest, label) {
  const version = packageVersion(root);
  if (parseVersion(version ?? "") !== undefined && satisfies(version, manifest.cli)) return;
  const lower = parseRange(manifest.cli)?.find((comparator) => comparator.operator === ">=" || comparator.operator === ">");
  const landing = lower === undefined ? "<x.y.z>" : lower.version.replace(/-.*$/, "");
  throw new Refusal(`${label} needs ultimate-brain ${manifest.cli}; package.json is ${version ?? "unreadable"}. Set package.json to the release this lands in (npm version ${landing} --no-git-tag-version), then run again`);
}

/** §9.2 steps 7 and 8: clears an interrupted run's leftovers, swaps the folder in, and returns the report line. */
function write(root, folder, manifest) {
  const agents = join(root, ".agents");
  const target = join(agents, "skills");
  const next = join(agents, "skills.new");
  const old = join(agents, "skills.old");
  let swapped = false;
  try {
    if (!existsSync(target) && isFolder(old)) renameSync(old, target);
    rmSync(next, { recursive: true, force: true });
    rmSync(old, { recursive: true, force: true });
    const previous = existsSync(target) ? validateSnapshot(target).manifest : null;
    try {
      mkdirSync(agents, { recursive: true });
      cpSync(folder, next, { recursive: true });
      if (existsSync(target)) renameSync(target, old);
    } catch (error) {
      rmSync(next, { recursive: true, force: true });
      throw error;
    }
    swapped = true;
    renameSync(next, target);
    rmSync(old, { recursive: true, force: true });
    return report(manifest, previous);
  } catch (error) {
    if (error instanceof Refusal) throw error;
    const where = swapped ? "; run the same command again to recover" : "; .agents/skills is unchanged";
    throw new Refusal(`writing .agents/skills failed (${error.code ?? error.message})${where}`);
  }
}

function report(manifest, previous) {
  const before = new Map((previous?.skills ?? []).map((skill) => [skill.name, skill]));
  const after = new Map(manifest.skills.map((skill) => [skill.name, skill]));
  const shape = (skill) => JSON.stringify({ targets: skill.targets, files: skill.files.map((file) => [file.path, file.sha256, file.bytes]) });
  const list = (names) => (names.length === 0 ? "none" : names.sort(byteOrder).join(", "));
  const added = [...after.keys()].filter((name) => !before.has(name));
  const retired = [...before.keys()].filter((name) => !after.has(name));
  const changed = [...after.keys()].filter((name) => before.has(name) && shape(before.get(name)) !== shape(after.get(name)));
  const was = previous === null ? "none" : `${previous.name} ${previous.version}`;
  return `vendored ${manifest.name} ${manifest.version} (${manifest.integrity}), was ${was}; added: ${list(added)}; changed: ${list(changed)}; retired: ${list(retired)}`;
}

/** `<version>`: §9.2 steps 1 to 8 for the fork release `brain-v<version>`. Returns the report line; throws a Refusal. */
export async function vendorRelease({ root, version, fork, api, token }) {
  if (fork === undefined) throw new Refusal("cannot tell the product repository: pass --repo <owner/name>");
  const request = guarded(github({ api, token }));
  const tag = `brain-v${version}`;
  const release = await request(`/repos/${fork}/releases/tags/${tag}`, { allow404: true });
  if (release === null) throw new Refusal(`no release ${tag}`);
  if (release.draft) throw new Refusal(`${tag} is a draft`);
  const lines = notesLines(release.body);
  for (const key of Object.keys(NOTES)) if (lines[key] === undefined) throw new Refusal(`release notes of ${tag}: need exactly one ${key}: line`);
  const assetName = `${FORK_NAME}-${version}.tar.gz`;
  const asset = (release.assets ?? []).find((entry) => entry.name === assetName);
  if (asset === undefined) throw new Refusal(`${tag} has no asset ${assetName}`);
  const commit = await tagCommit(request, fork, tag);
  const bytes = await download({ api, token, fork, id: asset.id });
  if (sha256(bytes) !== lines["Tarball-SHA256"]) throw new Refusal("tarball SHA-256 differs from Tarball-SHA256");
  const work = mkdtempSync(join(tmpdir(), "vendor-skills-"));
  try {
    const folder = unpack(bytes, work);
    const manifest = checkSnapshot(folder, { release: true, version, integrity: lines.Integrity, cli: lines.CLI, repository: `https://github.com/${fork}`, commit });
    checkProductVersion(root, manifest, tag);
    return write(root, folder, manifest);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** `--local`: the fork checkout's build of `ref` as `0.0.0-local`, then steps 5 to 8 (§9.2). */
export function vendorLocal({ root, checkout, ref = "HEAD", fork }) {
  const work = mkdtempSync(join(tmpdir(), "vendor-skills-local-"));
  try {
    const builder = join(resolve(checkout), "tools", "build-snapshot.mjs");
    if (!isFile(builder)) throw new Refusal(`${builder} not found: --local needs a checkout of the fork`);
    const env = fork === undefined ? process.env : { ...process.env, GITHUB_REPOSITORY: fork };
    const built = spawnSync(process.execPath, [builder, "--commit", ref, "--version", LOCAL_VERSION, "--out", work], { cwd: resolve(checkout), env, encoding: "utf8" });
    if (built.status !== 0) throw new Refusal(`the fork's build failed: ${(built.stderr || built.stdout || "no output").trim().split("\n").at(-1)}`);
    const manifest = checkSnapshot(work, { release: false, version: LOCAL_VERSION });
    checkProductVersion(root, manifest, `the local snapshot of ${ref}`);
    return write(root, work, manifest);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function parse(args) {
  const options = {};
  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--check" || arg === "--online") { if (arg.slice(2) in options) return undefined; options[arg.slice(2)] = true; continue; }
    if (arg === "--repo" || arg === "--local" || arg === "--commit") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--") || arg.slice(2) in options) return undefined;
      options[arg.slice(2)] = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) return undefined;
    positionals.push(arg);
  }
  const modes = [options.check === true, options.local !== undefined, positionals.length > 0].filter(Boolean).length;
  if (modes !== 1 || positionals.length > 1) return undefined;
  if (options.online && !options.check) return undefined;
  if (options.commit !== undefined && options.local === undefined) return undefined;
  if (options.repo !== undefined && options.local !== undefined) return undefined;
  if (options.check && !options.online && options.repo !== undefined) return undefined;
  if (positionals.length === 1 && parseVersion(positionals[0]) === undefined) return undefined;
  return { ...options, version: positionals[0] };
}

async function main(args) {
  const parsed = parse(args);
  if (parsed === undefined) {
    process.stderr.write(`${USAGE}\n`);
    process.exitCode = 2;
    return;
  }
  const root = resolve(process.env.UB_ROOT || SOURCE);
  const api = process.env.UB_GITHUB_API ?? "https://api.github.com";
  if (parsed.check) {
    const online = parsed.online === true;
    const fork = online ? forkOf(root, parsed.repo) : undefined;
    const reason = await checkVendored({ root, fork, online, request: online ? github({ api, token: credential() }) : undefined });
    if (reason === null) {
      // On stderr, so `npm pack --json`, whose prepack runs this check, keeps a clean stdout.
      const { manifest } = validateSnapshot(join(root, ".agents", "skills"));
      process.stderr.write(`vendored skills OK: ${manifest.name} ${manifest.version}\n`);
      return;
    }
    process.stderr.write(`${checkMessage(reason)}\n`);
    process.exitCode = 1;
    return;
  }
  try {
    const line = parsed.local !== undefined
      ? vendorLocal({ root, checkout: parsed.local, ref: parsed.commit, fork: forkOf(root) })
      : await vendorRelease({ root, version: parsed.version, fork: forkOf(root, parsed.repo), api, token: credential() });
    process.stdout.write(`${line}\n`);
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    process.stderr.write(`vendor-skills: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
