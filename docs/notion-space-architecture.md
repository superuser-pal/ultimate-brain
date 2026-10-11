Notion Space Architecture — Context Brief

Paste this as context when planning a new Notion space.

Core pattern

Hub-and-spoke with a centralized data layer.

Hub (Home). A custom navigation bar built outside Notion's default sidebar. It links to every Space.
Spokes (Spaces). Each Space is a page that behaves like a standalone app — self-contained, single-purpose, with its own visual theme.
Backend page. All databases live on one page. This page is the data layer and is never navigated by end users.

Spaces never contain databases. They contain linked views of databases that live on the backend page.

Anatomy of a Space

Every Space has three fixed elements:

Two-tier navigation in a narrow left column (see below).
A back-to-home button, carried by tier 1.
Linked views only. No source databases, ever.

Existing / planned Spaces include task coordination and lead generation. A client-facing portal is a possible future Space, not a current one.

Navigation: two tiers

Navigation splits into two sibling synced blocks, stacked in the same left column. Tier 1 sits above tier 2, separated by a divider.

Tier 1 — global chrome. One synced block, placed on every internal page in the workspace. Contents: Home, plus a link to each Space. Nothing else. Deliberately unthemed — this is the one element that looks identical everywhere, and that sameness is what makes it read as furniture rather than content. Adding a Space means editing this one block instead of touching every existing menu.

Tier 2 — Space menu. One synced block per Space, listing only that Space's views. All per-Space theming lives here — icon, color, callout style.

Masters live on a dedicated System page on the backend, whose only job is holding nav blocks. Two reasons: editing navigation becomes "go to one page" rather than "find any page that happens to carry the block," and a page that exists solely for this doesn't get deleted by accident, taking every synced copy with it.

Naming views: name them by the question they answer, not by their filter. "What's due this week," not "Due date filter."

Three known trade-offs:

No active state. A synced block renders identically on every page, so tier 2 can't highlight the current view. Compensate with a small non-synced label above the page title carrying the page's own name.
Mobile stacking. Notion collapses columns on phones, so both tiers stack above the content. Keep tier 1 to a single line of inline links, or wrap it in a toggle.
Theming narrows to tier 2. Treat this as correct. A constant global bar plus a themed local menu is clearer than fully themed navigation.

External-facing pages never carry the internal tier 1 block — see the exposure principles below.

Design principles

Views are navigation, not permissions. A filter is a display setting. Anyone who can open a linked view can reach the source database and remove the filter. Filtered views are safe for people already trusted with the whole dataset — teammates, collaborators, self. They are not a boundary.

One backend page, split by exposure class. If anything external-facing is ever added, the backend splits into two pages — exposable (SOPs, resources, templates: things with nothing to hide) and private (everything else). Splitting once by exposure means individual sharing decisions never need case-by-case reasoning.

Internal nav blocks stay internal. A synced block propagates everywhere it's placed and displays the names of pages the viewer may not be able to open. Any external-facing page gets its own separate nav, not tier 1.

Relations render titles. A relation property shows the linked page's title even when the linked page is inaccessible. Check relation columns before exposing any view.

One canonical entity DB. Clients, drivers, owners — each entity type gets exactly one database that everything else relates to. Never duplicate an identity as loose text across multiple DBs. This is what makes filtering, routing, and any future access control reliable.

Writes come in through a staging inbox. External or untrusted input lands in a flat append-only DB first (via a form layer such as Fillout, with hidden URL params carrying identity). Validation and linking to live records happens after. One validated entry path, never two.

Minimal ongoing burden. A solution is evaluated on whether it creates recurring tasks, not only on whether it works. One-time setup with self-generating outputs beats per-record configuration.

Checklist for a new Space
 What single job does this Space do? (If it's two jobs, it's two Spaces.)
 Which existing databases does it read from? Does it need a genuinely new one, or a new view of an existing one?
 What are the views in the tier 2 menu? Name them by the question they answer.
 Tier 2 block created on the System page, with a theme distinct from neighbouring Spaces?
 Tier 1 updated to include this Space? (One edit — verify it propagated.)
 Does this Space write? If yes, directly or through a staging inbox?
 Who can see it? Anyone outside the core workspace?
 If external: which backend page do its sources live on, which properties are exposed, and does it have its own nav block instead of tier 1?
 What recurring work does this create? If the answer isn't "none," what would make it none?
Known constraints
Synced blocks likely cannot nest. Tier 1 and tier 2 must be sibling blocks stacked in a column, not one wrapping the other. Verify before building.
No row-level permissions on Free or Plus. Native page-level access rules require Notion Business or Enterprise (~$20/seat). Below that tier, per-row isolation inside a shared database is not achievable natively.
Guest cap on the free plan. Roughly 10 guests per workspace.
Notion API is rate-limited and third-party frontends cache. Anything reading Notion from outside should be assumed minutes stale, not live.
Notion's plans and permission features change often — verify current capabilities before designing around them.