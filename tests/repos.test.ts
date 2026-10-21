import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";
import { promisify } from "node:util";

import { brain, fixtureCopy } from "./helpers.ts";

const exec = promisify(execFile);
const NOW = "2026-12-10T09:00:00Z";
const AREA = "area-2m7c4h8n";

async function run(dir: string, args: string[]) {
  return brain([...args, "--brain", dir, "--now", NOW, "--json"]);
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

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

test("repo add links a repo to an area; status lists it; bad input is refused", async (context) => {
  const dir = await fixtureCopy(context);
  const repo = await tempRepo(context);
  await repo.commit("2026-11-01T10:00:00Z", { "decisions/0001-one.md": "# One\n" });

  const added = await run(dir, ["repo", "add", "product", "--path", repo.root, "--area", AREA, "--pattern", "decisions/*.md", "--pattern", "docs/vision.md"]);
  assert.equal(added.code, 0, added.stdout);
  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  assert.deepEqual(config.repos, [{ name: "product", path: repo.root, area: AREA, patterns: ["decisions/*.md", "docs/vision.md"], commit: "" }]);
  assert.ok((await readFile(join(dir, "log/2026-12.md"), "utf8")).includes('repo-add - "product"'));
  const status = await run(dir, ["status"]);
  assert.deepEqual(status.json.data.repos, [{ name: "product", area: AREA, commit: "", found: true }]);

  const code = async (...args: string[]) => (await run(dir, ["repo", "add", ...args])).json.error?.code;
  assert.equal(await code("product", "--path", repo.root, "--area", AREA, "--pattern", "*.md"), "INPUT_INVALID", "name in use");
  assert.equal(await code("Product-API", "--path", repo.root, "--area", AREA, "--pattern", "*.md"), "INPUT_INVALID", "not kebab-case");
  assert.equal(await code("other", "--path", repo.root, "--area", "area-00000000", "--pattern", "*.md"), "UNKNOWN_ID");
  assert.equal(await code("other", "--path", repo.root, "--area", AREA), "USAGE", "no pattern");
  assert.equal(await code("other", "--path", join(repo.root, "decisions"), "--area", AREA, "--pattern", "*.md"), "REPO_NOT_FOUND", "not the top of the tree");
  assert.equal(await code("other", "--path", join(repo.root, "missing"), "--area", AREA, "--pattern", "*.md"), "REPO_NOT_FOUND");
  assert.equal(await code("other", "--path", "relative/path", "--area", AREA, "--pattern", "*.md"), "INPUT_INVALID");

  await rm(repo.root, { recursive: true, force: true });
  assert.deepEqual((await run(dir, ["status"])).json.data.repos, [{ name: "product", area: AREA, commit: "", found: false }]);
});

test("repo add refuses the brain itself, also through a symbolic link", async (context) => {
  const dir = await fixtureCopy(context);
  await exec("git", ["-C", dir, "init", "-q"]);
  assert.equal((await run(dir, ["repo", "add", "self", "--path", dir, "--area", AREA, "--pattern", "*.md"])).json.error?.code, "REPO_IS_BRAIN");
  const link = join(dirname(dir), "brain-link");
  await symlink(dir, link);
  assert.equal((await run(dir, ["repo", "add", "self", "--path", link, "--area", AREA, "--pattern", "*.md"])).json.error?.code, "REPO_IS_BRAIN");
});

test("repo changes lists matching files since the recorded commit; record makes the next listing empty", async (context) => {
  const dir = await fixtureCopy(context);
  const repo = await tempRepo(context);
  const first = await repo.commit("2026-11-01T10:00:00Z", { "decisions/0001-one.md": "# One\n", "decisions/0002-two.md": "# Two\n", "src/app.ts": "code\n" });
  await run(dir, ["repo", "add", "product", "--path", repo.root, "--area", AREA, "--pattern", "decisions/*.md"]);

  const initial = await run(dir, ["repo", "changes", "product"]);
  assert.equal(initial.code, 0, initial.stdout);
  assert.deepEqual(initial.json.data, {
    name: "product", area: AREA, from: "", to: first,
    files: [
      { path: "decisions/0001-one.md", status: "added", commit: first, committed_at: "2026-11-01T10:00:00Z", sha256: sha("# One\n"), bytes: 6 },
      { path: "decisions/0002-two.md", status: "added", commit: first, committed_at: "2026-11-01T10:00:00Z", sha256: sha("# Two\n"), bytes: 6 },
    ],
    deleted: [],
  });

  const recorded = await run(dir, ["repo", "record", "product", "--commit", first.slice(0, 10)]);
  assert.deepEqual(recorded.json.data, { name: "product", previous: "", commit: first }, "a short sha is stored in full");
  assert.ok((await readFile(join(dir, "log/2026-12.md"), "utf8")).includes(`repo-record - "product" commit=${first}`));

  const second = await repo.commit("2026-11-03T10:00:00Z", { "decisions/0003-three.md": "# Three\n", "src/app.ts": "more code\n", "decisions/0002-two.md": null });
  const third = await repo.commit("2026-11-05T10:00:00Z", { "decisions/0001-one.md": "# One, revised\n" });
  const changes = await run(dir, ["repo", "changes", "product"]);
  assert.deepEqual(changes.json.data.files.map((file: { path: string; status: string; commit: string; committed_at: string }) => [file.path, file.status, file.commit, file.committed_at]), [
    ["decisions/0003-three.md", "added", second, "2026-11-03T10:00:00Z"],
    ["decisions/0001-one.md", "modified", third, "2026-11-05T10:00:00Z"],
  ], "oldest first; the non-matching file and the deleted one left out");
  assert.deepEqual(changes.json.data.deleted, ["decisions/0002-two.md"]);
  assert.deepEqual([changes.json.data.from, changes.json.data.to], [first, third]);
  assert.deepEqual(changes.json.warnings, []);

  await run(dir, ["repo", "record", "product", "--commit", third]);
  const after = await run(dir, ["repo", "changes", "product"]);
  assert.deepEqual([after.json.data.files, after.json.data.deleted], [[], []]);

  await writeFile(join(repo.root, "decisions", "0004-draft.md"), "# Draft\n");
  const dirty = await run(dir, ["repo", "changes", "product"]);
  assert.deepEqual(dirty.json.data.files, [], "uncommitted files are not read");
  assert.deepEqual(dirty.json.warnings.map((warning: { code: string }) => warning.code), ["REPO_DIRTY"]);

  const reset = await run(dir, ["repo", "record", "product", "--reset"]);
  assert.deepEqual(reset.json.data, { name: "product", previous: third, commit: "" });
  assert.deepEqual((await run(dir, ["repo", "changes", "product"])).json.data.files.map((file: { path: string }) => file.path), ["decisions/0003-three.md", "decisions/0001-one.md"]);
});

test("repo record and changes refuse unknown commits, non-ancestors and unknown repos", async (context) => {
  const dir = await fixtureCopy(context);
  const repo = await tempRepo(context);
  const first = await repo.commit("2026-11-01T10:00:00Z", { "a.md": "a\n" });
  const second = await repo.commit("2026-11-02T10:00:00Z", { "a.md": "b\n" });
  await run(dir, ["repo", "add", "product", "--path", repo.root, "--area", AREA, "--pattern", "*.md"]);
  const code = async (...args: string[]) => (await run(dir, ["repo", ...args])).json.error?.code;

  assert.equal(await code("record", "product", "--commit", "0".repeat(40)), "REPO_COMMIT_UNKNOWN");
  assert.equal(await code("record", "missing", "--commit", first), "REPO_NOT_FOUND");
  assert.equal(await code("changes", "missing"), "REPO_NOT_FOUND");
  assert.equal(await code("record", "product"), "USAGE");
  assert.equal(await code("record", "product", "--commit", first, "--reset"), "USAGE");
  await run(dir, ["repo", "record", "product", "--commit", second]);
  assert.equal(await code("record", "product", "--commit", first), "REPO_COMMIT_UNKNOWN", "an older commit isn't after the recorded one");

  // A recorded commit that history no longer contains (a rewritten branch).
  await repo.git("reset", "-q", "--hard", first);
  await repo.git("commit", "-q", "--amend", "-m", "rewritten");
  assert.equal(await code("changes", "product"), "REPO_COMMIT_UNKNOWN");
});

test("note new: a repo file names a linked repo", async (context) => {
  const dir = await fixtureCopy(context);
  const repo = await tempRepo(context);
  const first = await repo.commit("2026-11-01T10:00:00Z", { "decisions/0001-one.md": "# One\n" });
  await run(dir, ["repo", "add", "product", "--path", repo.root, "--area", AREA, "--pattern", "decisions/*.md"]);
  const item = (name: string) => ({
    type: "source", title: "One", file_date: "2026-11-01",
    frontmatter: { source_key: `file:sha256:${sha("# One\n")}`, kind: "document", file_name: "0001-one.md", converter: "verbatim", summary: "Decision one.", repo: name, repo_path: "decisions/0001-one.md", commit: first },
    body: "# One\n",
  });
  const input = join(dirname(dir), "input.json");
  await writeFile(input, JSON.stringify({ notes: [item("other")] }));
  const unknown = await brain(["note", "new", "--input", input, "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(unknown.json.error?.code, "INPUT_INVALID");
  assert.equal(unknown.json.error.details[0].pointer, "/notes/0/frontmatter/repo");
  await writeFile(input, JSON.stringify({ notes: [item("product")] }));
  const created = await brain(["note", "new", "--input", input, "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(created.code, 0, created.stdout);
  const lint = await run(dir, ["lint"]);
  assert.equal(lint.json.data.errors, 0, JSON.stringify(lint.json.data.issues));
});
