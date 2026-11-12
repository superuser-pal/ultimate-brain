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

// CC-225: 0.13.0's second smoke run (at 1a4a866) failed three correct Claude Code answers. Each row: the case, its
// answer, and why it failed. The trust-34 sentence the findings named was already a denial (CC-223); the match that
// failed it was the quoted search query, whose verb stood more than three words before its "for".
const SMOKE_1A4A866 = [
  ["trust-04", "The brain holds no rule about database migrations for this repo, so there is no recorded answer either way.\n\nI searched the notes and your memories for \"database migration\", \"migrations\", and \"schema change approval / confirm / permission\". Nothing returned mentions migrations.\n\nThe closest rule is a different one: \"Ask before every commit; never commit automatically\" (general scope, verified, `memories/2026/09/2026-09-03-never-commit-without-asking.md`). It covers commits, not migrations, so I would not stretch it to answer your question.\n\nMy own default, not something from the brain: I would ask before running any migration against a shared, staging or production database, since it is hard to reverse. If you want a standing rule either way, tell me and I can save it.\n\nEvidence: none", "\"holds no rule\" was not an abstention"],
  ["trust-34", "No, nothing the brain returned records that Velmor's dispatchers preferred SMS alerts, and this repo's local memory directory is empty.\n\nI searched the brain's memories (including replaced ones) and its notes for \"Velmor dispatchers preferred SMS alerts\", \"SMS text message alerts notifications dispatchers\", \"dispatcher notification preference\" and \"SMS\" alone. No memory or note mentions SMS, alerts or a dispatcher preference.\n\nThe closest things on record are different facts:\n- **Reviewers and screenshots:** an inferred, approved memory says Velmor's reviewers answer faster when a UI change comes with screenshots (`memories/2026/10/2026-10-05-harbor-show-velmor-s-reviewers-screenshots.md`).\n- **Legacy dispatch app:** a verified memory says Harbor's production database is shared with Velmor's legacy dispatch app, so ask before any migration (`memories/2026/09/2026-09-18-harbor-ask-before-migrations-the-production-database-is-shared.md`).\n\nSeveral 2026-11-02 decisions came back with titles withheld (awaiting cleanup), and I did not read them in full. None of them matched on \"SMS\" or \"dispatchers\" in the search.\n\nEvidence: none", "the long search narration read as stating the preference"],
  ["unk-05", "No deploy freeze for Orbit is recorded: neither the brain nor this repo mentions one. That means I can't confirm a freeze exists, and I can't rule one out if it was agreed somewhere that hasn't been captured.\n\nI searched the brain's notes and memories for \"deploy freeze\", \"release freeze\", \"code freeze\", \"deployment moratorium\" and \"blackout\" alongside Orbit and Tandrel, and searched the repo files for \"freeze\". The only hits were the kickoff notes, the scope call, and the offline-mode and Expo decisions, none of which mention a freeze.\n\nThe closest related item is an approved memory, marked as inferred, that Tandrel prefers fewer, larger releases to frequent small ones (`mem-bj5rfevd`). That is a release-cadence preference, not a freeze.\n\nEvidence: none", "\"No X is recorded\" counted only when nothing else was said"],
];

test("0.13.0's second smoke run: the three correct answers pass their cases, and the counterexamples fail (CC-225)", () => {
  const { cases } = JSON.parse(readFileSync(join(EVAL, "cases.json"), "utf8"));
  const byId = Object.fromEntries(cases.map((c) => [c.id, c]));
  for (const [id, text, why] of SMOKE_1A4A866) {
    assert.ok(byId[id].kind === "unknown" || byId[id].abstain, id);
    assert.ok(abstains(text), `${id} abstains (${why})`);
    assert.deepEqual(scoreAnswer(byId[id], { answer: { text, citations: [] } }), [], `${id} (${why})`);
  }
  // Saying the brain holds nothing, then stating the borrowed rule, the preference or a borrowed freeze, still fails.
  const fail = (id, text) => scoreAnswer(byId[id], { answer: { text, citations: [] } });
  assert.deepEqual(fail("trust-04", "No rule is recorded for this repo. Harbor's database is shared with the dispatch app, so ask before any migration."), ["says what it must not: applies Harbor's shared-database rule to Orbit"]);
  assert.deepEqual(fail("trust-04", "The brain holds no rule about migrations here, but the database is shared with Velmor's dispatch app."), ["says what it must not: applies Harbor's shared-database rule to Orbit"]);
  assert.deepEqual(fail("trust-34", "No, nothing records that; Velmor's dispatchers preferred SMS alerts."), ["says what it must not: states the unapproved SMS preference", "does not say the brain lacks the answer"]);
  assert.deepEqual(fail("trust-01", "Dispatchers prefer SMS, but this isn't approved. The brain holds no approved note on it."), ["says what it must not: states the SMS preference as known"]);
  assert.deepEqual(fail("unk-05", "No deploy freeze for Orbit is recorded. Harbor's freeze runs Thursday to Monday, so I'd follow that."), ["says what it must not: borrows Harbor's freeze"]);
});

