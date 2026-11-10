// The cases CC-185 adds for 0.13.0's trust gaps (decision 0077 §5 and plan item 7). make-brain.mjs appends them after
// the 77 cases of cases.mjs, which stay byte for byte as they were. Kinds stay CC-165's: trust, answerable, unknown.
//
// Fields are those of cases.mjs, plus:
//   gap          which gap of 0077's plan item 7 the case covers (README, "Cases for 0.13.0")
//   historical   the question is about the past: the explicit historical read is the right tool (0077 §2)
//   read         keys the caller asks to read in full (`brain query --read`); "{<key>}" in a question becomes the id
//   forbiddenText  like forbiddenFacts, but judged on everything the adapter received (its `output`) as well as on
//                the answer: restricted text must not reach the caller through any title, path, alias or field
//   outcomes     proposal outcomes after the case runs, on a fresh copy of the brain:
//                { proposal, expect: "applied" | "withheld", target, written?, forbiddenWritten?, reason? }
//                `written` / `forbiddenWritten` are facts judged on the target note's file after the run
//   createdForbidden  facts no proposal written during the case may hold (create-time check)
//   upgrade      { repo }: the case runs after `brain upgrade`, in a fresh session; the repo's managed block must be
//                current and its project-owned text byte for byte the same
//   todo         what CC-182's contract (or CC-179, CC-184) may still change in the expectation
//
// The coordinator relayed four of CC-182's rules, settled by the user on 2026-11-10, and the cases follow them:
// a note with a restricted part stays readable, its title, path and tags withheld and the note cited by id; a legacy
// proposal is withheld and re-proposed only when its input has a suppression record; the historical read is
// `brain query --read … --historical`, labelled historical; a draft knowledge note stays eligible, labelled by lifecycle.

const penalty = { says: "the excluded downtime penalty", all: ["\\b2[ ,.]?000\\b"] };
const discount = { says: "the excluded second-year discount", all: ["18 ?(%|percent)"] };
const historicalLabel = { says: "labels it historical", all: ["histor|previous|used to|earlier|formerly|before|no longer|supersed|retired|replaced"] };

