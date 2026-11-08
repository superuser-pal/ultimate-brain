// The synthetic world of the 0.12.0 memory evaluation (CC-165, decision 0074 §6).
// Every name, company and figure here is made up. Entities are keyed; make-brain.mjs turns each key into a stable
// note id, so a case names its evidence by key and cases.json holds the resolved ids.
//
// References inside frontmatter values and bodies are written "@<key>" and resolved by make-brain.mjs:
//   "@src:harbor-kickoff" → src-…, and in a body "{@src:harbor-pricing-v1}" → src-….
// A passage reference in a body is "{¶@src:harbor-pricing-v1#2}" → "^[src-…#¶2:<passage hash>]".

export const OWNER = "Sam Ortiz";

export const AREAS = [
  { key: "area:client-work", title: "Client work", summary: "Paid projects the studio builds for clients.", body: "Projects for clients of the studio.\n" },
  { key: "area:studio-ops", title: "Studio operations", summary: "Running the studio itself: tools, site and publishing.", body: "Internal tools and the studio's own site.\n" },
];

export const ORGS = [
  { key: "org:velmor", title: "Velmor Freight", summary: "Freight company; client for the Harbor booking platform.", relationship: "Client" },
  { key: "org:tandrel", title: "Tandrel Health", summary: "Clinic group; client for the Orbit patient app.", relationship: "Client" },
];

// A Notion page id per input, derived from its key by make-brain.mjs.
export const SOURCES = [
  {
    key: "src:harbor-kickoff", date: "2026-09-02", title: "Harbor kickoff notes", kind: "note", area: "@area:client-work", projects: ["@prj:harbor"],
    summary: "Kickoff of the Harbor booking platform with Velmor: locking, hosting and a first go-live date.",
    body: "Velmor wants drivers to book loading bays at their depots.\n\nDouble bookings of a bay must be impossible; the team will lock the bay's row in Postgres while a booking is written.\n\nFirst hosting choice: Fly.io, close to the depots.\n\nVelmor expects to go live in March 2027.\n",
  },
  {
    key: "src:harbor-infra-review", date: "2026-10-08", title: "Harbor infrastructure review", kind: "note", area: "@area:client-work", projects: ["@prj:harbor"],
    summary: "Hosting moves from Fly.io to Hetzner; Velmor's operations lead names April 2027 for go-live.",
    body: "Velmor's data protection officer requires booking data to stay in Germany.\n\nThe Fly.io bill doubled after the load tests, so hosting moves to Hetzner in Falkenstein.\n\nVelmor's operations lead said go-live is April 2027, not March; the sales contact still says March.\n",
  },
  {
    key: "src:orbit-kickoff", date: "2026-09-10", title: "Orbit kickoff notes", kind: "note", area: "@area:client-work", projects: ["@prj:orbit"],
    summary: "Kickoff of the Orbit patient app with Tandrel: Expo, a budget of 40000 EUR and offline mode in the first release.",
    body: "Tandrel wants patients to book and move appointments from their phones.\n\nThe app is built with Expo so one codebase serves iOS and Android.\n\nBudget: 40000 EUR.\n\nOffline mode is part of the first release.\n",
  },
  {
    key: "src:orbit-scope-call", date: "2026-10-20", title: "Orbit scope call", kind: "note", area: "@area:client-work", projects: ["@prj:orbit"],
    summary: "Tandrel's product owner moves offline mode to the second release; the clinic director had not agreed yet.",
    body: "Tandrel's product owner moved offline mode to the second release to keep the first one small.\n\nThe clinic director was not on the call and had asked for offline mode in the first release.\n",
  },
  {
    key: "src:quill-email-review", date: "2026-10-01", title: "Quill email delivery review", kind: "note", area: "@area:studio-ops", projects: ["@prj:quill"],
    summary: "Quill moves its newsletter sending from Postmark to Amazon SES.",
    body: "Postmark's price for the newsletter volume tripled.\n\nQuill sends newsletters through Amazon SES from October 2026; Postmark is retired.\n",
  },
  {
    key: "src:quill-start", date: "2026-06-15", title: "Quill first plan", kind: "note", area: "@area:studio-ops", projects: ["@prj:quill"],
    summary: "First plan for Quill, the studio's newsletter tool: Postmark for sending, drafts as Markdown.",
    body: "Quill sends the studio newsletter through Postmark.\n\nDrafts are stored as Markdown files.\n",
  },
  {
    key: "src:studio-weekly", date: "2026-09-21", title: "Studio weekly notes", kind: "note", area: "@area:studio-ops",
    summary: "Studio weekly: analytics for the studio site and a monthly newsletter.",
    body: "The studio site uses Plausible for analytics.\n\nThe studio newsletter goes out monthly.\n",
  },
];

