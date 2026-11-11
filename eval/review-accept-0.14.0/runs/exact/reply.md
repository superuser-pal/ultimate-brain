```
Done: 2 applied · 1 closed (rejected) · 8 pages published
Needs you: 1 item still pending on From Acme sync (d) · the Acme website Decision log was not updated in Notion · Carlos Ruiz's page was not created · push failed (no remote), 3 commits not pushed
Next: decide d on the Review row (Decision, then Submit decisions) and say "apply my reviews"
```

**What changed**
- Acme website launch date is now 2027-04. This is your value: it replaces 2027-02, and the source's 2027-03 is kept in the history as superseded.
- Row-level security now ends with "Carlos will use RLS for the client portal.", sourced to Acme sync.
- The new decision "Launch in March" was rejected and is archived.
- The Review row's summary now reads "3 of 4 decided: 2 applied, 1 closed, 1 waiting for you", and its Decided, Decided at and Accept all are cleared.

**Check**
- **d (link Row-level security to Acme website):** it was left on Pending, so nothing was applied for it.
- **Decision log held back:** after the rejection, the regenerated Decision log for Acme website lists "Launch in March" under Current as accepted. I did not write that section to Notion, so Notion still shows the old log; the brain's own copy of the log does carry the wrong line. This is a product bug, and the next publish will try to send the section again.
- **Carlos Ruiz:** the publish wanted to create his People page (still Draft). I did not create it, because this session cannot return a page id to record. He is therefore not yet linked on the Acme website People or the two meetings' Attendees.
- **Acme website summary:** it still says "launching February 2027". No proposal changed it; say so if you want a change proposed.
- **Other pages:** the publish also re-sent six pages this review did not change (Clients, Maria López, Acme, the open question, both meetings).
- **Lint:** it reports 7 product-file errors (skill files and the assistant file differ from the released version). They were there before this run.

**Finding to file** — the rejected note in the Decision log. Here is the issue text; say "file it" and I'll create it with the dogfood label:

> **A rejected draft decision appears as Current in the project's decision log**
> A Review row with item sections proposes a new decision note for a project. The user sets that item to Reject and submits. `sync apply` closes the item and sets the note to `lifecycle: archived` (its `assessment` stays `accepted`). `brain views` then adds the note to the project's decision log under "Current" as accepted, and `sync render --changed` sends that Decision log section for Notion. Before the rejection, while the note was a draft, it was not in the log.
> Expected: an archived (rejected) decision never appears in the decision log or its rendered section.
