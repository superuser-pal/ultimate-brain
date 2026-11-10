// What CC-185 adds to the synthetic world for 0.13.0's trust gaps (decision 0077 §5 and plan item 7).
// Every name, company and figure here is made up. Same conventions as world.mjs: entities are keyed, make-brain.mjs
// turns each key into a stable id, "@<key>" in a value and "{@<key>}" in a body resolve to the id, and
// "{¶@<source key>#<n>}" to the passage reference of paragraph n of the excluded input that source belongs to.
// Added here: "{path:@<key>}" resolves to the note's path from the brain's root (a body adds its own "../").
//
// The material, by gap of 0077's plan item 7:
//   old reports and indirect derived items   REPORTS (one older than an exclusion, one resting on a view) and VIEWS
//   restricted metadata                      DECISIONS_0_13 whose title, path and tags, alias, summary, custom field
//                                            or citation label restate the excluded paragraph of SUPPORT_INPUT
//   historical memory                        MEMORIES_0_13 (a superseded memory that rests on excluded evidence)
//   project and approval boundaries          the existing memories, read in full (the cases name them)
//   exclusion between creation and apply     PROPOSALS: approved before the exclusion, applied after it
//   legacy proposals                         PROPOSALS without passages: one on an input with an exclusion, one without
//   mixed excluded and live proposal         PROPOSALS: one item citing an excluded and a live paragraph
//   a linked project after the upgrade       REPOS_0_13: harbor-ops, linked by 0.12.0's `brain link`

// A second excluded input (0055), taken in as a selected extract in two versions. Version 2 leaves out paragraph 2
// after its item became Meeting only; its suppression record makes every claim resting on that paragraph ineligible.
// Paragraph 2's figure (2000 EUR) appears nowhere else in the world, so a case can forbid it anywhere in an output.
export const SUPPORT_INPUT = {
  key: "input:harbor-support-call",
  date: "2026-11-02",
  title: "Harbor support call",
  paragraphs: [
    "Velmor's depot managers get a booking summary by email every Monday morning.",
    "Velmor will charge a penalty of 2000 EUR for each hour Harbor is down during depot hours.",
    "Harbor's uptime target is 99.5 percent a month, measured by Velmor's own monitor.",
    "Velmor's support requests are answered within one working day.",
    "Planned maintenance on Harbor is announced to Velmor five working days ahead.",
    "Velmor sends support requests through the Harbor help desk, not by phone.",
    "Velmor's help desk is staffed from 07:00 to 19:00 on weekdays.",
  ],
  items: ["s1.i1", "s1.i2", "s1.i3", "s1.i4", "s1.i5", "s1.i6", "s1.i7"],
  excluded: [2],
  versions: [
    { key: "src:harbor-support-v1", version: 1, date: "2026-11-02" },
    { key: "src:harbor-support-v2", version: 2, date: "2026-11-06" },
  ],
};

