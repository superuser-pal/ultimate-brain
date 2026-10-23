# How your brain works

Your second brain has three parts:
- **The brain itself:** Markdown notes in a private Git repo. It's the source of truth: every fact traces back to a meeting or document, and history is kept.
- **Notion:** where you look at the brain, review what came in, and decide on changes.
- **Your agent** (Claude Code or Codex): does the work. It reads your meetings and documents, writes notes, publishes them to Notion, and applies your decisions.

You never edit the Markdown by hand. You work in Notion and talk to your agent.

---

## The Spaces

The navigation on the left of every page lists the Spaces. Each one has tabs that run from *now*, to *later*, to *done*.

| Space | Use it to | Tabs |
|---|---|---|
| **Home** | Start your day | Buttons (Quick capture, Ask the brain, New meeting, New project) · "What's on today?" (Tasks, Meetings, Projects) · "Needs you": decisions waiting and minutes to review · "What did the brain take in?" (Came in, Meetings) |
| **Tasks** | Do the work | Today · Upcoming · No date · Waiting On · Someday · Done |
| **Meetings** | Prepare meetings and get minutes into the brain | Upcoming · To review · Ready for the brain · Ingested this week · Calendar |
| **Projects** | Keep projects moving | Active · By area · Deadlines · Gone quiet |
| **Plan** | Check that your work serves your goals | Goals · Key results · Areas · Projects by goal |
| **Review** | Decide on the changes the brain proposes | Needs my decision · Sources disagree · Approved recently · Rejected |
| **Knowledge** | Find what the brain knows, and everything that came in | Decisions · Questions · Concepts · People · Orgs · Inbox (What's in my inbox?: new captures · What came in?: everything ingested, with what it produced) |
| **Archive** (under System) | Find finished and archived records | One tab per database |

**Area pages** collect everything for one area: its goals, projects, tasks, meetings, decisions and open questions in views, and its people and clients as lists at the top. The brain adds a **Brief** toggle at the end: the area's projects with their status, and its recent decisions and open questions. Open one from Plan → Areas.

**Project pages** show the Brief and Decision log (written by the brain), then the project's tasks, meetings, open questions and people, "What came in?" (every input filed under the project) and "What do we know?" (its decisions and concepts), then your own "My notes".

**A Brief shows only what you reviewed.** Decisions and questions still in Draft stay out of it until you accept them in Review. When a section has nothing reviewed yet, it says how many notes are waiting: "Nothing reviewed yet: 4 notes waiting in Review".

---

## The meeting flow

Every meeting moves through **Brain Status**:

1. **Before the meeting (optional):** create it with **New meeting** on Home. It appears in Meetings → Upcoming. Ask Notion AI to prepare you for it.
2. **During the meeting:** Notion AI takes the notes on the meeting page.
3. **After the meeting:** the meeting appears in Meetings → To review (status **Not Reviewed**). Work through the "Before marking Reviewed" checklist on the page:
   - attendees linked;
   - project linked;
   - minutes follow the format;
   - minutes checked and corrected.

   Then set Brain Status to **Reviewed**.
4. **Ingest:** tell your agent "ingest my reviewed meetings". The brain reads the minutes and sets the meeting to **Ingested**. Then:
   - new notes (decisions, questions, people) arrive as **Draft**, with one **Review notes** row in Review to accept them all;
   - changes to things the brain already knew go to **Review**, and so does an answer it found to one of your open questions;
   - action items become **Tasks** (status To Do).
5. Set **Skipped** for a meeting the brain should never read.

The brain only ingests meetings you marked **Reviewed**, and only when you ask: nothing runs on its own. It never edits the meeting page itself.

**Why isn't my meeting in "To review"?** Meetings dated in the future stay in Upcoming until their date has passed.

---

## Deciding in Review

**What approving does:** it makes the brain's notes **trusted**. Approved notes appear in your Briefs and in the brain's answers; until then, the brain treats them as unconfirmed. Start from Home → **Needs you → What's waiting for you?**: it counts what waits, by Kind, and each row's **Target Page** opens the meeting or Inbox row it came from.

The brain never changes what it already knows without your yes. Each proposed change is a row in **Review → Needs my decision**, showing what it was (**Before**) and what it would become (**After**).

1. Set **Decision**:
   - **Approve** applies the change;
   - **Reject** drops it;
   - **Edit** applies your own value: type it in **Note**.
2. **Note** is also for anything else you want the brain to know about that row: "all except Tomás" on a row that adds several people, or "she's the product lead, not marketing". The agent reads it, and when it describes a different change, proposes that change as a new row or asks you. It never applies something your Note didn't clearly say.
3. Tell your agent "apply my reviews" (or "catch up"). The change is made, and the row moves to Approved or Rejected.
4. **30 days after you decide,** the next catch-up moves the row to Notion's trash, so Review holds only what's recent. The brain keeps every decision, and Notion keeps the trash for 30 more days.

**One Review notes row per input.** Every meeting or document the brain reads brings one row: "Accept 6 new notes from Acme launch review, and 2 links". Its After lists every new note and routine link, lettered:

```
a) Decision: Use Contentful as the blog CMS
b) Question: Who signs off the launch post?
…
g) People on Acme website: Lucía Fernández
```

- **Approve** accepts them all: the notes become **Reviewed** and appear in the Briefs, and the links are added.
- **Approve** with a Note "all except b, g" accepts the rest; b stays Draft and g isn't added.
- **Reject** archives the notes that are still Draft and drops the links. Nothing is deleted.

Changes to what a note says (a new fact, added text, two sources disagreeing) and answers get their own rows.

**Answer rows.** When new material answers one of your open questions, an Answer row says so: "Who owns the mobile app? → Carlos Ruiz owns it". Approve it and the question shows as **Answered** in Notion; Edit it to write the answer yourself; Reject it and the question stays open.

**Your corrections go in Note.** Target says what changes; typing there does nothing.

| Kind | Approve means | Can you Edit? |
|---|---|---|
| Update Fact | The new value replaces the old one; the old one stays in the history | Yes |
| Add To Note | The text is added to the note | Yes |
| Add Link | The links listed in After are added (people to a project, an alias to a person) | No: approve with a Note to leave some out |
| Contradiction | Two sources disagree; both claims are kept as contested | Yes: your value becomes the truth |
| Supersede | A newer note replaces an older one, which is archived | No |
| Merge | A duplicate is folded into the record it duplicates | No |
| New Item | A new note is created as Draft | No |
| Review Notes | The notes listed become Reviewed and the links are added; Reject archives the Draft ones | No: approve with a Note ("all except b, d") |
| Answer | The question gets this answer and shows as Answered | Yes: your text becomes the answer |

To see why a change was proposed, open the row: **Why** quotes the sentence from the source, and **Source Meeting** links to the meeting when there is one.

A rejected change can come back if a later meeting says the same thing again.

---

## What you can edit, and what the brain owns

Hover over a property name to see its owner. Each description starts with "Owner: you", "Owner: brain" or "Owner: system".

| Owner | Examples | What happens when you edit it |
|---|---|---|
| **You** | Status, Priority, Dates, Lifecycle, Archived, Decision, Note, Brain Status on meetings and captures, Project and Area on a capture, Full text on an Inbox row | Your value stands. The brain reads it but never overwrites it |
| **Brain** | Summary, Role, Client, Key Facts, Why, Assessment | The next sync reads your edit as a **correction**. Names, summaries and relations change in place; a key fact gets a dated history entry; judgments such as Assessment become a Review proposal |
| **System** | Brain ID, Last Synced, Ingested At | Don't edit. The brain uses them to match records |

**Page text:**
- **Brief and Decision log** on project pages, and the **Brief** on area pages, are rewritten by the brain on every sync. Anything you type inside them is lost.
- **My notes**, and everything else on a page, is yours.
- Decision, Question and Concept pages are written entirely by the brain.
- A capture's text is yours; the brain only adds its Kind, Summary and what it produced. An Ask row's text is yours too.
- **Inbox rows the brain creates** (a document, email, web page, a repo file) get a **digest** in their body: what the input is, a summary and the key points, with figures and dates as stated. Emails and chats also get their whole text in a **Full text** toggle. For a document, tick **Full text** on its row (or say "full text for …") and the next catch-up adds it. Both are written once and never read back, so an edit you make there stays in Notion. The original file is the real copy.
- A question's **Status** is yours. The brain sets it twice at most: **Open** when it creates the question, and **Answered** once, when you approve an Answer row.

**Lifecycle** tells you how far to trust a record:
- **Draft:** new, not reviewed by you yet;
- **Reviewed:** you checked it, usually by approving its Review notes row;
- **Disputed:** you think it's wrong;
- **Archived:** no longer current.

Set **Disputed** on anything wrong. The brain stops relying on it, and you can ask your agent to fix it.

---

## Adding things

| You want to add | Do this |
|---|---|
| A quick thought, link or idea | **Quick capture** on Home. It lands in Knowledge → Inbox. Set its **Project** if you know it, so the agent doesn't ask. Then "catch up" (or "process my inbox") |
| A meeting | **New meeting** on Home, or let Notion AI create it when it starts taking notes |
| A project, area, goal, person or org | Create the row in Notion (**New project** on Home for projects). The next sync imports it into the brain |
| A document (PDF, Word, PowerPoint, Excel, saved HTML page, image) | Put it in your drop folder and tell your agent "process my drop folder". It lists the files and asks once which to take; each ingested file moves to `processed/` inside the folder, so what's left at the top is what the brain hasn't read yet. Or name one file: "ingest this PDF: ~/Documents/brain-dropbox/proposal.pdf". Word, PowerPoint, Excel and HTML files need MarkItDown installed once: `pipx install 'markitdown[all]'` |
| A web page | Give your agent the link: "ingest this page: https://…". For a page behind a login, save it as a PDF in your drop folder instead |
| A file from your phone | Attach it to a **Quick capture** (or to the meeting page), with Project set if you know it. The next catch-up reads it with the row. Files on project and area pages are not read |
| A repo's knowledge (decisions, docs, changelog) | "link the repo at ~/code/acme-api to the area Clients, files decisions/** and docs/*.md". Each catch-up then reads the files changed since the last one; the first time, it asks which to take. The brain never writes to the repo |
| A question for a full report | **Ask the brain** on Home: type the question as the Name ("Where do we stand with the Acme launch?"). The next catch-up answers with a **Report** row in the Inbox, linked from yours |
| An email, chat thread or note | Paste it into a **Quick capture** (keep who sent it and when). For a thread, run **`/Clean email`** on the page: Brain Assistant gives each message a heading with names and date ("Tomás Vidal → Lucía Fernández · 3 Dec 2026"), its own text word for word below it, and a divider before the next, oldest first. It drops addresses, signatures, disclaimers, quoted copies and Teams, Zoom or Meet blocks, and rewrites the page right away (the page history keeps the original), asking first only when something is truly unclear. Then "catch up". Or paste it straight to your agent: "ingest this email" |
| A task | Add it in Tasks. Action items from meetings, and your own from documents, emails and captures, are created for you |

**Tasks:**
- New tasks from the brain start as **To Do**.
- **Doing**, **Waiting On**, **Someday** and **Done** are for you; the brain never reads them.
- A task without a due date shows in Tasks → No date.

---

## Ask Brain Assistant in Notion

**Brain Assistant** is a Notion AI agent that reads Ultimate Brain and answers. It never changes your knowledge. Open its chat (Agents → Brain Assistant, or @mention it on a page) and type a skill or a question:

| Type | You get |
|---|---|
| `/Today` | What's due today, today's meetings, and what needs your decision |
| `/Review queue` | Each pending change explained, without deciding for you |
| `/Check minutes` (on a meeting page) | Missing sections and names and numbers to confirm; fixes the text after you say yes |
| `/Prep` (on a meeting page) | Past meetings, open questions, tasks and recent decisions for that meeting |
| `/Weekly review` | What got done and decided, goal and project health, next week |
| `/Plan check` | Projects without goals, goals without projects, overdue items |
| `/Tidy capture` (on a new capture in the Inbox) | A cleaner version of the capture; replaces the text after you say yes |
| `/Clean email` (on a new capture holding a pasted email thread) | Each message under a heading of names and date, its own text word for word, a divider between messages, oldest first; no addresses, signatures, disclaimers, quoted copies or meeting blocks; rewrites the page directly and asks only on a serious doubt |
| "how do I …?" | An answer from this guide |

Brain Assistant reads; your agent in Claude Code or Codex writes. To get something *into* the brain, use the phrases below.

---

## What to say to your agent

Run these in Claude Code or Codex, from your brain's folder.

| You want to | Say |
|---|---|
| Do everything that's waiting: decided reviews, reviewed meetings, new captures, the drop folder | "catch up". It asks all its questions once at the start, then finishes |
| Get reviewed meetings into the brain | "ingest my reviewed meetings" |
| Ingest a file, web page, email or chat | "ingest this PDF: <path>", "ingest this page: <url>", "ingest this email" (then paste it) |
| Process quick captures | "process my inbox" |
| Process the files in your drop folder | "process my drop folder" |
| Apply your Review decisions | "apply my reviews" |
| Bring Notion edits and new rows into the brain, and publish its changes | "sync with Notion" |
| Ask what the brain knows | "what did we decide about …?", "who is …?", "when is the … launch?" |
| Get a report on a subject: where it stands, a timeline, decisions, open questions, people and gaps | "report on the Acme launch". It includes notes you haven't reviewed, marked *(not reviewed)*, and is published as a Report row. A report is a snapshot: ask again for a fresh one |
| Have a document's whole text in Notion | "full text for the Acme brief", or "slides 3–9 of the launch deck" (or tick Full text on its Inbox row) |
| Read a repo into the brain | "link the repo at <path> to the area <name>, files <patterns>" |
| Ask how the system works | "how do I …?", "why didn't … ?" (or ask Brain Assistant in Notion) |
| Change the Notion structure (a property, an option, a view) | "add a property to Projects …". Structure is changed in the product first, then in Notion |
| Check your Notion space | "check my Notion space" |
| Update the brain software | `npm install -g ultimate-brain@latest`, then "run brain upgrade" |

---

## When something looks wrong

| What you see | Why | What to do |
|---|---|---|
| A meeting wasn't ingested | It is still Not Reviewed or Skipped, or no ingest has run since you marked it | Set it to **Reviewed**, then "ingest my reviewed meetings" |
| A meeting you created for next week sits in Upcoming | Future meetings stay out of the review queue | Nothing; it moves to To review after its date |
| Text you typed in a project's Brief disappeared | The brain rewrites Brief and Decision log on every sync | Put your notes in **My notes** |
| Your edit to a Summary or Role changed back | Brain-owned fields are read as corrections only on the next sync | "sync with Notion" before the next ingest |
| A new project or person isn't in the brain | It is imported on the next sync | "sync with Notion" |
| A rejected change came back | A later source said it again | Reject it again, or Edit it to the true value |
| A record shows Draft | You haven't reviewed it yet | Read it; set **Reviewed**, or **Disputed** if it's wrong |
| An Area page doesn't list a decision | A decision's Area comes from its project | Link the decision's project to the area, then "sync with Notion" |
| A Review row with a Note is still pending | The agent couldn't tell what the Note meant, or it described a different change | Answer the agent's question, or look for the new row it proposed |
| You want to see what the brain made from a document | Every input has a row in Knowledge → Inbox → What came in?, and on its project's page | Open the row: the body has the digest, and Decisions, Questions, Concepts and People list what it produced |
| A Brief says "Nothing reviewed yet" | Its notes are still Draft | Approve their Review notes rows, then "catch up" |
| A document's row shows only the digest | Documents and decks get a digest by default | Tick **Full text** on the row, then "catch up" |
| A capture was skipped | It repeats a source the brain already has; the report names that source | Nothing, or say "ingest it anyway" if it adds something |
| A file attached to a capture wasn't read | Its format can't be read, or the file is broken | The catch-up's Check line names the file and the fix |
