# Domains

Group Areas by work or life context. Domains are optional and off by default (0055); an Org remains a separate organization. The Domains database and the Areas · Domain relation are in every space, with the module on or off (0065): turning Domains on builds nothing, it starts the brain using them and shows them on your pages.

## Turning it on

1. **Agent:** check the database is there: Brain Data has **Domains**, Areas has **Domain** (two-way with Domains · Areas, Limit: 1 page) and, with an Orgs database, Domains has **Org** (two-way with Orgs · Domains). Missing? The space predates 0.8.1: run [migration 0014](../migrations/0014-domains-database-in-every-space.md) first. Make sure `notion.databases.domains` holds the database id.
2. **Agent:** check the **Domain** rollups: Projects, Meetings and, with Documents, Documents each have Domain, a rollup over Area → Domain, Show original (decision 0105). Every space has them; a space without them predates 0.16.1: run [migration 0028](../migrations/0028-first-things-first-and-domains.md) (part B, Domains).
3. **By hand:** group Home's Areas view by Domain, including No domain; show Domain on area homes, Areas and Org on Domain pages, and Domain after Area on the Projects, Meetings and Documents pages ([views-guide.md](../views-guide.md) §9). The Domains page template lists each Domain's projects, meetings and documents (§9a). A Domain has **no Type**: its Name and Summary say what kind of context it is. Don't add one; a space that still has Domains · Type removes it with migration 0028, after your yes.
4. **Verify:** `brain modules` shows Domains on and its database configured; an Area can have one Domain or none; a project, meeting or document whose Area has a Domain shows it, and that Domain's page lists it.

## Turning it off

Run `brain modules off domains`. Domain notes and the database remain; the brain stops reading and publishing Domains and their Area relation. Remove the Domain grouping from Home and hide Domain on area homes and on the Projects, Meetings and Documents pages if you like; keep the database and the Domain rollups: every space has them.
