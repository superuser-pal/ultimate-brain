# Domains, selected capture and editable Review (contract, decision 0055)

**Status:** contract for release 0.8.0 (CC-76 to CC-82). Written by Claude Code in CC-75. A fresh-context sub-agent reviewed the first draft and Codex reviewed the second (8 findings, 5 of them P1); both sets are folded in. Neither has seen this revision. **Nothing in §9 is verified yet**: every Notion mechanism below is *planned* until the user's tests in §9.2 pass. A limitation that changes the agreed experience returns to the user before dependent work (CC-79, CC-80, CC-81) is built.

How this file fits: [schema.md](schema.md) holds field definitions, [cli.md](cli.md) command behavior; this file holds the cross-cutting lifecycle from a capture's selection to a Review decision and points into both. "CC-nn builds" names the implementing task. The accepted-wording rules of cli.md §5.14.7 (the hashes, the baselines SN/SG, `clear_accepted`, the re-read before apply, the click-minute limit of decision 0058) are **reused** here by analogy and named where used.

**Decisions taken in this contract that the user may veto** (each the simplest reading of 0055; none contradicts it):
1. Domains are a new note type `domain` (`dom-`), not a config list; and **Domains is off when its key is absent, even in a brain with no `modules` block** (where every other module reads as on). (§1)
2. A Won't Do status is mapped by name in `brain.json`, lives in Notion's Complete group, and the brain never sets it. (§2)
3. Selection and Review decisions are **typed text tokens** edited in the page body (0055 does not assume native controls), and Review decisions bind only after a row-level **Submit decisions** button. A typo is visible, not silent. (§4.3, §7.3)
4. Passages are **paragraph-level**, found by a **verbatim anchor quote** on each summary item, not by numbers an AI would have to count; **exclusion wins** when a paragraph is cited by both an included and an excluded item. (§4.2)
5. Claims from an extract carry a **passage reference**; re-included passages restore old claims only through a Review item. (§5.1)
6. `Track: Waiting On` and the Accept-all checkbox as the explicit mechanisms for those two behaviors. (§6, §7.3)
7. The `note.schema.json` edit for the new type is made by CC-76 with the code that reads it (§1.6).
8. Legacy Review rows keep their 0045 semantics until terminal; migration 0013 **adds** the option Request revision and does not rename Fix. (§7.9)
9. A new extract version, its restriction and the regenerated views are one operation (§5.1); an unattended run applies a selection change only after the page has settled for 2 minutes (§4.8).
10. Fail-closed defaults: a shared paragraph is not copied (§4.2); text that cannot be mapped is restricted whole when the changed input is in its lineage, even with an independent source (§5.1); a user-edited Review section is never overwritten (§7.4).

---

## 1. Domains

**1.1 Module.** `modules.domains`, **off by default** (schema §12, 0048's non-destructive switch rules), including when the `modules` block is absent (`modulesOf` special-cases it). Offered in onboarding's module checklist ("group your Areas by the work or life context they belong to"); turning it on asks nothing. Existing brains gain no required classification step. Off means: no Domain note is written or published; `area.domain` is ignored by `sync plan` (`ignored`, `MODULE_OFF`) and left out of `render`; queries do not group by Domain.

**1.2 Note type.** `domain` · prefix `dom-` · folder `domains/` · Notion: Domains. Fields in addition to schema §3: `org` (optional, one `org-` id), `notion_fields.archived` (bool). Body: description. A Domain groups the user's work in a context; an **Org describes an organization and is not replaced**. `domain.org` and the Orgs "Domains" relation follow the Orgs module: with Orgs off both are left out like any module-off relation (0048).

**1.3 Area relation.** `area.domain`: optional, **at most one** `dom-` id (a scalar). Projects stay in Areas and have no `domain` field; Documents have none. **Domain grouping follows the Area**: a Project's or Document's Domain is derived through its `area`, so a second assignment cannot be written. When a Document's `area` and the Area of one of its `projects` sit in different Domains, lint reports the info `DOCUMENT_DOMAIN_MISMATCH` (the Document's own `area` decides). Two contexts' similarly named responsibilities are two Areas.

**1.4 Notion.** A "Domains" database (Name, Summary, Org relation, Lifecycle, Brain ID, Last Synced). Areas gain a "Domain" relation, two-way with Domains "Areas", **set to "Limit: 1 page"** by hand (migration 0013; believed not settable through the API, T8); Orgs gain "Domains". `sync plan` treats Area · Domain as a correctable brain-owned relation **only when it holds at most one value**; with two values it is the conflict `MULTIPLE_DOMAINS` and nothing is applied for that row. Domains Name, Summary and Org are correctable.

**1.5 Navigation (module on).** Home's Areas tab groups areas by Domain (a heading per Domain, then "No domain"); an area home shows its Domain; a Domain page lists its Areas and Org. Off: nothing changes.

