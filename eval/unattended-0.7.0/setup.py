import json, os, subprocess, sys, pathlib, re, shutil
R = pathlib.Path.home() / "GitHub/ub-CC-64"
B = pathlib.Path("/tmp/cc64")
SHIM = str(B / "bin")
env = {**os.environ, "PATH": f"{SHIM}:{os.environ['PATH']}"}
NOW = "2026-12-14T09:00:00Z"
MARIA_PAGE = "-".join(["7a8b9c0d", "1e2f", "4a3b", "8c4d", "5e6f7a8b9c0d"])  # the fixture's page id for Maria
def sh(*a, cwd=None, check=True):
    return subprocess.run(a, cwd=cwd, env=env, check=check, capture_output=True, text=True).stdout
def make(name):
    d = B / name
    shutil.rmtree(d, ignore_errors=True)
    sh("node", "scripts/blind-brain.mjs", "brain-acme", str(d), cwd=R)
    sh("brain", "proposal", "backlog", "--brain", str(d), "--json")
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: backlog done", check=False)
    return d
def git(d, *a, check=True):
    return sh("git", "-c", "user.name=Blind", "-c", "user.email=b@brain.example", *a, cwd=d, check=check)
def config(d, fn):
    p = d / "brain.json"; c = json.loads(p.read_text()); fn(c); p.write_text(json.dumps(c, indent=2) + "\n")

kind = sys.argv[1]
if kind == "noop":
    d = make("noop"); git(d, "status", "--short")
elif kind == "budget":
    d = make("budget")
    drop = B / "budget-drop"; shutil.rmtree(drop, ignore_errors=True); drop.mkdir()
    for i in range(1, 13):
        f = drop / f"note-{i:02d}.md"
        f.write_text(f"# Supplier note {i}\n\nOn 2026-12-{i:02d} Maria López from Acme asked for update number {i} on the website content plan. Carlos Ruiz will reply by 2026-12-{i+10:02d}.\n")
        os.utime(f, (1765000000 + i * 3600, 1765000000 + i * 3600))
    with open(d / "AGENTS.md", "a") as f: f.write(f"\nDrop folder: {drop}\n")
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: drop folder")
elif kind in ("mixed-on", "mixed-off"):
    on = kind == "mixed-on"
    d = make(kind)
    ids = {}
    def uid(n): return f"{0xe1000000:08x}-0000-4000-8000-{n:012d}"
    def cfg(c):
        for i, k in enumerate(c["notion"]["databases"]): c["notion"]["databases"][k] = uid(i + 1)
        c["settings"] = {"publish": "auto" if on else "ask", "push": "auto"}
        c["modules"] = {"knowledge": True, "orgs": True, "documents": False, "reports": on, "tasks": False, "planning": False}
    config(d, cfg)
    # two pending proposals
    prop = {"proposals": [
      {"kind": "update_fact", "title": "Launch: March", "target": "prj-9x4t1b7e", "field": "launch_date", "after": "2027-03", "why": "Moved in the sync.", "source": "mtg-8c4n2p7w"},
      {"kind": "update_fact", "title": "Budget: 95000", "target": "prj-9x4t1b7e", "field": "budget", "after": "95000 EUR", "why": "Licence added.", "source": "mtg-8c4n2p7w"}]}
    (B / f"{kind}-prop.json").write_text(json.dumps(prop))
    out = json.loads(sh("brain", "proposal", "new", "--input", str(B / f"{kind}-prop.json"), "--brain", str(d), "--now", NOW, "--json"))
    p1, p2 = [c["id"] for c in out["data"]["created"]]
    # Maria's Role changed in Notion
    mp = d / "knowledge/people/maria-lopez.md"; t = mp.read_text()
    assert f"notion: {MARIA_PAGE}" in t
    t = t.replace("\n---\n", '\nnotion_published:\n  Name: Maria López\n  Role: Product Manager\n  "Brain ID": per-3h8w2n6c\n---\n', 1)
    mp.write_text(t)
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: proposals, published baseline")
    sim = d.parent / f"{kind}-sim"; shutil.rmtree(sim, ignore_errors=True); sim.mkdir()
    rows = [
      {"database": "review", "page_id": uid(101), "last_edited": NOW, "properties": {"Name": "Launch: March", "Brain ID": p1, "Your call": "Approve", "What to fix": "", "State": "Pending"}},
      {"database": "review", "page_id": uid(102), "last_edited": NOW, "properties": {"Name": "Budget: 95000", "Brain ID": p2, "Your call": "Fix", "What to fix": "a: 90000 EUR, not 95000", "State": "Pending"}},
      {"database": "people", "page_id": MARIA_PAGE, "last_edited": "2026-12-13T18:00:00Z", "properties": {"Brain ID": "per-3h8w2n6c", "Role": "Product lead"}},
    ]
    (sim / "snapshot.json").write_text(json.dumps({"as_of": NOW, "rows": rows}, indent=1))
    def mtg(n, title, date, body):
        return {"page_id": uid(200 + n), "Name": title, "Date": date, "Brain Status": "Reviewed", "Project": "Acme website", "Attendees": ["Maria López", "Carlos Ruiz"], "page_text": body}
    meetings = [
      mtg(1, "Acme design review", "2026-12-10", "## Attendees\nMaria López (Acme), Carlos Ruiz\n\n## Projects\nAcme website\n\n## Action Items\n- [ ] Carlos Ruiz sends the design tokens by 2026-12-17\n\n## Decisions\nUse the new grid for all pages.\n\n## Open Questions\nNone\n\n## Risks\nNone\n"),
      mtg(2, "Acme content check-in", "2026-12-12", "## Attendees\nMaria López (Acme), Carlos Ruiz\n\n## Projects\nAcme website\n\n## Action Items\n- [ ] Maria López confirms the blog topics by 2026-12-19\n\n## Decisions\nPublish the case studies two weeks after launch.\n\n## Open Questions\nWho approves the German copy? Raised by Maria López.\n\n## Risks\nNone\n"),
      {**mtg(3, "Acme budget call", None, "## Attendees\nMaria López (Acme), Carlos Ruiz\n\n## Projects\nAcme website\n\n## Action Items\nNone\n\n## Decisions\nKeep the budget as it is.\n\n## Open Questions\nNone\n\n## Risks\nNone\n"), "Date": None},
    ]
    (sim / "meetings.json").write_text(json.dumps(meetings, indent=1))
    (sim / "writes.md").write_text("")
print(d)
