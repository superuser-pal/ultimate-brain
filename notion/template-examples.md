# The template's Example rows

The exact content of every `Example · ` row in the published Notion template, the Notion AI prompts that create them and the step that relates them, so a maintainer can rebuild them (decisions 0084 §3, 0087). [TEMPLATE.md](TEMPLATE.md) lists the rows; "Building and updating the template", step 7, uses this file.

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
| 7 | Tasks | `Example · Send the project plan` | Status To Do; Document asked unticked | Project → 5, Meeting → 6 |
| 8 | Tasks | `Example · Brand guidelines from Sam` | Status Waiting On; Document asked unticked | Project → 5, Meeting → 6 |
| 9 | Inbox | `Example · Notes from a call with Sam` | Kind Capture, Brain Status Done, Summary below; Document asked unticked, Only keep empty, Changed from and What changed empty, Brain ID empty | Project → 5, People → 4 |
| 10 | Tasks | `Example · Can the site go live by the end of March?` | Status Waiting On, Kind Question; Document asked unticked, Brain ID empty | Project → 5, Meeting → 6 |
| 11 | Documents | `Example · Website refresh brief` | Origin Kept, Lifecycle Reviewed, Summary below; Accepted unticked, Accepted at empty, Refresh asked unticked, What to fix empty, Task empty, Brain ID empty | Project → 5, Area → 2, Sources → 9 |
| 12 | Goals | `Example · Launch three client websites this year` | Status Active, Why below | Area → 2, Projects → 5 |
| 13 | Key Results | `Example · Sites launched` | Kind Number, Start 0, Current 1, Target 3 | Goal → 12 |

Rows 1 to 7 are 0084's; rows 8, 9 and 11 to 13 are 0087's; row 10 is the kickoff's open question tracked as a task (decision 0099 §3 to §5, since 0.16.0). The Skills database (Brain Assistant's skills) has no Example row. Every Brain ID stays empty: no Example row is ever a brain note.

There are no Decisions or Questions rows: those databases were retired in 0.16.0 (decision 0099), and the kickoff's decision and question live in the brain, shown in the project's Brief and Decision log. Row 10 is what the minutes' `Track: Waiting On —` on the question's line makes once the meeting is ingested (spec/capture-and-review.md §6.4); the examples show it at once, so the Tasks page's Questions tab has something in it.

## The Brain Data callout

The first block of Brain Data, above the databases, is a callout with Notion's default icon and exactly this text:

> These are examples. Every row titled "Example · " is a sample. When you say "set up my brain", it moves them all to Notion's trash after one yes. You can also delete them yourself.

## Page bodies

Only these rows have a body. Every other Example row's page is empty below its properties, or holds only its database template's parts.

### Row 6: the Meeting's minutes

Short lean minutes (decision 0079, [minutes-format.md](minutes-format.md)). They go below the blocks the Meetings template puts on the page (the "Before marking Reviewed" callout, the gray notice, the Meeting notes block and the toggles), which all stay. There is no transcript: the quotes are invented, like the meeting. `▸` is a toggle, and the lines under it are its children.

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
Track: Waiting On — Waiting on Sam: can the site go live by the end of March? [s2.i2]
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

### Row 11: the Document

**Summary** (property): `What the Northwind website refresh covers, what it leaves out, and when it launches.`

Body:

```text
Website refresh brief

Goal: a clearer site that brings Northwind new clients.
In scope: the home, services and contact pages.
Out of scope: the blog, which stays as it is.
Launch: by the end of March, if the brand guidelines arrive in time.
```

### Row 12: the Goal

**Why** (property): `Each site launched is a reference for the next client.`

## The prompts

Run each prompt in Notion AI **on the copy's Brain Data page** (open Brain Data in the template copy, then ask Notion AI there), in this order, then step 7, which sets the relations. Each prompt starts by limiting itself to that page's databases, so a same-named database elsewhere in your workspace is never touched. Check the result after each prompt; run one again if something is missing: each prompt leaves alone what is already there.

Rows 1 to 7 may already exist from U-27; prompt 2 adds only the ones missing, and prompt 3 writes the minutes only when the Meeting lacks the lines rows 8 to 11 come from.

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
Use only the databases on this page. Open the Meetings row "Example · Kickoff with Northwind". If its page already has minutes with a line starting "Decided: keep the blog as it is", a line containing "Waiting on Sam: can the site go live by the end of March?" and a line containing "Waiting on Sam: send the brand guidelines", change nothing and say so.

Otherwise, add the minutes below at the end of the page, below every block the page already has. Keep every existing block exactly as it is, where it is: the "Before marking Reviewed" callout, the gray notice, the Meeting notes block and the toggles. Don't delete, move, replace or edit any of them, and don't write inside them. Write "In one line:" as a paragraph, each "## " line as a heading 2, "- [ ]" lines as unticked to-do checkboxes, each "▸" line as a toggle (not a toggle heading) whose children are the indented lines under it, collapsed, and every other line as a plain paragraph. Copy every character as written, the tags in square brackets and the quotes included. Don't change any property.

<the minutes>
```

### Prompt 4: the other six rows

This prompt sets no relation: Notion AI created these rows but left every relation empty. Step 7 sets them.

```text
Use only the databases on this page. Don't change any row that already exists, and don't create anything except the rows below. A row "exists" when its database has a row with exactly that title. Create each missing row with these properties, and leave every other property empty, every relation empty and every checkbox unticked:

