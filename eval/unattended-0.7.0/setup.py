#!/usr/bin/env python3
"""Build the brains and the simulated Notion files for the unattended catch-up runs (CC-64, decision 0051).

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
# Page ids the fixture or this script gives Notion pages; built from parts so no literal UUID sits in the repo.
def uid(n): return f"{0xe1000000:08x}-0000-4000-8000-{n:012d}"
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
    return subprocess.run(a, cwd=cwd, check=check, capture_output=True, text=True).stdout


def git(d, *a, check=True):
    return sh("git", "-c", "user.name=Blind", "-c", "user.email=b@brain.example", *a, cwd=d, check=check)


def brain(d, *args):
    return json.loads(sh("brain", *args, "--brain", str(d), "--now", NOW, "--json"))["data"]


def make(name):
    d = B / name
    shutil.rmtree(d, ignore_errors=True)
    shutil.rmtree(B / f"{name}-sim", ignore_errors=True)
    sh("node", "scripts/blind-brain.mjs", "brain-acme", str(d), cwd=R)
    sh("brain", "proposal", "backlog", "--brain", str(d), "--json")  # the one-time backlog rows are not work for these runs
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: backlog done", check=False)
    return d


def config(d, fn):
    p = d / "brain.json"; c = json.loads(p.read_text()); fn(c); p.write_text(json.dumps(c, indent=2) + "\n")


def connect(d, reports, publish, documents=False):
    def apply(c):
        for i, k in enumerate(c["notion"]["databases"]): c["notion"]["databases"][k] = uid(i + 1)
        if documents:  # the fixture's brain.json predates these keys; a Promote request needs the Documents database to be set up
            for i, k in enumerate(["inbox", "concepts", "documents"]): c["notion"]["databases"][k] = uid(50 + i)
        c["settings"] = {"publish": publish, "push": "auto"}
        c["modules"] = {"knowledge": True, "orgs": True, "documents": documents, "reports": reports, "tasks": False, "planning": False}
    config(d, apply)


def sim_files(name, rows, meetings):
    sim = B / f"{name}-sim"; sim.mkdir(parents=True, exist_ok=True)
    (sim / "snapshot.json").write_text(json.dumps({"as_of": NOW, "rows": rows}, indent=1))
    (sim / "meetings.json").write_text(json.dumps(meetings, indent=1))
    (sim / "writes.md").write_text("")


def mtg(n, title, date, body):
    return {"page_id": uid(200 + n), "Name": title, "Date": date, "Brain Status": "Reviewed", "Project": "Acme website", "Attendees": ["Maria López", "Carlos Ruiz"], "page_text": body}


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


def mixed(name, reports, publish):
    """Two clean meetings and one with no Date; a Review row set to Approve and one set to Fix with text; Maria's Role changed in Notion."""
    d = make(name); connect(d, reports, publish)
    (B / f"{name}-prop.json").write_text(json.dumps({"proposals": [
        {"kind": "update_fact", "title": "Launch: March", "target": "prj-9x4t1b7e", "field": "launch_date", "after": "2027-03", "why": "Moved in the sync.", "source": "mtg-8c4n2p7w"},
        {"kind": "update_fact", "title": "Budget: 95000", "target": "prj-9x4t1b7e", "field": "budget", "after": "95000 EUR", "why": "Licence added.", "source": "mtg-8c4n2p7w"}]}))
    created = brain(d, "proposal", "new", "--input", str(B / f"{name}-prop.json"))["created"]
    p1, p2 = created[0]["id"], created[1]["id"]
    mp = d / "knowledge/people/maria-lopez.md"; t = mp.read_text()
    assert f"notion: {MARIA_PAGE}" in t
    mp.write_text(t.replace("\n---\n", '\nnotion_published:\n  Name: Maria López\n  Role: Product Manager\n  "Brain ID": per-3h8w2n6c\n---\n', 1))
    dp = d / "knowledge/decisions/2026-12-03-use-supabase-for-auth.md"; t = dp.read_text()
    assert "notion:" not in t
    dp.write_text(t.replace("\n---\n", f'\nnotion: {uid(103)}\nnotion_published:\n  Name: Use Supabase for auth\n  Assessment: Accepted\n  "Brain ID": dec-7k2m9q4x\n---\n', 1))
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: proposals, published baseline")
    rows = [
        {"database": "review", "page_id": uid(101), "last_edited": NOW, "properties": {"Name": "Launch: March", "Brain ID": p1, "Your call": "Approve", "What to fix": "", "State": "Pending"}},
        {"database": "review", "page_id": uid(102), "last_edited": NOW, "properties": {"Name": "Budget: 95000", "Brain ID": p2, "Your call": "Fix", "What to fix": "a: 90000 EUR, not 95000", "State": "Pending"}},
        {"database": "people", "page_id": MARIA_PAGE, "last_edited": "2026-12-13T18:00:00Z", "properties": {"Brain ID": "per-3h8w2n6c", "Role": "Product lead"}},
        # A change the brain can't take: a decision's Assessment is not correctable (NOT_CORRECTABLE).
        {"database": "decisions", "page_id": uid(103), "last_edited": NOW, "properties": {"Brain ID": "dec-7k2m9q4x", "Assessment": "Contested"}},
    ]
    meetings = [
        mtg(1, "Acme design review", "2026-12-10", "## Attendees\nMaria López (Acme), Carlos Ruiz\n\n## Projects\nAcme website\n\n## Action Items\n- [ ] Carlos Ruiz sends the design tokens by 2026-12-17\n\n## Decisions\nUse the new grid for all pages.\n\n## Open Questions\nNone\n\n## Risks\nNone\n"),
        mtg(2, "Acme content check-in", "2026-12-12", "## Attendees\nMaria López (Acme), Carlos Ruiz\n\n## Projects\nAcme website\n\n## Action Items\n- [ ] Maria López confirms the blog topics by 2026-12-19\n\n## Decisions\nPublish the case studies two weeks after launch.\n\n## Open Questions\nWho approves the German copy? Raised by Maria López.\n\n## Risks\nNone\n"),
        mtg(3, "Acme budget call", None, "## Attendees\nMaria López (Acme), Carlos Ruiz\n\n## Projects\nAcme website\n\n## Action Items\nNone\n\n## Decisions\nKeep the budget as it is.\n\n## Open Questions\nNone\n\n## Risks\nNone\n"),
    ]
    sim_files(name, rows, meetings)


