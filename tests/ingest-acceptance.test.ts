import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T18:00:00Z";
const BATCH = join(import.meta.dirname, "..", "skills", "brain-ingest", "references", "example-batch.json");

async function input(dir: string, name: string, value: unknown) {
  const path = join(dir, "..", name);
  await writeFile(path, JSON.stringify(value));
  return path;
}

test("documented Markdown-only ingest replay is valid and idempotent", async (context) => {
  const dir = await fixtureCopy(context);
  const notes = JSON.parse(await readFile(BATCH, "utf8"));
  const source = await input(dir, "source.json", { notes: [notes.notes[0]] });
  const dryRun = await brain(["note", "new", "--input", source, "--dry-run", "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(dryRun.code, 0, dryRun.stdout);
  assert.equal(dryRun.json.data.created.length, 1);

  const noteInput = await input(dir, "notes.json", notes);
  const created = await brain(["note", "new", "--input", noteInput, "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(created.code, 0, created.stdout);
  assert.equal(created.json.data.created.length, 7);

  const proposals = {
    proposals: [
      { kind: "update_fact", title: "Acme budget: 80000 → 95000 EUR", target: "prj-9x4t1b7e", field: "budget", after: "95000 EUR", why: "Budget raised to 95000 EUR to cover the CMS licence.", source: "mtg-pcpyn31n" },
      { kind: "update_fact", title: "Carlos Ruiz role: Developer → tech lead", target: "per-9t2c6m4a", field: "role", after: "tech lead", why: "Carlos is now tech lead for the website.", source: "mtg-pcpyn31n" },
      { kind: "add_link", title: "Acme website: add Lucía Fernández to People", target: "prj-9x4t1b7e", field: "people", after: "per-zzvs98vn", why: "Lucía Fernández (Acme, marketing lead)", source: "mtg-pcpyn31n" },
    ],
  };
  const proposalInput = await input(dir, "proposals.json", proposals);
  const proposed = await brain(["proposal", "new", "--input", proposalInput, "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(proposed.code, 0, proposed.stdout);
  assert.equal(proposed.json.data.created.length, 3);

  assert.equal((await brain(["index", "--brain", dir, "--now", NOW, "--json"])).code, 0);
  assert.equal((await brain(["views", "--brain", dir, "--now", NOW, "--json"])).code, 0);
  const lint = await brain(["lint", "--brain", dir, "--json"]);
  assert.equal(lint.code, 0, JSON.stringify(lint.json.data.issues));
  assert.equal(lint.json.data.errors, 0);
  assert.equal((await brain(["log", "ingest", "mtg-pcpyn31n", "created=7", "proposals=3", "tasks=0", "--brain", dir, "--now", NOW, "--json"])).code, 0);

  const { id: _sourceId, ...sourceRetry } = notes.notes[0];
  const retrySource = await input(dir, "source-retry.json", { notes: [sourceRetry] });
  const duplicateSource = await brain(["note", "new", "--input", retrySource, "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(duplicateSource.code, 0, duplicateSource.stdout);
  assert.equal(duplicateSource.json.data.skipped[0].reason, "DUPLICATE_SOURCE");
  const duplicateProposals = await brain(["proposal", "new", "--input", proposalInput, "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(duplicateProposals.code, 0, duplicateProposals.stdout);
  assert.deepEqual(duplicateProposals.json.data.skipped.map((item: { reason: string }) => item.reason), ["DUPLICATE_PENDING", "DUPLICATE_PENDING", "DUPLICATE_PENDING"]);
});
