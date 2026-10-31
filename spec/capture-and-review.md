# Domains, selected capture and editable Review (contract, decision 0055)

**Status:** contract for release 0.8.0 (CC-76 to CC-82). Written by Claude Code in CC-75 **without an independent review** (Codex was unavailable); the first reader other than the author is the user. **Nothing in §9 is verified yet**: every Notion mechanism below is *planned* until the user's tests in §9.2 pass. A limitation that changes the agreed experience returns to the user before dependent work (CC-80, CC-81) is built.

How this file fits: [schema.md](schema.md) holds field definitions, [cli.md](cli.md) command behavior; this file holds the cross-cutting lifecycle from a capture's selection to a Review decision and points into both. Where a section says "CC-nn builds", that task implements it. Accepted-wording rules of CC-70/CC-72 (cli.md §5.14.7: the three hashes, SN and SG, the click-minute limit of decision 0058) are **reused**, not restated.

**Decisions taken in this contract that the user may veto** (each is the simplest reading of 0055; none contradicts it):
1. Domains are a new note type `domain` (`dom-`), not a config list. (§1)
2. A Won't Do status is mapped by name in `brain.json` and lives in Notion's Complete group; the brain never sets it. (§2)
3. Per-item decisions in a Review page are read from **editable text tokens** in the body, and become binding only after a row-level **Submit decisions** button sets **Decided** and **Decided at**. (§7)
4. The JSON Schema for the new note type is edited by CC-76 with the code that reads it, not here (§1.6): a schema that validates keys nothing reads is worse than none. `brain.schema.json` gets only the two additive config keys.

---

## 1. Domains

