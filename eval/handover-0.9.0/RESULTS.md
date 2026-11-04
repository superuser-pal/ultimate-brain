# Catch-up and ingest hand over to brain-repos: blind run results

Two runs on 2026-11-04, each a fresh Sonnet sub-agent with only the skills, CC-104's [RULES.md](../workflow-0.9.0/harness/RULES.md) and a sandbox from [harness/make-sandbox.sh](harness/make-sandbox.sh) ([README.md](README.md)). The CLI is the one on `main`, unchanged.

| Acceptance | Run | Result |
|---|---|---|
| The catch-up rebuilds a tracked-in-repo repo's rollup | E1 | pass |
| "link the repo at <path>" given to brain-ingest ends in brain-repos asking for a yes on the kit, nothing written before it | E2 | pass |

## E1: catch up with a tracked-in-repo repo (brain-catch-up)
Sandbox `catch-up`. Told, in the brain: "catch up".
- **Turn 1 (read-only pass):** status, a snapshot of the Projects and Areas pages, an empty `sync plan`, `repo changes acme-api` (a new commit, no files to read), `repo show`, then `repo tasks acme-api`, which differed from the toggle on the page. The batch said it would refresh "Repo tasks · acme-api" on the Acme website project ("Add rate limiting" now done, "Write the API guide" new), and asked about the pending proposal, the identities and "Publish to Notion at the end? That covers the Review rows and the project's repo task list" (default yes). Checked: brain and repo unchanged, no Notion write.
- **Answer:** "go". **Turn 2:** the backlog's 2 Review notes rows, the publish, the rollup written on the project page with one `toggle` call, `repo record` at the new commit, `log: catch up`. Report: "Done: 2 Review notes rows written for older notes · 1 repo task list updated (acme-api)", with the two Review rows that couldn't be published under Needs you: a sandbox fault (the stand-in has no Review database), which the agent kept unrecorded so the next run creates them.
- **Checked:** the project page's `Repo tasks · acme-api` toggle now reads "2 completed · 2 open (1 waiting, 1 to do) · 50%" with "Waiting: Decide on caching" and "To do: Write the API guide" (it said 1 completed, 2 open before); one toggle call in the stand-in's log; nothing written in `acme-api`; the brain's tree clean after `publish: catch up` and `log: catch up`. **Pass.**

## E2: "link the repo at <path>" in an ingest (brain-ingest → brain-repos)
Sandbox `ingest`. Started with brain-ingest and told: "Ingest this: link the repo at …/acme-api, it's the API for the Acme website project."
- **Turn 1:** went from brain-ingest to brain-repos and its kit reference (it never opened brain-ingest's sources.md), inspected the repo read-only, ran `repo kit check` on its draft and showed the whole kit (Area Clients, Project Acme website, `decisions/**`, `docs/**/*.md`, `README.md`, never `.env*` and `secrets/**`, tasks tracked in `TASKS.md` with `?` → waiting), asking for a yes. Checked: no `brain-kit.json` in the repo, the brain unchanged.
- **Answer:** "Yes, write it as shown. The repo owns the tasks, and [?] is waiting." **Turn 2:** `repo kit write --confirm <the checked hash>`, `repo add acme-api --path … --kit`, the brain commit `repo: link acme-api` (`brain.json` and the log), the rollup on the project page, `repo health`; then the offer of `brain link` the other way and of the first ingest.
- **Checked:** the `repos` entry carries `kit` with the hash, `project` and `never_read`, i.e. it was linked from the kit and not with `--pattern`; the repo holds only the untracked `brain-kit.json`; the brain is clean. **Pass.**

## Notes from the runs, not changed here
- E2: brain-repos doesn't say how to find the target page id beyond `brain index --json`'s `notion` (it found it), nor whether `CHANGES_WAITING` goes in the report.
- E1: brain-sync doesn't list the Workflow properties of Projects and Areas in the snapshot format; the agent sent them and the plan accepted them.