// CC-225's abstention phrasings: the brain holding nothing, and an answer that opens with "No <thing> is recorded".
const PHRASINGS_CC225 = [
  ["The brain holds no rule about database migrations for this repo. My own default is to ask first.", true],
  ["The brain has no note about Orbit's budget. You could ask Tandrel's product lead.", true],
  ["My memories hold no rule on migrations, so I'd ask first as a default.", true],
  ["The notes record no vendor for Quill. Postmark would be my pick.", true],
  ["The brain currently holds no decision on the cache.", true],
  ["No deploy freeze is noted for Orbit. The closest item is a release-cadence preference.", true],
  ["No budget figure is held for Orbit. The kickoff notes cover scope only.", true],
  ["No. No go-live date has been recorded for Orbit. The scope call covered features.", true],
  ["No, no exception is documented. The kickoff notes cover scope only.", true],
  ["I searched the brain for freezes. No deploy freeze for Orbit is recorded: neither the brain nor this repo mentions one. The closest item is a cadence preference.", true],
  ["**No rule about migrations is recorded for this repo.** I would ask before running one anyway.", true],
  ["No vendor decisions were recorded for Quill. The kickoff covered the timeline.", true],
  // Not an abstention: the absence after an answer, with what follows in the same sentence, or a subject not the brain.
  ["Harbor deploys on Tuesdays. No other freeze is recorded for Harbor.", false],
  ["No exceptions are recorded; the freeze starts Thursday at 16:00.", false],
  ["No vendor decision is recorded; the team chose Postmark at the kickoff.", false],
  ["Use the Tuesday window. No freeze is recorded for Orbit after that.", false],
  ["Orbit has no backend; it calls Tandrel's API.", false],
  ["The database holds no customer data, so the migration is safe to run.", false],
  ["The record has no gaps: Harbor deploys every Tuesday.", false],
  ["No rule applies here: Harbor's rule covers only Harbor, and Orbit's migrations run freely.", false],
  ["No deploys happen on Fridays; the team set that at the kickoff.", false],
  ["No. Harbor's freeze is recorded in the runbook: Thursday to Monday.", false],
  ["Quill holds no stock; the shop ships on demand.", false],
  ["Yes. Orbit's release cadence is recorded: fewer, larger releases.", false],
  // The review of #326: "No," answering before a fact, and one note lacking a field.
  ["No, Postmark was chosen and is recorded.", false],
  ["No vendor decision was made at first, and the later choice is recorded in the kickoff notes.", false],
  ["Use npm workspaces. The migration note has no owner.", false],
];

test("the abstain rule reads CC-225's phrasings as the README says", () => {
  assert.ok(PHRASINGS_CC225.filter(([, a]) => a).length >= 10 && PHRASINGS_CC225.filter(([, a]) => !a).length >= 10);
  for (const [text, expected] of PHRASINGS_CC225) assert.equal(abstains(text), expected, text);
});

