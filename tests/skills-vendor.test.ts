import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";

// @ts-expect-error: a plain .mjs test fixture without types
import { FORK, forkState, PRODUCT, sha, startMock, TOKEN } from "./fixtures/github-mock.mjs";
import { buildManifest, serializeManifest, type Manifest, type ManifestMeta } from "../src/lib/skills-snapshot.ts";
import { snapshotCopy, temp } from "./skills-fixtures.ts";

// spec/skills-delivery.md §9.1 to §9.3; §12.5 items 1 to 4. Synthetic snapshots and a mock GitHub API; no network.
const exec = promisify(execFile);
const REPO = join(import.meta.dirname, "..");
const SCRIPT = join(REPO, "scripts", "vendor-skills.mjs");
const RANGE = ">=0.9.2-0 <0.10.0";
const LICENSE = "MIT License\n\nCopyright (c) 2026 Example Upstream\n";
const NOTICE = "# Notice\n\nDerived from an example upstream.\n";
const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

interface Fork { folder: string; manifest: Manifest; tarball: Buffer }

/** A fork release folder from fixture A or B: LICENSE and NOTICE.md at the top, the manifest a fork build writes (§10.2). */
async function forkSnapshot(context: TestContext, fixture: "a" | "b", meta: Partial<ManifestMeta> & { version: string }, edit?: (folder: string) => Promise<void>): Promise<Fork> {
  const folder = await snapshotCopy(context, fixture);
  await writeFile(join(folder, "LICENSE"), LICENSE);
  await writeFile(join(folder, "NOTICE.md"), NOTICE);
  const manifest = buildManifest(folder, {
    name: "ultimate-brain-skills",
    cli: RANGE,
    source: { repository: `https://github.com/${FORK}`, commit: sha("m2") },
    upstream: { repository: "https://github.com/example/upstream-skills", commit: sha("upstream") },
    targets: (name) => (name === "brain-query" ? ["brain", "linked_repo"] : ["brain"]),
    ...meta,
  });
  await writeFile(join(folder, "snapshot.json"), serializeManifest(manifest));
  await edit?.(folder);
  return { folder, manifest, tarball: await tarOf(context, folder) };
}

/** The asset as the fork packs it: `tar -czf <file> -C <folder> <entries>` (§10.2). */
async function tarOf(context: TestContext, folder: string): Promise<Buffer> {
  const file = join(await temp(context, "tarball-"), "snapshot.tar.gz");
  await exec("tar", ["-czf", file, "-C", folder, ...(await readdir(folder)).sort()]);
  return readFile(file);
}

