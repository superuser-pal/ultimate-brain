# Prompt 6 — Templates

Paste into Notion AI. Before: [Prompt 5](05-ownership.md). Then do step 6b by hand. Next: [Prompt 7](07-spaces-views.md).

Each template is the database's default, and its linked views show only rows related to the page (docs/notion-space-design.md §4). On project pages, the brain writes only inside the "Brief" and "Decision log" toggle headings (decision 0026).

```text
Create a default page template for each database below. Inside each template, add linked views filtered to the current page, as listed. Add at the end of each template a toggle named "My notes".

- Areas: a callout showing the Summary; linked view of Goals where Area is this page and Status is Active; linked view of Projects where Area is this page and Status is Active.
- Goals: a callout titled "Why"; linked table of Key Results where Goal is this page showing Kind, Current, Target, Unit, Done, Progress; linked view of Projects where Goal is this page.
- Projects: a toggle heading "Brief" containing one empty paragraph; a toggle heading "Decision log" containing one empty paragraph; linked view of Questions where Project is this page and Status is Open; linked view of Meetings where Project is this page sorted by Date descending; linked view of Tasks where Project is this page and Status is not Done; linked view of People where Projects contains this page.
- Meetings: an empty callout titled "Minutes format"; a checklist titled "Before marking Reviewed" with the items "Attendees linked", "Project linked", "Minutes follow the format", "Minutes checked and corrected"; linked view of Decisions where Decided In is this page; linked view of Questions where Raised In is this page; linked view of Tasks where Meeting is this page.
- People: a callout showing Role and Org; linked view of Meetings where Attendees contains this page; linked view of Projects where People contains this page.
- Orgs: linked view of People where Org is this page; linked view of Projects where Client is this page.
Set each of these templates as the database default.
```

## Step 6b — Paste the minutes format (by hand)

Notion AI can't read this repo, so you paste the text yourself:

1. Open the Meetings database → **New** ▾ → edit the default template.
2. Copy the text block from [../minutes-format.md](../minutes-format.md).
3. Paste it inside the "Minutes format" callout.

## Verify
- [ ] Create a new Project: "Brief" and "Decision log" are **toggle** headings (with an arrow), followed by the four linked views and "My notes". Delete the test project.
- [ ] Create a new Meeting: the "Minutes format" callout holds the full minutes text, starting with "Summarize this meeting using exactly these sections". Delete the test meeting.
- [ ] Every template listed above is the default for its database.
