#!/usr/bin/env node
// CC-67: checks a sandbox's brain against ../planted.json: `brain reflect --candidates` gives every planted cluster and the
// expected total (or, for a clean sandbox, none). Run after `. <sandbox>/env.sh`: node check-planted.mjs <sandbox> [clean]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const [sandbox, variant] = process.argv.slice(2);
const planted = JSON.parse(readFileSync(new URL("../planted.json", import.meta.url), "utf8"));
const data = JSON.parse(execFileSync("brain", ["reflect", "--candidates", "--brain", join(sandbox, "brain"), "--json"], { encoding: "utf8" })).data;
const keys = new Set(data.clusters.map((cluster) => cluster.key));
const problems = [];
if (variant === "clean") {
  if (data.total !== 0) problems.push(`clean: ${data.total} clusters, expected 0`);
} else {
  if (data.total !== planted.clusters_total) problems.push(`total ${data.total}, expected ${planted.clusters_total}`);
  for (const item of planted.planted) if (!keys.has(item.cluster)) problems.push(`planted ${item.n}: no cluster ${item.cluster}`);
  if ([...keys].some((key) => key.includes("onboarding"))) problems.push("onboarding survey is a cluster");
}
for (const problem of problems) console.error(problem);
console.log(problems.length === 0 ? `planted OK: ${data.total} clusters, ${variant === "clean" ? "clean" : `${planted.planted.length} planted`}` : `${problems.length} problem(s)`);
process.exit(problems.length === 0 ? 0 : 1);
