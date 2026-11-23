#!/usr/bin/env python3
"""Build the brains and the simulated Notion files for the unattended catch-up runs (CC-64, decision 0051; the 0.17.0 model, CC-388).

    python3 eval/unattended-0.7.0/setup.py <scenario>      one scenario
    python3 eval/unattended-0.7.0/setup.py all             every scenario

Needs `npm run build` in the repo first (the `brain` shim runs bin/brain.js). Everything is synthetic and goes under
$UB_EVAL_DIR (default /tmp/ub-eval-0.7.0): `bin/brain` (the shim), `no-mcp.json` (an empty MCP config), and per
scenario `<name>/` (the brain), `<name>-sim/` (the Notion answers) and, for the budget run, `budget-drop/`.
"""
import json, os, pathlib, shutil, subprocess, sys

R = pathlib.Path(__file__).resolve().parents[2]
B = pathlib.Path(os.environ.get("UB_EVAL_DIR", "/tmp/ub-eval-0.7.0"))
NOW = "2026-12-14T09:00:00Z"
WEEK = "2026-W51"  # the Weekly row's week: its Monday is the day of NOW
WRITTEN = "2026-12-14T06:00:00Z"  # when that week's row was written
# Page ids the fixture or this script gives Notion pages; built from parts so no literal UUID sits in the repo.
def uid(n): return f"{0xe1000000:08x}-0000-4000-8000-{n:012d}"
NOTE = "only the short name, and Mira now leads the copy team"  # the user's words on a Weekly item: an unattended run leaves them alone
ACME_PAGE = "-".join(["2b3c4d5e", "6f7a", "4b9c", "8d1e", "2f3a4b5c6d7e"])  # the fixture's page id for the Acme website project
MARIA_PAGE = "-".join(["7a8b9c0d", "1e2f", "4a3b", "8c4d", "5e6f7a8b9c0d"])  # the fixture's page id for Maria
REPORT_BODY = "\n\n".join([
    "## Where it stands", "Launch is set for February, per [the auth decision](../knowledge/decisions/2026-12-03-use-supabase-for-auth.md).",
    "## Timeline", "- 2026-12-03: auth chosen.",
    "## Decisions in force", "- [Use Supabase for auth](../knowledge/decisions/2026-12-03-use-supabase-for-auth.md)",
    "## Open questions and risks", "- None", "## People involved", "- None", "## Gaps", "- Nothing on pricing."])


def prepare():
    (B / "bin").mkdir(parents=True, exist_ok=True)
    shim = B / "bin" / "brain"
    shim.write_text(f'#!/bin/sh\nexec node {R}/bin/brain.js "$@"\n')
    shim.chmod(0o755)
    (B / "no-mcp.json").write_text('{"mcpServers":{}}\n')
    os.environ["PATH"] = f"{B / 'bin'}:{os.environ['PATH']}"


def sh(*a, cwd=None, check=True):
    run = subprocess.run(a, cwd=cwd, capture_output=True, text=True)
    if check and run.returncode != 0: sys.exit(f"{' '.join(a)}: exit {run.returncode}\n{run.stdout}{run.stderr}")
    return run.stdout


def git(d, *a, check=True):
    return sh("git", "-c", "user.name=Blind", "-c", "user.email=b@brain.example", *a, cwd=d, check=check)


def brain(d, *args, now=NOW):
    return json.loads(sh("brain", *args, "--brain", str(d), "--now", now, "--json"))["data"]


def given(d, data, *args, now=NOW):
    """A brain command with its input file, kept beside the brain."""
    f = B / f"{d.name}-input.json"; f.write_text(json.dumps(data))
    return brain(d, *args, "--input", str(f), now=now)


def make(name):
    d = B / name
    shutil.rmtree(d, ignore_errors=True)
    shutil.rmtree(B / f"{name}-sim", ignore_errors=True)
    sh("node", "scripts/blind-brain.mjs", "brain-acme", str(d), cwd=R)
    (d / ".claude/agents").mkdir(parents=True)
    shutil.copy(R / "templates/brain/.claude/agents/ultimate-assistant.md", d / ".claude/agents")  # a product file blind-brain.mjs leaves out; brain lint wants it
    sh("brain", "proposal", "backlog", "--brain", str(d), "--json")  # the one-time backlog rows are not work for these runs
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: backlog done", check=False)
    return d