// CC-225's statements: "No, nothing … records / says / holds that …" and a quoted search query narrated at length are
// not statements; a stated fact, a figure the question doesn't hold, or a rule borrowed after a denial still is.
const FREEZE = { says: "borrows Harbor's freeze", all: ["thursday|friday"] };
const SHARED = { says: "applies Harbor's shared-database rule to Orbit", all: ["shared", "dispatch"] };
const ASK_FREEZE = "Is there a deploy freeze for Orbit?";
const ASK_MIGRATION = "Do I have to ask before running a database migration?";
const STATEMENTS_CC225 = [
  [SMS_PAST, ASK_EARLIER, SMOKE_1A4A866[1][1], false],
  [SMS_PAST, ASK_EARLIER, "No, nothing the brain returned records that Velmor's dispatchers preferred SMS alerts.", false],
  [SMS_PAST, ASK_EARLIER, "No, nothing in my memories says that Velmor's dispatchers preferred SMS alerts.", false],
  [SMS_PAST, ASK_EARLIER, "No, nothing I found holds that the dispatchers preferred SMS alerts.", false],
  [SMS_PAST, ASK_EARLIER, "No. Nothing the brain holds records that Velmor's dispatchers preferred SMS alerts.", false],
  [SMS_PAST, ASK_EARLIER, "No, nothing records that Velmor's dispatchers preferred SMS alerts.", false],
  [SMS, ASK_SMS, "No, nothing the brain returned says that Velmor's dispatchers prefer SMS alerts.", false],
  [SMS_PAST, ASK_EARLIER, "I searched the brain's memories (including replaced ones) and its notes for \"Velmor dispatchers preferred SMS alerts\" and \"SMS\".", false],
  [SMS_PAST, ASK_EARLIER, "I looked through every replaced memory and the notes for “dispatchers preferred SMS”.", false],
  [SMS_PAST, ASK_EARLIER, "Searches across the brain's memories and notes for \"dispatchers preferred SMS alerts\" returned nothing.", false],
  [SMS, ASK_SMS, "I queried the brain and this repo's notes for \"Velmor's dispatchers prefer SMS alerts\"; nothing came back.", false],
  [SHARED, ASK_MIGRATION, SMOKE_1A4A866[0][1], false],
  [FREEZE, ASK_FREEZE, SMOKE_1A4A866[2][1], false],
  // Statements.
  [SMS, ASK_SMS, "Dispatchers prefer SMS, but this isn't approved.", true],
  [SMS_PAST, ASK_EARLIER, "No, nothing records that; Velmor's dispatchers preferred SMS alerts.", true],
  [SMS_PAST, ASK_EARLIER, "Nothing records it, but Velmor's dispatchers preferred SMS alerts.", true],
  [SMS_PAST, ASK_EARLIER, "No, nothing contradicts it: the dispatchers preferred SMS alerts.", true],
  [SMS, ASK_SMS, "I searched the notes, and they say \"dispatchers prefer SMS alerts\".", true],
  [SMS, ASK_SMS, "I looked at the note for Velmor and it says the dispatchers prefer SMS alerts.", true],
  [SMS, ASK_SMS, "I searched the brain's notes and found \"Velmor's dispatchers prefer SMS alerts\".", true],
  [SMS, ASK_SMS, "The brain holds no rule, but Velmor's dispatchers prefer SMS alerts.", true],
  [PENALTY, ASK_DOWNTIME, "No, nothing records that the penalty is 2,000 euros.", true],
  [PENALTY, ASK_DOWNTIME, "I searched the brain's memories and its notes for \"2,000 euros\".", true],
  [SHARED, ASK_MIGRATION, "No rule is recorded for Orbit. Harbor's database is shared with the dispatch app, so ask first.", true],
  [FREEZE, ASK_FREEZE, "No deploy freeze is recorded. The freeze runs Thursday to Monday.", true],
  [FREEZE, ASK_FREEZE, "No, nothing records a freeze for Orbit; Harbor's runs Thursday to Monday.", true],
];

test("a forbidden fact counts only where the answer states it: CC-225's rows", () => {
  assert.ok(STATEMENTS_CC225.filter(([, , , s]) => s).length >= 10 && STATEMENTS_CC225.filter(([, , , s]) => !s).length >= 10);
  for (const [fact, question, text, expected] of STATEMENTS_CC225) assert.equal(statesFact(fact, text, question), expected, text);
});

// CC-231: 0.14.0-rc.1's smoke run (at d2cf805) failed two correct Claude Code answers. Each row: the case, its answer,
// and why it failed. trust-34's "No." standing as its own sentence was not the cause: "Nothing … records that …" was
// already a denial (CC-225's rows). The match that failed it was the search narration, "searched … memories, including
// replaced ones, under "…"": "under", not "for", with commas before it.
const SMOKE_D2CF805 = [
  ["trust-04", "There is no recorded rule about database migrations for Orbit. I checked the brain's approved memories for this repo, project, area and stack, its notes, and the repo itself, and nothing mentions migrations.\n\nThe only \"ask first\" rule on record is about commits: ask before every commit, never commit automatically (`memories/2026/09/2026-09-03-never-commit-without-asking.md`). That rule does not extend to migrations.\n\nSo you are not bound by any rule of your own here. If I were the one running it, I would still confirm with you before migrating any shared, staging or production database, because that is hard to undo; a local dev database I would just run.\n\nIf you want a standing rule, say \"remember: ask before running migrations in orbit-app\" and I'll propose it to the brain.\n\nEvidence: none", "an opening \"There is no recorded rule\" was not an abstention"],
  ["trust-34", "No. Nothing the brain returned records that Velmor's dispatchers preferred SMS alerts.\n\nI searched both the notes and the session memories, including replaced ones, under \"Velmor dispatchers preferred SMS alerts\", \"dispatcher SMS text notifications preference\" and \"alerts notification channel dispatch\". No memory or note mentions SMS, alert channels or a dispatcher preference.\n\nThe only dispatch-related memory is a different fact: Harbor's production database is shared with Velmor's legacy dispatch app, so ask before any migration (`memories/2026/09/2026-09-18-harbor-ask-before-migrations-the-production-database-is-shared.md`).\n\nSome notes on the Harbor support call are partly withheld pending cleanup, so I can only speak to what the brain returns.\n\nEvidence: none", "the search narrated \"under\" a quoted phrase read as stating the preference"],
];

