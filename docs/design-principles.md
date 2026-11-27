# Product design principles

Adopted by [0104](../decisions/0104-product-design-principles.md). Apply these principles when ideating, planning, designing, developing, reviewing and releasing Ultimate Brain features. They guide trade-offs within the existing trust rules and accepted roadmap.

## 1. Simple over complicated

Choose the smallest design that meets the user's need and preserves the brain's trust guarantees. Reuse existing flows and remove unnecessary steps, configuration and maintenance. A new abstraction, option or workflow needs a concrete benefit.

## 2. Govern the whole information lifecycle

Every feature that moves or changes information must account for its path from source to knowledge and back to the human interface:

`Source → selection and review → ingest → canonical knowledge → agent context and derived outputs → Notion → correction or follow-up`

In the feature's existing task and specs, identify:
- the input and its owner, and the condition that permits reading or ingesting it;
- the transformations, approval points and canonical destination;
- how provenance, exclusions and supersession govern later context and outputs;
- what is published or requested in Notion, who owns each field, and how the user responds;
- how corrections, retries and failures complete the loop without losing work or creating duplicates.

Reuse the [capture lifecycle](../spec/capture-and-review.md), [eligibility contract](../spec/eligibility.md) and [Notion ownership rules](notion-space-design.md#2-ownership-rules-how-notion-and-the-brain-share-each-record), under [0101](../decisions/0101-where-notion-ai-and-the-brain-each-write.md). Keep detailed behavior in those contracts. Markdown and Git remain canonical; Notion remains the human interface and owner of operational fields.

## 3. Keep Notion small

Use existing databases, views, properties and page sections before proposing another database. During the feature-planning session, the agent reviews the use case against the existing database inventory and records the reuse choice. A new database needs an essential purpose and an explanation of why none of the existing databases can serve it, including the complexity it adds to setup, migration and daily use. This is part of the existing planning review. Factories (0.18.0), the database added under this rule, has its review in [0113](../decisions/0113-factories-and-domain-homes-in-0-18-0-the-fourteen-features-in-0-19-0-espanol-in-0-20-0.md) §1.

## 4. Minimise the user's effort

Design the shortest clear path to the outcome in Notion and in the agent session. Reduce clicks, repeated explanations, context copying and tool switching. Use available context and prior answers; let the agent perform routine work and ask only for missing decisions. Give plain instructions and keep the approvals that protect knowledge and user intent.

## 5. Keep the everyday toolset small

The user's everyday tools are Notion and a development agent. Prefer completing the workflow with those tools and existing system facilities. An additional tool needs a planning review showing what the available tools cannot accomplish and why the added setup, maintenance and user effort are justified. Existing agent-managed prerequisites remain supported; consider their installation and recovery as part of the experience.

## 6. Make the development agent the primary brain operator

Prefer Claude Code or Codex for brain management and workflows. Notion AI and Notion agents are optional conveniences within their defined Notion boundaries; they do not become required operators or another canonical knowledge store. [0101](../decisions/0101-where-notion-ai-and-the-brain-each-write.md) still governs their writes and places the complete path without Notion AI in 1.0.0. Additional providers, including Gemini, remain future work rather than newly promised support.

## 7. Offer identical capabilities on macOS and Windows

Consider both operating systems in every feature design, including setup, unattended operation and recovery. Identical capabilities means the same user-visible outcomes and automation; platform-specific commands and implementations may differ. A manual fallback leaves an automation gap open.

Existing differences remain documented until resolved by the [capability-parity epic](v2-ideas.md#epic-identical-capabilities-on-macos-and-windows). Its first known gap, scheduling, is delivered in 0.17.0 ([0110](../decisions/0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md)): the weekly review and the daily catch-up run on a schedule on both, through launchd and Windows Task Scheduler, with one difference named and deferred (a Mac that is off at a slot skips that run, [spec/weekly-review.md](../spec/weekly-review.md) §11.1). Its audit must find all other differences; that work remains post-1.0 with no release assigned. New work must identify any platform gap during planning and carry its resolution into the task's acceptance criteria.

For a release needing manual Windows acceptance, follow [the release procedure](releasing.md#windows-acceptance-follow-up): create or update a task in the existing Notion Tasks database and report outstanding testing as a warning. It does not block publication or replace existing automated and native smoke gates.

## Applying the principles

| Stage | Evidence kept with the work |
|---|---|
| Ideation and planning | Simplest sufficient approach; relevant database and tool reuse choices; shortest user path; macOS and Windows impact |
| Design | Lifecycle and ownership in the existing specs; task acceptance criteria for the applicable principles |
| Development and PR review | Implementation and validation match the agreed design; justified departures are recorded and reconciled with accepted decisions |
| Release | Applicable manual Windows test task and an explicit warning for outstanding testing, following the release procedure |

Keep this evidence in existing tasks, specs and PRs. A change can cite the existing flow it preserves; record an inapplicable principle briefly instead of inventing work. These principles add no database, tracker, mandatory user tool or new release automation.