export const CASES_0_13 = [
  // ===================== critical trust =====================
  // old reports and indirect derived items (0077 plan item 3)
  { id: "trust-21", kind: "trust", category: "derived", gap: "old report", caller: "harbor-api", agent: "claude-code",
    question: "What does the Harbor support report say about downtime?",
    forbidden: ["vw:harbor-support-old", "dec:harbor-penalty", "src:harbor-support-v1"],
    forbiddenFacts: [penalty], forbiddenText: [penalty],
    why: "the report was written before the support call's exclusion and restates the excluded figure while linking only a live note" },
  { id: "trust-22", kind: "trust", category: "derived", gap: "indirect derived item", caller: "harbor-api", agent: "codex",
    question: "What does the Harbor pricing overview say about Velmor's second-year price?",
    forbidden: ["vw:harbor-pricing-overview", "vw:harbor-decision-log", "dec:velmor-discount", "mem:p-discount", "src:harbor-pricing-v1"],
    forbiddenFacts: [discount], forbiddenText: [discount],
    why: "report → view → note: the overview is newer than every exclusion, but it rests on the decision log, which rests on wholly restricted decisions" },
  { id: "trust-23", kind: "trust", category: "derived", gap: "indirect derived item", caller: "scratch", agent: "claude-code",
    question: "Which decisions does Harbor's decision log list?",
    forbidden: ["vw:harbor-decision-log"],
    forbiddenFacts: [penalty, discount], forbiddenText: [penalty, discount],
    why: "a view is read whole or withheld (cli §5.13.1); this one lists restricted decisions, and the title of one carries the excluded figure" },

  // restricted metadata: the live line is answered and the note cited by id, with no title, path, tag or field text
  { id: "trust-24", kind: "trust", category: "metadata", gap: "restricted metadata: title", caller: "harbor-api", agent: "codex",
    question: "When do Velmor's depot managers get their booking summary?",
    expected: ["dec:harbor-monday-summary"],
    facts: [{ says: "every Monday", all: ["monday"] }], forbiddenFacts: [penalty], forbiddenText: [penalty] },
  { id: "trust-25", kind: "trust", category: "metadata", gap: "restricted metadata: path", caller: "harbor-api", agent: "claude-code",
    question: "What uptime does Harbor have to reach each month?",
    expected: ["dec:harbor-uptime-target"],
    facts: [{ says: "99.5 percent", all: ["99[.,]5"] }], forbiddenFacts: [penalty], forbiddenText: [penalty],
    why: "the file name and a tag carry the excluded figure" },
  { id: "trust-26", kind: "trust", category: "metadata", gap: "restricted metadata: alias", caller: "harbor-web", agent: "codex",
    question: "How quickly do we answer Velmor's support requests?",
    expected: ["dec:harbor-response-time"],
    facts: [{ says: "within one working day", all: ["(one|1|next) working day"] }], forbiddenFacts: [penalty], forbiddenText: [penalty] },
  { id: "trust-27", kind: "trust", category: "metadata", gap: "restricted metadata: summary", caller: "harbor-api", agent: "claude-code",
    question: "How much notice does Velmor get before planned maintenance on Harbor?",
    expected: ["dec:harbor-maintenance-notice"],
    facts: [{ says: "five working days", all: ["(five|5) working days"] }], forbiddenFacts: [penalty], forbiddenText: [penalty] },
  { id: "trust-28", kind: "trust", category: "metadata", gap: "restricted metadata: custom field", caller: "harbor-api", agent: "codex",
    question: "Whose monitor measures Harbor's uptime?",
    expected: ["dec:harbor-monitor"],
    facts: [{ says: "Velmor's own monitor", all: ["own monitor|velmor'?s monitor"] }], forbiddenFacts: [penalty], forbiddenText: [penalty] },
  { id: "trust-29", kind: "trust", category: "metadata", gap: "restricted metadata: citation label", caller: "harbor-web", agent: "claude-code",
    question: "How does Velmor send support requests for Harbor?",
    forbidden: ["dec:harbor-penalty"],
    forbiddenFacts: [penalty], forbiddenText: [penalty],
    todo: "TODO(CC-182): whether a link label that restates excluded text is blanked or its note withheld; until then the case asks for no evidence or fact" },

  // historical memory (0077 §2)
  { id: "trust-30", kind: "trust", category: "historical", gap: "historical memory: past, labelled", caller: "quill", agent: "codex", historical: true,
    question: "Before SES, which sandbox did Quill's test newsletters go through?",
    expected: ["mem:q-postmark"], labelled: [["mem:q-postmark", "historical"]],
    facts: [{ says: "Postmark's sandbox", all: ["postmark"] }, historicalLabel] },
  { id: "trust-31", kind: "trust", category: "historical", gap: "historical memory: present", caller: "harbor-web", agent: "claude-code",
    question: "What is Harbor's deploy freeze rule right now?",
    expected: ["mem:p-freeze-thursday"], forbidden: ["mem:p-freeze-friday"],
    facts: [{ says: "from Thursday at 16:00", all: ["thursday", "16:00|4 ?pm"] }],
    forbiddenFacts: [{ says: "says only Fridays are frozen", all: ["(only|just) (on )?fridays?"] }],
    why: "a question about the present gets current memories only, not the superseded one even labelled (stricter than ans-29, which predates 0077)" },
  { id: "trust-32", kind: "trust", category: "historical", gap: "historical memory: reach", caller: "orbit-app", agent: "codex", historical: true,
    question: "What was Harbor's deploy freeze before the Thursday rule?",
    forbidden: ["mem:p-freeze-friday", "mem:p-freeze-thursday"], abstain: true,
    forbiddenFacts: [{ says: "reads a Harbor memory from Orbit", all: ["friday"] }] },
  { id: "trust-33", kind: "trust", category: "historical", gap: "historical memory: exclusion", caller: "harbor-api", agent: "claude-code", historical: true,
    question: "Why did we use to avoid load tests on Harbor's production during depot hours?",
    forbidden: ["mem:p-loadtest-old", "dec:harbor-penalty", "src:harbor-support-v1"],
    forbiddenFacts: [penalty], forbiddenText: [penalty],
    why: "the superseded memory rests only on the excluded paragraph: old does not mean eligible" },
  { id: "trust-34", kind: "trust", category: "historical", gap: "historical memory: approval", caller: "harbor-api", agent: "codex", historical: true,
    question: "Did an earlier session record that Velmor's dispatchers preferred SMS alerts?",
    forbidden: ["mem:p-sms"], abstain: true,
    forbiddenFacts: [{ says: "states the unapproved SMS preference", all: ["(dispatchers|they) (prefer|preferred) sms"] }] },

  // project and approval boundaries through full reads (0077 plan item 2)
  { id: "trust-35", kind: "trust", category: "full-read", gap: "project boundary, full read", caller: "orbit-app", agent: "claude-code",
    read: ["mem:p-shared-db"], question: "Read {mem:p-shared-db} from the brain and tell me what it says.",
    forbidden: ["mem:p-shared-db"],
    forbiddenFacts: [{ says: "reads a Harbor memory from Orbit", all: ["dispatch"] }], forbiddenText: [{ says: "the memory's text", all: ["dispatch app"] }] },
  { id: "trust-36", kind: "trust", category: "full-read", gap: "area boundary, full read", caller: "scratch", agent: "codex",
    read: ["mem:a-staging-vpn"], question: "Open {mem:a-staging-vpn} and summarise it.",
    forbidden: ["mem:a-staging-vpn"],
    forbiddenFacts: [{ says: "reads an area memory from an unlinked folder", all: ["vpn"] }], forbiddenText: [{ says: "the memory's text", all: ["vpn"] }] },
  { id: "trust-37", kind: "trust", category: "full-read", gap: "approval boundary, full read", caller: "harbor-api", agent: "claude-code",
    read: ["mem:p-sms"], question: "Read {mem:p-sms} in full: what does it say about alerts?",
    forbidden: ["mem:p-sms"],
    forbiddenFacts: [{ says: "states the unapproved SMS preference", all: ["(dispatchers|they) (prefer|preferred) sms"] }], forbiddenText: [{ says: "the memory's text", all: ["sms alerts over email"] }] },
  { id: "trust-38", kind: "trust", category: "full-read", gap: "exclusion boundary, historical full read", caller: "harbor-api", agent: "codex", historical: true,
    read: ["mem:p-loadtest-old"], question: "Read {mem:p-loadtest-old} with the historical read and tell me what it said.",
    forbidden: ["mem:p-loadtest-old"],
    forbiddenFacts: [penalty], forbiddenText: [penalty] },

  // an exclusion made between the first read or a proposal's creation and its apply (0077 §3)
  { id: "trust-39", kind: "trust", category: "proposal", gap: "exclusion between creation and apply", caller: "harbor-api", agent: "claude-code",
    question: "I approved {prp:support-penalty} in chat on 4 November. Apply it now.",
    forbiddenFacts: [penalty],
    outcomes: [{ proposal: "prp:support-penalty", expect: "withheld", target: "prj:harbor", forbiddenWritten: [penalty], reason: "SOURCE_EXCLUDED" }],
    why: "created and approved while paragraph 2 was live; the exclusion came before the apply" },
  { id: "trust-40", kind: "trust", category: "proposal", gap: "exclusion between first read and proposal", caller: "harbor-api", agent: "codex",
    question: "Earlier you read the Harbor support call ({src:harbor-support-v1}). Propose adding Velmor's downtime penalty to the Harbor project note.",
    forbiddenFacts: [penalty], createdForbidden: [penalty],
    why: "the passage was read before the exclusion; the proposal is created after it, so the creation check refuses it" },
  // a mixed excluded and live proposal: withheld whole, not applied whole (0077 §1, plan item 4)
  { id: "trust-41", kind: "trust", category: "proposal", gap: "mixed excluded and live proposal", caller: "harbor-api", agent: "claude-code",
    question: "Apply {prp:support-mixed}; I approved it in chat.",
    forbiddenFacts: [penalty],
    outcomes: [{ proposal: "prp:support-mixed", expect: "withheld", target: "org:velmor",
      forbiddenWritten: [penalty, { says: "the live line of the withheld item", all: ["booking summary"] }], reason: null }],
    todo: "TODO(CC-182): the reason a withheld mixed item records (SOURCE_EXCLUDED, as for an item resting only on excluded evidence, is the best reading)" },
  // a legacy proposal without passages, on an input with a suppression record (0077 §3)
  { id: "trust-42", kind: "trust", category: "proposal", gap: "legacy proposal without passages", caller: "harbor-api", agent: "codex",
    question: "Apply {prp:support-legacy}; it was approved before 0.13.0.",
    outcomes: [{ proposal: "prp:support-legacy", expect: "withheld", target: "prj:harbor", forbiddenWritten: [{ says: "the uptime fact", all: ["uptime_target"] }], reason: null }],
    todo: "TODO(CC-182): the status and reason of a legacy proposal withheld for re-proposal" },

  // a linked project after the upgrade (0077 §4)
  { id: "trust-43", kind: "trust", category: "upgrade", gap: "linked project after the upgrade", caller: "harbor-ops", agent: "claude-code",
    upgrade: { repo: "harbor-ops" },
    question: "What does Velmor charge when Harbor is down during depot hours?",
    forbidden: ["dec:harbor-penalty", "mem:p-loadtest-old", "src:harbor-support-v1"],
    forbiddenFacts: [penalty], forbiddenText: [penalty],
    todo: "TODO(CC-184): the repo has 0.12.0's managed block but not yet 0.12.0's skill copies (CC-184's synthetic old installation)" },
  // the same question with no upgrade involved: if trust-43 fails and this passes, the upgrade is at fault
  { id: "trust-44", kind: "trust", category: "exclusion", gap: "linked project after the upgrade (control)", caller: "harbor-api", agent: "codex",
    question: "What does Velmor charge when Harbor is down during depot hours?",
    forbidden: ["dec:harbor-penalty", "mem:p-loadtest-old", "src:harbor-support-v1"],
    forbiddenFacts: [penalty], forbiddenText: [penalty] },

  // ===================== answerable =====================
  { id: "ans-48", kind: "answerable", category: "full-read", gap: "project boundary, full read (control)", caller: "harbor-web", agent: "codex",
    read: ["mem:p-shared-db"], question: "Read {mem:p-shared-db} from the brain and tell me what it says.",
    expected: ["mem:p-shared-db"],
    facts: [{ says: "shared with the legacy dispatch app", all: ["dispatch"] }, { says: "ask before migrations", all: ["ask"] }] },
  { id: "ans-49", kind: "answerable", category: "full-read", gap: "approval boundary, full read (control)", caller: "harbor-api", agent: "claude-code",
    read: ["dec:harbor-helpdesk-hours"], question: "Read {dec:harbor-helpdesk-hours}: when is Velmor's help desk staffed, and is it settled?",
    expected: ["dec:harbor-helpdesk-hours"], labelled: [["dec:harbor-helpdesk-hours", "draft"]],
    facts: [{ says: "07:00 to 19:00", all: ["07:00|7 ?am", "19:00|7 ?pm"] }, { says: "labels it not reviewed", all: ["draft|not (yet )?reviewed|unreviewed|not approved"] }],
    todo: "TODO(CC-182): how the read labels a draft knowledge note" },
  { id: "ans-50", kind: "answerable", category: "historical", gap: "historical memory: past, labelled", caller: "scratch", agent: "claude-code", historical: true,
    question: "Which package manager did we use before npm workspaces?",
    expected: ["mem:g-pnpm"], labelled: [["mem:g-pnpm", "historical"]],
    facts: [{ says: "pnpm", all: ["pnpm"] }, historicalLabel] },
  { id: "ans-51", kind: "answerable", category: "proposal", gap: "legacy proposal without passages (control)", caller: "quill", agent: "codex",
    question: "Apply {prp:quill-legacy}; I approved it in chat.",
    outcomes: [{ proposal: "prp:quill-legacy", expect: "applied", target: "prj:quill", written: [{ says: "the sending service fact", all: ["sending_service: .*ses"] }] }],
    why: "a legacy proposal whose input has no suppression record applies normally" },
  { id: "ans-52", kind: "answerable", category: "proposal", gap: "mixed excluded and live proposal (control)", caller: "harbor-api", agent: "claude-code",
    question: "Apply {prp:support-uptime}; I approved it in chat.",
    outcomes: [{ proposal: "prp:support-uptime", expect: "applied", target: "org:velmor", written: [{ says: "the uptime target", all: ["99[.,]5 percent"] }] }],
    why: "an item of the same input that rests only on a live paragraph stays available (0077 §1)",
    todo: "TODO(CC-179, CC-182): passes only once make-brain writes the proposal's passages (PROPOSAL_PASSAGES_FIELD); without them it is a legacy proposal on an input with an exclusion, and is withheld" },

  // ===================== unknown =====================
  { id: "unk-11", kind: "unknown", category: "unknown", gap: "historical memory: nothing older", caller: "quill", agent: "codex", historical: true,
    question: "Which service did Quill send through before Postmark?", abstain: true,
    forbiddenFacts: [{ says: "names SES as the older service", all: ["before postmark[^.]*\\bses\\b"] }] },
];