**1.1 Module.** `modules.domains`, **off by default** (schema §12, decision 0048's non-destructive switch rules). Offered in onboarding's module checklist with one line ("group your Areas by the work or life context they belong to"); turning it on asks nothing. Existing brains gain no required classification step. **Unlike the other modules, Domains is off when the key is absent, even in a brain with no `modules` block** (where every other module reads as on): `modulesOf` special-cases it. `brain modules` lists it; off means: no Domain note is written or published, `area.domain` is ignored by `sync plan` (`ignored`, `MODULE_OFF`) and left out of `render`, and queries do not group by Domain.

**1.2 Note type.** `domain` · prefix `dom-` · folder `domains/` · Notion: Domains. Fields in addition to schema §3: `org` (optional, one `org-` id: the Org this context relates to), `notion_fields.archived` (bool). Body: description. A Domain groups the user's work in a context; an **Org describes an organization and is not replaced**: `domain.org` is a plain optional link, and no Org is required for a Domain or the reverse.

**1.3 Area relation.** `area.domain`: optional, **at most one** `dom-` id (a scalar, never a list). Projects stay in Areas and have no `domain` field; Documents have none either. **Domain grouping follows the Area**: a Project's or Document's Domain is derived (Notion rollup through its Area), so a second, contradictory assignment cannot be written. Two contexts' similarly named responsibilities are two Areas.

**1.4 Notion.** A "Domains" database (Name, Summary, Org relation, Lifecycle, Brain ID, Last Synced); Areas gain a "Domain" relation, two-way with Domains "Areas"; Orgs gain "Domains" (the inverse of Domains "Org"). `sync plan` treats Area · Domain as a correctable brain-owned relation (first value), Domains Name and Summary as correctable, Org as correctable; `render` publishes Domains with the usual three-way rules.

**1.5 Navigation (module on).** Home's Areas tab groups the areas by Domain (a heading per Domain, then "No domain" for ungrouped Areas); an area home shows its Domain as a property; a Domain page lists its Areas and Org. With the module off nothing changes.

**1.6 Build.** CC-76: the type, the lint rules (`area.domain` must name a `domain` note; a `domain` note's `org` must name an `org`; no warning for an Area without a Domain), `note new`, `sync plan`/`render`, `brain modules`, onboarding, and **the `note.schema.json` edit** for the type. Here (additive, no reader needed): `brain.schema.json` gains `modules.domains` (boolean, default false).

| Case | Result |
|---|---|
| Module off | no Domain files published; `area.domain` kept in Git, ignored by plan, omitted by render |
| Area without Domain, module on | valid; shown under "No domain" |
| Area with two Domains in Notion | `sync plan` conflict `MULTIPLE_DOMAINS`; nothing applied |
| Domain archived, Areas still point at it | valid; lint info, no error |
| Turning the module off then on | nothing is deleted; Git values return (0048) |

## 2. Won't Do

**2.1 Mapping.** `brain.json` `notion.tasks.wont_do_status` (string, optional; default `"Won't Do"`): the name of the Tasks status option that means "closed without doing it". The option sits in Notion's **Complete** group next to Done. The brain never sets it and never reads task statuses (0018 stands: no unrestricted task-status sync); the contract is for the Notion space, the mapped external database and the agent's query answers. Terminal and **reopenable**: the user sets the status back.

**2.2 Where it counts.**

| Surface | Rule |
|---|---|
| Due, overdue, reminders, "What's due today", Home tabs | exclude Done **and** Won't Do |
| Progress (Projects "Task Progress", Goals via Key Results where tasks feed them) | completed = Done; dropped = Won't Do; **active scope = total − dropped** |
| Display | `8 completed · 2 dropped`; the percentage is `completed / active scope` |
| Zero active scope (no tasks, or only dropped) | no percentage is shown; text `no active tasks` (total 0) or `0 completed · 3 dropped` (all dropped). Never 100%, never a completion claim |
| `brain query` / agent answers about open work | dropped tasks are not open work; they are mentioned only when asked |

**2.3 Build.** CC-77: the Prompt 4 formulas and views, the Tasks module doc, the migration step, `wont_do_status` in `brain.json` and its schema, and the connection check that the mapped status property has the option (a `brain modules`/`status` note, not an error). `brain.schema.json` gains `notion.tasks.wont_do_status` here.

## 3. Voice captures and subject summaries

**3.1 Voice/ramble template (Inbox).** Kind Capture, Brain Status **New**. Body, in order: *Highlights* (concise, each says why it matters), *Commitments* (explicit ones only), *Ideas to explore*, then a toggle *Transcript* holding the raw text verbatim. Only the user sets **Ready**. Creating the summary never authorizes a Task.

**3.2 Recording (planned, unverified).** Whether Notion's own recording/transcription can be started from a template or button, and where its transcript lands, is **not assumed** (§9.2, test T1). Supported either way: the user pastes a transcript, or a file is dropped. Fallback text for the guide: "Record with your phone or Notion, paste the transcript into the Transcript toggle."

**3.3 Minutes format (amends the 0043 eleven-heading prompt).** `Highlights`, `My actions`, then one `## <Subject>` section per substantive subject. Inside a subject, the sub-headings that apply, in this order: *Highlights* (why it matters), *Decisions* (an agreement), *My actions*, *Other commitments*, *Open questions*, *Concerns raised* (supported by the conversation only). Omit empty ones; never repeat the same sentence in the overview and a subject; never invent a risk; uncertain owner or inferred meaning is written as "needs clarification". Substantive context and source references stay.

## 4. Selection of what enters the brain

**4.1 Identities (normative).** The summary generator writes a visible id at the start of every subject heading and every item line and never rewrites it afterwards: subject `[s1]`, `[s2]`… in page order; item `[s2.i3]`. Ids are unique in the page and **stable across edits of the text**; a regenerated summary keeps an item's id only if the skill can match it by its passage references (§4.2), else it gets a new id and the old selection for it is stale (§4.6).

**4.2 Passage mapping.** The transcript (or minutes text) is stored verbatim and its paragraphs are numbered `¶1…¶n` when the row is first read. Every item carries `from ¶a–b` (one or more ranges) written by the generator. **Mapped** = every range lies inside `¶1…¶n` of the *same transcript hash*. A subject's passages are the union of its items' ranges plus its own `from` ranges. An item with no range, a range out of bounds, or a transcript whose hash changed since the ranges were written is **unmappable**.

**4.3 Controls and effective selection.** Subject marker, planned mechanism M1 (§9): the line under the subject heading reads `Selection: Use in brain`; the user changes it to `Selection: Meeting only`. Item marker: an optional prefix `Meeting only:` or `Use in brain:` on the item line (absent = inherit). Tokens are matched case-insensitively and exactly; anything else is `SELECTION_UNREADABLE` (a blocker for that input). **Effective item selection** = the item's explicit token, else its subject's, else `use`.

| Subject | Item token | Effective | Why |
|---|---|---|---|
| untouched (`Use in brain`) | none | use | default: all included unless marked |
| `Meeting only` | none | **meeting only** | a subject exclusion excludes its contents |
| `Meeting only` | `Use in brain:` | use | the explicit individual exception |
| `Use in brain` | `Meeting only:` | meeting only | item override |
| item with no subject (overview Highlights, My actions) | none | use | overview items inherit `use`; an overview item that restates an excluded subject's content is dropped by §4.7 |

**4.4 Confirmation.** Every unprocessed summary says: **All subjects included unless marked Meeting only. Mark Reviewed to confirm.** (Inbox rows: Ready.) Reviewed/Ready **confirms the visible selections as read at that moment** and nothing else (it approves no later proposal). `Not Reviewed`/`New` is **unconfirmed**: never ingested. An assistant may *suggest* `Meeting only` for small talk but only by writing the token for the user to confirm; an unfamiliar substantive subject stays `use`. An unattended run uses confirmed selections only and never turns an unconfirmed row into Reviewed/Ready (0051).

**4.5 The selected extract (source).** What goes into Git for a selected input is a source with `extract: true` (schema §4 source; CC-78 adds the fields): body = the **selected passages only**, in transcript order, each preceded by `<!-- passage ¶a–b item s2.i3 -->`; frontmatter `extract_of` (the Notion page id of the full input; the full text stays in Notion untouched), `extract_version` (1, 2, …), `transcript_hash`, and `selection`: `[{ id, effective, explicit }]` for every subject and item. **Never** the full transcript. Real wording and provenance are kept; an AI summary is not a substitute for source evidence.

**4.6 Cases (normative).**

| Case | Result |
|---|---|
| Untouched defaults, confirmed | everything included; extract v1 holds all passages |
| Parent override | the subject's items are excluded unless an item has an explicit `use` |
| Item override | only that item changes |
| Unconfirmed | blocker `UNCONFIRMED`; not ingested; unattended: listed under Needs you |
| Selection changed, then confirmed again, nothing ingested yet | the new selection is the one read |
| Selection changed **after** ingestion, confirmed | new extract version `replaces` the old one (schema §4 versions); passages in the old and not in the new are **suppressed** (§5); passages in the new and not in the old are new input |
| Re-inclusion (a `Meeting only` goes back to `use`) | new version containing it; the suppression of that passage is lifted; its notes are proposed as new input, not silently restored |
| Summary regenerated or transcript changed (`transcript_hash` differs; ids unmatched) | `SELECTION_STALE`: the previous choices cannot be mapped; the input is a blocker until the user confirms the new page; nothing is guessed from the old tokens |
| Unmappable (no range, out of bounds, unreadable token) | `SELECTION_UNMAPPABLE`/`SELECTION_UNREADABLE`: a blocker **for that input**; never a snapshot of the whole transcript |
| Same selection read again | `DUPLICATE_SOURCE` (cli §5.5), as today |

**4.7 Shared context.** A summary item may name `depends on [s1]` (the generator writes it when an item only makes sense with another). If an item is selected and what it depends on is excluded, the item is **not imported** and is listed "depends on excluded context" for the user, unless it has an explicit `use` token, in which case only its own passages are imported and the resulting claims are written standalone only where the passage itself carries the meaning; otherwise skipped. An overview item (Highlights) that restates an excluded subject is removed from the extract by the same rule. The CLI checks `depends on` against effective selections and reports `DEPENDS_ON_EXCLUDED`.

## 5. Exclusion after ingestion: what it affects and how it reconciles

**5.1 Eligible evidence (normative).** A claim (a fact timeline entry, a note body statement, a Decision, a Task) is **eligible** if at least one provenance entry (its `source`/`sources`, a timeline `source`) points at a source version and a passage that is **not suppressed**. A suppressed passage is one present in an earlier extract version of the input and absent from the latest. A claim with *no* eligible provenance is **restricted**.

| Surface | Rule while a claim is restricted (cleanup pending or accepted) |
|---|---|
| `brain query` answers and candidates | excluded; the answer may say "restricted: awaiting cleanup" only if the user asks |
| `brain reflect` (reflection, 0.9.0) | not a signal and not evidence |
| Pending proposals resting on it | closed `stale` (schema §11.1) with reason `source_excluded` when next read; not applied |
| Derived views (Brief, Decision log, area Briefs) | the claim's line is left out at the next `views` run |
| Reports | a report line resting on it is flagged "(source excluded)" and left out of a refresh; accepted report text is not edited by the brain |
| Documents and kept text | a Document made *from* the excluded passage is listed for the user (Remove / Keep); never silently deleted |
| Tasks (Notion) | listed with their Notion link; **never cancelled or deleted by the brain** |
| Indexes (`index.md`, `index.json`) | the note stays listed (the note may be independently supported); only restricted claims are omitted from summaries |

**5.2 Reconciliation (one Review row per input, CC-78 builds).** When a new extract version suppresses passages, the next catch-up writes **one** proposal (Review kind `exclusion_cleanup`, an extension of `review_notes`, §7) whose items are: for each affected note, the restricted claims with the proposed removal or correction **and, beside it, the independently supported claims that stay** (so nothing independently supported is erased); for each affected Task, its link and a note "created from excluded content" for the user to act on in Notion; for each affected Document, Remove/Keep. Accepted items apply by the ordinary rules. Source versions and audit history stay (0032): this is an operational exclusion, not a promise to erase Git history. The original Notion meeting remains intact.

**5.3 Pending cleanup.** From the moment a version suppresses a passage, its claims are restricted (§5.1) even before the cleanup row is decided.

## 6. Tasks: yours by default, Waiting On explicit

Only the owner's **explicit** commitments become Tasks (cli §5.14.5). The owner is resolved with the configured identities and aliases (`owner.name`, the onboarding identities), never a name written in a prompt. Other people's commitments stay in the subject text. An item can be tracked as **Waiting On** only by an explicit token on its line, `Track: Waiting On`, which `sync tasks` renders with status `Waiting On` and the other person's name in the owner property. Ambiguous owner, tentative idea ("we could…"), or `needs clarification` → no Task. Creating a summary never creates a Task; Tasks come from **selected** items of a **confirmed** input.

## 7. Review: readable content with independent decisions

**7.1 One page per source; conflicts stay separate.** Ordinary changes: one Review row per source, sections (items) independently actionable. Conflicts keep their own rows and the Answer workflow (0041). The Proposed property no longer carries the detail; properties serve the queue (Name, Kind, State, Area, Decided, Decided at, Your call).

**7.2 Item sections (the page body, written by `render`, CC-79).** Each item `[a]`, `[b]`… (letters as today, §11.3), with a stable `item_id` stored in the proposal (`it-` + first 8 hex of sha256 of `kind`, `target`, `field`; unique in the proposal; reused if the item is re-rendered):
- Heading: **`[a] Creates: <title>`** (a new draft note already written) or **`[a] Changes: <target title>`** (an existing note), with a link to the affected note's Notion page and to the source evidence (the extract passage or the meeting).
- *Current:* the existing content (a quote) for a change; absent for a creation.
- *Proposed:* the exact replacement or creation text, in a block the user can edit. This is the **proposed final wording**.
- *Why it matters:* one line.
- *What Accept does:* "Accept makes this draft Reviewed" / "Accept replaces the text above in <target>".
- `Decision: Pending` on its own line.
A short first-use explanation sits at the top of the page. Tooltips (if Notion offers them, §9) may add detail but never hide the consequences.

**7.3 Decision tokens and when they bind.** The user sets `Decision:` to `Accept`, `Reject`, `Defer` or `Request revision` (exact tokens; M1 as §4.3) and edits *Proposed* freely. The row has a **Submit decisions** button (Edit property on This page: **Decided** → checked, **Decided at** → Now). **Nothing is read until Decided is ticked.** Then the rules of cli §5.14.7 apply by analogy, per row: a body edit in a later minute than Decided at invalidates the row's decisions (the user submits again); the click-minute limit of decision 0058 applies; the skill re-reads the page immediately before applying and compares each item's *Proposed* hash and token with what it planned; the catch-up shows an attended preview (each item: action, target, exact final text), and an unattended run applies only items whose decision is explicit, exact, current and deterministic (§8). A whole-page **Accept all** is a shortcut that sets every *eligible pending* item's token to `Accept`; it cannot bypass an unresolved revision, a conflict or a stale item.

**7.4 Exact acceptance and base checks.** Accepting an item binds to the exact *Proposed* text (its hash) **and** the canonical base: the target's current fact value or body hash at proposal time (`before`, `before_hash`, §11.3). At apply, a changed base makes the item `base_changed`: it is not applied, the item is re-rendered with the new *Current*, its token resets to `Pending`, and the user reviews again; there is no silent merge. A later edit of an accepted item's *Proposed* invalidates only that item.

**7.5 Outcomes (per item).**

| Token | New draft note (`Creates`) | Existing note (`Changes`) | Row |
|---|---|---|---|
| Accept | note becomes `reviewed` | the *Proposed* text is applied exactly | item `applied` |
| Reject | the draft stays a `draft` note and is archived by the existing reject rule (§11.2) | nothing changes | item `closed` |
| Defer | stays `draft`; item moves to a **new pending proposal** (the deferral rule of §11.3) | unchanged; the item moves likewise | item `deferred` |
| Request revision | stays `draft`; item stays `pending` with state `revision_requested` | unchanged; same | item `pending` |
| Pending / missing section | unchanged | unchanged | item `pending`: **a missing section is never an implicit decision** |

The row is `applied` when no item is `pending`; until then it stays `pending` and decided items are applied at the next catch-up (partial decisions). CC-79 stores per-item `item_decisions` in the proposal file (`{item_id, decision, decided_at, decided_by, proposed_hash, base_hash}`); a Fix/legacy row is converted per §7.8.

**7.6 Corrections are authoritative and attributed.** If the user edits *Proposed* from "March 15" (what the source said) to "March 18" and accepts, the fact's current value is March 18 and its history keeps **both** statements: the source's entry (March 15, `source` = the extract) and the user's (`value` March 18, `source` = `user-correction:<proposal id>`, `assessment: accepted`). The brain never claims the source said March 18.

**7.7 Request revision.** The user writes the instruction on the line `Revision request:` under the item. The item keeps state `revision_requested`; the next draft replaces *Proposed*, keeps the user's previous edited text in a toggle "Previous proposal", and returns `Decision: Pending`. The brain never accepts a draft for the user. Unattended runs **never read** revision text (0051). Editing or deleting *Proposed* changes the proposal; it never deletes the target note.

**7.8 Legacy Fix and What to fix.** Migration 0013 renames the Your call option **Fix** to **Request revision**, keeping every stored value; `sync plan` reads both names. A row with Your call Fix and a What to fix text becomes one row-level revision request: the text is copied to each item's `Revision request:` only when the text names an item letter, else it stays on the row as the instruction for the whole row. No pending instruction or decision is lost; `FIX_TO_READ`/`FIX_WITHOUT_TEXT` keep working until every old row is terminal.

**7.9 Publishing preserves pending edits.** `render` never rewrites a Review row's body while any item has an edited *Proposed*, a non-`Pending` token, or a `revision_requested` state; it appends nothing silently. Same hold as accepted wording (0054, cli §5.14.7 `WORDING_PENDING`; here `REVIEW_PENDING`).

## 8. Module-off and unattended

| Situation | Attended | Unattended (0051, 0055) |
|---|---|---|
| Domains off | no Domain surface | same |
| Voice template, Tasks module off | summary written, no Task items | same |
| Input unconfirmed | asked to confirm; blocker otherwise | skipped, Needs you |
| Selection unreadable/stale/unmappable | blocker, explained | skipped, Needs you |
| Confirmed selection | ingested as the extract | ingested as the extract |
| Item `Decision: Accept`, Decided ticked, exact, current, base unchanged | preview, then applied | applied |
| Item with `Request revision`, unreadable token, missing section, `base_changed`, ambiguous edit | shown / asked | skipped, named; never interpreted |
| Exclusion after ingestion | cleanup row proposed | cleanup row proposed (an addition); nothing removed |
| Tasks from excluded content | listed | listed |
| Reports module off | reports not touched | same |

## 9. Notion mechanisms and feasibility

**9.1 Status of each mechanism.**

| Mechanism | Used for | Status |
|---|---|---|
| M1 · text tokens edited in place (`Selection: …`, `Decision: …`, `Revision request: …`) | §4.3, §7.3 | planned; parsing is deterministic but depends on the user editing a plain line (T2) |
| M2 · a button on the row: Edit property → checkbox + Now | Submit decisions | the same action as the Accept buttons of 0054; **not verified** (T3) |
| M3 · page `last_edited_time` through the Notion MCP | invalidation (§7.3, as cli §5.14.7) | **not verified** (T4) |
| M4 · toggle blocks in the body | Transcript, Previous proposal | planned (toggles are ordinary blocks) |
| M5 · native recording / transcription | voice capture | **unknown** (T1); fallback in §3.2 |
| M6 · native per-section buttons, per-item select controls, tooltips | nicer item controls | **not assumed**; M1 is the supported interaction |

**9.2 Tests for the user (on synthetic pages), to run before CC-80 and CC-81.** Each answer is recorded in docs/notion-space-design.md as verified.
- **T1 · Recording.** In a throwaway Inbox page, can Notion record and transcribe a short voice note (from a template button or the page)? Where does the transcript land (a block? an AI meeting-notes block?), and can an agent read it through the MCP?
- **T2 · Editable tokens.** On a page, edit a line `Decision: Pending` to `Decision: Accept`. Can Brain Assistant and the MCP read the exact current line text? Does the line survive a re-render (no formatting change)?
- **T3 · Submit button.** A button with Edit property on This page: a checkbox → checked and a date-time property → Now. Does the date-time hold the click time to the minute?
- **T4 · Edit times.** After editing one paragraph, does the MCP return the page's `last_edited_time`, and does it move when a block is deleted? (Already needed by cli §5.14.7.)
- **T5 · Inline controls (optional).** Can a page body hold a select-like control per section (an inline database, a status property on a sub-page, a synced block)? If yes it can replace M1; if no, M1 stands.

**9.3 If a test fails.** T1 fails → transcripts are pasted or dropped (nothing else changes). T2 or T3 fails → the Review decision interaction needs another mechanism; **this is a material limitation and returns to the user before CC-79/CC-80/CC-81 are built**. T4 fails → the page-edit invalidation of §7.3 and cli §5.14.7 needs the same fallback already allowed there (treat any later property edit as an edit). T5 is a bonus.

## 10. Migration 0013 (specified here, written by CC-81)

After 0012. Who does each step: **agent** (API), **Notion AI** (a prompt), **by hand**.
- agent: create nothing that needs a database (the API can't); properties: Review · **Decided** (checkbox), **Decided at** (date-time); Review · Your call option **Fix → Request revision** (rename, values kept); Tasks status option **Won't Do** in the Complete group (if the mapped database allows it); Areas · **Domain** relation and Orgs · **Domains** (Domains module).
- Notion AI: the **Domains** database (module on), the Inbox **voice/ramble** template, the Home Areas tab grouping by Domain.
- by hand: the **Submit decisions** button on Review rows and its layout, the first-use explanation on the Review row template, the Tasks formulas and views for Won't Do (CC-77's prompts), the "How it works" page.
- Preserve existing row content, pending decisions and the option to leave Domains off. Verify list: each property, the renamed option with an old Fix row still readable, the Won't Do exclusions on due views and a 2-dropped/8-done progress example, the voice template staying New, a test Review page with Accept/Reject/Defer/Request revision tokens and Submit decisions.

## 11. What each task builds

| Task | Builds | From |
|---|---|---|
| CC-76 | Domain type, module, lint, sync/render, onboarding, `note.schema.json` | §1 |
| CC-77 | Won't Do mapping, formulas, views, connection check | §2 |
| CC-78 | extract sources, selection parsing and checks, versions, suppression, exclusion eligibility, cleanup proposal | §4, §5 |
| CC-79 | Review page rendering, item decisions, Submit decisions plan/apply, base checks, attribution, revision state, legacy Fix | §7 |
| CC-80 | skills: voice summary, minutes format, selection flow, owner-only Tasks and Waiting On, the new Review flow, query/reflection eligibility | §3, §4.7, §5.1, §6, §7 |
| CC-81 | templates, guidance, migration 0013 | §10 |
| CC-82 | end-to-end acceptance on a synthetic brain | all |
