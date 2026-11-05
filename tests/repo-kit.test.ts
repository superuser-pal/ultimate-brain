import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";
import { promisify } from "node:util";

import { globMatch } from "../src/lib/link-kit.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const exec = promisify(execFile);
const NOW = "2026-12-10T09:00:00Z";
const AREA = "area-2m7c4h8n";
const OTHER_AREA = "area-3n6q8v2b";
const PROJECT = "prj-9x4t1b7e";
const GOAL = "gol-4p9r2w6t";
const EXAMPLES = join(import.meta.dirname, "..", "spec", "examples", "link-kit");
const VERSION: string = JSON.parse(await readFile(join(import.meta.dirname, "..", "package.json"), "utf8")).version;

async function run(dir: string, args: string[], now = NOW) {
  return brain([...args, "--brain", dir, "--now", now, "--json"]);
}

/** A temporary Git repo; `commit` writes files (null deletes) and commits them at a fixed time. */
async function tempRepo(context: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "brain-repo-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const git = async (...args: string[]) => (await exec("git", ["-C", root, ...args], { env: { ...process.env, ...dates } })).stdout.trim();
  let dates: Record<string, string> = {};
  await git("init", "-q", "-b", "main");
  await git("config", "user.email", "test@example.com");
  await git("config", "user.name", "Test");
  const commit = async (when: string, files: Record<string, string | null>) => {
    for (const [file, text] of Object.entries(files)) {
      if (text === null) { await git("rm", "-q", file); continue; }
      await mkdir(dirname(join(root, file)), { recursive: true });
      await writeFile(join(root, file), text);
      await git("add", file);
    }
    dates = { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when };
    await git("commit", "-q", "-m", `change at ${when}`);
    return git("rev-parse", "HEAD");
  };
  return { root, git, commit };
}
type Repo = Awaited<ReturnType<typeof tempRepo>>;

const sha = (text: string | Uint8Array) => createHash("sha256").update(text).digest("hex");
const hash = (text: string | Uint8Array) => `sha256:${sha(text)}`;

// ---- kit helpers -----------------------------------------------------------------------------------------------

const ORDER = {
  top: ["kit_version", "name", "placement", "knowledge", "tasks", "methodology", "starter"],
  placement: ["area", "domain", "project"],
  knowledge: ["patterns", "never_read"],
  tasks: ["mode", "source", "status_map"],
  source: ["kind", "path", "format", "pattern", "repo", "project"],
  methodology: ["summary", "files"],
  starter: ["name", "version"],
};

/** The canonical bytes of linked-repos.md §2.1, written here independently of the implementation. */
function canon(kit: any): string {
  const pick = (object: any, keys: string[]) => Object.fromEntries(keys.filter((key) => object[key] !== undefined).map((key) => [key, object[key]]));
  const out: any = pick(kit, ORDER.top);
  for (const key of ["placement", "knowledge", "methodology", "starter"] as const) if (out[key]) out[key] = pick(out[key], ORDER[key]);
  if (out.tasks) {
    out.tasks = pick(out.tasks, ORDER.tasks);
    out.tasks.source = pick(out.tasks.source, ORDER.source);
  }
  return `${JSON.stringify(out, null, 2)}\n`;
}

/** The same kit as compact JSON with every object's keys reversed (lists and status_map keep their order). */
function scrambled(kit: any): string {
  const flip = (value: any, keep = false): any => {
    if (Array.isArray(value) || value === null || typeof value !== "object") return value;
    const entries = Object.entries(value).map(([key, inner]) => [key, flip(inner, key === "status_map")] as const);
    return Object.fromEntries(keep ? entries : entries.reverse());
  };
  return JSON.stringify(flip(kit));
}

function makeKit(over: Record<string, unknown> = {}): any {
  return {
    kit_version: 1,
    name: "acme-api",
    placement: { area: AREA, project: PROJECT },
    knowledge: { patterns: ["decisions/**"], never_read: [".env*", "secrets/**"] },
    tasks: { mode: "tracked-in-repo", source: { kind: "markdown", path: "TASKS.md", format: "checklist" }, status_map: { "/": "in_progress", "-": "dropped" } },
    methodology: { summary: "Decisions first; small PRs.", files: ["AGENTS.md"] },
    ...over,
  };
}
const tasksWith = (source: object, status_map?: object) => ({ mode: "tracked-in-repo", source, ...(status_map ? { status_map } : {}) });
const checklist = { kind: "markdown", path: "TASKS.md", format: "checklist" };

let counter = 0;
async function inputFile(dir: string, text: string) {
  const file = join(dirname(dir), `input-${counter++}.json`);
  await writeFile(file, text);
  return file;
}

const BASE_FILES: Record<string, string> = { "decisions/0001-one.md": "# One\n", "TASKS.md": "- [ ] First\n", "AGENTS.md": "# Agents\n" };

interface Linked { dir: string; repo: Repo; name: string; text: string; hash: string; head: string }
/** A repo with its kit committed and linked with `repo add --kit` (the kit is left untracked with `commitKit: false`). */
async function linked(context: TestContext, options: { dir?: string; kit?: any; files?: Record<string, string>; commitKit?: boolean } = {}): Promise<Linked> {
  const dir = options.dir ?? (await fixtureCopy(context));
  const repo = await tempRepo(context);
  const kit = options.kit ?? makeKit();
  const text = canon(kit);
  const commitKit = options.commitKit ?? true;
  const head = await repo.commit("2026-11-01T10:00:00Z", { ...BASE_FILES, ...options.files, ...(commitKit ? { "brain-kit.json": text } : {}) });
  if (!commitKit) await writeFile(join(repo.root, "brain-kit.json"), text);
  const added = await run(dir, ["repo", "add", kit.name, "--path", repo.root, "--kit"]);
  assert.equal(added.code, 0, added.stdout);
  return { dir, repo, name: kit.name, text, hash: hash(text), head };
}

