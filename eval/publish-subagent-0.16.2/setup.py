#!/usr/bin/env python3
"""Build the two brains and their fake Notion workspaces for CC-267's before/after catch-up.

    python3 eval/publish-subagent-0.16.2/setup.py <skills-after>

<skills-after> is a checkout of the skills fork at the CC-267 branch: its brain/brain-catch-up/SKILL.md replaces the vendored
one in the `after` brain. The `before` brain keeps this repo's vendored skills (.agents/skills). Nothing else differs.

Needs `npm run build` first (the `brain` shim runs bin/brain.js). Everything is synthetic and goes under $UB_EVAL_DIR
(default /tmp/ub-eval-cc267): `bin/brain`, and per variant `<v>/` (the brain), `<v>-sim/` (the fake workspace:
state.json, snapshot.json, meetings.json, inbox.json, writes.jsonl) and `<v>-mcp.json` (the MCP config naming the fake
server `notion`). The scenario: the brain was published to Notion before (every note has its page), setup left the
template's Example rows, and one Reviewed meeting and one Ask row wait.
"""
import json, os, pathlib, shutil, subprocess, sys, uuid

HERE = pathlib.Path(__file__).resolve().parent
R = HERE.parents[1]
B = pathlib.Path(os.environ.get("UB_EVAL_DIR", "/tmp/ub-eval-cc267"))
NOW = "2026-12-14T09:00:00Z"
SEEN = "2026-12-14T08:00:00.000Z"
VARIANTS = ("before", "after")


def uid(n): return f"d0000000-0000-4000-8000-{n:012d}"


DATABASES = ["domains", "areas", "goals", "key_results", "projects", "meetings", "people", "orgs", "inbox", "documents"]
DB_IDS = {k: uid(i + 1) for i, k in enumerate(DATABASES)}
DB_IDS["tasks"] = uid(99)

# Properties each database has besides the ones a render sends (Notion returns every property of the page's database).
EXTRA = {
    "projects": {"Status": "status", "Deadline": "date", "Goal": "relation", "Client": "relation", "Tasks": "relation", "Meetings": "relation", "Documents": "relation", "Inbox": "relation"},
    "areas": {"Domain": "relation", "Projects": "relation", "Meetings": "relation", "Documents": "relation", "Tasks": "relation"},
    "meetings": {"Date": "date", "Brain Status": "select", "Project": "relation", "Area": "relation", "Attendees": "relation", "Tasks": "relation", "Scope": "checkbox", "For the brain": "checkbox"},
    "people": {"Role": "rich_text", "Org": "relation", "Email": "email", "Meetings": "relation", "Projects": "relation"},
    "orgs": {"People": "relation", "Projects": "relation", "Website": "url"},
    "inbox": {"Kind": "select", "Brain Status": "select", "Summary": "rich_text", "Project": "relation", "Area": "relation", "Document asked": "checkbox", "Report": "relation", "Only keep": "rich_text"},
    "documents": {"Origin": "select", "Project": "relation", "Area": "relation", "Asked in": "relation", "Refresh asked": "checkbox", "Accepted": "checkbox", "Accepted at": "date", "What to fix": "rich_text"},
    "tasks": {"Status": "status", "Due": "date", "Project": "relation", "Area": "relation", "Meeting": "relation", "Source": "relation", "Kind": "select", "Document asked": "checkbox"},
    "goals": {}, "key_results": {}, "domains": {},
}
COMMON = {"Name": "title", "Brain ID": "rich_text", "Summary": "rich_text", "Last Synced": "date", "Created": "created_time", "Last edited": "last_edited_time"}

MEETING_TEXT = """## Attendees
Maria López (Acme), Carlos Ruiz, Alex Example, Sofia Brandt (Acme, new head of marketing)

## Projects
Acme website

## Summary
The team reviewed the launch plan for the Acme website. Sofia Brandt joined Acme as head of marketing and now owns the brand guidelines. The site launches in English and German; Spanish follows in the second quarter. The blog moves to the new CMS before launch, and hosting stays where it is until the contract ends in March.

## Action Items
- [ ] Alex Example sends the revised sitemap to Maria López by 2026-12-18
- [ ] Alex Example books the accessibility audit by 2026-12-22
- [ ] Carlos Ruiz shares the CMS migration plan by 2026-12-19
- [ ] Sofia Brandt sends the brand guidelines by 2026-12-17

## Decisions
- The site launches in English and German; Spanish follows in Q2 2027.
- The blog moves to the new CMS before launch.
- Hosting stays on the current provider until the contract ends in March 2027.

## Open Questions
- Who signs off the German copy? Raised by Maria López.
- Does the accessibility audit need a second round before launch? Raised by Carlos Ruiz.

## Risks
- The CMS migration may slip if the content freeze is late. Raised by Carlos Ruiz.
"""
EXAMPLE_MEETING = """## Attendees
Jordan Example

## Projects
Example · Website relaunch

## Action Items
- [ ] Jordan Example sends the agenda by 2026-11-20

## Decisions
- Meet every Monday.
"""


