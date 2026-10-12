---
id: prp-8d3n5y9r
type: proposal
title: "Acme website: link the CMS decision"
created: 2026-12-10
updated: 2026-12-10
kind: add_link
target: prj-9x4t1b7e
field: decisions
after: dec-5m2q8w4z
why: "Use Contentful as the CMS for the blog."
source: mtg-4k8p2v6n
status: pending
---

INVALID: `add_link` only adds to `aliases`, `tags`, `projects`, `people`, `attendees` or `deciders` (0028). A meeting's `decisions` is half of a persisted pair, which `new_item` handles.