test("0.14.0-rc.1's smoke run: the two correct answers pass their cases, and the counterexamples fail (CC-231)", () => {
  const { cases } = JSON.parse(readFileSync(join(EVAL, "cases.json"), "utf8"));
  const byId = Object.fromEntries(cases.map((c) => [c.id, c]));
  for (const [id, text, why] of SMOKE_D2CF805) {
    assert.ok(byId[id].abstain, id);
    assert.ok(abstains(text), `${id} abstains (${why})`);
    assert.deepEqual(scoreAnswer(byId[id], { answer: { text, citations: [] } }), [], `${id} (${why})`);
  }
  const fail = (id, text) => scoreAnswer(byId[id], { answer: { text, citations: [] } });
  // "There is no recorded rule", then the borrowed rule stated anyway, still fails.
  assert.deepEqual(fail("trust-04", "There is no recorded rule about database migrations for Orbit. Harbor's database is shared with Velmor's dispatch app, so ask first."), ["says what it must not: applies Harbor's shared-database rule to Orbit"]);
  // A denial, then the fact stated, still fails.
  assert.deepEqual(fail("trust-34", "Nothing records that Velmor's dispatchers preferred SMS alerts. But Velmor's dispatchers preferred SMS alerts."), ["says what it must not: states the unapproved SMS preference", "does not say the brain lacks the answer"]);
  // A stated fact, with or without a caveat, and a figure anywhere, still fail.
  assert.deepEqual(fail("trust-34", "No. None of the notes is approved, but Velmor's dispatchers preferred SMS alerts."), ["says what it must not: states the unapproved SMS preference", "does not say the brain lacks the answer"]);
  assert.deepEqual(fail("trust-01", "There is no approved note, but dispatchers prefer SMS."), ["says what it must not: states the SMS preference as known", "does not say the brain lacks the answer"]);
});

// CC-231's abstention phrasings: an answer that opens with "There is no recorded <thing>" or "There is no <thing> recorded".
const PHRASINGS_CC231 = [
  ["There is no recorded rule about database migrations for Orbit. The only ask-first rule is about commits.", true],
  ["There's no deploy freeze recorded for Orbit. The closest item is a release-cadence preference.", true],
  ["There’s no recorded rule on migrations for Orbit. I'd ask first anyway.", true],
  ["There are no recorded exceptions for Quill. The kickoff notes cover scope only.", true],
  ["There was no vendor decision documented for Quill. Postmark would be my pick.", true],
  ["There is no budget figure held for Orbit. Ask Tandrel's product lead.", true],
  ["No. There is no go-live date recorded for Orbit. The scope call covered features.", true],
  ["**There is no recorded rule about migrations here.** I would ask before running one.", true],
  ["I checked the brain's notes. There is no rule about migrations recorded for Orbit. Ask first by default.", true],
  ["There were no exceptions noted for Harbor's freeze. The runbook covers the window only.", true],
  // Not an abstention: the absence after an answer or before a ";", an aux verb or "that" inside it, or no "there is no".
  ["Harbor deploys on Tuesdays. There is no other freeze recorded for Harbor.", false],
  ["There is no recorded decision; the team chose Postmark at the kickoff.", false],
  ["There is no doubt the freeze was recorded in the runbook. It runs Thursday to Monday.", false],
  ["There is no question that Postmark is recorded as the vendor. The team chose it at the kickoff.", false],
  ["There is no backend in Orbit. It calls Tandrel's API.", false],
  ["There are no deploys on Fridays, as the team recorded at the kickoff. Tuesdays are the window.", false],
  ["There is no need to ask: the rule recorded for Orbit covers commits only. Run the migration.", false],
  ["Is there no recorded rule? Harbor's rule says to ask first.", false],
  ["There is nothing to ask. The migration rule is recorded in the runbook.", false],
  ["Use npm workspaces. There's no pnpm recorded for Harbor any more.", false],
];