def config(d, fn):
    p = d / "brain.json"; c = json.loads(p.read_text()); fn(c); p.write_text(json.dumps(c, indent=2) + "\n")


DATABASES = ["areas", "goals", "key_results", "projects", "meetings", "people", "orgs", "inbox", "documents"]


def connect(d, reports, publish):
    def apply(c):  # the databases of a 0.17.0 brain: no Review, Decisions or Questions (0096, 0099)
        c["notion"] = {"review_sections": True, "databases": {k: uid(i + 1) for i, k in enumerate(DATABASES)}, "tasks": c["notion"]["tasks"]}
        c["settings"] = {"publish": publish, "push": "auto", "cleanup": {"auto": "off"}}  # off: the week's mechanical items are C items to tick
        c["modules"] = {"domains": False, "orgs": True, "documents": True, "reports": reports, "tasks": False, "planning": False}
    config(d, apply)


def sim_files(name, rows, meetings, inbox=()):
    sim = B / f"{name}-sim"; sim.mkdir(parents=True, exist_ok=True)
    (sim / "snapshot.json").write_text(json.dumps({"as_of": NOW, "rows": rows}, indent=1))
    (sim / "meetings.json").write_text(json.dumps(meetings, indent=1))
    (sim / "inbox.json").write_text(json.dumps(list(inbox), indent=1))
    (sim / "writes.md").write_text("")


def mtg(n, title, date, body):
    return {"page_id": uid(200 + n), "Name": title, "Date": date, "Brain Status": "Ready", "last_edited": "2026-12-13T18:00:00Z", "Project": "Acme website", "Attendees": ["Maria López", "Carlos Ruiz"], "page_text": body}


def scenario_noop():
    make("noop")  # Notion not configured


def scenario_noop_connected():
    d = make("noop-connected"); connect(d, reports=True, publish="auto")
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: Notion connected")
    sim_files("noop-connected", [], [])  # an empty workspace


def scenario_budget():
    d = make("budget")
    drop = B / "budget-drop"; shutil.rmtree(drop, ignore_errors=True); drop.mkdir()
    for i in range(1, 13):
        f = drop / f"note-{i:02d}.md"
        f.write_text(f"# Supplier note {i}\n\nOn 2026-12-{i:02d} Maria López from Acme asked for update number {i} on the website content plan. Carlos Ruiz will reply by 2026-12-{i + 10:02d}.\n")
        os.utime(f, (1765000000 + i * 3600, 1765000000 + i * 3600))
    with open(d / "AGENTS.md", "a") as f: f.write(f"\nDrop folder: {drop}\n")
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: drop folder")


def publish(d, note, page, now=NOW):
    """Record the note as published on this page, as the run that wrote it would have."""
    item = brain(d, "sync", "render", "--ids", note, now=now)["items"][0]
    given(d, {"records": [{"id": note, "notion": page, "synced_at": now, "published": item["published"]}]}, "sync", "record", now=now)
    return item