// The excluded input (0055): a Notion meeting taken in as a selected extract. Version 2 drops paragraph 2 after the
// user marked its item Meeting only, and its suppression record makes every claim resting on that paragraph ineligible.
export const EXCLUDED_INPUT = {
  key: "input:harbor-pricing-call",
  date: "2026-10-14",
  title: "Harbor pricing call",
  paragraphs: [
    "Velmor confirmed monthly invoicing for the Harbor platform, billed on the first working day of each month.",
    "Velmor asked for an 18 percent discount on the second year, and it was approved on the call.",
    "The support retainer stays at twelve hours a month.",
  ],
  items: ["s1.i1", "s1.i2", "s1.i3"],
  excluded: [2], // paragraph numbers version 2 leaves out
  versions: [
    { key: "src:harbor-pricing-v1", version: 1, date: "2026-10-14" },
    { key: "src:harbor-pricing-v2", version: 2, date: "2026-10-16" },
  ],
};

export const PROJECTS = [
  {
    key: "prj:harbor", title: "Harbor booking platform", area: "@area:client-work", client: "@org:velmor", slug: "harbor-booking-platform",
    summary: "Loading-bay booking platform for Velmor Freight's depots.",
    body: "Drivers book loading bays at Velmor's depots. Repos: harbor-api and harbor-web.\n",
    timeline: [
      { field: "go_live", value: "2027-03", from: "2026-09-02", learned: "2026-09-02", source: "@src:harbor-kickoff", assessment: "contested", note: "The sales contact says March." },
      { field: "go_live", value: "2027-04", from: "2026-10-08", learned: "2026-10-08", source: "@src:harbor-infra-review", assessment: "contested", note: "The operations lead says April." },
    ],
  },
  {
    key: "prj:orbit", title: "Orbit patient app", area: "@area:client-work", client: "@org:tandrel", slug: "orbit-patient-app",
    summary: "Appointment app for Tandrel Health's patients.",
    body: "Patients book and move appointments from their phones. Repo: orbit-app.\n",
    facts: { budget: "45000 EUR" },
    timeline: [
      { field: "budget", value: "40000 EUR", from: "2026-09-10", until: "2026-10-02", learned: "2026-09-10", source: "@src:orbit-kickoff", assessment: "superseded" },
      { field: "budget", value: "45000 EUR", from: "2026-10-02", learned: "2026-10-02", source: "notion-edit", assessment: "accepted", note: "The user corrected the budget in Notion." },
    ],
  },
  {
    key: "prj:quill", title: "Quill newsletter tool", area: "@area:studio-ops", slug: "quill-newsletter-tool",
    summary: "The studio's own tool for writing and sending its newsletter.",
    body: "Writes and sends the studio newsletter. Repo: quill.\n",
  },
];