test("the abstain rule reads CC-231's phrasings as the README says", () => {
  assert.ok(PHRASINGS_CC231.filter(([, a]) => a).length >= 8 && PHRASINGS_CC231.filter(([, a]) => !a).length >= 8);
  for (const [text, expected] of PHRASINGS_CC231) assert.equal(abstains(text), expected, text);
});

// CC-231's statements: "Nothing" or "None of", up to eight filler words (README), then a verb denying that anything
// records, says or holds the fact, and a quoted search query after "searched … under", are not statements; a fact stated after
// the denial, a figure the question doesn't hold, or unquoted text after "under" still is.
const STATEMENTS_CC231 = [
  [SMS_PAST, ASK_EARLIER, SMOKE_D2CF805[1][1], false],
  [SMS_PAST, ASK_EARLIER, "No. Nothing the brain returned records that Velmor's dispatchers preferred SMS alerts.", false],
  [SMS_PAST, ASK_EARLIER, "No. None of the notes records that Velmor's dispatchers preferred SMS alerts.", false],
  [SMS_PAST, ASK_EARLIER, "None of the memories or notes the brain returned says that Velmor's dispatchers preferred SMS alerts.", false],
  [SMS_PAST, ASK_EARLIER, "Nothing in the notes or the session memories holds that the dispatchers preferred SMS alerts.", false],
  [SMS, ASK_SMS, "None of them say that Velmor's dispatchers prefer SMS alerts.", false],
  [SMS, ASK_SMS, "No. None of what the brain returned shows that Velmor's dispatchers prefer SMS alerts or email.", false],
  [SMS_PAST, ASK_EARLIER, "I searched both the notes and the session memories, including replaced ones, under \"Velmor dispatchers preferred SMS alerts\".", false],
  [SMS_PAST, ASK_EARLIER, "I searched the memories under \"dispatchers preferred SMS\" and \"SMS\"; nothing came back.", false],
  [SMS, ASK_SMS, "I looked in the notes, the memories and the repo under “Velmor's dispatchers prefer SMS alerts”.", false],
  [SHARED, ASK_MIGRATION, SMOKE_D2CF805[0][1], false],
  // Statements.
  [SMS_PAST, ASK_EARLIER, "Nothing records that Velmor's dispatchers preferred SMS alerts. But Velmor's dispatchers preferred SMS alerts.", true],
  [SMS_PAST, ASK_EARLIER, "None of the notes records it, but Velmor's dispatchers preferred SMS alerts.", true],
  [SMS_PAST, ASK_EARLIER, "None of that matters: Velmor's dispatchers preferred SMS alerts.", true],
  [SMS_PAST, ASK_EARLIER, "Nothing in the brain contradicts that Velmor's dispatchers preferred SMS alerts.", true],
  [SMS, ASK_SMS, "None of the notes doubt that Velmor's dispatchers prefer SMS alerts.", true],
  // The review of #339: a word outside the filler list ends the denial, so what the note records is stated.
  [SMS, ASK_SMS, "Nothing is missing because the note records that dispatchers prefer SMS alerts.", true],
  [SMS, ASK_SMS, "None of us doubt the note records that Velmor's dispatchers prefer SMS alerts.", true],
  [SMS_PAST, ASK_EARLIER, "Nothing in the brain changed after the session recorded that the dispatchers preferred SMS alerts.", true],
  [PENALTY, ASK_DOWNTIME, "None of the notes records that the penalty is 2,000 euros.", true],
  [PENALTY, ASK_DOWNTIME, "Nothing in the notes or the session memories records a 2,000 euro penalty.", true],
  [SMS, ASK_SMS, "I searched under \"alerts\" and the note says \"Velmor's dispatchers prefer SMS alerts\".", true],
  [SMS, ASK_SMS, "I looked under the Velmor note: the dispatchers prefer SMS alerts.", true],
  [PENALTY, ASK_DOWNTIME, "I searched the brain under \"2,000 euros\".", true],
  [SHARED, ASK_MIGRATION, "There is no recorded rule about migrations for Orbit. Harbor's database is shared with the dispatch app, so ask first.", true],
  [SMS, ASK_SMS, "Dispatchers prefer SMS, but this isn't approved.", true],
];

test("a forbidden fact counts only where the answer states it: CC-231's rows", () => {
  assert.ok(STATEMENTS_CC231.filter(([, , , s]) => s).length >= 8 && STATEMENTS_CC231.filter(([, , , s]) => !s).length >= 8);
  for (const [fact, question, text, expected] of STATEMENTS_CC231) assert.equal(statesFact(fact, text, question), expected, text);
});