**1.6 Build.** CC-76: the type, lint rules (`area.domain` names a `domain`; a `domain`'s `org` names an `org`; no warning for an Area without a Domain), `note new`, `sync plan`/`render`, `brain modules`, onboarding, **and the `note.schema.json` edit**. Here (additive, no reader needed): `brain.schema.json` gains `modules.domains`.

| Case | Result |
|---|---|
| Module off | no Domain files published; `area.domain` kept in Git, ignored by plan, omitted by render |
| Area without Domain, module on | valid; shown under "No domain" |
| Area with two Domains in Notion | conflict `MULTIPLE_DOMAINS`; nothing applied for the row |
| Domain archived, Areas still point at it | valid; lint info |
| Orgs off | `domain.org` kept in Git, left out of Notion |
| Module turned off then on | nothing deleted; Git values return (0048) |

## 2. Won't Do

**2.1 Mapping.** `brain.json` `notion.tasks.wont_do_status` (string, optional; default `"Won't Do"`): the Tasks status option meaning "closed without doing it", placed in Notion's **Complete** group next to Done. The brain never sets it and never reads task statuses (0018: no unrestricted status sync); the contract is for the Notion space, the mapped external database and the agent's answers. Terminal and **reopenable**.

**2.2 Where it counts.**

| Surface | Rule |
|---|---|
| Due, overdue, reminders, "What's due today", Home tabs | exclude Done and Won't Do |
| Progress (Projects "Task Progress") | completed = Done; dropped = Won't Do; **active scope = total − dropped** |
| Display | `8 completed · 2 dropped`; the percentage is `completed / active scope` |
| Zero active scope | no percentage; `no active tasks` (total 0) or `0 completed · 3 dropped` (all dropped). Never 100%, never a completion claim |
| `brain query` answers about open work | dropped tasks are not open work; mentioned only when asked |
Goals and Key Results are unchanged (they do not count tasks).

**2.3 Build.** CC-77: the Prompt 4 formulas and views, the Tasks module doc, the migration step, `wont_do_status` in the config and its schema, and a connection check (a note in `brain status`, not an error, that the mapped status property lacks the option). Creating the status option is **by hand** (believed: the API cannot add or group status options, T8). `brain.schema.json` gains `notion.tasks.wont_do_status` here.

## 3. Voice captures and subject summaries

**3.1 Voice/ramble template (Inbox).** Kind Capture, Brain Status **New**. Body in order: one subject `[s1] Voice note` with items under *Highlights* (why each matters), *Commitments* (explicit only), *Ideas to explore*, each item with an id and an anchor (§4.1); then a toggle *Transcript* with the raw text verbatim. **Selection applies to a voice capture like any other input** (§4). Only the user sets **Ready**. Creating the summary never authorizes a Task.

**3.2 Recording (planned, unverified).** Whether Notion's recording/transcription can be started from a template or button, and where the transcript lands, is **not assumed** (T1). Supported either way: the user pastes a transcript, or a file is dropped. Guide fallback: "Record with your phone or Notion, paste the transcript into the Transcript toggle."

**3.3 Minutes format (amends 0043's eleven-heading prompt).** `Highlights`, `My actions`, then one `## <Subject>` section per substantive subject. Inside a subject, in this order, the sub-headings that apply: *Highlights* (why it matters), *Decisions* (an agreement), *My actions*, *Other commitments*, *Open questions*, *Concerns raised* (supported by the conversation only). Omit empty ones; never repeat a sentence in the overview and a subject; never invent a risk; uncertain owner or inferred meaning is written "needs clarification". Substantive context and source references stay. Every item line follows the grammar of §4.1.

## 4. Selection of what enters the brain

**4.1 Item grammar and identities (normative).** The summary generator (the Notion AI minutes/voice prompt, written in CC-80) writes every subject heading as `[s2] <Subject>` and every item as one line:

```
[s2.i3] (Meeting only:|Use in brain:)? (Track: Waiting On —)? <text> “<anchor quote>”{1,3} (depends on [s1])?
```

Ids are visible, unique in the page, written once by the generator and never rewritten by it; a **regenerated** summary that cannot reuse an item's id (same anchor) gives it a new one, and the old selection for it is stale (§4.6). Each anchor is a **verbatim quote of at most 12 words from the transcript**; an item carries one to three, so support that spans paragraphs cites each.

**4.2 Passage mapping (the CLI/skill computes it; no AI-authored numbers).** The transcript (or minutes text) is stored verbatim and its paragraphs are numbered `¶1…¶n` when the row is first read, with a `transcript_hash`. An item's passages = the paragraphs containing its anchors, found by **exact substring match after whitespace normalization**. **Mapped** = every anchor occurs in exactly one paragraph. An anchor found in **no** paragraph, or in **several** (identical or overlapping text recurring), is `SELECTION_UNMAPPABLE` for that item; the generator or the repair step (§9.3) must extend the quote until it is unique. **Subjects have no passages of their own**: a subject acts only through its items. `depends on [x]` must name an existing id; a missing id, or a cycle among items, makes the items concerned `SELECTION_UNMAPPABLE`. Any unmappable item is a blocker for the input (never a snapshot of the whole transcript); in an attended run the skill offers a **repair**: it proposes new anchors for those items, quoted from the transcript, and the user confirms them in the preview.

**Passage identity.** A passage is `(extract_of, transcript_hash, ¶n)`. The transcript is immutable once its hash is recorded, so `¶n` is stable; **two identical paragraphs are two passages** (different `¶n`). The `passage_hash` kept beside it is a check, not the identity.

**What the mapping proves, and does not.** It proves the cited text exists and where. Whether an item faithfully says what its anchors support is what the user reads in the preview (§4.4, §7): a stated limit. A paragraph is the unit: a selected item pulls its whole paragraph, other sentences in it included; the preview shows each paragraph's first and last words.

**Which paragraphs enter the extract (normative).** For each paragraph take the effective selection of **every** item that cites it (§4.3: its own token, else its subject's, else `use`). **If the citing items all say `use`, the paragraph is copied. If they all say `meeting only`, it is not. If they disagree, it is not copied (fail closed)**, whatever the weights of their tokens: copying it would carry the excluded item's words into Git. An item with a `use` selection whose paragraph is not copied for that reason becomes `SELECTION_UNMAPPABLE` ("shares a paragraph with excluded content"), and the §4.2 repair step proposes tighter anchors that cite a different paragraph; if the shared words cannot be separated at paragraph granularity, the input stays a blocker and the user is told which two items collide. So an explicit `Use in brain:` item under a `Meeting only` subject enters the extract only when no excluded item cites its paragraph, and a paragraph shared by items of two subjects, one excluded, is not copied. Items listed "its evidence is excluded" are not imported (as §4.7). A paragraph cited by **no** item is not in the extract; the preview lists "n paragraphs are covered by no item", and the repair step can add an item for them.

**Preview shows what is copied.** The §4.4 preview lists, for every paragraph that will be copied, its **full text** (not first and last words), with the items that cite it. **If paragraph granularity cannot satisfy both guarantees in practice (excluded words never in Git, and selected material not lost), a sentence-level extract is the alternative; that trade-off is returned to the user before CC-78 is built** (open question 1 below).

**4.3 Controls and effective selection.** Subject: the line under the heading reads `Selection: Use in brain`; the user types `Selection: Meeting only` (planned mechanism M1, §9). Item: the optional prefix of §4.1. Tokens match case-insensitively and exactly; anything else is `SELECTION_UNREADABLE`, a blocker for that input (visible: the input is listed under Needs you with the line). **Effective item selection** = the item's explicit token, else its subject's, else `use`.

| Subject | Item token | Effective |
|---|---|---|
| untouched (`Use in brain`) | none | use (all included unless marked) |
| `Meeting only` | none | **meeting only** (a subject exclusion excludes its contents) |
| `Meeting only` | `Use in brain:` | use (the explicit individual exception) |
| `Use in brain` | `Meeting only:` | meeting only |
| item outside any subject (overview Highlights, My actions) | none | use (U-default); if its paragraph is excluded by the §4.2 weights it is dropped |

**4.4 Confirmation.** Every unprocessed summary says: **All subjects included unless marked Meeting only. Mark Reviewed to confirm.** (Inbox: Ready.) Reviewed/Ready **confirms the visible selections as the first run that sees the status reads them** and nothing else. New/Not Reviewed is **unconfirmed**: never ingested. The assistant may *suggest* `Meeting only` for small talk only by writing the token for the user to see; an unfamiliar substantive subject stays `use`. Binding (decision 0058's analogy): Reviewed/Ready has no timestamp, so the confirmation is the page as **read by the first run that sees it Reviewed/Ready**; an **attended** run shows the user each subject and item with its effective selection and the **full text of every paragraph it will copy** (§4.2), and imports after a yes; an **unattended** run imports a confirmed input only when the page's `last_edited_time` is at least 2 minutes older than the run (so the page has settled), reads the tokens as they are, and states in its report that an edit in the confirming minute cannot be detected. It never turns an unconfirmed input into Reviewed/Ready (0051).

**4.5 The selected extract (source).** A selected input becomes a source with `extract: true` (CC-78 adds the fields to schema §4): body = the **selected paragraphs only**, in transcript order, each preceded by `<!-- passage ¶a item s2.i3 -->`; frontmatter `extract_of` (the Notion page id of the full input; the full text stays in Notion untouched), `extract_version` (1, 2, …), `transcript_hash`, `selection` (`[{id, effective, explicit}]` for every subject and item), `page_fingerprint` (§4.8), and for each included paragraph its `¶n` and `passage_hash` (the first 8 hex of the sha256 of its normalized text, as a check). **Never** the full transcript. A passage is identified across versions by `(extract_of, transcript_hash, ¶n)` (§4.2).

**4.6 Cases (normative).**

| Case | Result |
|---|---|
| Untouched defaults, confirmed | every cited paragraph included; extract v1 |
| Parent override | items excluded unless an item has an explicit `use` |
| Item override | only that item |
| Unconfirmed | blocker `UNCONFIRMED`; not ingested; unattended: Needs you |
| Selection changed before ingestion | the confirmed selection read is the one used |
| Selection changed **after** ingestion | **drift scan** (§4.8) finds it; a new extract version `replaces` the old one (schema §4 versions); paragraphs in the old and not in the new are **suppressed** (§5); paragraphs only in the new are new input |
| Re-inclusion (`Meeting only` back to `use`) | a new version containing it; the paragraph is `re-included`; claims that cited it stay restricted until the user accepts their **Restore** item (§5.1) or they are proposed anew |
| Summary regenerated / transcript changed (`transcript_hash` differs, ids or anchors unmatched) | `SELECTION_STALE`: the input is a blocker until the user confirms the new page; nothing is guessed from old tokens |
| Unmappable (anchor missing or ambiguous), unreadable token | `SELECTION_UNMAPPABLE`/`SELECTION_UNREADABLE`: a blocker for that input; **never a snapshot of the whole transcript** |
| Same selection read again | `DUPLICATE_SOURCE` (cli §5.5) |

**4.7 Shared context.** An item may carry `(depends on [s1])`. If an item is effectively selected and what it depends on is effectively excluded, the item is **not imported** and is listed "depends on excluded context", **unless it has an explicit `use` token**: then only its own passages are imported, and every claim written from it carries `context_excluded: true` (shown in Review, so the user sees it stands alone). There is no judgment step: the CLI checks ids only and reports `DEPENDS_ON_EXCLUDED`.

**4.8 Drift scan (selection changed after ingestion).** For every input that has an extract, the catch-up reads the Notion page again when the page's `last_edited_time` is later than the extract's `last_synced` (no filter when a baseline is missing). It **revalidates the whole page**, not only the tokens: it recomputes `page_fingerprint` = sha256 of the normalized mapping-relevant text (every subject heading and item line in full: ids, tokens, text, anchors, `depends on`; not the Transcript toggle) together with `transcript_hash`, and compares it with the one stored in the latest extract. Then, in this order:
1. `transcript_hash` differs, or any id, anchor or `depends on` differs → `SELECTION_STALE`: the mapping can no longer be trusted; a blocker for the input; no version is written. **It is recorded** as `selection_stale: <the page_fingerprint seen>` in the input's sync state (the source's system fields) and **clears only when a later read sees Reviewed/Ready on a page whose `page_fingerprint` differs from the recorded one** (the user changed the page and confirmed again); the preview (attended) or the 2-minute settle (unattended) then applies as in §4.4 and a new extract version is written. A status that merely stays Reviewed/Ready on the same stale fingerprint does not clear it. **Token and text edits together:** if no id, anchor or `depends on` changed, the tokens apply as in step 2 and the new text is adopted as in 1b; if any of those changed, step 1 wins.
1b. Only a **heading or an item's text** differs (ids, anchors, dependencies and tokens unchanged) → the mapping still holds, so no new version: the new `page_fingerprint` is adopted and logged (`selection-text-edit`), and the preview of the next version shows the new wording.
2. Only tokens differ → `selection_changes: [{ input, extract, changes: [{id, from, to}] }]` in the plan. The edit is the confirmation (no extra step). **Attended:** the preview of §4.4, then a new version. **Unattended:** only when the page's `last_edited_time` is at least 2 minutes older than the run (the page has settled; the edit-minute limit of decision 0058 is stated in the report); then the new version is written (an addition) and the restriction of §5 applies at once, with the regenerated views, in one operation; otherwise it waits (`TOO_FRESH`).
3. Nothing differs → nothing.
**Failure and retry.** The new version, its suppressed-passage record and the regenerated views are staged in the workspace checkpoint (`workspace.checkpoint()` / `restore()`, as `sync apply` does) and flushed and committed once; if any part fails the checkpoint is restored, nothing is committed, and the next run starts again from step 1 against the same latest version. The checkpoint only restores in-memory staging, so a **crash** between file writes needs its own protocol (§7.11, **write-ahead journal and recovery**): the guarantee is fail-closed recovery, not atomicity of the disk writes. A single user on a local disk is assumed for concurrent readers.

## 5. Exclusion after ingestion: what it affects and how it reconciles

**5.1 Passage references and eligible evidence (normative).** Every claim written from an extract carries a **passage reference** `src-…#¶n:<passage_hash>`: in a timeline entry the field `passage`; in a note body a marker `^[src-…#¶n:<hash>]` after the statement (a provenance marker beside §9's, required by lint on statements derived from an `extract` source). **Eligibility algorithm (normative).** For a claim, take its provenance entries (`source`/`sources`, a timeline `source`, passage references). For each entry find its **input lineage**: the input (Notion page) it came from, through `extract_of`, the `replaces` chain, or the source's `source_key`; an entry whose lineage cannot be determined is treated as belonging to **every changed input that appears elsewhere in the claim's provenance** (fail closed). Let C be the inputs that have a changed (suppressing) extract version. Then an entry is **live** if (a) its lineage is not in C, or (b) it is an extract passage `(extract_of, transcript_hash, ¶n)` present in the **latest** version of its input **and** not a re-included passage awaiting Restore (§5.2). **A claim is eligible if it has at least one live entry; otherwise it is restricted.** So a claim resting on a suppressed passage and on the same meeting's older full copy has no live entry (both are in C); a claim that also cites a different input is eligible; a re-included passage becomes live when its Restore item is accepted.

**Input lineage (normative).** The extract, its non-extract copies (a full capture of the same page, the meeting read in full) and every older version are **one input**: they count as a single source for eligibility. A claim is independently supported only by a source from a **different** input. **Text that cannot be mapped to claims** (an older note, a Document, a report line, a Brief with no passage references) fails closed: if the changed input appears anywhere in the note's lineage, the note is **restricted whole** until the cleanup row is decided, **even if it also has an independent source from another input**; the cleanup row then separates what stays. A kept Document made from the changed input is restricted whole immediately. (A safe default: it can hide a note that is mostly independent until the user answers; the cleanup row says which.)
**Writing a new extract version, committing its suppression record and regenerating the derived views (`brain views`: Briefs, Decision logs, area Briefs) are one operation** (CC-78), so a derived view never shows a restricted claim and no retrieval surface sees one between the version and the cleanup.

| Surface | Rule while a claim is restricted (cleanup pending or accepted) |
|---|---|
| `brain query` answers and candidates | the claim is excluded from the answer; the answer says "restricted: awaiting cleanup" only if asked. A note body statement carrying only restricted references is not quoted or summarized |
| `brain reflect` (0.9.0) | not a signal, not evidence |
| Pending proposals resting on it | **checked before apply**: an item resting only on restricted claims is closed `stale` (reason `source_excluded`) and not applied, even if its token is Accept |
| Derived views (Brief, Decision log, area Briefs) | the line is left out at the next `views` run |
| Reports | a line resting on it is flagged "(source excluded)" and left out of a refresh; accepted report text is not edited by the brain |
| Documents / kept text | a Document made from the excluded passage is listed (Remove / Keep); never silently deleted |
| Tasks (Notion) | listed with their link; **never cancelled or deleted by the brain** |
| Indexes | the note stays listed (it may be independently supported) |

**5.2 Reconciliation (one Review row per input, CC-78 builds).** When a new version suppresses or re-includes passages, the next catch-up writes **one** proposal (Review kind `exclusion_cleanup`, an extension of `review_notes`, §7) whose items are: per affected note, the restricted claims with the proposed removal or correction **and beside each the independently supported claims that stay** (a claim with another eligible reference is shown as kept); per affected Task, its link and "created from excluded content" for the user to act on in Notion (found through the `tasks` list of the earlier extract version, schema §4 source, for the items no longer selected); per affected Document, Remove/Keep; per **re-included** claim, **Restore**. Accepted items apply by the ordinary rules. Source versions and audit history stay (0032): an operational exclusion, not a promise to erase Git history; the Notion meeting remains intact.

**5.3 Pending cleanup.** From the moment a version suppresses a passage, its claims are restricted (§5.1), before the cleanup row is decided.

## 6. Tasks: yours by default, Waiting On explicit

Only the owner's **explicit** commitments become Tasks (cli §5.14.5). The owner is resolved with the configured identities and aliases, never a name in a prompt. Other people's commitments stay in the subject text. An item is tracked as **Waiting On** only by the token `Track: Waiting On —` in the item grammar (§4.1), after any selection prefix; `sync tasks` (CC-80 extends cli §5.14.5) then accepts an item `{ "status": "waiting_on", "owner": "<their name>" }` and renders status `Waiting On` with that name in the owner property; without the token the owner-only rule holds. Ambiguous owner, a tentative idea ("we could…") or `needs clarification` → no Task. Tasks come only from **selected** items of a **confirmed** input; an item whose anchor is excluded creates none.

## 7. Review: readable content with independent decisions

**7.1 One page per source; conflicts stay separate.** One Review row per source, items independently actionable; conflicts keep their own rows and the Answer workflow (0041). The Proposed property no longer carries detail; properties serve the queue (Name, Kind, State, Area, Your call, Decided, Decided at, Accept all).

**7.2 Item sections (page body, written by `render`, CC-79).**
- Heading: **`[a · it-9f2c1e44] Creates: <title>`** (a new draft note already written) or **`[a · it-9f2c1e44] Changes: <target title>`**, with links to the target's Notion page and to the source evidence. The visible `it-…` id is the key; letters are display only, so a re-render after a defer cannot shift a decision. `item_id` is **immutable**: assigned when the proposal is created (`it-` + 8 characters from the id alphabet, unique in the proposal and generated like `proposal new` ids), stored in the proposal file, and never recomputed, so a deferral, a regeneration or a re-render cannot move a decision onto another item.
- *Current* (a quote of the existing content, absent for a creation).
- A toggle titled exactly **"Proposed final wording"** whose children are the exact proposed final wording, editable, and **may contain any blocks, headings included** (a toggle, not a heading, so its end is unambiguous). The CLI reads the children with cli §5.14.7's block-to-Markdown rules; a block it cannot convert makes the item `UNREADABLE` (it stays Pending and is shown, not applied). A toggle "Previous proposal" is never read.
- *Why it matters*, one line. *What Accept does* ("Accept makes this draft Reviewed" / "Accept replaces the text in <target>").
- `Decision: Pending`, and for a revision `Revision request: …`.
A short first-use explanation sits at the top. Tooltips (if Notion has them, §9) may add detail, never hide consequences.

**7.3 Decision tokens, Submit decisions, and when they bind.** The user types `Decision:` as `Accept`, `Reject`, `Defer` or `Request revision` (exact; M1) and edits *Proposed*. A typo makes that item `UNREADABLE`/Pending with the line shown, never a row-wide blocker. The row has a **Submit decisions** button (Edit property on This page: **Decided** → checked, **Decided at** → Now). **Nothing is read until Decided is ticked.** A second button **Submit and accept all** also ticks **Accept all**: every item whose token is `Pending` and that is eligible (not `revision_requested`, `base_changed`, unreadable or in conflict) is then treated as `Accept`; explicit tokens win. Rules by analogy with cli §5.14.7: the row is bound by `Decided at` and the page's `page_edited_at` (an edit in a **later minute** than Decided at invalidates the row's *unapplied* decisions; the user submits again; the click-minute limit of decision 0058 applies); the skill **re-reads the page just before applying** and each item's *Proposed* hash and token must equal what was planned (else that item is dropped as `CHANGED_SINCE_PLAN`); an attended run shows each item's action, target and exact final text first; an **unattended** run applies only items whose decision is explicit, exact, current, deterministic **and whose Decided at is at least 2 minutes old** (§8).

**Precedence (normative).** For an item: an explicit item token (read after Submit) > a row-level Your call Approve/Reject on a new-layout row (read without Submit, applying each item's stored proposal text) > the legacy What to fix (old-layout rows only). A row-level call never overrides an item with an explicit token. If any item's *Proposed* was edited, a row-level Approve/Reject is refused for the row (`EDITED_PROPOSED_NEEDS_SUBMIT`). An edited pending section is never discarded by any of them.

**7.4 Consuming a submission, and our own writes (guarded).** The brain **never rewrites a whole Review body after a submission.** Three hashes per item, none of them confused: `rendered_hash` (the section as the brain last rendered it, used only to detect edits **before** a submission), `submitted_hash` (the section exactly as read at the Submit that the run is acting on, stored in `item_decisions` as `snapshot_hash`), and the item's canonical state in the proposal file. The user is **expected** to differ from `rendered_hash` (they type `Decision: Accept`, they edit *Proposed*); that is not a conflict. After applying, the brain updates **only the sections of items whose state changed** (a base change, a new revision, an applied or closed marker), one at a time, and rewrites a section **only if it still equals `submitted_hash`**, i.e. nothing changed **after** the submission was read. If it differs, the user edited after submitting: the skill does **not** overwrite; the proposal file keeps the item's canonical state **unchanged** (an item already `applied` stays applied and is never reset to Pending or applied again, §7.11); the page shows beside the section a toggle "Brain update" with what the brain would have written and, for an applied item, the line "Applied; you edited after submitting, your edit is kept: submit again to change it". After each own write the skill records the new section hash and advances the expected page fingerprint and `page_edited_at`, so a multi-item submission is not blocked by the brain's first write. A newer submission (a later **Decided at**) always wins and is read next run. Only after the section writes does the skill clear **Decided, Decided at and Accept all**, under the same guard (the page still shows that Decided at and the same decision-lines fingerprint). Invalidation is row-level for unapplied items.

**Stated limit (decision 0058's kind).** Between the re-read and the write, and inside one minute of timestamp resolution, an edit to a section can still be overwritten; reading the page and writing the section are two calls, so this is a guard that narrows the window, not an atomic compare-and-swap, and the Notion API cannot close it. If that is not acceptable, the trade-off returns to the user (open question 2 below).

**7.5 What each kind's *Proposed* is, and what Accept does.**

| Kind | *Proposed* holds | Editable | Accept |
|---|---|---|---|
| Creation (`Creates`, a draft note) | the note's body text | yes: the edit is written into the draft's body | note becomes `reviewed` |
| `update_fact` | the new value | yes (validated as an `edit`, `INVALID_RESULT` if not) | value applied; `before` is the base |
| `update_body` | the new body | yes | body replaced; `before_hash` is the base |
| `add_to_note` | the Markdown appended | yes | appended after the note, with `Source:` |
| `add_link` | the values added to the list field | yes (values) | links added |
| `supersede`, `merge`, `contradiction`, `answer` | a description of the effect | no: Accept, Reject, Defer or Request revision only | the §11.2 effect (there is no editable text; an `answer` keeps its Answer-row workflow, 0041) |

**Base per kind.** Creation: the draft note's body hash at render (an edit of *Proposed* is checked against it). `update_fact`: `before`. `update_body`: `before_hash`. `add_to_note`: `before_hash` of the target body at render (a changed body makes the item `base_changed`, so an appendix is re-shown against the new text). `add_link`: the list field's current values at render (a changed list makes it `base_changed`). A missing target makes either `base_changed`. Conflict rows and Answer rows keep their own pages and workflow (0041) and are never items of this page.

**7.6 Per-item outcomes and the row's state.**

| Token | Creates | Changes | Item state |
|---|---|---|---|
| Accept | note `reviewed` | for an editable kind the *Proposed* text applied exactly, for the others the §11.2 effect | `applied` |
| Reject | the draft is archived by the existing reject rule (§11.2) | nothing changes | `closed` |
| Defer | stays draft; item moves to a **new pending proposal** (the deferral rule of §11.3) | unchanged; item moves | `deferred` |
| Request revision | stays draft; `revision_requested` | unchanged | `pending` |
| Pending / **missing section** | unchanged | unchanged | `pending`: a missing section is never an implicit decision (the next render restores it from the proposal file) |

**State machine (amends §11.1).** The proposal's `status` stays `pending` while any item is `pending`; `item_decisions` (`{item_id, decision, decided_at, decided_by, proposed_hash, base_hash}`) records decided items, applied atomically **per item** at each catch-up; the proposal becomes `applied` when no item is `pending` (all `closed` is `closed`). **Terminal states:** a deferred item is terminal in this proposal (it lives on in its new one); `revision_requested` is `pending` until a new draft is decided; when no item is `pending`, the proposal is `applied` if at least one item was applied, else `closed`. A base change (`before`/`before_hash` no longer match) makes the item `base_changed`: not applied, re-rendered with the new *Current*, token reset to `Pending`, no silent merge. **Row-level Your call** (old Approve/Reject) is a shortcut: Approve = Accept all, Reject = Reject all, for items with no explicit token; an item with an explicit token keeps it.

**7.7 Corrections are authoritative and attributed.** If the user edits *Proposed* from "March 15" (what the source said) to "March 18" and accepts: the fact's current `facts.<field>` is March 18; its timeline keeps the source's entry (March 15, `source` = the extract, its assessment unchanged, never rewritten) **and** a new entry (value March 18, `source` = `user-correction:<proposal id>`, `assessment: accepted`, `learned` = the decision date). The brain never claims the source said March 18.

**7.8 Request revision.** The user writes the instruction on the line `Revision request:` under the item. The next draft replaces *Proposed*, keeps the user's previous edited text in a toggle "Previous proposal", and returns `Decision: Pending`. The brain never accepts a draft for the user. Unattended runs **never read** revision text (0051). Editing or deleting *Proposed* changes the proposal only; it never deletes the target note.

**7.9 Legacy rows keep their semantics (CC-79 `sync plan`, deterministic).** A Review row rendered **before** migration 0013 has the old layout (the Proposed property) and keeps the 0045 behavior until it is terminal: Approve, Reject and Fix with What to fix are read exactly as today (`NOTE_TO_READ`, `FIX_TO_READ`, `FIX_WITHOUT_TEXT`; a Fix means "apply it, corrected as written", not a new draft), with no Submit step and no conversion. Migration 0013 **adds** the Your call option **Request revision** and **does not rename Fix**. On a row of the **new layout**: a row-level Approve or Reject is read as it is today without a Submit (`decided_at` = `last_edited`) and applies each item's stored proposal text, but is **refused for the row with `EDITED_PROPOSED_NEEDS_SUBMIT`** when any item's *Proposed* was edited (the user submits instead); a row-level **Fix** or **Request revision** on a new-layout row is the conflict `ROW_REVISION_NOT_SUPPORTED` (use Request revision on an item). Nothing pending is lost, nothing is converted, and unattended runs treat all of it as today (0051).

**7.10 Publishing preserves pending edits.** `render` never rewrites a Review row's body while any item has an edited *Proposed*, a non-`Pending` token or `revision_requested` (`REVIEW_PENDING`, as `WORDING_PENDING` in cli §5.14.7), except the re-render of §7.4 after a consumed submission.

**7.11 Partial apply, recovery and missing text.** *Operation and recovery (CC-78, CC-79).* Every multi-file write of this contract (a new extract version with its suppression record and views; an item's target note plus its proposal file) follows one protocol. (1) Before writing, the command writes `_journal/<op-id>.json` with the paths it will touch and, for each, the hash of its new content (a path that does not exist yet is listed as new); (2) it writes the files; (3) it commits (every operation already ends in a git commit); (4) it deletes the journal. At the start of **every write command**, if a journal exists: if the commit for its op-id exists, delete the journal; otherwise **roll back** by restoring each listed path to the last commit (`git checkout -- <path>`) and removing each listed new path, delete the journal, report `RECOVERED <op-id>`, and carry on. A working tree that is dirty without a journal is refused (`DIRTY_TREE`), not recovered. So a crash between writes leaves either the old state or a journal that the next run undoes: no half-restricted brain and no half-applied item. *Idempotence.* `item_decisions` records an item `applied` in the same commit as its write set, so the commit is the journal of record: after recovery an item already `applied` is never applied again (by `item_id`), a pending one is re-planned. A Notion write that fails after some sections changed is completed idempotently from the proposal file on the next run. An item whose *Proposed* text is **empty, missing, or unreadable** (a block that cannot be converted) is `UNREADABLE`: it stays Pending, is shown, and is never applied or treated as a deletion. Two decisions for the same item (a re-submission before the first was applied) resolve to the later **Decided at**.

**Open questions for the user (returned, not decided).** (1) Is paragraph granularity acceptable given the fail-closed shared-paragraph rule (§4.2), or should CC-78 extract at sentence level? (2) Is the read-to-write window of §7.4 acceptable, as the same-minute limit of decision 0058 was? **CC-78 and CC-79 do not start until the user has answered both**: the task rows say so, and a sentence-level answer to (1) or a different guard for (2) changes what they build.

## 8. Module-off and unattended

| Situation | Attended | Unattended (0051, 0055) |
|---|---|---|
| Domains off | no Domain surface | same |
| Voice template; Tasks module off | summary written, no Task items | same |
| Input unconfirmed | asked to confirm; blocker otherwise | skipped, Needs you |
| Selection unreadable / stale / unmappable | blocker, explained | skipped, Needs you |
| Confirmed, page settled ≥ 2 minutes | previewed, then ingested as the extract | ingested as the extract; the confirming-minute limit stated in the report |
| Selection changed after ingestion (tokens only) | preview, new version, cleanup row | page settled ≥ 2 minutes: new version written, restriction and views at once, cleanup only proposed; else waits (`TOO_FRESH`) |
| Page changed after ingestion beyond tokens (ids, anchors, dependencies, transcript) | `SELECTION_STALE`, explained | `SELECTION_STALE`, skipped, Needs you |
| Item `Accept`, Decided ticked, exact, current, base unchanged, Decided at ≥ 2 min | preview, then applied | applied |
| `Request revision`, unreadable token, missing section, `base_changed`, ambiguous edit, Accept all with an ineligible item | shown / asked | skipped, named; never interpreted |
| Exclusion cleanup | proposed | proposed (an addition); nothing removed |
| Tasks from excluded content | listed | listed |
| Reports module off | reports not touched | same |
| Legacy Fix row (old layout) | kept as it is, read by the 0045 rules (§7.9) | kept as it is |

## 9. Notion mechanisms and feasibility

**9.1 Status.** None is verified.

| Mechanism | Used for | Status |
|---|---|---|
| M1 · typed text tokens edited in place (`Selection:`, `Decision:`, `Revision request:`) | §4.3, §7.3 | the **planned** interaction (the agreed controls are not assumed to exist natively, 0055); deterministic parse, **unverified** until T2 |
| M2 · a row button: Edit property → checkboxes + Now | Submit decisions, Submit and accept all | the same action as 0054's Accept buttons; **not verified** (T3) |
| M3 · page `last_edited_time` through the MCP | invalidation, drift scan (§4.8, §7.3) | **not verified** (T4) |
| M4 · toggle blocks | Transcript, Previous proposal | planned |
| M5 · native recording / transcription | voice capture | **unknown** (T1); fallback §3.2 |
| M6 · native per-section buttons, per-item select controls, tooltips | nicer controls | **not assumed**; M1 is the supported interaction |
| M7 · the generator writing ids, verbatim anchors and `depends on` | §4.1 | **unverified AI behavior** (T6) |
| M8 · the API creating status options and groups; a relation limit | §2.3, §10 | **believed** not possible (T7, T8); stated as by-hand steps until checked |

**9.2 Tests for the user, on synthetic pages, with pass criteria.** Record each answer in docs/notion-space-design.md.
- **T1 · Recording.** Pass: Notion records and transcribes a 30-second voice note on a throwaway Inbox page, the transcript lands as readable blocks, and Brain Assistant or the MCP can read them. Else: fallback §3.2.
- **T2 · Editable tokens.** Edit `Decision: Pending` to `Decision: Accept`, and `Selection: Use in brain` to `Selection: Meeting only`, five times each with different edits (bold it by accident, add a trailing space, paste). Pass: the agent reads the exact current text each time, and Notion keeps plain text (no auto-format). Also: ask Notion AI to regenerate a summary section that holds an edited token; pass = the token is preserved or the loss is detectable.
- **T3 · Submit button.** A button with Edit property on This page: a checkbox → checked, a checkbox → checked, a date-time → Now. Pass: all three change on one click and the date-time holds the click time to the minute.
- **T4 · Edit times.** After editing one paragraph, then deleting one, does the MCP return the page's `last_edited_time` and does it move both times? (Also needed by cli §5.14.7.)
- **T5 · Inline controls (optional).** Is there a per-section select-like control in a page body (an inline database, a synced block)? Yes → it may replace M1.
- **T6 · Anchors.** Run the minutes prompt of §3.3 on a synthetic transcript. Pass: at least 9 of 10 items carry an id and anchors that occur verbatim, each in exactly one paragraph, and the §4.2 repair step fixes the rest; and Notion shows where a meeting's transcript lives and the MCP can read it. (Every unmappable item blocks its input, so 9 of 10 is the bar for acceptable friction, not for correctness.)
- **T7 · Relation limit.** Can the Areas · Domain relation be set to "Limit: 1 page"? No → `MULTIPLE_DOMAINS` is the only guard.
- **T8 · API limits.** Through the integration, can a status option be added to a Tasks status property and placed in the Complete group? Can a relation limit be set? Expected no to both (§10 says by hand); any yes moves the step to the agent.

**9.3 If a test fails.** T1 → transcripts are pasted or dropped. T2 or T3 → the Review decision interaction needs another mechanism: **material, returns to the user before CC-79/CC-80/CC-81**. T4 → treat any later page edit as an edit (already allowed in cli §5.14.7); the drift scan then reads every ingested extract's page each run. T6 → the anchors move to a skill step (the skill, not Notion AI, drafts the items and quotes the transcript) — also material, returns to the user. T5, T7 → bonus/guard only. **Gating:** CC-79 needs T2, T3, T4; CC-80 needs T1, T2, T6; CC-81 needs all.

## 10. Migration 0013 (specified here, written by CC-81)

After 0012. Who does each step: **agent** (API), **Notion AI**, **by hand**.
- agent: Review · **Decided**, **Accept all** (checkboxes), **Decided at** (date-time); Review · Your call option **Request revision** (**added**; Fix is kept, §7.9); Areas · **Domain** relation and Orgs · **Domains** (Domains module).
- Notion AI: the **Domains** database (module on); the Inbox **voice/ramble** template; Home's Areas tab grouped by Domain.
- by hand: the Tasks status option **Won't Do** in the Complete group (believed not possible through the API, T8); the Domain relation **Limit: 1 page**; the **Submit decisions** and **Submit and accept all** buttons and their layout; the first-use explanation on the Review row template; Tasks formulas and views for Won't Do (CC-77's prompts); the "How it works" page.
- **Order and rollback.** 0013 follows 0012 and every step is additive: nothing is renamed or deleted. If T2, T3 or T6 fails before CC-79 to CC-81 are built, 0013 is not released and the old Review layout stays supported (§7.9); a space that ran it can leave the new properties unused. Rendering the new layout is switched by the presence of the Decided property, so removing it returns every new row to the old path.
- Preserve existing row content, pending decisions and the option to leave Domains off. Verify list: each property; an old Fix row still read as before and a row-level Fix on a new-layout row refused with its message; a Won't Do task excluded from due views and 8 done + 2 dropped showing `8 completed · 2 dropped`; the voice template staying New; a test Review page with Accept, Reject, Defer and Request revision tokens and Submit decisions; Accept all.

## 11. What each task builds

| Task | Builds | From |
|---|---|---|
| CC-76 | Domain type, module, lint, sync/render, onboarding, `note.schema.json` | §1 |
| CC-77 | Won't Do mapping, formulas, views, connection check | §2 |
| CC-78 | extract sources and fields, anchor mapping, selection parsing and checks, versions, passage references and lint, suppression and eligibility, drift scan, cleanup proposal | §4, §5 |
| CC-79 | Review page rendering with item ids, item decisions and `item_decisions`, Submit decisions plan/apply, consuming a submission, base checks, attribution, revision state, legacy Fix, `REVIEW_PENDING` | §7 |
| CC-80 | skills: voice and minutes prompts with the item grammar and anchors, selection flow and previews, owner-only Tasks and Waiting On, the new Review flow, query/reflection eligibility | §3, §4, §5.1, §6, §7 |
| CC-81 | templates, guidance, migration 0013 | §10 |
| CC-82 | end-to-end acceptance on a synthetic brain | all |
