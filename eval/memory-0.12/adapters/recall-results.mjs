#!/usr/bin/env node
// Prints the measured part of results-recall-0.12.txt (CC-172): score.mjs's report for the recall adapter, then every
// pack's measured tokens beside the CLI's estimate ⌈bytes ÷ 3⌉ and its budget (spec/memory.md §5.2).
// Usage: node eval/memory-0.12/adapters/recall-results.mjs <out-dir>   (what make-brain.mjs wrote)
// Not an adapter: score.mjs loads only the module named by --adapter.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { TOKENIZER } from "./recall.mjs";

const out = process.argv[2];
if (!out || out.startsWith("--")) {
  console.error("usage: recall-results.mjs <out-dir>");
  process.exit(2);
}
const SCORE = fileURLToPath(new URL("../score.mjs", import.meta.url));
const score = (...flags) => execFileSync("node", [SCORE, out, "--adapter", "recall", ...flags], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const report = score().trimEnd();
const { rows } = JSON.parse(score("--json"));
const packs = rows.filter((r) => r.cost?.phase === "opening");
const lines = [report, "", `packs (opening): measured with ${TOKENIZER}; estimate is the CLI's \`tokens\`, ⌈bytes ÷ 3⌉ is recomputed from \`text\``, ""];
lines.push("| case | text bytes | measured | estimate | ⌈bytes ÷ 3⌉ | budget | within budget | omitted (memories, work) | work_unread |", "|---|---|---|---|---|---|---|---|---|");
for (const r of packs) {
  const c = r.cost;
  const within = c.tokens <= c.budget && c.estimate <= c.budget;
  lines.push(`| ${r.id} | ${c.textBytes} | ${c.tokens} | ${c.estimate} | ${c.estimateFromBytes} | ${c.budget} | ${within ? "yes" : "NO"} | ${c.omitted.memories}, ${c.omitted.work} | ${c.workUnread ?? "—"} |`);
}
const over = packs.filter((r) => r.cost.tokens > r.cost.budget || r.cost.estimate > r.cost.budget);
const mismatch = packs.filter((r) => r.cost.estimate !== r.cost.estimateFromBytes);
const ratio = packs.length ? Math.max(...packs.map((r) => r.cost.tokens / r.cost.estimate)) : 0;
lines.push("");
lines.push(`packs: ${packs.length}; over budget: ${over.length}; estimate ≠ ⌈bytes ÷ 3⌉: ${mismatch.length}; highest measured ÷ estimate: ${ratio.toFixed(2)}`);
console.log(lines.join("\n"));
