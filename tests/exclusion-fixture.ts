import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { passageHash } from "../src/lib/selection.ts";
import { brain } from "./helpers.ts";

export const INPUT = "11111111-2222-4333-8444-555555555555";
const SECRET = "Pricing was 95k.";

function extract(id: string, version: number, replaces: string | null, paragraphs: Array<[number, string]>): string {
  const body = paragraphs.map(([n, text]) => `<!-- passage ¶${n} item s1 -->\n${text}\n`).join("\n");
  return `---\nid: ${id}\ntype: source\ntitle: Launch extract v${version}\nsource_key: notion:${INPUT}\nkind: minutes\nextract: true\nextract_of: ${INPUT}\nextract_version: ${version}\n${replaces === null ? "" : `replaces: ${replaces}\n`}transcript_hash: ${"a".repeat(64)}\nselection:\n  - id: s1\n    effective: use\npassages:\n${paragraphs.map(([n, text]) => `  - n: ${n}\n    hash: ${passageHash(text)}`).join("\n")}\ncaptured: 2026-12-10\ncontent_hash: ${"b".repeat(64)}\n---\n${body}`;
}

/** Version 1 of an input holds a secret paragraph and a decision note cites it; `exclude` then writes version 2 without it and its suppression record. */
export async function excludableDecision(dir: string, sync: string, project: string, withLive: boolean | "unmapped" = false): Promise<{ note: { id: string; path: string }; exclude: () => Promise<void>; reinclude: () => Promise<void> }> {
  await writeFile(join(dir, "sources/notion/2026-12-10-extract-v1.md"), extract("src-ex1a3b4c", 1, null, [[1, "A live paragraph."], [2, SECRET]]));
  const created = await brain(["note", "new", "--input", await json(dir, { notes: [{ type: "decision", title: "Pricing call", frontmatter: { summary: "s", date: "2026-12-03", assessment: "accepted", projects: [project], sources: [sync] }, body: `${withLive === "unmapped" ? "An unsourced remark.\n\n" : ""}${withLive === true ? `Kept statement. ^[src-ex1a3b4c#¶1:${passageHash("A live paragraph.")}]\n\n` : ""}SECRET ${SECRET} ^[src-ex1a3b4c#¶2:${passageHash(SECRET)}]\n` }] }), "--brain", dir, "--now", "2026-12-10T09:00:00Z", "--json"]);
  assert.equal(created.code, 0, created.stdout);
  return {
    note: created.json.data.created[0] as { id: string; path: string },
    async exclude() {
      await writeFile(join(dir, "sources/notion/2026-12-10-extract-v2.md"), extract("src-ex2a3b4c", 2, "src-ex1a3b4c", [[1, "A live paragraph."]]));
      await mkdir(join(dir, "_suppressions"), { recursive: true });
      await writeFile(join(dir, "_suppressions", `${INPUT}.json`), JSON.stringify({ input: INPUT, records: [{ version: 2, passages: [{ extract_of: INPUT, transcript_hash: "a".repeat(64), n: 2 }], full_copies: [], status: "active" }] }));
    },
    /** Version 3 holds the paragraph again: its claim waits for the user's Restore. */
    async reinclude() {
      await writeFile(join(dir, "sources/notion/2026-12-10-extract-v3.md"), extract("src-ex3a3b4c", 3, "src-ex2a3b4c", [[1, "A live paragraph."], [2, SECRET]]));
    },
  };
}

async function json(dir: string, value: unknown): Promise<string> {
  const file = join(dir, "..", `fixture-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(file, JSON.stringify(value));
  return file;
}
