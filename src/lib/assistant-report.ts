import { count, dayMonthYear, SIGNAL_LABELS, type FindingsResult, type SkippedSignal } from "./assistant-findings.ts";
import type { Note } from "./notes.ts";

// The report text of spec/assistant.md §4.1: `brain assistant findings` words it, so the skill doesn't.

const CATEGORY_LABELS: Record<string, string> = { overdue: "Overdue", stalled: "Stalled", "no next step": "No next step", structure: "Structure" };
const ANSWER = "Answer with \"yes 1, 2b\", a change (\"1: due Friday\"), \"skip 4 because …\", or \"propose 5\" for a Review row; \"done\" to finish.";

export function reportText(result: FindingsResult, asOf: string, scope: Note | null): string {
  const scopeText = scope === null ? "whole brain" : `${String(scope.attributes.title ?? scope.id)} (${scope.type})`;
  const lines = [`Ultimate Assistant · ${scopeText} · ${dayMonthYear(asOf)}`, secondLine(result)];
  lines.push("");
  if (result.total === 0) {
    lines.push("Nothing needs you.");
    if (result.dismissed > 0) lines.push(`${result.dismissed} skipped for now.`);
    return `${lines.join("\n")}\n`;
  }
  for (const finding of result.findings) {
    lines.push(`${finding.rank}. ${CATEGORY_LABELS[finding.category]} · ${finding.text.subject} · ${finding.text.evidence}`);
    lines.push(finding.recommendations.length === 0
      ? "   no change I can make here: skip it, or say what to do"
      : `   ${finding.recommendations.map((recommendation) => `${recommendation.letter}) ${recommendation.label}`).join("  ")}`);
  }
  lines.push("");
  const more = result.total - result.findings.length;
  if (more > 0) lines.push(`${more} more. Say "more", or name an Area, Domain or Project.`);
  if (result.dismissed > 0) lines.push(`${result.dismissed} skipped for now.`);
  lines.push(ANSWER);
  return `${lines.join("\n")}\n`;
}

function secondLine(result: FindingsResult): string {
  let line: string;
  if (result.mode === "live") {
    const read = result.read;
    const parts = [...(result.tasksOn ? [count(read.tasks, "task")] : []), count(read.projects, "project"), count(read.areas, "area")];
    line = `Notion read live: ${parts.join(", ")}.`;
    const missing = [[read.projects_not_in_brain, "project"], [read.areas_not_in_brain, "area"]] as const;
    const left = missing.filter(([n]) => n > 0);
    if (left.length > 0) {
      const verb = left.length === 1 && left[0]![0] === 1 ? "isn't" : "aren't";
      line += ` ${left.map(([n, noun]) => count(n, noun)).join(" and ")} ${verb} in the brain yet: run a sync.`;
    }
  } else {
    line = result.statuses_as_of === null
      ? "Notion unreachable: brain only; tasks not checked."
      : `Notion unreachable: brain only. Statuses as of ${dayMonthYear(result.statuses_as_of)}; tasks not checked.`;
  }
  const sentences = skippedSentences(result.skipped_signals);
  for (const repo of result.repos_failed) sentences.push(`Repo ${repo.name} not read: ${repo.error}.`);
  return [line, ...sentences].join(" ");
}

function skippedSentences(skipped: readonly SkippedSignal[]): string[] {
  const sentences: string[] = [];
  const off = skipped.filter((entry) => entry.reason === "MODULE_OFF");
  if (off.some((entry) => entry.signal !== "area_no_domain")) sentences.push("Tasks module off: tasks not checked.");
  if (off.some((entry) => entry.signal === "area_no_domain")) sentences.push("Domains module off: Areas without a Domain not checked.");
  for (const property of ["status", "due", "project"] as const) {
    const labels = skipped.filter((entry) => entry.reason === "NOT_MAPPED" && entry.property === property).map((entry) => SIGNAL_LABELS[entry.signal]);
    if (labels.length === 0) continue;
    const joined = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
    sentences.push(`Tasks has no ${property} mapped: ${joined} not checked.`);
  }
  return sentences;
}