def scenario_requests():
    """Reports and Documents on, publish auto: a report with a refresh and a What to fix waiting, and a decision with Promote asked on a page that also has a conflict."""
    name = "requests"
    d = make(name); connect(d, reports=True, publish="auto", documents=True)
    (B / f"{name}-report.json").write_text(json.dumps({"title": "Acme launch: where we stand", "question": "Everything about the Acme launch", "projects": ["prj-9x4t1b7e"], "body": REPORT_BODY}))
    vw = brain(d, "report", "new", "--input", str(B / f"{name}-report.json"))["id"]
    item = brain(d, "sync", "render", "--ids", vw)["items"][0]
    report_page = uid(301)
    (B / f"{name}-record.json").write_text(json.dumps({"records": [{"id": vw, "notion": report_page, "synced_at": NOW, "published": item["published"]}]}))
    brain(d, "sync", "record", "--input", str(B / f"{name}-record.json"))
    # The decision's Name changed on both sides since it was published: a BOTH_CHANGED conflict on the page that also has Promote asked.
    dp = d / "knowledge/decisions/2026-12-03-use-supabase-for-auth.md"; t = dp.read_text()
    assert "notion:" not in t
    t = t.replace("\n---\n", f'\nnotion: {uid(302)}\nnotion_published:\n  Name: Use Supabase for auth\n  "Brain ID": dec-7k2m9q4x\n---\n', 1)
    dp.write_text(t.replace("title: Use Supabase for auth\n", "title: Use Supabase for authentication\n", 1))
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: published report, decision with a changed title")
    rows = [
        {"database": "inbox", "page_id": report_page, "last_edited": NOW, "properties": {"Brain ID": vw, "Refresh asked": True, "What to fix": "Maria left Acme in June"}},
        {"database": "decisions", "page_id": uid(302), "last_edited": NOW, "properties": {"Name": "Auth: Supabase", "Brain ID": "dec-7k2m9q4x", "Promote asked": True}},
    ]
    sim_files(name, rows, [])


SCENARIOS = {
    "noop": scenario_noop,
    "noop-connected": scenario_noop_connected,
    "budget": scenario_budget,
    "mixed-on": lambda: mixed("mixed-on", reports=True, publish="auto"),
    "mixed-reports-off": lambda: mixed("mixed-reports-off", reports=False, publish="auto"),
    "mixed-ask": lambda: mixed("mixed-ask", reports=True, publish="ask"),
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
