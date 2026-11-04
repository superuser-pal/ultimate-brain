# 0021 · Orgs · Relationship gains Employer

**Design change:** decision [0071](../../decisions/0071-a-simpler-notion.md) §5; CC-127 (release 0.9.1; docs/notion-space-design.md §3.7; spec/schema.md §4). **Applies to:** spaces with the Orgs module built or migrated before 0.9.1. A space without an Orgs database has nothing to do. A step already done changes nothing, so running this again is safe.

What changes: the **Relationship** select on Orgs gains **Employer**, for an org you work for: its people are your colleagues, but it isn't a client. The options become Client, Prospect, Partner, Supplier, Employer, Other. Relationship stays yours: the brain reads it into the org note and never writes it. No view changes: "Which clients do I have?" still shows only Client, and an employer appears in "Who else do we work with?", grouped under Employer.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, with your yes;
- **by hand:** you, in Notion (the API can't, or ignores it with a 200: always read the result back).

## Prompt (Notion AI)

Not needed: the agent adds the option through the API (step 1). Without the agent, use this on **Brain Data**:
> In the "Orgs" database, add the option "Employer" to the Relationship select, between Supplier and Other. Keep every existing option, its colour and its values. Don't change anything else.

## 1 · Orgs · Relationship (agent)

Read the Orgs data source first:
- **Employer is already an option:** add nothing.
- **Employer is missing:** update Relationship with every existing option, each with its id, name and colour, in its current order, and **Employer** (a name, no id) right after Supplier, or last when there is no Supplier. An update that leaves out an existing option deletes it and clears that value on every org that held it, so never send Employer alone.
- **Relationship is missing, or isn't a select:** change nothing, report it, and ask the user.

Read the property back after writing it: every option that was there before is still there with the same id.

## By hand

Nothing, unless you want Employer in another place than after Supplier: drag it in the property's options. Then set Relationship to Employer on the org you work for.

## What this migration doesn't do

- **No view change**, and no `brain.json` change.
- **No brain edit by hand.** The next `brain sync` stores `relationship: Employer` in the note of each org you set to it.

## Verify
- [ ] Orgs · Relationship has the options Client, Prospect, Partner, Supplier, Employer and Other, with no option shared by two ids, and every option that existed before keeps its id.
- [ ] No org lost its Relationship value: before you set any org to Employer, the count of orgs per option is the same as before the migration.
- [ ] "Which clients do I have?" shows only orgs whose Relationship is Client.
- [ ] After `brain sync`, the note of an org set to Employer holds `relationship: Employer` in `notion_fields`, and `brain lint` reports no error.
- [ ] `brain-connect-notion`, run again, reports no difference for Orgs.
