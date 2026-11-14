// Other people's text keeps its links (decision 0091, spec/schema.md §1 and §15, spec/cli.md §5.10 and §5.14.4). Synthetic vault only.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";
import { promisify } from "node:util";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const exec = promisify(execFile);
const NOW = "2026-12-10T09:00:00Z";
const AREA = "area-2m7c4h8n";
const DOCUMENTS_DB = "a1000000-0000-4000-8000-00000000000c";
const PAGE = { beta: "b0000000-0000-4000-8000-0000000000b1", dupA: "b0000000-0000-4000-8000-0000000000d1", dupB: "b0000000-0000-4000-8000-0000000000d2", gamma: "b0000000-0000-4000-8000-0000000000c1", alpha: "b0000000-0000-4000-8000-0000000000a1" };
const url = (page: string) => `https://www.notion.so/${page.replaceAll("-", "")}`;

const ALPHA = [
  "# Alpha",
  "",
  "See [[beta]], [[beta|the beta note]], [[beta#Plan|the plan]] and ![[beta]].",
  "Also [[notes/beta]], [[gamma]] and [[dup]].",
  "| a | [[beta\\|in a table]] |",
  "A relative link: [beta again](beta.md), [missing](../nowhere.md), [web](https://example.com) and [top](#alpha).",
  "A footnote.^[An inline footnote in the vault.]",
  "In code: `[[beta]]`.",
  "```",
  "[[beta]]",
  "```",
  "",
].join("\n");
const FILES: Record<string, string> = {
  "notes/alpha.md": ALPHA,
  "notes/beta.md": "# Beta\n\n## Plan\n\nBack to [[alpha]].\n",
  "notes/gamma.md": "# Gamma\n",
  "a/dup.md": "# Dup A\n",
  "b/dup.md": "# Dup B\n",
};

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dirname(dir), `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

/** A brain with the vault linked as repo `vault` and the Documents database configured. */
async function vaultBrain(context: TestContext): Promise<{ dir: string; commit: string }> {
  const dir = await fixtureCopy(context);
  const root = await mkdtemp(join(tmpdir(), "brain-vault-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const git = async (...args: string[]) => (await exec("git", ["-C", root, ...args])).stdout.trim();
  await git("init", "-q", "-b", "main");
  await git("config", "user.email", "test@example.com");
  await git("config", "user.name", "Test");
  for (const [path, text] of Object.entries(FILES)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }
  await git("add", ".");
  await git("commit", "-q", "-m", "vault");
  const added = await run(dir, ["repo", "add", "vault", "--path", root, "--area", AREA, "--pattern", "**/*.md"]);
  assert.equal(added.code, 0, added.stdout);
  const set = await brain(["config", "set", "notion.databases.documents", JSON.stringify(DOCUMENTS_DB), "--brain", dir, "--json"]);
  assert.equal(set.code, 0, set.stdout);
  return { dir, commit: await git("rev-parse", "HEAD") };
}

/** A file of the vault as a verbatim source, and its whole Document. */
function kept(path: string, commit: string, id: string): Array<Record<string, unknown>> {
  const body = FILES[path]!;
  const name = path.split("/").pop()!;
  return [
    { type: "source", id, title: path, file_date: "2026-12-01", frontmatter: { source_key: `file:sha256:${sha(body)}`, kind: "document", file_name: name, converter: "verbatim", summary: `${path} of the vault.`, repo: "vault", repo_path: path, commit }, body },
    { type: "reference", title: `${path} (whole)`, frontmatter: { summary: `${path}, whole.`, origin: "whole", area: AREA, sources: [id] }, body },
  ];
}

async function keep(dir: string, notes: Array<Record<string, unknown>>): Promise<Array<{ id: string; type: string; path: string }>> {
  const created = await run(dir, ["note", "new"], { notes });
  assert.equal(created.code, 0, created.stdout);
  return created.json.data.created;
}

/** Records a published page, as `sync record` does after the skill writes it. */
async function publish(dir: string, id: string, page: string): Promise<void> {
  const [item] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  const recorded = await run(dir, ["sync", "record"], { records: [{ id, notion: page, synced_at: NOW, published: item.published }] });
  assert.equal(recorded.code, 0, recorded.stdout);
}

test("a source and its whole Document keep wikilinks, foreign relative links and footnotes; note new and lint pass (0091)", async (context) => {
  const { dir, commit } = await vaultBrain(context);
  const [source, whole] = await keep(dir, kept("notes/alpha.md", commit, "src-2a2a2a2a"));
  const file = parseFrontmatter(await readFile(join(dir, source!.path), "utf8"));
  assert.equal(file.body, ALPHA, "the body is the file, unchanged");
  assert.equal(file.attributes.content_hash, `sha256:${sha(ALPHA)}`);
  assert.equal(file.attributes.converter, "verbatim");
  assert.equal(parseFrontmatter(await readFile(join(dir, whole!.path), "utf8")).body, `\n${ALPHA}`, "the same text, after the blank line every note but a source has");
  const lint = await run(dir, ["lint"]);
  assert.equal(lint.json.data.errors, 0, JSON.stringify(lint.json.data.issues));
  const rules = (lint.json.data.issues as Array<{ rule: string; path: string }>).filter((issue) => issue.path === source!.path || issue.path === whole!.path).map((issue) => issue.rule);
  for (const rule of ["wikilink", "broken-link", "unknown-marker"]) assert.ok(!rules.includes(rule), `${rule} is not checked in kept text`);

  // A changed source body still fails source-hash.
  const path = join(dir, source!.path);
  await writeFile(path, (await readFile(path, "utf8")).replace("[[gamma]]", "gamma"));
  const changed = await run(dir, ["lint"]);
  assert.ok((changed.json.data.issues as Array<{ rule: string; path: string }>).some((issue) => issue.rule === "source-hash" && issue.path === source!.path), changed.stdout);
});

test("a note the brain writes still follows 0002: a decision, a question, a part and a learned Document with [[x]] are refused", async (context) => {
  const { dir, commit } = await vaultBrain(context);
  await keep(dir, kept("notes/beta.md", commit, "src-2b2b2b2b"));
  const written = [
    { type: "decision", title: "Use the vault", frontmatter: { summary: "We use the vault.", date: "2026-12-09", assessment: "provisional", area: AREA, sources: ["src-2b2b2b2b"] }, body: "Agreed, see [[beta]].\n" },
    { type: "question", title: "Who owns the vault", frontmatter: { summary: "Open: who owns it.", kind: "question", sources: ["src-2b2b2b2b"] }, body: "Asked in [[beta]].\n" },
    { type: "reference", title: "Beta plan", frontmatter: { summary: "The plan.", origin: "part", area: AREA, sources: ["src-2b2b2b2b"] }, body: "- From [[beta]]\n" },
    { type: "reference", title: "Vault method", frontmatter: { summary: "The method.", origin: "learned", sources: ["src-2b2b2b2b"] }, body: "Learned from [[beta]].\n" },
  ];
  for (const note of written) {
    const refused = await run(dir, ["note", "new"], { notes: [note] });
    assert.equal(refused.json.error?.code, "INPUT_INVALID", note.title);
    assert.match(JSON.stringify(refused.json.error.details), /wikilink/, note.title);
  }
});

test("render links a wikilink to the one matching whole Document's page, else plain text; the page links once the target is published (0091)", async (context) => {
  const { dir, commit } = await vaultBrain(context);
  const [, alpha] = await keep(dir, kept("notes/alpha.md", commit, "src-2a2a2a2a"));
  const [, beta] = await keep(dir, kept("notes/beta.md", commit, "src-2b2b2b2b"));
  const [, dupA] = await keep(dir, kept("a/dup.md", commit, "src-2d2d2d2a"));
  const [, dupB] = await keep(dir, kept("b/dup.md", commit, "src-2d2d2d2b"));
  for (const [note, page] of [[beta!, PAGE.beta], [dupA!, PAGE.dupA], [dupB!, PAGE.dupB]] as const) await publish(dir, note.id, page);

  const [first] = (await run(dir, ["sync", "render", "--ids", alpha!.id])).json.data.items;
  const B = url(PAGE.beta);
  assert.equal(first.body.replace(/^\n/, ""), [
    "# Alpha",
    "",
    `See [beta](${B}), [the beta note](${B}), [the plan](${B}) and [beta](${B}).`,
    `Also [notes/beta](${B}), gamma and dup.`,
    `| a | [in a table](${B}) |`,
    `A relative link: [beta again](${B}), missing, [web](https://example.com) and top.`,
    "A footnote.^[An inline footnote in the vault.]",
    "In code: `[[beta]]`.",
    "```",
    "[[beta]]",
    "```",
    "",
  ].join("\n"), "gamma was never ingested; two files are named dup");

  // Published as it is now; nothing new to send.
  await publish(dir, alpha!.id, PAGE.alpha);
  const alphaFile = await readFile(join(dir, alpha!.path), "utf8");
  const quiet = await run(dir, ["sync", "render", "--changed"]);
  assert.ok(!(quiet.json.data.items as Array<{ id: string }>).some((item) => item.id === alpha!.id), quiet.stdout);

  // gamma ingested but not yet published: still plain text.
  const [, gamma] = await keep(dir, kept("notes/gamma.md", commit, "src-2c2c2c2c"));
  const unpublished = (await run(dir, ["sync", "render", "--ids", alpha!.id])).json.data.items as unknown[];
  assert.deepEqual(unpublished, [], "alpha's page is unchanged while gamma has no page");

  // Once gamma's page exists, alpha's next render links it; alpha's file never changed.
  await publish(dir, gamma!.id, PAGE.gamma);
  const changed = (await run(dir, ["sync", "render", "--changed"])).json.data.items as Array<{ id: string; body: string | null }>;
  const update = changed.find((item) => item.id === alpha!.id);
  assert.ok(update !== undefined, "alpha is rendered again");
  assert.match(update.body!, new RegExp(`\\[gamma\\]\\(${url(PAGE.gamma)}\\) and dup\\.`));
  assert.equal(await readFile(join(dir, alpha!.path), "utf8"), alphaFile);
});

test("a whole Document from a file in no repo shows its wikilinks and relative links as text", async (context) => {
  const dir = await fixtureCopy(context);
  const set = await brain(["config", "set", "notion.databases.documents", JSON.stringify(DOCUMENTS_DB), "--brain", dir, "--json"]);
  assert.equal(set.code, 0, set.stdout);
  const body = "See [[beta|the beta note]], [beta](beta.md) and [web](https://example.com).\n";
  const [, whole] = await keep(dir, [
    { type: "source", id: "src-2e2e2e2e", title: "Dropped note", file_date: "2026-12-01", frontmatter: { source_key: `file:sha256:${sha(body)}`, kind: "document", file_name: "dropped.md", converter: "verbatim", summary: "A dropped file." }, body },
    { type: "reference", title: "Dropped note (whole)", frontmatter: { summary: "Whole.", origin: "whole", area: AREA, sources: ["src-2e2e2e2e"] }, body },
  ]);
  const [item] = (await run(dir, ["sync", "render", "--ids", whole!.id])).json.data.items;
  assert.equal(item.body.replace(/^\n/, ""), "See the beta note, beta and [web](https://example.com).\n");
});