/** A hand-built gzip tarball, for members `tar -czf` won't write: a `..` path, a symbolic or hard link (ustar headers). */
function craftedTarball(members: Array<{ path: string; type: "0" | "1" | "2" | "5"; content?: string; link?: string }>): Buffer {
  const blocks: Buffer[] = [];
  for (const member of members) {
    const content = Buffer.from(member.content ?? "");
    const header = Buffer.alloc(512);
    const field = (offset: number, length: number, value: string) => header.write(value, offset, length, "utf8");
    const octal = (offset: number, length: number, value: number) => field(offset, length, `${value.toString(8).padStart(length - 1, "0")}\0`);
    field(0, 100, member.path);
    octal(100, 8, member.type === "5" ? 0o755 : 0o644);
    octal(108, 8, 0);
    octal(116, 8, 0);
    octal(124, 12, member.type === "0" ? content.length : 0);
    octal(136, 12, 0);
    header.fill(" ", 148, 156);
    field(156, 1, member.type);
    if (member.link !== undefined) field(157, 100, member.link);
    field(257, 6, "ustar\0");
    field(263, 2, "00");
    let sum = 0;
    for (const byte of header) sum += byte;
    field(148, 8, `${sum.toString(8).padStart(6, "0")}\0 `);
    blocks.push(header);
    if (member.type === "0" && content.length > 0) blocks.push(content, Buffer.alloc((512 - (content.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}

const notes = (manifest: Manifest, tarball: Buffer, extra = "") => `CC-105: example\n\n${extra}Integrity: ${manifest.integrity}\nTarball-SHA256: ${sha256(tarball)}\nCLI: ${manifest.cli}\n`;

interface ReleaseSpec { version: string; body?: string; tarball: Buffer; draft?: boolean; annotated?: boolean; redirect?: boolean; assetName?: string; at?: string }
let assetIds = 1;
function release(spec: ReleaseSpec, manifest?: Manifest) {
  return {
    version: spec.version,
    at: spec.at ?? "m2",
    draft: spec.draft ?? false,
    annotated: spec.annotated ?? false,
    body: spec.body ?? notes(manifest!, spec.tarball),
    assets: [{ id: assetIds++, name: spec.assetName ?? `ultimate-brain-skills-${spec.version}.tar.gz`, bytes: spec.tarball, redirect: spec.redirect ?? false }],
  };
}

async function mockOf(context: TestContext, releases: unknown[]) {
  const mock = await startMock({ fork: forkState({ history: [{ label: "m1" }, { label: "m2" }], releases: releases as never }), issues: [] });
  context.after(() => mock.close());
  return mock;
}

/** A product checkout: package.json at `version`, and `.agents/skills` holding `vendored` when given. */
async function checkout(context: TestContext, version = "0.9.2", vendored?: string): Promise<string> {
  const root = await temp(context, "vendor-product-");
  await writeFile(join(root, "package.json"), `${JSON.stringify({ name: "ultimate-brain", version })}\n`);
  if (vendored !== undefined) await cp(vendored, join(root, ".agents", "skills"), { recursive: true });
  return root;
}

interface Result { code: number | null; stdout: string; stderr: string }
function vendor(args: string[], root: string, api = "http://127.0.0.1:65535", env: Record<string, string> = {}): Promise<Result> {
  const child = spawn(process.execPath, ["--no-warnings", "--experimental-strip-types", SCRIPT, ...args], {
    cwd: root,
    env: { ...process.env, UB_ROOT: root, UB_GITHUB_API: api, GH_TOKEN: TOKEN, GITHUB_REPOSITORY: PRODUCT, ...env },
  });
  const result = { stdout: "", stderr: "" };
  child.stdout.on("data", (chunk) => { result.stdout += chunk; });
  child.stderr.on("data", (chunk) => { result.stderr += chunk; });
  return new Promise((done) => child.on("close", (code) => done({ ...result, code })));
}

/** Every entry under `<root>/.agents` with its bytes' hash, so "writes nothing" compares whole trees, leftovers included. */
async function treeOf(folder: string, relative = ""): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  let entries;
  try { entries = await readdir(join(folder, relative), { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const path = relative === "" ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) { out[`${path}/`] = "folder"; Object.assign(out, await treeOf(folder, path)); }
    else out[path] = sha256(await readFile(join(folder, path)));
  }
  return out;
}

const MESSAGE = (reason: string) => `.agents/skills is not a released ultimate-brain-skills snapshot (${reason}). Skills are written in the fork; restore with git checkout -- .agents/skills and git clean -fdx .agents/skills, or vendor a release: node scripts/vendor-skills.mjs <version>`;

test("vendoring a release writes .agents/skills equal to its entries and reports added, changed and retired skills", async (context) => {
  const old = await forkSnapshot(context, "a", { version: "1.0.0" });
  const next = await forkSnapshot(context, "b", { version: "1.1.0" });
  const mock = await mockOf(context, [release({ version: "1.1.0", tarball: next.tarball, annotated: true, redirect: true }, next.manifest)]);
  const root = await checkout(context, "0.9.2", old.folder);
  const result = await vendor(["1.1.0"], root, mock.url);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, `vendored ultimate-brain-skills 1.1.0 (${next.manifest.integrity}), was ultimate-brain-skills 1.0.0; added: brain-new; changed: brain-apply; retired: brain-old\n`);
  assert.deepEqual(await treeOf(join(root, ".agents", "skills")), await treeOf(next.folder));
  assert.deepEqual((await readdir(join(root, ".agents"))).sort(), ["skills"]);
  // The signed URL of a redirected asset is fetched without the token.
  assert.ok(mock.requests.some((request: { path: string }) => request.path.startsWith("/signed/")));

  // A phase A folder: its README.md goes with the swap, and the report names the old manifest; no manifest at all is `none`.
  const phaseA = await snapshotCopy(context, "a", (manifest) => {
    manifest.name = "ultimate-brain"; manifest.version = "0.9.1"; manifest.cli = ">=0.9.1 <0.10.0"; manifest.source = { repository: "https://www.npmjs.com/package/ultimate-brain" }; manifest.upstream = null;
  });
  await writeFile(join(phaseA, "README.md"), "# Generated\n");
  const fromA = await checkout(context, "0.9.2", phaseA);
  const second = await vendor(["1.1.0"], fromA, mock.url);
  assert.equal(second.code, 0, second.stderr);
  assert.match(second.stdout, /, was ultimate-brain 0\.9\.1; added: brain-new; changed: brain-apply; retired: brain-old\n$/);
  assert.deepEqual(await treeOf(join(fromA, ".agents", "skills")), await treeOf(next.folder));
  const empty = await checkout(context);
  const third = await vendor(["1.1.0"], empty, mock.url);
  assert.equal(third.code, 0, third.stderr);
  assert.match(third.stdout, /, was none; added: brain-apply, brain-new, brain-query; changed: none; retired: none\n$/);
});

test("each refusal of steps 1 to 6 writes nothing, leftovers included", async (context) => {
  const good = await forkSnapshot(context, "b", { version: "1.1.0" });
  const old = await forkSnapshot(context, "a", { version: "1.0.0" });
  const mismatch = async (meta: Partial<ManifestMeta>, edit?: (folder: string) => Promise<void>) => forkSnapshot(context, "b", { version: "1.1.0", ...meta }, edit);
  const withFile = async (fork: Fork, content: string) => {
    const evil = craftedTarball([{ path: "snapshot.json", type: "0", content: "{}" }, ...JSON.parse(content)]);
    return { ...fork, tarball: evil };
  };
  const dotdot = await withFile(good, JSON.stringify([{ path: "../evil.md", type: "0", content: "x" }]));
  const symbolic = await withFile(good, JSON.stringify([{ path: "brain-apply/", type: "5" }, { path: "brain-apply/SKILL.md", type: "2", link: "/etc/hosts" }]));
  const hard = await withFile(good, JSON.stringify([{ path: "a.md", type: "0", content: "x" }, { path: "b.md", type: "1", link: "a.md" }]));
  const edited = await mismatch({}, (folder) => writeFile(join(folder, "brain-apply", "SKILL.md"), "edited\n"));
  const phaseAName = await mismatch({ name: "ultimate-brain", source: { repository: `https://github.com/${FORK}` }, upstream: null });
  const otherVersion = await mismatch({ version: "1.1.1" });
  const otherRepository = await mismatch({ source: { repository: "https://github.com/example/other-skills", commit: sha("m2") } });
  const otherCommit = await mismatch({ source: { repository: `https://github.com/${FORK}`, commit: sha("m1") } });
  const noLicense = await mismatch({}, (folder) => rm(join(folder, "LICENSE")));
  const noNotice = await mismatch({}, (folder) => rm(join(folder, "NOTICE.md")));
  const otherIntegrity = { ...good.manifest, integrity: `sha256-${"0".repeat(64)}` };
  const otherCli = { ...good.manifest, cli: ">=0.9.0 <0.10.0" };
  const cases: Array<[string, unknown, RegExp | string, string?]> = [
    ["no release", release({ version: "1.2.0", tarball: good.tarball }, good.manifest), "no release brain-v1.1.0"],
    ["a draft", release({ version: "1.1.0", tarball: good.tarball, draft: true }, good.manifest), "brain-v1.1.0 is a draft"],
    ["no Integrity line", release({ version: "1.1.0", tarball: good.tarball, body: notes(good.manifest, good.tarball).replace(/^Integrity: .*\n/m, "") }), "release notes of brain-v1.1.0: need exactly one Integrity: line"],
    ["a doubled CLI line", release({ version: "1.1.0", tarball: good.tarball, body: notes(good.manifest, good.tarball, `CLI: ${RANGE}\n`) }), "release notes of brain-v1.1.0: need exactly one CLI: line"],
    ["no asset", release({ version: "1.1.0", tarball: good.tarball, assetName: "other.tar.gz" }, good.manifest), "brain-v1.1.0 has no asset ultimate-brain-skills-1.1.0.tar.gz"],
    ["a tarball whose hash differs", release({ version: "1.1.0", tarball: good.tarball, body: notes(good.manifest, old.tarball) }), "tarball SHA-256 differs from Tarball-SHA256"],
    ["a member with ..", release({ version: "1.1.0", tarball: dotdot.tarball, body: notes(good.manifest, dotdot.tarball) }), "member path: ../evil.md"],
    ["a symbolic link member", release({ version: "1.1.0", tarball: symbolic.tarball, body: notes(good.manifest, symbolic.tarball) }), "member type: brain-apply/SKILL.md"],
    ["a hard link member", release({ version: "1.1.0", tarball: hard.tarball, body: notes(good.manifest, hard.tarball) }), /member type: (a|b)\.md/],
    ["an invalid snapshot", release({ version: "1.1.0", tarball: edited.tarball }, edited.manifest), "snapshot: file-mismatch: brain-apply/SKILL.md"],
    ["another name", release({ version: "1.1.0", tarball: phaseAName.tarball }, phaseAName.manifest), "snapshot name is ultimate-brain, not ultimate-brain-skills"],
    ["another version", release({ version: "1.1.0", tarball: otherVersion.tarball }, otherVersion.manifest), "snapshot version is 1.1.1, not 1.1.0"],
    ["another integrity", release({ version: "1.1.0", tarball: good.tarball }, otherIntegrity), "snapshot integrity differs from the Integrity: line"],
    ["another range", release({ version: "1.1.0", tarball: good.tarball }, otherCli), "snapshot cli differs from the CLI: line"],
    ["another repository", release({ version: "1.1.0", tarball: otherRepository.tarball }, otherRepository.manifest), `snapshot source.repository is https://github.com/example/other-skills, not https://github.com/${FORK}`],
    ["another commit", release({ version: "1.1.0", tarball: otherCommit.tarball }, otherCommit.manifest), `snapshot source.commit is ${sha("m1")}, not the tag's commit ${sha("m2")}`],
    ["no LICENSE", release({ version: "1.1.0", tarball: noLicense.tarball }, noLicense.manifest), "snapshot has no LICENSE"],
    ["no NOTICE.md", release({ version: "1.1.0", tarball: noNotice.tarball }, noNotice.manifest), "snapshot has no NOTICE.md"],
    ["a range that excludes package.json", release({ version: "1.1.0", tarball: good.tarball }, good.manifest),
      `brain-v1.1.0 needs ultimate-brain ${RANGE}; package.json is 0.9.1. Set package.json to the release this lands in (npm version 0.9.2 --no-git-tag-version), then run again`, "0.9.1"],
  ];
  for (const [label, entry, reason, version] of cases) {
    const mock = await mockOf(context, [entry]);
    const root = await checkout(context, version ?? "0.9.2", old.folder);
    await mkdir(join(root, ".agents", "skills.new", "stale"), { recursive: true });
    const before = await treeOf(join(root, ".agents"));
    const result = await vendor(["1.1.0"], root, mock.url);
    assert.equal(result.code, 1, `${label}: ${result.stdout}`);
    if (typeof reason === "string") assert.equal(result.stderr, `vendor-skills: ${reason}\n`, label);
    else assert.match(result.stderr, reason, label);
    assert.equal(result.stdout, "", label);
    assert.deepEqual(await treeOf(join(root, ".agents")), before, `${label} wrote something`);
  }
});

test("a failure while writing leaves the old folder; an interrupted swap is recovered by running again", { skip: process.getuid?.() === 0 }, async (context) => {
  const old = await forkSnapshot(context, "a", { version: "1.0.0" });
  const next = await forkSnapshot(context, "b", { version: "1.1.0" });
  const mock = await mockOf(context, [release({ version: "1.1.0", tarball: next.tarball }, next.manifest)]);
  const root = await checkout(context, "0.9.2", old.folder);
  const before = await treeOf(join(root, ".agents", "skills"));
  await chmod(join(root, ".agents"), 0o555);
  context.after(() => chmod(join(root, ".agents"), 0o755).catch(() => {}));
  const failed = await vendor(["1.1.0"], root, mock.url);
  await chmod(join(root, ".agents"), 0o755);
  assert.equal(failed.code, 1);
  assert.deepEqual(await treeOf(join(root, ".agents", "skills")), before);

  // Interrupted after the first rename: no .agents/skills, the old one at .old, a stale .new.
  const interrupted = await checkout(context, "0.9.2");
  await cp(old.folder, join(interrupted, ".agents", "skills.old"), { recursive: true });
  await mkdir(join(interrupted, ".agents", "skills.new", "half"), { recursive: true });
  const again = await vendor(["1.1.0"], interrupted, mock.url);
  assert.equal(again.code, 0, again.stderr);
  assert.match(again.stdout, /, was ultimate-brain-skills 1\.0\.0; /);
  assert.deepEqual((await readdir(join(interrupted, ".agents"))).sort(), ["skills"]);
  assert.deepEqual(await treeOf(join(interrupted, ".agents", "skills")), await treeOf(next.folder));
});

test("--local vendors the fork checkout's build as 0.0.0-local: --check passes on it and --check --online fails", async (context) => {
  const local = await forkSnapshot(context, "b", { version: "0.0.0-local" });
  const fork = await temp(context, "vendor-fork-");
  await mkdir(join(fork, "tools"));
  const calls = join(fork, "calls.json");
  // A stub of the fork's builder (§10.2): it records its arguments and writes the prepared snapshot to --out.
  await writeFile(join(fork, "tools", "build-snapshot.mjs"), [
    'import { cpSync, writeFileSync } from "node:fs";',
    `writeFileSync(${JSON.stringify(calls)}, JSON.stringify({ args: process.argv.slice(2), repository: process.env.GITHUB_REPOSITORY }));`,
    "const out = process.argv[process.argv.indexOf(\"--out\") + 1];",
    `cpSync(${JSON.stringify(local.folder)}, out, { recursive: true });`,
  ].join("\n"));
  const mock = await mockOf(context, []);
  const root = await checkout(context, "0.9.2");
  const result = await vendor(["--local", fork, "--commit", "abc1234"], root, mock.url);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, `vendored ultimate-brain-skills 0.0.0-local (${local.manifest.integrity}), was none; added: brain-apply, brain-new, brain-query; changed: none; retired: none\n`);
  const call = JSON.parse(await readFile(calls, "utf8"));
  assert.deepEqual(call.args.slice(0, 5), ["--commit", "abc1234", "--version", "0.0.0-local", "--out"]);
  assert.equal(call.repository, FORK);
  assert.deepEqual(await treeOf(join(root, ".agents", "skills")), await treeOf(local.folder));
  const offline = await vendor(["--check"], root);
  assert.equal(offline.code, 0, offline.stderr);
  const online = await vendor(["--check", "--online"], root, mock.url);
  assert.equal(online.code, 1);
  assert.equal(online.stderr, `${MESSAGE("no release brain-v0.0.0-local")}\n`);
  // The default ref is HEAD, and a version other than 0.0.0-local is refused.
  await rm(join(root, ".agents"), { recursive: true });
  assert.equal((await vendor(["--local", fork], root, mock.url)).code, 0);
  assert.deepEqual(JSON.parse(await readFile(calls, "utf8")).args.slice(0, 2), ["--commit", "HEAD"]);
  const released = await forkSnapshot(context, "b", { version: "1.1.0" });
  await rm(join(root, ".agents"), { recursive: true });
  await writeFile(join(fork, "tools", "build-snapshot.mjs"), `import { cpSync } from "node:fs";\ncpSync(${JSON.stringify(released.folder)}, process.argv[process.argv.indexOf("--out") + 1], { recursive: true });\n`);
  const refused = await vendor(["--local", fork], root, mock.url);
  assert.equal(refused.code, 1);
  assert.equal(refused.stderr, "vendor-skills: snapshot version is 1.1.0, not 0.0.0-local\n");
  assert.deepEqual(await treeOf(join(root, ".agents")), {});
});

test("--check passes on a vendored release and names the first failing reason; --online also compares the release", async (context) => {
  const vendored = await forkSnapshot(context, "b", { version: "1.1.0" });
  const mock = await mockOf(context, [release({ version: "1.1.0", tarball: vendored.tarball, annotated: true }, vendored.manifest)]);
  const root = await checkout(context, "0.9.2", vendored.folder);
  for (const args of [["--check"], ["--check", "--online"]]) {
    const passed = await vendor(args, root, mock.url);
    assert.equal(passed.code, 0, passed.stderr);
    assert.equal(passed.stdout, "");
    assert.equal(passed.stderr, "vendored skills OK: ultimate-brain-skills 1.1.0\n");
  }
  // Offline: no network, no remote. The API URL points at a closed port, and the check still passes.
  assert.equal((await vendor(["--check"], root, "http://127.0.0.1:65535", { GITHUB_REPOSITORY: "" })).code, 0);

  const failing = async (reason: string, change: (folder: string) => Promise<void>, args = ["--check"], version = "0.9.2") => {
    const copy = await checkout(context, version, vendored.folder);
    await change(join(copy, ".agents", "skills"));
    const result = await vendor(args, copy, mock.url);
    assert.equal(result.code, 1, reason);
    assert.equal(result.stderr, `${MESSAGE(reason)}\n`);
  };
  await failing("file-mismatch: brain-apply/SKILL.md", (folder) => writeFile(join(folder, "brain-apply", "SKILL.md"), "edited\n"));
  await failing("unlisted-entry: brain-apply/extra.md", (folder) => writeFile(join(folder, "brain-apply", "extra.md"), "added\n"));
  await failing("unlisted-entry: .DS_Store", (folder) => writeFile(join(folder, ".DS_Store"), "x"));
  await failing("manifest-missing", (folder) => rm(join(folder, "snapshot.json")));
  await failing("name ultimate-brain", async (folder) => {
    const manifest = buildManifest(folder, { name: "ultimate-brain", version: "0.9.1", cli: ">=0.9.1 <0.10.0", source: { repository: "https://www.npmjs.com/package/ultimate-brain" }, upstream: null });
    await writeFile(join(folder, "snapshot.json"), serializeManifest(manifest));
  });
  await failing("no LICENSE", (folder) => rm(join(folder, "LICENSE")));
  await failing("no NOTICE.md", (folder) => rm(join(folder, "NOTICE.md")));
  await failing(`not compatible with 0.9.1 (${RANGE})`, async () => {}, ["--check"], "0.9.1");
  // Online: an edit that also rewrites the manifest, a release that doesn't exist, an unreachable API.
  const rewritten = async (folder: string) => {
    await writeFile(join(folder, "brain-apply", "SKILL.md"), "edited\n");
    await writeFile(join(folder, "snapshot.json"), serializeManifest(buildManifest(folder, { ...vendored.manifest, targets: (name) => vendored.manifest.skills.find((skill) => skill.name === name)!.targets })));
  };
  await failing("differs from brain-v1.1.0: integrity", rewritten, ["--check", "--online"]);
  assert.equal((await vendor(["--check"], await (async () => { const copy = await checkout(context, "0.9.2", vendored.folder); await rewritten(join(copy, ".agents", "skills")); return copy; })(), mock.url)).code, 0, "the offline check can't tell");
  await failing("no release brain-v1.2.0", async (folder) => {
    await writeFile(join(folder, "snapshot.json"), serializeManifest({ ...vendored.manifest, version: "1.2.0" }));
  }, ["--check", "--online"]);
  const down = await vendor(["--check", "--online"], root, "http://127.0.0.1:65535");
  assert.equal(down.code, 1);
  assert.match(down.stderr, /\(status unknown \(GitHub unreachable \(ECONNREFUSED\)\)\)/);
});

/** §9.1: `null`, or the message when Git tracks anything under `skills` at the root of `root`. */
async function skillsFolderProblem(root: string): Promise<string | null> {
  const { stdout } = await exec("git", ["ls-files", "--", "skills"], { cwd: root });
  return stdout.trim() === "" ? null : "skills are written in the fork ultimate-brain-skills (brain/<name>/), not here: spec/skills-delivery.md §9.1";
}

test("the product repo tracks nothing under skills/: skills are written in the fork (§9.1)", async (context) => {
  assert.equal(await skillsFolderProblem(REPO), null);
  const root = await temp(context, "vendor-git-");
  await exec("git", ["init", "-q"], { cwd: root });
  await mkdir(join(root, "skills", "brain-apply"), { recursive: true });
  await writeFile(join(root, "skills", "brain-apply", "SKILL.md"), "untracked\n");
  assert.equal(await skillsFolderProblem(root), null, "untracked files don't count");
  await exec("git", ["add", "skills"], { cwd: root });
  assert.equal(await skillsFolderProblem(root), "skills are written in the fork ultimate-brain-skills (brain/<name>/), not here: spec/skills-delivery.md §9.1");
});
