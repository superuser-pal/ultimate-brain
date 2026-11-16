# Knowledge (retired in 0.16.0)

The Knowledge module is retired (decision [0099](../../decisions/0099-notion-without-decisions-and-questions.md) §1): there are no Decisions or Questions databases, and no module to turn on or off. The brain always extracts decisions and questions into Git and uses them in every answer and report. Notion shows them in each project's **Brief** and **Decision log** and each area's **Brief**; a question or risk you follow up is a task with Kind Question or Risk ([tasks.md](tasks.md)). `brain modules` no longer lists `knowledge`, and `brain upgrade` removes `modules.knowledge` from `brain.json`.

A space built before 0.16.0 reads back the Status you set on questions, then archives both databases, with [migration 0027](../migrations/0027-one-place-to-decide.md). Nothing is deleted. This file as it was up to 0.15.x is in Git history (`git show v0.15.1:notion/modules/knowledge.md`).
