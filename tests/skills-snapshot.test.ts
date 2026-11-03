import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { buildManifest, computeIntegrity, packageProblem, packageSnapshot, phaseARange, serializeManifest, validateSnapshot } from "../src/lib/skills-snapshot.ts";
import { FORK_META, invalidSnapshots, productRoot, SNAPSHOTS, snapshotCopy } from "./skills-fixtures.ts";

// spec/skills-delivery.md §2 and §2.3; §12.1 test 2.

test("fixture snapshots A and B are valid and their integrity is recomputed equal", async () => {
  for (const [name, version] of [["a", "1.0.0"], ["b", "1.1.0"]] as const) {
    const folder = join(SNAPSHOTS, name);
    const check = validateSnapshot(folder);
    assert.equal(check.reason, null, name);
    assert.equal(check.manifest!.integrity, computeIntegrity(check.manifest!.skills));
    // The committed manifest is what the generator writes, byte for byte.
    assert.equal(await readFile(join(folder, "snapshot.json"), "utf8"), serializeManifest(buildManifest(folder, FORK_META(version))));
  }
});

test("each invalid fixture fails with its §2.3 reason id", async (context) => {
  const expected: Record<string, string> = {
    "manifest-missing": "manifest-missing",
    "manifest-unparseable": "manifest-unparseable",
    "manifest-schema": "manifest-schema",
    "manifest-order": "manifest-order",
    integrity: "integrity",
    "file-missing": "file-missing: brain-old/SKILL.md",
    "not-a-file": "not-a-file: brain-old/SKILL.md",
    "file-mismatch": "file-mismatch: brain-apply/SKILL.md",
    "unlisted-entry": "unlisted-entry: brain-apply/extra.md",
  };
  const folders = await invalidSnapshots(context);
  assert.deepEqual(Object.keys(folders).sort(), Object.keys(expected).sort());
  for (const [id, folder] of Object.entries(folders)) assert.equal(validateSnapshot(folder).reason, expected[id], id);
});

test("the optional top-level files are ignored, and anything else at the top is an unlisted entry", async (context) => {
  const folder = await snapshotCopy(context, "a");
  const { writeFile, mkdir } = await import("node:fs/promises");
  for (const name of ["README.md", "LICENSE", "NOTICE.md"]) await writeFile(join(folder, name), "x\n");
  assert.equal(validateSnapshot(folder).reason, null);
  await mkdir(join(folder, "brain-query", "references", "nested"));
  await writeFile(join(folder, ".hidden"), "");
  // Unlisted entries are reported in byte order of their path; an unlisted folder is one entry.
  assert.equal(validateSnapshot(folder).reason, "unlisted-entry: .hidden");
});

test("a package snapshot is compatible only when valid and the running CLI is in its range", async (context) => {
  const root = await productRoot(context, join(SNAPSHOTS, "a"));
  assert.equal(packageSnapshot(root, "0.9.3").compatible, true);
  const newer = packageSnapshot(root, "0.10.0");
  assert.equal(newer.compatible, false);
  assert.equal(packageProblem(newer), "not compatible with 0.10.0 (>=0.9.0 <0.10.0)");
  const broken = await productRoot(context, (await invalidSnapshots(context))["file-missing"]!);
  assert.equal(packageProblem(packageSnapshot(broken, "0.9.0")), "file-missing: brain-old/SKILL.md");
});

test("the phase A range accepts the package version up to the next minor", () => {
  assert.equal(phaseARange("0.9.0"), ">=0.9.0 <0.10.0");
  assert.equal(phaseARange("0.9.0-rc.1"), ">=0.9.0-rc.1 <0.10.0");
});