// Decisions on the support call. Each of the first six cites one live paragraph and the excluded one, so it stays
// readable with its live line, and carries the excluded figure in one metadata channel (`channel`, case metadata only).
// `file` names the file when the title would put the figure in the path; `custom` adds frontmatter fields as written.
export const DECISIONS_0_13 = [
  { key: "dec:harbor-monday-summary", channel: "title", date: "2026-11-02", file: "2026-11-02-harbor-monday-summary",
    title: "Monday booking summaries and a 2000 EUR hourly downtime penalty", projects: ["@prj:harbor"], sources: ["@src:harbor-support-v1"],
    summary: "Velmor's depot managers get a booking summary every Monday.",
    body: "Velmor's depot managers get a booking summary by email every Monday morning. {¶@src:harbor-support-v1#1}\n\nVelmor charges a penalty of 2000 EUR for each hour Harbor is down during depot hours. {¶@src:harbor-support-v1#2}\n" },
  { key: "dec:harbor-uptime-target", channel: "path and tags", date: "2026-11-02", file: "2026-11-02-harbor-uptime-target-and-2000-eur-penalty",
    title: "Harbor's uptime target", projects: ["@prj:harbor"], sources: ["@src:harbor-support-v1"], tags: ["support", "penalty-2000-eur"],
    summary: "Harbor must be up 99.5 percent of each month.",
    body: "Harbor's uptime target is 99.5 percent a month. {¶@src:harbor-support-v1#3}\n\nEach hour down during depot hours costs 2000 EUR. {¶@src:harbor-support-v1#2}\n" },
  { key: "dec:harbor-response-time", channel: "alias", date: "2026-11-02",
    title: "Answer Velmor's support requests within one working day", projects: ["@prj:harbor"], sources: ["@src:harbor-support-v1"], aliases: ["Velmor 2000 EUR penalty clause"],
    summary: "Velmor's support requests are answered within one working day.",
    body: "Velmor's support requests are answered within one working day. {¶@src:harbor-support-v1#4}\n\nDowntime in depot hours costs 2000 EUR an hour. {¶@src:harbor-support-v1#2}\n" },
  { key: "dec:harbor-maintenance-notice", channel: "summary", date: "2026-11-02",
    title: "Announce Harbor maintenance five working days ahead", projects: ["@prj:harbor"], sources: ["@src:harbor-support-v1"],
    summary: "Maintenance is announced five working days ahead, because each hour down in depot hours costs 2000 EUR.",
    body: "Planned maintenance is announced to Velmor five working days ahead. {¶@src:harbor-support-v1#5}\n\nVelmor charges 2000 EUR for each hour down in depot hours. {¶@src:harbor-support-v1#2}\n" },
  { key: "dec:harbor-monitor", channel: "custom field", date: "2026-11-02",
    title: "Velmor's own monitor measures Harbor's uptime", projects: ["@prj:harbor"], sources: ["@src:harbor-support-v1"],
    custom: { penalty_clause: "2000 EUR for each hour down in depot hours" },
    summary: "Harbor's uptime is measured by Velmor's own monitor.",
    body: "Harbor's uptime is measured by Velmor's own monitor. {¶@src:harbor-support-v1#3}\n\nVelmor charges 2000 EUR for each hour down in depot hours. {¶@src:harbor-support-v1#2}\n" },
  // The citation label: the note's own text rests on a live paragraph only; the label of its link to the wholly
  // restricted penalty decision restates the excluded figure. TODO(CC-182): whether the label is blanked or the note
  // withheld; the case that uses it asks for neither the note nor its fact.
  { key: "dec:harbor-help-desk", channel: "citation label", date: "2026-11-02",
    title: "Velmor sends Harbor support requests through the help desk", projects: ["@prj:harbor"], sources: ["@src:harbor-support-v1"],
    summary: "Support requests from Velmor come through the Harbor help desk.",
    body: "Velmor sends support requests through the Harbor help desk, not by phone. {¶@src:harbor-support-v1#6}\n\nSee also [the 2000 EUR downtime penalty](../../{path:@dec:harbor-penalty}).\n" },
  // Wholly restricted: its only passage is excluded.
  { key: "dec:harbor-penalty", date: "2026-11-02", file: "2026-11-02-velmors-downtime-penalty",
    title: "Velmor's downtime penalty", projects: ["@prj:harbor"], sources: ["@src:harbor-support-v1"],
    summary: "Velmor charges 2000 EUR for each hour Harbor is down during depot hours.",
    body: "Velmor charges a penalty of 2000 EUR for each hour Harbor is down during depot hours. {¶@src:harbor-support-v1#2}\n" },
  // A draft knowledge note: eligible, labelled by its lifecycle (the coordinator's note of CC-182's rule, 2026-11-10).
  { key: "dec:harbor-helpdesk-hours", date: "2026-11-06", lifecycle: "draft",
    title: "Velmor's help desk is staffed 07:00 to 19:00 on weekdays", projects: ["@prj:harbor"], sources: ["@src:harbor-support-v2"],
    summary: "Velmor's help desk is staffed from 07:00 to 19:00 on weekdays.",
    body: "Velmor's help desk is staffed from 07:00 to 19:00 on weekdays. {¶@src:harbor-support-v2#7}\n" },
];

