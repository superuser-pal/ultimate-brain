# 0114 — A task with only a Factory gets the Factory's Area

**Status:** Accepted
**Date:** 2026-11-23
**Release:** 0.18.0
**Amends:** [0113](0113-factories-and-domain-homes-in-0-18-0-the-fourteen-features-in-0-19-0-espanol-in-0-20-0.md) §9 (a task with a Factory, no Project and no Area gets the Factory's Area; the catch-up fills only unfinished tasks) and §8 (Inbox and Goals get the Domain rollup its views filter on)
**Keeps:** the rest of 0113 §9: only an empty Area is filled, and an Area the user set is never changed

## Context

A task linked to a Factory says what you want built next (0113 §3), and most carry only that Factory. By §9 such a task is on no Domain home, though its Factory has an Area. §9 also fills finished tasks: in a space with hundreds of them, hundreds of Notion writes in the first catch-up for rows no Domain home shows. And §8's views on Inbox and Goals need a Domain to filter on, which neither has.

## Decision

1. **The Factory's Area.** A task with a Factory, no Project and no Area gets its Factory's Area, filled as a Project's is: when the brain creates the task, and at each catch-up; only when the Area is empty, without asking, and counted in the report.
   - The Project's Area wins when the task has both. With Projects in different Areas it gets none, and its Factory is not used to choose.
   - Several Factories follow the rule for several Projects: the Area they share, else none.
   - With the Factories module off, the Factory is not read.
   - §9's last line becomes: a task with no Project, no Factory and no Area is on no Domain home; it shows on Home and in the Tasks Space.
2. **Unfinished tasks only.** The catch-up's fill, from a Project or a Factory, covers tasks whose Status is neither Done nor Won't Do, through the mapping on a Tasks database the user mapped, with no limit per run. A Domain home shows no finished task.
3. **The Domain rollup on Inbox and Goals,** read-only and owned by Notion, as on Tasks (0113 §9, [0105](0105-domains-on-projects-meetings-and-documents-and-domains-without-type.md) §1).

## Consequences

- 0113 §9 as written changes one thing at creation: a meeting's task takes its Projects' Area, and none when they differ. The meeting's own Area, which its tasks took through 0.17.0, is used only for a task with no Project.
- CC-396 writes the contract, CC-398 the CLI, CC-399 the migration and CC-400 the skills.
- 0113 gets an "Amended by" line.

## Evidence

The author's answers of 2026-11-23, as the coordinator recorded them: a task with a Factory, no Project and no Area gets the Factory's Area; with a Factory and a Project in different Areas, its Project's Area, with no question; the rollup is added on Inbox and Goals too; and, asked between at most 50 tasks per catch-up, all of them and unfinished ones only, unfinished only.
