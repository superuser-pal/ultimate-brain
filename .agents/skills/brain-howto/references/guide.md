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
| **Home** | Start your day | Buttons (Quick capture, New meeting, New project) · "What's on today?" (Tasks, Meetings, Projects) · "Needs you": decisions waiting and minutes to review |
| **Tasks** | Do the work | Today · Upcoming · No date · Waiting On · Someday · Done |
| **Meetings** | Prepare meetings and get minutes into the brain | Upcoming · To review · Ready for the brain · Ingested this week · Calendar |
| **Projects** | Keep projects moving | Active · By area · Deadlines · Gone quiet |
| **Plan** | Check that your work serves your goals | Goals · Key results · Areas · Projects by goal |
| **Review** | Decide on the changes the brain proposes | Needs my decision · Sources disagree · Approved recently · Rejected |
| **Knowledge** | Find what the brain knows, and everything that came in | Decisions · Questions · Concepts · People · Orgs · Inbox (What's in my inbox?: new captures · What came in?: everything ingested, with what it produced) |
| **Archive** (under System) | Find finished and archived records | One tab per database |

**Area pages** collect everything for one area: its goals, projects, tasks, meetings, decisions and open questions in views, and its people and clients as lists at the top. Open one from Plan → Areas.

**Project pages** show the Brief and Decision log (written by the brain), then the project's tasks, meetings, open questions and people, then your own "My notes".

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
   - new notes (decisions, questions, people) arrive as **Draft**;
   - changes to things the brain already knew go to **Review**;
   - action items become **Tasks** (status To Do).
5. Set **Skipped** for a meeting the brain should never read.

The brain only ingests meetings you marked **Reviewed**, and only when you ask: nothing runs on its own. It never edits the meeting page itself.

**Why isn't my meeting in "To review"?** Meetings dated in the future stay in Upcoming until their date has passed.

---

## Deciding in Review

The brain never changes what it already knows without your yes. Each proposed change is a row in **Review → Needs my decision**, showing what it was (**Before**) and what it would become (**After**).

1. Set **Decision**:
   - **Approve** applies the change;
   - **Reject** drops it;
   - **Edit** applies your own value: type it in **Note**.
2. **Note** is also for anything else you want the brain to know about that row: "all except Tomás" on a row that adds several people, or "she's the product lead, not marketing". The agent reads it, and when it describes a different change, proposes that change as a new row or asks you. It never applies something your Note didn't clearly say.
3. Tell your agent "apply my reviews" (or "catch up"). The change is made, and the row moves to Approved or Rejected.

Routine links from one input arrive as **one** row: "Acme website: add 3 people (Ana, Ben, Carla)". Approve them all, or approve with a Note saying which to leave out.

| Kind | Approve means | Can you Edit? |
|---|---|---|
| Update Fact | The new value replaces the old one; the old one stays in the history | Yes |
| Add To Note | The text is added to the note | Yes |
| Add Link | The links listed in After are added (people to a project, an alias to a person) | No: approve with a Note to leave some out |
| Contradiction | Two sources disagree; both claims are kept as contested | Yes: your value becomes the truth |
| Supersede | A newer note replaces an older one, which is archived | No |
| Merge | A duplicate is folded into the record it duplicates | No |
| New Item | A new note is created as Draft | No |

To see why a change was proposed, open the row: **Why** quotes the sentence from the source, and **Source Meeting** links to the meeting when there is one.

A rejected change can come back if a later meeting says the same thing again.

---

## What you can edit, and what the brain owns

Hover over a property name to see its owner. Each description starts with "Owner: you", "Owner: brain" or "Owner: system".

| Owner | Examples | What happens when you edit it |
|---|---|---|
| **You** | Status, Priority, Dates, Lifecycle, Archived, Decision, Note, Brain Status on meetings and captures, Project and Area on a capture | Your value stands. The brain reads it but never overwrites it |
| **Brain** | Summary, Role, Client, Key Facts, Why, Assessment | The next sync reads your edit as a **correction**. Names, summaries and relations change in place; a key fact gets a dated history entry; judgments such as Assessment become a Review proposal |
| **System** | Brain ID, Last Synced, Ingested At | Don't edit. The brain uses them to match records |

**Page text:**
- **Brief and Decision log** on project pages are rewritten by the brain on every sync. Anything you type inside them is lost.
- **My notes**, and everything else on a page, is yours.
- Decision, Question and Concept pages are written entirely by the brain.
- A capture's text is yours; the brain only adds its Kind, Summary and what it produced.

**Lifecycle** tells you how far to trust a record:
- **Draft:** new, not reviewed by you yet;
- **Reviewed:** you checked it;
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
| An email, chat thread or note | Paste it into a **Quick capture** (keep the From, Date and Subject lines), then "catch up". Or paste it straight to your agent: "ingest this email" |
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
| You want to see what the brain made from a document | Every input has a row in Knowledge → Inbox → What came in? | Open the row: Decisions, Questions, Concepts and People list what it produced |