// A superseded memory that rests only on the excluded paragraph: a historical read must not return it (0077 §2:
// old does not mean eligible). Its successor is current and cites nothing.
export const MEMORIES_0_13 = [
  { key: "mem:p-loadtest-old", date: "2026-11-03", scope: "project:prj:harbor", confidence: "verified", origin: "harbor-api", writer: "claude-code", sources: ["@src:harbor-support-v1"],
    title: "Harbor: no production load tests in depot hours", summary: "Never load-test Harbor's production during depot hours.",
    body: "Never load-test Harbor's production during depot hours: Velmor charges 2000 EUR for each hour it is down. {¶@src:harbor-support-v1#2}\n" },
  { key: "mem:p-loadtest-new", date: "2026-11-08", scope: "project:prj:harbor", confidence: "verified", origin: "harbor-api", writer: "codex", supersedes: "mem:p-loadtest-old",
    title: "Harbor: load tests run on staging only", summary: "Load-test Harbor only on the staging stack; production load tests are retired.",
    body: "Load-test Harbor only on the staging stack; production load tests are retired.\n" },
];

// Derived items. The decision log is generated by make-brain.mjs from the decisions (schema §16.2); it lists the wholly
// restricted decisions, so it rests on restricted notes. `links` name the notes a report's body links to.
export const VIEWS = [
  { key: "vw:harbor-decision-log", kind: "decision_log", project: "prj:harbor", generated_at: "2026-11-08T12:00:00Z" },
];

// Reports (schema §16.4). The old one was written before the support call's exclusion (2026-11-06T10:00:00Z) and restates
// the excluded figure while linking only a live note; the overview is newer than every exclusion and rests on the
// decision log, which rests on restricted decisions: report → view → note.
export const REPORTS = [
  { key: "vw:harbor-support-old", date: "2026-11-04", generated_at: "2026-11-04T09:00:00Z", slug: "harbor-support-where-we-stand",
    title: "Harbor support: where we stand", question: "Where do Harbor's support terms stand?", projects: ["@prj:harbor"],
    links: ["prj:harbor"],
    sections: {
      "Where it stands": "Harbor's support terms were set on the support call: Velmor's depot managers get a booking summary every Monday, and Velmor charges 2000 EUR for each hour Harbor is down during depot hours ([Harbor booking platform](../{path:@prj:harbor})).",
      Timeline: "- 2026-11-02 · Support call with Velmor ([Harbor booking platform](../{path:@prj:harbor}))",
      "Decisions in force": "- None",
      "Open questions and risks": "- Downtime during depot hours is costly ([Harbor booking platform](../{path:@prj:harbor}))",
      "People involved": "- None",
      Gaps: "- None",
    } },
  { key: "vw:harbor-pricing-overview", date: "2026-11-09", generated_at: "2026-11-09T09:00:00Z", slug: "harbor-pricing-overview",
    title: "Harbor pricing: overview", question: "What is Velmor's pricing for Harbor?", projects: ["@prj:harbor"],
    links: ["dec:velmor-invoicing", "vw:harbor-decision-log"],
    sections: {
      "Where it stands": "Velmor is invoiced monthly ([Invoice Velmor monthly](../{path:@dec:velmor-invoicing})). The second-year price, with the discount agreed on the pricing call, is in the [Harbor decision log](../{path:@vw:harbor-decision-log}).",
      Timeline: "- 2026-10-14 · Monthly invoicing agreed ([Invoice Velmor monthly](../{path:@dec:velmor-invoicing}))",
      "Decisions in force": "- Monthly invoicing ([Invoice Velmor monthly](../{path:@dec:velmor-invoicing}))\n- Second-year price: see the [Harbor decision log](../{path:@vw:harbor-decision-log})",
      "Open questions and risks": "- None",
      "People involved": "- None",
      Gaps: "- None",
    } },
];