1. Tasks: "Example · Brand guidelines from Sam". Status: Waiting On.
2. Tasks: "Example · Can the site go live by the end of March?". Status: Waiting On. Kind: Question.
3. Inbox: "Example · Notes from a call with Sam". Kind: Capture. Brain Status: Done. Summary: "Sam's brief for the website refresh, kept as a document; the brand guidelines are still to come."
4. Documents: "Example · Website refresh brief". Origin: Kept. Lifecycle: Reviewed. Summary: "What the Northwind website refresh covers, what it leaves out, and when it launches."
5. Goals: "Example · Launch three client websites this year". Status: Active. Why: "Each site launched is a reference for the next client."
6. Key Results: "Example · Sites launched". Kind: Number. Start: 0. Current: 1. Target: 3.

Then list each of the six titles with "created" or "already there", and any property you could not set.
```

### Prompt 5: the bodies of the Inbox row and the Document

Paste the two bodies of "Page bodies" above (rows 9 and 11) where the prompt says so.

```text
Use only the databases on this page. For each of these two rows, write the text below as its page body, only when the page has no text of its own yet (leave a page that already has text as it is). Write each line as a plain paragraph and each "- " line as a bulleted item, copying every character as written. Don't change any property.

Inbox "Example · Notes from a call with Sam":
<row 9's body>

Documents "Example · Website refresh brief":
<row 11's body>
```

There is no prompt 6 since 0.16.0: it wrote the Review row's page, which went with the Review database.

### Step 7: the relations, and the properties Notion AI missed (agent, through the API, with your yes; or by hand)

Notion AI creates the rows but doesn't reliably set relations, so this step sets them outside Notion AI. **The agent** (the `brain-notion-change` skill, on the copy, after your yes) finds each row on the copy's Brain Data by its exact title, sets what's missing below, and reads every row back: the API can answer 200 and still ignore a write. **By hand:** open each row and pick the related rows in the property. Only fill what is empty: a value already there stays.

The relations of prompt 4's rows. Each relation points to the row with exactly that title:

| Row | Relation | Points to |
|---|---|---|
| Tasks `Example · Brand guidelines from Sam` | Project | `Example · Website refresh` |
| | Meeting | `Example · Kickoff with Northwind` |
| Inbox `Example · Notes from a call with Sam` | Project | `Example · Website refresh` |
| | People | `Example · Sam Rivera` |
| Tasks `Example · Can the site go live by the end of March?` | Project | `Example · Website refresh` |
| | Meeting | `Example · Kickoff with Northwind` |
| Documents `Example · Website refresh brief` | Project | `Example · Website refresh` |
| | Area | `Example · Clients` |
| | Sources | `Example · Notes from a call with Sam` |
| Goals `Example · Launch three client websites this year` | Area | `Example · Clients` |
| | Projects | `Example · Website refresh` |
| Key Results `Example · Sites launched` | Goal | `Example · Launch three client websites this year` |

What prompt 2 can miss, set the same way:

| Row | Property | Value |
|---|---|---|
| People `Example · Sam Rivera` | Role | `Marketing lead` |
| Orgs `Example · Northwind Studio` | Relationship | Client |
| Meetings `Example · Kickoff with Northwind` | Date | the day you build it |
| | Area | `Example · Clients` (a relation) |

Then check prompt 2's other relations against "The story" (Domain on the Area, Org on Sam, Area on the Project, Project and Attendees on the Meeting, Project and Meeting on `Example · Send the project plan`) and set any that are empty.

## Check by hand

- Brain Data starts with the callout, word for word.
- Each of the thirteen rows exists once, with its title exactly as in "The story" (the prefix `Example · ` with the middle dot), its state and every relation of step 7 and "The story"; every Brain ID is empty. Sam's Role is Marketing lead, Northwind's Relationship is Client, and the Meeting has its Date and Area, and the Document its Area.
- The Meeting is **Not Reviewed**, and its page still has the template's blocks (the "Before marking Reviewed" callout, the notice, the Meeting notes block and the toggles), with the minutes below them. The question's Task is **Waiting On** with Kind **Question**. The Inbox row is **Done**, and its Changed from and What changed are empty. Nothing on the Document is ticked, and its Task is empty. No task's Document asked is ticked: a ticked one would be kept as a Document by the next catch-up.
- The pages link to each other: the Project page lists the Meeting, the three Tasks, the Inbox row and the Document; the Project, the Meeting and the Document each show Domain `Example · Work`, and the `Example · Work` page lists all three in its views (decision 0105); the Tasks page lists the question's Task under Questions; Plan shows the Goal at 33%.
- The coordinator's read-only scan (TEMPLATE.md, step 10) lists these thirteen rows as Example rows, and nothing else.

## Updating a copy to 0.16.0

A template copy built before 0.16.0 has the fifteen rows of 0.15.x. After migration 0027 has archived Review, Decisions and Questions (with their three Example rows inside), on the copy's Brain Data:
1. **The Meeting's minutes:** on `Example · Kickoff with Northwind`, change the line `Open: can the site go live by the end of March? [s2.i2]` to `Track: Waiting On — Waiting on Sam: can the site go live by the end of March? [s2.i2]`, by hand. Nothing else on the page changes.
2. **Row 10:** run prompt 4 (it creates only the missing rows), then set row 10's relations as step 7 says.
3. **Check by hand** as below: thirteen rows on Brain Data. If you clicked Keep as document on an Example task to check migration 0027's button (C4), untick its Document asked.

## Updating a copy to 0.16.1

After migration 0028 has added the Domain rollups and the Domains page template's views (part "Domains", D1 to D4):
1. **Row 11:** set the Document's Area to `Example · Clients` if it is empty (migration 0028, D5; step 7 above).
2. **Row 1:** `Example · Work` keeps its page. If it was made before the template's views, apply the Domains template to it, or add the three views by hand ([views-guide.md](views-guide.md) §9a).
3. **Check by hand** as above: `Example · Work`'s page lists the Project, the Meeting and the Document, and shows no Type.