def sh(*a, cwd=None, check=True):
    return subprocess.run(a, cwd=cwd, check=check, capture_output=True, text=True).stdout


def git(d, *a, check=True):
    return sh("git", "-c", "user.name=Eval", "-c", "user.email=eval@brain.example", *a, cwd=d, check=check)


def brain(d, *args):
    out = json.loads(sh("brain", *args, "--brain", str(d), "--json", check=False))
    if not out.get("ok"):
        sys.exit(f"brain {' '.join(args)}: {json.dumps(out.get('error'))}")
    return out["data"]


def prepare():
    (B / "bin").mkdir(parents=True, exist_ok=True)
    shim = B / "bin" / "brain"
    shim.write_text(f'#!/bin/sh\nexec node {R}/bin/brain.js "$@"\n')
    shim.chmod(0o755)
    os.environ["PATH"] = f"{B / 'bin'}:{os.environ['PATH']}"


# ---- The fake workspace's state ----

def rich(text):
    return [{"type": "text", "text": {"content": text, "link": None}, "annotations": {"bold": False, "italic": False, "strikethrough": False, "underline": False, "code": False, "color": "default"}, "plain_text": text, "href": None}]


def stored(name, prop, schema):
    """A render property ({type, value}) as Notion stores and returns it."""
    t, v = prop["type"], prop.get("value")
    sid = schema.get(name, {}).get("id", name[:4])
    base = {"id": sid, "type": t}
    if t in ("title", "rich_text"): return {**base, t: rich(v) if v else []}
    if t == "date": return {**base, "date": {"start": v["start"], "end": v.get("end"), "time_zone": None} if v else None}
    if t in ("select", "status"): return {**base, t: {"id": f"opt-{len(v)}", "name": v, "color": "default"} if v else None}
    if t == "multi_select": return {**base, t: [{"id": f"opt-{len(o)}", "name": o, "color": "default"} for o in (v or [])]}
    if t == "relation": return {**base, "relation": [{"id": r if isinstance(r, str) else r.get("id")} for r in (v or [])], "has_more": False}
    return {**base, t: v}


def blocks_from_markdown(state, parent, md):
    for para in [p for p in md.split("\n") if p.strip()]:
        if para.startswith("## "): typ, text = "heading_2", para[3:]
        elif para.startswith("### "): typ, text = "heading_3", para[4:]
        elif para.startswith("- [ ] "): typ, text = "to_do", para[6:]
        elif para.startswith("- "): typ, text = "bulleted_list_item", para[2:]
        else: typ, text = "paragraph", para
        add_block(state, parent, typ, text)


def add_block(state, parent, typ, text, toggle=False):
    bid = str(uuid.uuid4())
    content = {"rich_text": rich(text), "color": "default"}
    if typ.startswith("heading_"): content["is_toggleable"] = toggle
    if typ == "to_do": content["checked"] = False
    state["blocks"][bid] = {"id": bid, "parent": parent, "parent_type": "page" if parent in state["pages"] else "block", "type": typ, "content": content, "created": SEEN, "edited": SEEN}
    state["children"].setdefault(parent, []).append(bid)
    return bid


def add_page(state, database, properties, page_id=None):
    pid = page_id or str(uuid.uuid4())
    state["pages"][pid] = {"id": pid, "database": database, "database_id": DB_IDS[database], "properties": properties, "created": SEEN, "edited": SEEN}
    return pid


def schemas_for(items):
    schemas = {db: {} for db in DB_IDS}
    for db in schemas:
        for n, t in {**COMMON, **EXTRA.get(db, {})}.items(): schemas[db][n] = {"id": f"p{len(schemas[db]):03d}", "type": t}
    for it in items:
        for n, p in it["properties"].items():
            schemas[it["database"]].setdefault(n, {"id": f"p{len(schemas[it['database']]):03d}", "type": p["type"]})
    return schemas