// Proposals (schema §11), every one approved in chat and waiting for `brain apply`.
// `passages`: the paragraphs a 0.13.0 proposal names (0077 §3). `passages: null` marks a legacy proposal, written before
// the field existed. make-brain.mjs writes the field only when PROPOSAL_PASSAGES_FIELD names it: TODO(CC-179, CC-182),
// the field's name and shape are set by the contract, and lint rejects an unknown field until then.
// `decided_at` before 2026-11-06T10:00:00Z = approved before the support call's exclusion, applied after it.
export const PROPOSALS = [
  // An exclusion made between the proposal's creation (and approval) and its apply.
  { key: "prp:support-penalty", created: "2026-11-03", decided_at: "2026-11-04T09:00:00Z", kind: "add_to_note", target: "@prj:harbor",
    title: "Harbor: Velmor's downtime penalty", source: "@src:harbor-support-v1", passages: [{ source: "src:harbor-support-v1", n: 2 }],
    content: "Velmor charges a penalty of 2000 EUR for each hour Harbor is down during depot hours. {¶@src:harbor-support-v1#2}",
    why: "Velmor will charge a penalty of 2000 EUR for each hour Harbor is down during depot hours." },
  // One item citing an excluded and a live paragraph: withheld whole (0077 §1, plan item 4).
  { key: "prp:support-mixed", created: "2026-11-03", decided_at: "2026-11-04T09:05:00Z", kind: "add_to_note", target: "@org:velmor",
    title: "Velmor: summaries and downtime terms", source: "@src:harbor-support-v1", passages: [{ source: "src:harbor-support-v1", n: 1 }, { source: "src:harbor-support-v1", n: 2 }],
    content: "Velmor's depot managers get a booking summary every Monday morning. {¶@src:harbor-support-v1#1}\n\nVelmor charges 2000 EUR for each hour Harbor is down during depot hours. {¶@src:harbor-support-v1#2}",
    why: "Velmor's depot managers get a booking summary by email every Monday morning." },
  // The independent live item of the same input: applied (the control of the mixed case).
  { key: "prp:support-uptime", created: "2026-11-03", decided_at: "2026-11-04T09:10:00Z", kind: "add_to_note", target: "@org:velmor",
    title: "Velmor: Harbor's uptime target", source: "@src:harbor-support-v1", passages: [{ source: "src:harbor-support-v1", n: 3 }],
    content: "Harbor's uptime target for Velmor is 99.5 percent a month. {¶@src:harbor-support-v1#3}",
    why: "Harbor's uptime target is 99.5 percent a month, measured by Velmor's own monitor." },
  // Legacy, on an input with a suppression record: withheld and re-proposed, though its value is live.
  { key: "prp:support-legacy", created: "2026-11-03", decided_at: "2026-11-04T09:15:00Z", kind: "update_fact", target: "@prj:harbor",
    title: "Harbor: uptime target", source: "@src:harbor-support-v1", passages: null,
    field: "uptime_target", after: "99.5 percent", from: "2026-11-02",
    why: "Harbor's uptime target is 99.5 percent a month, measured by Velmor's own monitor." },
  // Legacy, on an input with no suppression record: applied normally (the coordinator's note of CC-182's rule).
  { key: "prp:quill-legacy", created: "2026-10-02", decided_at: "2026-10-03T09:00:00Z", kind: "update_fact", target: "@prj:quill",
    title: "Quill: sending service", source: "@src:quill-email-review", passages: null,
    field: "sending_service", after: "Amazon SES", from: "2026-10-01",
    why: "Quill sends newsletters through Amazon SES from October 2026; Postmark is retired." },
];

// A linked project as 0.12.0's `brain link` left it: the managed block of that release (its `How:` paragraph sends the
// agent to read the notes `query --candidates` returns, with no filtered read) between project-owned text, and CLAUDE.md
// importing AGENTS.md. TODO(CC-184): the skill copies and the `.brain` `skills` entry of a 0.12.0 install come from
// CC-184's synthetic old installation, made with the published 0.12.0 package; this repo has only the instructions.
export const REPOS_0_13 = [
  {
    name: "harbor-ops", marker: { project: "prj:harbor", area: "area:client-work", stacks: ["node"] },
    tasks: [{ id: "T-31", title: "Nightly backup check", status: "done" }],
    linkedBy: "0.12.0",
    ownedBefore: "# harbor-ops\n\nOperations scripts for the Harbor platform: backups, restores and the uptime check.\n\n",
    ownedAfter: "\n\n## Runbooks\n\nRunbooks live in docs/runbooks, one file per alert.\n",
  },
];

// The `How:` paragraph of the managed block in 0.12.0 (src/commands/link.ts at v0.12.0), and the skills its snapshot
// linked; settings.recall is off in the template brain.json, so the block has no recall paragraph.
export const LINK_0_12_HOW = "How: use the `brain-query` skill, or run `brain query --candidates \"<question>\" --json` and read the notes it returns. Cite the note paths. Say when a fact is `contested` or `superseded`.";
export const LINK_0_12_SKILLS = ["brain-workflow", "brain-workflow-adopt"];
