// CC-392: are a Skills database's pages the product's skills? Offline: the agent reads the database, this compares
// (decision 0015). How a release uses it is in docs/releasing.md.
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

const USAGE = `Usage: node scripts/skills-pages-check.mjs <pages.json>

<pages.json> is what an agent read from one Skills database, one entry per page, and is never committed:
  [{"name": "Today", "description": "Goal: ...", "body": ""}, ...]
name is the page's title, whatever its property is called (Skill name in the template, Name in a space built by
Prompt 9); description is the Description property; body is the page's text. description and body are the plain_text
of their rich text, joined: an empty one is "". In a body, each block is a line with its Markdown marker, and a code
block is its text.`;

const NOTION = join(import.meta.dirname, "..", "notion");

/** The lines of each ```text block. */
function textBlocks(lines) {
  const blocks = [];
  let block = null;
  for (const line of lines) {
    if (block === null && line === "```text") block = [];
    else if (block !== null && line === "```") {
      blocks.push(block.join("\n"));
      block = null;
    } else block?.push(line);
  }
  return blocks;
}

/** The skills of brain-assistant.md's "Skills": name, its Description line, its text block, and whether that block is
 *  always the body (a skill with no block names its source on its Text: line: Write minutes). */
export function parseSkills(assistant, readSource) {
  const sections = [];
  let inSkills = false;
  let fenced = false;
  for (const line of assistant.split(/\r?\n/)) {
    if (line.startsWith("```")) fenced = !fenced;
    if (!fenced && line.startsWith("## ")) inSkills = line.trim() === "## Skills";
    else if (inSkills && !fenced && line.startsWith("### ")) sections.push({ name: line.slice(4).trim(), lines: [] });
    else if (inSkills) sections.at(-1)?.lines.push(line);
  }
  if (sections.length === 0) throw new Error('no skill found under "## Skills"');
  return sections.map(({ name, lines }) => {
    const line = lines.find((text) => text.startsWith("**Description:** "))?.slice("**Description:** ".length);
    let text = textBlocks(lines)[0];
    const inBody = text === undefined;
    if (inBody) {
      const link = /^\*\*Text:\*\* .*?\]\(([^)]+\.md)\)/m.exec(lines.join("\n"))?.[1];
      text = link && textBlocks(readSource(link).split(/\r?\n/))[0];
    }
    if (!line || !text) throw new Error(`${name} has no Description line or no text block`);
    return { name, line, text, inBody };
  });
}

/** The lines that count, each with its number in the text: white space collapsed, empty lines and a fence around the
 *  whole text dropped, and a mention as its page's name ("[@Brain Data]" in the product, "Brain Data" in plain_text). */
function comparable(text) {
  const lines = text.split(/\r?\n/).map((raw, index) => ({
    number: index + 1,
    text: raw.replace(/\[@([^\]]+)\]/g, "$1").replace(/@(?=Brain Data|How it works)/g, "").replace(/\s+/g, " ").trim(),
  })).filter((line) => line.text !== "");
  return lines.length > 1 && lines[0].text.startsWith("```") && lines.at(-1).text === "```" ? lines.slice(1, -1) : lines;
}

/** null when the texts are the same, or where they first differ. */
function firstDifference(product, page) {
  const left = comparable(product);
  const right = comparable(page);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const a = left[index]?.text;
    const b = right[index]?.text;
    if (a !== b) return { line: left[index]?.number, product: a, page: b };
  }
  return null;
}

/** One result per skill, in the product's order, then one per page that is no skill's. */
export function comparePages(skills, pages) {
  const normal = (name) => name.replace(/\s+/g, " ").trim();
  const left = new Set(pages);
  const results = skills.map((skill) => {
    const page = pages.find((candidate) => normal(candidate.name) === skill.name);
    if (page === undefined) return { name: skill.name, status: "missing" };
    left.delete(page);
    const noBody = comparable(page.body).length === 0;
    const textInDescription = firstDifference(skill.text, page.description);
    // Description holds the text when the body is empty, or when it is the text whatever the body holds.
    if (!skill.inBody && (noBody || textInDescription === null)) {
      const layout = "the text in Description";
      if (textInDescription) return { name: skill.name, status: "differs", layout, where: "Description", ...textInDescription };
      if (noBody) return { name: skill.name, status: "same", layout };
      return { name: skill.name, status: "differs", layout, where: "the body", product: undefined, page: comparable(page.body)[0].text };
    }
    const layout = skill.inBody ? "its own places, the text in the body" : "the text in the body";
    for (const [where, product, text] of [["Description", skill.line, page.description], ["the body", skill.text, page.body]]) {
      const difference = firstDifference(product, text);
      if (difference) return { name: skill.name, status: "differs", layout, where, ...difference };
    }
    return { name: skill.name, status: "same", layout };
  });
  for (const page of left) {
    const again = skills.some((skill) => skill.name === normal(page.name));
    results.push({ name: normal(page.name) || "(no name)", status: "extra", why: again ? "a second page of this name" : "no skill of notion/brain-assistant.md" });
  }
  return results;
}

/** A line around the first character where it and the other differ. */
function excerpt(line, other) {
  if (line === undefined) return "(nothing)";
  let at = 0;
  while (at < line.length && line[at] === other?.[at]) at++;
  const from = Math.max(0, at - 50);
  return `${from > 0 ? "…" : ""}${line.slice(from, at + 70)}${line.length > at + 70 ? "…" : ""}`;
}

function report(result) {
  const head = `${result.status.padEnd(7)}  ${result.name}`;
  if (result.status === "missing") return head;
  if (result.status === "extra") return `${head}: ${result.why}`;
  if (result.status === "same") return `${head} (${result.layout})`;
  return `${head} (${result.layout}): ${result.where}${result.line ? `, line ${result.line} of the product's text` : ""}
           product: ${excerpt(result.product, result.page)}
           page:    ${excerpt(result.page, result.product)}`;
}

function readPages(path) {
  const pages = JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
  const valid = Array.isArray(pages) && pages.every((page) => ["name", "description", "body"].every((key) => typeof page?.[key] === "string"));
  if (!valid) throw new Error("it must be a list of pages, each with the texts name, description and body");
  return pages;
}

function main(args) {
  if (args.length !== 1) throw new Error("give one file");
  let pages;
  try { pages = readPages(args[0]); }
  catch (error) { throw new Error(`can't read ${args[0]}: ${error.message}`); }
  const read = (file) => readFileSync(join(NOTION, file), "utf8");
  const results = comparePages(parseSkills(read("brain-assistant.md"), read), pages);
  for (const result of results) process.stdout.write(`${report(result)}\n`);
  const counts = ["same", "differs", "missing", "extra"].map((status) => `${results.filter((result) => result.status === status).length} ${status}`);
  process.stdout.write(`${counts.join(" · ")}\n`);
  if (results.some((result) => result.status !== "same")) process.exitCode = 1;
}

if (process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(import.meta.filename)) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write(`${error.message}\n\n${USAGE}\n`);
    process.exitCode = 1;
  }
}
