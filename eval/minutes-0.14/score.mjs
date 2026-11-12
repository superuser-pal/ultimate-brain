#!/usr/bin/env node
// Scores one Notion AI output of the lean minutes prompt against decision 0079 §6's bar.
// Usage: node eval/minutes-0.14/score.mjs <output.md> [transcript.md] [--json]
// The output is the page as the Notion API's markdown returns it (README.md, "Running the gate").
// This is the gate's count, not the CLI's parser (spec/capture-and-review.md §4.1 is the contract;
// CC-196 implements it): it reads the same tags, the same toggle and the same quote rule.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ITEM = /\[s(\d+)\.i(\d+)\]/gi;
const SUBJECT = /\[s(\d+)\]/gi;
const FOLLOW_UP = /\[q(\d+)\]/i;
const PREFIX = /^(?:track:\s*waiting on\s*[—–-]\s*)?(decided|open|concern|waiting on [^:]+|idea):/i;

export function fold(text) {
  return text
    .normalize("NFKC")
    .replace(/[​-‏⁠﻿]/g, "")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/\\([\\`*_{}\[\]()#+\-.!<>|~"'$])/g, "$1");
}

function squash(text) {
  return text.replace(/\s+/g, " ").trim();
}

function words(text) {
  return squash(text).split(" ").filter(Boolean).length;
}

// Removes list and to-do markers, heading marks and emphasis around tags, so a line reads as its text.
function bare(line) {
  return squash(line)
    .replace(/^>\s*/, "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, "")
    .replace(/[*_`]+(\[[sq]\d+(?:\.i\d+)?\])[*_`]+/gi, "$1")
    .trim();
}

export function paragraphs(transcript) {
  return fold(transcript)
    .split(/\n\s*\n/)
    .map(squash)
    .filter(Boolean);
}

// Finds the For the brain toggle and says in which form Notion wrote it.
function findToggle(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i].trim();
    const inline = text.match(/^<details[^>]*>\s*<summary>(.*?)<\/summary>(.*)$/i);
    const opener = /^<details[^>]*>$/i.test(text) ? lines[i + 1]?.trim().match(/^<summary>(.*?)<\/summary>(.*)$/i) : null;
    const summary = inline ?? opener;
    if (summary && isForTheBrain(summary[1])) {
      const start = opener ? i + 2 : i + 1;
      const first = summary[2].trim();
      let depth = 1;
      let end = lines.length;
      for (let j = start; j < lines.length; j += 1) {
        const t = lines[j].trim();
        depth += (t.match(/<details[^>]*>/gi) ?? []).length;
        depth -= (t.match(/<\/details>/gi) ?? []).length;
        if (depth <= 0) {
          end = j;
          break;
        }
      }
      const body = lines.slice(start, end).map((line) => line.replace(/<\/details>\s*$/i, ""));
      if (first) body.unshift(first);
      return { form: "details", from: i, to: end, body, closed: end < lines.length };
    }
    if (isForTheBrain(text.replace(/\{toggle="true"\}/i, "").replace(/^#{1,6}\s+/, "")) && /^#{1,6}\s/.test(text)) {
      return { form: /\{toggle="true"\}/i.test(text) ? "toggle heading" : "heading", from: i, to: i, body: [], closed: false };
    }
    if (isForTheBrain(bare(text))) return { form: "plain line", from: i, to: i, body: [], closed: false };
  }
  return { form: "missing", from: -1, to: -1, body: [], closed: false };
}

function isForTheBrain(text) {
  return /^for the brain:?$/i.test(squash(text.replace(/[*_]/g, "")));
}

function tagsOf(line) {
  const items = [...line.matchAll(ITEM)].map((m) => `s${Number(m[1])}.i${Number(m[2])}`);
  const subjects = [...line.replace(ITEM, "").matchAll(SUBJECT)].map((m) => `s${Number(m[1])}`);
  return { items, subjects };
}

// A tag must be at the end of the line's text (or at its start, as the inline-quote grammar allows).
function tagPlace(text, tag) {
  const escaped = tag.replace(/[.[\]]/g, "\\$&");
  if (new RegExp(`\\[${escaped}\\]$`, "i").test(text)) return "end";
  if (new RegExp(`^\\[${escaped}\\]`, "i").test(text)) return "start";
  return "middle";
}

export function score(outputText, transcriptText) {
  const lines = fold(outputText).replace(/\r\n/g, "\n").split("\n");
  const toggle = findToggle(lines);
  const paras = paragraphs(transcriptText);
  const readable = lines.filter((_, i) => i < toggle.from || i > toggle.to);

  const items = [];
  const followUps = [];
  const unnumbered = [];
  const problems = [];
  const subjects = new Set();
  let group = null;
  let inScope = false;
  let oneLine = false;

  for (const raw of readable) {
    const t = raw.trim();
    if (!t) continue;
    if (/^<details/i.test(t) && /scope/i.test(t + "")) {
      inScope = true;
      if (/<\/details>/i.test(t)) inScope = false;
      continue;
    }
    if (/^<details[^>]*>$/i.test(t)) {
      inScope = true;
      continue;
    }
    if (inScope) {
      if (/<\/details>/i.test(t)) inScope = false;
      continue;
    }
    if (/^<\/?(summary|details)/i.test(t)) continue;
    const text = bare(t);
    const plain = text.replace(/[*_]/g, "").replace(/:$/, "").replace(/\s*\(.*\)$/, "").trim().toLowerCase();
    if (/^in one line\s*:/i.test(text.replace(/[*_]/g, ""))) {
      oneLine = true;
      group = null;
      continue;
    }
    if (plain === "quick follow-ups" || plain === "quick follow ups") {
      group = "quick";
      continue;
    }
    if (plain === "tasks for the brain" || plain === "tasks") {
      group = "tasks";
      continue;
    }
    const { items: itemTags, subjects: subjectTags } = tagsOf(text);
    const isHeading = /^#{1,6}\s/.test(t);
    if (group === "quick") {
      const todo = t.match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/);
      if (todo) {
        const q = bare(t).match(/\[q(\d+)\]$/i);
        followUps.push({ text: squash(todo[2]), q: q ? `q${Number(q[1])}` : null, done: todo[1] !== " " });
        continue;
      }
      if (isHeading && subjectTags.length === 1 && itemTags.length === 0) group = null;
      else if (isHeading) continue;
      else {
        problems.push(`a line in Quick follow-ups that is not a to-do: ${text}`);
        continue;
      }
    }
    if (isHeading && subjectTags.length === 1 && itemTags.length === 0) {
      if (tagPlace(text, `s${subjectTags[0].slice(1)}`) === "middle") problems.push(`a subject tag in the middle of a heading: ${text}`);
      subjects.add(subjectTags[0]);
      group = { subject: subjectTags[0] };
      continue;
    }
    if (isHeading && itemTags.length === 0 && subjectTags.length === 0) continue;
    if (group === null) {
      if (/^(?:[-*+]|\d+\.)\s/.test(t) && itemTags.length === 0) unnumbered.push(text);
      continue;
    }
    if (itemTags.length === 1 && subjectTags.length === 0) {
      const id = itemTags[0];
      const place = tagPlace(text, id);
      if (place === "middle") problems.push(`a tag in the middle of a line: ${text}`);
      const body = squash(text.replace(`[${id}]`, "").replace(/\[s\d+\.i\d+\]/i, ""));
      const where = group === "tasks" ? "tasks" : group.subject;
      if (where !== "tasks" && !id.startsWith(`${where}.`)) problems.push(`${id} sits under ${where}`);
      if (/^(meeting only|use in brain)\s*:/i.test(body.replace(/^track:\s*waiting on\s*[—–-]\s*/i, ""))) problems.push(`a selection token on a readable line: ${id}`);
      if (/"[^"]{3,}"/.test(body)) problems.push(`a quote on a readable line: ${id}`);
      const prefix = body.match(PREFIX)?.[1] ?? null;
      items.push({ id, where, text: body, prefix, words: words(body) });
      continue;
    }
    if (itemTags.length > 1 || (itemTags.length === 1 && subjectTags.length > 0)) {
      problems.push(`two tags on one line: ${text}`);
      continue;
    }
    if (/^selection\s*:/i.test(text.replace(/^\[s\d+\]\s*/i, ""))) {
      problems.push(`a Selection line outside the toggle: ${text}`);
      continue;
    }
    unnumbered.push(text);
  }

  // The toggle: Attendees, Projects, the sentence, Selection lines and quote entries.
  const entries = new Map();
  const selections = new Map();
  const toggleLines = { attendees: null, projects: null, sentence: false, other: [] };
  for (const raw of toggle.body) {
    const t = raw.trim();
    if (!t) continue;
    if (/<details/i.test(t)) {
      problems.push("a toggle inside For the brain");
      continue;
    }
    const text = bare(t);
    if (/^attendees\s*:/i.test(text)) toggleLines.attendees = squash(text.replace(/^attendees\s*:/i, ""));
    else if (/^projects\s*:/i.test(text)) toggleLines.projects = squash(text.replace(/^projects\s*:/i, ""));
    else if (/all subjects included unless marked meeting only/i.test(text)) toggleLines.sentence = true;
    else if (/^\[s\d+\]\s*selection\s*:/i.test(text)) {
      const m = text.match(/^\[s(\d+)\]\s*selection\s*:\s*(.*)$/i);
      const subject = `s${Number(m[1])}`;
      if (selections.has(subject)) problems.push(`two Selection lines for ${subject}`);
      selections.set(subject, squash(m[2]));
    } else {
      const m = text.match(/^(?:(meeting only|use in brain)\s*:\s*)?\[s(\d+)\.i(\d+)\]\s*(?:→|->|:|—)?\s*(?:(meeting only|use in brain)\s*:\s*)?(.*)$/i);
      if (m) {
        const id = `s${Number(m[2])}.i${Number(m[3])}`;
        if (entries.has(id)) problems.push(`two quote entries for ${id}`);
        const rest = m[5];
        const quotes = [...rest.matchAll(/"([^"]+)"/g)].map((q) => squash(q[1]));
        entries.set(id, { quotes, token: m[1] ?? m[4] ?? null, dependsOn: rest.match(/depends on \[(s\d+(?:\.i\d+)?)\]/i)?.[1] ?? null });
      } else toggleLines.other.push(text);
    }
  }

  const seen = new Map();
  for (const item of items) seen.set(item.id, (seen.get(item.id) ?? 0) + 1);
  for (const [id, n] of seen) if (n > 1) problems.push(`${id} on ${n} readable lines`);
  const qSeen = new Map();
  for (const f of followUps) if (f.q) qSeen.set(f.q, (qSeen.get(f.q) ?? 0) + 1);
  for (const [q, n] of qSeen) if (n > 1) problems.push(`${q} on ${n} to-dos (DUPLICATE_FOLLOW_UP)`);
  for (const subject of selections.keys()) if (!subjects.has(subject)) problems.push(`a Selection line for ${subject}, which has no heading`);
  for (const subject of subjects) if (!selections.has(subject)) problems.push(`no Selection line for ${subject}`);
  for (const [subject, value] of selections) if (!/^(use in brain|meeting only)$/i.test(value)) problems.push(`${subject} Selection value "${value}"`);

  const itemIds = new Set(items.map((i) => i.id));
  const orphans = [...entries.keys()].filter((id) => !itemIds.has(id));

  const scored = items.map((item) => {
    const entry = entries.get(item.id);
    const quotes = (entry?.quotes ?? []).map((quote) => {
      const hits = paras.filter((p) => p.includes(quote)).length;
      return { quote, words: words(quote), paragraphs: hits };
    });
    const pass = quotes.length > 0 && quotes.every((q) => q.paragraphs === 1);
    const found = quotes.some((q) => q.paragraphs >= 1);
    return { ...item, entry: entry ? { token: entry.token, dependsOn: entry.dependsOn } : null, quotes, pass, found };
  });

  const passed = scored.filter((s) => s.pass).length;
  const total = scored.length;
  const withQ = followUps.filter((f) => f.q).length;
  const bar = {
    toggle: toggle.form === "details",
    items: total > 0 && passed / total >= 0.9,
    followUps: followUps.length > 0 && withQ === followUps.length,
  };
  return {
    toggle: { form: toggle.form, closed: toggle.closed, ...toggleLines },
    oneLine,
    subjects: [...subjects],
    items: scored,
    followUps,
    orphans,
    unnumbered,
    problems,
    counts: {
      items: total,
      items_passed: passed,
      items_with_entry: scored.filter((s) => s.entry).length,
      items_any_quote_found: scored.filter((s) => s.found).length,
      quotes: scored.reduce((n, s) => n + s.quotes.length, 0),
      quotes_over_12_words: scored.reduce((n, s) => n + s.quotes.filter((q) => q.words > 12).length, 0),
      lines_over_15_words: scored.filter((s) => !/^s\d+\.i1$/.test(s.id) && s.words > 15).length,
      follow_ups: followUps.length,
      follow_ups_with_q: withQ,
    },
    bar: { ...bar, pass: bar.toggle && bar.items && bar.followUps },
  };
}

function report(result) {
  const c = result.counts;
  const out = [];
  out.push(`For the brain toggle: ${result.toggle.form}${result.toggle.form === "details" && !result.toggle.closed ? " (never closed)" : ""}`);
  out.push(`In one line: ${result.oneLine ? "yes" : "no"}; subjects: ${result.subjects.join(", ") || "none"}; Attendees ${result.toggle.attendees ? "yes" : "no"}, Projects ${result.toggle.projects ? "yes" : "no"}, sentence ${result.toggle.sentence ? "yes" : "no"}`);
  out.push(`Items with an id and quotes that occur, each in exactly one paragraph: ${c.items_passed} of ${c.items}`);
  out.push(`Items with a quote entry: ${c.items_with_entry} of ${c.items}; with at least one quote found: ${c.items_any_quote_found}`);
  out.push(`Quotes: ${c.quotes}, over 12 words: ${c.quotes_over_12_words}; readable lines over 15 words (gists aside): ${c.lines_over_15_words}`);
  out.push(`Follow-ups with a q id: ${c.follow_ups_with_q} of ${c.follow_ups}`);
  for (const item of result.items) {
    if (item.pass) continue;
    const why = item.entry ? item.quotes.map((q) => `"${q.quote}" (${q.words} words, in ${q.paragraphs} paragraphs)`).join("; ") || "no quotes" : "no quote entry";
    out.push(`  miss ${item.id}: ${why}`);
  }
  for (const id of result.orphans) out.push(`  quote entry with no readable line: ${id}`);
  for (const line of result.unnumbered) out.push(`  unnumbered line: ${line}`);
  for (const p of result.problems) out.push(`  problem: ${p}`);
  out.push(`Bar (0079 §6): toggle ${result.bar.toggle ? "pass" : "FAIL"}, items ${result.bar.items ? "pass" : "FAIL"}, follow-ups ${result.bar.followUps ? "pass" : "FAIL"} → ${result.bar.pass ? "PASS" : "FAIL"}`);
  return `${out.join("\n")}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2).filter((a) => a !== "--json");
  if (args.length < 1) {
    process.stderr.write("Usage: node eval/minutes-0.14/score.mjs <output.md> [transcript.md] [--json]\n");
    process.exit(2);
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const result = score(readFileSync(args[0], "utf8"), readFileSync(args[1] ?? join(here, "transcript.md"), "utf8"));
  process.stdout.write(process.argv.includes("--json") ? `${JSON.stringify(result, null, 2)}\n` : report(result));
  process.exitCode = result.bar.pass ? 0 : 1;
}
