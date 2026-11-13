# The template's Example rows

The exact content of every `Example · ` row in the published Notion template, and the Notion AI prompts that create them, so a maintainer can rebuild them (decisions 0084 §3, 0087). [TEMPLATE.md](TEMPLATE.md) lists the rows; "Building and updating the template", step 7, uses this file.

Every row is invented. They tell one story with synthetic names only: a kickoff meeting with Sam Rivera of Northwind Studio, a client, about refreshing its website. Each title starts with `Example · ` (the word, a space, the middle dot `·`, a space), and each row is left in a state no skill acts on (spec/setup.md §6.5). "Set up my brain" moves them all to Notion's trash after one yes.

## The story

| Row | Database | Title | State | Related to (relation names as in the template) |
|---|---|---|---|---|
| 1 | Domains | `Example · Work` | | |
| 2 | Areas | `Example · Clients` | | Domain → 1 |
| 3 | Orgs | `Example · Northwind Studio` | Relationship Client | |
| 4 | People | `Example · Sam Rivera` | Role "Marketing lead" | Org → 3 |
| 5 | Projects | `Example · Website refresh` | | Area → 2 |
| 6 | Meetings | `Example · Kickoff with Northwind` | Brain Status Not Reviewed; Date the day you build it; the minutes below | Project → 5, Area → 2, Attendees → 4 |
| 7 | Tasks | `Example · Send the project plan` | Status To Do | Project → 5, Meeting → 6 |
| 8 | Tasks | `Example · Brand guidelines from Sam` | Status Waiting On | Project → 5, Meeting → 6 |
| 9 | Inbox | `Example · Notes from a call with Sam` | Kind Capture, Brain Status Done, Summary below; Document asked unticked, Only keep empty, Brain ID empty | Project → 5, People → 4 |
| 10 | Decisions | `Example · Keep the blog as it is` | Lifecycle Draft, Assessment Accepted, Summary below; Promote asked unticked, Brain ID empty | Decided In → 6, Project → 5 |
| 11 | Questions | `Example · Can the site go live by the end of March?` | Status Open, Lifecycle Draft, Kind Question, Summary below; Brain ID empty | Raised In → 6, Project → 5 |
| 12 | Documents | `Example · Website refresh brief` | Origin Kept, Lifecycle Reviewed, Summary below; Accepted unticked, Accepted at empty, Refresh asked unticked, What to fix empty, Brain ID empty | Project → 5, Sources → 9 |
| 13 | Review | `Example · From Kickoff with Northwind: 1 decision, 1 question` | Kind Review Notes, State Pending, Your call empty, What to fix empty, Decided and Accept all unticked, Decided at empty, About, Now, Proposed and Why empty (decision 0088), Brain ID empty, so Status reads **Needs you · decide in the page**; the page below | Source Meeting → 6, Area → 2 |
| 14 | Goals | `Example · Launch three client websites this year` | Status Active, Why below | Area → 2, Projects → 5 |
| 15 | Key Results | `Example · Sites launched` | Kind Number, Start 0, Current 1, Target 3 | Goal → 14 |

