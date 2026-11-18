// CC-360: Meetings' Brain Status uses the Inbox's names, New → Ready → Done, with Skipped kept (decision 0109; cli §5.14.4, schema §14,
// capture-and-review §4.4). Synthetic rows only.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseSummary, planExtract } from "../src/lib/selection.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const MEETING = "mtg-8c4n2p7w";
const MEETING_PAGE = "3c4d5e6f-7a8b-4c0d-9e2f-3a4b5c6d7e8f";

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

async function configure(dir: string, key: string, id: string): Promise<void> {
  const set = await brain(["config", "set", `notion.databases.${key}`, JSON.stringify(id), "--brain", dir, "--json"]);
  assert.equal(set.code, 0, set.stdout);
}

async function renderMeeting(dir: string) {
  const rendered = await run(dir, ["sync", "render", "--ids", MEETING]);
  assert.equal(rendered.code, 0, rendered.stdout);
  return rendered.json.data.items as Array<{ id: string; properties: Record<string, unknown>; published: Record<string, unknown> }>;
}

async function record(dir: string, notion: string, id: string, published: Record<string, unknown>): Promise<void> {
  const recorded = await run(dir, ["sync", "record"], { records: [{ id, notion, synced_at: NOW, published }] });
  assert.equal(recorded.code, 0, recorded.stdout);
}

test("render: an ingested meeting gets Brain Status Done and Ingested At (0109 §1, §5)", async (context) => {
  const dir = await fixtureCopy(context);
  await configure(dir, "meetings", "a1000000-0000-4000-8000-00000000000d");
  const [item] = await renderMeeting(dir);
  assert.equal(item.id, MEETING);
  assert.deepEqual(item.properties["Brain Status"], { type: "select", value: "Done" });
  assert.ok(Object.hasOwn(item.properties, "Ingested At"), "Ingested At goes out with Done, under its own name");
  assert.equal(item.published["Brain Status"], "Done");
  assert.ok(item.published["Ingested At"] !== undefined && item.published["Ingested At"] !== null);
});

test("render: a meeting published with an old name compares equal to the new one, so a migrated space sends no write (0109 §4)", async (context) => {
  for (const [old, current] of [["Ingested", "Done"], ["Reviewed", "Ready"], ["Not Reviewed", "New"]] as const) {
    const dir = await fixtureCopy(context);
    await configure(dir, "meetings", "a1000000-0000-4000-8000-00000000000d");
    const [item] = await renderMeeting(dir);
    // The baseline the brain holds names the old option; Notion renamed it (migration 0029). The new name is what B would compare against.
    await record(dir, MEETING_PAGE, MEETING, { ...item.published, "Brain Status": old });
    const rendered = await renderMeeting(dir);
    if (current === "Done") assert.deepEqual(rendered, [], `${old} in S reads as Done: nothing to send`);
    else {
      // B is always Done for an ingested meeting, so an S of Ready or New differs from it exactly as the new name would.
      assert.equal(rendered.length, 1, `${old} in S reads as ${current}, which differs from Done`);
      assert.deepEqual(Object.keys(rendered[0]!.properties), ["Brain Status"], "only Brain Status goes out");
      await record(dir, MEETING_PAGE, MEETING, { ...item.published, "Brain Status": current });
      assert.deepEqual(Object.keys((await renderMeeting(dir))[0]!.properties), ["Brain Status"], `${old} and ${current} in S render the same`);
    }
  }
});

test("render: Skipped on a meeting passes through as it is, never read as another name (0109 §2)", async (context) => {
  const dir = await fixtureCopy(context);
  await configure(dir, "meetings", "a1000000-0000-4000-8000-00000000000d");
  const [item] = await renderMeeting(dir);
  await record(dir, MEETING_PAGE, MEETING, { ...item.published, "Brain Status": "Skipped" });
  const [again] = await renderMeeting(dir);
  assert.deepEqual(Object.keys(again!.properties), ["Brain Status"], "Skipped is compared as Skipped, not as Done");
});

test("render: the Inbox's values are unchanged: an S of Reviewed, Not Reviewed or Ingested on an Inbox row is not read as a meeting's name", async (context) => {
  const dir = await fixtureCopy(context);
  await configure(dir, "inbox", "a1000000-0000-4000-8000-00000000000b");
  const created = await run(dir, ["note", "new"], { notes: [{ type: "source", title: "Status brief", file_date: "2026-12-01", frontmatter: { source_key: `file:sha256:${createHash("sha256").update("Status brief").digest("hex")}`, file_name: "status-brief.pdf", converter: "markitdown 0.1.8", kind: "document", summary: "Status brief in one line.", digest: "- Key point." }, body: "## Brief\n\n- One line\n" }] });
  assert.equal(created.code, 0, created.stdout);
  const id = created.json.data.created[0].id as string;
  const [item] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  assert.deepEqual(item.properties["Brain Status"], { type: "select", value: "Done" });
  for (const old of ["Ingested", "Reviewed", "Not Reviewed"]) {
    await record(dir, "b3000000-0000-4000-8000-000000000009", id, { ...item.published, "Brain Status": old });
    const [again] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
    assert.deepEqual(again?.properties["Brain Status"], { type: "select", value: "Done" }, `${old} on the Inbox is not renamed`);
  }
  await record(dir, "b3000000-0000-4000-8000-000000000009", id, { ...item.published, "Brain Status": "Processed" });
  assert.deepEqual((await run(dir, ["sync", "render", "--ids", id])).json.data.items, [], "Processed still reads as Done (0048)");
});

test("minutes with the old confirm sentence and with the new one both parse (0109 §6, capture-and-review §4.4)", () => {
  const transcript = "Launch para.\n\nPricing zebrafish95k para.";
  for (const sentence of ["Mark Reviewed to confirm.", "Set Ready to confirm."]) {
    for (const notice of [`All subjects included unless marked Meeting only. ${sentence}`, `> 💡 All subjects included unless marked Meeting only.\n> ${sentence}`,
      // Wrapped so a line starts with "Meeting only": unless the whole sentence is known, that line reads as a selection control and blocks.
      `All subjects included unless marked\nMeeting only. ${sentence}`]) {
      const summary = `${notice}\n\n## [s1] Launch\n- [s1.i1] L “Launch para”\n\n## [s2] Pricing\nSelection: Meeting only\n- [s2.i1] P “zebrafish95k”\n`;
      const plan = planExtract(parseSummary(summary), transcript);
      assert.equal(plan.ok, true, `${sentence}: ${JSON.stringify(plan.problems)}`);
      assert.deepEqual(plan.copied.map((entry) => entry.n), [1], `${sentence}: only the included paragraph is copied`);
    }
  }
});