def toggle_sections(state, pid, sections):
    for title, md in sections.items():
        h = add_block(state, pid, "heading_2", title, toggle=True)
        if md: blocks_from_markdown(state, h, md)


def publish_baseline(d, state, rows):
    """Write and record every render item, as an earlier publish would have, until nothing is left."""
    for _ in range(5):
        items = brain(d, "sync", "render", "--changed")["items"]
        items = [i for i in items if i["properties"]]
        if not items: return
        for it in items:
            sc = state["schemas"].setdefault(it["database"], {})
            for n, p in it["properties"].items(): sc.setdefault(n, {"id": f"p{len(sc):03d}", "type": p["type"]})
        records = []
        for it in items:
            sc = state["schemas"][it["database"]]
            props = {n: stored(n, p, sc) for n, p in it["properties"].items()}
            pid = it.get("page_id")
            if pid and pid in state["pages"]: state["pages"][pid]["properties"].update(props)
            else:
                pid = add_page(state, it["database"], props, pid)
                if it["database"] == "projects": toggle_sections(state, pid, {"Brief": "", "Decision log": ""})
            for title, md in (it.get("sections") or {}).items():
                heads = [b for b in state["children"].get(pid, []) if state["blocks"][b]["type"] == "heading_2" and state["blocks"][b]["content"]["rich_text"][0]["plain_text"] == title]
                h = heads[0] if heads else add_block(state, pid, "heading_2", title, toggle=True)
                state["children"][h] = []
                blocks_from_markdown(state, h, md)
            if it.get("body"): blocks_from_markdown(state, pid, it["body"])
            rows.append({"database": it["database"], "page_id": pid, "last_edited": SEEN, "properties": {k: v for k, v in it["published"].items() if not k.startswith("@")}})
            records.append({"id": it["id"], "notion": pid, "synced_at": NOW, "published": it["published"]})
        f = B / "record.json"; f.write_text(json.dumps({"records": records}))
        brain(d, "sync", "record", "--input", str(f))
    sys.exit("the baseline publish did not settle in 5 renders")


