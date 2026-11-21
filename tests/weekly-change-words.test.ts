import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { openBrain } from "../src/lib/brain.ts";
import { showTheChange } from "../src/lib/sync.ts";
import { changeText } from "../src/lib/weekly-record.ts";
import { Workspace } from "../src/lib/workspace.ts";
import { brain, fixtureCopy, withPassages } from "./helpers.ts";

// CC-373: a notion_change in words on the weekly row and in Show the change (spec/weekly-review.md §3.3 A Notion change in words, §15.5).
// A related page is named by its note's title, never its id. Every name is invented.
const NOW = "2026-11-09T08:00:00Z";
const SOURCE = "agent:brain-weekly-review/20261109T080000Z";
const PROJECT = "prj-9x4t1b7e";
const PROJECT_PAGE = "2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e";
const CLIENTS = "area-2m7c4h8n";
const CLIENTS_PAGE = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";
const TASK_PAGE = "2b8c4d6e-1f3a-4b5c-8d7e-9f0a1b2c3d4e";
const UNKNOWN_PAGE = "0a10b000-0000-4000-8000-000000000001";
const OTHER_UNKNOWN = "0a10b000-0000-4000-8000-000000000002";

const task = (property: string, value_before: unknown, value_after: unknown) => ({
  kind: "notion_change", why: "synthetic", source: SOURCE, database: "tasks", page: TASK_PAGE, page_title: "Book a dentist appointment",
  property, value_before, value_after, finding: `task_no_project:notion:${TASK_PAGE}`,
});

test("a notion_change reads in words on the row and in Show the change: a related page by its title, never its id", async (context) => {
  const dir = await fixtureCopy(context);
  const inputs = {
    project: task("project", [], [PROJECT_PAGE]),
    unknown: task("project", [PROJECT_PAGE], [UNKNOWN_PAGE]),
    two_unknown: task("project", [], [UNKNOWN_PAGE, OTHER_UNKNOWN].sort()),
    cleared: task("project", [PROJECT_PAGE], []),
    area: task("area", [], [CLIENTS_PAGE]),
    due: task("due", null, "2026-11-30"),
    no_due: task("due", "2026-11-30", null),
    status: task("status", "To Do", "Done"),
    archived: { kind: "notion_change", why: "synthetic", source: SOURCE, database: "areas", target: CLIENTS, page: CLIENTS_PAGE, page_title: "Clients", property: "archived", value_before: false, value_after: true },
  };
  const path = join(dir, "..", "input.json");
  await writeFile(path, JSON.stringify(withPassages({ proposals: Object.values(inputs) })));
  const created = await brain(["proposal", "new", "--brain", dir, "--input", path, "--now", NOW, "--json"]);
  assert.equal(created.code, 0, created.stdout);
  const ids = Object.fromEntries(Object.keys(inputs).map((key, index) => [key, created.json.data.created[index].id as string]));

  const workspace = await Workspace.open(await openBrain({ brainFlag: dir }));
  const words = (key: string) => {
    const proposal = workspace.get(ids[key]!)!;
    return [changeText(proposal.attributes, (id) => workspace.get(id), workspace.notes), ...showTheChange(proposal, workspace)];
  };
  // main's output: `Set project of Book a dentist appointment to ["2b3c…"]` and `project: [] → ["2b3c…"]`.
  assert.deepEqual(words("project"), ["Set the project of Book a dentist appointment to Acme website", "Project: none → Acme website"]);
  assert.deepEqual(words("unknown"), ["Set the project of Book a dentist appointment to a page not in the brain", "Project: Acme website → a page not in the brain"]);
  assert.deepEqual(words("two_unknown"), ["Set the project of Book a dentist appointment to 2 pages not in the brain", "Project: none → 2 pages not in the brain"]);
  assert.deepEqual(words("cleared"), ["Clear the project of Book a dentist appointment", "Project: Acme website → none"]);
  assert.deepEqual(words("area"), ["Set the area of Book a dentist appointment to Clients", "Area: none → Clients"]);
  assert.deepEqual(words("due"), ["Set the due date of Book a dentist appointment to 30 Nov 2026", "Due: none → 30 Nov 2026"]);
  assert.deepEqual(words("no_due"), ["Clear the due date of Book a dentist appointment", "Due: 30 Nov 2026 → none"]);
  assert.deepEqual(words("status"), ["Set Book a dentist appointment Done", "Status: To Do → Done"]);
  assert.deepEqual(words("archived"), ["Archive Clients", "Archived: no → yes"]);
  for (const key of Object.keys(inputs)) assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}/.test(words(key).join("\n")), false, `${key}: no page id is shown`);
});