def weekly_row(d, page):
    """This week's row, written by the CLI from four repeated aliases, published and set Ready: one plain tick, one whose file changed since,
    one with a note, one unticked. Returns the Inbox row."""
    people = {"Ivo Brand": "per-8d4f2j6k", "Lena Hart": "per-4m7q2x9c", "Mira Lund": "per-5j8r3x6m", "Otto Kern": "per-6t3w8k2p"}
    for name, pid in people.items():
        first = name.split()[0]
        (d / f"knowledge/people/{name.lower().replace(' ', '-')}.md").write_text(
            f"---\nid: {pid}\ntype: person\ntitle: {name}\nsummary: {name} reviews page texts at Acme.\nlifecycle: reviewed\naliases: [{first}, {first}]\n"
            f"sources: [mtg-8c4n2p7w]\ncreated: 2026-12-03\nupdated: 2026-12-03\n---\n\nReviews page texts.\n")
    snap = B / f"{d.name}-weekly.json"
    snap.write_text(json.dumps({"as_of": WRITTEN, "notion": "unreachable", "repos": []}))
    os.environ["HOME"], home = str(B / "home"), os.environ["HOME"]  # the weekly commands' hand-off files stay out of the user's home
    planned = brain(d, "weekly", "plan", "--snapshot", str(snap), now=WRITTEN)
    selected = given(d, {"input_hash": planned["input_hash"], "judged": {"clusters": [], "findings": [], "corrections": []}}, "weekly", "select", now=WRITTEN)
    proposals = [{"key": i["key"], "proposal": given(d, {"proposals": i["proposal_input"]}, "proposal", "new", now=WRITTEN)["created"][0]["id"]} for i in selected["items"] if i["write"]]
    report = given(d, {"input_hash": planned["input_hash"], "proposals": proposals, "in_short": "A quiet week.", "highlights": ["- Nothing new this week."],
                       "focus_first": ["- No overdue, stalled or blocked work."], "cleaned": [], "mode": "attended", "publish": False, "failures": [],
                       "notes_read": 0, "seconds": 1}, "weekly", "record", now=WRITTEN)["id"]
    os.environ["HOME"] = home
    body = publish(d, report, page, WRITTEN)["body"]
    labels = [l for l in ("C1", "C2", "C3", "C4") if f"- [ ] {l} · " in body]
    assert len(labels) == 4, body
    for label in labels[:3]: body = body.replace(f"- [ ] {label} · ", f"- [x] {label} · ")
    parts = body.split("Your note:"); assert len(parts) == 5, body
    parts[3] = f" {NOTE}" + parts[3]  # after the third item's line
    stale = next(n for n in people if n in body.split("C2 · ")[1].split("\n")[0])
    f = d / f"knowledge/people/{stale.lower().replace(' ', '-')}.md"; f.write_text(f.read_text() + "\nAlso checks the footer.\n")  # C2 is stale
    return {"page_id": page, "Name": "Week of 14 Dec 2026", "Kind": "Weekly", "Brain Status": "Ready", "Brain ID": report, "last_edited": "2026-12-14T07:00:00Z", "body": "Your note:".join(parts)}


def mixed(name, reports, publish_setting):
    """Two clean meetings (one with a fact that conflicts) and one with no Date; a Ready Weekly row; Maria's Role changed in Notion, and a
    learned Document's Project, which the brain can't take (NOT_CORRECTABLE)."""
    d = make(name); connect(d, reports, publish_setting)
    mp = d / "knowledge/people/maria-lopez.md"; t = mp.read_text()
    assert f"notion: {MARIA_PAGE}" in t
    mp.write_text(t.replace("\n---\n", '\nnotion_published:\n  Name: Maria López\n  Role: Product Manager\n  "Brain ID": per-3h8w2n6c\n---\n', 1))
    rp = d / "knowledge/references/row-level-security.md"; t = rp.read_text()
    assert "notion:" not in t
    rp.write_text(t.replace("\n---\n", f'\nnotion: {uid(103)}\nnotion_published:\n  Name: Row-level security\n  Project: []\n  "Brain ID": con-1s6t8e2b\n---\n', 1))
    week = weekly_row(d, uid(101))
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: published baseline, this week's row")
    rows = [
        {"database": "inbox", "page_id": uid(101), "last_edited": week["last_edited"], "properties": {"Brain ID": week["Brain ID"]}},
        {"database": "people", "page_id": MARIA_PAGE, "last_edited": "2026-12-13T18:00:00Z", "properties": {"Brain ID": "per-3h8w2n6c", "Role": "Product lead"}},
        {"database": "documents", "page_id": uid(103), "last_edited": "2026-12-13T18:00:00Z", "properties": {"Brain ID": "con-1s6t8e2b", "Project": [ACME_PAGE]}},
    ]
    meetings = [
        mtg(1, "Acme design review", "2026-12-10", "## Attendees\nMaria López (Acme), Carlos Ruiz\n\n## Projects\nAcme website\n\n## Action Items\n- [ ] Carlos Ruiz sends the design tokens by 2026-12-17\n\n## Decisions\nUse the new grid for all pages.\n\n## Open Questions\nNone\n\n## Risks\nNone\n"),
        mtg(2, "Acme content check-in", "2026-12-12", "## Attendees\nMaria López (Acme), Carlos Ruiz\n\n## Projects\nAcme website\n\n## Action Items\n- [ ] Maria López confirms the blog topics by 2026-12-19\n\n## Decisions\nThe launch moves from February 2027 to March 2027.\n\n## Open Questions\nWho approves the German copy? Raised by Maria López.\n\n## Risks\nNone\n"),
        mtg(3, "Acme budget call", None, "## Attendees\nMaria López (Acme), Carlos Ruiz\n\n## Projects\nAcme website\n\n## Action Items\nNone\n\n## Decisions\nKeep the budget as it is.\n\n## Open Questions\nNone\n\n## Risks\nNone\n"),
    ]
    sim_files(name, rows, meetings, [week])


