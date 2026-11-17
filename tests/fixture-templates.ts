// Setup built once per test process and copied per test (CC-333): copying a finished folder costs a fraction of building it again,
// file by file and Git process by Git process. Each copy is the same bytes and the same Git history as the setup it replaces.
import { execFile } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { TestContext } from "node:test";
import { promisify } from "node:util";

import { fixtureCopy } from "./helpers.ts";

const exec = promisify(execFile);
const REMOVE = { recursive: true, force: true, maxRetries: 10, retryDelay: 50 } as const;

/** A template folder, removed when the test process exits. */
function templateRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  process.on("exit", () => rmSync(root, REMOVE));
  return root;
}

/** A copy of `source` at `<new temp folder>/<its name>`, removed after the test; `cpSync` is several times faster than `fs.promises.cp`. */
async function copyOf(context: TestContext, source: string, prefix: string): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), prefix));
  context.after(() => rm(parent, REMOVE));
  const target = join(parent, basename(source));
  cpSync(source, target, { recursive: true });
  return target;
}

const fixtures = new Map<string, Promise<string>>();

/**
 * `fixtureCopy`'s brain, committed as a clean Git repo: `git init` (with `-b <branch>` when given), the test identity, then
 * `git add -A` and one commit with `message`. Built once per process for each message and branch. `edit` changes brain.json (given the
 * copy's folder) before the commit: in the copy, whose commit is then amended, so it has one commit holding the edited brain.json, as before.
 */
export async function committedFixture(
  context: TestContext,
  options: { message: string; branch?: string; edit?: (config: any, dir: string) => void },
): Promise<string> {
  const key = `${options.branch ?? ""}\n${options.message}`;
  let template = fixtures.get(key);
  if (template === undefined) {
    template = (async () => {
      const built = await fixtureCopy({ after: () => {} } as unknown as TestContext);
      process.on("exit", () => rmSync(dirname(built), REMOVE));
      const git = (...args: string[]) => exec("git", ["-C", built, ...args]);
      await git("init", "-q", ...(options.branch === undefined ? [] : ["-b", options.branch]));
      await git("config", "user.email", "test@example.com");
      await git("config", "user.name", "Test");
      await git("add", "-A");
      await git("commit", "-q", "-m", options.message);
      // One pack instead of a loose object per file: fewer files to copy per test.
      await git("repack", "-a", "-d", "-q");
      await git("prune-packed");
      return built;
    })();
    fixtures.set(key, template);
  }
  const dir = await copyOf(context, await template, "brain-test-");
  if (options.edit !== undefined) {
    const path = join(dir, "brain.json");
    const config = JSON.parse(await readFile(path, "utf8"));
    options.edit(config, dir);
    await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
    await exec("git", ["-C", dir, "commit", "-q", "-a", "--amend", "--no-edit"]);
  }
  return dir;
}

let emptyRepo: Promise<string> | undefined;

/** A temporary Git repo with the test identity on `main`; `commit` writes files (null deletes) and commits them at a fixed time. */
export async function tempRepo(context: TestContext) {
  emptyRepo ??= (async () => {
    const root = join(templateRoot("brain-repo-template-"), "repo");
    await mkdir(root);
    const git = (...args: string[]) => exec("git", ["-C", root, ...args]);
    await git("init", "-q", "-b", "main");
    await git("config", "user.email", "test@example.com");
    await git("config", "user.name", "Test");
    return root;
  })();
  const parent = await mkdtemp(join(tmpdir(), "brain-repo-"));
  context.after(() => rm(parent, REMOVE));
  cpSync(await emptyRepo, parent, { recursive: true });
  const root = parent;
  let dates: Record<string, string> = {};
  const git = async (...args: string[]) => (await exec("git", ["-C", root, ...args], { env: { ...process.env, ...dates } })).stdout.trim();
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

let plainFixture: Promise<string> | undefined;

/** `fixtureCopy`'s brain without Git, built once per process and copied per test. */
export async function fixtureClone(context: TestContext): Promise<string> {
  plainFixture ??= (async () => {
    const built = await fixtureCopy({ after: () => {} } as unknown as TestContext);
    process.on("exit", () => rmSync(dirname(built), REMOVE));
    return built;
  })();
  return copyOf(context, await plainFixture, "brain-test-");
}
