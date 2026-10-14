import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const designPath = join(import.meta.dirname, "..", "docs", "notion-space-design.md");

type PropertyReference = {
  database: string;
  properties: readonly string[];
  source: string;
};

/**
 * Properties used to filter, sort, group, or display the linked views and
 * page layouts in design §5, Prompt 6, and Prompt 7a–h. The prompts are the
 * exact build definition where the concise §5 layout table differs.
 */
const viewPropertyReferences: readonly PropertyReference[] = [
  { database: "Goals", source: "Prompt 6 Areas template", properties: ["Area", "Status", "Name", "Progress", "Countdown"] },
  { database: "Projects", source: "Prompt 6 Areas template", properties: ["Area", "Status", "Name", "Countdown", "Task Progress"] },
  { database: "Tasks", source: "Prompt 6 Areas template", properties: ["Area", "Status", "Name", "Project", "Due"] },
  { database: "Meetings", source: "Prompt 6 Areas template", properties: ["Area", "Date", "Name", "Project"] },
  { database: "Areas", source: "Prompt 6 Areas page layout", properties: ["People via projects", "Clients via projects", "Decisions via projects", "Questions via projects"] },
  { database: "Key Results", source: "Prompt 6 Goals template", properties: ["Goal", "Progress", "Name", "Current", "Target", "Unit", "Done"] },
  { database: "Projects", source: "Prompt 6 Goals template", properties: ["Goal", "Name", "Status", "Countdown", "Task Progress"] },
  { database: "Tasks", source: "Prompt 6 Projects template", properties: ["Project", "Status", "Name", "Due"] },
  { database: "Meetings", source: "Prompt 6 Projects template", properties: ["Project", "Date", "Name", "Brain Status"] },
  { database: "Questions", source: "Prompt 6 Projects template", properties: ["Project", "Status", "Name", "Kind"] },
  { database: "People", source: "Prompt 6 Projects template", properties: ["Projects", "Name", "Role", "Org"] },
  { database: "Decisions", source: "Prompt 6 Meetings template", properties: ["Decided In"] },
  { database: "Questions", source: "Prompt 6 Meetings template", properties: ["Raised In"] },
  { database: "Tasks", source: "Prompt 6 Meetings template", properties: ["Meeting"] },
  { database: "Meetings", source: "Prompt 6 People template", properties: ["Attendees", "Date", "Name", "Project"] },
  { database: "Projects", source: "Prompt 6 People template", properties: ["People", "Name", "Status"] },
  { database: "People", source: "Prompt 6 Orgs template", properties: ["Org", "Name", "Role"] },
  { database: "Projects", source: "Prompt 6 Orgs template", properties: ["Client", "Name", "Status", "Countdown"] },
  { database: "Orgs", source: "Prompt 6 Orgs page layout", properties: ["Meetings via projects"] },
  { database: "Review", source: "Prompt 7a Home", properties: ["State", "Created time", "Name"] },
  { database: "Meetings", source: "Prompt 7a Home", properties: ["Brain Status", "Date", "Name", "Project"] },
  { database: "Capture Inbox", source: "Prompt 7a Home", properties: ["Brain Status"] },
  { database: "Projects", source: "Prompt 7a Home", properties: ["Status", "Archived", "Priority", "Name", "Client", "Countdown", "Task Progress"] },
  { database: "Tasks", source: "Prompt 7a Home", properties: ["Status", "Due", "Name", "Project"] },
  { database: "Goals", source: "Prompt 7b Plan", properties: ["Status", "Archived", "Deadline", "Name", "Progress", "Countdown", "Area"] },
  { database: "Key Results", source: "Prompt 7b Plan", properties: ["Goal", "Status", "Done", "Due", "Name", "Current", "Target", "Unit", "Progress"] },
  { database: "Areas", source: "Prompt 7b Plan", properties: ["Archived", "Type", "Name"] },
  { database: "Projects", source: "Prompt 7b Plan", properties: ["Goal", "Archived", "Status", "Priority", "Name"] },
  { database: "Projects", source: "Prompt 7c Projects", properties: ["Archived", "Status", "Priority", "Name", "Client", "Countdown", "Task Progress", "Area", "Dates", "Last edited time", "Last Synced"] },
  { database: "Meetings", source: "Prompt 7d Meetings", properties: ["Brain Status", "Date", "Name", "Project", "Attendees", "Ingested At", "Decisions", "Questions"] },
  { database: "Review", source: "Prompt 7e Review", properties: ["State", "Created time", "Name", "Kind", "Before", "After", "Decision", "Last edited time"] },
  { database: "Decisions", source: "Prompt 7f Knowledge", properties: ["Date", "Name", "Project", "Assessment", "Lifecycle", "Summary", "Superseded By"] },
  { database: "Questions", source: "Prompt 7f Knowledge", properties: ["Status", "Kind", "Created time", "Name", "Project", "Raised In", "Summary"] },
  { database: "People", source: "Prompt 7f Knowledge", properties: ["Lifecycle", "Org", "Name", "Role", "Summary"] },
  { database: "Orgs", source: "Prompt 7f Knowledge", properties: ["Relationship", "Lifecycle", "Name", "People"] },
  { database: "Capture Inbox", source: "Prompt 7f Knowledge", properties: ["Brain Status", "Created", "Name"] },
  { database: "Tasks", source: "Prompt 7g Tasks", properties: ["Status", "Due", "Name", "Project", "Meeting", "Last edited time"] },
  { database: "Projects", source: "Prompt 7h Archive", properties: ["Status", "Archived", "Dates", "Name", "Client"] },
  { database: "Goals", source: "Prompt 7h Archive", properties: ["Status", "Archived", "Deadline", "Name"] },
  { database: "Areas", source: "Prompt 7h Archive", properties: ["Archived", "Name", "Type"] },
  { database: "Decisions", source: "Prompt 7h Archive", properties: ["Lifecycle", "Date", "Name", "Project"] },
  { database: "Questions", source: "Prompt 7h Archive", properties: ["Lifecycle", "Created time", "Name", "Project", "Status"] },
  { database: "People", source: "Prompt 7h Archive", properties: ["Lifecycle", "Name", "Org"] },
  { database: "Orgs", source: "Prompt 7h Archive", properties: ["Lifecycle", "Name", "Relationship"] },
];

