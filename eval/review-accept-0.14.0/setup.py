#!/usr/bin/env python3
"""Build the brains and the simulated Notion files for the "no second yes" runs (CC-215, decision 0055, capture-and-review §7.3).

    python3 eval/review-accept-0.14.0/setup.py <scenario>      one scenario
    python3 eval/review-accept-0.14.0/setup.py all             every scenario

Needs `npm run build` in the repo first (the `brain` shim runs bin/brain.js). Everything is synthetic and goes under
$UB_EVAL_DIR (default /tmp/ub-eval-review-accept): `bin/brain` (the shim), `bin/gh` (a stub that always fails), `no-mcp.json` (an empty MCP config), and per
scenario `<name>/` (the brain) and `<name>-sim/` (the Notion answers: review.json, pages/<id>.json, snapshot.json, writes.md).
$UB_SKILLS_SRC, when set, is a skills fork's `brain/` folder: its skills replace the vendored ones in each brain, so a fork
PR's skills can run before their release. Unset, the brains get this repo's vendored snapshot.
"""
import json, os, pathlib, re, shutil, subprocess, sys

R = pathlib.Path(__file__).resolve().parents[2]
B = pathlib.Path(os.environ.get("UB_EVAL_DIR", "/tmp/ub-eval-review-accept"))
SKILLS = os.environ.get("UB_SKILLS_SRC", "")
NOW = "2026-11-10T09:00:00Z"
DECIDED = "2026-11-10T09:30:00.000Z"
SYNC, KICKOFF, PROJECT, CONCEPT = "mtg-8c4n2p7w", "mtg-5r2k8v3a", "prj-9x4t1b7e", "con-1s6t8e2b"
def uid(n): return f"{0xe3000000:08x}-0000-4000-8000-{n:012d}"


def prepare():
    (B / "bin").mkdir(parents=True, exist_ok=True)
    shim = B / "bin" / "brain"
    shim.write_text(f'#!/bin/sh\nexec node {R}/bin/brain.js "$@"\n')
    shim.chmod(0o755)
    gh = B / "bin" / "gh"
    gh.write_text('#!/bin/sh\necho "gh is not available in this sandbox" >&2\nexit 1\n')
    gh.chmod(0o755)
    (B / "no-mcp.json").write_text('{"mcpServers":{}}\n')
    os.environ["PATH"] = f"{B / 'bin'}:{os.environ['PATH']}"


def sh(*a, cwd=None, check=True):
    return subprocess.run(a, cwd=cwd, check=check, capture_output=True, text=True).stdout


def git(d, *a, check=True):
    return sh("git", "-c", "user.name=Blind", "-c", "user.email=b@brain.example", *a, cwd=d, check=check)


def brain(d, *args, payload=None):
    extra = []
    if payload is not None:
        f = B / f"{d.name}-input.json"; f.write_text(json.dumps(payload)); extra = ["--input", str(f)]
    out = json.loads(sh("brain", *args, *extra, "--brain", str(d), "--now", NOW, "--json", check=False))
    if not out.get("ok"): sys.exit(f"brain {' '.join(args)} failed: {json.dumps(out)[:800]}")
    return out["data"]


def config(d, fn):
    p = d / "brain.json"; c = json.loads(p.read_text()); fn(c); p.write_text(json.dumps(c, indent=2) + "\n")


def make(name):
    d = B / name
    shutil.rmtree(d, ignore_errors=True); shutil.rmtree(B / f"{name}-sim", ignore_errors=True)
    sh("node", "scripts/blind-brain.mjs", "brain-acme", str(d), cwd=R)
    if SKILLS:
        for skill in pathlib.Path(SKILLS).iterdir():
            if not skill.is_dir(): continue
            for where in (".agents/skills", ".claude/skills"):
                shutil.rmtree(d / where / skill.name, ignore_errors=True); shutil.copytree(skill, d / where / skill.name)
    # The fixture's older pending proposals are not part of these runs.
    for old in (d / "_proposals").glob("*.md"): old.unlink()
    config(d, lambda c: c.update({"settings": {"publish": "auto", "push": "auto"}, "modules": {"knowledge": True, "orgs": True, "documents": False, "reports": False, "tasks": False, "planning": False}}))
    def dbs(c):
        for i, k in enumerate(c["notion"]["databases"]): c["notion"]["databases"][k] = uid(i + 1)
        c["notion"]["databases"]["capture_inbox"] = ""
    config(d, dbs)
    brain(d, "index")
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: Notion connected, skills under test")
    return d