// Decisions with their evidence. `supersedes` writes both sides of the pair.
export const DECISIONS = [
  { key: "dec:harbor-locks", date: "2026-09-02", title: "Prevent double bookings with Postgres row-level locks", projects: ["@prj:harbor"], sources: ["@src:harbor-kickoff"],
    summary: "Harbor locks a bay's row in Postgres while a booking is written, so a bay cannot be booked twice.",
    body: "## Decision\nLock the bay's row (SELECT … FOR UPDATE) while a booking is written.\n\n## Context\nDouble bookings of a loading bay must be impossible.\n" },
  { key: "dec:harbor-flyio", date: "2026-09-02", title: "Host Harbor on Fly.io", projects: ["@prj:harbor"], sources: ["@src:harbor-kickoff"],
    summary: "Harbor runs on Fly.io, close to the depots.",
    body: "## Decision\nHost the Harbor API and web app on Fly.io.\n\n## Context\nFly.io regions are close to Velmor's depots.\n" },
  { key: "dec:harbor-hetzner", date: "2026-10-08", title: "Host Harbor on Hetzner in Germany", projects: ["@prj:harbor"], sources: ["@src:harbor-infra-review"], supersedes: "dec:harbor-flyio",
    summary: "Harbor moves from Fly.io to Hetzner in Falkenstein: booking data stays in Germany and the bill is lower.",
    body: "## Decision\nHost Harbor on Hetzner in Falkenstein, Germany.\n\n## Context\nVelmor's data protection officer requires booking data to stay in Germany, and the Fly.io bill doubled after the load tests.\n" },
  { key: "dec:velmor-invoicing", date: "2026-10-14", title: "Invoice Velmor monthly", projects: ["@prj:harbor"], sources: ["@src:harbor-pricing-v1"],
    summary: "Velmor is invoiced monthly, on the first working day of the month.",
    body: "Velmor is invoiced monthly, on the first working day of each month. {¶@src:harbor-pricing-v1#1}\n" },
  { key: "dec:velmor-discount", date: "2026-10-14", title: "Second-year price for Velmor", projects: ["@prj:harbor"], sources: ["@src:harbor-pricing-v1"],
    summary: "Velmor's second-year price carries an 18 percent discount.",
    body: "Velmor's second-year price carries the 18 percent discount approved on the pricing call. {¶@src:harbor-pricing-v1#2}\n" },
  { key: "dec:velmor-retainer", date: "2026-10-16", title: "Keep Velmor's support retainer at twelve hours", projects: ["@prj:harbor"], sources: ["@src:harbor-pricing-v2"],
    summary: "The Harbor support retainer for Velmor stays at twelve hours a month.",
    body: "The support retainer stays at twelve hours a month. {¶@src:harbor-pricing-v2#3}\n" },
  { key: "dec:orbit-expo", date: "2026-09-10", title: "Build Orbit with Expo", projects: ["@prj:orbit"], sources: ["@src:orbit-kickoff"],
    summary: "Orbit is built with Expo, one codebase for iOS and Android.",
    body: "## Decision\nBuild the Orbit app with Expo (React Native).\n\n## Context\nOne codebase serves iOS and Android.\n" },
  { key: "dec:orbit-offline", date: "2026-10-20", title: "Offline mode in Orbit's first release", projects: ["@prj:orbit"], sources: ["@src:orbit-kickoff", "@src:orbit-scope-call"], assessment: "contested",
    summary: "Contested: the kickoff put offline mode in the first release; the scope call moved it to the second.",
    body: "## Decision\nThe kickoff put offline mode in the first release; Tandrel's product owner later moved it to the second release, and the clinic director had asked for the first. ^[ambiguous]\n" },
  { key: "dec:quill-postmark", date: "2026-06-15", title: "Send Quill newsletters through Postmark", projects: ["@prj:quill"], sources: ["@src:quill-start"],
    summary: "Quill sends the studio newsletter through Postmark.",
    body: "## Decision\nSend newsletters through Postmark.\n" },
  { key: "dec:quill-ses", date: "2026-10-01", title: "Send Quill newsletters through Amazon SES", projects: ["@prj:quill"], sources: ["@src:quill-email-review"], supersedes: "dec:quill-postmark",
    summary: "Quill sends newsletters through Amazon SES from October 2026; Postmark is retired.",
    body: "## Decision\nSend newsletters through Amazon SES.\n\n## Context\nPostmark's price for the newsletter volume tripled.\n" },
  { key: "dec:quill-markdown", date: "2026-06-15", title: "Store Quill drafts as Markdown", projects: ["@prj:quill"], sources: ["@src:quill-start"],
    summary: "Quill stores newsletter drafts as Markdown files.",
    body: "## Decision\nDrafts are Markdown files.\n" },
  { key: "dec:studio-plausible", date: "2026-09-21", title: "Use Plausible for the studio site analytics", sources: ["@src:studio-weekly"], area: "@area:studio-ops",
    summary: "The studio site counts visits with Plausible.",
    body: "## Decision\nUse Plausible for the studio site's analytics.\n" },
  { key: "dec:studio-monthly", date: "2026-09-21", title: "Send the studio newsletter monthly", sources: ["@src:studio-weekly"], area: "@area:studio-ops",
    summary: "The studio newsletter goes out once a month.",
    body: "## Decision\nThe newsletter goes out monthly.\n" },
];

