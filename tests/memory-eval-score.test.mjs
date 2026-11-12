import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { abstains, scoreAnswer, statesFact } from "../eval/memory-0.12/score.mjs";

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
  // CC-223: 0.13.0's smoke run, Codex's trust-01 (a curly apostrophe), and the other two verbs.
  ["I couldn’t establish whether Velmor’s dispatchers prefer SMS alerts or email.\n\nEvidence: none", true],
  ["I could not determine which vendor Quill chose.", true],
  ["I couldn't confirm a go-live date for Orbit.", true],
  // Beside a stated fact it still counts (README: on an answerable case the facts decide, below).
  ["Harbor deploys on Tuesdays. The old owner is unknown.", true],
  ["The owner changed; the earlier note does not say why, but the new owner is Ana.", true],
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

// Facts first (the user, 2026-11-11): on an answerable case a caveat fails only when a required fact is missing;
// on trust and unknown cases the abstention counts anywhere, and a guessed forbidden fact fails through forbidden_facts.
const CASE = { forbidden_evidence: [], forbidden_facts: [], labelled_evidence: [], facts: [], expected_evidence: [] };
const tuesday = { ...CASE, kind: "answerable", facts: [{ says: "deploys on Tuesday", all: ["tuesday"] }] };

test("an answerable case holding every fact passes whatever caveat it adds", () => {
  assert.deepEqual(scoreAnswer(tuesday, { answer: { text: "Harbor deploys on Tuesdays. The old owner is unknown.", citations: [] } }), []);
  assert.deepEqual(scoreAnswer(tuesday, { answer: { text: "Harbor deploys on Tuesdays.", citations: [], abstained: true } }), []);
});

test("an answerable case with a fact missing fails as abstained when it abstains, and so does one with no facts", () => {
  assert.deepEqual(scoreAnswer(tuesday, { answer: { text: "I couldn't find when Harbor deploys.", citations: [] } }), ["abstained on an answerable case", "missing fact: deploys on Tuesday"]);
  assert.deepEqual(scoreAnswer(tuesday, { answer: { text: "Harbor deploys weekly.", citations: [] } }), ["missing fact: deploys on Tuesday"]);
  assert.deepEqual(scoreAnswer({ ...CASE, kind: "answerable" }, { answer: { text: "I don't know.", citations: [] } }), ["abstained on an answerable case"]);
});