def row_from(d, source, entries, page):
    """One Review row of the new layout: proposals from one source, rendered and recorded as published at `page`."""
    created = brain(d, "proposal", "new", payload={"proposals": [{**e, "source": source, **({"note_passages": {n: [source] for n in e["notes"]}} if e["kind"] == "review_notes" else {"passages": [source]})} for e in entries]})["created"]
    pid = created[0]["id"]
    [item] = brain(d, "sync", "render", "--ids", pid)["items"]
    brain(d, "sync", "record", payload={"records": [{"id": pid, "notion": page, "synced_at": NOW, "published": item["published"]}]})
    ids = re.findall(r"^## \[[a-z]+ · (it-[0-9a-z]{8})\]", item["body"], re.M)
    return pid, item["body"], ids, item["published"]


def draft_note(d, title, body, source=SYNC):
    return brain(d, "note", "new", payload={"notes": [{"type": "decision", "title": title, "frontmatter": {"summary": title + ".", "date": "2026-11-09", "assessment": "accepted", "projects": [PROJECT], "sources": [source]}, "body": body}]})["created"][0]["id"]


def sync_row(d, page):
    """From Acme sync: a fact change, a text addition, a new draft decision and a link (a, b, c, d)."""
    note = draft_note(d, "Launch in March", "Launch moves to March.\n")
    return row_from(d, SYNC, [
        {"kind": "review_notes", "notes": [note]},
        {"kind": "add_to_note", "title": "RLS", "target": CONCEPT, "content": "Carlos will use RLS for the client portal.", "why": "Carlos said so in the sync."},
        {"kind": "add_link", "title": "link", "target": CONCEPT, "field": "projects", "after": PROJECT, "why": "Discussed for the website."},
        {"kind": "update_fact", "title": "Launch", "target": PROJECT, "field": "launch_date", "after": "2027-03", "why": "Maria moved the launch to March."},
    ], page)


def kickoff_row(d, page):
    """From Acme kickoff: a text addition (a) and a new draft decision (b)."""
    note = draft_note(d, "Every table gets a policy", "Every table in the client portal gets a row-level policy.\n", KICKOFF)
    return row_from(d, KICKOFF, [{"kind": "review_notes", "notes": [note]}, {"kind": "add_to_note", "title": "Kickoff RLS", "target": CONCEPT, "content": "The kickoff agreed that every table gets a policy.", "why": "Agreed at the kickoff."}], page)


def section(body, item_id):
    m = re.search(rf"## \[[a-z]+ · {item_id}\][\s\S]*?(?=\n## |\Z)", body)
    return m


def decide(body, item_id, token, extra=""):
    m = section(body, item_id)
    s = m.group(0).replace("Decision: Pending", f"Decision: {token}{extra}", 1)
    return body[:m.start()] + s + body[m.end():]


def edit_proposed(body, item_id, old, new):
    m = section(body, item_id)
    assert old in m.group(0), (item_id, old)
    return body[:m.start()] + m.group(0).replace(old, new, 1) + body[m.end():]


def review_row(page, published, decided_at=DECIDED, edited=DECIDED, decided=True):
    return {"page_id": page, "last_edited_time": edited, "properties": {"Name": published["Name"], "Kind": published.get("Kind"), "State": "Pending", "Brain ID": published["Brain ID"], "Your call": None, "What to fix": "", "Decided": decided, "Decided at": {"start": decided_at} if decided_at else None, "Accept all": False}}


def page_file(row, body):
    return {"last_edited_time": row["last_edited_time"], "properties": row["properties"], "body_markdown": body}