// Agent memories (0008, 0009). `approved: false` = an unapproved inferred memory left as lifecycle draft (written by
// `note new` or before 0.12.0; the closing review writes only approved ones): never eligible.
// `writer` records the session that proposed it (case metadata only, never a `sources` entry).
// `scope` is general | area:<key> | project:<key> | stack:<name>.
export const MEMORIES = [
  // general
  { key: "mem:g-no-autocommit", date: "2026-09-03", scope: "general", confidence: "verified", origin: "brain", writer: "claude-code",
    title: "Never commit without asking", summary: "Ask before every commit; never commit automatically.",
    body: "Ask the user before every commit. Never commit on your own, even after tests pass.\n" },
  { key: "mem:g-imperative", date: "2026-09-04", scope: "general", confidence: "verified", origin: "brain", writer: "codex",
    title: "Commit subjects in the imperative", summary: "Write commit subjects in the imperative mood: \"Add seat hold\", not \"Added seat hold\".",
    body: "Write commit subjects in the imperative mood, under 72 characters.\n\nFrom a Codex session on 2026-09-04.\n" },
  { key: "mem:g-pnpm", date: "2026-09-05", scope: "general", confidence: "verified", origin: "brain", writer: "claude-code",
    title: "Use pnpm for JavaScript installs", summary: "Install JavaScript dependencies with pnpm.",
    body: "Use pnpm, not npm or yarn, to install dependencies.\n" },
  { key: "mem:g-npm", date: "2026-10-12", scope: "general", confidence: "verified", origin: "brain", writer: "claude-code", supersedes: "mem:g-pnpm",
    title: "Use npm workspaces; pnpm is retired", summary: "From now on install with npm workspaces in every repo; pnpm is retired.",
    body: "From now on use npm workspaces in every repo; pnpm is retired. The user said \"from now on\" on 2026-10-12.\n" },
  { key: "mem:g-pr-description", date: "2026-09-12", scope: "general", confidence: "verified", origin: "brain", writer: "codex",
    title: "Short PR descriptions with a test line", summary: "Keep PR descriptions short and end them with the command that tested the change.",
    body: "Keep PR descriptions to a few lines and end with the test command and its result.\n" },
  { key: "mem:g-formatter", date: "2026-11-02", scope: "general", confidence: "inferred", origin: "brain", writer: "codex", approved: false,
    title: "Run the formatter before every commit", summary: "Inferred candidate: the user wants the formatter run before every commit.",
    body: "The user seems to want the formatter run before every commit. ^[inferred]\n\nExamples: two sessions reformatted files before committing.\n" },
  { key: "mem:g-markdown-width", date: "2026-09-20", scope: "general", confidence: "verified", origin: "brain", writer: "claude-code",
    title: "No hard wrapping in Markdown", summary: "Write one paragraph per line in Markdown files; do not hard-wrap.",
    body: "Do not hard-wrap Markdown paragraphs.\n" },

  // area
  { key: "mem:a-eur", date: "2026-09-08", scope: "area:area:client-work", confidence: "verified", origin: "brain", writer: "claude-code",
    title: "Client work: estimates and invoices in EUR", summary: "Client estimates and invoices are in EUR.",
    body: "Write client estimates and invoices in EUR, never in USD.\n" },
  { key: "mem:a-staging-vpn", date: "2026-09-15", scope: "area:area:client-work", confidence: "verified", origin: "brain", writer: "codex",
    title: "Client work: staging links stay behind the VPN", summary: "Never share a client staging link publicly; clients reach staging through their VPN.",
    body: "Never post a client's staging link in a public channel; the client reaches staging through its VPN.\n" },
  { key: "mem:a-tuesday", date: "2026-09-22", scope: "area:area:studio-ops", confidence: "verified", origin: "brain", writer: "claude-code",
    title: "Studio operations: blog posts go out on Tuesdays", summary: "Publish studio blog posts on Tuesdays.",
    body: "Publish the studio's blog posts on Tuesdays, mornings Central European Time.\n" },

  // project: Harbor
  { key: "mem:p-shared-db", date: "2026-09-18", scope: "project:prj:harbor", confidence: "verified", origin: "harbor-api", writer: "claude-code",
    title: "Harbor: ask before migrations, the production database is shared", summary: "Harbor's production database is shared with Velmor's legacy dispatch app; ask before any migration.",
    body: "The production database is shared with Velmor's legacy dispatch app. Ask the user before running any migration.\n" },
  { key: "mem:p-test-int", date: "2026-09-25", scope: "project:prj:harbor", confidence: "verified", origin: "harbor-api", writer: "codex",
    title: "Harbor: integration tests run with make test-int", summary: "Run Harbor's integration tests with `make test-int`, against the Docker Compose stack.",
    body: "Run `make test-int`; it starts the Docker Compose stack (Postgres and the mail stub) first.\n\nFrom a Codex session on 2026-09-25.\n" },
  { key: "mem:p-freeze-friday", date: "2026-09-19", scope: "project:prj:harbor", confidence: "verified", origin: "harbor-api", writer: "claude-code",
    title: "Harbor: no deploys on Fridays", summary: "Harbor has a deploy freeze on Fridays.",
    body: "Do not deploy Harbor on Fridays.\n" },
  { key: "mem:p-freeze-thursday", date: "2026-10-27", scope: "project:prj:harbor", confidence: "verified", origin: "harbor-api", writer: "codex", supersedes: "mem:p-freeze-friday",
    title: "Harbor: deploy freeze starts Thursday at 16:00", summary: "Correction: Harbor's deploy freeze now starts Thursday at 16:00 and lasts until Monday.",
    body: "Correction from the user on 2026-10-27: the deploy freeze starts Thursday at 16:00 and lasts until Monday, because Velmor's depots are busiest on Fridays.\n" },
  { key: "mem:p-screenshots", date: "2026-10-05", scope: "project:prj:harbor", confidence: "inferred", origin: "harbor-web", writer: "claude-code",
    title: "Harbor: show Velmor's reviewers screenshots", summary: "Inferred and approved: Velmor's reviewers answer faster when a UI change comes with screenshots.",
    body: "Velmor's reviewers answer faster when a UI change comes with screenshots than with a written description. ^[inferred]\n\nExamples: the bay picker and the booking list were approved the same day with screenshots; the text-only driver form waited four days.\n" },
  { key: "mem:p-sms", date: "2026-11-04", scope: "project:prj:harbor", confidence: "inferred", origin: "harbor-api", writer: "codex", approved: false,
    title: "Harbor: dispatchers prefer SMS alerts", summary: "Inferred candidate: Velmor's dispatchers prefer SMS alerts over email.",
    body: "Velmor's dispatchers seem to prefer SMS alerts over email. ^[inferred]\n\nExample: one dispatcher asked for a text message once.\n" },
  { key: "mem:p-discount", date: "2026-10-14", scope: "project:prj:harbor", confidence: "verified", origin: "brain", writer: "claude-code", sources: ["@src:harbor-pricing-v1"],
    title: "Harbor: quote the second-year price with Velmor's discount", summary: "Quote Velmor's second-year price with the agreed discount.",
    body: "Quote Velmor's second-year price with the 18 percent discount agreed on the pricing call. {¶@src:harbor-pricing-v1#2}\n" },
  { key: "mem:p-storybook", date: "2026-10-02", scope: "project:prj:harbor", confidence: "verified", origin: "harbor-web", writer: "codex",
    title: "Harbor web: Storybook runs on port 6006", summary: "harbor-web's Storybook runs on port 6006 with `npm run storybook`.",
    body: "Start Storybook with `npm run storybook`; it serves on port 6006.\n" },

  // project: Orbit
  { key: "mem:o-languages", date: "2026-09-12", scope: "project:prj:orbit", confidence: "verified", origin: "orbit-app", writer: "claude-code",
    title: "Orbit: patient copy in Spanish and Catalan", summary: "Every patient-facing text in Orbit is written in Spanish and Catalan.",
    body: "All patient-facing copy in Orbit ships in Spanish and Catalan; English is not offered to patients.\n" },
  { key: "mem:o-patient-ids", date: "2026-09-16", scope: "project:prj:orbit", confidence: "verified", origin: "orbit-app", writer: "codex",
    title: "Orbit: never log patient identifiers", summary: "Never write a patient identifier to a log; log the hashed id instead.",
    body: "Never log a patient identifier. Log the hashed id from `hashPatientId()` instead.\n" },
  { key: "mem:o-releases", date: "2026-10-22", scope: "project:prj:orbit", confidence: "inferred", origin: "orbit-app", writer: "codex",
    title: "Orbit: Tandrel prefers fewer, larger releases", summary: "Inferred and approved: Tandrel prefers fewer, larger releases to frequent small ones.",
    body: "Tandrel prefers fewer, larger releases to frequent small ones. ^[inferred]\n\nExamples: Tandrel asked to bundle the reminder and cancellation changes, and skipped two small test builds.\n" },
  { key: "mem:o-qa-monday", date: "2026-11-05", scope: "project:prj:orbit", confidence: "inferred", origin: "orbit-app", writer: "claude-code", approved: false,
    title: "Orbit: the QA contractor is away on Mondays", summary: "Inferred candidate: Tandrel's QA contractor is not available on Mondays.",
    body: "Tandrel's QA contractor seems unavailable on Mondays. ^[inferred]\n\nExample: two Monday test requests were answered on Tuesday.\n" },
  { key: "mem:o-simulator", date: "2026-10-09", scope: "project:prj:orbit", confidence: "verified", origin: "orbit-app", writer: "claude-code",
    title: "Orbit: start the iOS simulator with npm run ios", summary: "Run `npm run ios` in orbit-app to start the iOS simulator.",
    body: "Run `npm run ios` to build and open the app in the iOS simulator.\n" },

  // project: Quill
  { key: "mem:q-db-file", date: "2026-09-28", scope: "project:prj:quill", confidence: "verified", origin: "quill", writer: "claude-code",
    title: "Quill: the SQLite file is never committed", summary: "Quill's SQLite database lives in data/quill.db and is never committed.",
    body: "The database file is data/quill.db. It is in .gitignore; never commit it.\n" },
  { key: "mem:q-postmark", date: "2026-06-16", scope: "project:prj:quill", confidence: "verified", origin: "quill", writer: "claude-code",
    title: "Quill: test sends go through Postmark's sandbox", summary: "Send Quill's test newsletters through Postmark's sandbox server.",
    body: "Send test newsletters through Postmark's sandbox server.\n" },
  { key: "mem:q-ses", date: "2026-10-02", scope: "project:prj:quill", confidence: "verified", origin: "quill", writer: "claude-code", supersedes: "mem:q-postmark", sources: ["@dec:quill-ses"],
    title: "Quill: test sends go through the SES sandbox", summary: "Send Quill's test newsletters through the Amazon SES sandbox; Postmark is retired.",
    body: "Send test newsletters through the Amazon SES sandbox; Postmark is retired.\n" },
  { key: "mem:q-templates", date: "2026-10-03", scope: "project:prj:quill", confidence: "verified", origin: "quill", writer: "codex",
    title: "Quill: email templates live in templates/email", summary: "Quill's email templates are in templates/email, one file per newsletter section.",
    body: "Email templates are in templates/email, one file per section.\n" },

  // stack
  { key: "mem:s-postgres", date: "2026-09-26", scope: "stack:postgres", confidence: "verified", origin: "harbor-api", writer: "codex",
    title: "Postgres: migrations run in a transaction and need a down step", summary: "Run each Postgres migration in a transaction and test its down migration.",
    body: "Wrap each Postgres migration in a transaction and run its down migration once before merging.\n" },
  { key: "mem:s-expo", date: "2026-09-29", scope: "stack:react-native", confidence: "verified", origin: "orbit-app", writer: "claude-code",
    title: "React Native: pin the Expo SDK", summary: "Pin the Expo SDK minor version in app.json; upgrade it in its own PR.",
    body: "Pin the Expo SDK minor version in app.json and upgrade it in a separate PR.\n" },
  { key: "mem:s-react-role", date: "2026-10-06", scope: "stack:react", confidence: "verified", origin: "harbor-web", writer: "codex",
    title: "React: query by role in component tests", summary: "In React component tests, query elements by role, not by test id.",
    body: "In component tests use Testing Library's role queries (`getByRole`), not test ids.\n" },
  { key: "mem:s-sqlite", date: "2026-09-30", scope: "stack:sqlite", confidence: "verified", origin: "quill", writer: "claude-code",
    title: "SQLite: turn on WAL mode", summary: "Open SQLite databases in WAL mode.",
    body: "Open every SQLite database with `PRAGMA journal_mode=WAL`.\n" },
  { key: "mem:s-node-test", date: "2026-10-11", scope: "stack:node", confidence: "verified", origin: "quill", writer: "codex",
    title: "Node: use node --test for small scripts", summary: "Test small Node scripts with the built-in `node --test` runner.",
    body: "Use the built-in `node --test` runner for small scripts; no extra test framework.\n" },
];

