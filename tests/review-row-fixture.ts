import { createHash } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { openBrain } from "../src/lib/brain.ts";
import { cleanupItemView, CLEANUP_KINDS } from "../src/lib/cleanup-row.ts";
import { parseFrontmatter, serializeFrontmatter } from "../src/lib/frontmatter.ts";
import { canon, textSha, transitionItems, wordingSha, type Labels } from "../src/lib/review-transition.ts";
import { PASSAGE_REF } from "../src/lib/selection.ts";
import { Workspace } from "../src/lib/workspace.ts";

/**
 * A Review row as 0.15.x published it, for the tests of the 0.16.0 transition (cli §5.14.8): since 0.16.0 nothing renders one, so a test
 * writes the page and its `@review` baseline here. The page holds what the transition reads (capture-and-review (v0.15.1) §7.3 for format 1,
 * §7.12.6 for format 2): each item's section, its wording, its Decision line; headings and help text are short stand-ins.
 */
export interface PublishedRow { body: string; ids: string[]; wording: Map<string, string> }

// Lines of wording that would read as page structure were escaped by a leading backslash (capture-and-review (v0.15.1) §7.3, §7.12.4).
const STRUCTURAL = /^[\s\\]*(?:## \[|<\/?details|<summary|Decision:|Revision request:)/i;
const VISIBLE = /^[\s\\]*(?:#|>|\*Why:|ref it-|<span|<\/?details|<summary|<!--|Decision:|Revision request:|Agreed in review:)/i;
const IN_TOGGLE = /^[\s\\]*(?:<\/?details|<summary)/i;
const escape = (text: string, rule: RegExp): string => text.split("\n").map((line) => (rule.test(line) ? `\\${line}` : line)).join("\n");
const shorten = (text: string, labels: Labels): string => text.replace(/\[¶/g, "\\\\[¶").replace(PASSAGE_REF, (whole, source: string, n: string, hash: string) => {
  const label = labels.byRef.get(`${source}#¶${n}:${hash}`);
  return label === undefined ? whole : `[${label}]`;
});
const sha = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");
const list = (value: unknown): Array<Record<string, unknown>> => (Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null) : []);

export async function publishReviewRow(dir: string, id: string, page: string, format: 1 | 2 = 1): Promise<PublishedRow> {
  const workspace = await Workspace.open(await openBrain({ brainFlag: dir }));
  const proposal = workspace.get(id);
  if (proposal === undefined) throw new Error(`no proposal ${id}`);
  const a = proposal.attributes;
  const items = transitionItems(proposal, workspace);
  const stored = list(a.items);
  const wording = new Map<string, string>();
  const sections: string[] = [];
  const record: Record<string, unknown> = {};
  items.forEach((item, index) => {
    const entry = stored.find((candidate) => candidate.item_id === item.item_id)!;
    const full = item.held ? "" : wordingOf(workspace, proposal.attributes, entry, item.link_values?.map((value) => value.title), format);
    wording.set(item.item_id, full);
    // Format 2 shows each passage reference by its short label, a literal `[¶` escaped (capture-and-review (v0.15.1) §7.12.4, §9.5).
    const text = format === 1 ? full : shorten(full, item.labels);
    const letter = String.fromCharCode(97 + index);
    const section = format === 1
      ? [`## [${letter} · ${item.item_id}] Item ${letter}`, ...(item.held ? [] : ["<details>", "<summary>Proposed final wording</summary>", "", escape(text, STRUCTURAL), "", "</details>"]), "Decision: Pending"].join("\n")
      : [`### Item ${letter}`, ...(item.held ? [] : entry.kind === "note" ? ["<details>", "<summary>Read or edit the note</summary>", "", escape(text, IN_TOGGLE), "", "</details>"] : entry.kind === "link" ? text.split("\n").map((name) => `\\+ ${name}`) : [escape(text, VISIBLE)]), `<span color="gray">ref ${item.item_id}</span>`, "Decision: Pending"].join("\n");
    sections.push(section);
    record[item.item_id] = { rendered_hash: sha(section), proposed_hash: format === 1 ? textSha(full) : wordingSha(full), base_hash: item.current_base_hash, ...(item.held ? { held: true } : {}) };
  });
  const body = `${format === 1 ? "" : "## Changes\n"}${sections.join("\n\n")}\n`;
  const path = join(dir, proposal.path);
  const document = parseFrontmatter(await readFile(path, "utf8"));
  document.attributes.notion = page;
  document.attributes.notion_published = { "Brain ID": id, "@review": { ...(format === 2 ? { format: 2 } : {}), items: record } };
  await writeFile(path, serializeFrontmatter(document));
  return { body, ids: items.map((item) => item.item_id), wording };
}

/** The wording an item's page showed: the text Accept applies (a fact's value, a text, a draft's body, a link's names, a cleanup's word). */
function wordingOf(workspace: Workspace, a: Record<string, unknown>, entry: Record<string, unknown>, linkTitles: string[] | undefined, format: 1 | 2): string {
  if (CLEANUP_KINDS.includes(entry.kind as never)) return canon(cleanupItemView(workspace.get(String(a.id))!, entry, workspace).proposed);
  if (entry.kind === "note") return canon(workspace.get(String(entry.ref))?.body ?? "");
  if (entry.kind === "link") return (linkTitles ?? []).join("\n");
  const change = list(a.changes)[Number(entry.ref)] ?? {};
  if (change.kind === "update_fact") {
    const markers = format === 2 ? (Array.isArray(entry.passages) ? entry.passages : []).map((passage) => ` ^[${String(passage)}]`).join("") : "";
    return canon(`${String(change.after ?? "")}${markers}`);
  }
  if (change.kind === "replace_line") return canon(String(change.line_after ?? ""));
  return canon(String(change.content ?? ""));
}

/** Set one item's Decision line on a published page. */
export function decideItem(body: string, itemId: string, token: string): string {
  return body.replace(new RegExp(`((?:## \\[[a-z]+ · ${itemId}\\]|ref ${itemId}</span>)[\\s\\S]*?\\nDecision: )Pending`), `$1${token}`);
}

/**
 * A fact change with `before` as 0.15.x folded it into the source's review_notes (0045), first among its changes: since 0.16.0 `proposal new`
 * leaves it a proposal of its own (cli §5.6), but a row published before then holds it. The standalone proposal is removed.
 */
export async function foldAsBefore(dir: string, reviewId: string, factId: string, itemId = "it-0fac7000", extra: Record<string, unknown> = {}): Promise<void> {
  const workspace = await Workspace.open(await openBrain({ brainFlag: dir }));
  const review = workspace.get(reviewId)!; const fact = workspace.get(factId)!;
  const f = fact.attributes;
  const path = join(dir, review.path);
  const document = parseFrontmatter(await readFile(path, "utf8"));
  const a = document.attributes;
  // The fields 0.15.x kept on a folded change (its changeEntry).
  const change = Object.fromEntries(["kind", "target", "why", "field", "before", "after", "from"].filter((key) => f[key] !== undefined).map((key) => [key, f[key]]));
  a.changes = [change, ...list(a.changes)];
  a.items = [{ item_id: itemId, kind: "change", ref: 0, ...(f.passages === undefined ? {} : { passages: f.passages }), ...extra }, ...list(a.items).map((item) => (item.kind === "change" ? { ...item, ref: Number(item.ref) + 1 } : item))];
  await writeFile(path, serializeFrontmatter(document));
  await rm(join(dir, fact.path));
}

/** A fact change with `before` as 0.15.x wrote it when nothing else came from its source: a review_notes of that one change (0045). */
export async function factAsRow(dir: string, factId: string, itemId = "it-0fac7000", extra: Record<string, unknown> = {}): Promise<{ id: string; path: string }> {
  const workspace = await Workspace.open(await openBrain({ brainFlag: dir }));
  const fact = workspace.get(factId)!;
  const path = join(dir, fact.path);
  const document = parseFrontmatter(await readFile(path, "utf8"));
  const f = document.attributes;
  const change = Object.fromEntries(["kind", "target", "why", "field", "before", "after", "from"].filter((key) => f[key] !== undefined).map((key) => [key, f[key]]));
  const item = { item_id: itemId, kind: "change", ref: 0, ...(f.passages === undefined ? {} : { passages: f.passages }), ...extra };
  for (const key of ["target", "field", "before", "after", "from", "passages"]) delete f[key];
  Object.assign(f, { kind: "review_notes", title: "From the source: 1 change", links: [], notes: [], changes: [change], items: [item] });
  await writeFile(path, serializeFrontmatter(document));
  return { id: fact.id, path: fact.path };
}