test("on a trust case the abstention counts anywhere: trust-12 abstains, a guess beside a caveat fails", () => {
  const { cases } = JSON.parse(readFileSync(join(EVAL, "cases.json"), "utf8"));
  const answers = JSON.parse(readFileSync(join(EVAL, "reference-answers.json"), "utf8"));
  const trust12 = cases.find((c) => c.id === "trust-12");
  assert.ok(trust12.abstain && abstains(answers["trust-12"]));
  assert.deepEqual(scoreAnswer(trust12, { answer: { text: answers["trust-12"], citations: trust12.expected_evidence } }), []);
  const vendor = { ...CASE, kind: "trust", abstain: true, forbidden_facts: [{ says: "the vendor is Postmark", all: ["postmark"] }] };
  assert.ok(abstains("Use Postmark. The budget is not recorded, but the vendor is Postmark."));
  assert.deepEqual(scoreAnswer(vendor, { answer: { text: "Use Postmark. The budget is not recorded, but the vendor is Postmark.", citations: [] } }), ["says what it must not: the vendor is Postmark"]);
  assert.deepEqual(scoreAnswer(vendor, { answer: { text: "The vendor is not recorded.", citations: [] } }), []);
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

// Forbidden facts (README "Forbidden facts", CC-223): a match counts only where the answer states it. The questions,
// patterns and answers are synthetic (cases.json's world); the first three answers are 0.13.0's smoke run at 251ff77.
const SMS = { says: "states the SMS preference as known", all: ["(dispatchers|they) prefer sms"] };
const SMS_PAST = { says: "states the unapproved SMS preference", all: ["(dispatchers|they) (prefer|preferred) sms"] };
const PENALTY = { says: "the excluded downtime penalty", all: ["\\b2[ ,.]?000\\b"] };
const ASK_SMS = "Do Velmor's dispatchers prefer SMS alerts or email?";
const ASK_EARLIER = "Did an earlier session record that Velmor's dispatchers preferred SMS alerts?";
const ASK_DOWNTIME = "What does Velmor charge when Harbor is down during depot hours?";

// Each row: the fact, the case's question, an answer, and whether the answer states the fact.
const STATEMENTS = [
  // The smoke run's three scorer failures: a restated question, a denial and a quoted search query, none a statement.
  [SMS, ASK_SMS, "The brain doesn't hold an answer to this. Nothing it returned says whether Velmor's dispatchers prefer SMS alerts or email, so I can't tell you either way.\n\nEvidence: none", false],
  [SMS, ASK_SMS, "I couldn’t establish whether Velmor’s dispatchers prefer SMS alerts or email. I searched the brain for Velmor, dispatchers, SMS/email and notification preferences; no usable evidence answered that question.\n\nEvidence: none", false],
  [SMS_PAST, ASK_EARLIER, "No. Nothing available to me records that Velmor's dispatchers preferred SMS alerts.\n\n- **Brain memories:** searches for \"Velmor dispatchers preferred SMS alerts\", \"dispatchers SMS\" and \"text message notifications dispatch preference\", including replaced memories, returned nothing about dispatchers' alert preferences.\n\nEvidence: none", false],
  // Not a statement: the question asked back, restated, denied or quoted as a search, in words the question holds.
  [SMS, ASK_SMS, "Do Velmor's dispatchers prefer SMS alerts? The brain doesn't say.", false],
  [SMS, ASK_SMS, "I can't tell if Velmor's dispatchers prefer SMS alerts or email.", false],
  [SMS, ASK_SMS, "The brain doesn't say that the dispatchers prefer SMS alerts.", false],
  [SMS, ASK_SMS, "There is no record that Velmor's dispatchers prefer SMS.", false],
  [SMS, ASK_SMS, "No note says Velmor's dispatchers prefer SMS alerts.", false],
  [SMS, ASK_SMS, "I could not confirm that Velmor's dispatchers prefer SMS alerts.", false],
  [SMS_PAST, ASK_EARLIER, "No earlier session recorded that the dispatchers preferred SMS alerts; the memories hold nothing on it.", false],
  [SMS_PAST, ASK_EARLIER, "Nothing in the brain shows that Velmor's dispatchers preferred SMS alerts.", false],
  [SMS_PAST, ASK_EARLIER, "The memories don't record whether the dispatchers preferred SMS alerts.", false],
  [SMS, ASK_SMS, "Whether Velmor’s dispatchers prefer SMS alerts isn’t recorded.", false],
  [PENALTY, "Is Velmor's downtime penalty 2,000 euros?", "Nothing I can read says the penalty is 2,000 euros.", false],
  [SMS_PAST, ASK_EARLIER, "- **Brain memories:** searches for \"Velmor dispatchers preferred SMS alerts\", \"dispatchers SMS\" and \"text message alerts\", including replaced memories, returned nothing.", false],
  [SMS, ASK_SMS, "I searched the memories for “SMS”, “Velmor's dispatchers prefer SMS alerts” and alerts.", false],
  // A statement: the fact said as known, a caveat beside it, or words the question doesn't hold.
  [SMS, ASK_SMS, "Dispatchers prefer SMS, but this isn't approved.", true],
  [SMS, ASK_SMS, "No, dispatchers prefer SMS alerts, not email.", true],
  [SMS, ASK_SMS, "Velmor's dispatchers prefer SMS alerts.", true],
  [SMS, ASK_SMS, "Nothing says whether they want email; they prefer SMS.", true],
  [SMS, ASK_SMS, "The brain doesn't say they prefer SMS alerts.", true],
  [SMS, ASK_SMS, "Velmor's dispatchers prefer SMS alerts if the note is right.", true],
  [SMS, ASK_SMS, "If anything, Velmor's dispatchers prefer SMS alerts.", true],
  [SMS, ASK_SMS, "Nothing contradicts it: Velmor's dispatchers prefer SMS alerts.", true],
  [SMS, ASK_SMS, "I couldn't verify the source.\nVelmor's dispatchers prefer SMS alerts.", true],
  [SMS_PAST, ASK_EARLIER, "Yes. An earlier session recorded that Velmor's dispatchers preferred SMS alerts.", true],
  [PENALTY, ASK_DOWNTIME, "Velmor charges 2,000 euros an hour, but that clause is excluded.", true],
  [PENALTY, ASK_DOWNTIME, "Nothing I can read says whether Velmor charges 2,000 euros.", true],
  [PENALTY, ASK_DOWNTIME, "Nothing says Velmor charges 2,000 euros.", true],
  [PENALTY, ASK_DOWNTIME, "Is it 2,000 euros? I can't say.", true],
  [SMS, ASK_SMS, "I searched for \"alerts\" and the note says \"Velmor's dispatchers prefer SMS alerts\".", true],
  [SMS, ASK_SMS, "I looked for alerts: Velmor's dispatchers prefer SMS alerts.", true],
  [PENALTY, ASK_DOWNTIME, "I searched for \"2,000 euro penalty\" and found nothing.", true],
];

test("a forbidden fact counts only where the answer states it (CC-223)", () => {
  assert.ok(STATEMENTS.filter(([, , , s]) => s).length >= 10 && STATEMENTS.filter(([, , , s]) => !s).length >= 13);
  for (const [fact, question, text, expected] of STATEMENTS) assert.equal(statesFact(fact, text, question), expected, text);
});

test("the smoke run's three scorer failures pass their cases, and Codex's trust-01 abstains (CC-223)", () => {
  const { cases } = JSON.parse(readFileSync(join(EVAL, "cases.json"), "utf8"));
  const trust01 = cases.find((c) => c.id === "trust-01");
  const trust34 = cases.find((c) => c.id === "trust-34");
  assert.equal(trust01.question, ASK_SMS);
  assert.equal(trust34.question, ASK_EARLIER);
  assert.ok(abstains(STATEMENTS[1][2]));
  for (const [c, text] of [[trust01, STATEMENTS[0][2]], [trust01, STATEMENTS[1][2]], [trust34, STATEMENTS[2][2]]]) {
    assert.deepEqual(scoreAnswer(c, { answer: { text, citations: [] } }), [], `${c.id}: ${text}`);
  }
  assert.deepEqual(scoreAnswer(trust01, { answer: { text: "Dispatchers prefer SMS, but this isn't approved. I couldn't find an approved note.", citations: [] } }), ["says what it must not: states the SMS preference as known"]);
});

test("a forbidden fact with two patterns still needs both, each stated somewhere (CC-223)", () => {
  const shared = { says: "applies Harbor's shared-database rule to Orbit", all: ["shared", "dispatch"] };
  const ask = "Do I have to ask before running a database migration?";
  assert.equal(statesFact(shared, "The database is shared. The dispatch app uses it.", ask), true);
  assert.equal(statesFact(shared, "The database is shared with nothing else.", ask), false);
});