// Linked repos, generated beside the brain. `marker: null` = a working folder with no .brain (sees only general memories).
// Work state: one row per task in build/TASKS.md; where work stopped is one `**Stopped:**` line under the row.
// `stoppedBy` is case metadata (which agent's session wrote the line); it is not written into the repo.
export const REPOS = [
  {
    name: "harbor-api", marker: { project: "prj:harbor", area: "area:client-work", stacks: ["node", "postgres"] },
    tasks: [
      { id: "T-11", title: "Export bookings to CSV", status: "done" },
      { id: "T-12", title: "Seat holds expire after ten minutes", status: "in progress", stoppedBy: "claude-code",
        stopped: "2026-11-05: done the holds table and the expiry job; tried a Postgres advisory lock for the sweep, which deadlocked under the load test; open whether an expired hold should email the driver; next switch the sweep to SELECT … FOR UPDATE SKIP LOCKED and rerun the load test." },
      { id: "T-13", title: "Driver login with magic links", status: "review", stoppedBy: "codex",
        stopped: "2026-11-06: done the magic-link email and the token table; tried a 24-hour token lifetime, which the security review rejected; open the PR review comments on rate limits; next shorten tokens to 15 minutes and answer the review." },
      { id: "T-14", title: "Cancel bookings in bulk", status: "todo" },
      { id: "T-15", title: "Rate-limit the public search endpoint", status: "in progress" },
    ],
  },
  {
    name: "harbor-web", marker: { project: "prj:harbor", area: "area:client-work", stacks: ["react"] },
    tasks: [
      { id: "T-21", title: "Seat map for the bay picker", status: "in progress", stoppedBy: "codex",
        stopped: "2026-11-04: done the seat map component and its tests; tried canvas rendering, which was too slow on the depot tablets; open which seat colours meet the contrast check; next render the seats as SVG." },
    ],
  },
  {
    name: "orbit-app", marker: { project: "prj:orbit", area: "area:client-work", stacks: ["react-native"] },
    tasks: [
      { id: "T-6", title: "Appointment list", status: "done" },
      { id: "T-7", title: "Appointment reminders", status: "in progress", stoppedBy: "codex",
        stopped: "2026-11-06: done the reminder scheduler and the Spanish and Catalan texts; tried local notifications only, which iOS dropped after a restart; open whether reminders go 24 or 48 hours ahead; next move scheduling to the server with Expo push and ask Tandrel about the lead time." },
      { id: "T-8", title: "Internal admin screen", status: "review", stoppedBy: "claude-code",
        stopped: "2026-11-03: done the admin screen in English, an exception the user allowed for this internal screen only; tried the shared form components, which worked unchanged; open the reviewer's question on the export button; next answer the review." },
    ],
  },
  {
    name: "quill", marker: { project: "prj:quill", area: "area:studio-ops", stacks: ["node", "sqlite"] },
    tasks: [
      { id: "T-3", title: "One-click unsubscribe link", status: "in progress", stoppedBy: "claude-code",
        stopped: "2026-11-02: done the unsubscribe route and the signed token; tried the List-Unsubscribe-Post header, which the SES sandbox ignored; open how to test it outside the sandbox; next send a real test to the studio inbox and check the header." },
      { id: "T-4", title: "Archive page for past issues", status: "todo" },
    ],
  },
  {
    name: "studio-site", marker: { area: "area:studio-ops", stacks: ["astro"] },
    tasks: [{ id: "T-1", title: "Move the blog to Astro", status: "done" }],
  },
  { name: "scratch", marker: null, tasks: [] },
];
