# Domains

Group Areas by work or life context. Domains are optional and off by default (0055); an Org remains a separate organization. The Domains database and the Areas · Domain relation are in every space, with the module on or off (0065): turning Domains on builds nothing, it starts the brain using them and shows them on your pages.

## Turning it on

1. **Agent:** check the database is there: Brain Data has **Domains**, Areas has **Domain** (two-way with Domains · Areas, Limit: 1 page) and, with an Orgs database, Domains has **Org** (two-way with Orgs · Domains). Missing? The space predates 0.8.1: run [migration 0014](../migrations/0014-domains-database-in-every-space.md) first. Make sure `notion.databases.domains` holds the database id.
2. **By hand:** group Home's Areas view by Domain, including No domain; show Domain on area homes and Areas and Org on Domain pages.
3. **Verify:** `brain modules` shows Domains on and its database configured; an Area can have one Domain or none.

## Turning it off

Run `brain modules off domains`. Domain notes and the database remain; the brain stops reading and publishing Domains and their Area relation. Remove the Domain grouping from Home and hide Domain on area homes if you like; keep the database: every space has it.