Rows 1 to 7 are 0084's; rows 8 to 15 are 0087's. The Skills database (Brain Assistant's skills) has no Example row. Every Brain ID stays empty: no Example row is ever a brain note.

In a real space, a decision or a question gets its row only once its Review item is accepted. The examples show both at once, so each page has something in it: row 13 proposes rows 10 and 11.

## The Brain Data callout

The first block of Brain Data, above the databases, is a callout with Notion's default icon and exactly this text:

> These are examples. Every row titled "Example · " is a sample. When you say "set up my brain", it moves them all to Notion's trash after one yes. You can also delete them yourself.

## Page bodies

Only these rows have a body. Every other Example row's page is empty below its properties, or holds only its database template's parts.

### Row 6: the Meeting's minutes

Short lean minutes (decision 0079, [minutes-format.md](minutes-format.md)). There is no transcript: the quotes are invented, like the meeting. `▸` is a toggle, and the lines under it are its children.

```text
In one line: Kickoff for the Northwind website refresh: the blog stays as it is, and the launch date waits on the brand guidelines.

## Quick follow-ups
- [ ] Send Sam the link to today's notes [q1]

## Tasks for the brain
Send the project plan to Sam [s2.i4]
▸ Scope
    Done when: Sam has the plan with the milestones up to launch.
    Due:
    Project: Website refresh
    Notes:

## Scope of the refresh [s1]
The refresh covers the home, services and contact pages; the blog already works. [s1.i1]
Decided: keep the blog as it is. [s1.i2]

## Timeline [s2]
The launch date depends on when Northwind's brand guidelines arrive. [s2.i1]
Open: can the site go live by the end of March? [s2.i2]
Track: Waiting On — Waiting on Sam: send the brand guidelines. [s2.i3]

▸ For the brain
    Attendees: Sam Rivera (Northwind Studio, marketing lead)
    Projects: Website refresh
    All subjects included unless marked Meeting only. Mark Reviewed to confirm.
    [s1] Selection: Use in brain
    [s1.i1] "the blog is fine, the rest of the site is the problem"
    [s1.i2] "let's leave the blog exactly as it is"
    [s2] Selection: Use in brain
    [s2.i1] "nothing goes live before we have the brand guidelines"
    [s2.i2] "could we realistically launch by the end of March"
    [s2.i3] "I'll send you the brand guidelines next week"
    [s2.i4] "I'll put together the project plan and send it over"
```

### Row 9: the Inbox capture

**Summary** (property): `Sam's brief for the website refresh, kept as a document; the brand guidelines are still to come.`

Body:

```text
Call with Sam, quick notes.
- Sam sent the brief for the refresh. Keep it as a document.
- The brand guidelines are still to come.

Brief, as Sam sent it:
Refresh the home, services and contact pages. Keep the blog as it is.
Launch by the end of March if the brand guidelines arrive in time.
```

### Row 10: the Decision

**Summary** (property): `Northwind keeps its blog as it is; the refresh covers the other pages.`

Body:

```text
Decision: keep Northwind's blog as it is. The refresh covers the home, services and contact pages.
Context: at the kickoff, Sam said the blog works and the rest of the site is the problem.
Consequences: the blog's posts and addresses stay unchanged, and the new pages link to it.
Source: Example · Kickoff with Northwind.
```

### Row 11: the Question

**Summary** (property): `Can the new site go live by the end of March? It depends on the brand guidelines.`

Body:

```text
Sam asked whether the new site can go live by the end of March. It depends on when the brand guidelines arrive.
Raised in: Example · Kickoff with Northwind.
```

### Row 12: the Document

**Summary** (property): `What the Northwind website refresh covers, what it leaves out, and when it launches.`

Body:

```text
Website refresh brief

Goal: a clearer site that brings Northwind new clients.
In scope: the home, services and contact pages.
Out of scope: the blog, which stays as it is.
Launch: by the end of March, if the brand guidelines arrive in time.
```

### Row 13: the Review page

The page in the section format the brain writes (spec/capture-and-review.md §7.2 to §7.4, spec/cli.md §5.14.4): the first-use note as a quote, the heading `Review summary` with its summary, then one section per item. Each section has its heading, a link to the source, a toggle titled exactly `Proposed final wording` holding the proposed text, *Why it matters*, *What Accept does*, and the line `Decision: Pending`. The item ids are invented (`it-` and 8 characters of the id alphabet). A Creates item has no link to its target: a decision or question gets its row only once accepted. `[source]` links to row 6. `▸` is the toggle, and the lines under it are its children.

```text
> **How this page works.** Each change below is a section. Edit the text inside "Proposed final wording" if you want it different, then type your choice on the line `Decision:` (Accept, Reject, Defer or Request revision).
> Nothing is read until you click **Submit decisions** at the top of the row. **Submit and accept all** accepts every section still on Pending. You can decide some sections now and leave the rest.

## Review summary
**Review summary** (the brain keeps this up to date; do not edit): 0 of 2 decided: 0 applied, 0 closed, 2 waiting for you.

- a · Keep the blog as it is — Waiting for your decision.
- b · Can the site go live by the end of March? — Waiting for your decision.

## [a · it-4k7m2p9a] Creates: Keep the blog as it is
[source]
▸ Proposed final wording
    Keep Northwind's blog as it is. The refresh covers the home, services and contact pages.
**Why it matters:** It sets what the refresh leaves out.
**What Accept does:** Accept makes this draft Reviewed. Reject archives it.
Decision: Pending

## [b · it-8n3q6t1w] Creates: Can the site go live by the end of March?
[source]
▸ Proposed final wording
    Can the new site go live by the end of March? It depends on when Northwind's brand guidelines arrive.
**Why it matters:** The launch date waits on the answer.
**What Accept does:** Accept makes this draft Reviewed. Reject archives it.
Decision: Pending
```

### Row 14: the Goal

**Why** (property): `Each site launched is a reference for the next client.`

## The prompts

Run each prompt in Notion AI **on the copy's Brain Data page** (open Brain Data in the template copy, then ask Notion AI there), in this order. Each one starts by limiting itself to that page's databases, so a same-named database elsewhere in your workspace is never touched. Check the result after each prompt; run one again if something is missing: each prompt leaves alone what is already there.

Rows 1 to 7 may already exist from U-27; prompt 2 adds only the ones missing, and prompt 3 writes the minutes only when the Meeting lacks the lines rows 8 to 13 come from.

### Prompt 1: the callout

```text
Use only this page. At the very top of this page, above the databases, add one callout with Notion's default icon and exactly this text, nothing else:

These are examples. Every row titled "Example · " is a sample. When you say "set up my brain", it moves them all to Notion's trash after one yes. You can also delete them yourself.

If this callout is already there, change nothing.
```

### Prompt 2: 0084's seven rows (only the missing ones)

```text
Use only the databases on this page. Don't change any row that already exists, and don't create anything except the rows below. A row "exists" when its database has a row with exactly that title. Create each missing row with these properties, and leave every other property empty:

1. Domains: "Example · Work".
2. Areas: "Example · Clients". Domain: Example · Work.
3. Orgs: "Example · Northwind Studio". Relationship: Client.
4. People: "Example · Sam Rivera". Role: Marketing lead. Org: Example · Northwind Studio.
5. Projects: "Example · Website refresh". Area: Example · Clients.
6. Meetings: "Example · Kickoff with Northwind". Date: today. Brain Status: Not Reviewed. Project: Example · Website refresh. Area: Example · Clients. Attendees: Example · Sam Rivera.
7. Tasks: "Example · Send the project plan". Status: To Do. Project: Example · Website refresh. Meeting: Example · Kickoff with Northwind.

Then list each of the seven titles with "created" or "already there".
```

### Prompt 3: the Meeting's minutes (only when they lack the story)

Paste the minutes of "Row 6: the Meeting's minutes" above where the prompt says so.

```text
Use only the databases on this page. Open the Meetings row "Example · Kickoff with Northwind". If its page already has minutes with a line starting "Decided: keep the blog as it is", a line starting "Open: can the site go live by the end of March?" and a line containing "Waiting on Sam: send the brand guidelines", change nothing and say so.

Otherwise, replace the page's body with exactly the minutes below. Write "In one line:" as a paragraph, each "## " line as a heading 2, "- [ ]" lines as unticked to-do checkboxes, each "▸" line as a toggle (not a toggle heading) whose children are the indented lines under it, collapsed, and every other line as a plain paragraph. Copy every character as written, the tags in square brackets and the quotes included. Don't change any property.

<the minutes>
```

### Prompt 4: 0087's eight rows

```text
Use only the databases on this page. Don't change any row that already exists, and don't create anything except the rows below. A row "exists" when its database has a row with exactly that title. Relations point to the rows with exactly these titles, which are on this page. Create each missing row with these properties, and leave every other property empty and every checkbox unticked:

1. Tasks: "Example · Brand guidelines from Sam". Status: Waiting On. Project: Example · Website refresh. Meeting: Example · Kickoff with Northwind.
2. Inbox: "Example · Notes from a call with Sam". Kind: Capture. Brain Status: Done. Summary: "Sam's brief for the website refresh, kept as a document; the brand guidelines are still to come." Project: Example · Website refresh. People: Example · Sam Rivera.
3. Decisions: "Example · Keep the blog as it is". Lifecycle: Draft. Assessment: Accepted. Summary: "Northwind keeps its blog as it is; the refresh covers the other pages." Decided In: Example · Kickoff with Northwind. Project: Example · Website refresh.
4. Questions: "Example · Can the site go live by the end of March?". Status: Open. Lifecycle: Draft. Kind: Question. Summary: "Can the new site go live by the end of March? It depends on the brand guidelines." Raised In: Example · Kickoff with Northwind. Project: Example · Website refresh.
5. Documents: "Example · Website refresh brief". Origin: Kept. Lifecycle: Reviewed. Summary: "What the Northwind website refresh covers, what it leaves out, and when it launches." Project: Example · Website refresh. Sources: Example · Notes from a call with Sam.
6. Review: "Example · From Kickoff with Northwind: 1 decision, 1 question". Kind: Review Notes. State: Pending. Leave Your call, What to fix, About, Now, Proposed, Why and Decided at empty, and Decided and Accept all unticked. Source Meeting: Example · Kickoff with Northwind. Area: Example · Clients.
7. Goals: "Example · Launch three client websites this year". Status: Active. Why: "Each site launched is a reference for the next client." Area: Example · Clients. Projects: Example · Website refresh.
8. Key Results: "Example · Sites launched". Kind: Number. Start: 0. Current: 1. Target: 3. Goal: Example · Launch three client websites this year.

Then list each of the eight titles with "created" or "already there", and any property you could not set.
```

### Prompt 5: the bodies of the Inbox row, the Decision, the Question and the Document

Paste the four bodies of "Page bodies" above (rows 9 to 12) where the prompt says so.

```text
Use only the databases on this page. For each of these four rows, write the text below as its page body, only when the page has no text of its own yet (leave a page that already has text as it is). Write each line as a plain paragraph and each "- " line as a bulleted item, copying every character as written. Don't change any property.

Inbox "Example · Notes from a call with Sam":
<row 9's body>

Decisions "Example · Keep the blog as it is":
<row 10's body>

Questions "Example · Can the site go live by the end of March?":
<row 11's body>

Documents "Example · Website refresh brief":
<row 12's body>
```

### Prompt 6: the Review page

Paste the page of "Row 13: the Review page" above where the prompt says so.

```text
Use only the databases on this page. Open the Review row "Example · From Kickoff with Northwind: 1 decision, 1 question". If its page already has a heading "Review summary", change nothing and say so. Otherwise write the page below as its body, after any buttons the page already has:

- the two lines starting with ">" as one quote block, with the bold words bold;
- each line starting with "## " as a heading 2, written exactly, the square brackets and the "·" included;
- "**Review summary** …" as a paragraph, and the "- " lines as bulleted items;
- each "[source]" as the word "source", linked to the Meetings row "Example · Kickoff with Northwind";
- each "▸ Proposed final wording" as a toggle (not a toggle heading) titled exactly "Proposed final wording", collapsed, whose child is the indented line under it, as a paragraph;
- every other line as a plain paragraph, with the bold words bold, and "Decision: Pending" exactly as written.

Copy every character as written. Don't change any property, and don't tick Decided or Accept all.

<the Review page>
```

## Check by hand

- Brain Data starts with the callout, word for word.
- Each of the fifteen rows exists once, with its title exactly as in "The story" (the prefix `Example · ` with the middle dot), its state and its relations; every Brain ID is empty.
- The Meeting is **Not Reviewed**. The Review row is **Pending**, with Your call empty, Decided unticked and Status **Needs you · decide in the page**; its page opens with the note, then "Review summary", then two sections, each with a collapsed **Proposed final wording** toggle and `Decision: Pending`. The Inbox row is **Done**. Nothing on the Document is ticked.
- The pages link to each other: the Project page lists the Meeting, both Tasks, the Inbox row, the Decision, the Question and the Document; the Area page shows the Review row waiting; Plan shows the Goal at 33%.
- The coordinator's read-only scan (TEMPLATE.md, step 10) lists these fifteen rows as Example rows, and nothing else.
