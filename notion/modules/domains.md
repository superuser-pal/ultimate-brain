# Domains

Group Areas by work or life context. Domains are optional and off by default (0055); an Org remains a separate organization. The Domains database and the Areas · Domain relation are in every space, with the module on or off (0065): turning Domains on builds no database: the brain starts using them, and your pages show them (from 0.18.0, a home page per Domain and one card for each on Home, decision 0113).

## Turning it on

1. **Agent:** check the database is there: Brain Data has **Domains**, Areas has **Domain** (two-way with Domains · Areas, Limit: 1 page) and, with an Orgs database, Domains has **Org** (two-way with Orgs · Domains). Missing? The space predates 0.8.1: run [migration 0014](../migrations/0014-domains-database-in-every-space.md) first. Make sure `notion.databases.domains` holds the database id.
2. **Agent:** check the **Domain** rollups, over Area → Domain, Show original: on Projects, Meetings and, with Documents, Documents (decision 0105; missing? the space predates 0.16.1: run [migration 0028](../migrations/0028-first-things-first-and-domains.md), part B), and on Inbox and, with their modules, Tasks and Goals (decision 0114; missing? it predates 0.18.0: run [migration 0031](../migrations/0031-domain-homes-factories-and-home-cards.md), part A). Your own tasks database is offered one (spec/setup.md §6.2.3).
3. **By hand, each Domain's home:** [migration 0031](../migrations/0031-domain-homes-factories-and-home-cards.md), part B: the Domains page template ([views-guide.md](../views-guide.md) §9a), the Domain pages you already have (the agent does most of it), and Domain after Area in the layouts of §9. Show Domain on area homes, and Areas and Org on Domain pages.
4. **By hand, Home:** the same migration's part C: the tab **Domains**, first, and the tabs Areas and Projects deleted. In a duplicate of the template the Domains tab is there: delete the other two. A Domain has **no Type**: its Name and Summary say what kind of context it is. Don't add one; a space that still has Domains · Type removes it with migration 0028, after your yes.
5. **Verify:** `brain modules` shows Domains on and its database configured; an Area can have one Domain or none; a project, meeting, task or document whose Area has a Domain shows it, and that Domain's page lists it; Home's first tab shows one card per Domain.

## Turning it off

Run `brain modules off domains`. Domain notes and the database remain; the brain stops reading and publishing Domains and their Area relation. On Home, put back the tabs Areas and Projects ([views-guide.md](../views-guide.md) §1, views 0, 0b and 5) and delete the tab Domains, and hide Domain on area homes and in the layouts, if you like; keep the database and the Domain rollups: every space has them.