def scenario_requests():
    """Publish auto: a report with a refresh and a What to fix waiting, and a duplicated Inbox row with Document asked ticked, whose page is not
    the one the brain recorded for its source (NOTION_ID_MISMATCH)."""
    name = "requests"
    d = make(name); connect(d, reports=True, publish="auto")
    vw = given(d, {"title": "Acme launch: where we stand", "question": "Everything about the Acme launch", "projects": ["prj-9x4t1b7e"], "body": REPORT_BODY}, "report", "new")
    text = (d / vw["path"]).read_text().split("\n---\n", 1)[1].removeprefix("\n"); vw = vw["id"]  # the page shows the brain's text: no wording waits
    publish(d, vw, uid(301))
    given(d, {"notes": [{"type": "source", "id": "src-4m9q2x7c", "title": "Hosting offer", "file_date": "2026-12-10", "frontmatter": {"source_key": "agent:eval/hosting-offer", "kind": "document"}, "body": "The hosting offer covers the Acme website.\n"}]}, "note", "new")
    publish(d, "src-4m9q2x7c", uid(302))
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: published report, published source")
    rows = [
        {"database": "documents", "page_id": uid(301), "last_edited": "2026-12-13T18:00:00Z", "properties": {"Brain ID": vw, "Refresh asked": True, "What to fix": "Maria left Acme in June"},
         "wording": {"accepted": False, "accepted_at": None, "page_edited_at": "2026-12-13T18:00:00Z", "body_markdown": text, "unconvertible": False, "pending_revision": False, "pending_refresh": False}},
        {"database": "inbox", "page_id": uid(302), "last_edited": "2026-12-13T18:00:00Z", "properties": {"Brain ID": "src-4m9q2x7c"}},
        {"database": "inbox", "page_id": uid(303), "last_edited": "2026-12-13T18:00:00Z", "properties": {"Brain ID": "src-4m9q2x7c", "Document asked": True, "Only keep": None}},
    ]
    sim_files(name, rows, [])


SCENARIOS = {
    "noop": scenario_noop,
    "noop-connected": scenario_noop_connected,
    "budget": scenario_budget,
    "mixed-on": lambda: mixed("mixed-on", reports=True, publish_setting="auto"),
    "mixed-reports-off": lambda: mixed("mixed-reports-off", reports=False, publish_setting="auto"),
    "mixed-ask": lambda: mixed("mixed-ask", reports=True, publish_setting="ask"),
    "requests": scenario_requests,
}

if __name__ == "__main__":
    kind = sys.argv[1] if len(sys.argv) > 1 else ""
    if kind not in SCENARIOS and kind != "all":
        sys.exit(f"usage: setup.py <{'|'.join(SCENARIOS)}|all>")
    prepare()
    for name in (SCENARIOS if kind == "all" else [kind]):
        SCENARIOS[name]()
        print(B / name)