async function readConfig(dir: string) {
  return JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
}
const logOf = (dir: string) => readFile(join(dir, "log/2026-12.md"), "utf8");
const codes = (checks: { code: string }[]) => checks.map((check) => check.code);
async function healthOf(link: Linked, extra: string[] = []) {
  const result = await run(link.dir, ["repo", "health", link.name, ...extra]);
  return { ...result, checks: (result.json.data?.repos?.[0]?.checks ?? []) as { code: string; severity: string; message: string; path?: string }[] };
}
async function addSecondArea(dir: string) {
  await writeFile(join(dir, "areas", "other.md"), `---
id: ${OTHER_AREA}
type: area
title: Other
summary: A second area.
lifecycle: reviewed
sources: [notion:1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6e]
created: 2026-09-15
updated: 2026-09-15
notion: 1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6e
last_synced: 2026-12-05T08:31:00Z
notion_fields:
  as_of: 2026-12-05T08:31:00Z
  type: Business
  archived: false
---

A second area.
`);
}
/** A `file:` source of a linked repo, made with `note new` (as in tests/repos.test.ts). */
async function addSource(dir: string, name: string, repoPath: string, commit: string) {
  const text = `# ${repoPath}\n`;
  const item = {
    type: "source", title: `File ${repoPath}`, file_date: "2026-11-01",
    frontmatter: { source_key: `file:sha256:${sha(text)}`, kind: "document", file_name: repoPath.split("/").pop(), converter: "verbatim", summary: "A file.", repo: name, repo_path: repoPath, commit },
    body: text,
  };
  const input = await inputFile(dir, JSON.stringify({ notes: [item] }));
  const created = await brain(["note", "new", "--input", input, "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(created.code, 0, created.stdout);
}

// ---- repo kit check --------------------------------------------------------------------------------------------

test("repo kit check: every valid example has no problems and the hash of the bytes it read", async (context) => {
  const dir = await fixtureCopy(context);
  for (const name of await readdir(join(EXAMPLES, "valid"))) {
    const file = join(EXAMPLES, "valid", name);
    const bytes = await readFile(file);
    const result = await run(dir, ["repo", "kit", "check", "--input", file]);
    assert.equal(result.code, 0, `${name}: ${result.stdout}`);
    assert.deepEqual(result.json.data.problems, [], name);
    assert.deepEqual(result.json.data.kit, JSON.parse(bytes.toString("utf8")), name);
    assert.equal(result.json.data.sha256, hash(bytes), name);
  }
});

test("repo kit check: every invalid example has at least one problem with a pointer and a message, and exits 0", async (context) => {
  const dir = await fixtureCopy(context);
  for (const name of await readdir(join(EXAMPLES, "invalid"))) {
    const result = await run(dir, ["repo", "kit", "check", "--input", join(EXAMPLES, "invalid", name)]);
    assert.equal(result.code, 0, `${name}: ${result.stdout}`);
    const problems = result.json.data.problems as { pointer: string; message: string }[];
    assert.ok(problems.length >= 1, name);
    for (const problem of problems) {
      assert.equal(typeof problem.pointer, "string", name);
      assert.equal(typeof problem.message, "string", name);
    }
  }
});

test("repo kit check: a kit version other than 1 says it needs a newer brain", async (context) => {
  const dir = await fixtureCopy(context);
  const result = await run(dir, ["repo", "kit", "check", "--input", join(EXAMPLES, "invalid", "kit-version-2.json")]);
  assert.ok(result.json.data.problems.some((problem: { message: string }) => problem.message.includes("kit version 2 needs a newer brain")));
});

test("repo kit check: bytes that are not JSON give kit null and one problem at the root", async (context) => {
  const dir = await fixtureCopy(context);
  const bytes = "{ not json";
  const result = await run(dir, ["repo", "kit", "check", "--input", await inputFile(dir, bytes)]);
  assert.equal(result.code, 0, result.stdout);
  assert.equal(result.json.data.kit, null);
  assert.equal(result.json.data.sha256, hash(bytes));
  assert.equal(result.json.data.problems.length, 1);
  assert.equal(result.json.data.problems[0].pointer, "");
  assert.ok(result.json.data.problems[0].message.startsWith("not JSON:"), result.json.data.problems[0].message);
});

test("repo kit check --path reads <path>/brain-kit.json and hashes the bytes as they are on disk", async (context) => {
  const dir = await fixtureCopy(context);
  const repo = await tempRepo(context);
  await repo.commit("2026-11-01T10:00:00Z", { "a.md": "a\n" });
  const bytes = `${JSON.stringify(makeKit(), null, 4)}\r\n\r\n`; // hand-formatted: never re-serialised before hashing
  await writeFile(join(repo.root, "brain-kit.json"), bytes);
  const result = await run(dir, ["repo", "kit", "check", "--path", repo.root]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data.problems, []);
  assert.equal(result.json.data.sha256, hash(bytes));
});

test("repo kit check: a missing kit file is KIT_MISSING", async (context) => {
  const dir = await fixtureCopy(context);
  const repo = await tempRepo(context);
  await repo.commit("2026-11-01T10:00:00Z", { "a.md": "a\n" });
  const result = await run(dir, ["repo", "kit", "check", "--path", repo.root]);
  assert.equal(result.code, 4);
  assert.equal(result.json.error.code, "KIT_MISSING");
});

test("repo kit check: exactly one of --path and --input is required", async (context) => {
  const dir = await fixtureCopy(context);
  const repo = await tempRepo(context);
  await repo.commit("2026-11-01T10:00:00Z", { "a.md": "a\n" });
  const input = await inputFile(dir, canon(makeKit()));
  assert.equal((await run(dir, ["repo", "kit", "check"])).json.error?.code, "USAGE");
  assert.equal((await run(dir, ["repo", "kit", "check", "--path", repo.root, "--input", input])).json.error?.code, "USAGE");
});

test("repo kit check --name: a different name is a problem at /name", async (context) => {
  const dir = await fixtureCopy(context);
  const input = await inputFile(dir, canon(makeKit()));
  const same = await run(dir, ["repo", "kit", "check", "--input", input, "--name", "acme-api"]);
  assert.deepEqual(same.json.data.problems, []);
  const other = await run(dir, ["repo", "kit", "check", "--input", input, "--name", "other-name"]);
  assert.equal(other.code, 0, other.stdout);
  assert.ok(other.json.data.problems.some((problem: { pointer: string }) => problem.pointer === "/name"));
});

test("repo kit check: the area and project must exist in the brain", async (context) => {
  const dir = await fixtureCopy(context);
  const pointers = async (kit: object) =>
    (await run(dir, ["repo", "kit", "check", "--input", await inputFile(dir, canon(kit))])).json.data.problems.map((problem: { pointer: string }) => problem.pointer);
  assert.ok((await pointers(makeKit({ placement: { area: "area-00000000" } }))).includes("/placement/area"));
  assert.ok((await pointers(makeKit({ placement: { area: AREA, project: "prj-00000000" } }))).includes("/placement/project"));
});

test("repo kit check: a project that belongs to another Area is a problem at /placement/project", async (context) => {
  const dir = await fixtureCopy(context);
  await addSecondArea(dir);
  const result = await run(dir, ["repo", "kit", "check", "--input", await inputFile(dir, canon(makeKit({ placement: { area: OTHER_AREA, project: PROJECT } })))]);
  assert.ok(result.json.data.problems.some((problem: { pointer: string }) => problem.pointer === "/placement/project"), result.stdout);
});

test("repo kit check: a methodology file matched by never_read is a problem at /methodology/files/<n>", async (context) => {
  const dir = await fixtureCopy(context);
  const kit = makeKit({ methodology: { summary: "x", files: ["AGENTS.md", "secrets/plan.md"] } });
  const result = await run(dir, ["repo", "kit", "check", "--input", await inputFile(dir, canon(kit))]);
  assert.deepEqual(result.json.data.problems.map((problem: { pointer: string }) => problem.pointer), ["/methodology/files/1"]);
});

test("repo kit check: a task source path matched by never_read is a problem at /tasks/source/path", async (context) => {
  const dir = await fixtureCopy(context);
  const kit = makeKit({ tasks: tasksWith({ kind: "markdown", path: "secrets/TASKS.md", format: "checklist" }) });
  const result = await run(dir, ["repo", "kit", "check", "--input", await inputFile(dir, canon(kit))]);
  assert.deepEqual(result.json.data.problems.map((problem: { pointer: string }) => problem.pointer), ["/tasks/source/path"]);
});

test("repo kit check: a pattern that does not compile, or has no title group, is a problem at /tasks/source/pattern", async (context) => {
  const dir = await fixtureCopy(context);
  const pointers = async (pattern: string) => {
    const kit = makeKit({ tasks: tasksWith({ kind: "markdown", path: "PLAN.md", format: "pattern", pattern }, { "": "todo" }) });
    return (await run(dir, ["repo", "kit", "check", "--input", await inputFile(dir, canon(kit))])).json.data.problems.map((problem: { pointer: string }) => problem.pointer);
  };
  assert.deepEqual(await pointers("^(?<title>.+"), ["/tasks/source/pattern"], "does not compile");
  assert.deepEqual(await pointers("^[(?<title>]+(?<name>.+)$"), ["/tasks/source/pattern"], "contains the text but has no title group");
  assert.deepEqual(await pointers("^## (?<title>.+)$"), []);
});

// ---- repo kit write --------------------------------------------------------------------------------------------

async function writeCase(context: TestContext, kit: any = makeKit()) {
  const dir = await fixtureCopy(context);
  const repo = await tempRepo(context);
  await repo.commit("2026-11-01T10:00:00Z", { "a.md": "a\n" });
  const input = await inputFile(dir, scrambled(kit));
  const expected = canon(kit);
  const write = (extra: string[], path = repo.root) => run(dir, ["repo", "kit", "write", "--path", path, "--input", input, ...extra]);
  return { dir, repo, input, expected, confirm: hash(expected), write, file: join(repo.root, "brain-kit.json") };
}

test("repo kit check: a hand-formatted draft gives confirm_sha256 of the canonical bytes, canonical false, and kit write accepts it (CC-129)", async (context) => {
  const { dir, input, expected, write, file } = await writeCase(context);
  const check = await run(dir, ["repo", "kit", "check", "--input", input]);
  assert.equal(check.code, 0, check.stdout);
  assert.deepEqual(check.json.data.problems, []);
  assert.equal(check.json.data.sha256, hash(await readFile(input)));
  assert.equal(check.json.data.confirm_sha256, hash(expected));
  assert.notEqual(check.json.data.sha256, check.json.data.confirm_sha256);
  assert.equal(check.json.data.canonical, false);
  const written = await write(["--confirm", check.json.data.confirm_sha256]);
  assert.equal(written.code, 0, written.stdout);
  assert.equal(await readFile(file, "utf8"), expected);
  const again = await run(dir, ["repo", "kit", "check", "--input", file]);
  assert.equal(again.json.data.canonical, true);
  assert.equal(again.json.data.sha256, again.json.data.confirm_sha256);
});

test("repo kit check: bytes that are not a JSON object give confirm_sha256 null and canonical false (CC-129)", async (context) => {
  const dir = await fixtureCopy(context);
  for (const bytes of ["{ not json", "[1, 2]"]) {
    const result = await run(dir, ["repo", "kit", "check", "--input", await inputFile(dir, bytes)]);
    assert.equal(result.code, 0, result.stdout);
    assert.equal(result.json.data.confirm_sha256, null, bytes);
    assert.equal(result.json.data.canonical, false, bytes);
  }
});

test("repo kit write: no --confirm is CONFIRMATION_REQUIRED and nothing is written", async (context) => {
  const { write, file } = await writeCase(context);
  const result = await write([]);
  assert.equal(result.code, 4);
  assert.equal(result.json.error.code, "CONFIRMATION_REQUIRED");
  await assert.rejects(readFile(file));
});

test("repo kit write: a wrong hash is CONFIRMATION_MISMATCH and nothing is written", async (context) => {
  const { write, file } = await writeCase(context);
  const result = await write(["--confirm", hash("something else")]);
  assert.equal(result.code, 4);
  assert.equal(result.json.error.code, "CONFIRMATION_MISMATCH");
  await assert.rejects(readFile(file));
});

test("repo kit write: writes the canonical bytes (2 spaces, §2.1 key order, trailing newline, non-ASCII as itself) and says what it wrote", async (context) => {
  const kit = makeKit({ methodology: { summary: "Décisions d'abord — petits PR, 日本語.", files: ["AGENTS.md"] } });
  const { write, file, expected, confirm, repo } = await writeCase(context, kit);
  const result = await write(["--confirm", confirm]);
  assert.equal(result.code, 0, result.stdout);
  const bytes = await readFile(file, "utf8");
  assert.equal(bytes, expected);
  assert.ok(bytes.includes("Décisions d'abord — petits PR, 日本語."), "not escaped");
  assert.ok(bytes.endsWith("}\n") && !bytes.endsWith("\n\n"));
  assert.deepEqual(Object.keys(result.json.data).sort(), ["action", "path_abs", "sha256"]);
  assert.equal(result.json.data.action, "created");
  assert.equal(result.json.data.sha256, confirm);
  assert.ok([repo.root, await realpath(repo.root)].some((path) => join(path, "brain-kit.json") === result.json.data.path_abs || path === result.json.data.path_abs), result.json.data.path_abs);
});

test("repo kit write: never stages or commits; the only change is the untracked kit; logs repo-kit with 12 hex", async (context) => {
  const { write, repo, confirm, dir } = await writeCase(context);
  const before = await repo.git("rev-parse", "HEAD");
  const result = await write(["--confirm", confirm]);
  assert.equal(result.code, 0, result.stdout);
  assert.equal(await repo.git("status", "--porcelain"), "?? brain-kit.json");
  assert.equal(await repo.git("rev-parse", "HEAD"), before);
  assert.ok((await logOf(dir)).includes(`repo-kit - "acme-api" sha=${confirm.slice("sha256:".length, "sha256:".length + 12)}`));
});

test("repo kit write: an existing file needs --replace; the action is updated, or unchanged when the bytes are the same", async (context) => {
  const kit = makeKit();
  const { write, file, repo, dir, confirm, expected } = await writeCase(context, kit);
  assert.equal((await write(["--confirm", confirm])).code, 0);
  assert.equal((await write(["--confirm", confirm])).json.error?.code, "KIT_EXISTS", "without --replace");
  assert.equal((await write(["--confirm", confirm, "--replace", hash("not the file")])).json.error?.code, "KIT_CHANGED", "a stale hash");
  assert.equal(await readFile(file, "utf8"), expected, "refusals leave the file alone");

  const same = await write(["--confirm", confirm, "--replace", confirm]);
  assert.equal(same.code, 0, same.stdout);
  assert.equal(same.json.data.action, "unchanged");

  const next = makeKit({ methodology: { summary: "A new summary.", files: ["AGENTS.md"] } });
  const input = await inputFile(dir, scrambled(next));
  const updated = await run(dir, ["repo", "kit", "write", "--path", repo.root, "--input", input, "--confirm", hash(canon(next)), "--replace", confirm]);
  assert.equal(updated.code, 0, updated.stdout);
  assert.equal(updated.json.data.action, "updated");
  assert.equal(await readFile(file, "utf8"), canon(next));
});

test("repo kit write: --replace on a missing file is KIT_MISSING", async (context) => {
  const { write, confirm } = await writeCase(context);
  const result = await write(["--confirm", confirm, "--replace", confirm]);
  assert.equal(result.code, 4);
  assert.equal(result.json.error.code, "KIT_MISSING");
});

test("repo kit write: refuses the brain itself and a path that is not a repo", async (context) => {
  const { dir, write, confirm } = await writeCase(context);
  await exec("git", ["-C", dir, "init", "-q"]);
  assert.equal((await write(["--confirm", confirm], dir)).json.error?.code, "REPO_IS_BRAIN");
  await assert.rejects(readFile(join(dir, "brain-kit.json")));
  const plain = await mkdtemp(join(tmpdir(), "brain-plain-"));
  context.after(() => rm(plain, { recursive: true, force: true }));
  assert.equal((await write(["--confirm", confirm], plain)).json.error?.code, "REPO_NOT_FOUND");
  assert.equal((await write(["--confirm", confirm], join(plain, "missing"))).json.error?.code, "REPO_NOT_FOUND");
});

test("repo kit write: a brain-kit.json that is a symbolic link or a folder is OUTSIDE_ROOT", async (context) => {
  const { write, file, repo, confirm } = await writeCase(context);
  const outside = join(dirname(repo.root), "elsewhere.json");
  await writeFile(outside, "{}\n");
  await symlink(outside, file);
  const linkResult = await write(["--confirm", confirm, "--replace", hash("{}\n")]);
  assert.equal(linkResult.json.error?.code, "OUTSIDE_ROOT");
  assert.equal(await readFile(outside, "utf8"), "{}\n", "nothing written through the link");
  await rm(file);
  await mkdir(file);
  assert.equal((await write(["--confirm", confirm])).json.error?.code, "OUTSIDE_ROOT");
});

test("repo kit write: an invalid kit is KIT_INVALID with details {pointer, message}, and nothing is written", async (context) => {
  const { write, file } = await writeCase(context, makeKit({ placement: { area: "area-00000000" } }));
  const result = await write(["--confirm", hash("anything")]);
  assert.equal(result.code, 4);
  assert.equal(result.json.error.code, "KIT_INVALID");
  assert.equal(result.json.error.details[0].pointer, "/placement/area");
  assert.equal(typeof result.json.error.details[0].message, "string");
  await assert.rejects(readFile(file));
});

test("repo kit write: the kit's name must be the name of the entry linked at that path, and unused by another path", async (context) => {
  const first = await linked(context);
  const other = await tempRepo(context);
  await other.commit("2026-11-01T10:00:00Z", { "a.md": "a\n" });
  const same = makeKit();
  const inputSame = await inputFile(first.dir, scrambled(same));
  const clash = await run(first.dir, ["repo", "kit", "write", "--path", other.root, "--input", inputSame, "--confirm", hash(canon(same))]);
  assert.equal(clash.json.error?.code, "KIT_INVALID", "name used by another path");
  assert.equal(clash.json.error.details[0].pointer, "/name");

  const renamed = makeKit({ name: "renamed" });
  const inputRenamed = await inputFile(first.dir, scrambled(renamed));
  const mismatch = await run(first.dir, ["repo", "kit", "write", "--path", first.repo.root, "--input", inputRenamed, "--confirm", hash(canon(renamed)), "--replace", first.hash]);
  assert.equal(mismatch.json.error?.code, "KIT_INVALID", "the linked entry at this path has another name");
  assert.equal(mismatch.json.error.details[0].pointer, "/name");
});

// ---- repo add --kit --------------------------------------------------------------------------------------------

test("repo add --kit records the kit's values and its hash", async (context) => {
  const link = await linked(context);
  const config = await readConfig(link.dir);
  assert.deepEqual(config.repos, [{
    name: "acme-api", path: link.repo.root, area: AREA, patterns: ["decisions/**"], never_read: [".env*", "secrets/**"], project: PROJECT, commit: "", kit: { sha256: link.hash },
  }]);
});

test("repo add --kit returns the new entry; a kit without project or never_read leaves those keys out", async (context) => {
  const dir = await fixtureCopy(context);
  const repo = await tempRepo(context);
  const kit = makeKit({ placement: { area: AREA }, knowledge: { patterns: ["docs/**"] } });
  await repo.commit("2026-11-01T10:00:00Z", { "brain-kit.json": canon(kit) });
  const result = await run(dir, ["repo", "add", "acme-api", "--path", repo.root, "--kit"]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data, { name: "acme-api", path: repo.root, area: AREA, patterns: ["docs/**"], commit: "", kit: { sha256: hash(canon(kit)) } });
});

test("repo add --kit: a kit whose name differs from <name> is KIT_INVALID at /name", async (context) => {
  const dir = await fixtureCopy(context);
  const repo = await tempRepo(context);
  await repo.commit("2026-11-01T10:00:00Z", { "brain-kit.json": canon(makeKit()) });
  const result = await run(dir, ["repo", "add", "another-name", "--path", repo.root, "--kit"]);
  assert.equal(result.code, 4);
  assert.equal(result.json.error.code, "KIT_INVALID");
  assert.equal(result.json.error.details[0].pointer, "/name");
  assert.equal((await readConfig(dir)).repos, undefined);
});

test("repo add --kit cannot be combined with --area or --pattern", async (context) => {
  const dir = await fixtureCopy(context);
  const repo = await tempRepo(context);
  await repo.commit("2026-11-01T10:00:00Z", { "brain-kit.json": canon(makeKit()) });
  assert.equal((await run(dir, ["repo", "add", "acme-api", "--path", repo.root, "--kit", "--area", AREA])).json.error?.code, "USAGE");
  assert.equal((await run(dir, ["repo", "add", "acme-api", "--path", repo.root, "--kit", "--pattern", "*.md"])).json.error?.code, "USAGE");
});

test("repo add --kit with no kit file is KIT_MISSING; a legacy repo add --pattern still works as under 0042", async (context) => {
  const dir = await fixtureCopy(context);
  const repo = await tempRepo(context);
  await repo.commit("2026-11-01T10:00:00Z", { "decisions/0001-one.md": "# One\n" });
  assert.equal((await run(dir, ["repo", "add", "acme-api", "--path", repo.root, "--kit"])).json.error?.code, "KIT_MISSING");
  const legacy = await run(dir, ["repo", "add", "acme-api", "--path", repo.root, "--area", AREA, "--pattern", "decisions/*.md"]);
  assert.equal(legacy.code, 0, legacy.stdout);
  assert.deepEqual((await readConfig(dir)).repos, [{ name: "acme-api", path: repo.root, area: AREA, patterns: ["decisions/*.md"], commit: "" }]);
});

// ---- repo changes ----------------------------------------------------------------------------------------------

const changedPaths = (result: any) => result.json.data.files.map((file: { path: string }) => file.path);

test("repo changes leaves out never_read matches and always brain-kit.json, even when a pattern matches it", async (context) => {
  const kit = makeKit({ knowledge: { patterns: ["**"], never_read: ["secrets/**"] } });
  const link = await linked(context, { kit, files: { "secrets/key.md": "k\n", "docs/a.md": "a\n" } });
  const result = await run(link.dir, ["repo", "changes", "acme-api"]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(changedPaths(result).sort(), ["AGENTS.md", "TASKS.md", "decisions/0001-one.md", "docs/a.md"]);
});

test("repo changes: brain-kit.json is left out of a legacy entry too, and a hand-written never_read applies", async (context) => {
  const dir = await fixtureCopy(context);
  const repo = await tempRepo(context);
  await repo.commit("2026-11-01T10:00:00Z", { "brain-kit.json": canon(makeKit()), "package.json": "{}\n", "private.json": "{}\n" });
  await run(dir, ["repo", "add", "legacy", "--path", repo.root, "--area", AREA, "--pattern", "*.json"]);
  assert.deepEqual(changedPaths(await run(dir, ["repo", "changes", "legacy"])).sort(), ["package.json", "private.json"]);
  const config = await readConfig(dir);
  config.repos[0].never_read = ["private.*"];
  await writeFile(join(dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  assert.deepEqual(changedPaths(await run(dir, ["repo", "changes", "legacy"])), ["package.json"]);
});

// ---- repo refresh ----------------------------------------------------------------------------------------------

test("repo refresh: a legacy entry is NO_KIT", async (context) => {
  const dir = await fixtureCopy(context);
  const repo = await tempRepo(context);
  await repo.commit("2026-11-01T10:00:00Z", { "decisions/0001-one.md": "# One\n" });
  await run(dir, ["repo", "add", "legacy", "--path", repo.root, "--area", AREA, "--pattern", "decisions/*.md"]);
  const result = await run(dir, ["repo", "refresh", "legacy"]);
  assert.equal(result.code, 4);
  assert.equal(result.json.error.code, "NO_KIT");
});

test("repo refresh: with an unchanged kit, changed is false and nothing is written", async (context) => {
  const link = await linked(context);
  const before = await readFile(join(link.dir, "brain.json"), "utf8");
  const logBefore = await logOf(link.dir);
  const result = await run(link.dir, ["repo", "refresh", "acme-api"]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data, {
    name: "acme-api", changed: false, placement_changed: false, added_patterns: [], removed_patterns: [], added_never_read: [], removed_never_read: [], reingest: false,
  });
  assert.equal(await readFile(join(link.dir, "brain.json"), "utf8"), before);
  assert.equal(await logOf(link.dir), logBefore);
});

test("repo refresh: reports what the kit change did, applies it, and logs repo-refresh; --dry-run reports the same and writes nothing", async (context) => {
  const link = await linked(context);
  const next = makeKit({ placement: { area: AREA }, knowledge: { patterns: ["decisions/**", "docs/**"], never_read: ["secrets/**"] } });
  await writeFile(join(link.repo.root, "brain-kit.json"), canon(next));
  const expected = {
    name: "acme-api", changed: true, placement_changed: true, added_patterns: ["docs/**"], removed_patterns: [], added_never_read: [], removed_never_read: [".env*"], reingest: true,
  };
  const before = await readFile(join(link.dir, "brain.json"), "utf8");
  const dry = await run(link.dir, ["repo", "refresh", "acme-api", "--dry-run"]);
  assert.equal(dry.code, 0, dry.stdout);
  assert.deepEqual(dry.json.data, expected);
  assert.equal(await readFile(join(link.dir, "brain.json"), "utf8"), before, "dry run writes nothing");

  const result = await run(link.dir, ["repo", "refresh", "acme-api"]);
  assert.deepEqual(result.json.data, expected);
  const entry = (await readConfig(link.dir)).repos[0];
  assert.deepEqual(entry, { name: "acme-api", path: link.repo.root, area: AREA, patterns: ["decisions/**", "docs/**"], never_read: ["secrets/**"], commit: "", kit: { sha256: hash(canon(next)) } });
  assert.ok((await logOf(link.dir)).includes(`repo-refresh - "acme-api" sha=${sha(canon(next)).slice(0, 12)}`));
  assert.equal((await run(link.dir, ["repo", "refresh", "acme-api"])).json.data.changed, false, "a second refresh finds nothing to do");
});

test("repo refresh: adding a never-read path does not ask for a re-ingest", async (context) => {
  const link = await linked(context);
  // Adding a pattern sets reingest (cli.md §5.29), so narrowing here only adds a never-read path.
  const next = makeKit({ knowledge: { patterns: ["decisions/**"], never_read: [".env*", "secrets/**", "docs/clients/**"] } });
  await writeFile(join(link.repo.root, "brain-kit.json"), canon(next));
  const result = await run(link.dir, ["repo", "refresh", "acme-api"]);
  assert.equal(result.json.data.reingest, false);
  assert.deepEqual(result.json.data.added_patterns, []);
  assert.deepEqual(result.json.data.added_never_read, ["docs/clients/**"]);
  assert.equal(result.json.data.placement_changed, false);
});

/** A legacy link (`repo add --pattern`) ingested up to HEAD, its repo holding `files`. */
async function legacyLinked(context: TestContext, files: Record<string, string> = {}) {
  const dir = await fixtureCopy(context);
  const repo = await tempRepo(context);
  const head = await repo.commit("2026-11-01T10:00:00Z", { ...BASE_FILES, ...files });
  assert.equal((await run(dir, ["repo", "add", "acme-api", "--path", repo.root, "--area", AREA, "--pattern", "decisions/**"])).code, 0);
  assert.equal((await run(dir, ["repo", "record", "acme-api", "--commit", head])).code, 0);
  return { dir, repo, head };
}

/** Move a test repo to a new temporary folder (cleaned up after the test); returns the new path. */
async function moveRepo(context: TestContext, root: string): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), "brain-moved-"));
  context.after(() => rm(parent, { recursive: true, force: true }));
  const target = join(parent, "acme-api");
  await rename(root, target);
  return realpath(target);
}

test("repo refresh: a legacy entry adopts the kit written in its repo, keeps commit, and the next repo changes lists nothing (CC-118)", async (context) => {
  const kit = makeKit({ knowledge: { patterns: ["decisions/**", "docs/**"], never_read: ["secrets/**"] } });
  const { dir, repo, head } = await legacyLinked(context, { "brain-kit.json": canon(kit) });
  const expected = {
    name: "acme-api", changed: true, placement_changed: true, added_patterns: ["docs/**"], removed_patterns: [], added_never_read: ["secrets/**"], removed_never_read: [], reingest: true,
  };
  const before = await readFile(join(dir, "brain.json"), "utf8");
  const dry = await run(dir, ["repo", "refresh", "acme-api", "--dry-run"]);
  assert.equal(dry.code, 0, dry.stdout);
  assert.deepEqual(dry.json.data, expected);
  assert.equal(await readFile(join(dir, "brain.json"), "utf8"), before, "dry run writes nothing");

  const result = await run(dir, ["repo", "refresh", "acme-api"]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data, expected);
  assert.deepEqual((await readConfig(dir)).repos, [{
    name: "acme-api", path: repo.root, area: AREA, patterns: ["decisions/**", "docs/**"], never_read: ["secrets/**"], project: PROJECT, commit: head, kit: { sha256: hash(canon(kit)) },
  }]);
  assert.ok((await logOf(dir)).includes(`repo-refresh - "acme-api" sha=${sha(canon(kit)).slice(0, 12)}`));
  const changes = await run(dir, ["repo", "changes", "acme-api"]);
  assert.equal(changes.code, 0, changes.stdout);
  assert.deepEqual([changes.json.data.from, changedPaths(changes), changes.json.data.deleted], [head, [], []]);
  assert.equal((await run(dir, ["repo", "refresh", "acme-api"])).json.data.changed, false, "a second refresh finds nothing to do");
  assert.ok(!codes((await run(dir, ["repo", "health", "acme-api"])).json.data.repos[0].checks).includes("NO_KIT"));
});

test("repo refresh: a legacy entry's kit must carry its name (KIT_INVALID at /name), and nothing is written", async (context) => {
  const { dir } = await legacyLinked(context, { "brain-kit.json": canon(makeKit({ name: "other-api" })) });
  const before = await readFile(join(dir, "brain.json"), "utf8");
  const result = await run(dir, ["repo", "refresh", "acme-api"]);
  assert.equal(result.code, 4);
  assert.equal(result.json.error.code, "KIT_INVALID");
  assert.ok(result.json.error.details.some((problem: { pointer: string }) => problem.pointer === "/name"));
  assert.equal(await readFile(join(dir, "brain.json"), "utf8"), before);
});

test("repo refresh --path: a moved kit-linked repo takes its new path, keeps commit and kit, and the next repo changes lists nothing (CC-118)", async (context) => {
  const link = await linked(context);
  assert.equal((await run(link.dir, ["repo", "record", "acme-api", "--commit", link.head])).code, 0);
  const moved = await moveRepo(context, link.repo.root);
  assert.deepEqual(codes((await healthOf(link)).checks), ["PATH_MISSING"]);

  const expected = {
    name: "acme-api", changed: true, placement_changed: false, added_patterns: [], removed_patterns: [], added_never_read: [], removed_never_read: [], reingest: false,
  };
  const before = await readFile(join(link.dir, "brain.json"), "utf8");
  const dry = await run(link.dir, ["repo", "refresh", "acme-api", "--path", moved, "--dry-run"]);
  assert.equal(dry.code, 0, dry.stdout);
  assert.deepEqual(dry.json.data, expected);
  assert.equal(await readFile(join(link.dir, "brain.json"), "utf8"), before, "dry run writes nothing");

  const result = await run(link.dir, ["repo", "refresh", "acme-api", "--path", moved]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data, expected);
  const entry = (await readConfig(link.dir)).repos[0];
  assert.deepEqual(entry, { name: "acme-api", path: moved, area: AREA, patterns: ["decisions/**"], never_read: [".env*", "secrets/**"], project: PROJECT, commit: link.head, kit: { sha256: link.hash } });
  assert.ok((await logOf(link.dir)).includes(`repo-refresh - "acme-api" sha=${link.hash.slice(7, 19)} path=${moved}`));
  const changes = await run(link.dir, ["repo", "changes", "acme-api"]);
  assert.deepEqual([changes.json.data.from, changedPaths(changes)], [link.head, []]);
  assert.ok(!codes((await healthOf(link)).checks).includes("PATH_MISSING"));
  assert.equal((await run(link.dir, ["repo", "refresh", "acme-api", "--path", moved])).json.data.changed, false, "the same path again changes nothing");
});

test("repo refresh --path: a moved legacy repo with no kit takes its new path and stays legacy", async (context) => {
  const { dir, repo, head } = await legacyLinked(context);
  const moved = await moveRepo(context, repo.root);
  const result = await run(dir, ["repo", "refresh", "acme-api", "--path", moved]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data, {
    name: "acme-api", changed: true, placement_changed: false, added_patterns: [], removed_patterns: [], added_never_read: [], removed_never_read: [], reingest: false,
  });
  assert.deepEqual((await readConfig(dir)).repos, [{ name: "acme-api", path: moved, area: AREA, patterns: ["decisions/**"], commit: head }]);
  const log = await logOf(dir);
  assert.ok(log.includes(`repo-refresh - "acme-api" path=${moved}`));
  assert.ok(!log.includes(`repo-refresh - "acme-api" sha=`));
  assert.deepEqual(changedPaths(await run(dir, ["repo", "changes", "acme-api"])), []);
});

test("repo refresh --path: a moved legacy repo with a kit written takes both", async (context) => {
  const { dir, repo, head } = await legacyLinked(context, { "brain-kit.json": canon(makeKit()) });
  const moved = await moveRepo(context, repo.root);
  const result = await run(dir, ["repo", "refresh", "acme-api", "--path", moved]);
  assert.equal(result.code, 0, result.stdout);
  const entry = (await readConfig(dir)).repos[0];
  assert.deepEqual([entry.path, entry.commit, entry.kit], [moved, head, { sha256: hash(canon(makeKit())) }]);
});

test("repo refresh --path: a repo without the recorded commit is REPO_COMMIT_UNKNOWN, and nothing is written", async (context) => {
  const link = await linked(context);
  assert.equal((await run(link.dir, ["repo", "record", "acme-api", "--commit", link.head])).code, 0);
  const other = await tempRepo(context);
  await other.commit("2026-11-02T10:00:00Z", { ...BASE_FILES, "brain-kit.json": link.text });
  const before = await readFile(join(link.dir, "brain.json"), "utf8");
  const result = await run(link.dir, ["repo", "refresh", "acme-api", "--path", other.root]);
  assert.equal(result.code, 4);
  assert.equal(result.json.error.code, "REPO_COMMIT_UNKNOWN");
  assert.equal(await readFile(join(link.dir, "brain.json"), "utf8"), before);
});

test("repo refresh --path: the recorded commit must be an ancestor of the new HEAD", async (context) => {
  const link = await linked(context);
  const later = await link.repo.commit("2026-11-02T10:00:00Z", { "decisions/0002-two.md": "# Two\n" });
  assert.equal((await run(link.dir, ["repo", "record", "acme-api", "--commit", later])).code, 0);
  await link.repo.git("reset", "-q", "--hard", link.head);
  const result = await run(link.dir, ["repo", "refresh", "acme-api", "--path", link.repo.root]);
  assert.equal(result.json.error?.code, "REPO_COMMIT_UNKNOWN");
});

test("repo refresh --path: a relative path, a folder that is not a repo, the brain, and a kit-linked repo with no kit there are refused", async (context) => {
  const link = await linked(context);
  const before = await readFile(join(link.dir, "brain.json"), "utf8");
  const plain = await mkdtemp(join(tmpdir(), "brain-plain-"));
  context.after(() => rm(plain, { recursive: true, force: true }));
  const clone = join(await mkdtemp(join(tmpdir(), "brain-clone-")), "acme-api");
  context.after(() => rm(dirname(clone), { recursive: true, force: true }));
  await exec("git", ["clone", "-q", link.repo.root, clone]);
  await rm(join(clone, "brain-kit.json"));
  await exec("git", ["-C", link.dir, "init", "-q"]);
  const cases: [string, string][] = [["relative/acme-api", "INPUT_INVALID"], [plain, "REPO_NOT_FOUND"], [link.dir, "REPO_IS_BRAIN"], [clone, "KIT_MISSING"]];
  for (const [path, code] of cases) {
    const result = await run(link.dir, ["repo", "refresh", "acme-api", "--path", path]);
    assert.equal(result.json.error?.code, code, path);
    assert.equal(result.code, 4, path);
  }
  assert.equal(await readFile(join(link.dir, "brain.json"), "utf8"), before);
});

test("repo refresh --path: a clone of the same repo elsewhere is accepted with commit kept", async (context) => {
  const link = await linked(context);
  assert.equal((await run(link.dir, ["repo", "record", "acme-api", "--commit", link.head])).code, 0);
  const clone = join(await mkdtemp(join(tmpdir(), "brain-clone-")), "acme-api");
  context.after(() => rm(dirname(clone), { recursive: true, force: true }));
  await exec("git", ["clone", "-q", link.repo.root, clone]);
  const result = await run(link.dir, ["repo", "refresh", "acme-api", "--path", clone]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual([(await readConfig(link.dir)).repos[0].path, (await readConfig(link.dir)).repos[0].commit], [clone, link.head]);
});

// ---- repo show -------------------------------------------------------------------------------------------------

test("repo show: current, changed, missing, invalid and none", async (context) => {
  const link = await linked(context);
  const entry = (await readConfig(link.dir)).repos[0];
  const show = async () => (await run(link.dir, ["repo", "show", "acme-api"])).json.data;
  const kitFile = join(link.repo.root, "brain-kit.json");

  const current = await show();
  assert.equal(current.kit_status, "current");
  assert.deepEqual(current.entry, entry);
  assert.deepEqual(current.kit, JSON.parse(link.text));
  assert.equal(current.kit_sha256, link.hash);
  assert.equal(current.workflow, null);

  const edited = canon(makeKit({ methodology: { summary: "Edited by hand.", files: ["AGENTS.md"] } }));
  await writeFile(kitFile, edited);
  const changed = await show();
  assert.equal(changed.kit_status, "changed");
  assert.deepEqual(changed.kit, JSON.parse(edited));
  assert.equal(changed.kit_sha256, hash(edited));

  await writeFile(kitFile, '{"kit_version": 1}\n');
  const invalid = await show();
  assert.equal(invalid.kit_status, "invalid");
  assert.equal(invalid.kit, null);

  await rm(kitFile);
  const missing = await show();
  assert.equal(missing.kit_status, "missing");
  assert.equal(missing.kit, null);
});

test("repo show: a legacy entry has kit_status none and no kit", async (context) => {
  const dir = await fixtureCopy(context);
  const repo = await tempRepo(context);
  await repo.commit("2026-11-01T10:00:00Z", { "decisions/0001-one.md": "# One\n" });
  await run(dir, ["repo", "add", "legacy", "--path", repo.root, "--area", AREA, "--pattern", "decisions/*.md"]);
  const result = await run(dir, ["repo", "show", "legacy"]);
  assert.equal(result.code, 0, result.stdout);
  assert.equal(result.json.data.kit_status, "none");
  assert.equal(result.json.data.kit, null);
  assert.equal(result.json.data.workflow, null);
  assert.equal((await run(dir, ["repo", "show", "missing"])).json.error?.code, "REPO_NOT_FOUND");
});

// ---- repo tasks ------------------------------------------------------------------------------------------------

const lineKey = (title: string) => `line:${sha(title).slice(0, 12)}`;
const tasksOf = (result: any) => result.json.data;

const CHECKLIST = [
  "# Tasks", "",
  "- [ ] Write the docs",
  "  - [/] Draft the API",
  "* [x] Ship v1",
  "+ [-] Old idea",
  "- [?] Odd status",
  "- [] Not an item",
  "1. [ ] Numbered, not an item",
  "- [ab] Two characters, not an item",
  "~~~",
  "- [ ] Inside a fence",
  "~~~",
  `- [ ] ${"a".repeat(2000)}`,
  "- [ ] Write the docs",
  "- [X] Upper done",
  "",
].join("\n");

test("repo tasks: checklist parsing, status map, item keys, counts and percent", async (context) => {
  const link = await linked(context, { files: { "TASKS.md": CHECKLIST } });
  const result = await run(link.dir, ["repo", "tasks", "acme-api"]);
  assert.equal(result.code, 0, result.stdout);
  const data = tasksOf(result);
  assert.deepEqual(data.items.map((item: any) => [item.title, item.meaning]), [
    ["Write the docs", "todo"], ["Draft the API", "in_progress"], ["Ship v1", "done"], ["Old idea", "dropped"],
    ["Odd status", null], ["Write the docs", "todo"], ["Upper done", "done"],
  ]);
  assert.deepEqual(data.items.slice(0, 5).map((item: any) => item.raw), [" ", "/", "x", "-", "?"]);
  assert.deepEqual(data.items.map((item: any) => item.key), [
    lineKey("Write the docs"), lineKey("Draft the API"), lineKey("Ship v1"), lineKey("Old idea"), lineKey("Odd status"), `${lineKey("Write the docs")}#2`, lineKey("Upper done"),
  ]);
  assert.deepEqual(data.counts, { todo: 2, in_progress: 1, waiting: 0, review: 0, done: 2, dropped: 1, unmapped: 1 });
  assert.deepEqual(data.unmapped, [{ raw: "?", count: 1 }]);
  assert.equal(data.percent, 33, "2 done of 6 not dropped");
  assert.equal(data.name, "acme-api");
  assert.equal(data.as_of, NOW);
  assert.deepEqual(data.toggle.heading, "Repo tasks · acme-api");
  assert.deepEqual(result.json.warnings, []);
});

test("repo tasks: the target is the project, or the area when the kit has none", async (context) => {
  const withProject = await linked(context);
  assert.deepEqual(tasksOf(await run(withProject.dir, ["repo", "tasks", "acme-api"])).target, { project: PROJECT });
  const withoutProject = await linked(context, { kit: makeKit({ placement: { area: AREA } }) });
  assert.deepEqual(tasksOf(await run(withoutProject.dir, ["repo", "tasks", "acme-api"])).target, { area: AREA });
});

test("repo tasks: the raw status comes from HEAD, not the working tree, and a dirty tree warns REPO_DIRTY", async (context) => {
  const link = await linked(context, { files: { "TASKS.md": "- [ ] A\n" } });
  await writeFile(join(link.repo.root, "TASKS.md"), "- [x] A\n- [ ] B\n");
  const result = await run(link.dir, ["repo", "tasks", "acme-api"]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data.items.map((item: any) => [item.title, item.meaning]), [["A", "todo"]]);
  assert.deepEqual(result.json.warnings.map((warning: { code: string }) => warning.code), ["REPO_DIRTY"]);
});

test("repo tasks: a pattern source reads the id and status groups; the id is the key", async (context) => {
  const pattern = "^### (?<id>[A-Z]+-\\d+) · (?<title>.+) · `(?<status>[^`]+)`$";
  const kit = makeKit({ tasks: tasksWith({ kind: "markdown", path: "PLAN.md", format: "pattern", pattern }, { "in progress": "in_progress", done: "done", Review: "review" }) });
  const plan = ["# Plan", "### CC-1 · First thing · `done`", "text", "### CC-2 · Second thing · `In Progress`", "### CC-3 · Third · `review`", "### nothing here", "### CC-4 · Fourth · `mystery`", ""].join("\n");
  const link = await linked(context, { kit, files: { "PLAN.md": plan } });
  const data = tasksOf(await run(link.dir, ["repo", "tasks", "acme-api"]));
  assert.deepEqual(data.items.map((item: any) => [item.key, item.title, item.meaning]), [
    ["CC-1", "First thing", "done"], ["CC-2", "Second thing", "in_progress"], ["CC-3", "Third", "review"], ["CC-4", "Fourth", null],
  ]);
  assert.deepEqual(data.counts, { todo: 0, in_progress: 1, waiting: 0, review: 1, done: 1, dropped: 0, unmapped: 1 });
  assert.deepEqual(data.unmapped, [{ raw: "mystery", count: 1 }]);
});

test("repo tasks: a pattern without a status group has raw status '' and needs the kit to map it", async (context) => {
  const kit = makeKit({ tasks: tasksWith({ kind: "markdown", path: "PLAN.md", format: "pattern", pattern: "^## (?<title>.+)$" }, { "": "todo" }) });
  const link = await linked(context, { kit, files: { "PLAN.md": "## One\n## Two\ntext\n" } });
  const data = tasksOf(await run(link.dir, ["repo", "tasks", "acme-api"]));
  assert.deepEqual(data.items.map((item: any) => [item.title, item.raw, item.meaning, item.key]), [
    ["One", "", "todo", lineKey("One")], ["Two", "", "todo", lineKey("Two")],
  ]);
});

test("repo tasks: percent is null when there are no non-dropped items", async (context) => {
  const link = await linked(context, { files: { "TASKS.md": "- [-] Gone\n" } });
  const data = tasksOf(await run(link.dir, ["repo", "tasks", "acme-api"]));
  assert.equal(data.percent, null);
  assert.equal(data.counts.dropped, 1);
  assert.ok(!data.toggle.markdown.includes("%"));
});

test("repo tasks: the toggle text of a small case is exactly the one of linked-repos.md §4", async (context) => {
  const link = await linked(context, { files: { "TASKS.md": "- [/] Build it\n- [ ] Plan it\n- [x] Ship it\n" } });
  const result = await run(link.dir, ["repo", "tasks", "acme-api"], "2026-11-03T14:20:00Z");
  assert.equal(result.code, 0, result.stdout);
  assert.equal(result.json.data.as_of, "2026-11-03T14:20:00Z");
  assert.equal(result.json.data.toggle.markdown.trimEnd(), [
    "As of 3 Nov 2026, 14:20 · from acme-api (TASKS.md) · read-only",
    "1 completed · 2 open (1 in progress, 1 to do) · 33%",
    "- In progress: Build it",
    "- To do: Plan it",
  ].join("\n"));
});

test("repo tasks: the toggle lists at most 20 open items and then says how many more", async (context) => {
  const lines = Array.from({ length: 25 }, (_, index) => `- [ ] Item ${index + 1}`).join("\n");
  const link = await linked(context, { files: { "TASKS.md": `${lines}\n` } });
  const markdown: string = tasksOf(await run(link.dir, ["repo", "tasks", "acme-api"])).toggle.markdown;
  assert.equal(markdown.split("\n").filter((line) => line.startsWith("- To do:")).length, 20);
  assert.ok(markdown.split("\n").includes("…and 5 more open"));
  assert.ok(markdown.includes("- To do: Item 1\n"));
  assert.ok(!markdown.includes("Item 21"));
});

test("repo tasks: unmapped statuses are counted, listed in the data and in the toggle's Not mapped line", async (context) => {
  const link = await linked(context, { files: { "TASKS.md": "- [?] One\n- [?] Two\n- [!] Three\n- [x] Four\n" } });
  const data = tasksOf(await run(link.dir, ["repo", "tasks", "acme-api"]));
  assert.equal(data.counts.unmapped, 3);
  assert.deepEqual([...data.unmapped].sort((a: any, b: any) => a.raw.localeCompare(b.raw)), [{ raw: "!", count: 1 }, { raw: "?", count: 2 }]);
  assert.ok(data.toggle.markdown.includes('Not mapped: "?" (2). Map it in brain-kit.json.'));
  assert.ok(data.toggle.markdown.includes('Not mapped: "!" (1). Map it in brain-kit.json.'));
  assert.ok(/\b3 open\b/.test(data.toggle.markdown), "the open count includes unmapped items");
});

test("repo tasks: a file with no tasks says no tasks found", async (context) => {
  const link = await linked(context, { files: { "TASKS.md": "# Tasks\n\nNothing yet.\n" } });
  const data = tasksOf(await run(link.dir, ["repo", "tasks", "acme-api"], "2026-11-03T14:20:00Z"));
  assert.deepEqual(data.items, []);
  assert.equal(data.percent, null);
  assert.deepEqual(data.counts, { todo: 0, in_progress: 0, waiting: 0, review: 0, done: 0, dropped: 0, unmapped: 0 });
  assert.equal(data.toggle.markdown.trimEnd(), "As of 3 Nov 2026, 14:20 · from acme-api (TASKS.md) · no tasks found");
});

const GITHUB_KIT = () => makeKit({ tasks: tasksWith({ kind: "github", repo: "acme/acme-api" }, { "label:blocked": "waiting", "label:in progress": "in_progress" }) });
const ISSUES = {
  fetched_at: "2026-11-03T14:20:00Z",
  items: [
    { number: 12, title: "Fix cache", state: "open", labels: ["bug", "blocked", "in progress"], url: "https://github.com/acme/acme-api/issues/12" },
    { number: 13, title: "Add docs", state: "open", labels: [], url: "https://github.com/acme/acme-api/issues/13" },
    { number: 14, title: "Old bug", state: "closed", state_reason: "completed", labels: ["blocked"], url: "https://github.com/acme/acme-api/issues/14" },
    { number: 15, title: "Quiet close", state: "closed", labels: ["in progress"], url: "https://github.com/acme/acme-api/issues/15" },
    { number: 16, title: "Not planned", state: "closed", state_reason: "not_planned", labels: [], url: "https://github.com/acme/acme-api/issues/16" },
    { number: 17, title: "Working", state: "open", labels: ["in progress"], url: "https://github.com/acme/acme-api/issues/17" },
  ],
};

test("repo tasks (GitHub): meanings, labels, keys, counts, as_of and the exact toggle with linked titles", async (context) => {
  const link = await linked(context, { kit: GITHUB_KIT() });
  const input = await inputFile(link.dir, JSON.stringify(ISSUES));
  const result = await run(link.dir, ["repo", "tasks", "acme-api", "--input", input]);
  assert.equal(result.code, 0, result.stdout);
  const data = tasksOf(result);
  assert.deepEqual(data.items.map((item: any) => [item.key, item.title, item.meaning, item.url]), [
    ["#12", "Fix cache", "waiting", ISSUES.items[0].url], ["#13", "Add docs", "todo", ISSUES.items[1].url], ["#14", "Old bug", "done", ISSUES.items[2].url],
    ["#15", "Quiet close", "done", ISSUES.items[3].url], ["#16", "Not planned", "dropped", ISSUES.items[4].url], ["#17", "Working", "in_progress", ISSUES.items[5].url],
  ]);
  assert.deepEqual([2, 3, 4].map((index) => data.items[index].raw), ["closed:completed", "closed:completed", "closed:not_planned"], "a closed issue ignores labels; no reason is completed");
  assert.equal(data.items[1].raw, "open");
  assert.deepEqual(data.counts, { todo: 1, in_progress: 1, waiting: 1, review: 0, done: 2, dropped: 1, unmapped: 0 });
  assert.equal(data.percent, 40);
  assert.equal(data.as_of, ISSUES.fetched_at);
  assert.equal(data.toggle.markdown.trimEnd(), [
    "As of 3 Nov 2026, 14:20 · from acme-api (GitHub acme/acme-api) · read-only",
    "2 completed · 1 dropped · 3 open (1 in progress, 1 waiting, 1 to do) · 40%",
    "- In progress: [Working](https://github.com/acme/acme-api/issues/17)",
    "- Waiting: [Fix cache](https://github.com/acme/acme-api/issues/12)",
    "- To do: [Add docs](https://github.com/acme/acme-api/issues/13)",
  ].join("\n"));
});

test("repo tasks (GitHub): with 1000 items the first line ends with ' · first 1000 issues'", async (context) => {
  const link = await linked(context, { kit: GITHUB_KIT() });
  const items = Array.from({ length: 1000 }, (_, index) => ({ number: index + 1, title: `Issue ${index + 1}`, state: "closed", state_reason: "completed", labels: [], url: `https://github.com/acme/acme-api/issues/${index + 1}` }));
  const input = await inputFile(link.dir, JSON.stringify({ fetched_at: ISSUES.fetched_at, items }));
  const data = tasksOf(await run(link.dir, ["repo", "tasks", "acme-api", "--input", input]));
  assert.equal(data.items.length, 1000);
  assert.ok(data.toggle.markdown.split("\n")[0].endsWith(" · first 1000 issues"));
  const small = tasksOf(await run(link.dir, ["repo", "tasks", "acme-api", "--input", await inputFile(link.dir, JSON.stringify(ISSUES))]));
  assert.ok(!small.toggle.markdown.includes("first 1000 issues"));
});

test("repo tasks (GitLab): opened and closed map by default and the source label is GitLab group/name", async (context) => {
  const kit = makeKit({ tasks: tasksWith({ kind: "gitlab", project: "acme/platform/api" }) });
  const link = await linked(context, { kit });
  const input = await inputFile(link.dir, JSON.stringify({
    fetched_at: ISSUES.fetched_at,
    items: [{ number: 3, title: "Open one", state: "opened", labels: [], url: "https://gitlab.example/acme/platform/api/-/issues/3" }, { number: 4, title: "Shut one", state: "closed", labels: [], url: "https://gitlab.example/acme/platform/api/-/issues/4" }],
  }));
  const result = await run(link.dir, ["repo", "tasks", "acme-api", "--input", input]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data.items.map((item: any) => [item.key, item.meaning]), [["#3", "todo"], ["#4", "done"]]);
  assert.ok(result.json.data.toggle.markdown.split("\n")[0].includes("(GitLab acme/platform/api)"));
});

test("repo tasks: a GitHub source without --input is USAGE", async (context) => {
  const link = await linked(context, { kit: GITHUB_KIT() });
  assert.equal((await run(link.dir, ["repo", "tasks", "acme-api"])).json.error?.code, "USAGE");
});

test("repo tasks: refuses a legacy entry (NO_KIT), a connected kit (MODE_CONNECTED) and a kit without tasks (NO_TASKS), all exit 4", async (context) => {
  const dir = await fixtureCopy(context);
  const legacyRepo = await tempRepo(context);
  await legacyRepo.commit("2026-11-01T10:00:00Z", { "decisions/0001-one.md": "# One\n" });
  await run(dir, ["repo", "add", "legacy", "--path", legacyRepo.root, "--area", AREA, "--pattern", "decisions/*.md"]);
  const legacy = await run(dir, ["repo", "tasks", "legacy"]);
  assert.deepEqual([legacy.code, legacy.json.error.code], [4, "NO_KIT"]);

  const connected = await linked(context, { dir, kit: makeKit({ name: "connected-one", tasks: { mode: "connected", source: { kind: "notion" } } }) });
  const connectedResult = await run(connected.dir, ["repo", "tasks", "connected-one"]);
  assert.deepEqual([connectedResult.code, connectedResult.json.error.code], [4, "MODE_CONNECTED"]);

  const { tasks: _tasks, ...knowledgeOnly } = makeKit({ name: "plain-one" });
  await linked(context, { dir, kit: knowledgeOnly });
  const none = await run(dir, ["repo", "tasks", "plain-one"]);
  assert.deepEqual([none.code, none.json.error.code], [4, "NO_TASKS"]);
});

// ---- repo health -----------------------------------------------------------------------------------------------

test("repo health: a clean, recorded repo has no checks and exits 0", async (context) => {
  const link = await linked(context);
  assert.equal((await run(link.dir, ["repo", "record", "acme-api", "--commit", link.head])).code, 0);
  const result = await healthOf(link);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.checks, []);
});

test("repo health: a repo folder that is gone gives PATH_MISSING alone and exit 1", async (context) => {
  const link = await linked(context);
  await rm(link.repo.root, { recursive: true, force: true });
  const result = await healthOf(link);
  assert.equal(result.code, 1);
  assert.deepEqual(codes(result.checks), ["PATH_MISSING"]);
  assert.equal(result.checks[0].severity, "error");
});

test("repo health: a kit edited by hand is KIT_CHANGED (warning)", async (context) => {
  const link = await linked(context);
  await writeFile(join(link.repo.root, "brain-kit.json"), `${link.text}\n`);
  const result = await healthOf(link);
  const check = result.checks.find((entry) => entry.code === "KIT_CHANGED");
  assert.equal(check?.severity, "warning");
  assert.equal(result.code, 0, "warnings alone do not fail");
});

test("repo health: a kit that is not tracked, or differs from HEAD, is KIT_UNCOMMITTED (info)", async (context) => {
  const untracked = await linked(context, { commitKit: false });
  const first = await healthOf(untracked);
  assert.equal(first.checks.find((entry) => entry.code === "KIT_UNCOMMITTED")?.severity, "info");
  const tracked = await linked(context);
  assert.ok(!codes((await healthOf(tracked)).checks).includes("KIT_UNCOMMITTED"));
  await writeFile(join(tracked.repo.root, "brain-kit.json"), `${tracked.text}\n`);
  assert.ok(codes((await healthOf(tracked)).checks).includes("KIT_UNCOMMITTED"));
});

test("repo health: KIT_MISSING and KIT_INVALID are errors and skip the checks that read the kit", async (context) => {
  const link = await linked(context);
  await rm(join(link.repo.root, "brain-kit.json"));
  const missing = await healthOf(link);
  assert.equal(missing.code, 1);
  assert.ok(codes(missing.checks).includes("KIT_MISSING"));
  assert.ok(!codes(missing.checks).includes("KIT_CHANGED"));
  await writeFile(join(link.repo.root, "brain-kit.json"), '{"kit_version": 1}\n');
  const invalid = await healthOf(link);
  assert.equal(invalid.code, 1);
  assert.ok(codes(invalid.checks).includes("KIT_INVALID"));
  assert.ok(!codes(invalid.checks).includes("TASK_SOURCE_MISSING"));
});

test("repo health: a legacy entry gets NO_KIT (info) and exits 0", async (context) => {
  const dir = await fixtureCopy(context);
  const repo = await tempRepo(context);
  const head = await repo.commit("2026-11-01T10:00:00Z", { "decisions/0001-one.md": "# One\n" });
  await run(dir, ["repo", "add", "legacy", "--path", repo.root, "--area", AREA, "--pattern", "decisions/*.md"]);
  await run(dir, ["repo", "record", "legacy", "--commit", head]);
  const result = await run(dir, ["repo", "health", "legacy"]);
  assert.equal(result.code, 0, result.stdout);
  const checks = result.json.data.repos[0].checks as { code: string; severity: string }[];
  assert.deepEqual(checks.map((check) => [check.code, check.severity]), [["NO_KIT", "info"]]);
});

test("repo health: ROLLUP_STALE when a commit touching the task file is newer than --rollup-as-of; skipped without the option", async (context) => {
  const link = await linked(context);
  await run(link.dir, ["repo", "record", "acme-api", "--commit", link.head]);
  await link.repo.commit("2026-11-05T10:00:00Z", { "TASKS.md": "- [ ] First\n- [ ] Second\n" });
  const stale = await healthOf(link, ["--rollup-as-of", "2026-11-04T00:00:00Z"]);
  assert.equal(stale.checks.find((entry) => entry.code === "ROLLUP_STALE")?.severity, "warning");
  assert.ok(!codes((await healthOf(link, ["--rollup-as-of", "2026-11-06T00:00:00Z"])).checks).includes("ROLLUP_STALE"), "newer rollup");
  assert.ok(!codes((await healthOf(link)).checks).includes("ROLLUP_STALE"), "no option, no check");
});

test("repo health: ROLLUP_STALE for issues when the rollup is more than 24 hours older than now", async (context) => {
  const link = await linked(context, { kit: makeKit({ tasks: tasksWith({ kind: "github", repo: "acme/acme-api" }) }) });
  assert.ok(codes((await healthOf(link, ["--rollup-as-of", "2026-12-08T09:00:00Z"])).checks).includes("ROLLUP_STALE"));
  assert.ok(!codes((await healthOf(link, ["--rollup-as-of", "2026-12-10T08:00:00Z"])).checks).includes("ROLLUP_STALE"));
});

test("repo health: PATTERN_MATCHES_NOTHING is one warning for each pattern that matches no file at HEAD", async (context) => {
  const kit = makeKit({ knowledge: { patterns: ["decisions/**", "nothing/**", "also-nothing/*.md"], never_read: [".env*"] } });
  const link = await linked(context, { kit });
  const result = await healthOf(link);
  const matching = result.checks.filter((entry) => entry.code === "PATTERN_MATCHES_NOTHING");
  assert.equal(matching.length, 2);
  assert.ok(matching.every((entry) => entry.severity === "warning"));
});

test("repo health: TASK_SOURCE_MISSING (error) when the markdown source is not at HEAD", async (context) => {
  const link = await linked(context, { kit: makeKit({ tasks: tasksWith({ kind: "markdown", path: "PLAN.md", format: "checklist" }) }) });
  const result = await healthOf(link);
  assert.equal(result.code, 1);
  assert.equal(result.checks.find((entry) => entry.code === "TASK_SOURCE_MISSING")?.severity, "error");
});

test("repo health: METHODOLOGY_FILE_MISSING (warning) when a methodology file is not at HEAD", async (context) => {
  const link = await linked(context, { kit: makeKit({ methodology: { summary: "x", files: ["AGENTS.md", "docs/process.md"] } }) });
  const result = await healthOf(link);
  assert.equal(result.checks.filter((entry) => entry.code === "METHODOLOGY_FILE_MISSING").length, 1);
});

test("repo health: STATUS_UNMAPPED (warning) for a markdown source with a raw status nothing maps", async (context) => {
  const link = await linked(context, { files: { "TASKS.md": "- [ ] Fine\n- [?] Odd\n" } });
  const result = await healthOf(link);
  assert.equal(result.checks.find((entry) => entry.code === "STATUS_UNMAPPED")?.severity, "warning");
  const clean = await linked(context, { files: { "TASKS.md": "- [ ] Fine\n" } });
  assert.ok(!codes((await healthOf(clean)).checks).includes("STATUS_UNMAPPED"));
});

test("repo health: STATUS_UNMAPPED for GitHub needs --input issue data", async (context) => {
  const link = await linked(context, { kit: makeKit({ tasks: tasksWith({ kind: "github", repo: "acme/acme-api" }) }) });
  assert.ok(!codes((await healthOf(link)).checks).includes("STATUS_UNMAPPED"));
  const input = await inputFile(link.dir, JSON.stringify({ fetched_at: ISSUES.fetched_at, items: [{ number: 1, title: "A", state: "open", labels: [], url: "https://github.com/acme/acme-api/issues/1" }] }));
  assert.ok(!codes((await healthOf(link, ["--input", input])).checks).includes("STATUS_UNMAPPED"), "open is mapped by default");
});

test("repo health: COMMIT_UNKNOWN (error) when the recorded commit is not an ancestor of HEAD", async (context) => {
  const link = await linked(context);
  const second = await link.repo.commit("2026-11-02T10:00:00Z", { "decisions/0002-two.md": "# Two\n" });
  await run(link.dir, ["repo", "record", "acme-api", "--commit", second]);
  await link.repo.git("reset", "-q", "--hard", link.head);
  await link.repo.commit("2026-11-03T10:00:00Z", { "decisions/0003-three.md": "# Three\n" });
  const result = await healthOf(link);
  assert.equal(result.code, 1);
  assert.equal(result.checks.find((entry) => entry.code === "COMMIT_UNKNOWN")?.severity, "error");
});

test("repo health: CHANGES_WAITING (info) while files changed since the last ingest", async (context) => {
  const link = await linked(context);
  assert.equal((await healthOf(link)).checks.find((entry) => entry.code === "CHANGES_WAITING")?.severity, "info");
  await run(link.dir, ["repo", "record", "acme-api", "--commit", link.head]);
  assert.ok(!codes((await healthOf(link)).checks).includes("CHANGES_WAITING"));
});

test("repo health: NEVER_READ_INGESTED (warning) for a source whose repo_path never_read now matches", async (context) => {
  const link = await linked(context, { files: { "secrets/key.md": "k\n" } });
  await addSource(link.dir, "acme-api", "secrets/key.md", link.head);
  await addSource(link.dir, "acme-api", "decisions/0001-one.md", link.head);
  const result = await healthOf(link);
  const matching = result.checks.filter((entry) => entry.code === "NEVER_READ_INGESTED");
  assert.equal(matching.length, 1);
  assert.equal(matching[0].severity, "warning");
});

test("repo health: the checks come in the order of the table of linked-repos.md §6", async (context) => {
  const kit = makeKit({
    knowledge: { patterns: ["decisions/**", "nothing/**"], never_read: [".env*"] },
    tasks: tasksWith({ kind: "markdown", path: "PLAN.md", format: "checklist" }),
    methodology: { summary: "x", files: ["docs/process.md"] },
  });
  const link = await linked(context, { kit });
  await writeFile(join(link.repo.root, "brain-kit.json"), `${link.text}\n`);
  const result = await healthOf(link);
  assert.deepEqual(codes(result.checks), ["KIT_CHANGED", "KIT_UNCOMMITTED", "CHANGES_WAITING", "PATTERN_MATCHES_NOTHING", "METHODOLOGY_FILE_MISSING", "TASK_SOURCE_MISSING"]);
});

test("repo health without a name checks every repo, in brain.json order", async (context) => {
  const first = await linked(context, { kit: makeKit({ name: "zeta-repo" }) });
  await linked(context, { dir: first.dir, kit: makeKit({ name: "alpha-repo" }) });
  const result = await run(first.dir, ["repo", "health"]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data.repos.map((entry: { name: string }) => entry.name), ["zeta-repo", "alpha-repo"]);
  assert.ok(result.json.data.repos.every((entry: { checks: unknown[] }) => Array.isArray(entry.checks)));
});

test("repo health --input needs a name", async (context) => {
  const link = await linked(context, { kit: GITHUB_KIT() });
  const input = await inputFile(link.dir, JSON.stringify(ISSUES));
  assert.equal((await run(link.dir, ["repo", "health", "--input", input])).json.error?.code, "USAGE");
});

// ---- repo unlink -----------------------------------------------------------------------------------------------

test("repo unlink removes the entry, keeps the repos key and the knowledge, leaves the repo alone, counts sources and logs", async (context) => {
  const link = await linked(context);
  await addSource(link.dir, "acme-api", "decisions/0001-one.md", link.head);
  const sourceDir = join(link.dir, "sources");
  const readSources = async () => {
    const out: Record<string, string> = {};
    for (const month of await readdir(sourceDir)) for (const file of await readdir(join(sourceDir, month)).catch(() => [])) out[`${month}/${file}`] = await readFile(join(sourceDir, month, file), "utf8");
    return out;
  };
  const entry = (await readConfig(link.dir)).repos[0];
  const sourcesBefore = await readSources();
  assert.ok(Object.keys(sourcesBefore).length >= 2);

  const result = await run(link.dir, ["repo", "unlink", "acme-api"]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data, { name: "acme-api", removed: entry, sources: 1, workflow: null });
  assert.deepEqual((await readConfig(link.dir)).repos, []);
  assert.deepEqual(await readSources(), sourcesBefore);
  assert.equal(await readFile(join(link.repo.root, "brain-kit.json"), "utf8"), link.text);
  assert.equal(await link.repo.git("status", "--porcelain"), "");
  assert.ok((await logOf(link.dir)).includes('repo-unlink - "acme-api"'));
  assert.equal((await run(link.dir, ["repo", "unlink", "acme-api"])).json.error?.code, "REPO_NOT_FOUND");
});

// ---- repo new --------------------------------------------------------------------------------------------------

const NEW_KIT = (over: Record<string, unknown> = {}) => makeKit({
  knowledge: { patterns: ["decisions/**", "docs/**", "README.md"], never_read: [".env*", "secrets/**"] },
  tasks: tasksWith(checklist),
  methodology: { summary: "Record decisions in decisions/ before acting on them; plans in docs/; tasks in TASKS.md.", files: ["AGENTS.md"] },
  ...over,
});
const withStarter = (kit: any) => ({ ...kit, starter: { name: "generic", version: VERSION } });

async function newCase(context: TestContext, kit: any = NEW_KIT()) {
  const dir = await fixtureCopy(context);
  const parent = await mkdtemp(join(tmpdir(), "brain-new-"));
  context.after(() => rm(parent, { recursive: true, force: true }));
  const target = join(parent, "acme-api");
  const input = await inputFile(dir, scrambled(kit));
  const expectedKit = canon(withStarter(kit));
  const createBare = (extra: string[], path = target, starter = "generic") =>
    run(dir, ["repo", "new", "--path", path, "--starter", starter, "--input", input, ...extra]);
  // A synthetic identity for the starter's commit: CI has no Git user (the no-identity case uses createBare).
  const create = async (extra: string[], path = target, starter = "generic") => {
    const identity: Record<string, string> = { GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.com" };
    const saved = Object.fromEntries(Object.keys(identity).map((key) => [key, process.env[key]]));
    Object.assign(process.env, identity);
    try { return await createBare(extra, path, starter); } finally {
      for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    }
  };
  return { dir, parent, target, input, expectedKit, confirm: hash(expectedKit), create, createBare };
}
const exists = (path: string) => readFile(path).then(() => true, () => false);

test("repo new writes exactly the starter's files with the placeholders filled, and the kit with the starter set", async (context) => {
  const kit = NEW_KIT();
  const { create, target, confirm, expectedKit } = await newCase(context, kit);
  const result = await create(["--confirm", confirm]);
  assert.equal(result.code, 0, result.stdout);
  const summary = kit.methodology.summary;
  const expected: Record<string, string> = {
    "README.md": `# acme-api\n\n${summary}\n`,
    "AGENTS.md": `# How work is done here\n\n${summary}\n\n- Record a decision in decisions/ (copy decisions/_template.md) before acting on it.\n- Plans and notes go in docs/.\n- Tasks are in TASKS.md: one line "- [ ] title" each; "[x]" when done.\n- Never put secrets in this repo: .env files and secrets/ are ignored.\n`,
    "CLAUDE.md": "@AGENTS.md\n",
    "decisions/_template.md": "# NNNN — Title\n\n**Status:** Proposed\n**Date:** YYYY-MM-DD\n\n## Context\n## Decision\n## Consequences\n",
    "docs/README.md": "Plans, notes and documents for acme-api.\n",
    "TASKS.md": "# Tasks\n\n- [ ] First task\n",
    ".gitignore": ".env*\nsecrets/\n",
    "brain-kit.json": expectedKit,
  };
  for (const [file, text] of Object.entries(expected)) assert.equal(await readFile(join(target, file), "utf8"), text, file);
  assert.deepEqual(result.json.data.files, Object.keys(expected).sort());
  assert.equal(result.json.data.sha256, confirm);
  assert.ok([target, await realpath(target)].includes(result.json.data.path_abs), result.json.data.path_abs);
  assert.equal(JSON.parse(await readFile(join(target, "brain-kit.json"), "utf8")).starter.version, VERSION);
});

test("repo new runs git init and makes one commit with the starter's message; the tree is clean", async (context) => {
  const { create, target, confirm, dir } = await newCase(context);
  const result = await create(["--confirm", confirm]);
  assert.equal(result.code, 0, result.stdout);
  const git = async (...args: string[]) => (await exec("git", ["-C", target, ...args])).stdout.trim();
  assert.equal(await git("rev-list", "--count", "HEAD"), "1");
  assert.equal(await git("log", "-1", "--format=%s"), "Start from the Ultimate Brain generic starter");
  assert.equal(await git("status", "--porcelain"), "");
  const full = await git("rev-parse", "HEAD");
  assert.ok(result.json.data.commit.length >= 7 && full.startsWith(result.json.data.commit), result.json.data.commit);
  assert.deepEqual(result.json.warnings, []);
  assert.ok((await logOf(dir)).includes('repo-new - "acme-api"'));
  assert.equal((await readConfig(dir)).repos, undefined, "it doesn't link the repo");
});

test("repo new: the starter's kit passes repo kit check, and the repo can be linked with repo add --kit", async (context) => {
  const { create, target, confirm, dir } = await newCase(context);
  assert.equal((await create(["--confirm", confirm])).code, 0);
  const check = await run(dir, ["repo", "kit", "check", "--path", target]);
  assert.deepEqual(check.json.data.problems, []);
  assert.equal((await run(dir, ["repo", "add", "acme-api", "--path", target, "--kit"])).code, 0);
});

test("repo new: connected and knowledge-only kits write no TASKS.md and the matching AGENTS.md line", async (context) => {
  const connected = await newCase(context, NEW_KIT({ tasks: { mode: "connected", source: { kind: "notion" } } }));
  assert.equal((await connected.create(["--confirm", connected.confirm])).code, 0);
  assert.equal(await exists(join(connected.target, "TASKS.md")), false);
  assert.ok((await readFile(join(connected.target, "AGENTS.md"), "utf8")).includes("\n- Tasks are in Notion, through the connected workflow.\n"));

  const { tasks: _tasks, ...rest } = NEW_KIT();
  const plain = await newCase(context, rest);
  await mkdir(plain.target); // an empty folder is fine
  const result = await plain.create(["--confirm", plain.confirm]);
  assert.equal(result.code, 0, result.stdout);
  assert.equal(await exists(join(plain.target, "TASKS.md")), false);
  assert.ok((await readFile(join(plain.target, "AGENTS.md"), "utf8")).includes("\n- This repo tracks no tasks.\n"));
  assert.ok(!result.json.data.files.includes("TASKS.md"));
});

test("repo new: --confirm is required and is checked on the kit bytes with the starter set", async (context) => {
  const { create, target, input, dir } = await newCase(context);
  const required = await create([]);
  assert.equal(required.json.error?.code, "CONFIRMATION_REQUIRED");
  const withoutStarter = await create(["--confirm", hash(canon(NEW_KIT()))]);
  assert.equal(withoutStarter.json.error?.code, "CONFIRMATION_MISMATCH", "the hash of the input, not of the file it writes");
  assert.equal(await exists(target), false, "nothing created");
  assert.ok(input && dir);
});

test("repo new: refuses a non-empty folder, a path inside the brain, another starter and an invalid kit", async (context) => {
  const { create, target, confirm, dir, parent } = await newCase(context);
  await mkdir(target);
  await writeFile(join(target, "keep.txt"), "mine\n");
  assert.equal((await create(["--confirm", confirm])).json.error?.code, "TARGET_NOT_EMPTY");
  assert.equal(await readFile(join(target, "keep.txt"), "utf8"), "mine\n");

  const inside = await create(["--confirm", confirm], join(dir, "inner-repo"));
  assert.equal(inside.json.error?.code, "OUTSIDE_ROOT");
  assert.equal(await exists(join(dir, "inner-repo", "brain-kit.json")), false);

  const fresh = join(parent, "fresh");
  const starter = await create(["--confirm", confirm], fresh, "other");
  assert.equal(starter.json.error?.code, "USAGE");
  assert.equal(await exists(fresh), false);

  const invalid = await newCase(context, NEW_KIT({ placement: { area: "area-00000000" } }));
  assert.equal((await invalid.create(["--confirm", invalid.confirm])).json.error?.code, "KIT_INVALID");
  assert.equal(await exists(invalid.target), false);
});

test("repo new: tracked-in-repo needs the TASKS.md checklist source (KIT_INVALID otherwise)", async (context) => {
  const kit = NEW_KIT({ tasks: tasksWith({ kind: "markdown", path: "build/TASKS.md", format: "checklist" }) });
  const { create, confirm, target } = await newCase(context, kit);
  const result = await create(["--confirm", confirm]);
  assert.equal(result.code, 4);
  assert.equal(result.json.error.code, "KIT_INVALID");
  assert.equal(await exists(target), false);
  const github = await newCase(context, NEW_KIT({ tasks: tasksWith({ kind: "github", repo: "acme/acme-api" }) }));
  assert.equal((await github.create(["--confirm", github.confirm])).json.error?.code, "KIT_INVALID");
});

test("repo new: without a Git identity the commit is skipped with GIT_COMMIT_SKIPPED and the files stay", async (context) => {
  // Depends on the CLI's git inheriting process.env; if the implementation scrubs the environment this case cannot be isolated.
  const home = await mkdtemp(join(tmpdir(), "brain-nohome-"));
  context.after(() => rm(home, { recursive: true, force: true }));
  const empty = join(home, "gitconfig");
  await writeFile(empty, "");
  const keys = ["HOME", "XDG_CONFIG_HOME", "GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "GIT_CONFIG_NOSYSTEM", "GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0",
    "GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL", "EMAIL"];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const { createBare: create, target, confirm } = await newCase(context);
  try {
    for (const key of ["GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL", "EMAIL"]) delete process.env[key];
    Object.assign(process.env, { HOME: home, XDG_CONFIG_HOME: home, GIT_CONFIG_GLOBAL: empty, GIT_CONFIG_SYSTEM: empty, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "user.useConfigOnly", GIT_CONFIG_VALUE_0: "true" });
    const result = await create(["--confirm", confirm]);
    assert.equal(result.code, 0, result.stdout);
    assert.deepEqual(result.json.warnings.map((warning: { code: string }) => warning.code), ["GIT_COMMIT_SKIPPED"]);
    assert.equal(result.json.data.commit, null);
    assert.equal(await exists(join(target, "brain-kit.json")), true);
    assert.ok(result.json.data.files.includes("brain-kit.json"));
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

void GOAL;

// ---- path patterns (linked-repos.md §2.1a) ------------------------------------------------------------------------

test("globMatch agrees with git ls-files -- ':(glob)<pattern>' on a fixture tree", async (context) => {
  const repo = await tempRepo(context);
  const files = ["README.md", ".env", ".env.local", "a/.env", "a/[x].md", "a/b.md", "docs/a.md", "docs/x/c.txt", "docs/x/y/b.md", "secrets/k", "CHANGELOG.md", "decisions/0001-one.md"];
  await repo.commit("2026-11-01T10:00:00Z", Object.fromEntries(files.map((file) => [file, `${file}\n`])));
  const patterns = ["docs", "docs/", "docs/**", "**/.env*", ".env*", "docs/**/*.md", "docs/*", "*.md", "do**s/a.md", "docs/x", "**", "a/[x].md", "a/[!x]*", "a/?.md", "**/*.md", "docs/**/y/*.md", "secrets/**", "d*", "docs/x*", "decisions/**", "CHANGELOG.md", "*/b.md"];
  for (const pattern of patterns) {
    const expected = (await repo.git("ls-files", "--", `:(glob)${pattern}`)).split("\n").filter(Boolean).sort();
    assert.deepEqual(files.filter((file) => globMatch(pattern, file)).sort(), expected, pattern);
  }
});