def make(variant, after_skill):
    d = B / variant
    sim = B / f"{variant}-sim"
    for p in (d, sim): shutil.rmtree(p, ignore_errors=True)
    sim.mkdir(parents=True)
    sh("node", "scripts/blind-brain.mjs", "brain-acme", str(d), cwd=R)
    if variant == "after":
        for tree in (".agents/skills", ".claude/skills"):
            shutil.copy(after_skill, d / tree / "brain-catch-up" / "SKILL.md")
    config = json.loads((R / "templates/brain/brain.json").read_text())
    config["owner"] = {"name": "Alex Example"}
    config["settings"] = {"publish": "auto", "push": "auto"}
    config["notion"]["databases"] = {k: DB_IDS[k] for k in config["notion"]["databases"]}
    config["notion"]["tasks"]["database"] = DB_IDS["tasks"]
    (d / "brain.json").write_text(json.dumps(config, indent=2) + "\n")
    brain(d, "proposal", "backlog")  # the one-time backlog rows are not this run's work
    brain(d, "log", "setup", "-", "step=first-value", "result=done", "report=pass", "organised=pass", "answer=pass", "tasks=pass")
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: connected, first value")

    state = {"databases": DB_IDS, "schemas": schemas_for([]), "pages": {}, "blocks": {}, "children": {}, "templates": {
        "projects": [{"type": "heading_2", "heading_2": {"rich_text": [{"text": {"content": "Brief"}}], "is_toggleable": True}},
                     {"type": "heading_2", "heading_2": {"rich_text": [{"text": {"content": "Decision log"}}], "is_toggleable": True}},
                     {"type": "heading_2", "heading_2": {"rich_text": [{"text": {"content": "My notes"}}], "is_toggleable": True}}]}}
    rows = []
    publish_baseline(d, state, rows)
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: published to Notion before")

    sc = state["schemas"]
    project_page = next(p["id"] for p in state["pages"].values() if p["database"] == "projects")
    people = {plain(p): p["id"] for p in state["pages"].values() if p["database"] == "people" for plain in [lambda p: p["properties"]["Name"]["title"][0]["plain_text"]]}
    meeting = add_page(state, "meetings", {
        "Name": stored("Name", {"type": "title", "value": "Acme launch plan review"}, sc["meetings"]),
        "Date": stored("Date", {"type": "date", "value": {"start": "2026-12-11"}}, sc["meetings"]),
        "Brain Status": stored("Brain Status", {"type": "select", "value": "Reviewed"}, sc["meetings"]),
        "Project": stored("Project", {"type": "relation", "value": [project_page]}, sc["meetings"]),
        "Attendees": stored("Attendees", {"type": "relation", "value": list(people.values())}, sc["meetings"])})
    blocks_from_markdown(state, meeting, MEETING_TEXT)
    ask = add_page(state, "inbox", {
        "Name": stored("Name", {"type": "title", "value": "Where do we stand with the Acme website?"}, sc["inbox"]),
        "Kind": stored("Kind", {"type": "select", "value": "Ask"}, sc["inbox"]),
        "Brain Status": stored("Brain Status", {"type": "select", "value": "Ready"}, sc["inbox"]),
        "Project": stored("Project", {"type": "relation", "value": [project_page]}, sc["inbox"])})
    # Setup's leftovers: the template's Example rows, which the pull leaves out and the report names once (0084, 0087).
    ex = {}
    for db, name, extra in [("projects", "Example · Website relaunch", {"Status": ("status", "Active")}),
                            ("tasks", "Example · Send the proposal", {"Status": ("status", "To Do")}),
                            ("people", "Example · Jordan Example", {}),
                            ("inbox", "Example · A podcast worth keeping", {"Kind": ("select", "Capture"), "Brain Status": ("select", "New")}),
                            ("meetings", "Example · Weekly sync", {"Brain Status": ("select", "Reviewed"), "Date": ("date", {"start": "2026-11-16"})})]:
        props = {"Name": stored("Name", {"type": "title", "value": name}, sc[db])}
        for n, (t, v) in extra.items(): props[n] = stored(n, {"type": t, "value": v}, sc[db])
        ex[db] = add_page(state, db, props)
        if db == "meetings": blocks_from_markdown(state, ex[db], EXAMPLE_MEETING)
        if db != "meetings" and db != "inbox":
            rows.append({"database": db, "page_id": ex[db], "last_edited": SEEN, "properties": {"Name": name, **{n: v for n, (t, v) in extra.items() if t != "date"}}})

    rows = list({r["page_id"]: r for r in rows}.values())  # a page written in two renders is one row, its last
    (sim / "state.json").write_text(json.dumps(state))
    (sim / "writes.jsonl").write_text("")
    (sim / "snapshot.json").write_text(json.dumps({"as_of": NOW, "rows": rows}, indent=1, ensure_ascii=False))
    (sim / "meetings.json").write_text(json.dumps([
        {"page_id": meeting, "Name": "Acme launch plan review", "Date": "2026-12-11", "Brain Status": "Reviewed", "Project": "Acme website", "Attendees": ["Maria López", "Carlos Ruiz"], "page_text": MEETING_TEXT},
        {"page_id": ex["meetings"], "Name": "Example · Weekly sync", "Date": "2026-11-16", "Brain Status": "Reviewed", "Project": None, "Attendees": [], "page_text": EXAMPLE_MEETING}], indent=1, ensure_ascii=False))
    (sim / "inbox.json").write_text(json.dumps([
        {"page_id": ask, "Name": "Where do we stand with the Acme website?", "Kind": "Ask", "Brain Status": "Ready", "Project": "Acme website", "created": "2026-12-12T10:00:00Z", "page_text": ""},
        {"page_id": ex["inbox"], "Name": "Example · A podcast worth keeping", "Kind": "Capture", "Brain Status": "New", "Project": None, "created": "2026-11-16T10:00:00Z", "page_text": "An example capture from the template."}], indent=1, ensure_ascii=False))
    (B / f"{variant}-mcp.json").write_text(json.dumps({"mcpServers": {"notion": {"type": "stdio", "command": "node", "args": [str(HERE / "notion-fake.mjs"), str(sim)]}}}))
    git(d, "rev-parse", "HEAD")
    (B / f"{variant}.base").write_text(git(d, "rev-parse", "HEAD"))
    print(d)


if __name__ == "__main__":
    if len(sys.argv) != 2 or not (pathlib.Path(sys.argv[1]) / "brain/brain-catch-up/SKILL.md").is_file():
        sys.exit("usage: setup.py <checkout of the skills fork at the CC-267 branch>")
    prepare()
    for v in VARIANTS: make(v, pathlib.Path(sys.argv[1]) / "brain/brain-catch-up/SKILL.md")
