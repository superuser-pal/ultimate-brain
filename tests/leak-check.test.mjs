import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const source = resolve(import.meta.dirname, "..");

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "ultimate-brain-leak-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init"], { cwd: root });
  return root;
}

function write(root, path, content) {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), content);
}

function track(root, path) {
  execFileSync("git", ["add", "--", path], { cwd: root });
}

function run(root, { staged = false, home } = {}) {
  return spawnSync(process.execPath, [join(source, "scripts/leak-check.mjs"), ...(staged ? ["--staged"] : [])], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, UB_ROOT: root, ...(home === undefined ? {} : { HOME: home }) },
  });
}

test("leak check catches a synthetic UUID", (t) => {
  const root = fixture(t);
  write(root, "docs/value.md", "id: 01234567-89ab-cdef-0123-456789abcdef\n");
  track(root, "docs/value.md");
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^docs\/value\.md:1: UUID\n$/);
  assert.doesNotMatch(result.stderr, /01234567/);
});

test("leak check catches a non-example email", (t) => {
  const root = fixture(t);
  write(root, "docs/value.md", "contact: allowed@example, person@company.test\n");
  track(root, "docs/value.md");
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^docs\/value\.md:1: EMAIL\n$/);
  assert.doesNotMatch(result.stderr, /person@/);
});

test("staged leak check catches a denylist term", (t) => {
  const root = fixture(t);
  const home = join(root, "home");
  write(root, "docs/value.md", "A forbidden customer appears here.\n");
  write(home, ".config/ultimate-brain/denylist", "# local terms\ncustomer\n");
  track(root, "docs/value.md");
  const result = run(root, { staged: true, home });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^docs\/value\.md:1: DENYLIST\n$/);
  assert.doesNotMatch(result.stderr, /customer/i);
});

test("leak check passes the current tracked tree", () => {
  const result = run(source);
  assert.equal(result.status, 0, result.stderr);
});

test("leak check excludes sources, node_modules, and NUL files", (t) => {
  const root = fixture(t);
  write(root, "sources/private.md", "id: 01234567-89ab-cdef-0123-456789abcdef\n");
  write(root, "node_modules/private/index.js", "person@company.test\n");
  write(root, "docs/binary.bin", "\0person@company.test\n");
  track(root, "sources/private.md");
  track(root, "node_modules/private/index.js");
  track(root, "docs/binary.bin");
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
});
