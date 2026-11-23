# 0113 — Factories and Domain homes in 0.18.0; the fourteen features move to 0.19.0 and Español to 0.20.0

**Status:** Accepted
**Date:** 2026-11-23
**Release:** 0.18.0 (§A, §B); 0.19.0 (the fourteen features of 0112, §C); 0.20.0 (Español, §C)
**Amends:** [0112](0112-0-18-0-fourteen-features-and-espanol-in-0-19-0.md) (its fourteen features and their opening checks ship in 0.19.0 with their rules unchanged, and §F's Español in 0.20.0); [0106](0106-beta-on-0-16-x-patches-0-17-0-and-0-18-0-before-1-0-and-the-launch-bar.md) §5 and its release order (Español ships in 0.20.0; 1.0.0 is cut after it); [0061](0061-roadmap-and-launch-boundary.md) (release order: an explicit roadmap change after the cutoff); [0066](0066-linked-repos-and-the-link-kit.md) (a linked repo is shown as a Factory row, its placement may name several Projects, and the Factory's overview replaces the `Repo tasks · <name>` toggle); [0059](0059-shared-skills-and-connected-workflows.md) (a Factory is a third destination of a connected workflow, a task you wrote for a Factory is taken without a question, and the Factory's overview replaces the counts-only summary there); [0105](0105-domains-on-projects-meetings-and-documents-and-domains-without-type.md) (Tasks get the Domain rollup too, a task's Area follows its Project, and a Domain page lists more); [0050](0050-area-homes.md) (Home's opening lines: one card per Domain when Domains are on)
**Keeps:** Markdown and Git canonical, Notion as the human interface, no unrestricted two-way sync; [0003](0003-proposal-review-flow.md) as amended; [0014](0014-product-repo-vs-brain-repo.md); [0015](0015-notion-access-via-mcp.md) (the brain's program never reads Notion); [0022](0022-architecture-changes-repo-first.md); [0042](0042-repos-and-notion-attachments-as-sources.md) and 0066's hub (one brain, the only store and the only writer to Notion; the brain writes one file in a linked repo, its kit); 0059's rules that nothing connects by itself and that your status in Notion wins; [0048](0048-modules-and-simpler-rows.md) (modules decide what a space shows); [0055](0055-domains-capture-and-review.md) (Domain follows the Area); [0104](0104-product-design-principles.md); 0106 §6 to §8 (the release-candidate bar and the soft launch); every rule of 0112 §1 to §15

## Context

The author works in several repositories beside the brain, each with its own agent sessions. Linked repos (0066) and connected workflows (0059) exist, and the author has not turned a connected workflow on. On 2026-11-23 the author described two problems from daily use:

- **No view of the work in the repositories.** Nothing in Notion lists the linked repos. A repo that keeps its own tasks shows a counts toggle on a Project or Area page, and the author has lost sight of what each repo's plan is, what is in progress and what is done. The author also wants the agents in those repos to read what the author wants next and agree in the session how to do it.
- **Navigation by Domain.** With two Domains, the author filters each view by Domain or Area, and Tasks have no Domain. The author proposed a home layer above the Spaces, one page per Domain.

Read against the contracts on that day:

- 0059's reconcile treats a task the workflow did not create as `UNKNOWN_TASK` and asks about it. The author wants the reverse: the task the author writes is the instruction.
- 0059 allows one workflow per Project or Area. The author's repos serve several projects, and one project is served by several repos.
- 0059's summary on the destination's page holds counts. It does not say what the plan contains.
- 0105 gave Projects, Meetings and Documents a Domain rollup and gave each Domain page their lists. 0050 made each Area page that area's home. So a Domain page is most of the way to a home, and no layer is missing.

The author asked for a challenge of both ideas. The scope review of 2026-11-23, in rounds, settled the design below. Asked for the order of everything open, the author chose to build these two first.

## Decision

Rules that hold for both parts:
- **The same outcome on macOS and Windows** (0104 §7); any difference is named in the contract with how it is closed.
- **Both agents:** each part works in Claude Code and in Codex. A difference between the agents is named.
- **The brain's program reads no Notion** (0015): what it knows about Notion comes from the agent's live read or the last snapshot.
- **Texts are written in English**; 0.20.0 translates them (§C).
- Where a rule says **default**, the contract may choose otherwise only with the author's answer, recorded in the task.

### A. Factories

#### 1. The Factories database

- Notion gets one new database, **Factories**. A Factory is a working folder where agents build: a linked repo, or any folder connected to the brain. The name is the author's choice.
- **One row per working folder.** A linked repo (0066) has a row. A folder that is not a repo gets one when it is connected (§4). A linked repo and its workflow are one Factory, never two.
- **The brain owns the row.** It is written from what Git already holds: the `repos` entry and the kit for a linked repo, the workflow's record for a connected folder. The user changes a Factory by changing the link, in the session.
- **What the row shows:** its name, its Area, its Projects, its Domain (a rollup through the Area, as 0105), its Tasks, whether work there is connected, and when its overview was written (§6).
- **A module.** Factories is a module of its own (0048), off in a new space. Linking the first repo or connecting the first folder offers it. With it off, linked repos behave as in 0.17.0.
- **Why a new database (0104 §3).** The existing ones were reviewed in the scope review. A Project is an outcome with an end, and the author's repos outlive projects: several repos serve one project, and one repo serves several. An Area is a responsibility, not a place where work is done. A property on Projects or Areas can't hold a many-to-many link with its own page, tasks and overview. The cost is one more database in setup and one migration; it stays out of a space that links no folder.
- **To settle:** the Factory's record and id in Git; the properties' exact names and owners; whether a row is archived or removed when a repo is unlinked (**default:** archived, as 0066 keeps the knowledge).

#### 2. Placement

- A Factory has one Area, as a kit has today, and its Domain follows that Area (0055).
- A Factory may serve several Projects, and a Project may be served by several Factories. The kit's placement names a list of Projects where it names one today. A kit written before 0.18.0 keeps working.

#### 3. What you want next: tasks linked to a Factory

- Tasks get a **Factory** relation. What the user wants built in a Factory is a **Task** with that relation, never a Project. It may also carry its Project.
- **No new status.** Someday and To Do are the backlog, then Doing and Done, as on any task.
- **Coarse on purpose.** These tasks say what is wanted next, a handful per Factory. The detailed plan stays in the folder, and its items are never copied into Notion as rows.
- **Who writes them.** The user, by hand. The agent adds one only after the user's yes, when a session finds follow-up work (§5).
- **Who owns the status.** Notion does. The agent sets Doing and Done as it works. When the user and the agent both changed a status, the user's value wins without a question (0059).
- **A task the user wrote is taken, not questioned.** A task with a Factory and no Brain ID is the user's instruction for that Factory. Reconcile never raises `UNKNOWN_TASK` for it.
- **Today views.** A Factory's task appears in "What's due today?" only when it has a Due date, as any task does. Otherwise it lives on the Factory's page.
- **To settle:** whether a task the session takes gets a work-item record and a Brain ID, or stays a plain task the session reads; what a task with a Factory and a Project in another Area shows.

#### 4. Connecting a Factory

- A Factory is a third destination of a connected workflow, beside a Project and an Area (0059). One Factory is one folder and one workflow.
- **Still explicit.** Nothing connects by itself. Linking a repo, or asking to connect a folder, offers it once, with the summary 0059's setup shows, and connects on the user's yes.
- **Light by default.** The suggested logging level for a Factory is **Tasks only**. The other levels stay available.
- **A repo that keeps its own tasks** (the kit's tracked-in-repo mode) is still a Factory with an overview and may still have the user's tasks of §3. The mode only says where the detailed plan is tracked.
- **To settle:** the Workflow settings a Factory row carries; whether one question at linking covers the link, the module and the connection; what an existing workflow on a Project or Area becomes when its folder gets a Factory (**default:** it stays where it is until the user moves it).

#### 5. The session in a Factory

- **It starts from the tasks.** A session opened in a Factory's folder reads that Factory's open tasks (To Do and Doing), lists them, and asks which one the user means, before it plans anything.
- **The how is agreed in the session.** The agent proposes how it would do the chosen task and builds after the user's agreement. It adds no approval step in Notion.
- **A request with no task is done.** The agent does the work, and when it closes, offers to add a task for it so the Factory shows it.
- **At the close** the agent sets the tasks' statuses and writes the overview (§6).
- The folder's `AGENTS.md` block, written by `brain link` with the user's yes (linked-repos §8), tells the agent to start this way.
- **To settle:** what the session does when Notion can't be reached (**default:** it says so, works from the user's request, and the next run reconciles); how much of §5 a session follows when the user opens with a direct request.

#### 6. The overview on the Factory's page

- Each Factory page opens with a brain-owned **overview** of what its sessions are building. Nobody edits it in Notion, and the brain never reads it back.
- **What it says,** in this order, with a line left out when it has nothing:

  ```
  As of 23 Nov 2026, 18:40 · from the last session
  Plan: two or three sentences on what the plan is, and where it is kept
  Building now: what is in progress
  Next: what comes after
  Done lately: what was finished, with its date
  ```

- **When it is written.** At the end of each session in the Factory, and at each catch-up that reads the folder, so a session that ends without closing leaves it at most one catch-up old. "As of" says which wrote it.
- **Where it comes from.** The folder: its plan and task files as the kit names them, read at `HEAD` for a repo, and what the session did. It is a view of work the brain doesn't own, as 0066's rollup is.
- **It replaces two toggles.** For a Factory, the `Repo tasks · <name>` toggle (0066) and the workflow's counts-only summary (0059) are not written; their counts become a line of the overview. A linked repo in a space with the Factories module off keeps its toggle.
- The user's tasks (§3) sit below the overview as a board by status.
- **To settle:** the exact text and its limits; what the catch-up reads for a folder that is not a repo; whether the Plan sentences are kept in Git between runs; what the overview says when the folder's plan could not be found.

#### 7. What Factories are not

- **Not a second tracker.** Status has one owner per item: Notion for the user's tasks, the folder for its plan. Nothing syncs a plan item's status both ways.
- **Not a new write into the folder.** The brain still writes only the kit, and `.brain` with its `AGENTS.md` block when the user accepts the link back (0066).
- **Not the brain itself.** The brain's own repo is not a Factory.
- **Not the supervised workflows** that some of the author's texts outside this repo call factories. In the product, a Factory is a row of this database.

### B. Domain homes

#### 8. A Domain page is that Domain's home

- No new layer and no new page type. The Domains page template, which lists the Domain's Projects, Meetings and Documents since 0105, grows into a full home, as each Area page is its area's home (0050).
- **It gains:** the Domain's Areas, its Tasks (due, upcoming, with no date), its Inbox rows, its Goals with the Planning module, and its Factories with the Factories module. Each view is filtered by **Domain contains This page**.
- It stays behind the Domains module. A space with Domains off sees no change.
- **To settle:** the views' names, filters and order; which of an Area home's tabs a Domain home repeats.

#### 9. Tasks get a Domain

- **Tasks get the read-only Domain rollup** through their Area, the mechanism of 0105 §1. A formula that reaches the Domain through the Project was tested and can't be used: a view on a Domain page can't filter on it (Evidence).
- **A task's Area follows its Project.** When a task has a Project and no Area, the brain sets the Area to the Project's Area: when it creates the task, and at each catch-up for a task the user made by hand. It only fills an empty Area and never changes one the user set.
- **What that means for the user.** A task added by hand with only a Project is on its Domain home after the next catch-up. A task with neither a Project nor an Area is on no Domain home; it shows on Home and in the Tasks space.
- **To settle:** whether the fill is reported in the catch-up's counts or asked (**default:** done and counted, since it is mechanical and reversible); whether the New task button on an Area home sets the Area.

#### 10. Home stays thin

- **Today is not split by Domain.** Home keeps what is due today, today's meetings and what came in, across every Domain.
- With the Domains module on, Home opens with **one card per Domain**, each opening that Domain's home.
- **To settle:** which of Home's other views move to the Domain homes and which stay; whether the per-area lines of 0050 stay on Home beside the cards.

### C. The order to 1.0.0

- **0.18.0** is Factories and Domain homes (§A, §B), with the seven fixes already in it (CC-384 to CC-388, CC-391, CC-392). Its Notion changes go in one migration, which also carries the text CC-384 and CC-386 change.
- **0.19.0** is the fourteen features of 0112, §1 to §14 word for word, opened by 0112 §15's seven checks and its scope review. That scope review also settles what Factories change for them: a Factory's line in the weekly row (0112 §11 to §13), a report about a Factory beside a person or an organisation (0112 §8), and "about the brain" against "about this repo" in a Factory's session (0112 §1). 0112's rule that its features add no Notion database stands.
- **0.20.0** is Español: 0106 §5 word for word, with 0.20.0 where it says 0.18.0. It translates the texts of 0.18.0 and 0.19.0 too. From 0.20.0 on, a PR that changes a migration or a guide changes both languages. [0109](0109-meetings-use-the-inbox-s-status-names.md)'s "0.18.0's name map" is 0.20.0's.
- **1.0.0** is cut after 0.20.0. Its release-candidate bar (0106 §6) is unchanged.
- The cutoff stands for anything else.

### D. What this costs

- 1.0.0 moves later by one more release, and 0112's features wait one.
- Notion gains a database, against 0104 §3's default. It is a module, off unless the user links a folder.
- The connected-workflow contract (0059) is reopened: a third destination, a task the workflow did not create, and a summary that says more than counts.
- Beta testers on 0.17.0 get a migration with a new database and a changed Home.
- The overview is only as fresh as the last session or catch-up, and it says so.

## Consequences

- `build/TASKS.md`: 0.18.0 becomes this release, with its rows and the seven fixes; a 0.19.0 section holds CC-376 to CC-382 and U-44; a 0.20.0 section holds CC-354 and U-40; the release sequence gains 0.20.0, and 1.0.0 follows it.
- `docs/vision.md`, `docs/v2-ideas.md` and `AGENTS.md` name the new order.
- "Amended by 0113" lines in 0050, 0059, 0061, 0066, 0105, 0106, 0109 and 0112.
- The contracts change in 0.18.0's contract tasks: `spec/linked-repos.md`, `spec/connected-workflows.md`, `spec/cli.md`, `spec/schema.md`, `spec/capture-and-review.md` and `docs/notion-space-design.md`.
- No spec, CLI, skill, template, Notion or CHANGELOG change in this decision's own PR.

## Evidence

- **The author's description of 2026-11-23:** a database called "factories" "where we can have visibility and notion of what repositories I have added and also have them recognized in the brain as linked repositories"; "not the entire planning, but at least if we have something in the backlog, in doing, and in done"; "these agents within these repositories … could go and read the tasks to see what the user wants to do next. Then, in the session, they could try to come to an agreement with the user on how to do it"; "even with two domains, the navigation in my space is starting to become really unsustainable"; "an additional home layer where I would categorize the spaces of each domain".
- **The author's answers in the scope review of the same day:**
  - the database is named Factories ("This will be the name");
  - a repo is one row, and "multiple repos can serve one project or one can serve multiple projects";
  - what is wanted next is tasks, not projects; "I just need one task or project with the full overview of what the repo sessions are building", which the overview answers;
  - the agent adds a task after the author's yes; the overview is refreshed at the end of a session and at the catch-up; a Factory is any working folder; a Factory's task shows in Today only with a due date;
  - the overview's content (plan, building now, next, done lately) "is the correct overview";
  - a request with no task is done, and a task is offered at the close;
  - a Domain page grown into a home "works", Home keeps a cross-domain today, and the Domain homes stay behind the Domains module;
  - connected workflows: "I have not done this";
  - of three orders offered (add on, pain first, trim), "Let's go with B": Factories and Domain homes in 0.18.0, the fourteen features in 0.19.0, Español in 0.20.0.
- **A test in a disposable test space, with synthetic rows only** (2026-11-23; the rows and the test properties were removed afterwards):
  - The API created a Domain rollup on Tasks through Area, and a task with an Area showed that Area's Domain.
  - A task with a Project and no Area showed no Domain.
  - A rollup through Project to the Project's Domain rollup was refused: "Cannot create a rollup of a related rollup property".
  - The API refused a formula that reads a related page's property, so the author created it in Notion: a formula reaching the Domain through Area and through Project → Area showed the right Domain on each row.
  - In the Domains page template, a linked view of Tasks filtered on that formula offered only free text, not *This page* (the author's check).
  - So the rollup through Area, with the Area filled from the Project, was chosen.
- **Read on 2026-11-23:** `spec/linked-repos.md` §1 to §4 and §8 to §10; `spec/connected-workflows.md` §2, §3.1, §8 and §9; `docs/notion-space-design.md` §3.12; `notion/views-guide.md` §1, §2 and §9a; decisions 0050, 0059, 0066, 0105 and 0112; `docs/design-principles.md` §3.