def sim(name, rows, pages, rereads=None):
    s = B / f"{name}-sim"; (s / "pages").mkdir(parents=True, exist_ok=True)
    (s / "review.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False))
    (s / "snapshot.json").write_text(json.dumps({"as_of": DECIDED, "rows": []}, indent=1))
    for pid, page in pages.items(): (s / "pages" / f"{pid}.json").write_text(json.dumps(page, indent=1, ensure_ascii=False))
    for pid, page in (rereads or {}).items(): (s / "pages" / f"{pid}.reread.json").write_text(json.dumps(page, indent=1, ensure_ascii=False))
    (s / "writes.md").write_text("")


def items(ids):
    """The row's letters in page order: a fact, b text, c note, d link (spec/schema.md §11.3)."""
    return dict(zip("abcd", ids))


def scenario_exact():
    """One submitted row: a accepted with the user's own value, b accepted as proposed, c rejected, d left Pending."""
    d = make("exact"); p = uid(101)
    pid, body, ids, pub = sync_row(d, p); it = items(ids)
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: Review row published")
    body = edit_proposed(decide(body, it["a"], "Accept"), it["a"], "2027-03", "2027-04")
    body = decide(decide(body, it["b"], "Accept"), it["c"], "Reject")
    row = review_row(p, pub)
    sim("exact", [row], {p: page_file(row, body)})


def scenario_held():
    """Row 1 (sync): a accepted, but the project's launch date changed in Git since the render (base changed); b and c accepted;
    d Pending. Between the plan and the re-read the user edits b's wording at 09:52, a later minute than Decided at (09:30),
    so the re-read invalidates the row's unapplied decisions: nothing of row 1 applies until the user submits again.
    Row 2 (kickoff): a accepted, but the page was edited at 09:45, a later minute than Decided at, before the first read."""
    d = make("held"); p1, p2 = uid(101), uid(102)
    _, body1, ids, pub1 = sync_row(d, p1); it = items(ids)
    _, body2, [k, _k2], pub2 = kickoff_row(d, p2)
    proj = d / "projects/acme-website/project.md"
    proj.write_text(proj.read_text().replace("  launch_date: 2027-02", "  launch_date: 2027-05", 1))
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: Review rows published; the project's launch date changed since")
    body1 = decide(decide(decide(body1, it["a"], "Accept"), it["b"], "Accept"), it["c"], "Accept")
    later = edit_proposed(body1, it["b"], "Carlos will use RLS for the client portal.", "Carlos will use RLS for the client portal and the admin app.")
    row1 = review_row(p1, pub1)
    row1_later = {**row1, "last_edited_time": "2026-11-10T09:52:00.000Z"}
    row2 = review_row(p2, pub2, edited="2026-11-10T09:45:00.000Z")
    sim("held", [row1, row2], {p1: page_file(row1, body1), p2: page_file(row2, decide(body2, k, "Accept"))}, rereads={p1: page_file(row1_later, later)})


def scenario_ambiguous():
    """Two submitted rows, both from Acme meetings; the user asks for "the Acme review"."""
    d = make("ambiguous"); p1, p2 = uid(101), uid(102)
    _, body1, ids, pub1 = sync_row(d, p1); it = items(ids)
    _, body2, [k, _k2], pub2 = kickoff_row(d, p2)
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: two Review rows published")
    row1, row2 = review_row(p1, pub1), review_row(p2, pub2)
    sim("ambiguous", [row1, row2], {p1: page_file(row1, decide(body1, it["b"], "Accept")), p2: page_file(row2, decide(body2, k, "Accept"))})


def scenario_revision():
    """One submitted row: a Request revision with an instruction, b accepted."""
    d = make("revision"); p = uid(101)
    _, body, ids, pub = sync_row(d, p); it = items(ids)
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: Review row published")
    body = decide(decide(body, it["a"], "Request revision", "\nRevision request: make it April, Maria said the agency needs one more month"), it["b"], "Accept")
    row = review_row(p, pub)
    sim("revision", [row], {p: page_file(row, body)})


def scenario_catchup():
    """A catch-up whose only waiting work is one submitted row: a accepted with the user's value, b accepted."""
    d = make("catchup"); p = uid(101)
    _, body, ids, pub = sync_row(d, p); it = items(ids)
    git(d, "add", "-A"); git(d, "commit", "-qm", "setup: Review row published")
    body = edit_proposed(decide(body, it["a"], "Accept"), it["a"], "2027-03", "2027-04")
    body = decide(body, it["b"], "Accept")
    row = review_row(p, pub)
    sim("catchup", [row], {p: page_file(row, body)})


SCENARIOS = {"exact": scenario_exact, "held": scenario_held, "ambiguous": scenario_ambiguous, "revision": scenario_revision, "catchup": scenario_catchup}

if __name__ == "__main__":
    kind = sys.argv[1] if len(sys.argv) > 1 else ""
    if kind not in SCENARIOS and kind != "all":
        sys.exit(f"usage: setup.py <{'|'.join(SCENARIOS)}|all>")
    prepare()
    for name in (SCENARIOS if kind == "all" else [kind]):
        SCENARIOS[name](); print(B / name)