function sectionThreeProperties(design: string): Map<string, Set<string>> {
  const section = design.match(/## 3\. Databases\n([\s\S]*?)\n## 4\./)?.[1];
  assert.ok(section, "design must contain §3 followed by §4");

  const common = new Set<string>();
  const properties = new Map<string, Set<string>>();
  let database: string | undefined;

  for (const line of section.split("\n")) {
    const heading = line.match(/^### 3\.\d+ (.+)$/);
    if (heading) {
      database = heading[1].replace(/ \(.+\)$/, "");
      properties.set(database, new Set());
      continue;
    }
    const row = line.match(/^\| ([^|]+) \|/);
    if (!row || row[1] === "Property" || /^-+$/.test(row[1])) continue;

    if (database) properties.get(database)!.add(row[1]);
    else common.add(row[1]);
  }

  for (const database of ["Areas", "Goals", "Projects", "People", "Orgs", "Decisions", "Questions"]) {
    for (const property of common) properties.get(database)?.add(property);
  }
  // §3.8 defines the inverse relation in prose rather than as a separate row.
  properties.get("Decisions")?.add("Superseded By");
  // Prompt 7b can filter Key Results through its related Goal's Status.
  properties.get("Key Results")?.add("Status");
  return properties;
}

function missingViewProperties(design: string): string[] {
  const properties = sectionThreeProperties(design);
  return viewPropertyReferences.flatMap(({ database, properties: referenced, source }) => {
    const defined = properties.get(database);
    if (!defined) return [`${source}: database ${database} is missing from §3`];
    return referenced
      .filter((property) => !defined.has(property))
      .map((property) => `${source}: ${database}.${property} is missing from §3`);
  });
}

test("every property used by a Notion view or page layout is defined in design §3", async () => {
  assert.deepEqual(missingViewProperties(await readFile(designPath, "utf8")), []);
});

test("the view-property contract rejects a deliberately broken §3 copy", async () => {
  const design = await readFile(designPath, "utf8");
  const broken = design.replace("| Last edited time | Last edited time | System (Notion fills it; \"gone quiet\" view) |", "");
  assert.deepEqual(missingViewProperties(broken), ["Prompt 7c Projects: Projects.Last edited time is missing from §3"]);
});
