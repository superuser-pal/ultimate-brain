import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { abstains, scoreAnswer } from "../eval/memory-0.12/score.mjs";

// The memory evaluation's abstain rule (eval/memory-0.12/README.md "Abstention", CC-201). The answers are synthetic.
const EVAL = join(dirname(fileURLToPath(import.meta.url)), "..", "eval", "memory-0.12");

// Each row: an answer's text, and whether it says the brain does not hold what was asked.
const PHRASINGS = [
  // CC-200's smoke run (PR #303): two correct abstentions the old pattern missed, and an answer it took for one.
  ["I couldn't find it in the brain, so I can't give you the staging password.", true],
  ["I couldn't find the staging database password.\n\nEvidence: none", true],
  ["T-12 stopped after the export endpoint; next is the retry queue. The row has no recorded decision on the cache, so keep the current one.\n\nEvidence: T-12", false],
  // Saying the speaker or the brain lacks the answer: an abstention wherever it stands.
  ["I couldn’t find anything about Orbit's go-live date.", true],
  ["I can't find a note about the vendor.", true],
  ["I didn't find a decision on that.", true],
  ["I was unable to locate a vendor decision for Quill.", true],
  ["That isn't in the brain.", true],
  ["The brain has no information about Orbit's budget.", true],
  ["There is no record of a discount for Tandrel.", true],
  ["I don't know: the brain doesn't say.", true],
  ["Nothing is recorded about the QA contractor.", true],
  ["Orbit's budget isn't documented.", true],
  ["I couldn't find the password in the brain. You could ask Harbor's team lead.", true],
  // Saying a thing is absent: an abstention only when the answer says nothing else.
  ["There is no recorded decision on the vendor.", true],
  ["No deploy freeze is recorded for Orbit.\n\n**Evidence:** none", true],
  ["I searched the brain for the go-live date. No go-live date is recorded for Orbit.", true],
  ["- No vendor decision is in the brain.", true],
  ["There is no recorded decision on the vendor; the team chose Postmark at the kickoff.", false],
  ["Use npm workspaces: pnpm is retired. No other package manager is recorded for Harbor.", false],
  ["The freeze starts Thursday at 16:00; no exceptions are recorded, and it lasts until Monday.", false],
  // Answers that use the words without saying anything is missing.
  ["Harbor is hosted on Hetzner in Germany now; the Fly.io decision is superseded.", false],
  ["No. Use npm workspaces: pnpm is retired.", false],
  ["Velmor is invoiced monthly, as recorded in the pricing call.", false],
  ["Nobody recorded a second reason; the team picked SES for deliverability.", false],
  ["The record shows the API ships before the web app.", false],
  ["I searched the brain: Harbor deploys on Tuesdays.", false],
  ["Monitoring is 99.5 percent a month (see knowledge/decisions/uptime.md).", false],
];

test("the abstain rule reads each phrasing as the README says (CC-201)", () => {
  assert.ok(PHRASINGS.filter(([, a]) => a).length >= 10 && PHRASINGS.filter(([, a]) => !a).length >= 10);
  for (const [text, expected] of PHRASINGS) assert.equal(abstains(text), expected, text);
});

test("an adapter's abstained flag counts whatever its text says", () => {
  const unknown = { kind: "unknown", forbidden_evidence: [], forbidden_facts: [], labelled_evidence: [], facts: [], expected_evidence: [] };
  assert.deepEqual(scoreAnswer(unknown, { answer: { text: "Here is a guess.", citations: [], abstained: true } }), []);
  assert.deepEqual(scoreAnswer(unknown, { answer: { text: "Here is a guess.", citations: [] } }), ["does not say the brain lacks the answer"]);
});

test("the smoke run's answers score as what they are: the unknown passes, the answer is not an abstention", () => {
  const unknown = { kind: "unknown", forbidden_evidence: [], forbidden_facts: [], labelled_evidence: [], facts: [], expected_evidence: [] };
  assert.deepEqual(scoreAnswer(unknown, { answer: { text: PHRASINGS[1][0], citations: [] } }), []);
  const answerable = { kind: "answerable", forbidden_evidence: [], forbidden_facts: [], labelled_evidence: [], facts: [{ says: "the retry queue", all: ["retry queue"] }], expected_evidence: ["repo:harbor-api/build/TASKS.md#T-12"] };
  assert.deepEqual(scoreAnswer(answerable, { answer: { text: PHRASINGS[2][0], citations: ["repo:harbor-api/build/TASKS.md#T-12"] } }), []);
});

test("every reference answer abstains exactly where its case asks", () => {
  const { cases } = JSON.parse(readFileSync(join(EVAL, "cases.json"), "utf8"));
  const answers = JSON.parse(readFileSync(join(EVAL, "reference-answers.json"), "utf8"));
  for (const c of cases) {
    const entry = answers[c.id];
    const text = typeof entry === "string" ? entry : entry.text;
    if (c.kind === "unknown" || c.abstain) assert.ok(abstains(text), `${c.id} must abstain: ${text}`);
    if (c.kind === "answerable") assert.ok(!abstains(text), `${c.id} must not abstain: ${text}`);
  }
});
